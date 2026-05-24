"""Knowledge base routes — index, search, stats."""
from __future__ import annotations

import logging
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from database import get_db
from models import Document, DocStatus, UsageLog
from services.embedder import embed_document
from services.retriever import index_chunks, search, delete_document_chunks, get_index_stats
from config import get_settings

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/kb", tags=["knowledge_base"])
settings = get_settings()


@router.post("/index/batch")
async def batch_index(background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    """Index all translated documents into the knowledge base."""
    docs = db.query(Document).filter(Document.status == DocStatus.TRANSLATED).all()
    if not docs:
        return {"status": "no_docs", "count": 0}
    doc_ids = []
    for doc in docs:
        background_tasks.add_task(_run_indexing, doc.id)
        doc.status = DocStatus.INDEXING
        doc_ids.append(doc.id)
    db.commit()
    return {"status": "indexing_started", "count": len(doc_ids), "doc_ids": doc_ids}


@router.post("/index/{doc_id}")
async def index_document(doc_id: str, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    """Index a translated document into the knowledge base."""
    doc = db.query(Document).filter(Document.id == doc_id).first()
    if not doc:
        raise HTTPException(404, "Document not found")
    if doc.status != DocStatus.TRANSLATED:
        raise HTTPException(400, f"Document must be translated first. Current: {doc.status.value}")

    background_tasks.add_task(_run_indexing, doc_id)
    doc.status = DocStatus.INDEXING
    db.commit()
    return {"doc_id": doc_id, "status": "indexing_started"}


async def _run_indexing(doc_id: str):
    from database import SessionLocal

    db = SessionLocal()
    try:
        doc = db.query(Document).filter(Document.id == doc_id).first()
        if not doc:
            return

        text = doc.translated_content or doc.parsed_content or ""
        chunks = await embed_document(text, {
            "doc_id": doc_id,
            "title": doc.original_filename,
            "source_lang": doc.source_lang,
            "target_lang": doc.target_lang,
            "lang": doc.target_lang,
        })

        count = await index_chunks(chunks)
        doc.status = DocStatus.INDEXED
        doc.chunk_count = count
        db.commit()

        usage = UsageLog(
            model_name=settings.llm_embed,
            operation="embedding",
            tokens_input=len(text.split()),
            tokens_output=0,
        )
        db.add(usage)
        db.commit()

        logger.info(f"Indexed {doc_id}: {count} chunks")
    except Exception as e:
        logger.error(f"Indexing failed for {doc_id}: {e}")
        doc = db.query(Document).filter(Document.id == doc_id).first()
        if doc:
            doc.status = DocStatus.ERROR
            doc.error_message = str(e)
            db.commit()
    finally:
        db.close()


@router.get("/search")
async def search_knowledge_base(q: str, top_k: int = 10, lang: Optional[str] = None):
    """Cross-lingual semantic search."""
    results = await search(q, top_k=top_k, lang_filter=lang)
    return {"query": q, "results": results, "count": len(results)}


@router.get("/stats")
async def kb_stats(db: Session = Depends(get_db)):
    """Knowledge base statistics."""
    index_stats = await get_index_stats()
    doc_count = db.query(Document).filter(Document.status == DocStatus.INDEXED).count()
    total_words = db.query(Document).filter(Document.status == DocStatus.INDEXED).with_entities(
        Document.word_count
    ).all()
    return {
        **index_stats,
        "indexed_documents": doc_count,
        "total_words": sum(w[0] or 0 for w in total_words),
    }


@router.delete("/index/{doc_id}")
async def deindex_document(doc_id: str, db: Session = Depends(get_db)):
    """Remove a document from the knowledge base index."""
    count = await delete_document_chunks(doc_id)
    doc = db.query(Document).filter(Document.id == doc_id).first()
    if doc:
        doc.status = DocStatus.TRANSLATED
        db.commit()
    return {"deleted_chunks": count}
