"""Sync router — export/import all data for backup or device transfer."""
import json
import time
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from database import get_db
from models import (
    WordProgress, WordbookEntry, Mistake, Checkin, StudySession,
    Setting, Streak, Purchase, Equipped, Achievement, DailyTask, CustomVocab,
    UserProgress,
)
from schemas import (
    SyncData, SyncResult,
    ProgressUploadIn, ProgressUploadResult,
    ProgressDownloadResult, ProgressResetResult,
)
from utils import get_all_settings, set_setting, get_streak, get_equipped

router = APIRouter(prefix="/api/sync", tags=["sync"])


def _row_to_dict(row) -> dict:
    """Convert a SQLAlchemy model instance to a dict."""
    d = {}
    for col in row.__table__.columns:
        d[col.name] = getattr(row, col.name)
    return d


def _filter_columns(model_class, item: dict) -> dict:
    """Filter a dict to only contain valid column names for the given model.

    Prevents arbitrary column injection via Model(**item) which could
    raise TypeError on unknown keys or silently inject bad data.
    """
    valid_cols = {col.name for col in model_class.__table__.columns}
    return {k: v for k, v in item.items() if k in valid_cols}


@router.get("/", response_model=SyncData)
def export_all_data(db: Session = Depends(get_db)):
    """Export all user data as a single JSON payload."""

    progress = [_row_to_dict(p) for p in db.query(WordProgress).all()]
    wordbook = [_row_to_dict(w) for w in db.query(WordbookEntry).all()]
    mistakes = [_row_to_dict(m) for m in db.query(Mistake).all()]
    checkins = [_row_to_dict(c) for c in db.query(Checkin).all()]
    sessions = [_row_to_dict(s) for s in db.query(StudySession).all()]
    settings = get_all_settings(db)

    streak_row = get_streak(db)
    streak = {
        "id": streak_row.id,
        "current": streak_row.current,
        "longest": streak_row.longest,
        "last_check_in": streak_row.last_check_in,
    }

    purchases = [_row_to_dict(p) for p in db.query(Purchase).all()]

    equipped_row = get_equipped(db)
    equipped = {
        "id": equipped_row.id,
        "theme": equipped_row.theme,
        "badge": equipped_row.badge,
    }

    achievements_data = [_row_to_dict(a) for a in db.query(Achievement).all()]
    daily_tasks = [_row_to_dict(t) for t in db.query(DailyTask).all()]
    custom_vocabs = [_row_to_dict(v) for v in db.query(CustomVocab).all()]

    return SyncData(
        progress=progress,
        wordbook=wordbook,
        mistakes=mistakes,
        checkins=checkins,
        sessions=sessions,
        settings=settings,
        streak=streak,
        purchases=purchases,
        equipped=equipped,
        achievements=achievements_data,
        daily_tasks=daily_tasks,
        custom_vocabs=custom_vocabs,
    )


