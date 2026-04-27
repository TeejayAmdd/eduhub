from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime, date, time
from app.models import RoleEnum, StatusEnum, SubmissionStatusEnum


# ── User ────────────────────────────────────────────────
class UserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: RoleEnum = RoleEnum.student


class UserOut(BaseModel):
    id: int
    name: str
    email: str
    role: RoleEnum
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


# ── Class ────────────────────────────────────────────────
class ClassCreate(BaseModel):
    name: str
    subject: str
    academic_year: str


class ClassOut(BaseModel):
    id: int
    name: str
    subject: str
    academic_year: str
    lecturer_id: int

    class Config:
        from_attributes = True


# ── Enrollment ───────────────────────────────────────────
class EnrollmentCreate(BaseModel):
    student_id: int
    class_id: int
    roll_number: int


class EnrollmentOut(BaseModel):
    id: int
    student_id: int
    class_id: int
    roll_number: int
    grade: Optional[str]
    enrolled_at: datetime

    class Config:
        from_attributes = True


class StudentInClass(BaseModel):
    id: int
    name: str
    email: str
    roll_number: int
    grade: Optional[str]
    attendance_rate: Optional[float] = None

    class Config:
        from_attributes = True


# ── Assignment ───────────────────────────────────────────
class AssignmentCreate(BaseModel):
    title: str
    description: Optional[str]
    class_id: int
    due_date: datetime


class AssignmentOut(BaseModel):
    id: int
    title: str
    description: Optional[str]
    class_id: int
    due_date: datetime
    created_at: datetime
    total_submissions: Optional[int] = 0
    pending_count: Optional[int] = 0
    overdue_count: Optional[int] = 0

    class Config:
        from_attributes = True


# ── Submission ───────────────────────────────────────────
class SubmissionCreate(BaseModel):
    assignment_id: int
    file_url: Optional[str]


class SubmissionUpdate(BaseModel):
    status: Optional[SubmissionStatusEnum]
    score: Optional[float]
    feedback: Optional[str]


class SubmissionOut(BaseModel):
    id: int
    assignment_id: int
    student_id: int
    submitted_at: Optional[datetime]
    status: SubmissionStatusEnum
    file_url: Optional[str]
    score: Optional[float]
    feedback: Optional[str]

    class Config:
        from_attributes = True


# ── Attendance ───────────────────────────────────────────
class AttendanceCreate(BaseModel):
    class_id: int
    student_id: int
    date: date
    status: StatusEnum = StatusEnum.present


class AttendanceBulkCreate(BaseModel):
    class_id: int
    date: date
    records: List[dict]  # [{"student_id": 1, "status": "present"}, ...]


class AttendanceOut(BaseModel):
    id: int
    class_id: int
    student_id: int
    date: date
    status: StatusEnum

    class Config:
        from_attributes = True


# ── Schedule ─────────────────────────────────────────────
class ScheduleCreate(BaseModel):
    class_id: int
    day_of_week: str
    start_time: time
    end_time: time
    room: Optional[str]


class ScheduleOut(BaseModel):
    id: int
    class_id: int
    day_of_week: str
    start_time: time
    end_time: time
    room: Optional[str]

    class Config:
        from_attributes = True


# ── Exam ─────────────────────────────────────────────────
class ExamCreate(BaseModel):
    title: str
    class_id: int
    exam_date: datetime
    total_marks: float


class ExamOut(BaseModel):
    id: int
    title: str
    class_id: int
    exam_date: datetime
    total_marks: float
    created_at: datetime

    class Config:
        from_attributes = True


class ExamResultCreate(BaseModel):
    exam_id: int
    student_id: int
    score: float
    grade: str


class ExamResultOut(BaseModel):
    id: int
    exam_id: int
    student_id: int
    score: float
    grade: str
    published: bool

    class Config:
        from_attributes = True


# ── Message ──────────────────────────────────────────────
class MessageCreate(BaseModel):
    recipient_id: int
    subject: Optional[str]
    body: str


class MessageOut(BaseModel):
    id: int
    sender_id: int
    recipient_id: int
    subject: Optional[str]
    body: str
    sent_at: datetime
    read_at: Optional[datetime]

    class Config:
        from_attributes = True


# ── Announcement ─────────────────────────────────────────
class AnnouncementCreate(BaseModel):
    class_id: Optional[int]
    title: str
    body: str


class AnnouncementOut(BaseModel):
    id: int
    class_id: Optional[int]
    created_by: int
    title: str
    body: str
    created_at: datetime

    class Config:
        from_attributes = True


# ── Dashboard / Analytics ────────────────────────────────
class DashboardStats(BaseModel):
    total_students: int
    classes_this_week: int
    pending_assignments: int
    attendance_rate: float
