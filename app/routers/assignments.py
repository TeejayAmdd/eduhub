from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime
from app.database import get_db
from app.schemas import AssignmentCreate, AssignmentOut, SubmissionCreate, SubmissionUpdate, SubmissionOut
import app.models as models

router = APIRouter(prefix="/api/assignments", tags=["Assignments"])


@router.get("/", response_model=List[AssignmentOut])
def list_assignments(class_id: int = None, db: Session = Depends(get_db)):
    query = db.query(models.Assignment)
    if class_id:
        query = query.filter(models.Assignment.class_id == class_id)
    assignments = query.all()

    result = []
    for a in assignments:
        total = db.query(models.Submission).filter(models.Submission.assignment_id == a.id).count()
        pending = db.query(models.Submission).filter(
            models.Submission.assignment_id == a.id,
            models.Submission.status == models.SubmissionStatusEnum.pending
        ).count()
        overdue = db.query(models.Submission).filter(
            models.Submission.assignment_id == a.id,
            models.Submission.status == models.SubmissionStatusEnum.overdue
        ).count()

        result.append(AssignmentOut(
            id=a.id, title=a.title, description=a.description,
            class_id=a.class_id, due_date=a.due_date, created_at=a.created_at,
            total_submissions=total, pending_count=pending, overdue_count=overdue
        ))
    return result


@router.post("/", response_model=AssignmentOut, status_code=201)
def create_assignment(payload: AssignmentCreate, db: Session = Depends(get_db)):
    assignment = models.Assignment(**payload.model_dump(), created_by=1)  # replace 1 with current_user.id when auth is added
    db.add(assignment)
    db.commit()
    db.refresh(assignment)
    return AssignmentOut(**assignment.__dict__, total_submissions=0, pending_count=0, overdue_count=0)


@router.get("/{assignment_id}", response_model=AssignmentOut)
def get_assignment(assignment_id: int, db: Session = Depends(get_db)):
    assignment = db.query(models.Assignment).filter(models.Assignment.id == assignment_id).first()
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")
    return assignment


@router.delete("/{assignment_id}", status_code=204)
def delete_assignment(assignment_id: int, db: Session = Depends(get_db)):
    assignment = db.query(models.Assignment).filter(models.Assignment.id == assignment_id).first()
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")
    db.delete(assignment)
    db.commit()


# Submissions
@router.post("/{assignment_id}/submit", response_model=SubmissionOut, status_code=201)
def submit_assignment(assignment_id: int, payload: SubmissionCreate, db: Session = Depends(get_db)):
    existing = db.query(models.Submission).filter(
        models.Submission.assignment_id == assignment_id,
        models.Submission.student_id == payload.student_id if hasattr(payload, 'student_id') else True
    ).first()

    submission = models.Submission(
        assignment_id=assignment_id,
        student_id=1,  # replace with current_user.id when auth is added
        file_url=payload.file_url,
        submitted_at=datetime.utcnow(),
        status=models.SubmissionStatusEnum.submitted
    )
    db.add(submission)
    db.commit()
    db.refresh(submission)
    return submission


@router.patch("/submissions/{submission_id}", response_model=SubmissionOut)
def update_submission(submission_id: int, payload: SubmissionUpdate, db: Session = Depends(get_db)):
    submission = db.query(models.Submission).filter(models.Submission.id == submission_id).first()
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(submission, field, value)
    db.commit()
    db.refresh(submission)
    return submission


@router.get("/{assignment_id}/submissions", response_model=List[SubmissionOut])
def get_submissions(assignment_id: int, db: Session = Depends(get_db)):
    return db.query(models.Submission).filter(
        models.Submission.assignment_id == assignment_id
    ).all()
