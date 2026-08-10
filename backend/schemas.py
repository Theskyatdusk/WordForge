"""Pydantic v2 schemas for request/response validation."""
from __future__ import annotations
from typing import Any, Optional, Union
from pydantic import BaseModel, ConfigDict, Field


# ============================================================
#  Vocabulary
# ============================================================
class ItemOut(BaseModel):
    id: int
    word_id: str
    en: str
    zh: str
    pos: Optional[str] = None
    order: int


class GroupOut(BaseModel):
    id: int
    title: str
    type: str
    order: int
    items: list[ItemOut] = Field(default_factory=list)


class SectionOut(BaseModel):
    id: str
    chapter_id: str
    title: str
    order: int
    groups: list[GroupOut] = Field(default_factory=list)


class ChapterOut(BaseModel):
    id: str
    title: str
    subtitle: str
    icon: str
    color: str
    order: int
    sections: list[SectionOut] = Field(default_factory=list)


class ChapterBrief(BaseModel):
    id: str
    title: str
    subtitle: str
    icon: str
    color: str
    order: int


class VocabStatsOut(BaseModel):
    chapters: int
    sections: int
    groups: int
    items: int


# ============================================================
#  Progress
# ============================================================
class WordProgressOut(BaseModel):
    word_id: str
    status: str
    review_count: int
    correct_count: int
    wrong_count: int
    familiar_count: int
    last_review: Optional[float] = None
    next_review: Optional[float] = None
    ease: float
    interval: int
    repetitions: int
    rt_avg: Optional[float] = None
    strength: float
    box: int
    weakness: float
    stage: int


class WordProgressUpdateIn(BaseModel):
    word_id: str
    grade: Union[bool, str]  # True (correct), False (wrong), or "familiar"
    responded_ms: Optional[float] = None


class DueWordOut(BaseModel):
    word_id: str
    en: str
    zh: str
    pos: Optional[str] = None
    chapter_id: str
    chapter_title: Optional[str] = None
    progress: Optional[WordProgressOut] = None


class ProgressStatsOut(BaseModel):
    total_words: int
    studied: int
    mastered: int
    learning: int
    reviewing: int
    new_count: int
    accuracy: float
    total_reviews: int
    level: int
    level_title: str
    level_progress: float
    next_threshold: Optional[int] = None


class MemoryStatsOut(BaseModel):
    avg_strength: float
    weak_count: int
    medium_count: int
    strong_count: int
    avg_ease: float
    avg_rt: float
    total_reviews: int


class ChapterProgressOut(BaseModel):
    chapter_id: str
    chapter_title: str
    total: int
    studied: int
    mastered: int
    learning: int
    reviewing: int
    new_count: int
    progress_pct: float


class WeakWordOut(BaseModel):
    word_id: str
    en: str
    zh: str
    pos: Optional[str] = None
    chapter_id: str
    strength: float
    weakness: float
    box: int
    wrong_count: int


# ============================================================
#  Wordbook
# ============================================================
class WordbookEntryOut(BaseModel):
    word_id: str
    en: str
    zh: str
    pos: Optional[str] = None
    chapter_id: str
    added_at: float


class WordbookEntryCreate(BaseModel):
    word_id: str
    en: str
    zh: str
    pos: Optional[str] = None
    chapter_id: Optional[str] = None


# ============================================================
#  Study sessions
# ============================================================
class StudySessionCreate(BaseModel):
    words_studied: int = Field(0, ge=0)
    correct: int = Field(0, ge=0)
    wrong: int = Field(0, ge=0)
    mode: str = "flashcard"


class StudySessionOut(BaseModel):
    date: str
    words_studied: int
    correct: int
    wrong: int
    sessions: int
    modes: list[str] = Field(default_factory=list)


# ============================================================
#  Check-in
# ============================================================
class CheckinStatusOut(BaseModel):
    checked_in: bool
    date: Optional[str] = None


class CheckinResultOut(BaseModel):
    success: bool
    streak: int
    longest: int
    coins_earned: int
    already_checked_in: bool = False


