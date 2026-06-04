"""
AI Study Assistant — lets students chat with Claude about their course materials.
"""

import os
import logging
from typing import Optional

import fitz  # PyMuPDF
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

import app.models as models
from app.database import get_db
from app.auth import get_current_user

log = logging.getLogger(__name__)
router = APIRouter(prefix="/api/ai", tags=["AI Study Assistant"])

MAX_HISTORY    = 20
MAX_TEXT_CHARS = 80_000
UPLOAD_DIR     = os.path.join(os.path.dirname(__file__), "..", "..", "uploads", "materials")

# Tool schema — forces Claude to always return structured answer + suggestions
_STUDY_TOOL = {
    "name": "study_response",
    "description": "Return a plain-text answer and 2-3 follow-up question suggestions.",
    "input_schema": {
        "type": "object",
        "properties": {
            "answer": {
                "type": "string",
                "description": (
                    "A well-formatted answer using this style: "
                    "Use **bold** (double asterisks) for key terms, important concepts, and section headings. "
                    "Use numbered lists (1. 2. 3.) for steps or ordered items. "
                    "Use bullet points (- item) for unordered lists. "
                    "Separate sections and paragraphs with blank lines. "
                    "Wrap all code in fenced code blocks with a language name (```python, ```sql, etc.). "
                    "Do NOT use # headings, _, or ~~ anywhere."
                ),
            },
            "suggestions": {
                "type": "array",
                "items": {"type": "string"},
                "description": "2 or 3 short follow-up questions the student might want to ask next.",
            },
        },
        "required": ["answer", "suggestions"],
    },
}


def _extract_pdf_text(data: bytes) -> str:
    try:
        doc = fitz.open(stream=data, filetype="pdf")
        return "\n".join(page.get_text() for page in doc)[:MAX_TEXT_CHARS]
    except Exception:
        return ""


def _get_materials_text(class_id: int, db: Session) -> str:
    materials = db.query(models.CourseMaterial).filter(
        models.CourseMaterial.class_id == class_id,
    ).all()

    parts = []
    for m in materials:
        # Accept PDFs by original filename or MIME type
        is_pdf = (
            (m.original_filename or "").lower().endswith(".pdf") or
            (m.file_type or "").lower() == "application/pdf"
        )
        if not is_pdf:
            continue

        data: Optional[bytes] = None
        # Primary: read from DB
        if m.file_data:
            data = m.file_data
        else:
            # Fallback: read from disk
            path = os.path.join(UPLOAD_DIR, m.stored_filename)
            if os.path.exists(path):
                with open(path, "rb") as f:
                    data = f.read()

        if data:
            text = _extract_pdf_text(data)
            if text.strip():
                parts.append(f"=== {m.title or m.original_filename} ===\n{text}")

    return "\n\n".join(parts)


def _ask_claude(system_prompt: str, history: list, user_message: str) -> tuple[str, list[str]]:
    api_key = os.environ.get("ANTHROPIC_API_KEY", "")
    if not api_key:
        raise HTTPException(500, "AI service not configured")

    import anthropic
    client = anthropic.Anthropic(api_key=api_key)

    messages = history + [{"role": "user", "content": user_message}]

    response = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=4096,
        system=system_prompt,
        messages=messages,
        tools=[_STUDY_TOOL],
        tool_choice={"type": "tool", "name": "study_response"},
    )

    # max_tokens hit before tool_use block completed — surface a clear error
    if response.stop_reason == "max_tokens":
        raise HTTPException(500, "The response was too long to complete. Try asking for a shorter summary or a specific section.")

    for block in response.content:
        if block.type == "tool_use" and block.name == "study_response":
            answer = (block.input.get("answer") or "").strip()
            suggestions = [s for s in (block.input.get("suggestions") or []) if s][:3]
            if not answer:
                raise HTTPException(500, "The AI returned an empty response. Please try again.")
            return answer, suggestions

    raise HTTPException(500, "AI service returned an unexpected response. Please try again.")


# ── endpoints ─────────────────────────────────────────────────────────────────