@router.post("/", response_model=SyncResult)
def import_all_data(body: SyncData, db: Session = Depends(get_db)):
    """Import (replace) all user data from a JSON payload.
    Vocabulary (chapters/sections/groups/items) is NOT replaced — only user data."""

    counts: dict[str, int] = {}

    try:
        # --- Clear existing user data (single transaction, no intermediate commit) ---
        db.query(WordProgress).delete()
        db.query(WordbookEntry).delete()
        db.query(Mistake).delete()
        db.query(Checkin).delete()
        db.query(StudySession).delete()
        db.query(Setting).delete()
        db.query(Streak).delete()
        db.query(Purchase).delete()
        db.query(Equipped).delete()
        db.query(Achievement).delete()
        db.query(DailyTask).delete()
        db.query(CustomVocab).delete()
        db.query(UserProgress).delete()

        # --- Progress ---
        for item in body.progress:
            db.add(WordProgress(**_filter_columns(WordProgress, item)))
        counts["progress"] = len(body.progress)

        # --- Wordbook ---
        for item in body.wordbook:
            db.add(WordbookEntry(**_filter_columns(WordbookEntry, item)))
        counts["wordbook"] = len(body.wordbook)

        # --- Mistakes ---
        for item in body.mistakes:
            db.add(Mistake(**_filter_columns(Mistake, item)))
        counts["mistakes"] = len(body.mistakes)

        # --- Checkins ---
        for item in body.checkins:
            db.add(Checkin(**_filter_columns(Checkin, item)))
        counts["checkins"] = len(body.checkins)

        # --- Sessions ---
        for item in body.sessions:
            db.add(StudySession(**_filter_columns(StudySession, item)))
        counts["sessions"] = len(body.sessions)

        # --- Settings ---
        # Block sensitive keys (coins, level, streak, etc.) from being injected
        _sensitive = {"coins", "level", "streak", "purchasedBadges", "purchasedThemes"}
        for key, value in body.settings.items():
            if key not in ("id",) and key not in _sensitive:
                db.add(Setting(key=key, value=value))
        counts["settings"] = len(body.settings)

        # --- Streak ---
        if body.streak:
            db.add(Streak(**_filter_columns(Streak, body.streak)))
        counts["streak"] = 1 if body.streak else 0

        # --- Purchases ---
        for item in body.purchases:
            db.add(Purchase(**_filter_columns(Purchase, item)))
        counts["purchases"] = len(body.purchases)

        # --- Equipped ---
        if body.equipped:
            db.add(Equipped(**_filter_columns(Equipped, body.equipped)))
        else:
            db.add(Equipped(id=1, theme="default", badge=""))
        counts["equipped"] = 1

        # --- Achievements ---
        for item in body.achievements:
            db.add(Achievement(**_filter_columns(Achievement, item)))
        counts["achievements"] = len(body.achievements)

        # --- Daily tasks ---
        for item in body.daily_tasks:
            db.add(DailyTask(**_filter_columns(DailyTask, item)))
        counts["daily_tasks"] = len(body.daily_tasks)

        # --- Custom vocabs ---
        for item in body.custom_vocabs:
            db.add(CustomVocab(**_filter_columns(CustomVocab, item)))
        counts["custom_vocabs"] = len(body.custom_vocabs)

        db.commit()
    except Exception as e:
        db.rollback()
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Failed to import data")

    return SyncResult(
        success=True,
        message="Data imported successfully",
        counts=counts,
    )


# ============================================================
#  Single-blob sync — upload / download / reset
# ============================================================
# These endpoints store the entire frontend progress payload as a single
# JSON string in the ``user_progress`` table (single-row, id=1).  This is
# intentionally format-agnostic: the frontend can send any JSON object
# (wordProgress, streak, level, studyHistory, dailyTasks, coins, mistakes,
# wordbook, …) and the backend simply persists and returns it verbatim.

PROGRESS_ROW_ID = 1  # singleton row id


@router.post("/upload", response_model=ProgressUploadResult)
def upload_progress(body: ProgressUploadIn, db: Session = Depends(get_db)):
    """Save learning-progress data as a single JSON blob.

    Accepts an arbitrary JSON object from the frontend and stores it
    verbatim in the ``user_progress`` table.  On subsequent calls the
    existing row is updated in place.
    """
    data = body.model_dump()

    try:
        row = db.query(UserProgress).filter(UserProgress.id == PROGRESS_ROW_ID).first()
        if row:
            row.data = json.dumps(data, ensure_ascii=False)
            row.updated_at = datetime.utcnow()
        else:
            row = UserProgress(
                id=PROGRESS_ROW_ID,
                data=json.dumps(data, ensure_ascii=False),
            )
            db.add(row)
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to save progress")

    return ProgressUploadResult(success=True)


@router.get("/download", response_model=ProgressDownloadResult)
def download_progress(db: Session = Depends(get_db)):
    """Return the saved learning-progress data as JSON.

    Returns ``{"success": true, "data": null}`` when no data has been
    saved yet.
    """
    row = db.query(UserProgress).filter(UserProgress.id == PROGRESS_ROW_ID).first()
    if not row:
        return ProgressDownloadResult(success=True, data=None)

    try:
        data = json.loads(row.data)
    except (json.JSONDecodeError, TypeError):
        # Corrupt or empty data column — treat as "no data"
        return ProgressDownloadResult(success=True, data=None)

    return ProgressDownloadResult(success=True, data=data)


@router.post("/reset", response_model=ProgressResetResult)
def reset_progress(confirm: str = Query("", description="Must be 'DELETE' to confirm"), db: Session = Depends(get_db)):
    """Delete all saved progress data (the single JSON blob)."""
    if confirm != "DELETE":
        raise HTTPException(status_code=400, detail="Confirmation required: pass confirm=DELETE")
    try:
        db.query(UserProgress).delete()
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to reset progress")

    return ProgressResetResult(success=True)
