from sqlalchemy import (
    Column, Integer, String, Text, Float,
    DateTime, Date, Time, Boolean, ForeignKey, Enum, Index
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
from app.database import Base


class RoleEnum(str, enum.Enum):
    admin = "admin"
    lecturer = "lecturer"
    student = "student"


class StatusEnum(str, enum.Enum):
    present = "present"
    absent = "absent"
    late = "late"
    partial = "partial"


class LiveSessionStatusEnum(str, enum.Enum):
    active = "active"
    ended = "ended"


class SubmissionStatusEnum(str, enum.Enum):
    pending = "pending"
    submitted = "submitted"
    graded = "graded"
    overdue = "overdue"


class LectureStatusEnum(str, enum.Enum):
    scheduled = "scheduled"
    live = "live"
    ended = "ended"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    email = Column(String(150), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    role = Column(Enum(RoleEnum), default=RoleEnum.student, nullable=False)
    matric_number = Column(String(50), unique=True)   # students only, e.g. "LASU/19/CS/001"
    staff_number = Column(String(50), unique=True)    # lecturers only, e.g. "LASU/STAFF/042"
    department = Column(String(100))
    level = Column(String(20))                        # students only, e.g. "100L"
    is_active = Column(Boolean, default=True)
    is_verified = Column(Boolean, default=False)   # email must be confirmed before login
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    enrollments = relationship("Enrollment", back_populates="student", foreign_keys="Enrollment.student_id")
    classes_taught = relationship("Class", back_populates="lecturer")
    submissions = relationship("Submission", back_populates="student")
    attendance_records = relationship("Attendance", back_populates="student")
    sent_messages = relationship("Message", back_populates="sender", foreign_keys="Message.sender_id")
    received_messages = relationship("Message", back_populates="recipient", foreign_keys="Message.recipient_id")


class Class(Base):
    __tablename__ = "classes"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(50), nullable=False)           # e.g. "CSC 301 - Group A"
    subject = Column(String(100), nullable=False)       # e.g. "Data Structures"
    course_code = Column(String(20))                    # e.g. "CSC301"
    department = Column(String(100))                    # e.g. "Computer Science"
    level = Column(String(20))                          # e.g. "100L", "200L", "300L"
    lecturer_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    academic_year = Column(String(20), nullable=False)  # e.g. "2024/2025"
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    lecturer = relationship("User", back_populates="classes_taught")
    enrollments = relationship("Enrollment", back_populates="class_")
    assignments = relationship("Assignment", back_populates="class_")
    attendance_records = relationship("Attendance", back_populates="class_")
    schedules = relationship("Schedule", back_populates="class_")
    exams = relationship("Exam", back_populates="class_")
    announcements = relationship("Announcement", back_populates="class_")
    lectures = relationship("Lecture", back_populates="class_")


class Enrollment(Base):
    __tablename__ = "enrollments"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    class_id = Column(Integer, ForeignKey("classes.id"), nullable=False, index=True)
    roll_number = Column(Integer, nullable=False)
    grade = Column(String(5))               # e.g. "A", "B+"
    enrolled_at = Column(DateTime(timezone=True), server_default=func.now())

    student = relationship("User", back_populates="enrollments", foreign_keys=[student_id])
    class_ = relationship("Class", back_populates="enrollments")

    __table_args__ = (
        Index("ix_enrollment_student_class", "student_id", "class_id", unique=True),
    )


class Lecture(Base):
    __tablename__ = "lectures"

    id = Column(Integer, primary_key=True, index=True)
    class_id = Column(Integer, ForeignKey("classes.id"), nullable=False, index=True)
    title = Column(String(200), nullable=False)
    description = Column(Text)
    scheduled_at = Column(DateTime(timezone=True))
    started_at = Column(DateTime(timezone=True))
    ended_at = Column(DateTime(timezone=True))
    status = Column(Enum(LectureStatusEnum), default=LectureStatusEnum.scheduled)
    room_link = Column(String(500))
    jitsi_room = Column(String(200))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    class_ = relationship("Class", back_populates="lectures")


class Assignment(Base):
    __tablename__ = "assignments"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(200), nullable=False)
    description = Column(Text)
    class_id = Column(Integer, ForeignKey("classes.id"), nullable=False, index=True)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    due_date = Column(DateTime(timezone=True), nullable=False)
    submission_type = Column(String(50), default="any")  # google_drive | pdf | word_doc | image | any
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    class_ = relationship("Class", back_populates="assignments")
    creator = relationship("User")
    submissions = relationship("Submission", back_populates="assignment")


