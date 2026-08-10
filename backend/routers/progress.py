"""Progress router — word progress CRUD, due/weak words, stats, memory, mastered, reset."""
import time
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from database import get_db
from models import WordProgress, Mistake, Chapter, Section, Group, Item, StudySession
from schemas import (
    WordProgressOut, WordProgressUpdateIn, DueWordOut,
    ProgressStatsOut, MemoryStatsOut, ChapterProgressOut, WeakWordOut,
)
import srs
from utils import (
    get_item_by_word_id, get_all_word_ids, compute_word_id,
    get_all_settings, today_start_ts,
)

router = APIRouter(prefix="/api/progress", tags=["progress"])


# ------------------------------------------------------------------ helpers
def _progress_to_out(p: WordProgress) -> WordProgressOut:
    return WordProgressOut(
        word_id=p.word_id,
        status=p.status,
        review_count=p.review_count or 0,
        correct_count=p.correct_count or 0,
        wrong_count=p.wrong_count or 0,
        familiar_count=p.familiar_count or 0,
        last_review=p.last_review,
        next_review=p.next_review,
        ease=p.ease or 2.5,
        interval=p.interval or 0,
        repetitions=p.repetitions or 0,
        rt_avg=p.rt_avg,
        strength=srs.get_strength(p),
        box=srs.get_box(p),
        weakness=srs.get_weakness(p),
        stage=srs.get_stage(p),
    )


def _build_due_word(word_info: dict, progress: WordProgress | None) -> DueWordOut:
    return DueWordOut(
        word_id=word_info["word_id"],
        en=word_info["en"],
        zh=word_info["zh"],
        pos=word_info.get("pos"),
        chapter_id=word_info["chapter_id"],
        chapter_title=word_info.get("chapter_title"),
        progress=_progress_to_out(progress) if progress else None,
    )


# ------------------------------------------------------------------ endpoints
@router.get("/", response_model=list[WordProgressOut])
def get_all_progress(db: Session = Depends(get_db)):
    """Return all word progress records."""
    records = db.query(WordProgress).all()
    return [_progress_to_out(p) for p in records]


@router.get("/{word_id}", response_model=WordProgressOut)
def get_progress(word_id: str, db: Session = Depends(get_db)):
    """Return progress for a single word."""
    p = db.query(WordProgress).filter(WordProgress.word_id == word_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="No progress for this word")
    return _progress_to_out(p)


@router.post("/", response_model=WordProgressOut)
def update_progress(body: WordProgressUpdateIn, db: Session = Depends(get_db)):
    """Create or update word progress after a review (SM-2 update)."""
    # Verify the word exists in vocabulary
    item = get_item_by_word_id(db, body.word_id)
    if not item:
        raise HTTPException(status_code=404, detail=f"Word '{body.word_id}' not found in vocabulary")

    progress = db.query(WordProgress).filter(WordProgress.word_id == body.word_id).first()
    if not progress:
        progress = WordProgress(
            word_id=body.word_id,
            status="new",
            review_count=0,
            correct_count=0,
            wrong_count=0,
            familiar_count=0,
            last_review=None,
            next_review=None,
            ease=2.5,
            interval=0,
            repetitions=0,
            rt_avg=None,
        )
        db.add(progress)

    srs.update_progress(progress, body.grade, body.responded_ms)

    # Record mistake if wrong
    if body.grade is False or body.grade == "wrong":
        db.add(Mistake(word_id=body.word_id, at=time.time()))

    db.commit()
    db.refresh(progress)
    return _progress_to_out(progress)


@router.get("/due/list", response_model=list[DueWordOut])
def get_due_words(
    db: Session = Depends(get_db),
    limit: int = Query(50, ge=1, le=500),
    include_new: bool = Query(True),
):
    """Return words due for review (next_review <= now) plus optional new words."""
    now = time.time()
    all_word_infos = get_all_word_ids(db)
    info_map = {w["word_id"]: w for w in all_word_infos}

    # Query only due/non-mastered progress records (SQL filtering instead of full table load)
    due_progress = (
        db.query(WordProgress)
        .filter(WordProgress.status != "mastered")
        .filter(WordProgress.next_review <= now)
        .all()
    )
    studied_ids = {p.word_id for p in due_progress}

    result: list[DueWordOut] = []

    # 1. Due words (learning/reviewing, not mastered, next_review <= now)
    for p in due_progress:
        info = info_map.get(p.word_id)
        if info:
            result.append(_build_due_word(info, p))

    # 2. New words (no progress record yet)
    if include_new:
        # Only need to check which word_ids have ANY progress record
        all_studied_ids = {
            r[0] for r in db.query(WordProgress.word_id).all()
        }
        for wid, info in info_map.items():
            if wid not in all_studied_ids:
                result.append(_build_due_word(info, None))

    return result[:limit]


