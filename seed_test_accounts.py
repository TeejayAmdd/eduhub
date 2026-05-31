"""
Run with: railway run python seed_test_accounts.py
Creates one test lecturer and one test student, both pre-verified.
"""
import sys
from app.database import SessionLocal, engine
from app.database import Base
import app.models as models
from app.auth import hash_password

Base.metadata.create_all(bind=engine)

db = SessionLocal()

LECTURER = {
    "name": "Dr. Adewale Johnson",
    "email": "adewale.johnson@lasu.edu.ng",
    "password": "lecturer123",
    "staff_number": "LASU/CS/001",
    "department": "Computer Science",
    "role": models.RoleEnum.lecturer,
}

STUDENT = {
    "name": "Fatima Bello",
    "email": "fatima.bello@st.lasu.edu.ng",
    "password": "student123",
    "matric_number": "200591001",
    "department": "Computer Science",
    "level": "200",
    "role": models.RoleEnum.student,
}

def upsert(data: dict):
    existing = db.query(models.User).filter(models.User.email == data["email"]).first()
    if existing:
        print(f"  Already exists — skipping {data['email']}")
        return

    user = models.User(
        name=data["name"],
        email=data["email"],
        password_hash=hash_password(data["password"]),
        role=data["role"],
        staff_number=data.get("staff_number"),
        matric_number=data.get("matric_number"),
        department=data.get("department"),
        level=data.get("level"),
        is_active=True,
        is_verified=True,
    )
    db.add(user)
    db.commit()
    print(f"  Created: {data['email']}  password: {data['password']}")

try:
    print("\nSeeding test accounts...")
    upsert(LECTURER)
    upsert(STUDENT)
    print("\nDone.\n")
    print("Lecturer login:")
    print(f"  Staff number : {LECTURER['staff_number']}")
    print(f"  Password     : {LECTURER['password']}")
    print("\nStudent login:")
    print(f"  Matric number: {STUDENT['matric_number']}")
    print(f"  Password     : {STUDENT['password']}")
except Exception as e:
    print(f"Error: {e}", file=sys.stderr)
    db.rollback()
finally:
    db.close()
