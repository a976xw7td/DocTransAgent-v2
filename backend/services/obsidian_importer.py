"""
Obsidian vault import service.

Walks a vault directory, parses Markdown files via markdown_parser,
and persists GraphNode / GraphEdge / SourceImport records.

This is a new Knowledge Layer boundary — it does not modify existing
document/translation flows.
"""
import logging
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from sqlalchemy.orm import Session

from models import GraphNode, GraphEdge, SourceImport
from services.markdown_parser import (
    parse_obsidian_file,
    iter_markdown_files,
)

logger = logging.getLogger(__name__)

# Node types
NODE_NOTE = "note"
NODE_HEADING = "heading"
NODE_TAG = "tag"
NODE_ALIAS = "alias"
NODE_WIKILINK_TARGET = "wikilink_target"

# Edge relations
EDGE_CONTAINS = "contains"
EDGE_LINKS_TO = "links_to"
EDGE_TAGGED_WITH = "tagged_with"
EDGE_ALIAS_OF = "alias_of"
EDGE_HAS_HEADING = "has_heading"


def _utcnow():
    return datetime.now(timezone.utc)


def _upsert_node(
    db: Session,
    node_type: str,
    stable_key: str,
    label: str,
    doc_id: Optional[str] = None,
    content_snippet: Optional[str] = None,
    metadata: Optional[dict] = None,
) -> GraphNode:
    """Insert or update a graph node by stable_key. Returns the node."""
    node = db.query(GraphNode).filter(GraphNode.stable_key == stable_key).first()

    if node:
        node.label = label
        node.content_snippet = content_snippet
        node.metadata_ = metadata
        node.updated_at = _utcnow()
    else:
        node = GraphNode(
            id=str(uuid.uuid4()),
            node_type=node_type,
            stable_key=stable_key,
            label=label,
            doc_id=doc_id,
            content_snippet=content_snippet,
            metadata_=metadata,
            created_at=_utcnow(),
            updated_at=_utcnow(),
        )
        db.add(node)

    return node


def _ensure_edge(
    db: Session,
    source_id: str,
    target_id: str,
    relation: str,
    weight: float = 1.0,
    source_import_id: Optional[str] = None,
    metadata: Optional[dict] = None,
):
    """Create a graph edge if an equivalent one does not already exist."""
    existing = (
        db.query(GraphEdge)
        .filter(
            GraphEdge.source_id == source_id,
            GraphEdge.target_id == target_id,
            GraphEdge.relation == relation,
        )
        .first()
    )
    if existing:
        return

    edge = GraphEdge(
        id=str(uuid.uuid4()),
        source_id=source_id,
        target_id=target_id,
        relation=relation,
        weight=weight,
        metadata_=metadata,
        source_import_id=source_import_id,
        created_at=_utcnow(),
    )
    db.add(edge)


def _cleanup_previous_edges(db: Session, vault_path: str):
    """Delete edges from previous completed imports of the same vault path.

    This ensures re-import produces fresh edges reflecting the current vault state.
    Nodes are NOT deleted — they are managed by _upsert_node via stable_key.
    """
    resolved = str(Path(vault_path).resolve())
    previous = (
        db.query(SourceImport)
        .filter(
            SourceImport.source_type == "obsidian",
            SourceImport.source_path == resolved,
            SourceImport.status == "completed",
        )
        .all()
    )

    if not previous:
        return 0

    prev_ids = [si.id for si in previous]
    deleted = (
        db.query(GraphEdge)
        .filter(GraphEdge.source_import_id.in_(prev_ids))
        .delete(synchronize_session="fetch")
    )
    if deleted:
        logger.info("Cleaned up %d edges from %d previous imports", deleted, len(previous))
    return deleted


def _extract_heading_body(body_text: str, heading: "Heading", all_headings: list) -> str:
    """Extract the text under a heading up to the next heading of equal or higher level."""
    lines = body_text.splitlines()
    start = heading.line  # heading.line is 1-based, so lines[heading.line] is first body line
    end = len(lines)
    for h in all_headings:
        if h.line > heading.line and h.level <= heading.level:
            end = h.line - 1
            break
    snippet_lines = lines[start:end]
    snippet = "\n".join(l for l in snippet_lines if l.strip()).strip()
    return snippet[:400] if snippet else ""


