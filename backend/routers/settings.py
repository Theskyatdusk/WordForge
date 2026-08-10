"""Settings router — get/put key-value JSON settings."""
from typing import Any
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from models import Setting
from schemas import SettingsOut, SettingsUpdateIn
from utils import get_all_settings, set_setting, get_setting, ensure_default_settings

router = APIRouter(prefix="/api/settings", tags=["settings"])

# Keys that must not be modified directly via the settings API — they are
# managed by dedicated endpoints (coins, level, streak, purchases, etc.).
SENSITIVE_KEYS = {"coins", "level", "streak", "purchasedBadges", "purchasedThemes"}


@router.get("/", response_model=SettingsOut)
def get_settings(db: Session = Depends(get_db)):
    """Return all settings (DB values merged with defaults)."""
    return SettingsOut(settings=get_all_settings(db))


@router.put("/", response_model=SettingsOut)
def update_settings(body: SettingsUpdateIn, db: Session = Depends(get_db)):
    """Update one or more settings (partial update)."""
    # Filter out sensitive keys that must not be set directly by the client
    for key in list(body.settings.keys()):
        if key in SENSITIVE_KEYS:
            del body.settings[key]
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
    # Block sensitive keys from being modified directly — prevents coin/level/streak cheating
    if key in SENSITIVE_KEYS:
        raise HTTPException(status_code=403, detail=f"Setting '{key}' cannot be modified directly")
    set_setting(db, key, value)
    db.commit()
    return {"key": key, "value": value}


@router.post("/reset")
def reset_settings(db: Session = Depends(get_db)):
    """Reset all settings to defaults, preserving coins and sensitive economy data."""
    try:
        preserved_coins = get_setting(db, "coins", 0)
        db.query(Setting).delete()
        ensure_default_settings(db)
        set_setting(db, "coins", preserved_coins)
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to reset settings")
    return {"success": True, "settings": get_all_settings(db)}
