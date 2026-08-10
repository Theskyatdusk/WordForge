"""Check-in router — today status, check-in, streak, dates."""
import time
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from database import get_db
from models import Checkin
from schemas import CheckinStatusOut, CheckinResultOut, StreakOut
from utils import today_str, yesterday_str, get_streak, add_coins
import achievements

router = APIRouter(prefix="/api/checkin", tags=["checkin"])

# Base coins per check-in + bonus per streak day (capped)
BASE_CHECKIN_COINS = 5
MAX_STREAK_BONUS = 15


@router.get("/today", response_model=CheckinStatusOut)
def get_today_status(db: Session = Depends(get_db)):
    """Return whether the user has already checked in today."""
    today = today_str()
    checkin = db.query(Checkin).filter(Checkin.date == today).first()
    return CheckinStatusOut(
        checked_in=checkin is not None,
        date=today if checkin else None,
    )


@router.post("/", response_model=CheckinResultOut)
def do_checkin(db: Session = Depends(get_db)):
    """Check in for today. Awards coins and updates streak."""
    today = today_str()

    # Already checked in?
    existing = db.query(Checkin).filter(Checkin.date == today).first()
    if existing:
        streak = get_streak(db)
        return CheckinResultOut(
            success=True,
            streak=streak.current,
            longest=streak.longest,
            coins_earned=0,
            already_checked_in=True,
        )

    # Create check-in record (catch race condition: concurrent insert)
    db.add(Checkin(date=today))
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        streak = get_streak(db)
        return CheckinResultOut(
            success=True,
            streak=streak.current,
            longest=streak.longest,
            coins_earned=0,
            already_checked_in=True,
        )

    # Update streak
    streak = get_streak(db)
    if streak.last_check_in == yesterday_str():
        streak.current += 1
    else:
        streak.current = 1
    streak.longest = max(streak.longest, streak.current)
    streak.last_check_in = today

    # Award coins: base + streak bonus
    coins_earned = BASE_CHECKIN_COINS + min(streak.current - 1, MAX_STREAK_BONUS)
    add_coins(db, coins_earned)

    # Check achievements (streak3, streak7)
    achievements.check_achievements(db)

    return CheckinResultOut(
        success=True,
        streak=streak.current,
        longest=streak.longest,
        coins_earned=coins_earned,
        already_checked_in=False,
    )


@router.get("/streak", response_model=StreakOut)
def get_streak_info(db: Session = Depends(get_db)):
    """Return current and longest streak."""
    streak = get_streak(db)
    return StreakOut(
        current=streak.current,
        longest=streak.longest,
        last_check_in=streak.last_check_in,
    )


@router.get("/dates", response_model=list[str])
def get_checkin_dates(db: Session = Depends(get_db)):
    """Return all check-in dates (YYYY-MM-DD), ordered descending."""
    checkins = (
        db.query(Checkin.date)
        .order_by(Checkin.date.desc())
        .all()
    )
    return [c[0] for c in checkins]


@router.get("/calendar/{year}/{month}")
def get_monthly_checkins(year: int, month: int, db: Session = Depends(get_db)):
    """Return check-in dates for a specific year/month."""
    if not (1 <= month <= 12):
        raise HTTPException(status_code=400, detail="Month must be between 1 and 12")
    prefix = f"{year:04d}-{month:02d}-"
    checkins = (
        db.query(Checkin.date)
        .filter(Checkin.date.like(f"{prefix}%"))
        .order_by(Checkin.date)
        .all()
    )
    return {"year": year, "month": month, "dates": [c[0] for c in checkins]}
