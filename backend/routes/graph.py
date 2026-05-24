"""Graph routes — stats, node listing, neighborhood view."""
import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session

from database import get_db
from models import GraphNode, GraphEdge, SourceImport
from gmi_client import gmi

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/graph", tags=["graph"])


@router.get("/stats")
async def graph_stats(db: Session = Depends(get_db)):
    """Graph statistics: node/edge counts and by-type distribution."""

    node_total = db.query(func.count(GraphNode.id)).scalar() or 0
    edge_total = db.query(func.count(GraphEdge.id)).scalar() or 0

    # By node type
    type_rows = (
        db.query(GraphNode.node_type, func.count(GraphNode.id))
        .group_by(GraphNode.node_type)
        .all()
    )
    nodes_by_type = {row[0]: row[1] for row in type_rows}

    # By edge relation
    rel_rows = (
        db.query(GraphEdge.relation, func.count(GraphEdge.id))
        .group_by(GraphEdge.relation)
        .all()
    )
    edges_by_relation = {row[0]: row[1] for row in rel_rows}

    # Recent imports
    recent_imports = (
        db.query(SourceImport)
        .order_by(SourceImport.created_at.desc())
        .limit(5)
        .all()
    )
    imports_summary = [
        {
            "id": si.id,
            "source_type": si.source_type,
            "source_path": si.source_path,
            "status": si.status,
            "imported_count": si.imported_count,
            "created_at": si.created_at.isoformat() if si.created_at else None,
            "completed_at": si.completed_at.isoformat() if si.completed_at else None,
        }
        for si in recent_imports
    ]

    return {
        "nodes_total": node_total,
        "edges_total": edge_total,
        "nodes_by_type": nodes_by_type,
        "edges_by_relation": edges_by_relation,
        "recent_imports": imports_summary,
    }


