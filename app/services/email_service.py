"""
Email service — sends via Resend API (primary) or Gmail SMTP (fallback).
Railway blocks outbound SMTP, so Resend (HTTPS-based) is the reliable path.
"""

import os
import logging

log = logging.getLogger(__name__)


def _send(to: str, subject: str, html: str) -> None:
    resend_key = os.environ.get("RESEND_API_KEY", "")
    if resend_key:
        success = _send_via_resend(to, subject, html, resend_key)
        if not success:
            _send_via_smtp(to, subject, html)
    else:
        _send_via_smtp(to, subject, html)


def _send_via_resend(to: str, subject: str, html: str, api_key: str) -> bool:
    """Returns True on success, False on failure (caller can fallback to SMTP)."""
    try:
        import resend
        resend.api_key = api_key
        from_addr = os.environ.get("RESEND_FROM", "Cortex <onboarding@resend.dev>")
        resend.Emails.send({
            "from": from_addr,
            "to": [to],
            "subject": subject,
            "html": html,
        })
        log.info("Email sent via Resend to %s", to)
        return True
    except Exception as exc:
        log.warning("Resend failed for %s (%s) — falling back to SMTP", to, exc)
        return False


def _send_via_smtp(to: str, subject: str, html: str) -> None:
    import smtplib
    from email.mime.multipart import MIMEMultipart
    from email.mime.text import MIMEText
    from app.config import settings

    if not settings.SMTP_HOST or not settings.SMTP_USER or not settings.SMTP_PASSWORD \
            or settings.SMTP_USER.startswith("your_"):
        log.warning("No email provider configured — printing to console.")
        print(f"\n{'='*60}\nTO: {to}\nSUBJECT: {subject}\n{'='*60}\n")
        return

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"{settings.EMAIL_FROM_NAME} <{settings.SMTP_USER}>"
    msg["To"] = to
    msg.attach(MIMEText(html, "html"))

    try:
        if settings.SMTP_PORT == 465:
            with smtplib.SMTP_SSL(settings.SMTP_HOST, 465, timeout=30) as server:
                server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
                server.sendmail(settings.SMTP_USER, to, msg.as_string())
        else:
            with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=30) as server:
                server.ehlo()
                server.starttls()
                server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
                server.sendmail(settings.SMTP_USER, to, msg.as_string())
        log.info("Email sent via SMTP to %s", to)
    except Exception as exc:
        log.error("SMTP failed for %s: %s", to, exc)


# ── Public helpers ────────────────────────────────────────────────────────────

def send_verification_code(to: str, name: str, code: str) -> None:
    subject = "Your Cortex verification code"
    html = f"""
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f4f6f9;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:40px 20px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.08);">

        <tr><td style="background:linear-gradient(135deg,#4f46e5,#7c3aed);padding:32px 40px;text-align:center;">
          <h1 style="margin:0;color:#fff;font-size:26px;font-weight:700;letter-spacing:-0.5px;">Cortex</h1>
          <p style="margin:6px 0 0;color:rgba(255,255,255,.8);font-size:13px;">Cortex Learning Platform</p>
        </td></tr>

        <tr><td style="padding:40px;">
          <p style="margin:0 0 8px;font-size:16px;color:#1a1a2e;">Hi <strong>{name}</strong>,</p>
          <p style="margin:0 0 28px;font-size:15px;color:#555;line-height:1.6;">
            Use the code below to verify your email address and activate your Cortex account.
          </p>

          <div style="background:#f0f0ff;border:2px dashed #4f46e5;border-radius:12px;padding:24px;text-align:center;margin-bottom:28px;">
            <p style="margin:0 0 6px;font-size:12px;color:#666;text-transform:uppercase;letter-spacing:1px;">Your verification code</p>
            <p style="margin:0;font-size:44px;font-weight:800;color:#4f46e5;letter-spacing:12px;">{code}</p>
          </div>

          <p style="margin:0 0 28px;font-size:14px;color:#888;text-align:center;">
            This code expires in <strong>15 minutes</strong>. Do not share it with anyone.
          </p>

          <p style="margin:0;font-size:13px;color:#aaa;border-top:1px solid #eee;padding-top:20px;">
            If you did not create an Cortex account, you can safely ignore this email.
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>
"""
    _send(to, subject, html)


