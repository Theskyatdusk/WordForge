"""SM-2 spaced repetition algorithm and memory strength engine."""
import time

# --- Constants ---
EASE_MIN = 1.3
EASE_MAX = 2.8
INTERVAL_MAX = 180
MATURE_INTERVAL = 21
STRENGTH_WEAK = 40
BOX_INTERVALS = [1, 6, 15, 30]

# --- Level system (10 levels based on mastered count) ---
LEVELS = [
    (0, "初学者"),
    (5, "词汇萌新"),
    (10, "勤奋学徒"),
    (20, "词海行者"),
    (35, "词汇能手"),
    (50, "词汇达人"),
    (70, "词汇专家"),
    (90, "词汇大师"),
    (120, "词汇宗师"),
    (140, "词汇传说"),
]


def update_progress(progress, grade, responded_ms=None):
    """
    Update a WordProgress record using the SM-2 algorithm.

    Parameters
    ----------
    progress : WordProgress ORM object (modified in place)
    grade : True (correct), 'familiar', or False (wrong)
    responded_ms : optional response time in milliseconds
    """
    now = time.time()

    # --- Grade -> quality mapping ---
    if grade is True:
        q = 5
    elif grade == "familiar":
        q = 3
    else:  # False / 'wrong'
        q = 1

    # --- Response-time awareness ---
    rt_bonus = 0.0
    if responded_ms is not None:
        if responded_ms > 3000:
            q = min(q, 3)        # slow responses downgrade to q=3
        elif responded_ms < 800:
            rt_bonus = 0.05       # fast responses give a small ease bonus

    # --- Current SM-2 state ---
    ease = progress.ease if progress.ease is not None else 2.5
    interval = progress.interval if progress.interval is not None else 0
    repetitions = progress.repetitions if progress.repetitions is not None else 0

    # --- Interval & repetition update ---
    if q >= 3:
        if repetitions == 0:
            interval = 1
        elif repetitions == 1:
            interval = 6
        else:
            interval = round(interval * ease)
        repetitions += 1
    else:
        repetitions = 0
        interval = 1

    # --- Ease factor update ---
    ease = ease + 0.1 - (5 - q) * (0.08 + (5 - q) * 0.02) + rt_bonus
    ease = max(EASE_MIN, min(EASE_MAX, ease))

    # --- Cap interval ---
    interval = min(interval, INTERVAL_MAX)

    # --- Update review counters (based on original grade, not modified q) ---
    progress.review_count = (progress.review_count or 0) + 1
    if grade is True:
        progress.correct_count = (progress.correct_count or 0) + 1
    elif grade == "familiar":
        progress.familiar_count = (progress.familiar_count or 0) + 1
    else:
        progress.wrong_count = (progress.wrong_count or 0) + 1

    # --- Update SM-2 fields ---
    progress.ease = ease
    progress.interval = interval
    progress.repetitions = repetitions
    progress.last_review = now
    progress.next_review = now + interval * 86400

    # --- Rolling RT average ---
    if responded_ms is not None:
        n = progress.review_count or 1
        progress.rt_avg = ((progress.rt_avg or 0) * (n - 1) + responded_ms) / n

    # --- Status: new -> learning -> reviewing -> mastered ---
    if interval >= MATURE_INTERVAL:
        progress.status = "mastered"
    elif interval >= 6:
        progress.status = "reviewing"
    else:
        progress.status = "learning"

    return progress


def get_strength(progress) -> float:
    """Memory strength: 100 * 2^(-days_passed / interval_days), clamped to [0, 100]."""
    if not progress.last_review:
        return 0.0
    interval_days = max(progress.interval or 1, 1)
    days_passed = (time.time() - progress.last_review) / 86400
    strength = 100 * (2 ** (-days_passed / interval_days))
    return round(min(max(strength, 0.0), 100.0), 1)


def get_box(progress) -> int:
    """Leitner box 1-5 based on interval vs BOX_INTERVALS."""
    interval = progress.interval or 0
    if interval <= BOX_INTERVALS[0]:
        return 1
    elif interval <= BOX_INTERVALS[1]:
        return 2
    elif interval <= BOX_INTERVALS[2]:
        return 3
    elif interval <= BOX_INTERVALS[3]:
        return 4
    else:
        return 5


def get_weakness(progress) -> float:
    """Weakness score (0-100), inverse of strength with wrong-rate floor."""
    strength = get_strength(progress)
    weakness = 100 - strength
    wrong = progress.wrong_count or 0
    total = (progress.correct_count or 0) + wrong + (progress.familiar_count or 0)
    if total > 0:
        wrong_rate = (wrong / total) * 100
        weakness = max(weakness, wrong_rate)
    return round(min(weakness, 100), 1)


def get_stage(progress) -> int:
    """Learning stage: 0(new, 0-2 reviews), 1(consolidating, 3-6), 2(mature, 7+ or mastered)."""
    if progress.status == "mastered":
        return 2
    review_count = progress.review_count or 0
    if review_count <= 2:
        return 0
    elif review_count <= 6:
        return 1
    else:
        return 2


def get_level(mastered_count: int) -> dict:
    """Return level info dict based on mastered word count."""
    level = 1
    title = LEVELS[0][1]
    next_threshold = None
    for i, (threshold, name) in enumerate(LEVELS):
        if mastered_count >= threshold:
            level = i + 1
            title = name
            if i + 1 < len(LEVELS):
                next_threshold = LEVELS[i + 1][0]
        else:
            if next_threshold is None:
                next_threshold = threshold
            break

    prev_threshold = LEVELS[level - 1][0] if level > 0 else 0
    if next_threshold is not None and next_threshold > prev_threshold:
        progress_pct = ((mastered_count - prev_threshold) / (next_threshold - prev_threshold)) * 100
    else:
        progress_pct = 100.0
        next_threshold = None

    return {
        "level": level,
        "title": title,
        "mastered": mastered_count,
        "next_threshold": next_threshold,
        "prev_threshold": prev_threshold,
        "progress": round(progress_pct, 1),
    }
