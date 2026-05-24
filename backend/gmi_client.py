"""
GMI Cloud Inference Engine — unified multi-model routing client.
All LLM/embedding calls flow through this single module.
OpenAI-compatible SDK. Sponsor integration showcase.
"""
from __future__ import annotations

import time
import logging
import hashlib
import os
from typing import AsyncGenerator, Optional, List, Dict
from openai import AsyncOpenAI
import json
from config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


class GMIClient:
    def __init__(self):
        self.client = AsyncOpenAI(
            api_key=settings.gmi_api_key,
            base_url=settings.gmi_base_url,
            timeout=120.0,
            max_retries=2,
        )
        self.models = {
            "translate": settings.llm_translate,
            "qa": settings.llm_qa,
            "structure": settings.llm_structure,
            "embed": settings.llm_embed,
        }

    # ── Translation ─────────────────────────────────────────────
    async def translate(
        self, text: str, source_lang: str, target_lang: str, glossary: Optional[Dict[str, str]] = None
    ) -> dict:
        """Translate a single text chunk with glossary injection and translation memory."""
        # Check translation memory cache
        source_hash = hashlib.sha256(f"{source_lang}:{target_lang}:{text}".encode()).hexdigest()
        cached = _lookup_cache(source_hash)
        if cached:
            cached["cached"] = True
            return cached

        glossary_block = _format_glossary(glossary, source_lang, target_lang)

        system_msg = (
            f"You are an expert professional translator for {source_lang} → {target_lang}. "
            "Preserve all formatting, Markdown, HTML tags, placeholders, and line breaks exactly. "
            "Maintain the original tone and register (formal/casual/technical)."
        )
        if glossary_block:
            system_msg += f"\n\nSTRICT TERMINOLOGY MAP — use these exact translations:\n{glossary_block}"

        t0 = time.monotonic()
        resp = await self.client.chat.completions.create(
            model=self.models["translate"],
            messages=[
                {"role": "system", "content": system_msg},
                {"role": "user", "content": f"Translate this {source_lang} text to {target_lang}:\n\n{text}"},
            ],
            temperature=0.15,
            max_completion_tokens=4096,
        )
        elapsed = (time.monotonic() - t0) * 1000
        choice = resp.choices[0]
        translated_text = choice.message.content or ""
        if not translated_text.strip():
            logger.warning(f"Empty translation returned by model for text starting: {text[:80]!r}")
        result = {
            "translated_text": translated_text,
            "model": self.models["translate"],
            "tokens_input": resp.usage.prompt_tokens if resp.usage else 0,
            "tokens_output": resp.usage.completion_tokens if resp.usage else 0,
            "latency_ms": round(elapsed, 1),
        }

        # Save to translation memory
        _save_cache(source_hash, text, result["translated_text"], source_lang, target_lang)

        return result

    # ── Structured QA (RAG) ─────────────────────────────────────
    async def ask_with_context(
        self, question: str, contexts: List[str], history: Optional[List[dict]] = None
    ) -> dict:
        """DeepSeek V3 RAG QA with source citation requirement."""
        ctx_text = "\n\n---\n\n".join(
            f"[Source {i+1}] {c}" for i, c in enumerate(contexts)
        )
        system_msg = (
            "You are an expert assistant for overseas business expansion. "
            "Answer the user's question using ONLY the document contexts provided below. "
            "Always cite sources in your answer as [Source N]. "
            "Use clear paragraph breaks. Do not use markdown formatting characters like **, #, or bullet points. "
            "Write in natural flowing prose with one idea per paragraph. "
            "If the contexts do not contain enough information, say so clearly. "
            "Be concise but comprehensive."
        )
        messages = [{"role": "system", "content": system_msg}]
        if history:
            messages.extend(history)
        messages.append({"role": "user", "content": f"Contexts:\n{ctx_text}\n\nQuestion: {question}"})

        t0 = time.monotonic()
        resp = await self.client.chat.completions.create(
            model=self.models["qa"],
            messages=messages,
            temperature=0.3,
            max_completion_tokens=2048,
        )
        elapsed = (time.monotonic() - t0) * 1000
        choice = resp.choices[0]
        return {
            "answer": choice.message.content,
            "model": self.models["qa"],
            "tokens_input": resp.usage.prompt_tokens if resp.usage else 0,
            "tokens_output": resp.usage.completion_tokens if resp.usage else 0,
            "latency_ms": round(elapsed, 1),
        }

    # ── Streaming QA ────────────────────────────────────────────
    async def ask_stream(
        self, question: str, contexts: List[str], history: Optional[List[dict]] = None
    ) -> AsyncGenerator[str, None]:
        system_msg = (
            "You are an expert assistant for overseas business expansion. "
            "Answer using ONLY the provided document contexts. "
            "Always cite sources as [Source N]. "
            "Use clear paragraph breaks. No markdown formatting. "
            "If unsure, say so."
        )
        messages = [{"role": "system", "content": system_msg}]
        if history:
            messages.extend(history)
        ctx_text = "\n\n---\n\n".join(
            c for i, c in enumerate(contexts)
        )
        messages.append({"role": "user", "content": f"Contexts:\n{ctx_text}\n\nQuestion: {question}"})

        stream = await self.client.chat.completions.create(
            model=self.models["qa"],
            messages=messages,
            temperature=0.3,
            max_completion_tokens=2048,
            stream=True,
        )
        async for chunk in stream:
            if chunk.choices and chunk.choices[0].delta.content:
                yield chunk.choices[0].delta.content

    # ── Document Structure Analysis ─────────────────────────────
    async def analyze_structure(self, text: str) -> dict:
        """GLM-4 analyzes document structure: identify sections, key terms, doc type."""
        resp = await self.client.chat.completions.create(
            model=self.models["structure"],
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are a document structure analyzer. Extract from the document: "
                        "1. document_type: 'technical' | 'marketing' | 'legal' | 'hr' | 'general'\n"
                        "2. key_terms: 5-10 important domain-specific terms that should be in a glossary\n"
                        "3. summary: one-sentence summary\n"
                        "Output as JSON only, no markdown."
                    ),
                },
                {"role": "user", "content": text[:8000]},
            ],
            temperature=0.1,
            max_completion_tokens=1024,
            response_format={"type": "json_object"},
        )
        return json.loads(resp.choices[0].message.content)

    # ── Embedding ───────────────────────────────────────────────
    async def embed(self, texts: list[str]) -> list[list[float]]:
        """Generate embeddings: SiliconFlow API > local BGE-M3."""
        if settings.embed_provider == "siliconflow" and settings.embed_api_key:
            try:
                return await _remote_embed(texts, settings.embed_base_url, settings.embed_api_key, settings.embed_model)
            except Exception as exc:
                logger.warning("SiliconFlow embedding failed, trying local: %s", exc)
        return _local_embed(texts)

    async def embed_single(self, text: str) -> list[float]:
        results = await self.embed([text])
        return results[0]

    # ── Glossary Auto-Extraction ─────────────────────────────────
    async def extract_glossary(self, text: str, source_lang: str, target_lang: str) -> list[dict]:
        """Auto-extract domain terminology from document text."""
        resp = await self.client.chat.completions.create(
            model=self.models["structure"],
            messages=[
                {
                    "role": "system",
                    "content": (
                        "Extract 10-20 domain-specific terms, brand names, product names, "
                        "and technical jargon from the text. For each term, provide the "
                        f"best {target_lang} translation. Output as JSON array: "
                        '[{{"source": "...", "target": "...", "category": "..."}}]'
                    ),
                },
                {"role": "user", "content": text[:8000]},
            ],
            temperature=0.1,
            max_completion_tokens=2048,
            response_format={"type": "json_object"},
        )
        data = json.loads(resp.choices[0].message.content)
        if isinstance(data, dict):
            for key in ("terms", "entries", "glossary", "items"):
                if key in data and isinstance(data[key], list):
                    return data[key]
            return [data] if data else []
        return data if isinstance(data, list) else []

    # ── Translation Quality Check ───────────────────────────────
    async def check_translation_quality(
        self, source: str, translated: str, source_lang: str, target_lang: str
    ) -> dict:
        """Self-evaluate translation quality."""
        resp = await self.client.chat.completions.create(
            model=self.models["structure"],
            messages=[
                {
                    "role": "system",
                    "content": (
                        "Evaluate this translation. Output JSON: "
                        '{"score": 1-100, "issues": ["list of problems"], "suggestions": ["improvements"]}'
                    ),
                },
                {
                    "role": "user",
                    "content": f"Source ({source_lang}):\n{source[:2000]}\n\nTranslation ({target_lang}):\n{translated[:2000]}",
                },
            ],
            temperature=0.1,
            max_completion_tokens=1024,
            response_format={"type": "json_object"},
        )
        return json.loads(resp.choices[0].message.content)


