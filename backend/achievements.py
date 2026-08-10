"""Achievement definitions and unlock-check logic."""
from __future__ import annotations
import time
from sqlalchemy.orm import Session

from models import (
    Achievement, StudySession, WordProgress, WordbookEntry, Streak,
)
from utils import add_coins

ACHIEVEMENTS = [
    {"id": "first_step", "title": "第一步", "desc": "完成首次学习", "icon": "spark"},
    {"id": "streak3", "title": "三日之寒", "desc": "连续打卡3天", "icon": "flame"},
    {"id": "streak7", "title": "一周坚持", "desc": "连续打卡7天", "icon": "flame"},
    {"id": "studied50", "title": "勤学苦练", "desc": "累计学习50词", "icon": "book"},
    {"id": "studied100", "title": "百词斩", "desc": "累计学习100词", "icon": "book"},
    {"id": "mastered10", "title": "小有所成", "desc": "掌握10个词汇", "icon": "star"},
    {"id": "mastered50", "title": "词汇达人", "desc": "掌握50个词汇", "icon": "star"},
    {"id": "wordbook10", "title": "善用书签", "desc": "生词本收集10词", "icon": "bookmark"},
    {"id": "perfect", "title": "全对达人", "desc": "单日准确率100%且≥10词", "icon": "check"},
    {"id": "quiz50", "title": "测验高手", "desc": "完成50次测验", "icon": "trophy"},
]

# Coin reward per achievement unlock
ACHIEVEMENT_COIN_REWARD = 20


def _check_condition(db: Session, achievement_id: str) -> bool:
    """Return True if the condition for *achievement_id* is currently met."""
    if achievement_id == "first_step":
        return db.query(StudySession).filter(StudySession.sessions > 0).count() > 0

    elif achievement_id == "streak3":
        streak = db.query(Streak).filter(Streak.id == 1).first()
        return streak is not None and streak.current >= 3

    elif achievement_id == "streak7":
        streak = db.query(Streak).filter(Streak.id == 1).first()
        return streak is not None and streak.current >= 7

    elif achievement_id == "studied50":
        count = db.query(WordProgress).filter(WordProgress.review_count > 0).count()
        return count >= 50

    elif achievement_id == "studied100":
        count = db.query(WordProgress).filter(WordProgress.review_count > 0).count()
        return count >= 100

    elif achievement_id == "mastered10":
        count = db.query(WordProgress).filter(WordProgress.status == "mastered").count()
        return count >= 10

    elif achievement_id == "mastered50":
        count = db.query(WordProgress).filter(WordProgress.status == "mastered").count()
        return count >= 50

    elif achievement_id == "wordbook10":
        return db.query(WordbookEntry).count() >= 10

    elif achievement_id == "perfect":
        # Use SQL COUNT instead of loading all sessions into memory
        count = (
            db.query(StudySession)
            .filter(StudySession.sessions > 0)
            .filter(StudySession.words_studied >= 10)
            .filter(StudySession.wrong == 0)
            .count()
        )
        return count > 0

    elif achievement_id == "quiz50":
        # Sum quiz mode counts across all sessions (JSON list iteration in Python is unavoidable)
        sessions = db.query(StudySession).all()
        total_quiz = 0
        for s in sessions:
            modes = s.modes if s.modes else []
            total_quiz += modes.count("quiz")
        return total_quiz >= 50

    return False


def check_achievements(db: Session) -> list[dict]:
    """
    Check all achievements and unlock any newly-qualified ones.
    Returns list of newly-unlocked achievement dicts.
    """
    newly_unlocked: list[dict] = []
    for ach in ACHIEVEMENTS:
        existing = db.query(Achievement).filter(Achievement.id == ach["id"]).first()
        if existing:
            continue
        if _check_condition(db, ach["id"]):
            record = Achievement(id=ach["id"], unlocked_at=time.time())
            db.add(record)
            newly_unlocked.append(ach)

    if newly_unlocked:
        # Collect all coin rewards and add them in a single add_coins call.
        # add_coins commits the transaction, persisting both the Achievement
        # records and the coin update together (avoids partial commits).
        total_reward = ACHIEVEMENT_COIN_REWARD * len(newly_unlocked)
        try:
            add_coins(db, total_reward)
        except Exception:
            # If coin reward fails, still commit the achievement records
            db.commit()
    return newly_unlocked


def get_all_achievements(db: Session) -> list[dict]:
    """Return all achievements with unlock status."""
    unlocked = {a.id: a for a in db.query(Achievement).all()}
    result = []
    for ach in ACHIEVEMENTS:
        record = unlocked.get(ach["id"])
        result.append({
            "id": ach["id"],
            "title": ach["title"],
            "desc": ach["desc"],
            "icon": ach["icon"],
            "unlocked": record is not None,
            "unlocked_at": record.unlocked_at if record else None,
        })
    return result
