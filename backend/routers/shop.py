"""Shop router — items, purchases, buy, equip, equipped, coins, daily tasks."""
import time
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from models import Purchase, Equipped, DailyTask
from schemas import (
    ShopItemsOut, ShopThemeOut, ShopBadgeOut,
    PurchaseOut, BuyRequest, BuyResult,
    EquipRequest, EquipResult, EquippedOut,
    CoinsOut, DailyTaskOut, DailyTaskUpdateIn, DailyTaskResult,
)
from shop_data import THEMES, BADGES, DAILY_TASKS, get_shop_item
from utils import (
    get_coins, spend_coins, add_coins, get_equipped,
    ensure_daily_tasks, check_and_complete_daily_tasks, today_str,
)

router = APIRouter(prefix="/api/shop", tags=["shop"])


# ------------------------------------------------------------------ items
@router.get("/items", response_model=ShopItemsOut)
def get_shop_items(db: Session = Depends(get_db)):
    """Return all shop items (themes + badges) with ownership status."""
    purchases = {
        (p.kind, p.item_id) for p in db.query(Purchase).all()
    }
    # Default theme is always "owned"
    purchases.add(("theme", "default"))

    themes = [
        ShopThemeOut(
            id=t["id"], name=t["name"], emoji=t["emoji"], desc=t["desc"],
            price=t["price"], primary=t["primary"], kind="theme",
            owned=("theme", t["id"]) in purchases,
        )
        for t in THEMES
    ]
    badges = [
        ShopBadgeOut(
            id=b["id"], name=b["name"], emoji=b["emoji"], desc=b["desc"],
            price=b["price"], kind="badge",
            owned=("badge", b["id"]) in purchases,
        )
        for b in BADGES
    ]
    return ShopItemsOut(themes=themes, badges=badges)


# ------------------------------------------------------------------ purchases
@router.get("/purchases", response_model=list[PurchaseOut])
def get_purchases(db: Session = Depends(get_db)):
    """Return all purchase records."""
    return db.query(Purchase).order_by(Purchase.purchased_at.desc()).all()


# ------------------------------------------------------------------ buy
@router.post("/buy", response_model=BuyResult)
def buy_item(body: BuyRequest, db: Session = Depends(get_db)):
    """Buy a theme or badge with coins."""
    item = get_shop_item(body.kind, body.item_id)
    if not item:
        raise HTTPException(status_code=404, detail=f"Item '{body.item_id}' not found")

    # Already owned?
    existing = (
        db.query(Purchase)
        .filter(Purchase.kind == body.kind, Purchase.item_id == body.item_id)
        .first()
    )
    if existing or (body.kind == "theme" and body.item_id == "default"):
        return BuyResult(success=False, coins=get_coins(db), message="Already owned")

    price = item["price"]
    if price == 0:
        # Free item — just record the purchase
        db.add(Purchase(kind=body.kind, item_id=body.item_id, purchased_at=time.time()))
        db.commit()
        return BuyResult(success=True, coins=get_coins(db), message="Purchased (free)")

    if not spend_coins(db, price):
        raise HTTPException(status_code=400, detail="Not enough coins")

    db.add(Purchase(kind=body.kind, item_id=body.item_id, purchased_at=time.time()))
    try:
        db.commit()
    except Exception:
        db.rollback()
        # Refund the coins if purchase record failed
        add_coins(db, price)
        raise HTTPException(status_code=500, detail="Purchase failed, coins refunded")

    return BuyResult(success=True, coins=get_coins(db), message="Purchase successful")


# ------------------------------------------------------------------ equip
@router.post("/equip", response_model=EquipResult)
def equip_item(body: EquipRequest, db: Session = Depends(get_db)):
    """Equip a purchased theme or badge."""
    # Check ownership (default theme is always owned)
    if body.kind == "theme" and body.item_id == "default":
        owned = True
    else:
        owned = (
            db.query(Purchase)
            .filter(Purchase.kind == body.kind, Purchase.item_id == body.item_id)
            .first()
            is not None
        )

    if not owned:
        raise HTTPException(status_code=403, detail="Item not purchased")

    # Validate item exists
    item = get_shop_item(body.kind, body.item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    equipped = get_equipped(db)
    if body.kind == "theme":
        equipped.theme = body.item_id
    elif body.kind == "badge":
        equipped.badge = body.item_id
    db.commit()

    return EquipResult(
        success=True,
        theme=equipped.theme,
        badge=equipped.badge,
        message=f"{item.get('name', body.item_id)} equipped",
    )


@router.get("/equipped", response_model=EquippedOut)
def get_equipped_items(db: Session = Depends(get_db)):
    """Return currently equipped theme and badge."""
    equipped = get_equipped(db)
    return EquippedOut(theme=equipped.theme, badge=equipped.badge)


# ------------------------------------------------------------------ coins
@router.get("/coins", response_model=CoinsOut)
def get_coins_balance(db: Session = Depends(get_db)):
    """Return current coin balance."""
    return CoinsOut(coins=get_coins(db))


# ------------------------------------------------------------------ daily tasks
@router.get("/daily-tasks", response_model=list[DailyTaskOut])
def get_daily_tasks(db: Session = Depends(get_db)):
    """Return today's daily tasks (creates them if missing)."""
    # Auto-complete any tasks whose conditions are already met
    check_and_complete_daily_tasks(db)

    tasks = ensure_daily_tasks(db)
    task_map = {t.task_id: t for t in tasks}

    result = []
    for dt_def in DAILY_TASKS:
        t = task_map.get(dt_def["id"])
        result.append(DailyTaskOut(
            date=today_str() if t else "",
            task_id=dt_def["id"],
            completed=t.completed if t else False,
            claimed=t.claimed if t else False,
            reward=dt_def["reward"],
            desc=dt_def["desc"],
        ))
    return result


@router.post("/daily-tasks", response_model=DailyTaskResult)
def update_daily_task(body: DailyTaskUpdateIn, db: Session = Depends(get_db)):
    """Complete or claim a daily task."""
    today = today_str()
    task = (
        db.query(DailyTask)
        .filter(DailyTask.date == today, DailyTask.task_id == body.task_id)
        .first()
    )
    if not task:
        raise HTTPException(status_code=404, detail="Daily task not found for today")

    # Find task definition
    dt_def = None
    for d in DAILY_TASKS:
        if d["id"] == body.task_id:
            dt_def = d
            break
    if not dt_def:
        raise HTTPException(status_code=404, detail="Unknown task")

    if body.action == "complete":
        task.completed = True
        db.commit()
        return DailyTaskResult(
            success=True, task_id=body.task_id,
            completed=True, claimed=task.claimed,
            message="Task completed",
        )

    elif body.action == "claim":
        if not task.completed:
            raise HTTPException(status_code=400, detail="Task not completed yet")
        if task.claimed:
            raise HTTPException(status_code=400, detail="Reward already claimed")

        task.claimed = True
        reward = dt_def["reward"]
        add_coins(db, reward)
        db.commit()

        return DailyTaskResult(
            success=True, task_id=body.task_id,
            completed=True, claimed=True,
            coins_earned=reward,
            message=f"Claimed {reward} coins",
        )

    else:
        raise HTTPException(status_code=400, detail=f"Unknown action '{body.action}'")


# ------------------------------------------------------------------ achievements list
@router.get("/achievements")
def get_achievements_endpoint(db: Session = Depends(get_db)):
    """Return all achievements with unlock status."""
    import achievements as ach_mod
    return ach_mod.get_all_achievements(db)
