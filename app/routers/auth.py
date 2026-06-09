import random
import string
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas import UserCreate, UserOut, Token, LoginRequest
from app.auth import hash_password, verify_password, create_access_token
import app.models as models

router = APIRouter(prefix="/api/auth", tags=["Auth"])

STUDENT_EMAIL_DOMAIN = "@st.lasu.edu.ng"

# ── One-time seed endpoint (remove after use) ─────────────────────────────────

@router.get("/seed-test-accounts")
def seed_test_accounts(token: str, db: Session = Depends(get_db)):
    import os
    if token != os.environ.get("SEED_TOKEN", ""):
        raise HTTPException(403, "Invalid token")

    created = []

    def make(data):
        if db.query(models.User).filter(models.User.email == data["email"]).first():
            return f"SKIPPED (exists): {data['email']}"
        db.add(models.User(**data))
        db.commit()
        return f"CREATED: {data['email']}"

    created.append(make({
        "name": "Dr. Adewale Johnson",
        "email": "adewale.johnson@lasu.edu.ng",
        "password_hash": hash_password("lecturer123"),
        "role": models.RoleEnum.lecturer,
        "staff_number": "LASU/CS/001",
        "department": "Computer Science",
        "is_active": True,
        "is_verified": True,
    }))
    created.append(make({
        "name": "Fatima Bello",
        "email": "fatima.bello@st.lasu.edu.ng",
        "password_hash": hash_password("student123"),
        "role": models.RoleEnum.student,
        "matric_number": "200591001",
        "department": "Computer Science",
        "level": "200",
        "is_active": True,
        "is_verified": True,
    }))
    return {"results": created}


@router.get("/seed-lecturer")
def seed_lecturer(
    token: str,
    name: str,
    email: str,
    password: str,
    staff_number: str,
    department: str = "",
    db: Session = Depends(get_db),
):
    """One-time: create a verified lecturer account directly in the DB.
    Example:
      /api/auth/seed-lecturer?token=...&name=Dr%20Jane%20Doe&email=jane@lasu.edu.ng
        &password=secret123&staff_number=LASU/CS/002&department=Computer%20Science
    """
    import os
    if token != os.environ.get("SEED_TOKEN", ""):
        raise HTTPException(403, "Invalid token")

    email = email.strip().lower()
    if db.query(models.User).filter(models.User.email == email).first():
        raise HTTPException(400, f"Email already exists: {email}")
    if db.query(models.User).filter(models.User.staff_number == staff_number).first():
        raise HTTPException(400, f"Staff number already exists: {staff_number}")

    user = models.User(
        name=name.strip(),
        email=email,
        password_hash=hash_password(password),
        role=models.RoleEnum.lecturer,
        staff_number=staff_number.strip(),
        department=department.strip() or None,
        is_active=True,
        is_verified=True,
    )
    db.add(user)
    db.commit()
    return {
        "result": "CREATED",
        "login_with": staff_number.strip(),
        "email": email,
        "role": "lecturer",
    }


CODE_EXPIRY_MINUTES = 15


def _generate_code() -> str:
    return ''.join(random.choices(string.digits, k=6))


def _send_code_bg(to: str, name: str, code: str):
    from app.services.email_service import send_verification_code
    send_verification_code(to, name, code)


def _send_reset_code_bg(to: str, name: str, code: str):
    from app.services.email_service import send_password_reset_code
    send_password_reset_code(to, name, code)


def _send_welcome_bg(user: dict):
    from app.services.email_service import send_welcome_student, send_welcome_lecturer
    if user["role"] == "student":
        send_welcome_student(
            user["email"], user["name"],
            user["matric_number"] or "", user["department"] or "", user["level"] or "",
        )
    else:
        send_welcome_lecturer(
            user["email"], user["name"],
            user["staff_number"] or "", user["department"] or "",
        )


# ── Register ──────────────────────────────────────────────────────────────────

