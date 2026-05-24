"""Obsidian import routes + document-to-graph bridge."""
import logging
import os
import shutil
import uuid
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from pydantic import BaseModel
from pathlib import Path
from typing import List

from config import get_settings
from database import get_db
from services.obsidian_importer import import_obsidian_vault, get_imports, get_import_by_id
from models import GraphNode, GraphEdge, SourceImport
from services.source_identity import index_document_to_graph

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/sources", tags=["sources"])
settings = get_settings()


class ObsidianImportRequest(BaseModel):
    vault_path: str
    source_lang: str = "zh"
    target_lang: str = "en"


@router.post("/obsidian/import")
async def obsidian_import(req: ObsidianImportRequest, db: Session = Depends(get_db)):
    """Import an Obsidian vault. Idempotent via stable_key."""

    if not req.vault_path.strip():
        raise HTTPException(400, "vault_path is required")

    vault = Path(req.vault_path)
    if not vault.exists():
        raise HTTPException(400, f"Vault path does not exist: {req.vault_path}")
    if not vault.is_dir():
        raise HTTPException(400, f"Vault path is not a directory: {req.vault_path}")

    try:
        result = import_obsidian_vault(db, req.vault_path, req.source_lang, req.target_lang)
    except ValueError as e:
        raise HTTPException(400, str(e))
    except Exception as e:
        logger.error("Import failed: %s", e)
        raise HTTPException(500, f"Import failed: {e}")

    return {
        "import_id": result.id,
        "status": result.status,
        "imported_count": result.imported_count,
        "source_path": result.source_path,
        "error_message": result.error_message,
        "created_at": result.created_at.isoformat() if result.created_at else None,
        "completed_at": result.completed_at.isoformat() if result.completed_at else None,
    }


@router.post("/obsidian/upload")
async def obsidian_upload_files(
    files: List[UploadFile] = File(...),
    source_lang: str = "zh",
    target_lang: str = "en",
    db: Session = Depends(get_db),
):
    """Import Markdown files directly (no vault path needed). Upload one or more .md files."""
    if not files:
        raise HTTPException(400, "At least one file is required")

    # Create temp directory for this import batch
    import_id = str(uuid.uuid4())
    tmp_dir = Path(settings.upload_dir) / "imports" / import_id
    tmp_dir.mkdir(parents=True, exist_ok=True)

    saved = 0
    try:
        for file in files:
            name = file.filename or "untitled.md"
            if not name.lower().endswith(".md"):
                continue

            data = await file.read()
            file_path = tmp_dir / name
            file_path.parent.mkdir(parents=True, exist_ok=True)
            file_path.write_bytes(data)
            saved += 1

        if saved == 0:
            raise HTTPException(400, "No .md files found in upload")

        result = import_obsidian_vault(db, str(tmp_dir), source_lang, target_lang)
    except ValueError as e:
        raise HTTPException(400, str(e))
    except Exception as e:
        logger.error("File import failed: %s", e)
        raise HTTPException(500, f"Import failed: {e}")
    finally:
        # Cleanup temp directory
        try:
            shutil.rmtree(str(tmp_dir), ignore_errors=True)
        except Exception:
            pass

    return {
        "import_id": result.id,
        "status": result.status,
        "imported_count": result.imported_count,
        "source_path": result.source_path,
        "error_message": result.error_message,
        "created_at": result.created_at.isoformat() if result.created_at else None,
        "completed_at": result.completed_at.isoformat() if result.completed_at else None,
    }


@router.get("/imports")
async def list_imports(db: Session = Depends(get_db)):
    """List recent import jobs."""
    imports = get_imports(db)
    return {
        "imports": [
            {
                "id": si.id,
                "source_type": si.source_type,
                "source_path": si.source_path,
                "status": si.status,
                "imported_count": si.imported_count,
                "error_message": si.error_message,
                "created_at": si.created_at.isoformat() if si.created_at else None,
                "completed_at": si.completed_at.isoformat() if si.completed_at else None,
            }
            for si in imports
        ]
    }


@router.get("/imports/{import_id}")
async def get_import_status(import_id: str, db: Session = Depends(get_db)):
    """Get a single import job by ID."""
    si = get_import_by_id(db, import_id)
    if not si:
        raise HTTPException(404, "Import not found")
    return {
        "id": si.id,
        "source_type": si.source_type,
        "source_path": si.source_path,
        "status": si.status,
        "imported_count": si.imported_count,
        "error_message": si.error_message,
        "created_at": si.created_at.isoformat() if si.created_at else None,
        "completed_at": si.completed_at.isoformat() if si.completed_at else None,
    }


@router.delete("/imports")
async def clear_all_imports(db: Session = Depends(get_db)):
    """Delete all import records, their graph edges, and all graph nodes."""
    all_imports = db.query(SourceImport).all()
    import_ids = [si.id for si in all_imports]

    deleted_edges = 0
    if import_ids:
        deleted_edges = (
            db.query(GraphEdge)
            .filter(GraphEdge.source_import_id.in_(import_ids))
            .delete(synchronize_session="fetch")
        )

    # Also remove any remaining orphan edges
    db.query(GraphEdge).delete(synchronize_session="fetch")
    deleted_nodes = db.query(GraphNode).delete(synchronize_session="fetch")
    deleted_imports = db.query(SourceImport).delete(synchronize_session="fetch")
    db.commit()

    return {
        "status": "cleared",
        "imports_removed": deleted_imports,
        "edges_removed": deleted_edges,
        "nodes_removed": deleted_nodes,
    }


@router.delete("/imports/{import_id}")
async def delete_import(import_id: str, db: Session = Depends(get_db)):
    """Delete an import record, its graph edges, and nodes that came from it."""
    si = db.query(SourceImport).filter(SourceImport.id == import_id).first()
    if not si:
        raise HTTPException(404, "Import not found")

    # Collect edge IDs from this import to find affected nodes
    edges = (
        db.query(GraphEdge)
        .filter(GraphEdge.source_import_id == import_id)
        .all()
    )
    node_ids = set()
    for e in edges:
        node_ids.add(e.source_id)
        node_ids.add(e.target_id)

    # Delete edges from this import
    deleted_edges = (
        db.query(GraphEdge)
        .filter(GraphEdge.source_import_id == import_id)
        .delete(synchronize_session="fetch")
    )

    # Delete nodes that are no longer connected to any edge
    orphan_nodes = 0
    for node_id in node_ids:
        still_connected = db.query(GraphEdge).filter(
            (GraphEdge.source_id == node_id) | (GraphEdge.target_id == node_id)
        ).first()
        if not still_connected:
            db.query(GraphNode).filter(GraphNode.id == node_id).delete(synchronize_session="fetch")
            orphan_nodes += 1

    db.delete(si)
    db.commit()

    return {"status": "deleted", "import_id": import_id, "edges_removed": deleted_edges, "nodes_removed": orphan_nodes}


@router.post("/documents/{doc_id}")
async def promote_document_to_graph(doc_id: str, db: Session = Depends(get_db)):
    """Promote an existing uploaded document into the knowledge graph.

    Creates graph nodes for the document and its sections.
    Idempotent — safe to call multiple times.
    """
    try:
        result = index_document_to_graph(db, doc_id)
    except ValueError as e:
        raise HTTPException(404, str(e))
    except Exception as e:
        logger.error("Document promotion failed for %s: %s", doc_id, e)
        raise HTTPException(500, f"Promotion failed: {e}")

    return result
