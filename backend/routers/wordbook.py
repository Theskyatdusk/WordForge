"""Wordbook router — add, list, remove bookmarked words."""
import time
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from models import WordbookEntry
from schemas import WordbookEntryOut, WordbookEntryCreate
from utils import get_chapter_id_from_word_id, get_item_by_word_id
import achievements

router = APIRouter(prefix="/api/wordbook", tags=["wordbook"])


@router.get("/", response_model=list[WordbookEntryOut])
def get_wordbook(db: Session = Depends(get_db)):
    """Return all wordbook entries, newest first."""
    entries = (
        db.query(WordbookEntry)
        .order_by(WordbookEntry.added_at.desc())
        .all()
    )
    return entries


@router.post("/", response_model=WordbookEntryOut)
def add_to_wordbook(body: WordbookEntryCreate, db: Session = Depends(get_db)):
    """Add a word to the wordbook (idempotent — returns existing if present)."""
    # Verify word exists
    item = get_item_by_word_id(db, body.word_id)
    if not item:
        raise HTTPException(status_code=404, detail=f"Word '{body.word_id}' not found in vocabulary")

    # Check if already in wordbook
    existing = db.query(WordbookEntry).filter(WordbookEntry.word_id == body.word_id).first()
    if existing:
        return existing

    chapter_id = body.chapter_id or get_chapter_id_from_word_id(body.word_id)

    entry = WordbookEntry(
        word_id=body.word_id,
        en=body.en or item.en,
        zh=body.zh or item.zh,
        pos=body.pos if body.pos is not None else item.pos,
        chapter_id=chapter_id,
        added_at=time.time(),
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)

    # Check achievements (wordbook10)
    achievements.check_achievements(db)

    return entry


@router.delete("/{word_id}")
def remove_from_wordbook(word_id: str, db: Session = Depends(get_db)):
    """Remove a word from the wordbook."""
    entry = db.query(WordbookEntry).filter(WordbookEntry.word_id == word_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Word not in wordbook")
    db.delete(entry)
    db.commit()
    return {"success": True, "word_id": word_id}


@router.get("/check/{word_id}")
def check_in_wordbook(word_id: str, db: Session = Depends(get_db)):
    """Check whether a word is already in the wordbook."""
    entry = db.query(WordbookEntry).filter(WordbookEntry.word_id == word_id).first()
    return {"word_id": word_id, "in_wordbook": entry is not None}