def send_welcome_student(to: str, name: str, matric: str, department: str, level: str) -> None:
    subject = f"Welcome to Cortex, {name}! Your account is ready"
    html = f"""
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f4f6f9;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:40px 20px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.08);">

        <tr><td style="background:linear-gradient(135deg,#4f46e5,#7c3aed);padding:32px 40px;text-align:center;">
          <div style="font-size:40px;margin-bottom:8px;">&#127891;</div>
          <h1 style="margin:0;color:#fff;font-size:24px;font-weight:700;">Welcome to Cortex!</h1>
          <p style="margin:6px 0 0;color:rgba(255,255,255,.8);font-size:13px;">Your student account has been activated</p>
        </td></tr>

        <tr><td style="padding:40px;">
          <p style="margin:0 0 20px;font-size:16px;color:#1a1a2e;">Hi <strong>{name}</strong>, you're all set!</p>

          <div style="background:#f8f9ff;border-radius:10px;padding:20px;margin-bottom:28px;">
            <p style="margin:0 0 14px;font-size:14px;font-weight:700;color:#4f46e5;text-transform:uppercase;letter-spacing:.5px;">Your Account Details</p>
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr><td style="padding:6px 0;font-size:14px;color:#666;width:40%;">Full Name</td><td style="padding:6px 0;font-size:14px;color:#1a1a2e;font-weight:600;">{name}</td></tr>
              <tr><td style="padding:6px 0;font-size:14px;color:#666;">Email</td><td style="padding:6px 0;font-size:14px;color:#1a1a2e;font-weight:600;">{to}</td></tr>
              <tr><td style="padding:6px 0;font-size:14px;color:#666;">Matric Number</td><td style="padding:6px 0;font-size:14px;color:#1a1a2e;font-weight:600;font-family:monospace;">{matric}</td></tr>
              <tr><td style="padding:6px 0;font-size:14px;color:#666;">Department</td><td style="padding:6px 0;font-size:14px;color:#1a1a2e;font-weight:600;">{department}</td></tr>
              <tr><td style="padding:6px 0;font-size:14px;color:#666;">Level</td><td style="padding:6px 0;font-size:14px;color:#1a1a2e;font-weight:600;">{level}</td></tr>
              <tr><td style="padding:6px 0;font-size:14px;color:#666;">Role</td><td style="padding:6px 0;font-size:14px;color:#1a1a2e;font-weight:600;">Student</td></tr>
            </table>
          </div>

          <p style="margin:0 0 14px;font-size:14px;font-weight:700;color:#1a1a2e;">Getting Started</p>
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
            <tr><td style="padding:8px 0;vertical-align:top;width:28px;font-size:18px;">&#128218;</td><td style="padding:8px 0;font-size:14px;color:#555;"><strong>Browse Courses</strong> — Go to <em>My Courses</em> and enroll using your matric number.</td></tr>
            <tr><td style="padding:8px 0;vertical-align:top;font-size:18px;">&#128221;</td><td style="padding:8px 0;font-size:14px;color:#555;"><strong>Assignments</strong> — Submit assignments before the deadline.</td></tr>
            <tr><td style="padding:8px 0;vertical-align:top;font-size:18px;">&#128225;</td><td style="padding:8px 0;font-size:14px;color:#555;"><strong>Live Lectures</strong> — Join live sessions and click the attendance cookie to mark presence.</td></tr>
            <tr><td style="padding:8px 0;vertical-align:top;font-size:18px;">&#129514;</td><td style="padding:8px 0;font-size:14px;color:#555;"><strong>Quizzes &amp; Tests</strong> — Take timed quizzes and see your score instantly.</td></tr>
            <tr><td style="padding:8px 0;vertical-align:top;font-size:18px;">&#128202;</td><td style="padding:8px 0;font-size:14px;color:#555;"><strong>Analytics</strong> — Track your attendance and grades from your dashboard.</td></tr>
          </table>

          <div style="background:#fff3cd;border-left:4px solid #f59e0b;border-radius:6px;padding:14px 16px;margin-bottom:28px;">
            <p style="margin:0;font-size:13px;color:#92400e;">
              <strong>Keep your matric number safe.</strong> You'll need it to enroll in or drop courses.
            </p>
          </div>

          <p style="margin:0;font-size:13px;color:#aaa;border-top:1px solid #eee;padding-top:20px;text-align:center;">
            <span style="color:#4f46e5;">Cortex — Cortex Learning Platform</span>
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>
"""
    _send(to, subject, html)


def send_lecture_scheduled(to: str, name: str, course: str, title: str, scheduled_at: str) -> None:
    subject = f"Lecture Scheduled: {title}"
    html = f"""
<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f4f6f9;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:40px 20px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.08);">
        <tr><td style="background:linear-gradient(135deg,#4f46e5,#7c3aed);padding:28px 40px;">
          <p style="margin:0;color:rgba(255,255,255,.7);font-size:12px;text-transform:uppercase;letter-spacing:1px;">Cortex · Lecture Scheduled</p>
          <h1 style="margin:8px 0 0;color:#fff;font-size:22px;">&#128197; {title}</h1>
        </td></tr>
        <tr><td style="padding:32px 40px;">
          <p style="margin:0 0 20px;font-size:15px;color:#333;">Hi <strong>{name}</strong>,</p>
          <p style="margin:0 0 20px;font-size:15px;color:#555;line-height:1.6;">A new lecture has been scheduled for <strong>{course}</strong>.</p>
          <div style="background:#f0f0ff;border-left:4px solid #4f46e5;border-radius:8px;padding:16px 20px;margin-bottom:24px;">
            <p style="margin:0 0 6px;font-size:13px;color:#888;text-transform:uppercase;letter-spacing:.5px;">Date &amp; Time</p>
            <p style="margin:0;font-size:18px;font-weight:700;color:#4f46e5;">{scheduled_at}</p>
          </div>
          <p style="margin:0;font-size:13px;color:#aaa;border-top:1px solid #eee;padding-top:16px;">Log in to Cortex to view details.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>"""
    _send(to, subject, html)