@router.post("/register", status_code=202)
def register(
    payload: UserCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    # Role-specific field validation
    if payload.role == models.RoleEnum.student:
        if not payload.email.lower().endswith(STUDENT_EMAIL_DOMAIN):
            raise HTTPException(400, f"Student email must end with {STUDENT_EMAIL_DOMAIN}")
        if not payload.matric_number:
            raise HTTPException(400, "Matric number is required for students")
    if payload.role == models.RoleEnum.lecturer:
        if not payload.staff_number:
            raise HTTPException(400, "Staff number is required for lecturers")

    # Duplicate checks — if the existing account is unverified, wipe it and let them retry
    existing = db.query(models.User).filter(models.User.email == payload.email).first()
    if existing:
        if existing.is_verified:
            raise HTTPException(400, "Email already registered")
        # Unverified — delete the stale account so the user can re-register
        db.query(models.EmailVerification).filter(
            models.EmailVerification.email == payload.email
        ).delete()
        db.delete(existing)
        db.flush()

    if payload.matric_number:
        dup = db.query(models.User).filter(
            models.User.matric_number == payload.matric_number
        ).first()
        if dup:
            if dup.is_verified:
                raise HTTPException(400, "Matric number already registered")
            db.query(models.EmailVerification).filter(
                models.EmailVerification.email == dup.email
            ).delete()
            db.delete(dup)
            db.flush()

    if payload.staff_number:
        dup = db.query(models.User).filter(
            models.User.staff_number == payload.staff_number
        ).first()
        if dup:
            if dup.is_verified:
                raise HTTPException(400, "Staff number already registered")
            db.query(models.EmailVerification).filter(
                models.EmailVerification.email == dup.email
            ).delete()
            db.delete(dup)
            db.flush()

    # Create user — inactive until email is verified
    user = models.User(
        name=payload.name,
        email=payload.email,
        password_hash=hash_password(payload.password),
        role=payload.role,
        matric_number=payload.matric_number,
        staff_number=payload.staff_number,
        department=payload.department,
        level=payload.level,
        is_active=False,
        is_verified=False,
    )
    db.add(user)

    # Invalidate any previous unused codes for this email
    db.query(models.EmailVerification).filter(
        models.EmailVerification.email == payload.email,
        models.EmailVerification.is_used == False,
    ).update({"is_used": True})

    code = _generate_code()
    expires = datetime.now(timezone.utc) + timedelta(minutes=CODE_EXPIRY_MINUTES)
    verification = models.EmailVerification(
        email=payload.email,
        code=code,
        expires_at=expires,
    )
    db.add(verification)
    db.commit()

    background_tasks.add_task(_send_code_bg, payload.email, payload.name, code)

    return {
        "message": "Verification code sent",
        "email": payload.email,
    }


# ── Verify email ──────────────────────────────────────────────────────────────

@router.post("/verify-email", response_model=UserOut)
def verify_email(
    payload: dict,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    email = payload.get("email", "").strip().lower()
    code  = payload.get("code",  "").strip()

    if not email or not code:
        raise HTTPException(400, "Email and code are required")

    record = (
        db.query(models.EmailVerification)
        .filter(
            models.EmailVerification.email == email,
            models.EmailVerification.is_used == False,
        )
        .order_by(models.EmailVerification.created_at.desc())
        .first()
    )
    if not record:
        raise HTTPException(400, "No pending verification found for this email")
    if record.expires_at < datetime.now(timezone.utc):
        raise HTTPException(400, "Verification code has expired — please request a new one")
    if record.code != code:
        raise HTTPException(400, "Incorrect verification code")

    # Activate the user
    user = db.query(models.User).filter(models.User.email == email).first()
    if not user:
        raise HTTPException(404, "User not found")

    user.is_active = True
    user.is_verified = True
    record.is_used = True
    db.commit()
    db.refresh(user)

    # Send welcome email in the background
    background_tasks.add_task(_send_welcome_bg, {
        "role": user.role.value,
        "email": user.email,
        "name": user.name,
        "matric_number": user.matric_number,
        "staff_number": user.staff_number,
        "department": user.department,
        "level": user.level,
    })

    return user


# ── Resend code ───────────────────────────────────────────────────────────────

@router.post("/resend-code", status_code=202)
def resend_code(
    payload: dict,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    email = payload.get("email", "").strip().lower()
    if not email:
        raise HTTPException(400, "Email is required")

    user = db.query(models.User).filter(models.User.email == email).first()
    if not user:
        raise HTTPException(404, "No account found with that email")
    if user.is_verified:
        raise HTTPException(400, "Account already verified")

    # Invalidate old codes
    db.query(models.EmailVerification).filter(
        models.EmailVerification.email == email,
        models.EmailVerification.is_used == False,
    ).update({"is_used": True})

    code = _generate_code()
    expires = datetime.now(timezone.utc) + timedelta(minutes=CODE_EXPIRY_MINUTES)
    db.add(models.EmailVerification(email=email, code=code, expires_at=expires))
    db.commit()

    background_tasks.add_task(_send_code_bg, email, user.name, code)
    return {"message": "New verification code sent"}


# ── Forgot password ───────────────────────────────────────────────────────────

def _mask_email(email: str) -> str:
    """Return e.g. 'jo***@st.lasu.edu.ng' for display."""
    local, _, domain = email.partition("@")
    if len(local) <= 2:
        masked = local[0] + "***"
    else:
        masked = local[:2] + "***"
    return f"{masked}@{domain}"


@router.post("/forgot-password/lookup")
def forgot_lookup(payload: dict, db: Session = Depends(get_db)):
    """
    Step 1 — given matric_number or staff_number, return masked name + email.
    Does NOT reveal whether the account exists if neither field is provided.
    """
    matric = (payload.get("matric_number") or "").strip().upper()
    staff  = (payload.get("staff_number")  or "").strip().upper()

    if not matric and not staff:
        raise HTTPException(400, "Please provide a matric number or staff number")

    user = None
    if matric:
        user = db.query(models.User).filter(models.User.matric_number == matric).first()
    elif staff:
        user = db.query(models.User).filter(models.User.staff_number == staff).first()

    if not user:
        raise HTTPException(404, "No account found with that ID. Check the number and try again.")

    return {
        "name": user.name,
        "masked_email": _mask_email(user.email),
        "role": user.role.value,
    }


@router.post("/forgot-password/send-code", status_code=202)
def forgot_send_code(
    payload: dict,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    """
    Step 2 — user provides the full email to confirm ownership.
    Sends a 6-digit reset code if it matches.
    """
    matric = (payload.get("matric_number") or "").strip().upper()
    staff  = (payload.get("staff_number")  or "").strip().upper()
    email  = (payload.get("email") or "").strip().lower()

    if not email:
        raise HTTPException(400, "Email is required")

    user = None
    if matric:
        user = db.query(models.User).filter(models.User.matric_number == matric).first()
    elif staff:
        user = db.query(models.User).filter(models.User.staff_number == staff).first()
    else:
        raise HTTPException(400, "ID number is required")

    if not user or user.email.lower() != email:
        raise HTTPException(400, "Email does not match the account on record")

    # Invalidate previous unused codes
    db.query(models.PasswordResetCode).filter(
        models.PasswordResetCode.email == user.email,
        models.PasswordResetCode.is_used == False,
    ).update({"is_used": True})

    code    = _generate_code()
    expires = datetime.now(timezone.utc) + timedelta(minutes=CODE_EXPIRY_MINUTES)
    db.add(models.PasswordResetCode(email=user.email, code=code, expires_at=expires))
    db.commit()

    background_tasks.add_task(_send_reset_code_bg, user.email, user.name, code)
    return {"message": "Reset code sent", "email": user.email}


@router.post("/forgot-password/verify-code")
def forgot_verify_code(payload: dict, db: Session = Depends(get_db)):
    """Check reset code is valid without consuming it — lets the frontend validate before showing the password form."""
    email = (payload.get("email") or "").strip().lower()
    code  = (payload.get("code")  or "").strip()

    if not email or not code:
        raise HTTPException(400, "Email and code are required")

    record = (
        db.query(models.PasswordResetCode)
        .filter(
            models.PasswordResetCode.email == email,
            models.PasswordResetCode.is_used == False,
        )
        .order_by(models.PasswordResetCode.created_at.desc())
        .first()
    )
    if not record:
        raise HTTPException(400, "No active reset code found — please request a new one")
    if record.expires_at < datetime.now(timezone.utc):
        raise HTTPException(400, "Reset code has expired — please request a new one")
    if record.code != code:
        raise HTTPException(400, "Incorrect reset code")

    return {"valid": True}


@router.post("/forgot-password/reset")
def forgot_reset(payload: dict, db: Session = Depends(get_db)):
    """
    Step 3 — verify code + set new password.
    """
    email    = (payload.get("email")    or "").strip().lower()
    code     = (payload.get("code")     or "").strip()
    password = (payload.get("password") or "").strip()

    if not email or not code or not password:
        raise HTTPException(400, "Email, code and new password are all required")
    if len(password) < 6:
        raise HTTPException(400, "Password must be at least 6 characters")

    record = (
        db.query(models.PasswordResetCode)
        .filter(
            models.PasswordResetCode.email == email,
            models.PasswordResetCode.is_used == False,
        )
        .order_by(models.PasswordResetCode.created_at.desc())
        .first()
    )
    if not record:
        raise HTTPException(400, "No active reset code found — please request a new one")
    if record.expires_at < datetime.now(timezone.utc):
        raise HTTPException(400, "Reset code has expired — please request a new one")
    if record.code != code:
        raise HTTPException(400, "Incorrect reset code")

    user = db.query(models.User).filter(models.User.email == email).first()
    if not user:
        raise HTTPException(404, "Account not found")

    user.password_hash = hash_password(password)
    record.is_used = True
    db.commit()

    return {"message": "Password updated successfully"}


# ── Login ─────────────────────────────────────────────────────────────────────

@router.post("/login", response_model=Token)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    identifier = payload.identifier.strip()

    user = (
        db.query(models.User).filter(models.User.matric_number == identifier.upper()).first()
        or db.query(models.User).filter(models.User.staff_number == identifier.upper()).first()
        or db.query(models.User).filter(models.User.email == identifier.lower()).first()
    )

    if not user:
        # Give a hint based on what the identifier looks like
        if "@" in identifier:
            raise HTTPException(401, "No account found with that email address.")
        else:
            raise HTTPException(401, "No account found with that matric or staff number.")

    if not verify_password(payload.password, user.password_hash):
        raise HTTPException(401, "Incorrect password. Please try again.")

    if not user.is_verified:
        raise HTTPException(403, "Please verify your email before logging in.")

    if not user.is_active:
        raise HTTPException(403, "Account is deactivated. Contact support.")

    token = create_access_token({"sub": str(user.id), "role": user.role})
    return {"access_token": token, "token_type": "bearer"}