class Submission(Base):
    __tablename__ = "submissions"

    id = Column(Integer, primary_key=True, index=True)
    assignment_id = Column(Integer, ForeignKey("assignments.id"), nullable=False, index=True)
    student_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    submitted_at = Column(DateTime(timezone=True))
    status = Column(Enum(SubmissionStatusEnum), default=SubmissionStatusEnum.pending)
    file_url = Column(String(500))
    score = Column(Float)
    feedback = Column(Text)

    assignment = relationship("Assignment", back_populates="submissions")
    student = relationship("User", back_populates="submissions")


class Attendance(Base):
    __tablename__ = "attendance"

    id = Column(Integer, primary_key=True, index=True)
    class_id = Column(Integer, ForeignKey("classes.id"), nullable=False, index=True)
    student_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    date = Column(Date, nullable=False, index=True)
    status = Column(Enum(StatusEnum), default=StatusEnum.present)
    marked_at = Column(DateTime(timezone=True), server_default=func.now())
    # Live-session / lecture fields — NULL for manually marked records
    session_id = Column(Integer, ForeignKey("live_sessions.id"), nullable=True)
    score = Column(Float, nullable=True)
    lecture_id = Column(Integer, nullable=True)   # links to lectures.id (no FK to allow ALTER TABLE)

    class_ = relationship("Class", back_populates="attendance_records")
    student = relationship("User", back_populates="attendance_records")

    __table_args__ = (
        Index("ix_attendance_class_date", "class_id", "date"),
        Index("ix_attendance_student_date", "student_id", "date"),
    )


class Schedule(Base):
    __tablename__ = "schedules"

    id = Column(Integer, primary_key=True, index=True)
    class_id = Column(Integer, ForeignKey("classes.id"), nullable=False, index=True)
    day_of_week = Column(String(10), nullable=False)  # "Monday", "Tuesday"...
    start_time = Column(Time, nullable=False)
    end_time = Column(Time, nullable=False)
    room = Column(String(50))
    is_locked = Column(Boolean, default=False)  # locked slots cannot be deleted without unlocking first
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    class_ = relationship("Class", back_populates="schedules")