def send_lecture_live(to: str, name: str, course: str, title: str) -> None:
    subject = f"LIVE NOW: {title} — Join immediately"
    html = f"""
<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f4f6f9;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:40px 20px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.08);">
        <tr><td style="background:linear-gradient(135deg,#dc2626,#b91c1c);padding:28px 40px;text-align:center;">
          <div style="display:inline-block;background:rgba(255,255,255,.2);border-radius:50px;padding:6px 16px;margin-bottom:10px;">
            <span style="color:#fff;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">&#11835; Live Now</span>
          </div>
          <h1 style="margin:8px 0 0;color:#fff;font-size:22px;">{title}</h1>
        </td></tr>
        <tr><td style="padding:32px 40px;text-align:center;">
          <p style="margin:0 0 8px;font-size:15px;color:#333;">Hi <strong>{name}</strong>,</p>
          <p style="margin:0 0 24px;font-size:15px;color:#555;line-height:1.6;"><strong>{course}</strong> is live right now. Log in to Cortex and join immediately.</p>
          <p style="margin:0;font-size:13px;color:#aaa;border-top:1px solid #eee;padding-top:16px;">Don't forget to click the attendance cookie to mark your presence.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>"""
    _send(to, subject, html)


def send_new_assignment(to: str, name: str, course: str, title: str, due_date: str) -> None:
    subject = f"New Assignment: {title}"
    html = f"""
<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f4f6f9;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:40px 20px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.08);">
        <tr><td style="background:linear-gradient(135deg,#0f766e,#0d9488);padding:28px 40px;">
          <p style="margin:0;color:rgba(255,255,255,.7);font-size:12px;text-transform:uppercase;letter-spacing:1px;">Cortex · New Assignment</p>
          <h1 style="margin:8px 0 0;color:#fff;font-size:22px;">&#128221; {title}</h1>
        </td></tr>
        <tr><td style="padding:32px 40px;">
          <p style="margin:0 0 20px;font-size:15px;color:#333;">Hi <strong>{name}</strong>,</p>
          <p style="margin:0 0 20px;font-size:15px;color:#555;line-height:1.6;">A new assignment has been posted for <strong>{course}</strong>.</p>
          <div style="background:#f0faf9;border-left:4px solid #0f766e;border-radius:8px;padding:16px 20px;margin-bottom:24px;">
            <p style="margin:0 0 6px;font-size:13px;color:#888;text-transform:uppercase;letter-spacing:.5px;">Deadline</p>
            <p style="margin:0;font-size:18px;font-weight:700;color:#0f766e;">{due_date}</p>
          </div>
          <div style="background:#fff3cd;border-left:4px solid #f59e0b;border-radius:6px;padding:12px 16px;margin-bottom:24px;">
            <p style="margin:0;font-size:13px;color:#92400e;">&#9888;&#65039; Submit before the deadline. Late submissions may not be accepted.</p>
          </div>
          <p style="margin:0;font-size:13px;color:#aaa;border-top:1px solid #eee;padding-top:16px;">Log in to Cortex to view and submit the assignment.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>"""
    _send(to, subject, html)


def send_deadline_extended(to: str, name: str, course: str, title: str, old_date: str, new_date: str) -> None:
    subject = f"Deadline Extended: {title}"
    html = f"""
<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f4f6f9;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:40px 20px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.08);">
        <tr><td style="background:linear-gradient(135deg,#d97706,#b45309);padding:28px 40px;">
          <p style="margin:0;color:rgba(255,255,255,.7);font-size:12px;text-transform:uppercase;letter-spacing:1px;">Cortex · Deadline Extended</p>
          <h1 style="margin:8px 0 0;color:#fff;font-size:22px;">&#128197; {title}</h1>
        </td></tr>
        <tr><td style="padding:32px 40px;">
          <p style="margin:0 0 20px;font-size:15px;color:#333;">Hi <strong>{name}</strong>,</p>
          <p style="margin:0 0 20px;font-size:15px;color:#555;line-height:1.6;">Your lecturer has extended the deadline for <strong>{title}</strong> in <strong>{course}</strong>.</p>
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
            <tr>
              <td style="width:50%;padding-right:8px;">
                <div style="background:#fee2e2;border-radius:8px;padding:14px 16px;text-align:center;">
                  <p style="margin:0 0 4px;font-size:11px;color:#991b1b;text-transform:uppercase;letter-spacing:.5px;">Old Deadline</p>
                  <p style="margin:0;font-size:15px;font-weight:700;color:#991b1b;text-decoration:line-through;">{old_date}</p>
                </div>
              </td>
              <td style="width:50%;padding-left:8px;">
                <div style="background:#d1fae5;border-radius:8px;padding:14px 16px;text-align:center;">
                  <p style="margin:0 0 4px;font-size:11px;color:#065f46;text-transform:uppercase;letter-spacing:.5px;">New Deadline</p>
                  <p style="margin:0;font-size:15px;font-weight:700;color:#065f46;">{new_date}</p>
                </div>
              </td>
            </tr>
          </table>
          <p style="margin:0;font-size:13px;color:#aaa;border-top:1px solid #eee;padding-top:16px;">Log in to Cortex to submit your assignment.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>"""
    _send(to, subject, html)


