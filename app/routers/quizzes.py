import json
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session

from app.database import get_db
from app.auth import get_current_user, require_lecturer
from app.utils.notifications import push
from app.schemas import (
    QuizCreate, QuizUpdate, QuizOut,
    QuizQuestionCreate, QuizQuestionOut,
    QuizSubmit, QuizAttemptOut, QuizResultDetail,
)
import app.models as models

router = APIRouter(prefix="/api/quizzes", tags=["Quizzes"])


def _now_naive() -> datetime:
    return datetime.utcnow()


def _quiz_out(quiz: models.Quiz, db: Session, student_id: Optional[int] = None) -> QuizOut:
    question_count = len(quiz.questions)
    if student_id is not None:
        attempt = (
            db.query(models.QuizAttempt)
            .filter(
                models.QuizAttempt.quiz_id == quiz.id,
                models.QuizAttempt.student_id == student_id,
                models.QuizAttempt.submitted_at.isnot(None),
            )
            .first()
        )
        attempt_count = 1 if attempt else 0
        my_score = attempt.score if attempt else None
        my_total = attempt.total if attempt else None
    else:
        attempt_count = (
            db.query(models.QuizAttempt)
            .filter(
                models.QuizAttempt.quiz_id == quiz.id,
                models.QuizAttempt.submitted_at.isnot(None),
            )
            .count()
        )
        my_score = None
        my_total = None

    return QuizOut(
        id=quiz.id,
        class_id=quiz.class_id,
        created_by=quiz.created_by,
        title=quiz.title,
        description=quiz.description,
        duration_minutes=quiz.duration_minutes,
        available_from=quiz.available_from,
        available_until=quiz.available_until,
        is_published=quiz.is_published,
        created_at=quiz.created_at,
        question_count=question_count,
        attempt_count=attempt_count,
        my_score=my_score,
        my_total=my_total,
    )


# ── List & Create ─────────────────────────────────────────────────────────────

@router.get("", response_model=List[QuizOut])
def list_quizzes(
    class_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    query = db.query(models.Quiz)

    if current_user.role == models.RoleEnum.lecturer:
        own_ids = [
            r[0] for r in db.query(models.Class.id)
            .filter(models.Class.lecturer_id == current_user.id)
            .all()
        ]
        query = query.filter(models.Quiz.class_id.in_(own_ids))
    elif current_user.role == models.RoleEnum.student:
        enrolled_ids = [
            r[0] for r in db.query(models.Enrollment.class_id)
            .filter(models.Enrollment.student_id == current_user.id)
            .all()
        ]
        query = query.filter(
            models.Quiz.class_id.in_(enrolled_ids),
            models.Quiz.is_published == True,
        )

    if class_id:
        query = query.filter(models.Quiz.class_id == class_id)

    quizzes = query.order_by(models.Quiz.created_at.desc()).all()
    sid = current_user.id if current_user.role == models.RoleEnum.student else None
    return [_quiz_out(q, db, sid) for q in quizzes]


@router.post("", response_model=QuizOut, status_code=201)
def create_quiz(
    payload: QuizCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_lecturer),
):
    class_ = db.query(models.Class).filter(models.Class.id == payload.class_id).first()
    if not class_ or class_.lecturer_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    quiz = models.Quiz(**payload.model_dump(), created_by=current_user.id)
    db.add(quiz)
    db.commit()
    db.refresh(quiz)
    return _quiz_out(quiz, db)


# ── Single Quiz ───────────────────────────────────────────────────────────────

@router.get("/{quiz_id}", response_model=QuizOut)
def get_quiz(
    quiz_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    quiz = db.query(models.Quiz).filter(models.Quiz.id == quiz_id).first()
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")
    sid = current_user.id if current_user.role == models.RoleEnum.student else None
    return _quiz_out(quiz, db, sid)


@router.patch("/{quiz_id}", response_model=QuizOut)
def update_quiz(
    quiz_id: int,
    payload: QuizUpdate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_lecturer),
):
    quiz = db.query(models.Quiz).filter(models.Quiz.id == quiz_id).first()
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")
    class_ = db.query(models.Class).filter(models.Class.id == quiz.class_id).first()
    if not class_ or class_.lecturer_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(quiz, field, value)

    if payload.is_published is True:
        enrollments = db.query(models.Enrollment).filter(models.Enrollment.class_id == quiz.class_id).all()
        student_info = []
        for e in enrollments:
            push(db, e.student_id, type="assignment",
                 title=f"New quiz available: {quiz.title}",
                 body=f"{quiz.duration_minutes} min · {class_.name}",
                 link="/student/quizzes")
            student = db.query(models.User).filter(models.User.id == e.student_id).first()
            if student:
                student_info.append((student.email, student.name))

        def _send_quiz_pub(info, course, title, duration):
            from app.services.email_service import send_quiz_published
            for email, name in info:
                send_quiz_published(email, name, course, title, duration)

        background_tasks.add_task(_send_quiz_pub, student_info, class_.name, quiz.title, quiz.duration_minutes)

    db.commit()
    db.refresh(quiz)
    return _quiz_out(quiz, db)


