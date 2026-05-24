"""
RAG QA Engine — retrieval-augmented generation with streaming and citations.
"""
import logging
import re
import time
from typing import AsyncGenerator, List, Optional
from gmi_client import gmi
from services.retriever import search
from services.retrieval_diagnostics import DiagnosticsContext
from services.graph_retriever import retrieve_graph_context, format_context_for_qa

logger = logging.getLogger(__name__)

# In-memory conversation store (per session)
_conversations: dict[str, List[dict]] = {}


async def ask(
    question: str, top_k: int = 5, session_id: str = "default"
) -> dict:
    """RAG Q&A: retrieve contexts, generate answer with citations."""
    diag = DiagnosticsContext()

    # --- retrieval step ---
    t0 = time.perf_counter()
    retrieved = await search(question, top_k=top_k)
    retrieval_ms = (time.perf_counter() - t0) * 1000

    # Detect retrieval mode from metadata
    retrieval_mode = "semantic"
    degraded = False
    reason = ""
    if retrieved and retrieved[0].get("metadata", {}).get("retrieval") == "keyword_fallback":
        retrieval_mode = "keyword_fallback"
        degraded = True
        reason = "Embedding model unavailable; using keyword fallback."
    elif not retrieved:
        retrieval_mode = "degraded"
        degraded = True
        reason = "No results from any retrieval path."

    diag.add_step(retrieval_mode, len(retrieved), retrieval_ms, degraded=degraded, degradation_reason=reason)

    contexts = [r["text"] for r in retrieved]

    # Build context with document titles for better citation
    contexts_with_titles: list[str] = []
    for i, r in enumerate(retrieved):
        meta = r.get("metadata", {})
        title = meta.get("title") or meta.get("doc_id", "")[:30]
        contexts_with_titles.append(f"[Source {i+1} — {title}]\n{r['text']}")

    # --- graph retrieval step (optional enhancement) ---
    graph_text = ""
    graph_nodes_for_response: list[dict] = []
    try:
        from database import SessionLocal
        db = SessionLocal()
        try:
            t1 = time.perf_counter()
            graph_ctx = retrieve_graph_context(db, question, max_seeds=3)
            graph_ms = (time.perf_counter() - t1) * 1000

            if graph_ctx.nodes and not graph_ctx.degraded:
                graph_text = format_context_for_qa(graph_ctx)
                graph_nodes_for_response = [
                    {"id": n["id"], "node_type": n["node_type"], "label": n["label"],
                     "stable_key": n.get("stable_key", ""), "content_snippet": (n.get("content_snippet") or "")[:200]}
                    for n in graph_ctx.nodes[:10]
                ]
                diag.add_step("graph", len(graph_ctx.nodes), graph_ms)
            elif graph_ctx.degraded:
                diag.add_step("graph", 0, graph_ms, degraded=True,
                              degradation_reason=graph_ctx.degradation_reason)
            else:
                diag.add_step("graph", 0, graph_ms)
        finally:
            db.close()
    except Exception as exc:
        logger.warning("Graph retrieval failed, continuing without graph context: %s", exc)
        diag.add_step("graph", 0, 0, degraded=True, degradation_reason=str(exc))

    # Prepend graph context before text contexts (so the model sees structured knowledge first)
    if graph_text:
        contexts_with_titles.insert(0, graph_text)

    history = _conversations.get(session_id, [])[-6:]

    result = await gmi.ask_with_context(question, contexts_with_titles, history)

    citations = _extract_citations(retrieved, result["answer"])

    # Update conversation history
    if session_id not in _conversations:
        _conversations[session_id] = []
    _conversations[session_id].append({"role": "user", "content": question})
    _conversations[session_id].append({"role": "assistant", "content": result["answer"]})

    diag.finalize()

    return {
        "question": question,
        "answer": result["answer"],
        "citations": citations,
        "retrieved_chunks": [
            {"text": r["text"], "metadata": r["metadata"], "score": r["score"]}
            for r in retrieved
        ],
        "model": result["model"],
        "tokens_input": result["tokens_input"],
        "tokens_output": result["tokens_output"],
        "latency_ms": result["latency_ms"],
        "diagnostics": diag.to_dict(),
        "graph_context": graph_nodes_for_response if graph_nodes_for_response else None,
    }


async def ask_stream(
    question: str, top_k: int = 5, session_id: str = "default"
) -> AsyncGenerator[str, None]:
    """Streaming RAG Q&A with SSE."""
    retrieved = await search(question, top_k=top_k)
    contexts = []
    for i, r in enumerate(retrieved):
        meta = r.get("metadata", {})
        title = meta.get("title") or meta.get("doc_id", "")[:30]
        contexts.append(f"[Source {i+1} — {title}]\n{r['text']}")
    history = _conversations.get(session_id, [])[-6:]

    # Stream tokens
    async for token in gmi.ask_stream(question, contexts, history):
        yield token

    # Update history (we'd need to construct full answer - handled in the route)


def save_to_history(session_id: str, question: str, answer: str):
    """Save a Q&A pair to the in-memory conversation history."""
    if session_id not in _conversations:
        _conversations[session_id] = []
    _conversations[session_id].append({"role": "user", "content": question})
    _conversations[session_id].append({"role": "assistant", "content": answer})


def clear_session(session_id: str):
    _conversations.pop(session_id, None)


def _extract_citations(retrieved: List[dict], answer: str) -> List[dict]:
    """Parse [Source N] references from the answer and link to retrieved chunks."""
    pattern = re.compile(r"\[Source\s*(\d+)\]", re.IGNORECASE)
    cited_indices = set()
    for match in pattern.finditer(answer):
        idx = int(match.group(1)) - 1
        if 0 <= idx < len(retrieved):
            cited_indices.add(idx)

    return [
        {
            "source_index": i + 1,
            "text": retrieved[i]["text"][:300],
            "metadata": retrieved[i]["metadata"],
            "score": retrieved[i]["score"],
        }
        for i in cited_indices
    ]
