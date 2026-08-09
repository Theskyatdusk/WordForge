"""Shared utility functions for WordForge backend."""
from __future__ import annotations
import time
import json
from datetime import date, timedelta
from typing import Any, Optional
from sqlalchemy.orm import Session
from sqlalchemy import text

from models import (
    Item, Group, Section, Chapter, Setting, Streak, Equipped,
    DailyTask, StudySession, WordProgress,
)
from shop_data import DAILY_TASKS


# ============================================================
#  Word ID helpers
# ============================================================
def parse_word_id(word_id: str):
    """Parse 'ch1:0:0:0' -> ('ch1', 0, 0, 0).  Returns None on bad format."""
    parts = word_id.split(":")
    if len(parts) != 4:
        return None
    try:
        return parts[0], int(parts[1]), int(parts[2]), int(parts[3])
    except ValueError:
        return None


def get_item_by_word_id(db: Session, word_id: str) -> Optional[Item]:
    """Look up an Item by its computed word_id."""
    parsed = parse_word_id(word_id)
    if not parsed:
        return None
    chapter_id, section_idx, group_idx, item_idx = parsed
    return (
        db.query(Item)
        .join(Group, Item.group_id == Group.id)
        .join(Section, Group.section_id == Section.id)
        .join(Chapter, Section.chapter_id == Chapter.id)
        .filter(
            Chapter.id == chapter_id,
            Section.order == section_idx,
            Group.order == group_idx,
            Item.order == item_idx,
        )
        .first()
    )


def compute_word_id(chapter_id: str, section_order: int, group_order: int, item_order: int) -> str:
    """Build a word_id string from order fields."""
    return f"{chapter_id}:{section_order}:{group_order}:{item_order}"


def get_chapter_id_from_word_id(word_id: str) -> str:
    """Extract the chapter_id portion from a word_id."""
    return word_id.split(":")[0] if ":" in word_id else word_id


def get_all_word_ids(db: Session) -> list[dict]:
    """Return list of {word_id, en, zh, pos, chapter_id, chapter_title} for every item."""
    results = []
    chapters = db.query(Chapter).order_by(Chapter.order).all()
    for ch in chapters:
        for sec in sorted(ch.sections, key=lambda s: s.order):
            for grp in sorted(sec.groups, key=lambda g: g.order):
                for itm in sorted(grp.items, key=lambda i: i.order):
                    wid = compute_word_id(ch.id, sec.order, grp.order, itm.order)
                    results.append({
                        "word_id": wid,
                        "en": itm.en,
                        "zh": itm.zh,
                        "pos": itm.pos,
                        "chapter_id": ch.id,
                        "chapter_title": ch.title,
                    })
    return results


# ============================================================
#  Settings helpers
# ============================================================
DEFAULT_SETTINGS: dict[str, Any] = {
    "dailyGoal": 20,
    "dailyNewGoal": 20,
    "studyMode": "adaptive",
    "darkMode": False,
    "ttsEnabled": True,
    "ttsRate": 0.9,
    "ttsAutoPlay": True,
    "sfxEnabled": True,
    "focusMode": False,
    "feedbackLevel": "strong",
    "showRewards": True,
    "examplesOnCard": True,
    "recallFirst": False,
    "repeatCorrect": 2,
    "coins": 0,
}


def get_setting(db: Session, key: str, default: Any = None) -> Any:
    """Read a single setting value, falling back to DEFAULT_SETTINGS then *default*."""
    s = db.query(Setting).filter(Setting.key == key).first()
    if s:
        return s.value
    if key in DEFAULT_SETTINGS:
        return DEFAULT_SETTINGS[key]
    return default


def set_setting(db: Session, key: str, value: Any) -> None:
    """Insert or update a setting."""
    s = db.query(Setting).filter(Setting.key == key).first()
    if s:
        s.value = value
    else:
        db.add(Setting(key=key, value=value))


def get_all_settings(db: Session) -> dict[str, Any]:
    """Return merged settings (DB overrides defaults)."""
    merged = dict(DEFAULT_SETTINGS)
    for s in db.query(Setting).all():
        merged[s.key] = s.value
    return merged


