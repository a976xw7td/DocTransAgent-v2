"""Translation routes — trigger translation, check progress, review."""
import logging
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from pydantic import BaseModel
from sqlalchemy.orm import Session
from database import get_db
from models import Document, DocStatus, UsageLog
from services.parser import parse_document, detect_language
from services.translator import translator
from services.glossary_service import get_glossary_dict
from config import get_settings

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/translate", tags=["translation"])
settings = get_settings()


class BatchTranslateRequest(BaseModel):
    target_lang: str = "en"


@router.post("/batch")
async def batch_translate(
    req: BatchTranslateRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    """Start translation for all documents in uploaded/parsed status."""
    eligible = (
        db.query(Document)
        .filter(Document.status.in_([DocStatus.UPLOADED, DocStatus.PARSED]))
        .all()
    )
    if not eligible:
        return {"started": 0, "message": "没有可翻译的文档"}

    started_ids = []
    for doc in eligible:
        doc.target_lang = req.target_lang
        doc.status = DocStatus.TRANSLATING
        background_tasks.add_task(_run_translation_pipeline, doc.id)
        started_ids.append(doc.id)

    db.commit()
    return {"started": len(started_ids), "doc_ids": started_ids, "target_lang": req.target_lang}


@router.post("/{doc_id}")
async def start_translation(
    doc_id: str,
    background_tasks: BackgroundTasks,
    target_lang: str = None,
    db: Session = Depends(get_db),
):
    """Start async translation for a document. Returns immediately.

    Optional `target_lang` query param overrides the language chosen at upload.
    """
    doc = db.query(Document).filter(Document.id == doc_id).first()
    if not doc:
        raise HTTPException(404, "Document not found")
    if doc.status not in (DocStatus.UPLOADED, DocStatus.PARSED):
        raise HTTPException(400, f"Document is in status {doc.status.value}, cannot translate")

    if target_lang and target_lang != doc.target_lang:
        doc.target_lang = target_lang

    background_tasks.add_task(_run_translation_pipeline, doc_id)
    doc.status = DocStatus.TRANSLATING
    db.commit()

    return {"doc_id": doc_id, "status": "translation_started", "target_lang": doc.target_lang}


@router.get("/{doc_id}/progress")
async def get_translation_progress(doc_id: str, db: Session = Depends(get_db)):
    """Get real-time translation progress."""
    doc = db.query(Document).filter(Document.id == doc_id).first()
    if not doc:
        raise HTTPException(404, "Document not found")

    progress = translator.get_progress(doc_id)

    return {
        "doc_id": doc_id,
        "status": doc.status.value,
        "progress": {
            "total": progress.total if progress else 0,
            "completed": progress.completed if progress else 0,
            "failed": progress.failed if progress else 0,
            "status": progress.status if progress else "unknown",
        } if progress else None,
    }


async def _run_translation_pipeline(doc_id: str):
    """Background task: parse → translate → save."""
    from database import SessionLocal

    db = SessionLocal()
    try:
        doc = db.query(Document).filter(Document.id == doc_id).first()
        if not doc:
            return

        import os

        file_path = os.path.join(settings.upload_dir, doc.filename)

        # Step 1: Parse
        doc.status = DocStatus.PARSING
        db.commit()
        parsed = await parse_document(file_path, doc.file_type)
        doc.sections = parsed["sections"]
        doc.word_count = parsed["word_count"]
        doc.parsed_content = parsed["full_text"]

        # Auto-detect source language if marked as 'auto'
        if (doc.source_lang or "").lower() == "auto":
            detected = detect_language(parsed["full_text"], default="en")
            logger.info(f"Auto-detected source language for {doc_id}: {detected}")
            doc.source_lang = detected

        doc.status = DocStatus.PARSED
        db.commit()

        # Step 2: Get glossary
        glossary = get_glossary_dict(db, source_lang=doc.source_lang, target_lang=doc.target_lang)

        # Step 3: Translate
        doc.status = DocStatus.TRANSLATING
        db.commit()
        result = await translator.translate_document(
            doc_id, parsed["sections"], doc.source_lang, doc.target_lang, glossary
        )
        doc.translated_sections = result["translated_sections"]
        doc.translated_content = "\n\n".join(
            s["content"] for s in result["translated_sections"]
        )
        doc.chunk_count = result["total_chunks"]
        doc.status = DocStatus.TRANSLATED
        db.commit()

        # Log usage
        tokens_input = result["tokens_input"]
        tokens_output = result["tokens_output"]
        estimated_cost_usd = (tokens_input + tokens_output) * 2 / 1_000_000  # $2 per 1M tokens
        usage = UsageLog(
            model_name=settings.llm_translate,
            operation="translation",
            tokens_input=tokens_input,
            tokens_output=tokens_output,
            estimated_cost_usd=estimated_cost_usd,
        )
        db.add(usage)
        db.commit()

        logger.info(f"Translation complete for {doc_id}: {result['total_chunks']} chunks")
    except Exception as e:
        logger.error(f"Translation pipeline failed for {doc_id}: {e}")
        doc = db.query(Document).filter(Document.id == doc_id).first()
        if doc:
            doc.status = DocStatus.ERROR
            doc.error_message = str(e)
            db.commit()
    finally:
        db.close()
