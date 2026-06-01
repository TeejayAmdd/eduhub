import os
import uuid
from typing import List

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import FileResponse, Response
from sqlalchemy.orm import Session

from app.database import get_db
from app.auth import get_current_user, require_lecturer
from app.schemas import CourseMaterialOut
from app.utils.notifications import push
import app.models as models


def _is_approved_tutor(class_id: int, user_id: int, db: Session) -> bool:
    app = db.query(models.TutorApplication).filter(
        models.TutorApplication.class_id == class_id,
        models.TutorApplication.student_id == user_id,
        models.TutorApplication.status == models.TutorApplicationStatusEnum.approved,
    ).first()
    return app is not None

router = APIRouter(prefix="/api/materials", tags=["Course Materials"])

# Store uploads next to this file's project root
UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "uploads", "materials")
os.makedirs(UPLOAD_DIR, exist_ok=True)


def _out(m: models.CourseMaterial, db: Session) -> CourseMaterialOut:
    uploader = db.query(models.User).filter(models.User.id == m.uploaded_by).first()
    return CourseMaterialOut(
        id=m.id,
        class_id=m.class_id,
        uploaded_by=m.uploaded_by,
        uploader_name=uploader.name if uploader else "Unknown",
        title=m.title,
        description=m.description,
        original_filename=m.original_filename,
        file_type=m.file_type,
        file_size=m.file_size,
        uploaded_at=m.uploaded_at,
    )


# ── Lecturer or approved tutor: upload material ────────────────────────────────
@router.post("/{class_id}/upload", response_model=CourseMaterialOut, status_code=201)
async def upload_material(
    class_id: int,
    title: str = Form(...),
    description: str = Form(""),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    class_ = db.query(models.Class).filter(models.Class.id == class_id).first()
    if not class_:
        raise HTTPException(status_code=404, detail="Class not found")

    is_lecturer = (
        current_user.role == models.RoleEnum.lecturer and class_.lecturer_id == current_user.id
    )
    is_tutor = (
        current_user.role == models.RoleEnum.student and
        _is_approved_tutor(class_id, current_user.id, db)
    )
    if not is_lecturer and not is_tutor:
        raise HTTPException(status_code=403, detail="Access denied")

    # Save file with UUID prefix to avoid name collisions
    ext = os.path.splitext(file.filename or "")[-1]
    stored_name = f"{uuid.uuid4().hex}{ext}"
    dest_path = os.path.join(UPLOAD_DIR, stored_name)

    contents = await file.read()
    # Write to disk (best-effort fallback)
    try:
        with open(dest_path, "wb") as f:
            f.write(contents)
    except Exception:
        pass

    material = models.CourseMaterial(
        class_id=class_id,
        uploaded_by=current_user.id,
        title=title.strip(),
        description=description.strip() or None,
        original_filename=file.filename or stored_name,
        stored_filename=stored_name,
        file_type=file.content_type,
        file_size=len(contents),
        file_data=contents,  # stored in DB — survives Railway redeployments
    )
    db.add(material)
    db.flush()

    # Notify enrolled students
    enrolled = db.query(models.Enrollment).filter(
        models.Enrollment.class_id == class_id
    ).all()
    for e in enrolled:
        push(db, e.student_id, type="announcement",
             title=f"New material: {material.title}",
             body=f"{class_.name}",
             link=f"/student/courses/{class_id}/materials")

    db.commit()
    db.refresh(material)
    return _out(material, db)


# ── List materials for a class ────────────────────────────────────────────────
@router.get("/{class_id}", response_model=List[CourseMaterialOut])
def list_materials(
    class_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    # Students must be enrolled; lecturers must own the class
    if current_user.role == models.RoleEnum.student:
        enrolled = db.query(models.Enrollment).filter(
            models.Enrollment.class_id == class_id,
            models.Enrollment.student_id == current_user.id,
        ).first()
        if not enrolled:
            raise HTTPException(status_code=403, detail="Not enrolled in this course")
    elif current_user.role == models.RoleEnum.lecturer:
        class_ = db.query(models.Class).filter(models.Class.id == class_id).first()
        if not class_ or class_.lecturer_id != current_user.id:
            raise HTTPException(status_code=403, detail="Access denied")

    materials = (
        db.query(models.CourseMaterial)
        .filter(models.CourseMaterial.class_id == class_id)
        .order_by(models.CourseMaterial.uploaded_at.desc())
        .all()
    )
    return [_out(m, db) for m in materials]


# ── Download / view a material ────────────────────────────────────────────────
@router.get("/download/{material_id}")
def download_material(
    material_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    material = db.query(models.CourseMaterial).filter(
        models.CourseMaterial.id == material_id
    ).first()
    if not material:
        raise HTTPException(status_code=404, detail="Material not found")

    # Access check
    if current_user.role == models.RoleEnum.student:
        enrolled = db.query(models.Enrollment).filter(
            models.Enrollment.class_id == material.class_id,
            models.Enrollment.student_id == current_user.id,
        ).first()
        if not enrolled:
            raise HTTPException(status_code=403, detail="Not enrolled in this course")

    media_type = material.file_type or "application/octet-stream"
    filename = material.original_filename

    # Primary: serve from database (survives redeployments)
    if material.file_data:
        return Response(
            content=material.file_data,
            media_type=media_type,
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )

    # Fallback: serve from disk
    file_path = os.path.join(UPLOAD_DIR, material.stored_filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found — it was lost in a server restart. Please re-upload.")

    return FileResponse(path=file_path, media_type=media_type, filename=filename)


# ── Lecturer or uploader (tutor): delete material ─────────────────────────────
@router.delete("/{material_id}", status_code=204)
def delete_material(
    material_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    material = db.query(models.CourseMaterial).filter(
        models.CourseMaterial.id == material_id
    ).first()
    if not material:
        raise HTTPException(status_code=404, detail="Material not found")

    class_ = db.query(models.Class).filter(models.Class.id == material.class_id).first()
    is_lecturer = (
        current_user.role == models.RoleEnum.lecturer and
        class_ and class_.lecturer_id == current_user.id
    )
    # Tutors can only delete their own uploads
    is_own_upload = material.uploaded_by == current_user.id
    if not is_lecturer and not is_own_upload:
        raise HTTPException(status_code=403, detail="Access denied")

    # Remove file from disk
    file_path = os.path.join(UPLOAD_DIR, material.stored_filename)
    if os.path.exists(file_path):
        os.remove(file_path)

    db.delete(material)
    db.commit()