@router.get("/classes")
def get_ai_classes(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Returns enrolled classes that have at least one PDF material."""
    enrollments = db.query(models.Enrollment).filter(
        models.Enrollment.student_id == current_user.id
    ).all()

    result = []
    for e in enrollments:
        cls = db.query(models.Class).filter(models.Class.id == e.class_id).first()
        if not cls:
            continue
        pdf_count = db.query(models.CourseMaterial).filter(
            models.CourseMaterial.class_id == cls.id,
        ).count()
        result.append({
            "id": cls.id,
            "name": cls.name,
            "course_code": cls.course_code,
            "pdf_count": pdf_count,
            "has_materials": pdf_count > 0,
        })
    return result


@router.post("/chat/{class_id}")
def chat(
    class_id: int,
    payload: dict,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    user_message = (payload.get("message") or "").strip()
    if not user_message:
        raise HTTPException(400, "Message is required")

    enrolled = db.query(models.Enrollment).filter(
        models.Enrollment.student_id == current_user.id,
        models.Enrollment.class_id == class_id,
    ).first()
    if not enrolled:
        raise HTTPException(403, "You are not enrolled in this class")

    cls = db.query(models.Class).filter(models.Class.id == class_id).first()
    if not cls:
        raise HTTPException(404, "Class not found")

    materials_text = _get_materials_text(class_id, db)
    if not materials_text:
        raise HTTPException(400, "No PDF materials available for this class yet. Ask your lecturer to upload course materials.")

    system_prompt = f"""You are an AI study assistant for {cls.name} ({cls.course_code or ''}).
Your job is to help students understand their course material.

RULES:
- Answer ONLY based on the course materials provided below.
- If the answer is not in the materials, say "I can't find that in the course materials. Please ask your lecturer."
- Be clear, concise and student-friendly.
- Do not make up information that is not in the materials.
- Keep responses short and digestible — students read on mobile and won't read walls of text.

SUMMARY RULE (very important):
- If the student asks for a summary, overview, or "what are the key points", do NOT dump everything.
- Instead, list the main topics covered as a numbered or bulleted list with one short sentence each.
- End with: "Which of these would you like me to explain in more detail?"
- This way the student can pick what they want to go deeper on.
- Only give a full detailed explanation when the student asks about a specific topic.

FORMATTING — follow these rules exactly, like ChatGPT does:
- Use **bold** (double asterisks) for key terms, important concepts, and section headings. Example: **Algorithm** or **Key Concept:**.
- Use numbered lists (1. 2. 3.) for steps or ordered items.
- Use bullet points (- item) for unordered lists.
- Separate sections with a blank line.
- Do NOT use # headings, underscores (_), or strikethrough (~~) anywhere.
- For any code (Python, SQL, JavaScript, etc.), wrap it in a fenced code block with the language name:
  ```python
  # your code here
  ```
  Never write code inline without a fence.

For the suggestions field, provide 2 or 3 natural follow-up questions a student would logically ask next given what was just discussed.

COURSE MATERIALS:
{materials_text}"""

    history_rows = db.query(models.AIChatMessage).filter(
        models.AIChatMessage.student_id == current_user.id,
        models.AIChatMessage.class_id == class_id,
    ).order_by(models.AIChatMessage.created_at.asc()).all()

    history = [{"role": r.role, "content": r.content} for r in history_rows[-MAX_HISTORY:]]

    try:
        reply, suggestions = _ask_claude(system_prompt, history, user_message)
    except HTTPException:
        raise
    except Exception as exc:
        log.error("Claude API error: %s", exc)
        raise HTTPException(500, "AI service temporarily unavailable. Please try again.")

    db.add(models.AIChatMessage(
        student_id=current_user.id, class_id=class_id,
        role="user", content=user_message,
    ))
    db.add(models.AIChatMessage(
        student_id=current_user.id, class_id=class_id,
        role="assistant", content=reply,
    ))
    db.commit()

    return {"reply": reply, "suggestions": suggestions}


@router.get("/history/{class_id}")
def get_history(
    class_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    rows = db.query(models.AIChatMessage).filter(
        models.AIChatMessage.student_id == current_user.id,
        models.AIChatMessage.class_id == class_id,
    ).order_by(models.AIChatMessage.created_at.asc()).all()
    return [{"role": r.role, "content": r.content, "created_at": str(r.created_at)} for r in rows]


@router.delete("/history/{class_id}", status_code=204)
def clear_history(
    class_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    db.query(models.AIChatMessage).filter(
        models.AIChatMessage.student_id == current_user.id,
        models.AIChatMessage.class_id == class_id,
    ).delete()
    db.commit()
