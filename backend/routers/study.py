"""Study router — record sessions, get today's and all sessions."""
import json
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

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
    """
    today = today_str()
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

    session.words_studied += body.words_studied
    session.correct += body.correct
    session.wrong += body.wrong
    session.sessions += 1
    modes = session.modes if session.modes else []
    modes.append(body.mode)
    session.modes = modes

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