def send_assignment_graded(to: str, name: str, course: str, title: str, score: str) -> None:
    subject = f"Assignment Graded: {title}"
    html = f"""
<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f4f6f9;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:40px 20px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.08);">
        <tr><td style="background:linear-gradient(135deg,#4f46e5,#7c3aed);padding:28px 40px;text-align:center;">
          <div style="font-size:36px;margin-bottom:8px;">&#127942;</div>
          <h1 style="margin:0;color:#fff;font-size:22px;">Assignment Graded</h1>
        </td></tr>
        <tr><td style="padding:32px 40px;text-align:center;">
          <p style="margin:0 0 20px;font-size:15px;color:#333;">Hi <strong>{name}</strong>,</p>
          <p style="margin:0 0 20px;font-size:15px;color:#555;"><strong>{title}</strong> in <strong>{course}</strong> has been graded.</p>
          <div style="background:#f0f0ff;border-radius:12px;padding:24px;margin-bottom:24px;display:inline-block;min-width:160px;">
            <p style="margin:0 0 4px;font-size:12px;color:#666;text-transform:uppercase;letter-spacing:.5px;">Your Score</p>
            <p style="margin:0;font-size:36px;font-weight:800;color:#4f46e5;">{score}</p>
          </div>
          <p style="margin:0;font-size:13px;color:#aaa;border-top:1px solid #eee;padding-top:16px;">Log in to Cortex to view detailed feedback.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>"""
    _send(to, subject, html)


def send_quiz_published(to: str, name: str, course: str, title: str, duration: int) -> None:
    subject = f"New Quiz Available: {title}"
    html = f"""
<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f4f6f9;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:40px 20px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.08);">
        <tr><td style="background:linear-gradient(135deg,#7c3aed,#4f46e5);padding:28px 40px;">
          <p style="margin:0;color:rgba(255,255,255,.7);font-size:12px;text-transform:uppercase;letter-spacing:1px;">Cortex · New Quiz</p>
          <h1 style="margin:8px 0 0;color:#fff;font-size:22px;">&#129514; {title}</h1>
        </td></tr>
        <tr><td style="padding:32px 40px;">
          <p style="margin:0 0 20px;font-size:15px;color:#333;">Hi <strong>{name}</strong>,</p>
          <p style="margin:0 0 20px;font-size:15px;color:#555;line-height:1.6;">A new quiz has been published for <strong>{course}</strong>.</p>
          <div style="background:#f5f3ff;border-left:4px solid #7c3aed;border-radius:8px;padding:16px 20px;margin-bottom:24px;">
            <p style="margin:0 0 4px;font-size:13px;color:#888;">Time limit: <strong style="color:#7c3aed;">{duration} minutes</strong></p>
            <p style="margin:0;font-size:13px;color:#888;">Results are shown immediately after submission.</p>
          </div>
          <div style="background:#fff3cd;border-left:4px solid #f59e0b;border-radius:6px;padding:12px 16px;margin-bottom:24px;">
            <p style="margin:0;font-size:13px;color:#92400e;">&#9888;&#65039; You only get one attempt — the timer starts as soon as you begin.</p>
          </div>
          <p style="margin:0;font-size:13px;color:#aaa;border-top:1px solid #eee;padding-top:16px;">Log in to Cortex to take the quiz.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>"""
    _send(to, subject, html)


def send_assignment_submitted(to: str, lecturer_name: str, student_name: str, title: str, course: str) -> None:
    subject = f"{student_name} submitted: {title}"
    html = f"""
<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f4f6f9;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:40px 20px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.08);">
        <tr><td style="background:linear-gradient(135deg,#0f766e,#0d9488);padding:28px 40px;">
          <p style="margin:0;color:rgba(255,255,255,.7);font-size:12px;text-transform:uppercase;letter-spacing:1px;">Cortex · Assignment Submission</p>
          <h1 style="margin:8px 0 0;color:#fff;font-size:22px;">&#128221; New Submission</h1>
        </td></tr>
        <tr><td style="padding:32px 40px;">
          <p style="margin:0 0 20px;font-size:15px;color:#333;">Hi <strong>{lecturer_name}</strong>,</p>
          <div style="background:#f0faf9;border-radius:10px;padding:20px;margin-bottom:24px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr><td style="padding:5px 0;font-size:14px;color:#666;width:40%;">Student</td><td style="font-size:14px;color:#1a1a2e;font-weight:600;">{student_name}</td></tr>
              <tr><td style="padding:5px 0;font-size:14px;color:#666;">Assignment</td><td style="font-size:14px;color:#1a1a2e;font-weight:600;">{title}</td></tr>
              <tr><td style="padding:5px 0;font-size:14px;color:#666;">Course</td><td style="font-size:14px;color:#1a1a2e;font-weight:600;">{course}</td></tr>
            </table>
          </div>
          <p style="margin:0;font-size:13px;color:#aaa;border-top:1px solid #eee;padding-top:16px;">Log in to Cortex to review and grade the submission.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>"""
    _send(to, subject, html)


