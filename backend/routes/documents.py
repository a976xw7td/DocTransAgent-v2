"""Document upload, list, delete routes."""
import os
import uuid
import shutil
import logging
from fastapi import APIRouter, UploadFile, File, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import Document, DocStatus
from config import get_settings

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/documents", tags=["documents"])
settings = get_settings()


@router.post("/upload")
async def upload_document(
    file: UploadFile = File(...),
    source_lang: str = "auto",
    target_lang: str = "en",
    db: Session = Depends(get_db),
):
    """Upload a document for translation and knowledge base indexing.

    `source_lang="auto"` triggers automatic language detection during the parse step.
    """
    ext = os.path.splitext(file.filename or "unknown.txt")[1].lower().lstrip(".")
    if ext not in ("pdf", "docx", "md", "txt"):
        raise HTTPException(400, f"Unsupported file type: {ext}")

    doc_id = str(uuid.uuid4())
    save_name = f"{doc_id}.{ext}"
    save_path = os.path.join(settings.upload_dir, save_name)

    os.makedirs(settings.upload_dir, exist_ok=True)

    content = await file.read()
    if len(content) > 50 * 1024 * 1024:  # 50MB limit
        raise HTTPException(413, "File too large. Maximum upload size is 50MB.")
    with open(save_path, "wb") as f:
        f.write(content)

    doc = Document(
        id=doc_id,
        filename=save_name,
        original_filename=file.filename or "unknown",
        file_type=ext,
        file_size=len(content),
        source_lang=source_lang,
        target_lang=target_lang,
        status=DocStatus.UPLOADED,
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)

    logger.info(f"Uploaded document {doc_id}: {file.filename}")
    return {
        "id": doc.id,
        "filename": doc.original_filename,
        "file_type": doc.file_type,
        "file_size": doc.file_size,
        "source_lang": doc.source_lang,
        "target_lang": doc.target_lang,
        "status": doc.status.value,
        "created_at": doc.created_at.isoformat(),
    }


@router.get("")
async def list_documents(db: Session = Depends(get_db)):
    docs = db.query(Document).order_by(Document.created_at.desc()).all()
    return [
        {
            "id": d.id,
            "filename": d.original_filename,
            "file_type": d.file_type,
            "source_lang": d.source_lang,
            "target_lang": d.target_lang,
            "status": d.status.value,
            "word_count": d.word_count,
            "created_at": d.created_at.isoformat(),
        }
        for d in docs
    ]


@router.get("/{doc_id}")
async def get_document(doc_id: str, db: Session = Depends(get_db)):
    doc = db.query(Document).filter(Document.id == doc_id).first()
    if not doc:
        raise HTTPException(404, "Document not found")
    return {
        "id": doc.id,
        "filename": doc.original_filename,
        "file_type": doc.file_type,
        "source_lang": doc.source_lang,
        "target_lang": doc.target_lang,
        "status": doc.status.value,
        "word_count": doc.word_count,
        "sections": doc.sections,
        "translated_sections": doc.translated_sections,
        "created_at": doc.created_at.isoformat(),
    }


@router.delete("/clear")
async def clear_all_documents(db: Session = Depends(get_db)):
    """Delete all documents and their uploaded files."""

    docs = db.query(Document).all()
    for doc in docs:
        file_path = os.path.join(settings.upload_dir, doc.filename)
        if os.path.exists(file_path):
            os.remove(file_path)
    db.query(Document).delete()
    db.commit()

    logger.info(f"Cleared all documents ({len(docs)} deleted)")
    return {"status": "ok", "deleted_count": len(docs)}


@router.delete("/{doc_id}")
async def delete_document(doc_id: str, db: Session = Depends(get_db)):
    doc = db.query(Document).filter(Document.id == doc_id).first()
    if not doc:
        raise HTTPException(404, "Document not found")

    file_path = os.path.join(settings.upload_dir, doc.filename)
    if os.path.exists(file_path):
        os.remove(file_path)

    db.delete(doc)
    db.commit()
    return {"deleted": doc_id}