@router.get("/weak/list", response_model=list[WeakWordOut])
def get_weak_words(
    db: Session = Depends(get_db),
    limit: int = Query(20, ge=1, le=200),
):
    """Return words with memory strength below STRENGTH_WEAK, sorted by weakness desc."""
    all_progress = (
        db.query(WordProgress)
        .filter(WordProgress.status != "mastered")
        .all()
    )
    all_word_infos = get_all_word_ids(db)
    info_map = {w["word_id"]: w for w in all_word_infos}

    weak: list[WeakWordOut] = []
    for p in all_progress:
        strength = srs.get_strength(p)
        if strength < srs.STRENGTH_WEAK:
            info = info_map.get(p.word_id)
            if info:
                weak.append(WeakWordOut(
                    word_id=p.word_id,
                    en=info["en"],
                    zh=info["zh"],
                    pos=info.get("pos"),
                    chapter_id=info["chapter_id"],
                    strength=strength,
                    weakness=srs.get_weakness(p),
                    box=srs.get_box(p),
                    wrong_count=p.wrong_count or 0,
                ))

    weak.sort(key=lambda w: w.weakness, reverse=True)
    return weak[:limit]


@router.get("/stats/overview", response_model=ProgressStatsOut)
def get_progress_stats(db: Session = Depends(get_db)):
    """Return overall progress statistics and level info."""
    from sqlalchemy import func

    total_words = db.query(Item).count()

    # Use SQL aggregation instead of loading all records into memory
    status_counts = (
        db.query(WordProgress.status, func.count(WordProgress.word_id))
        .group_by(WordProgress.status)
        .all()
    )
    status_map = dict(status_counts)
    mastered = status_map.get("mastered", 0)
    learning = status_map.get("learning", 0)
    reviewing = status_map.get("reviewing", 0)

    studied_count = (
        db.query(func.count(WordProgress.word_id))
        .filter(WordProgress.review_count > 0)
        .scalar() or 0
    )
    studied = studied_count
    new_count = total_words - studied

    # Aggregate sums via SQL
    sums = (
        db.query(
            func.sum(WordProgress.correct_count),
            func.sum(WordProgress.wrong_count),
            func.sum(WordProgress.familiar_count),
            func.sum(WordProgress.review_count),
        )
        .first()
    )
    total_correct = sums[0] or 0
    total_wrong = sums[1] or 0
    total_familiar = sums[2] or 0
    total_reviews = sums[3] or 0
    total_answers = total_correct + total_wrong + total_familiar
    accuracy = round((total_correct + total_familiar) / total_answers * 100, 1) if total_answers > 0 else 0.0

    level_info = srs.get_level(mastered)

    return ProgressStatsOut(
        total_words=total_words,
        studied=studied,
        mastered=mastered,
        learning=learning,
        reviewing=reviewing,
        new_count=max(new_count, 0),
        accuracy=accuracy,
        total_reviews=total_reviews,
        level=level_info["level"],
        level_title=level_info["title"],
        level_progress=level_info["progress"],
        next_threshold=level_info["next_threshold"],
    )