def send_welcome_lecturer(to: str, name: str, staff_number: str, department: str) -> None:
    subject = f"Welcome to Cortex, {name}! Your lecturer account is ready"
    html = f"""
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f4f6f9;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:40px 20px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.08);">

        <tr><td style="background:linear-gradient(135deg,#0f766e,#0d9488);padding:32px 40px;text-align:center;">
          <div style="font-size:40px;margin-bottom:8px;">&#128218;</div>
          <h1 style="margin:0;color:#fff;font-size:24px;font-weight:700;">Welcome to Cortex!</h1>
          <p style="margin:6px 0 0;color:rgba(255,255,255,.8);font-size:13px;">Your lecturer account has been activated</p>
        </td></tr>

        <tr><td style="padding:40px;">
          <p style="margin:0 0 20px;font-size:16px;color:#1a1a2e;">Hi <strong>{name}</strong>, welcome aboard!</p>

          <div style="background:#f0faf9;border-radius:10px;padding:20px;margin-bottom:28px;">
            <p style="margin:0 0 14px;font-size:14px;font-weight:700;color:#0f766e;text-transform:uppercase;letter-spacing:.5px;">Your Account Details</p>
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr><td style="padding:6px 0;font-size:14px;color:#666;width:40%;">Full Name</td><td style="padding:6px 0;font-size:14px;color:#1a1a2e;font-weight:600;">{name}</td></tr>
              <tr><td style="padding:6px 0;font-size:14px;color:#666;">Email</td><td style="padding:6px 0;font-size:14px;color:#1a1a2e;font-weight:600;">{to}</td></tr>
              <tr><td style="padding:6px 0;font-size:14px;color:#666;">Staff Number</td><td style="padding:6px 0;font-size:14px;color:#1a1a2e;font-weight:600;font-family:monospace;">{staff_number}</td></tr>
              <tr><td style="padding:6px 0;font-size:14px;color:#666;">Department</td><td style="padding:6px 0;font-size:14px;color:#1a1a2e;font-weight:600;">{department}</td></tr>
              <tr><td style="padding:6px 0;font-size:14px;color:#666;">Role</td><td style="padding:6px 0;font-size:14px;color:#1a1a2e;font-weight:600;">Lecturer</td></tr>
            </table>
          </div>

          <p style="margin:0 0 14px;font-size:14px;font-weight:700;color:#1a1a2e;">Getting Started</p>
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
            <tr><td style="padding:8px 0;vertical-align:top;width:28px;font-size:18px;">&#127979;</td><td style="padding:8px 0;font-size:14px;color:#555;"><strong>Create Courses</strong> — Go to <em>Class Preparation</em> and create your courses.</td></tr>
            <tr><td style="padding:8px 0;vertical-align:top;font-size:18px;">&#128225;</td><td style="padding:8px 0;font-size:14px;color:#555;"><strong>Live Lectures</strong> — Schedule or start instant live lectures with auto attendance.</td></tr>
            <tr><td style="padding:8px 0;vertical-align:top;font-size:18px;">&#128221;</td><td style="padding:8px 0;font-size:14px;color:#555;"><strong>Assignments</strong> — Create assignments with deadlines and grade submissions.</td></tr>
            <tr><td style="padding:8px 0;vertical-align:top;font-size:18px;">&#129514;</td><td style="padding:8px 0;font-size:14px;color:#555;"><strong>Quizzes &amp; Tests</strong> — Build timed quizzes — students get instant scores on submission.</td></tr>
            <tr><td style="padding:8px 0;vertical-align:top;font-size:18px;">&#128202;</td><td style="padding:8px 0;font-size:14px;color:#555;"><strong>Analytics</strong> — View attendance rates and class performance from your dashboard.</td></tr>
          </table>

          <p style="margin:0;font-size:13px;color:#aaa;border-top:1px solid #eee;padding-top:20px;text-align:center;">
            Cortex — Cortex Learning Platform
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>
"""
    _send(to, subject, html)


def send_tutor_selected(to: str, name: str, course: str) -> None:
    subject = f"Congratulations! You've been selected as a Peer Tutor for {course}"
    html = f"""
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f4f6f9;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:40px 20px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.08);">
        <tr><td style="background:linear-gradient(135deg,#7c3aed,#a855f7);padding:32px 40px;text-align:center;">
          <div style="font-size:48px;margin-bottom:8px;">&#127942;</div>
          <h1 style="margin:0;color:#fff;font-size:24px;font-weight:700;">You're a Peer Tutor!</h1>
          <p style="margin:6px 0 0;color:rgba(255,255,255,.85);font-size:13px;">You have been selected by your lecturer</p>
        </td></tr>
        <tr><td style="padding:40px;">
          <p style="margin:0 0 16px;font-size:16px;color:#1a1a2e;">Hi <strong>{name}</strong>,</p>
          <p style="margin:0 0 24px;font-size:15px;color:#444;">Great news! Your lecturer has selected you as one of the <strong>Peer Tutors</strong> for <strong>{course}</strong> in the Cortex Study Hub.</p>
          <div style="background:#f5f3ff;border-left:4px solid #7c3aed;border-radius:8px;padding:20px;margin-bottom:24px;">
            <p style="margin:0 0 12px;font-size:14px;font-weight:700;color:#7c3aed;">Your Tutor Privileges</p>
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr><td style="padding:6px 0;font-size:14px;color:#555;">&#128227; Broadcast messages to all enrolled students</td></tr>
              <tr><td style="padding:6px 0;font-size:14px;color:#555;">&#127897; Host live tutorial sessions for the class</td></tr>
              <tr><td style="padding:6px 0;font-size:14px;color:#555;">&#127979; Help fellow students understand course material</td></tr>
            </table>
          </div>
          <p style="margin:0 0 24px;font-size:14px;color:#555;">Log in to the Cortex Student Portal and visit the <strong>Study Hub</strong> section to access your tutor dashboard.</p>
          <p style="margin:0;font-size:13px;color:#aaa;border-top:1px solid #eee;padding-top:20px;text-align:center;">Cortex — Cortex Learning Platform</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>"""
    _send(to, subject, html)