@router.delete("/{quiz_id}", status_code=204)
def delete_quiz(
    quiz_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_lecturer),
):
    quiz = db.query(models.Quiz).filter(models.Quiz.id == quiz_id).first()
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")
    class_ = db.query(models.Class).filter(models.Class.id == quiz.class_id).first()
    if not class_ or class_.lecturer_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    db.delete(quiz)
    db.commit()


# ── Questions ─────────────────────────────────────────────────────────────────

@router.get("/{quiz_id}/questions", response_model=List[QuizQuestionOut])
def get_questions(
    quiz_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    quiz = db.query(models.Quiz).filter(models.Quiz.id == quiz_id).first()
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")

    questions = (
        db.query(models.QuizQuestion)
        .filter(models.QuizQuestion.quiz_id == quiz_id)
        .order_by(models.QuizQuestion.order_index)
        .all()
    )

    is_lecturer = current_user.role == models.RoleEnum.lecturer
    result = []
    for q in questions:
        result.append(QuizQuestionOut(
            id=q.id,
            quiz_id=q.quiz_id,
            text=q.text,
            option_a=q.option_a,
            option_b=q.option_b,
            option_c=q.option_c,
            option_d=q.option_d,
            order_index=q.order_index,
            correct_option=q.correct_option if is_lecturer else None,
        ))
    return result


@router.post("/{quiz_id}/questions", response_model=QuizQuestionOut, status_code=201)
def add_question(
    quiz_id: int,
    payload: QuizQuestionCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_lecturer),
):
    quiz = db.query(models.Quiz).filter(models.Quiz.id == quiz_id).first()
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")
    class_ = db.query(models.Class).filter(models.Class.id == quiz.class_id).first()
    if not class_ or class_.lecturer_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    if payload.correct_option not in ("a", "b", "c", "d"):
        raise HTTPException(status_code=400, detail="correct_option must be a, b, c, or d")

    # Auto-assign order_index if not specified
    max_order = db.query(models.QuizQuestion).filter(
        models.QuizQuestion.quiz_id == quiz_id
    ).count()
    question = models.QuizQuestion(
        quiz_id=quiz_id,
        text=payload.text,
        option_a=payload.option_a,
        option_b=payload.option_b,
        option_c=payload.option_c,
        option_d=payload.option_d,
        correct_option=payload.correct_option,
        order_index=payload.order_index if payload.order_index else max_order,
    )
    db.add(question)
    db.commit()
    db.refresh(question)
    return QuizQuestionOut(
        id=question.id, quiz_id=question.quiz_id, text=question.text,
        option_a=question.option_a, option_b=question.option_b,
        option_c=question.option_c, option_d=question.option_d,
        order_index=question.order_index, correct_option=question.correct_option,
    )


@router.patch("/{quiz_id}/questions/{question_id}", response_model=QuizQuestionOut)
def update_question(
    quiz_id: int,
    question_id: int,
    payload: QuizQuestionCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_lecturer),
):
    question = db.query(models.QuizQuestion).filter(
        models.QuizQuestion.id == question_id,
        models.QuizQuestion.quiz_id == quiz_id,
    ).first()
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")

    quiz = db.query(models.Quiz).filter(models.Quiz.id == quiz_id).first()
    class_ = db.query(models.Class).filter(models.Class.id == quiz.class_id).first()
    if not class_ or class_.lecturer_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(question, field, value)
    db.commit()
    db.refresh(question)
    return QuizQuestionOut(
        id=question.id, quiz_id=question.quiz_id, text=question.text,
        option_a=question.option_a, option_b=question.option_b,
        option_c=question.option_c, option_d=question.option_d,
        order_index=question.order_index, correct_option=question.correct_option,
    )


@router.delete("/{quiz_id}/questions/{question_id}", status_code=204)
def delete_question(
    quiz_id: int,
    question_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_lecturer),
):
    question = db.query(models.QuizQuestion).filter(
        models.QuizQuestion.id == question_id,
        models.QuizQuestion.quiz_id == quiz_id,
    ).first()
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")

    quiz = db.query(models.Quiz).filter(models.Quiz.id == quiz_id).first()
    class_ = db.query(models.Class).filter(models.Class.id == quiz.class_id).first()
    if not class_ or class_.lecturer_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    db.delete(question)
    db.commit()


# ── Attempt (Student) ─────────────────────────────────────────────────────────

