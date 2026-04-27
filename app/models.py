from sqlalchemy import (
    Column, Integer, String, Text, Float,
    DateTime, Date, Time, Boolean, ForeignKey, Enum
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


class SubmissionStatusEnum(str, enum.Enum):
    pending = "pending"
    submitted = "submitted"
    graded = "graded"
    overdue = "overdue"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    email = Column(String(150), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    role = Column(Enum(RoleEnum), default=RoleEnum.student, nullable=False)
    is_active = Column(Boolean, default=True)
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
    name = Column(String(50), nullable=False)        # e.g. "10-A"
    subject = Column(String(100), nullable=False)    # e.g. "English"
    lecturer_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    academic_year = Column(String(20), nullable=False)  # e.g. "2024/2025"
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    lecturer = relationship("User", back_populates="classes_taught")
    enrollments = relationship("Enrollment", back_populates="class_")
    assignments = relationship("Assignment", back_populates="class_")
    attendance_records = relationship("Attendance", back_populates="class_")
    schedules = relationship("Schedule", back_populates="class_")
    exams = relationship("Exam", back_populates="class_")
    announcements = relationship("Announcement", back_populates="class_")


class Enrollment(Base):
    __tablename__ = "enrollments"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    class_id = Column(Integer, ForeignKey("classes.id"), nullable=False)
    roll_number = Column(Integer, nullable=False)
    grade = Column(String(5))               # e.g. "A", "B+"
    enrolled_at = Column(DateTime(timezone=True), server_default=func.now())

    student = relationship("User", back_populates="enrollments", foreign_keys=[student_id])
    class_ = relationship("Class", back_populates="enrollments")


class Assignment(Base):
    __tablename__ = "assignments"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(200), nullable=False)
    description = Column(Text)
    class_id = Column(Integer, ForeignKey("classes.id"), nullable=False)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    due_date = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    class_ = relationship("Class", back_populates="assignments")
    creator = relationship("User")
    submissions = relationship("Submission", back_populates="assignment")


class Submission(Base):
    __tablename__ = "submissions"

    id = Column(Integer, primary_key=True, index=True)
    assignment_id = Column(Integer, ForeignKey("assignments.id"), nullable=False)
    student_id = Column(Integer, ForeignKey("users.id"), nullable=False)
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
    class_id = Column(Integer, ForeignKey("classes.id"), nullable=False)
    student_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    date = Column(Date, nullable=False)
    status = Column(Enum(StatusEnum), default=StatusEnum.present)
    marked_at = Column(DateTime(timezone=True), server_default=func.now())

    class_ = relationship("Class", back_populates="attendance_records")
    student = relationship("User", back_populates="attendance_records")


class Schedule(Base):
    __tablename__ = "schedules"

    id = Column(Integer, primary_key=True, index=True)
    class_id = Column(Integer, ForeignKey("classes.id"), nullable=False)
    day_of_week = Column(String(10), nullable=False)  # "Monday", "Tuesday"...
    start_time = Column(Time, nullable=False)
    end_time = Column(Time, nullable=False)
    room = Column(String(50))
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
    sender_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    recipient_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    subject = Column(String(200))
    body = Column(Text, nullable=False)
    sent_at = Column(DateTime(timezone=True), server_default=func.now())
    read_at = Column(DateTime(timezone=True))

    sender = relationship("User", back_populates="sent_messages", foreign_keys=[sender_id])
    recipient = relationship("User", back_populates="received_messages", foreign_keys=[recipient_id])


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