@router.get("/nodes")
async def list_nodes(
    node_type: Optional[str] = Query(None),
    q: Optional[str] = Query(None),
    offset: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    """List graph nodes with optional type filter and text search."""

    query = db.query(GraphNode)

    if node_type:
        query = query.filter(GraphNode.node_type == node_type)

    if q:
        query = query.filter(GraphNode.label.ilike(f"%{q}%"))

    total = query.count()
    nodes = query.order_by(GraphNode.updated_at.desc()).offset(offset).limit(limit).all()

    return {
        "nodes": [
            {
                "id": n.id,
                "node_type": n.node_type,
                "stable_key": n.stable_key,
                "label": n.label,
                "doc_id": n.doc_id,
                "content_snippet": n.content_snippet,
                "metadata": n.metadata_,
                "created_at": n.created_at.isoformat() if n.created_at else None,
                "updated_at": n.updated_at.isoformat() if n.updated_at else None,
            }
            for n in nodes
        ],
        "total": total,
        "offset": offset,
        "limit": limit,
    }


@router.get("/nodes/{node_id}")
async def get_node(node_id: str, db: Session = Depends(get_db)):
    """Get a single node with its outgoing and incoming edges."""

    node = db.query(GraphNode).filter(GraphNode.id == node_id).first()
    if not node:
        raise HTTPException(404, "Graph node not found")

    outgoing = (
        db.query(GraphEdge).filter(GraphEdge.source_id == node_id).limit(100).all()
    )
    incoming = (
        db.query(GraphEdge).filter(GraphEdge.target_id == node_id).limit(100).all()
    )

    def _edge_dict(e):
        return {
            "id": e.id,
            "source_id": e.source_id,
            "target_id": e.target_id,
            "relation": e.relation,
            "weight": e.weight,
            "metadata": e.metadata_,
        }

    return {
        "node": {
            "id": node.id,
            "node_type": node.node_type,
            "stable_key": node.stable_key,
            "label": node.label,
            "doc_id": node.doc_id,
            "content_snippet": node.content_snippet,
            "metadata": node.metadata_,
            "created_at": node.created_at.isoformat() if node.created_at else None,
            "updated_at": node.updated_at.isoformat() if node.updated_at else None,
        },
        "outgoing_edges": [_edge_dict(e) for e in outgoing],
        "incoming_edges": [_edge_dict(e) for e in incoming],
    }


class TranslateRequest(BaseModel):
    target_lang: str = "en"


@router.post("/nodes/{node_id}/translate")
async def translate_node(node_id: str, req: TranslateRequest, db: Session = Depends(get_db)):
    """Translate a graph node's content_snippet on demand."""
    node = db.query(GraphNode).filter(GraphNode.id == node_id).first()
    if not node:
        raise HTTPException(404, "Graph node not found")

    text = (node.content_snippet or "").strip()
    if not text:
        raise HTTPException(400, "Node has no content to translate")

    try:
        result = await gmi.translate(text, source_lang="zh", target_lang=req.target_lang)
    except Exception as e:
        logger.error(f"Node translation failed for {node_id}: {e}")
        raise HTTPException(500, f"Translation failed: {e}")

    return {
        "node_id": node_id,
        "source_text": text,
        "translated_text": result["translated_text"],
        "target_lang": req.target_lang,
        "latency_ms": result.get("latency_ms"),
    }


@router.get("/all")
async def get_all_graph(
    limit: int = Query(500, ge=1, le=2000),
    db: Session = Depends(get_db),
):
    """Return all nodes and edges for full-graph visualization."""

    nodes = db.query(GraphNode).limit(limit).all()
    node_ids = {n.id for n in nodes}

    edges = (
        db.query(GraphEdge)
        .filter(GraphEdge.source_id.in_(node_ids), GraphEdge.target_id.in_(node_ids))
        .limit(limit * 4)
        .all()
    )

    return {
        "nodes": [
            {
                "id": n.id,
                "node_type": n.node_type,
                "label": n.label,
                "stable_key": n.stable_key,
                "doc_id": n.doc_id,
                "content_snippet": n.content_snippet,
                "metadata": n.metadata_,
            }
            for n in nodes
        ],
        "edges": [
            {
                "id": e.id,
                "source": e.source_id,
                "target": e.target_id,
                "relation": e.relation,
                "weight": e.weight,
            }
            for e in edges
        ],
    }


@router.delete("/clear")
async def clear_graph(db: Session = Depends(get_db)):
    """Delete all graph nodes and edges."""

    db.query(GraphEdge).delete()
    db.query(GraphNode).delete()
    db.commit()

    return {"status": "ok", "message": "Graph cleared"}


@router.get("/neighborhood/{node_id}")
async def get_neighborhood(node_id: str, db: Session = Depends(get_db)):
    """Get a node and its 1-hop neighborhood."""

    node = db.query(GraphNode).filter(GraphNode.id == node_id).first()
    if not node:
        raise HTTPException(404, "Graph node not found")

    # All edges connected to this node
    edges = (
        db.query(GraphEdge)
        .filter(
            (GraphEdge.source_id == node_id) | (GraphEdge.target_id == node_id)
        )
        .limit(200)
        .all()
    )

    # Collect neighbor IDs
    neighbor_ids = set()
    for e in edges:
        if e.source_id != node_id:
            neighbor_ids.add(e.source_id)
        if e.target_id != node_id:
            neighbor_ids.add(e.target_id)

    # Fetch neighbor nodes
    neighbors = []
    if neighbor_ids:
        neighbor_rows = (
            db.query(GraphNode)
            .filter(GraphNode.id.in_(neighbor_ids))
            .all()
        )
        neighbors = [
            {
                "id": n.id,
                "node_type": n.node_type,
                "label": n.label,
                "stable_key": n.stable_key,
            }
            for n in neighbor_rows
        ]

    return {
        "center": {
            "id": node.id,
            "node_type": node.node_type,
            "label": node.label,
            "stable_key": node.stable_key,
        },
        "neighbors": neighbors,
        "edges": [
            {
                "id": e.id,
                "source_id": e.source_id,
                "target_id": e.target_id,
                "relation": e.relation,
                "weight": e.weight,
            }
            for e in edges
        ],
        "neighbor_count": len(neighbors),
        "edge_count": len(edges),
    }
