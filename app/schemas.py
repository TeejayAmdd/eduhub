import re
from pydantic import BaseModel, EmailStr, field_validator
from typing import Optional, List
from datetime import datetime, date, time
from app.models import RoleEnum, StatusEnum, SubmissionStatusEnum, LectureStatusEnum, TutorApplicationStatusEnum


# Control / non-printable characters (keeps \t \n \r) — stripped from all input strings
_CONTROL_RE = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")
MAX_INPUT_CHARS = 50_000


class SanitizedModel(BaseModel):
    """Base for inbound payloads. Strips null/control bytes, trims whitespace and caps
    string length on EVERY field. SQL injection is prevented by the ORM (parameterised
    queries); stored XSS is prevented by React escaping all rendered output."""

    @field_validator("*", mode="before")
    @classmethod
    def _sanitize_strings(cls, v):
        if isinstance(v, str):
            v = _CONTROL_RE.sub("", v).strip()
            if len(v) > MAX_INPUT_CHARS:
                v = v[:MAX_INPUT_CHARS]
        return v


# ── User ────────────────────────────────────────────────
class UserCreate(SanitizedModel):
    name: str
    email: EmailStr
    password: str
    role: RoleEnum = RoleEnum.student
    matric_number: Optional[str] = None   # required for students
    staff_number: Optional[str] = None    # required for lecturers
    department: Optional[str] = None
    level: Optional[str] = None


class UserOut(BaseModel):
    id: int
    name: str
    email: str
    role: RoleEnum
    matric_number: Optional[str] = None
    staff_number: Optional[str] = None
    department: Optional[str] = None
    level: Optional[str] = None
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class LoginRequest(SanitizedModel):
    identifier: str   # matric number, staff number, or email
    password: str


class ProfileUpdate(SanitizedModel):
    name: Optional[str] = None
    department: Optional[str] = None
    level: Optional[str] = None           # students only


class PasswordChange(SanitizedModel):
    current_password: str
    new_password: str


# ── Class ────────────────────────────────────────────────
class ClassCreate(SanitizedModel):
    name: str
    subject: str
    course_code: Optional[str] = None
    department: Optional[str] = None
    level: str                           # required: "100L", "200L", etc.
    academic_year: str


class ClassOut(BaseModel):
    id: int
    name: str
    subject: str
    course_code: Optional[str] = None
    department: Optional[str] = None
    level: Optional[str] = None
    academic_year: str
    lecturer_id: int

    class Config:
        from_attributes = True


class ClassAvailableOut(BaseModel):
    id: int
    name: str
    subject: str
    course_code: Optional[str] = None
    department: Optional[str] = None
    level: Optional[str] = None
    academic_year: str
    lecturer_id: int
    lecturer_name: str
    is_enrolled: bool

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
    matric_number: Optional[str] = None
    department: Optional[str] = None
    level: Optional[str] = None
    roll_number: int
    grade: Optional[str]
    attendance_rate: Optional[float] = None

    class Config:
        from_attributes = True


class StudentCourseDetail(BaseModel):
    class_id: int
    class_name: str
    course_code: Optional[str] = None
    level: Optional[str] = None
    academic_year: str
    roll_number: int
    grade: Optional[str] = None
    enrolled_at: datetime
    # Attendance
    att_total: int
    att_present: int
    att_late: int
    att_absent: int
    attendance_rate: Optional[float] = None
    # Assignments
    assignments_total: int
    assignments_submitted: int
    assignments_graded: int
    assignment_avg_score: Optional[float] = None
    # Quizzes
    quizzes_total: int
    quizzes_attempted: int
    quiz_avg_score: Optional[float] = None


class StudentDetailOut(BaseModel):
    id: int
    name: str
    email: str
    matric_number: Optional[str] = None
    department: Optional[str] = None
    level: Optional[str] = None
    is_active: bool
    created_at: datetime
    courses: List[StudentCourseDetail]


# ── Assignment ───────────────────────────────────────────
class AssignmentCreate(SanitizedModel):
    title: str
    description: Optional[str] = None
    class_id: int
    due_date: datetime
    submission_type: Optional[str] = "any"


class ExtendDeadline(BaseModel):
    new_due_date: datetime


class AssignmentOut(BaseModel):
    id: int
    title: str
    description: Optional[str]
    class_id: int
    class_name: Optional[str] = None
    due_date: datetime
    created_at: datetime
    submission_type: Optional[str] = "any"
    total_submissions: Optional[int] = 0
    pending_count: Optional[int] = 0
    overdue_count: Optional[int] = 0
    submitted: Optional[bool] = None  # None = not applicable (lecturer view)

    class Config:
        from_attributes = True


# ── Submission ───────────────────────────────────────────
class SubmissionCreate(SanitizedModel):
    assignment_id: int
    file_url: Optional[str] = None