@router.get("/chapter/{chapter_id}", response_model=ChapterProgressOut)
def get_chapter_progress(chapter_id: str, db: Session = Depends(get_db)):
    """Return progress for a specific chapter."""
    chapter = db.query(Chapter).filter(Chapter.id == chapter_id).first()
    if not chapter:
        raise HTTPException(status_code=404, detail="Chapter not found")

    # Query only this chapter's words (avoids loading all chapters)
    chapter_rows = (
        db.query(
            Section.order.label("section_order"),
            Group.order.label("group_order"),
            Item.en, Item.zh, Item.pos, Item.order.label("item_order"),
        )
        .join(Group, Group.section_id == Section.id)
        .join(Item, Item.group_id == Group.id)
        .filter(Section.chapter_id == chapter_id)
        .order_by(Section.order, Group.order, Item.order)
        .all()
    )
    chapter_word_infos = [
        {
            "word_id": compute_word_id(chapter_id, r.section_order, r.group_order, r.item_order),
            "en": r.en, "zh": r.zh, "pos": r.pos,
            "chapter_id": chapter_id, "chapter_title": chapter.title,
        }
        for r in chapter_rows
    ]
    total = len(chapter_word_infos)
    word_ids = {w["word_id"] for w in chapter_word_infos}

    progress_records = (
        db.query(WordProgress)
        .filter(WordProgress.word_id.in_(word_ids))
        .all()
    )

    studied = sum(1 for p in progress_records if (p.review_count or 0) > 0)
    mastered = sum(1 for p in progress_records if p.status == "mastered")
    learning = sum(1 for p in progress_records if p.status == "learning")
    reviewing = sum(1 for p in progress_records if p.status == "reviewing")
    new_count = total - studied
    progress_pct = round(studied / total * 100, 1) if total > 0 else 0.0

    return ChapterProgressOut(
        chapter_id=chapter_id,
        chapter_title=chapter.title,
        total=total,
        studied=studied,
        mastered=mastered,
        learning=learning,
        reviewing=reviewing,
        new_count=max(new_count, 0),
        progress_pct=progress_pct,
    )


@router.get("/memory/stats", response_model=MemoryStatsOut)
def get_memory_stats(db: Session = Depends(get_db)):
    """Return memory strength distribution and averages."""
    all_progress = db.query(WordProgress).all()
    if not all_progress:
        return MemoryStatsOut(
            avg_strength=0.0, weak_count=0, medium_count=0, strong_count=0,
            avg_ease=0.0, avg_rt=0.0, total_reviews=0,
        )

    strengths = [srs.get_strength(p) for p in all_progress]
    eases = [p.ease or 2.5 for p in all_progress]
    rts = [p.rt_avg for p in all_progress if p.rt_avg]
    total_reviews = sum(p.review_count or 0 for p in all_progress)

    weak_count = sum(1 for s in strengths if s < srs.STRENGTH_WEAK)
    strong_count = sum(1 for s in strengths if s >= 70)
    medium_count = len(strengths) - weak_count - strong_count

    return MemoryStatsOut(
        avg_strength=round(sum(strengths) / len(strengths), 1),
        weak_count=weak_count,
        medium_count=medium_count,
        strong_count=strong_count,
        avg_ease=round(sum(eases) / len(eases), 2),
        avg_rt=round(sum(rts) / len(rts), 0) if rts else 0.0,
        total_reviews=total_reviews,
    )


@router.post("/{word_id}/mastered", response_model=WordProgressOut)
def mark_mastered(word_id: str, db: Session = Depends(get_db)):
    """Mark a word as mastered immediately."""
    item = get_item_by_word_id(db, word_id)
    if not item:
        raise HTTPException(status_code=404, detail=f"Word '{word_id}' not found")

    progress = db.query(WordProgress).filter(WordProgress.word_id == word_id).first()
    if not progress:
        now = time.time()
        progress = WordProgress(
            word_id=word_id,
            status="mastered",
            review_count=1,
            correct_count=1,
            wrong_count=0,
            familiar_count=0,
            last_review=now,
            next_review=now + 86400 * 30,  # 30天后复习
            ease=2.5,
            interval=srs.MATURE_INTERVAL,
            repetitions=3,
            rt_avg=None,
        )
        db.add(progress)
    else:
        now = time.time()
        progress.status = "mastered"
        progress.last_review = now
        progress.interval = srs.MATURE_INTERVAL
        progress.next_review = now + srs.MATURE_INTERVAL * 86400
        progress.ease = max(progress.ease or 2.5, 2.5)
        progress.repetitions = max(progress.repetitions or 0, 3)
        progress.review_count = (progress.review_count or 0) + 1
        progress.correct_count = (progress.correct_count or 0) + 1

    db.commit()
    db.refresh(progress)
    return _progress_to_out(progress)


@router.post("/reset")
def reset_progress(confirm: str = Query("", description="Must be 'DELETE' to confirm"), db: Session = Depends(get_db)):
    """Delete all word progress and mistake records. Requires confirmation."""
    if confirm != "DELETE":
        raise HTTPException(status_code=400, detail="Confirmation required: pass confirm=DELETE")
    db.query(WordProgress).delete()
    db.query(Mistake).delete()
    db.commit()
    return {"success": True, "message": "All progress has been reset."}