def send_schedule_added(to: str, name: str, course: str, slots: list) -> None:
    slots_html = "".join(
        f'<tr><td style="padding:8px 12px;font-size:14px;color:#1a1a2e;font-weight:600;">{s}</td></tr>'
        for s in slots
    )
    subject = f"Timetable Updated: {course}"
    html = f"""
<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f4f6f9;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:40px 20px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.08);">
        <tr><td style="background:linear-gradient(135deg,#0f766e,#0d9488);padding:28px 40px;">
          <p style="margin:0;color:rgba(255,255,255,.7);font-size:12px;text-transform:uppercase;letter-spacing:1px;">Cortex · Schedule Update</p>
          <h1 style="margin:8px 0 0;color:#fff;font-size:22px;">&#128197; Timetable Updated</h1>
        </td></tr>
        <tr><td style="padding:32px 40px;">
          <p style="margin:0 0 16px;font-size:15px;color:#333;">Hi <strong>{name}</strong>,</p>
          <p style="margin:0 0 20px;font-size:15px;color:#555;line-height:1.6;">
            The class schedule for <strong>{course}</strong> has been updated. Here are your new class times:
          </p>
          <div style="background:#f0faf9;border-left:4px solid #0f766e;border-radius:8px;overflow:hidden;margin-bottom:24px;">
            <table width="100%" cellpadding="0" cellspacing="0">{slots_html}</table>
          </div>
          <p style="margin:0 0 16px;font-size:14px;color:#555;">
            Log in to Cortex and visit <strong>My Schedule</strong> to see your full weekly timetable.
          </p>
          <p style="margin:0;font-size:13px;color:#aaa;border-top:1px solid #eee;padding-top:16px;">Cortex — Cortex Learning Platform</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>"""
    _send(to, subject, html)


def send_schedule_conflict(to: str, name: str, new_course: str, conflict_course: str, day: str, time_range: str) -> None:
    subject = f"Schedule Conflict Detected — {new_course}"
    html = f"""
<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f4f6f9;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:40px 20px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.08);">
        <tr><td style="background:linear-gradient(135deg,#d97706,#b45309);padding:28px 40px;">
          <p style="margin:0;color:rgba(255,255,255,.7);font-size:12px;text-transform:uppercase;letter-spacing:1px;">Cortex · Schedule Conflict</p>
          <h1 style="margin:8px 0 0;color:#fff;font-size:22px;">&#9888;&#65039; Timetable Clash Detected</h1>
        </td></tr>
        <tr><td style="padding:32px 40px;">
          <p style="margin:0 0 16px;font-size:15px;color:#333;">Hi <strong>{name}</strong>,</p>
          <p style="margin:0 0 20px;font-size:15px;color:#555;line-height:1.6;">
            You have successfully enrolled in <strong>{new_course}</strong>, but we detected a timetable clash with one of your existing courses.
          </p>
          <div style="background:#fff3cd;border-left:4px solid #d97706;border-radius:8px;padding:20px;margin-bottom:24px;">
            <p style="margin:0 0 12px;font-size:14px;font-weight:700;color:#92400e;">Conflict Details</p>
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr><td style="padding:5px 0;font-size:14px;color:#666;width:40%;">New Course</td><td style="font-size:14px;color:#1a1a2e;font-weight:600;">{new_course}</td></tr>
              <tr><td style="padding:5px 0;font-size:14px;color:#666;">Clashes With</td><td style="font-size:14px;color:#1a1a2e;font-weight:600;">{conflict_course}</td></tr>
              <tr><td style="padding:5px 0;font-size:14px;color:#666;">Day</td><td style="font-size:14px;color:#1a1a2e;font-weight:600;">{day}</td></tr>
              <tr><td style="padding:5px 0;font-size:14px;color:#666;">Time Slot</td><td style="font-size:14px;color:#d97706;font-weight:700;">{time_range}</td></tr>
            </table>
          </div>
          <p style="margin:0 0 16px;font-size:14px;color:#555;">
            Both courses still appear on your schedule. Please contact your lecturer or academic advisor if you need help resolving this conflict.
          </p>
          <p style="margin:0;font-size:13px;color:#aaa;border-top:1px solid #eee;padding-top:16px;">Cortex — Cortex Learning Platform</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>"""
    _send(to, subject, html)


