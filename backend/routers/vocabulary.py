"""Vocabulary router — chapters, single chapter, stats."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, selectinload
from sqlalchemy import func

from database import get_db
from models import Chapter, Section, Group, Item
from schemas import (
    ChapterOut, ChapterBrief, VocabStatsOut,
    ItemOut, GroupOut, SectionOut,
)
from utils import compute_word_id

router = APIRouter(prefix="/api/vocabulary", tags=["vocabulary"])


def _build_item(item: Item, chapter_id: str, section_order: int, group_order: int) -> ItemOut:
    return ItemOut(
        id=item.id,
        word_id=compute_word_id(chapter_id, section_order, group_order, item.order),
        en=item.en,
        zh=item.zh,
        pos=item.pos,
        order=item.order,
    )


def _build_group(group: Group, chapter_id: str, section_order: int) -> GroupOut:
    return GroupOut(
        id=group.id,
        title=group.title,
        type=group.type,
        order=group.order,
        items=[
            _build_item(item, chapter_id, section_order, group.order)
            for item in sorted(group.items, key=lambda i: i.order)
        ],
    )


def _build_section(section: Section, chapter_id: str) -> SectionOut:
    return SectionOut(
        id=section.id,
        chapter_id=section.chapter_id,
        title=section.title,
        order=section.order,
        groups=[
            _build_group(group, chapter_id, section.order)
            for group in sorted(section.groups, key=lambda g: g.order)
        ],
    )


def _build_chapter(chapter: Chapter) -> ChapterOut:
    return ChapterOut(
        id=chapter.id,
        title=chapter.title,
        subtitle=chapter.subtitle,
        icon=chapter.icon,
        color=chapter.color,
        order=chapter.order,
        sections=[
            _build_section(section, chapter.id)
            for section in sorted(chapter.sections, key=lambda s: s.order)
        ],
    )


@router.get("/chapters", response_model=list[ChapterOut])
def get_chapters(db: Session = Depends(get_db)):
    """Return all chapters with full nested data (sections → groups → items)."""
    chapters = (
        db.query(Chapter)
        .options(
            selectinload(Chapter.sections)
            .selectinload(Section.groups)
            .selectinload(Group.items)
        )
        .order_by(Chapter.order)
        .all()
    )
    return [_build_chapter(ch) for ch in chapters]


@router.get("/chapters/brief", response_model=list[ChapterBrief])
def get_chapters_brief(db: Session = Depends(get_db)):
    """Return chapter list without nested data (lightweight)."""
    chapters = db.query(Chapter).order_by(Chapter.order).all()
    return [
        ChapterBrief(
            id=ch.id,
            title=ch.title,
            subtitle=ch.subtitle,
            icon=ch.icon,
            color=ch.color,
            order=ch.order,
        )
        for ch in chapters
    ]


@router.get("/chapters/{chapter_id}", response_model=ChapterOut)
def get_chapter(chapter_id: str, db: Session = Depends(get_db)):
    """Return a single chapter with full nested data."""
    chapter = (
        db.query(Chapter)
        .options(
            selectinload(Chapter.sections)
            .selectinload(Section.groups)
            .selectinload(Group.items)
        )
        .filter(Chapter.id == chapter_id)
        .first()
    )
    if not chapter:
        raise HTTPException(status_code=404, detail=f"Chapter '{chapter_id}' not found")
    return _build_chapter(chapter)


@router.get("/stats", response_model=VocabStatsOut)
def get_vocab_stats(db: Session = Depends(get_db)):
    """Return aggregate counts for chapters, sections, groups, items."""
    return VocabStatsOut(
        chapters=db.query(Chapter).count(),
        sections=db.query(Section).count(),
        groups=db.query(Group).count(),
        items=db.query(Item).count(),
    )
