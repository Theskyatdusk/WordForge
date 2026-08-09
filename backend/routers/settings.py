"""Settings router — get/put key-value JSON settings."""
from typing import Any
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from models import Setting
from schemas import SettingsOut, SettingsUpdateIn
from utils import get_all_settings, set_setting, get_setting, ensure_default_settings

router = APIRouter(prefix="/api/settings", tags=["settings"])


@router.get("/", response_model=SettingsOut)
def get_settings(db: Session = Depends(get_db)):
    """Return all settings (DB values merged with defaults)."""
    return SettingsOut(settings=get_all_settings(db))


@router.put("/", response_model=SettingsOut)
def update_settings(body: SettingsUpdateIn, db: Session = Depends(get_db)):
    """Update one or more settings (partial update)."""
    for key, value in body.settings.items():
        set_setting(db, key, value)
    db.commit()
    return SettingsOut(settings=get_all_settings(db))


@router.get("/{key}")
def get_setting_by_key(key: str, db: Session = Depends(get_db)):
    """Return a single setting value."""
    value = get_setting(db, key)
    if value is None:
        raise HTTPException(status_code=404, detail=f"Setting '{key}' not found")
    return {"key": key, "value": value}


@router.put("/{key}")
def set_setting_by_key(key: str, value: Any, db: Session = Depends(get_db)):
    """Set a single setting value. Body is the raw JSON value."""
    set_setting(db, key, value)
    db.commit()
    return {"key": key, "value": value}


@router.post("/reset")
def reset_settings(db: Session = Depends(get_db)):
    """Reset all settings to defaults."""
    db.query(Setting).delete()
    db.commit()
    ensure_default_settings(db)
    return {"success": True, "settings": get_all_settings(db)}