class StreakOut(BaseModel):
    current: int
    longest: int
    last_check_in: Optional[str] = None


# ============================================================
#  Settings
# ============================================================
class SettingsOut(BaseModel):
    settings: dict[str, Any]


class SettingsUpdateIn(BaseModel):
    settings: dict[str, Any]


# ============================================================
#  Shop
# ============================================================
class ShopThemeOut(BaseModel):
    id: str
    name: str
    emoji: str
    desc: str
    price: int
    primary: str
    kind: str = "theme"
    owned: bool = False


class ShopBadgeOut(BaseModel):
    id: str
    name: str
    emoji: str
    desc: str
    price: int
    kind: str = "badge"
    owned: bool = False


class ShopItemsOut(BaseModel):
    themes: list[ShopThemeOut]
    badges: list[ShopBadgeOut]


class PurchaseOut(BaseModel):
    kind: str
    item_id: str
    purchased_at: float


class BuyRequest(BaseModel):
    kind: str  # 'theme' or 'badge'
    item_id: str


class BuyResult(BaseModel):
    success: bool
    coins: int
    message: str = ""


class EquipRequest(BaseModel):
    kind: str  # 'theme' or 'badge'
    item_id: str


class EquipResult(BaseModel):
    success: bool
    theme: str
    badge: str
    message: str = ""


class EquippedOut(BaseModel):
    theme: str
    badge: str


class CoinsOut(BaseModel):
    coins: int


class DailyTaskOut(BaseModel):
    date: str
    task_id: str
    completed: bool
    claimed: bool
    reward: int
    desc: str


class DailyTaskUpdateIn(BaseModel):
    task_id: str
    action: str  # 'complete' or 'claim'


class DailyTaskResult(BaseModel):
    success: bool
    task_id: str
    completed: bool
    claimed: bool
    coins_earned: int = 0
    message: str = ""


# ============================================================
#  Achievements
# ============================================================
class AchievementOut(BaseModel):
    id: str
    title: str
    desc: str
    icon: str
    unlocked: bool
    unlocked_at: Optional[float] = None


# ============================================================
#  Sync
# ============================================================
class SyncData(BaseModel):
    progress: list[dict[str, Any]] = []
    wordbook: list[dict[str, Any]] = []
    mistakes: list[dict[str, Any]] = []
    checkins: list[dict[str, Any]] = []
    sessions: list[dict[str, Any]] = []
    settings: dict[str, Any] = {}
    streak: Optional[dict[str, Any]] = None
    purchases: list[dict[str, Any]] = []
    equipped: Optional[dict[str, Any]] = None
    achievements: list[dict[str, Any]] = []
    daily_tasks: list[dict[str, Any]] = []
    custom_vocabs: list[dict[str, Any]] = []


class SyncResult(BaseModel):
    success: bool
    message: str = ""
    counts: dict[str, int] = {}


# --------------------------------------------------------------
#  Sync — single-blob upload / download / reset
# --------------------------------------------------------------
class ProgressUploadIn(BaseModel):
    """Flexible schema accepting arbitrary learning-progress JSON from the frontend.

    The frontend sends keys such as wordProgress, streak, level, studyHistory,
    dailyTasks, coins, mistakes, wordbook, etc.  No field is required so the
    schema stays forward-compatible with future frontend additions.
    """

    model_config = ConfigDict(extra="allow")


class ProgressUploadResult(BaseModel):
    success: bool


class ProgressDownloadResult(BaseModel):
    success: bool
    data: Optional[dict[str, Any]] = None


class ProgressResetResult(BaseModel):
    success: bool


# ============================================================
#  Custom Vocab
# ============================================================
class CustomVocabOut(BaseModel):
    id: str
    title: str
    subtitle: str
    icon: str
    color: str
    data: Any


class CustomVocabCreate(BaseModel):
    id: str
    title: str
    subtitle: str = ""
    icon: str = "book"
    color: str = "#0D9488"
    data: Any = []