class Exam(Base):
    __tablename__ = "exams"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(200), nullable=False)
    class_id = Column(Integer, ForeignKey("classes.id"), nullable=False)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    exam_date = Column(DateTime(timezone=True), nullable=False)
    total_marks = Column(Float, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    class_ = relationship("Class", back_populates="exams")
    creator = relationship("User")
    results = relationship("ExamResult", back_populates="exam")


class ExamResult(Base):
    __tablename__ = "exam_results"

    id = Column(Integer, primary_key=True, index=True)
    exam_id = Column(Integer, ForeignKey("exams.id"), nullable=False)
    student_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    score = Column(Float)
    grade = Column(String(5))
    published = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    exam = relationship("Exam", back_populates="results")
    student = relationship("User")


class Message(Base):
    __tablename__ = "messages"

    id = Column(Integer, primary_key=True, index=True)
    sender_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    recipient_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    subject = Column(String(200))
    body = Column(Text, nullable=False)
    sent_at = Column(DateTime(timezone=True), server_default=func.now())
    read_at = Column(DateTime(timezone=True))
    is_pinned = Column(Boolean, default=False)
    forwarded_from_id = Column(Integer, ForeignKey("messages.id"), nullable=True)
    attachment_path = Column(String(500), nullable=True)
    attachment_name = Column(String(300), nullable=True)
    attachment_type = Column(String(100), nullable=True)
    attachment_size = Column(Integer, nullable=True)

    sender = relationship("User", back_populates="sent_messages", foreign_keys=[sender_id])
    recipient = relationship("User", back_populates="received_messages", foreign_keys=[recipient_id])
    reactions = relationship("MessageReaction", back_populates="message", cascade="all, delete-orphan")


class MessageReaction(Base):
    __tablename__ = "message_reactions"

    id = Column(Integer, primary_key=True, index=True)
    message_id = Column(Integer, ForeignKey("messages.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    emoji = Column(String(10), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    message = relationship("Message", back_populates="reactions")
    user = relationship("User")


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    type = Column(String(30), nullable=False)   # "message","assignment","exam_result","announcement"
    title = Column(String(200), nullable=False)
    body = Column(Text)
    link = Column(String(200))                  # frontend route to navigate to on click
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User")


class Announcement(Base):
    __tablename__ = "announcements"

    id = Column(Integer, primary_key=True, index=True)
    class_id = Column(Integer, ForeignKey("classes.id"), nullable=True)  # null = school-wide
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    title = Column(String(200), nullable=False)
    body = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    class_ = relationship("Class", back_populates="announcements")
    creator = relationship("User")


# ── Live Session Attendance (cookie check-in) ─────────────────────────────────

class LiveSession(Base):
    __tablename__ = "live_sessions"

    id = Column(Integer, primary_key=True, index=True)
    class_id = Column(Integer, ForeignKey("classes.id"), nullable=False)
    lecturer_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    lecture_id = Column(Integer, nullable=True)   # links to lectures.id
    started_at = Column(DateTime(timezone=True), server_default=func.now())
    ended_at = Column(DateTime(timezone=True))
    status = Column(Enum(LiveSessionStatusEnum), default=LiveSessionStatusEnum.active, nullable=False)
    total_cookies_sent = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    class_ = relationship("Class")
    lecturer = relationship("User", foreign_keys=[lecturer_id])
    cookies = relationship("AttendanceCookie", back_populates="session")


class AttendanceCookie(Base):
    __tablename__ = "attendance_cookies"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("live_sessions.id"), nullable=False)
    sent_at = Column(DateTime(timezone=True))
    expires_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    session = relationship("LiveSession", back_populates="cookies")
    responses = relationship("CookieResponse", back_populates="cookie")


class CookieResponse(Base):
    __tablename__ = "cookie_responses"

    id = Column(Integer, primary_key=True, index=True)
    cookie_id = Column(Integer, ForeignKey("attendance_cookies.id"), nullable=False)
    student_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    clicked_at = Column(DateTime(timezone=True), server_default=func.now())
    is_valid = Column(Boolean, default=False)

    cookie = relationship("AttendanceCookie", back_populates="responses")
    student = relationship("User")


# ── Email Verification ────────────────────────────────────────────────────────

class EmailVerification(Base):
    __tablename__ = "email_verifications"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(200), nullable=False, index=True)
    code = Column(String(6), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    expires_at = Column(DateTime(timezone=True), nullable=False)
    is_used = Column(Boolean, default=False)


# ── Password Reset ────────────────────────────────────────────────────────────

class PasswordResetCode(Base):
    __tablename__ = "password_reset_codes"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(200), nullable=False, index=True)
    code = Column(String(6), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    expires_at = Column(DateTime(timezone=True), nullable=False)
    is_used = Column(Boolean, default=False)


# ── Quiz / Test System ────────────────────────────────────────────────────────

class Quiz(Base):
    __tablename__ = "quizzes"

    id = Column(Integer, primary_key=True, index=True)
    class_id = Column(Integer, ForeignKey("classes.id"), nullable=False)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    title = Column(String(200), nullable=False)
    description = Column(Text)
    duration_minutes = Column(Integer, nullable=False, default=30)
    available_from = Column(DateTime(timezone=True))
    available_until = Column(DateTime(timezone=True))
    is_published = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    class_ = relationship("Class")
    creator = relationship("User")
    questions = relationship("QuizQuestion", back_populates="quiz",
                             order_by="QuizQuestion.order_index", cascade="all, delete-orphan")
    attempts = relationship("QuizAttempt", back_populates="quiz", cascade="all, delete-orphan")


class QuizQuestion(Base):
    __tablename__ = "quiz_questions"

    id = Column(Integer, primary_key=True, index=True)
    quiz_id = Column(Integer, ForeignKey("quizzes.id"), nullable=False)
    text = Column(Text, nullable=False)
    option_a = Column(String(500), nullable=False)
    option_b = Column(String(500), nullable=False)
    option_c = Column(String(500))
    option_d = Column(String(500))
    correct_option = Column(String(1), nullable=False)   # "a" | "b" | "c" | "d"
    order_index = Column(Integer, default=0)

    quiz = relationship("Quiz", back_populates="questions")


class QuizAttempt(Base):
    __tablename__ = "quiz_attempts"

    id = Column(Integer, primary_key=True, index=True)
    quiz_id = Column(Integer, ForeignKey("quizzes.id"), nullable=False)
    student_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    started_at = Column(DateTime(timezone=True), server_default=func.now())
    submitted_at = Column(DateTime(timezone=True))
    answers = Column(Text)          # JSON: {"<question_id>": "a"|"b"|"c"|"d", ...}
    score = Column(Integer)         # number of correct answers
    total = Column(Integer)         # total questions at submission time

    quiz = relationship("Quiz", back_populates="attempts")
    student = relationship("User")


class CourseMaterial(Base):
    __tablename__ = "course_materials"

    id = Column(Integer, primary_key=True, index=True)
    class_id = Column(Integer, ForeignKey("classes.id"), nullable=False)
    uploaded_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    title = Column(String(200), nullable=False)
    description = Column(Text)
    original_filename = Column(String(300), nullable=False)
    stored_filename = Column(String(300), nullable=False)   # UUID-prefixed name on disk
    file_type = Column(String(100))                         # MIME type
    file_size = Column(Integer)                             # bytes
    uploaded_at = Column(DateTime(timezone=True), server_default=func.now())

    class_ = relationship("Class")
    uploader = relationship("User")


class TutorApplicationStatusEnum(str, enum.Enum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"


class TutorApplication(Base):
    __tablename__ = "tutor_applications"

    id = Column(Integer, primary_key=True, index=True)
    class_id = Column(Integer, ForeignKey("classes.id"), nullable=False)
    student_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    motivation = Column(Text, nullable=False)
    status = Column(
        Enum(TutorApplicationStatusEnum),
        default=TutorApplicationStatusEnum.pending,
        nullable=False,
    )
    applied_at = Column(DateTime(timezone=True), server_default=func.now())

    class_ = relationship("Class")
    student = relationship("User")


class HubBroadcast(Base):
    __tablename__ = "hub_broadcasts"

    id = Column(Integer, primary_key=True, index=True)
    class_id = Column(Integer, ForeignKey("classes.id"), nullable=False)
    tutor_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    message = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    class_ = relationship("Class")
    tutor = relationship("User")


class WeeklyDigestLog(Base):
    """Tracks when the weekly timetable digest was last sent so we don't double-send."""
    __tablename__ = "weekly_digest_log"

    id = Column(Integer, primary_key=True, index=True)
    week_start = Column(Date, nullable=False, unique=True)  # Monday of that week
    sent_at = Column(DateTime(timezone=True), server_default=func.now())
    recipient_count = Column(Integer, default=0)


class HubLiveSession(Base):
    __tablename__ = "hub_live_sessions"

    id = Column(Integer, primary_key=True, index=True)
    class_id = Column(Integer, ForeignKey("classes.id"), nullable=False)
    tutor_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    title = Column(String(200), nullable=False)
    jitsi_room = Column(String(200))
    status = Column(String(20), default="active")   # active | ended
    started_at = Column(DateTime(timezone=True), server_default=func.now())
    ended_at = Column(DateTime(timezone=True))

    class_ = relationship("Class")
    tutor = relationship("User")
