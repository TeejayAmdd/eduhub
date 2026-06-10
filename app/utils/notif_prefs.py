"""Notification preference categories and resolution.

Each raw notification `type` maps to a user-facing category. Users toggle
categories in Settings; `push()` checks the recipient's preference before
sending (in-app + WebSocket).
"""

# Category -> default enabled. "submissions" defaults OFF so a lecturer with
# thousands of students isn't flooded with one notification per submission.
CATEGORY_DEFAULTS: dict[str, bool] = {
    "messages":      True,
    "announcements": True,
    "assignments":   True,    # students: new assignments/quizzes/deadlines
    "grades":        True,    # students: results when graded
    "schedule":      True,    # timetable / schedule updates
    "enrollment":    True,
    "submissions":   False,   # lecturers: a student submitted (opt-in)
    "email":         True,    # master switch for ALL email notifications
}


def emails_enabled(prefs: dict | None) -> bool:
    """Whether the app may send this user email notifications (not transactional mail)."""
    if not prefs or prefs.get("email") is None:
        return CATEGORY_DEFAULTS["email"]
    return bool(prefs["email"])

# Raw notification type -> category
TYPE_TO_CATEGORY: dict[str, str] = {
    "message":      "messages",
    "announcement": "announcements",
    "assignment":   "assignments",
    "exam_result":  "grades",
    "schedule":     "schedule",
    "enrollment":   "enrollment",
    "submission":   "submissions",
}


def is_enabled(prefs: dict | None, notif_type: str) -> bool:
    """Whether a notification of `notif_type` should be delivered given a user's prefs."""
    category = TYPE_TO_CATEGORY.get(notif_type)
    if category is None:
        return True  # unknown/critical types are always delivered
    default = CATEGORY_DEFAULTS.get(category, True)
    if not prefs or category not in prefs or prefs[category] is None:
        return default
    return bool(prefs[category])


def normalized(prefs: dict | None) -> dict:
    """Full set of categories with their effective on/off values for the UI."""
    out = {}
    for category, default in CATEGORY_DEFAULTS.items():
        if prefs and category in prefs and prefs[category] is not None:
            out[category] = bool(prefs[category])
        else:
            out[category] = default
    return out