def send_weekly_timetable(to: str, name: str, week_label: str, rows: list, role: str = 'student') -> None:
    """Send the weekly timetable digest email.
    rows: list of dicts with keys: day, date, time, course, course_code, room, extra
    role: 'lecturer' (extra = enrolled_count) or 'student' (extra = lecturer_name)
    """
    subject = f"Your Weekly Timetable — {week_label}"
    is_lecturer = role == 'lecturer'
    accent = "#0f766e" if is_lecturer else "#4f46e5"
    accent_light = "#f0faf9" if is_lecturer else "#f0f0ff"
    role_label = "Teaching Schedule" if is_lecturer else "Class Schedule"
    extra_header = "Students" if is_lecturer else "Lecturer"

    if rows:
        rows_html = ""
        current_day = None
        for r in rows:
            if r['day'] != current_day:
                current_day = r['day']
                rows_html += f"""
                <tr>
                  <td colspan="5" style="padding:12px 16px 4px;font-size:12px;font-weight:700;color:{accent};
                      text-transform:uppercase;letter-spacing:.7px;background:{accent_light};">
                    {r['day']} &nbsp;&nbsp;<span style="font-weight:400;color:#888;font-size:11px;">{r['date']}</span>
                  </td>
                </tr>"""
            course_str = r['course']
            if r.get('course_code'):
                course_str += f" <span style='color:#888;font-size:12px;'>({r['course_code']})</span>"
            room_str = f"<span style='color:#888;font-size:12px;'>&#128205; {r['room']}</span>" if r.get('room') else ""
            extra_str = str(r.get('extra', ''))
            rows_html += f"""
            <tr style="border-bottom:1px solid #f0f0f0;">
              <td style="padding:10px 16px;font-size:14px;color:#1a1a2e;font-weight:600;white-space:nowrap;">{r['time']}</td>
              <td style="padding:10px 8px;font-size:14px;color:#333;">{course_str}</td>
              <td style="padding:10px 8px;font-size:13px;color:#666;">{room_str}</td>
              <td style="padding:10px 8px 10px 16px;font-size:13px;color:#666;">{extra_str}</td>
            </tr>"""
        table_content = f"""
        <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
          <thead>
            <tr style="background:#f8f9fa;">
              <th style="padding:10px 16px;font-size:12px;color:#888;text-align:left;font-weight:600;text-transform:uppercase;letter-spacing:.5px;">Time</th>
              <th style="padding:10px 8px;font-size:12px;color:#888;text-align:left;font-weight:600;text-transform:uppercase;letter-spacing:.5px;">Course</th>
              <th style="padding:10px 8px;font-size:12px;color:#888;text-align:left;font-weight:600;text-transform:uppercase;letter-spacing:.5px;">Room</th>
              <th style="padding:10px 8px 10px 16px;font-size:12px;color:#888;text-align:left;font-weight:600;text-transform:uppercase;letter-spacing:.5px;">{extra_header}</th>
            </tr>
          </thead>
          <tbody>{rows_html}</tbody>
        </table>"""
    else:
        table_content = """
        <div style="text-align:center;padding:32px;color:#aaa;">
          <p style="margin:0;font-size:15px;">No classes scheduled this week.</p>
        </div>"""

    html = f"""
<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f4f6f9;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:40px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.08);">

        <tr><td style="background:linear-gradient(135deg,{accent},{accent}cc);padding:28px 40px;">
          <p style="margin:0;color:rgba(255,255,255,.75);font-size:12px;text-transform:uppercase;letter-spacing:1px;">Cortex · Weekly {role_label}</p>
          <h1 style="margin:8px 0 4px;color:#fff;font-size:22px;">&#128197; {week_label}</h1>
          <p style="margin:0;color:rgba(255,255,255,.8);font-size:13px;">Here's what's coming up for you this week</p>
        </td></tr>

        <tr><td style="padding:28px 40px 8px;">
          <p style="margin:0 0 20px;font-size:15px;color:#333;">Hi <strong>{name}</strong>,</p>
          <p style="margin:0 0 20px;font-size:14px;color:#555;line-height:1.6;">
            Here is your {'teaching ' if is_lecturer else ''}timetable for the week of <strong>{week_label}</strong>.
            {'Make sure to start lectures on time — students are notified when a session goes live.' if is_lecturer else 'Join live sessions on time and click the attendance cookie to mark your presence.'}
          </p>
        </td></tr>

        <tr><td style="padding:0 24px;">
          <div style="border:1px solid #eee;border-radius:8px;overflow:hidden;">
            {table_content}
          </div>
        </td></tr>

        <tr><td style="padding:24px 40px 32px;">
          <p style="margin:0 0 16px;font-size:13px;color:#555;">
            Log in to Cortex to view your full {'schedule' if is_lecturer else 'timetable'} and manage your {'classes' if is_lecturer else 'courses'}.
          </p>
          <p style="margin:0;font-size:12px;color:#aaa;border-top:1px solid #eee;padding-top:16px;text-align:center;">
            Cortex — Cortex Learning Platform
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body></html>"""
    _send(to, subject, html)