def _format_glossary(glossary: Optional[Dict[str, str]], src: str, tgt: str) -> str:
    if not glossary:
        return ""
    lines = [f'  "{k}" → "{v}"' for k, v in list(glossary.items())[:30]]
    return "\n".join(lines)


def _lookup_cache(source_hash: str) -> Optional[dict]:
    """Check translation memory for an existing translation."""
    try:
        from database import SessionLocal
        from models import TranslationMemory

        db = SessionLocal()
        try:
            entry = db.query(TranslationMemory).filter(
                TranslationMemory.source_hash == source_hash
            ).first()
            if entry:
                entry.hit_count += 1
                db.commit()
                return {
                    "translated_text": entry.translated_text,
                    "model": "translation-memory",
                    "tokens_input": 0,
                    "tokens_output": 0,
                    "latency_ms": 0,
                }
            return None
        finally:
            db.close()
    except Exception:
        return None


def _save_cache(source_hash: str, source_text: str, translated_text: str, source_lang: str, target_lang: str):
    """Save a translation to memory for future reuse."""
    try:
        from database import SessionLocal
        from models import TranslationMemory

        db = SessionLocal()
        try:
            existing = db.query(TranslationMemory).filter(
                TranslationMemory.source_hash == source_hash
            ).first()
            if existing:
                existing.hit_count += 1
            else:
                entry = TranslationMemory(
                    source_hash=source_hash,
                    source_text=source_text,
                    translated_text=translated_text,
                    source_lang=source_lang,
                    target_lang=target_lang,
                )
                db.add(entry)
            db.commit()
        finally:
            db.close()
    except Exception:
        pass