class SubmissionUpdate(BaseModel):
    status: Optional[SubmissionStatusEnum] = None
    score: Optional[float] = None
    feedback: Optional[str] = None


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


class RosterEntry(BaseModel):
    student_id: int
    student_name: str
    matric_number: Optional[str]
    submitted: bool
    submitted_at: Optional[datetime] = None
    file_url: Optional[str] = None
    score: Optional[float] = None
    feedback: Optional[str] = None
    submission_id: Optional[int] = None
    status: Optional[str] = None


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
class ScheduleCreate(SanitizedModel):
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
    is_locked: bool = False

    class Config:
        from_attributes = True


class ScheduleSlot(BaseModel):
    day_of_week: str
    start_time: time
    end_time: time
    room: Optional[str] = None


class ScheduleBulkCreate(BaseModel):
    class_id: int
    slots: List[ScheduleSlot]


class ScheduleWithClassOut(BaseModel):
    id: int
    class_id: int
    class_name: str
    course_code: Optional[str] = None
    day_of_week: str
    start_time: time
    end_time: time
    room: Optional[str] = None
    lecturer_name: Optional[str] = None
    has_conflict: bool = False
    is_locked: bool = False

    class Config:
        from_attributes = True


# ── Exam ─────────────────────────────────────────────────
class ExamCreate(SanitizedModel):
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


class ExamResultCreate(SanitizedModel):
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
class MessageCreate(SanitizedModel):
    recipient_id: int
    subject: Optional[str] = None
    body: str


class MessageReactionOut(BaseModel):
    id: int
    message_id: int
    user_id: int
    emoji: str
    created_at: datetime

    class Config:
        from_attributes = True


class MessageOut(BaseModel):
    id: int
    sender_id: int
    recipient_id: int
    subject: Optional[str]
    body: str
    sent_at: datetime
    read_at: Optional[datetime]
    is_pinned: bool = False
    forwarded_from_id: Optional[int] = None
    attachment_path: Optional[str] = None
    attachment_name: Optional[str] = None
    attachment_type: Optional[str] = None
    attachment_size: Optional[int] = None
    reactions: List[MessageReactionOut] = []

    class Config:
        from_attributes = True


class MessageThreadOut(BaseModel):
    contact_id: int
    contact_name: str
    contact_email: str
    contact_role: str
    matric_number: Optional[str] = None
    staff_number: Optional[str] = None
    department: Optional[str] = None
    last_message_body: Optional[str] = None
    last_message_at: Optional[datetime] = None
    last_message_sender_id: Optional[int] = None
    unread_count: int = 0


# ── Announcement ─────────────────────────────────────────
class AnnouncementCreate(SanitizedModel):
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


# ── Notification ─────────────────────────────────────────
class NotificationOut(BaseModel):
    id: int
    type: str
    title: str
    body: Optional[str] = None
    link: Optional[str] = None
    is_read: bool
    created_at: datetime

    class Config:
        from_attributes = True


# ── Dashboard / Analytics ────────────────────────────────
class DashboardStats(BaseModel):
    total_students: int
    classes_this_week: int
    pending_assignments: int
    attendance_rate: float


# ── Lecture ───────────────────────────────────────────────
class InstantLectureCreate(SanitizedModel):
    class_id: int
    title: str
    description: str


class LectureCreate(SanitizedModel):
    class_id: int
    title: str
    description: Optional[str] = None
    scheduled_at: datetime


class LectureOut(BaseModel):
    id: int
    class_id: int
    title: str
    description: Optional[str] = None
    scheduled_at: Optional[datetime] = None
    started_at: Optional[datetime] = None
    ended_at: Optional[datetime] = None
    status: LectureStatusEnum
    room_link: Optional[str] = None
    jitsi_room: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class ClassStatsOut(BaseModel):
    enrolled_count: int
    assignment_count: int
    live_lecture: Optional[LectureOut] = None
    next_lecture: Optional[LectureOut] = None


# ── Live Session ──────────────────────────────────────────
class SessionStartRequest(SanitizedModel):
    class_id: int


class SessionResponse(BaseModel):
    id: int
    class_id: int
    lecturer_id: int
    status: str
    started_at: datetime
    ended_at: Optional[datetime] = None
    total_cookies_sent: int

    class Config:
        from_attributes = True


class CookieOut(BaseModel):
    id: int
    session_id: int
    sent_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ClickRequest(BaseModel):
    # student_id is resolved from the JWT token; this body is intentionally empty
    pass


class AttendanceResult(BaseModel):
    student_id: int
    name: str
    cookies_clicked: int
    total_cookies: int
    score: float
    status: str


class SessionAttendanceSummary(BaseModel):
    class_id: int
    total_sessions: int
    students: List[AttendanceResult]