def send_tutor_rejected(to: str, name: str, course: str) -> None:
    subject = f"Study Hub Tutor Application Update — {course}"
    html = f"""
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f4f6f9;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:40px 20px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.08);">
        <tr><td style="background:linear-gradient(135deg,#64748b,#94a3b8);padding:32px 40px;text-align:center;">
          <div style="font-size:48px;margin-bottom:8px;">&#128210;</div>
          <h1 style="margin:0;color:#fff;font-size:24px;font-weight:700;">Application Update</h1>
          <p style="margin:6px 0 0;color:rgba(255,255,255,.85);font-size:13px;">Study Hub — Peer Tutor Selection</p>
        </td></tr>
        <tr><td style="padding:40px;">
          <p style="margin:0 0 16px;font-size:16px;color:#1a1a2e;">Hi <strong>{name}</strong>,</p>
          <p style="margin:0 0 24px;font-size:15px;color:#444;">Thank you for applying to be a Peer Tutor for <strong>{course}</strong>. After careful consideration, your lecturer has selected other students for this session.</p>
          <p style="margin:0 0 24px;font-size:15px;color:#444;">We encourage you to keep participating in the Study Hub and apply again in future sessions.</p>
          <p style="margin:0;font-size:13px;color:#aaa;border-top:1px solid #eee;padding-top:20px;text-align:center;">Cortex — Cortex Learning Platform</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>"""
    _send(to, subject, html)


def send_password_reset_code(to: str, name: str, code: str) -> None:
    subject = "Reset your Cortex password"
    html = f"""
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f4f6f9;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:40px 20px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.08);">

        <tr><td style="background:linear-gradient(135deg,#0f172a,#1e3a5f);padding:32px 40px;text-align:center;">
          <div style="font-size:48px;margin-bottom:8px;">&#128274;</div>
          <h1 style="margin:0;color:#fff;font-size:26px;font-weight:700;letter-spacing:-0.5px;">Password Reset</h1>
          <p style="margin:6px 0 0;color:rgba(255,255,255,.75);font-size:13px;">Cortex — Cortex Learning Platform</p>
        </td></tr>

        <tr><td style="padding:40px;">
          <p style="margin:0 0 8px;font-size:16px;color:#1a1a2e;">Hi <strong>{name}</strong>,</p>
          <p style="margin:0 0 28px;font-size:15px;color:#555;line-height:1.6;">
            We received a request to reset your Cortex password. Use the code below to continue.
            If you did not make this request, you can safely ignore this email.
          </p>

          <div style="background:#fff7ed;border:2px dashed #f97316;border-radius:12px;padding:24px;text-align:center;margin-bottom:28px;">
            <p style="margin:0 0 6px;font-size:12px;color:#999;text-transform:uppercase;letter-spacing:1px;">Your reset code</p>
            <p style="margin:0;font-size:44px;font-weight:800;color:#ea580c;letter-spacing:12px;">{code}</p>
          </div>

          <p style="margin:0 0 28px;font-size:14px;color:#888;text-align:center;">
            This code expires in <strong>15 minutes</strong>. Do not share it with anyone.
          </p>

          <p style="margin:0;font-size:13px;color:#aaa;border-top:1px solid #eee;padding-top:20px;text-align:center;">
            Cortex — Cortex Learning Platform
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body></html>"""
    _send(to, subject, html)


def send_account_deleted(to: str, name: str, role: str, id_number: str) -> None:
    subject = "Your Cortex account has been deleted"
    id_label = "Matric number" if role == "student" else "Staff number"
    html = f"""
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f4f6f9;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:40px 20px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.08);">

        <tr><td style="background:linear-gradient(135deg,#1a1a2e,#7f1d1d);padding:32px 40px;text-align:center;">
          <div style="font-size:48px;margin-bottom:8px;">&#128683;</div>
          <h1 style="margin:0;color:#fff;font-size:26px;font-weight:700;letter-spacing:-0.5px;">Account Deleted</h1>
          <p style="margin:6px 0 0;color:rgba(255,255,255,.65);font-size:13px;">Cortex — Cortex Learning Platform</p>
        </td></tr>

        <tr><td style="padding:40px;">
          <p style="margin:0 0 12px;font-size:16px;color:#1a1a2e;">Hi <strong>{name}</strong>,</p>
          <p style="margin:0 0 24px;font-size:15px;color:#555;line-height:1.6;">
            This email confirms that your Cortex account has been <strong>permanently deleted</strong>
            as requested. All your data including enrollments, submissions, attendance records
            and messages has been removed from our system.
          </p>

          <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:10px;padding:18px 20px;margin-bottom:24px;">
            <p style="margin:0 0 6px;font-size:12px;color:#999;text-transform:uppercase;letter-spacing:1px;">Deleted account</p>
            <p style="margin:0 0 4px;font-size:15px;font-weight:600;color:#1a1a2e;">{name}</p>
            <p style="margin:0;font-size:13px;color:#666;">{id_label}: {id_number}</p>
          </div>

          <p style="margin:0 0 24px;font-size:14px;color:#666;line-height:1.6;">
            If you did <strong>not</strong> request this deletion, please contact your institution
            IT support immediately as your account may have been compromised.
          </p>

          <p style="margin:0;font-size:13px;color:#aaa;border-top:1px solid #eee;padding-top:20px;text-align:center;">
            Thank you for using Cortex &mdash; Cortex Learning Platform
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body></html>"""
    _send(to, subject, html)