@router.post("/{quiz_id}/start", response_model=QuizAttemptOut, status_code=201)
def start_attempt(
    quiz_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if current_user.role != models.RoleEnum.student:
        raise HTTPException(status_code=403, detail="Students only")

    quiz = db.query(models.Quiz).filter(models.Quiz.id == quiz_id).first()
    if not quiz or not quiz.is_published:
        raise HTTPException(status_code=404, detail="Quiz not found")

    # Check enrollment
    enrolled = db.query(models.Enrollment).filter(
        models.Enrollment.student_id == current_user.id,
        models.Enrollment.class_id == quiz.class_id,
    ).first()
    if not enrolled:
        raise HTTPException(status_code=403, detail="Not enrolled in this class")

    # Only one attempt allowed
    existing = db.query(models.QuizAttempt).filter(
        models.QuizAttempt.quiz_id == quiz_id,
        models.QuizAttempt.student_id == current_user.id,
    ).first()
    if existing:
        return existing

    attempt = models.QuizAttempt(
        quiz_id=quiz_id,
        student_id=current_user.id,
    )
    db.add(attempt)
    db.commit()
    db.refresh(attempt)
    return attempt


@router.post("/{quiz_id}/submit", response_model=QuizAttemptOut)
def submit_attempt(
    quiz_id: int,
    payload: QuizSubmit,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if current_user.role != models.RoleEnum.student:
        raise HTTPException(status_code=403, detail="Students only")

    attempt = db.query(models.QuizAttempt).filter(
        models.QuizAttempt.quiz_id == quiz_id,
        models.QuizAttempt.student_id == current_user.id,
    ).first()
    if not attempt:
        raise HTTPException(status_code=404, detail="No active attempt found — start the quiz first")
    if attempt.submitted_at:
        raise HTTPException(status_code=400, detail="Quiz already submitted")

    questions = (
        db.query(models.QuizQuestion)
        .filter(models.QuizQuestion.quiz_id == quiz_id)
        .all()
    )
    total = len(questions)
    score = sum(
        1 for q in questions
        if str(payload.answers.get(str(q.id), "")).lower() == q.correct_option.lower()
    )

    attempt.submitted_at = _now_naive()
    attempt.answers = json.dumps(payload.answers)
    attempt.score = score
    attempt.total = total

    # Notify the student with their result
    quiz = db.query(models.Quiz).filter(models.Quiz.id == quiz_id).first()
    percentage = round((score / total) * 100) if total > 0 else 0
    push(
        db, current_user.id,
        type="exam_result",
        title=f"Quiz result: {quiz.title if quiz else 'Quiz'}",
        body=f"You scored {score}/{total} ({percentage}%)",
        link="/student/quizzes",
    )

    db.commit()
    db.refresh(attempt)
    return attempt


@router.get("/{quiz_id}/my-result", response_model=QuizAttemptOut)
def my_result(
    quiz_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    attempt = db.query(models.QuizAttempt).filter(
        models.QuizAttempt.quiz_id == quiz_id,
        models.QuizAttempt.student_id == current_user.id,
        models.QuizAttempt.submitted_at.isnot(None),
    ).first()
    if not attempt:
        raise HTTPException(status_code=404, detail="No submitted attempt found")
    return attempt


# ── Results (Lecturer) ────────────────────────────────────────────────────────

@router.get("/{quiz_id}/results", response_model=List[QuizResultDetail])
def get_results(
    quiz_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_lecturer),
):
    quiz = db.query(models.Quiz).filter(models.Quiz.id == quiz_id).first()
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")
    class_ = db.query(models.Class).filter(models.Class.id == quiz.class_id).first()
    if not class_ or class_.lecturer_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    enrollments = (
        db.query(models.Enrollment)
        .filter(models.Enrollment.class_id == quiz.class_id)
        .all()
    )

    attempts_map = {
        a.student_id: a
        for a in db.query(models.QuizAttempt)
        .filter(
            models.QuizAttempt.quiz_id == quiz_id,
            models.QuizAttempt.submitted_at.isnot(None),
        )
        .all()
    }

    results = []
    for e in enrollments:
        student = db.query(models.User).filter(models.User.id == e.student_id).first()
        if not student:
            continue
        attempt = attempts_map.get(e.student_id)
        pct = round((attempt.score / attempt.total) * 100, 1) if attempt and attempt.total else None
        results.append(QuizResultDetail(
            student_id=student.id,
            student_name=student.name,
            matric_number=student.matric_number,
            score=attempt.score if attempt else None,
            total=attempt.total if attempt else None,
            percentage=pct,
            submitted_at=attempt.submitted_at if attempt else None,
        ))

    results.sort(key=lambda r: (r.percentage is None, -(r.percentage or 0)))
    return results