def ensure_default_settings(db: Session) -> None:
    """Insert default settings rows if they don't exist yet."""
    for key, value in DEFAULT_SETTINGS.items():
        existing = db.query(Setting).filter(Setting.key == key).first()
        if not existing:
            db.add(Setting(key=key, value=value))
    db.commit()


# ============================================================
#  Coin helpers
# ============================================================
def get_coins(db: Session) -> int:
    """Return current coin balance."""
    val = get_setting(db, "coins", 0)
    try:
        return int(val)
    except (TypeError, ValueError):
        return 0


def add_coins(db: Session, amount: int) -> int:
    """Add coins and return the new balance."""
    new_balance = get_coins(db) + amount
    set_setting(db, "coins", new_balance)
    db.commit()
    return new_balance


def spend_coins(db: Session, amount: int) -> bool:
    """Deduct coins if balance is sufficient.  Returns True on success."""
    current = get_coins(db)
    if current < amount:
        return False
    set_setting(db, "coins", current - amount)
    db.commit()
    return True


# ============================================================
#  Streak helpers
# ============================================================
def get_streak(db: Session) -> Streak:
    """Get or create the singleton streak row."""
    streak = db.query(Streak).filter(Streak.id == 1).first()
    if not streak:
        streak = Streak(id=1, current=0, longest=0, last_check_in=None)
        db.add(streak)
        db.commit()
    return streak


def get_equipped(db: Session) -> Equipped:
    """Get or create the singleton equipped row."""
    equipped = db.query(Equipped).filter(Equipped.id == 1).first()
    if not equipped:
        equipped = Equipped(id=1, theme="default", badge="")
        db.add(equipped)
        db.commit()
    return equipped


# ============================================================
#  Date helpers
# ============================================================
def today_str() -> str:
    return date.today().isoformat()


def yesterday_str() -> str:
    return (date.today() - timedelta(days=1)).isoformat()


def today_start_ts() -> float:
    """Unix timestamp for midnight today."""
    return time.mktime(date.today().timetuple())


# ============================================================
#  Daily task helpers
# ============================================================
def ensure_daily_tasks(db: Session) -> list[DailyTask]:
    """Create today's DailyTask rows if they don't exist, return all of today's tasks."""
    today = today_str()
    existing = (
        db.query(DailyTask)
        .filter(DailyTask.date == today)
        .all()
    )
    if len(existing) == len(DAILY_TASKS):
        return existing

    existing_ids = {t.task_id for t in existing}
    for dt_def in DAILY_TASKS:
        if dt_def["id"] not in existing_ids:
            db.add(DailyTask(
                date=today,
                task_id=dt_def["id"],
                completed=False,
                claimed=False,
            ))
    db.commit()
    return (
        db.query(DailyTask)
        .filter(DailyTask.date == today)
        .all()
    )


def check_and_complete_daily_tasks(db: Session) -> list[str]:
    """
    Auto-complete daily tasks whose conditions are met.
    Returns list of task_ids that were newly completed.
    """
    ensure_daily_tasks(db)
    today = today_str()
    tasks = db.query(DailyTask).filter(DailyTask.date == today).all()
    newly_completed: list[str] = []

    # Gather data needed for checks
    settings = get_all_settings(db)
    daily_goal = settings.get("dailyGoal", 20)

    session = db.query(StudySession).filter(StudySession.date == today).first()
    words_today = session.words_studied if session else 0
    modes_today: list[str] = session.modes if session and session.modes else []

    # Count words reviewed today (last_review >= today start)
    ts_start = today_start_ts()
    reviewed_today = (
        db.query(WordProgress)
        .filter(WordProgress.last_review >= ts_start)
        .count()
    )

    for task in tasks:
        if task.completed:
            continue
        should_complete = False
        if task.task_id == "learn_goal":
            should_complete = words_today >= daily_goal
        elif task.task_id == "review_10":
            should_complete = reviewed_today >= 10
        elif task.task_id == "spell_1":
            should_complete = "spelling" in modes_today
        elif task.task_id == "perfect":
            # A session today with 100% accuracy and >= 10 words
            if session and session.words_studied >= 10 and session.wrong == 0 and session.sessions > 0:
                should_complete = True

        if should_complete:
            task.completed = True
            newly_completed.append(task.task_id)

    if newly_completed:
        db.commit()
    return newly_completed