# ── Lecture History ───────────────────────────────────────
class LectureHistoryOut(BaseModel):
    id: int
    class_id: int
    title: str
    description: Optional[str] = None
    started_at: Optional[datetime] = None
    ended_at: Optional[datetime] = None
    duration_str: Optional[str] = None   # e.g. "1h 15m" or "45 min"
    attended_count: int                  # students who joined
    total_enrolled: int                  # total enrolled in class
    student_attended: Optional[bool] = None  # None for lecturer view


# ── Quiz / Test ───────────────────────────────────────────
class QuizCreate(SanitizedModel):
    class_id: int
    title: str
    description: Optional[str] = None
    duration_minutes: int = 30
    available_from: Optional[datetime] = None
    available_until: Optional[datetime] = None


class QuizUpdate(SanitizedModel):
    title: Optional[str] = None
    description: Optional[str] = None
    duration_minutes: Optional[int] = None
    available_from: Optional[datetime] = None
    available_until: Optional[datetime] = None
    is_published: Optional[bool] = None


class QuizQuestionCreate(SanitizedModel):
    text: str
    option_a: str
    option_b: str
    option_c: Optional[str] = None
    option_d: Optional[str] = None
    correct_option: str          # "a" | "b" | "c" | "d"
    order_index: Optional[int] = 0


class QuizQuestionOut(BaseModel):
    id: int
    quiz_id: int
    text: str
    option_a: str
    option_b: str
    option_c: Optional[str] = None
    option_d: Optional[str] = None
    order_index: int
    correct_option: Optional[str] = None   # only sent to lecturers

    class Config:
        from_attributes = True


class QuizOut(BaseModel):
    id: int
    class_id: int
    created_by: int
    title: str
    description: Optional[str] = None
    duration_minutes: int
    available_from: Optional[datetime] = None
    available_until: Optional[datetime] = None
    is_published: bool
    created_at: datetime
    question_count: int = 0
    attempt_count: int = 0           # lecturer: total attempts; student: 1 if submitted, 0 if not
    my_score: Optional[int] = None   # student: their score (None if not attempted)
    my_total: Optional[int] = None   # student: total questions at submission
    is_locked: bool = False          # published AND a student has started: question set is frozen

    class Config:
        from_attributes = True


class QuizSubmit(BaseModel):
    answers: dict   # {"<question_id>": "a"|"b"|"c"|"d", ...}


class QuizAttemptOut(BaseModel):
    id: int
    quiz_id: int
    student_id: int
    started_at: datetime
    submitted_at: Optional[datetime] = None
    score: Optional[int] = None
    total: Optional[int] = None
    answers: Optional[str] = None   # raw JSON string

    class Config:
        from_attributes = True


class QuizResultDetail(BaseModel):
    student_id: int
    student_name: str
    matric_number: Optional[str] = None
    score: Optional[int] = None
    total: Optional[int] = None
    percentage: Optional[float] = None
    submitted_at: Optional[datetime] = None


# ── Course Materials ──────────────────────────────────────
class CourseMaterialOut(BaseModel):
    id: int
    class_id: int
    uploaded_by: int
    uploader_name: str
    title: str
    description: Optional[str] = None
    original_filename: str
    file_type: Optional[str] = None
    file_size: Optional[int] = None
    uploaded_at: datetime

    class Config:
        from_attributes = True


# ── Study Hub ─────────────────────────────────────────────
class TutorApplyRequest(SanitizedModel):
    motivation: str


class TutorApplicationOut(BaseModel):
    id: int
    class_id: int
    student_id: int
    student_name: str
    matric_number: Optional[str] = None
    motivation: str
    status: TutorApplicationStatusEnum
    applied_at: datetime

    class Config:
        from_attributes = True


class SelectTutorsRequest(BaseModel):
    student_ids: List[int]   # exactly 2


class HubBroadcastCreate(SanitizedModel):
    message: str


class HubBroadcastOut(BaseModel):
    id: int
    class_id: int
    tutor_id: int
    tutor_name: str
    message: str
    created_at: datetime

    class Config:
        from_attributes = True


class HubLiveSessionCreate(SanitizedModel):
    title: str


class HubLiveSessionOut(BaseModel):
    id: int
    class_id: int
    tutor_id: int
    tutor_name: str
    title: str
    jitsi_room: Optional[str] = None
    status: str
    started_at: datetime
    ended_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class TutorInfo(BaseModel):
    student_id: int
    name: str
    matric_number: Optional[str] = None


class HubInfoOut(BaseModel):
    class_id: int
    class_name: str
    course_code: Optional[str] = None
    member_count: int
    tutors: List[TutorInfo]
    my_application_status: Optional[TutorApplicationStatusEnum] = None
    i_am_tutor: bool
    broadcasts: List[HubBroadcastOut]
    active_live_session: Optional[HubLiveSessionOut] = None