_local_embed_model = None


def _local_embed(texts: list[str]) -> list[list[float]]:
    """Local embedding fallback using BGE-M3 (multilingual Chinese/English)."""
    global _local_embed_model
    if not _is_local_bge_ready():
        raise RuntimeError(
            "Local BGE-M3 embedding model is not fully cached. "
            "Skipping automatic download to keep the app responsive."
        )
    if _local_embed_model is None:
        from sentence_transformers import SentenceTransformer

        logger.info("Loading local BGE-M3 embedding model (first time only)...")
        _local_embed_model = SentenceTransformer("BAAI/bge-m3", local_files_only=True)
    embeddings = _local_embed_model.encode(texts, normalize_embeddings=True)
    return [e.tolist() for e in embeddings]


def _is_local_bge_ready() -> bool:
    """Return true only when BGE-M3 weights are already present locally."""
    cache_dir = os.path.expanduser("~/.cache/huggingface/hub/models--BAAI--bge-m3")
    snapshots_dir = os.path.join(cache_dir, "snapshots")
    if not os.path.isdir(snapshots_dir):
        return False
    for root, _, files in os.walk(snapshots_dir):
        if "pytorch_model.bin" in files:
            model_path = os.path.join(root, "pytorch_model.bin")
            if os.path.getsize(model_path) > 1_000_000_000:
                return True
    return False


async def _remote_embed(texts: list[str], base_url: str, api_key: str, model: str) -> list[list[float]]:
    """Call any OpenAI-compatible embedding API."""
    import httpx

    url = f"{base_url}/embeddings"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(url, json={
            "model": model,
            "input": texts,
        }, headers=headers)

        if resp.status_code != 200:
            raise RuntimeError(f"Embedding API returned {resp.status_code}: {resp.text[:200]}")

        data = resp.json()
        embeddings = [item["embedding"] for item in data["data"]]
        provider = base_url.split("//")[1].split(".")[0]
        logger.info("%s embedding: %d vectors, %d dim", provider, len(embeddings), len(embeddings[0]))
        return embeddings


def _should_use_mock() -> bool:
    """Use mock mode when no real API key is configured."""
    key = settings.gmi_api_key
    return not key or key.startswith("mock-") or key == "your-gmi-api-key-here"


# Singleton — auto-selects real or mock client
if _should_use_mock():
    logger.warning("GMI_API_KEY not configured — using MOCK mode for demo")
    from gmi_client_mock import MockGMIClient

    gmi = MockGMIClient()
    gmi.is_mock = True
else:
    gmi = GMIClient()
    gmi.is_mock = False