def import_obsidian_vault(
    db: Session,
    vault_path: str,
    source_lang: str = "zh",
    target_lang: str = "en",
) -> SourceImport:
    """Import an Obsidian vault. Fully idempotent.

    - Nodes are upserted by stable_key (no duplicates).
    - Edges from previous imports of the same vault are cleaned up before re-creating.
    - Re-import reflects current vault state.

    Args:
        db: SQLAlchemy session.
        vault_path: Absolute path to the vault root directory.
        source_lang: Source language for the imported notes.
        target_lang: Target language for the imported notes.

    Returns:
        SourceImport record with status and counts.
    """
    vault = Path(vault_path)

    if not vault.exists():
        raise ValueError(f"Vault path does not exist: {vault_path}")
    if not vault.is_dir():
        raise ValueError(f"Vault path is not a directory: {vault_path}")

    # Clean up edges from previous imports of this vault (idempotency)
    _cleanup_previous_edges(db, vault_path)

    # Create import record
    source_import = SourceImport(
        id=str(uuid.uuid4()),
        source_type="obsidian",
        source_path=str(vault.resolve()),
        status="processing",
        imported_count=0,
        metadata_={"source_lang": source_lang, "target_lang": target_lang},
        created_at=_utcnow(),
    )
    db.add(source_import)
    db.flush()  # get the id without committing yet

    md_files = iter_markdown_files(vault_path)
    node_count = 0

    try:
        for file_path in md_files:
            try:
                parsed = parse_obsidian_file(str(file_path), vault_path)

                # Upsert the NOTE node
                note_node = _upsert_node(
                    db,
                    node_type=NODE_NOTE,
                    stable_key=parsed.stable_key,
                    label=parsed.title,
                    content_snippet=parsed.body_text[:500] if parsed.body_text else None,
                    metadata={
                        "relative_path": parsed.relative_path,
                        "content_hash": parsed.content_hash,
                        "word_count": len(parsed.body_text.split()) if parsed.body_text else 0,
                    },
                )
                db.flush()  # ensure node IDs are available for FK references
                node_count += 1

                # Headings → HEADING nodes + CONTAINS edges
                for h in parsed.headings:
                    heading_stable = f"{parsed.stable_key}#heading-{h.line}"
                    heading_body = _extract_heading_body(parsed.body_text, h, parsed.headings)
                    heading_node = _upsert_node(
                        db,
                        node_type=NODE_HEADING,
                        stable_key=heading_stable,
                        label=h.text,
                        content_snippet=heading_body or None,
                        metadata={"level": h.level, "line": h.line,
                                  "note_title": parsed.title,
                                  "relative_path": parsed.relative_path},
                    )
                    db.flush()
                    _ensure_edge(
                        db,
                        source_id=note_node.id,
                        target_id=heading_node.id,
                        relation=EDGE_CONTAINS,
                        source_import_id=source_import.id,
                    )

                # Wikilinks → WIKILINK_TARGET nodes + LINKS_TO edges
                for wl in parsed.wikilinks:
                    wl_stable = f"wikilink:{wl.target}"
                    wl_node = _upsert_node(
                        db,
                        node_type=NODE_WIKILINK_TARGET,
                        stable_key=wl_stable,
                        label=wl.alias or wl.target,
                        content_snippet=f"「{parsed.title}」中的链接，指向：{wl.target}"
                                        + (f"#{wl.heading}" if wl.heading else "")
                                        + (f"（别名：{wl.alias}）" if wl.alias else ""),
                        metadata={
                            "target": wl.target,
                            "alias": wl.alias,
                            "heading_anchor": wl.heading,
                            "source_note": parsed.title,
                        },
                    )
                    db.flush()
                    _ensure_edge(
                        db,
                        source_id=note_node.id,
                        target_id=wl_node.id,
                        relation=EDGE_LINKS_TO,
                        source_import_id=source_import.id,
                        metadata={"alias": wl.alias, "heading": wl.heading},
                    )

                # Tags → TAG nodes + TAGGED_WITH edges
                for tag_name in parsed.all_tags:
                    tag_stable = f"tag:{tag_name}"
                    tag_node = _upsert_node(
                        db,
                        node_type=NODE_TAG,
                        stable_key=tag_stable,
                        label=f"#{tag_name}",
                        content_snippet=f"标签 #{tag_name}，出现于「{parsed.title}」",
                    )
                    db.flush()
                    _ensure_edge(
                        db,
                        source_id=note_node.id,
                        target_id=tag_node.id,
                        relation=EDGE_TAGGED_WITH,
                        source_import_id=source_import.id,
                    )

                # Aliases → ALIAS nodes + ALIAS_OF edges
                for alias in parsed.frontmatter.aliases:
                    alias_stable = f"alias:{alias}"
                    alias_node = _upsert_node(
                        db,
                        node_type=NODE_ALIAS,
                        stable_key=alias_stable,
                        label=alias,
                        content_snippet=f"「{parsed.title}」的别名：{alias}",
                    )
                    db.flush()
                    _ensure_edge(
                        db,
                        source_id=alias_node.id,
                        target_id=note_node.id,
                        relation=EDGE_ALIAS_OF,
                        source_import_id=source_import.id,
                    )

            except Exception as exc:
                logger.warning("Failed to import file %s: %s", file_path, exc)
                continue

        # Mark import as completed
        source_import.status = "completed"
        source_import.imported_count = node_count
        source_import.completed_at = _utcnow()

    except Exception as exc:
        logger.error("Vault import failed: %s", exc)
        source_import.status = "error"
        source_import.error_message = str(exc)

    db.commit()
    db.refresh(source_import)
    return source_import


def get_imports(db: Session, limit: int = 20) -> list[SourceImport]:
    """List recent source imports, newest first."""
    return (
        db.query(SourceImport)
        .order_by(SourceImport.created_at.desc())
        .limit(limit)
        .all()
    )


def get_import_by_id(db: Session, import_id: str) -> Optional[SourceImport]:
    return db.query(SourceImport).filter(SourceImport.id == import_id).first()
