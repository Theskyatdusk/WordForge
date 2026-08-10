"""SQLAlchemy 2.0 ORM models for WordForge."""
from __future__ import annotations
from typing import Any, Optional
from datetime import datetime
from sqlalchemy import String, Integer, Float, Boolean, Text, ForeignKey, JSON, DateTime, Index
from sqlalchemy.orm import relationship, Mapped, mapped_column
from database import Base


class Chapter(Base):
    __tablename__ = "chapters"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    title: Mapped[str] = mapped_column(String)
    subtitle: Mapped[str] = mapped_column(String)
    icon: Mapped[str] = mapped_column(String)
    color: Mapped[str] = mapped_column(String)
    order: Mapped[int] = mapped_column(Integer)

    sections: Mapped[list["Section"]] = relationship(
        back_populates="chapter", cascade="all, delete-orphan", order_by="Section.order"
    )


class Section(Base):
    __tablename__ = "sections"
    __table_args__ = (Index("ix_sections_chapter_id", "chapter_id"),)

    id: Mapped[str] = mapped_column(String, primary_key=True)
    chapter_id: Mapped[str] = mapped_column(ForeignKey("chapters.id"), index=True)
    title: Mapped[str] = mapped_column(String)
    order: Mapped[int] = mapped_column(Integer)

    chapter: Mapped["Chapter"] = relationship(back_populates="sections")
    groups: Mapped[list["Group"]] = relationship(
        back_populates="section", cascade="all, delete-orphan", order_by="Group.order"
    )


class Group(Base):
    __tablename__ = "groups"
    __table_args__ = (Index("ix_groups_section_id", "section_id"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    section_id: Mapped[str] = mapped_column(ForeignKey("sections.id"), index=True)
    title: Mapped[str] = mapped_column(String)
    type: Mapped[str] = mapped_column(String)  # word / phrase / sentence
    order: Mapped[int] = mapped_column(Integer)

    section: Mapped["Section"] = relationship(back_populates="groups")
    items: Mapped[list["Item"]] = relationship(
        back_populates="group", cascade="all, delete-orphan", order_by="Item.order"
    )


class Item(Base):
    __tablename__ = "items"
    __table_args__ = (Index("ix_items_group_id", "group_id"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    group_id: Mapped[int] = mapped_column(ForeignKey("groups.id"), index=True)
    en: Mapped[str] = mapped_column(String)
    zh: Mapped[str] = mapped_column(String)
    pos: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    order: Mapped[int] = mapped_column(Integer)

    group: Mapped["Group"] = relationship(back_populates="items")


class WordProgress(Base):
    __tablename__ = "word_progress"
    __table_args__ = (
        Index("ix_word_progress_status", "status"),
        Index("ix_word_progress_next_review", "next_review"),
    )

    word_id: Mapped[str] = mapped_column(String, primary_key=True)
    status: Mapped[str] = mapped_column(String, default="new")
    review_count: Mapped[int] = mapped_column(Integer, default=0)
    correct_count: Mapped[int] = mapped_column(Integer, default=0)
    wrong_count: Mapped[int] = mapped_column(Integer, default=0)
    familiar_count: Mapped[int] = mapped_column(Integer, default=0)
    last_review: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    next_review: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    ease: Mapped[float] = mapped_column(Float, default=2.5)
    interval: Mapped[int] = mapped_column(Integer, default=0)
    repetitions: Mapped[int] = mapped_column(Integer, default=0)
    rt_avg: Mapped[Optional[float]] = mapped_column(Float, nullable=True)


class WordbookEntry(Base):
    __tablename__ = "wordbook_entries"

    word_id: Mapped[str] = mapped_column(String, primary_key=True)
    en: Mapped[str] = mapped_column(String)
    zh: Mapped[str] = mapped_column(String)
    pos: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    chapter_id: Mapped[str] = mapped_column(String)
    added_at: Mapped[float] = mapped_column(Float)


class Mistake(Base):
    __tablename__ = "mistakes"
    __table_args__ = (Index("ix_mistake_word_id", "word_id"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    word_id: Mapped[str] = mapped_column(String)
    at: Mapped[float] = mapped_column(Float)


class Checkin(Base):
    __tablename__ = "checkins"

    date: Mapped[str] = mapped_column(String, primary_key=True)  # "YYYY-MM-DD"


class StudySession(Base):
    __tablename__ = "study_sessions"

    date: Mapped[str] = mapped_column(String, primary_key=True)  # "YYYY-MM-DD"
    words_studied: Mapped[int] = mapped_column(Integer, default=0)
    correct: Mapped[int] = mapped_column(Integer, default=0)
    wrong: Mapped[int] = mapped_column(Integer, default=0)
    sessions: Mapped[int] = mapped_column(Integer, default=0)
    modes: Mapped[list] = mapped_column(JSON, default=list)  # JSON text


class Setting(Base):
    __tablename__ = "settings"

    key: Mapped[str] = mapped_column(String, primary_key=True)
    value: Mapped[Any] = mapped_column(JSON)  # JSON text


class Streak(Base):
    __tablename__ = "streaks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)
    current: Mapped[int] = mapped_column(Integer, default=0)
    longest: Mapped[int] = mapped_column(Integer, default=0)
    last_check_in: Mapped[Optional[str]] = mapped_column(String, nullable=True)


class Purchase(Base):
    __tablename__ = "purchases"

    kind: Mapped[str] = mapped_column(String, primary_key=True)
    item_id: Mapped[str] = mapped_column(String, primary_key=True)
    purchased_at: Mapped[float] = mapped_column(Float)


class Equipped(Base):
    __tablename__ = "equipped"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)
    theme: Mapped[str] = mapped_column(String, default="default")
    badge: Mapped[str] = mapped_column(String, default="")


class Achievement(Base):
    __tablename__ = "achievements"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    unlocked_at: Mapped[float] = mapped_column(Float)


class DailyTask(Base):
    __tablename__ = "daily_tasks"

    date: Mapped[str] = mapped_column(String, primary_key=True)  # "YYYY-MM-DD"
    task_id: Mapped[str] = mapped_column(String, primary_key=True)
    completed: Mapped[bool] = mapped_column(Boolean, default=False)
    claimed: Mapped[bool] = mapped_column(Boolean, default=False)


class CustomVocab(Base):
    __tablename__ = "custom_vocabs"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    title: Mapped[str] = mapped_column(String)
    subtitle: Mapped[str] = mapped_column(String)
    icon: Mapped[str] = mapped_column(String)
    color: Mapped[str] = mapped_column(String)
    data: Mapped[Any] = mapped_column(JSON, default=list)  # JSON text


class UserProgress(Base):
    __tablename__ = "user_progress"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)
    data: Mapped[str] = mapped_column(Text)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
