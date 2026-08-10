"""Study router — record sessions, get today's and all sessions."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from database import get_db
from models import StudySession
from schemas import StudySessionCreate, StudySessionOut
from utils import today_str, check_and_complete_daily_tasks, ensure_daily_tasks
import achievements

router = APIRouter(prefix="/api/study", tags=["study"])


@router.post("/session", response_model=StudySessionOut)
def record_session(body: StudySessionCreate, db: Session = Depends(get_db)):
    """
    Record a study session.  Aggregates into today's StudySession row:
    increments words_studied, correct, wrong, sessions, and appends mode.
    Uses INSERT OR IGNORE + atomic UPDATE to avoid race conditions.
    """
    today = today_str()

    # Try to create today's row if it doesn't exist (ignore if already exists)
    session = db.query(StudySession).filter(StudySession.date == today).first()
    if not session:
        session = StudySession(
            date=today,
            words_studied=0,
            correct=0,
            wrong=0,
            sessions=0,
            modes=[],
        )
        db.add(session)
        try:
            db.flush()  # Flush to detect duplicate key
        except IntegrityError:
            db.rollback()
            session = db.query(StudySession).filter(StudySession.date == today).first()
            if not session:
                raise

    # Atomic increment to avoid lost updates from concurrent requests
    db.query(StudySession).filter(StudySession.date == today).update({
        StudySession.words_studied: StudySession.words_studied + body.words_studied,
        StudySession.correct: StudySession.correct + body.correct,
        StudySession.wrong: StudySession.wrong + body.wrong,
        StudySession.sessions: StudySession.sessions + 1,
    }, synchronize_session=False)

    # Append mode using a fresh query to get latest modes (reduce race window)
    db.flush()  # Ensure atomic update is flushed
    fresh = db.query(StudySession).filter(StudySession.date == today).first()
    session.modes = list(fresh.modes or []) + [body.mode]

    db.commit()
    db.refresh(session)

    # Auto-complete daily tasks whose conditions are now met
    check_and_complete_daily_tasks(db)

    # Check achievements (first_step, studied50, studied100, perfect, quiz50, mastered*)
    achievements.check_achievements(db)

    return session


@router.get("/today", response_model=StudySessionOut)
def get_today_session(db: Session = Depends(get_db)):
    """Return today's study session (or zeros if none yet)."""
    today = today_str()
    session = db.query(StudySession).filter(StudySession.date == today).first()
    if not session:
        return StudySessionOut(
            date=today,
            words_studied=0,
            correct=0,
            wrong=0,
            sessions=0,
            modes=[],
        )
    return session


@router.get("/sessions", response_model=list[StudySessionOut])
def get_all_sessions(db: Session = Depends(get_db)):
    """Return all study sessions, ordered by date descending."""
    sessions = (
        db.query(StudySession)
        .order_by(StudySession.date.desc())
        .all()
    )
    return sessions


@router.get("/sessions/{date_str}", response_model=StudySessionOut)
def get_session_by_date(date_str: str, db: Session = Depends(get_db)):
    """Return the study session for a specific date (YYYY-MM-DD)."""
    session = db.query(StudySession).filter(StudySession.date == date_str).first()
    if not session:
        return StudySessionOut(
            date=date_str,
            words_studied=0,
            correct=0,
            wrong=0,
            sessions=0,
            modes=[],
        )
    return session
