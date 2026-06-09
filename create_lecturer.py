"""
Creates a single lecturer account on whichever DATABASE_URL is active.

Run against PRODUCTION (Railway):
    railway run python create_lecturer.py

Run against LOCAL:
    python create_lecturer.py
"""

import sys
from app.database import SessionLocal, engine
from app.database import Base
import app.models as models
from app.auth import hash_password

# ── Edit these details before running ─────────────────────────────────────────
LECTURER = {
    "name":        "Your Full Name",
    "email":       "youremail@lasu.edu.ng",
    "password":    "ChooseAStrongPassword123",
    "staff_number": "LASU/STAFF/001",
    "department":  "Computer Science",
}
# ──────────────────────────────────────────────────────────────────────────────

Base.metadata.create_all(bind=engine)
db = SessionLocal()

try:
    existing = db.query(models.User).filter(models.User.email == LECTURER["email"]).first()
    if existing:
        print(f"\n  Account already exists: {LECTURER['email']}")
        print(f"  Staff number: {existing.staff_number}")
        sys.exit(0)

    user = models.User(
        name          = LECTURER["name"],
        email         = LECTURER["email"],
        password_hash = hash_password(LECTURER["password"]),
        role          = models.RoleEnum.lecturer,
        staff_number  = LECTURER["staff_number"],
        department    = LECTURER["department"],
        is_active     = True,
        is_verified   = True,
    )
    db.add(user)
    db.commit()

    print("\n  Lecturer account created successfully.")
    print(f"  Name        : {LECTURER['name']}")
    print(f"  Email       : {LECTURER['email']}")
    print(f"  Staff number: {LECTURER['staff_number']}")
    print(f"  Password    : {LECTURER['password']}")
    print(f"  Department  : {LECTURER['department']}")
    print("\n  Login at: /login  (use Staff number + Password)\n")

except Exception as e:
    db.rollback()
    print(f"\n  Error: {e}\n", file=sys.stderr)
    sys.exit(1)
finally:
    db.close()
