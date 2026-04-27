# EduHub Backend

FastAPI + PostgreSQL backend for the EduHub LMS.

## Setup

### 1. Create virtual environment
```bash
python -m venv venv
source venv/bin/activate        # Mac/Linux
venv\Scripts\activate           # Windows
```

### 2. Install dependencies
```bash
pip install -r requirements.txt
```

### 3. Set up PostgreSQL
Create a database called `eduhub` in PostgreSQL, then update `.env`:
```
DATABASE_URL=postgresql://postgres:yourpassword@localhost:5432/eduhub
SECRET_KEY=pick-any-long-random-string
```

### 4. Run the server
```bash
uvicorn main:app --reload
```

### 5. Open API docs
Visit http://localhost:8000/docs — Swagger UI is auto-generated.

## Project structure
```
eduhub/
├── main.py                  # App entry point
├── requirements.txt
├── .env                     # Your secrets (never commit this)
└── app/
    ├── config.py            # Loads .env variables
    ├── database.py          # DB engine and session
    ├── models.py            # All SQLAlchemy models
    ├── schemas.py           # All Pydantic request/response shapes
    ├── auth.py              # JWT + password hashing
    └── routers/
        ├── auth.py          # POST /api/auth/register, /login
        ├── students.py      # GET/POST /api/students
        ├── assignments.py   # CRUD /api/assignments
        └── other_routers.py # classes, attendance, schedule, exams, messages, analytics
```

## API endpoints summary
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/auth/register | Create account |
| POST | /api/auth/login | Get JWT token |
| GET | /api/students | List all students |
| GET | /api/students/class/{id} | Students in a class |
| POST | /api/students/enroll | Enroll student in class |
| GET | /api/assignments | List assignments |
| POST | /api/assignments | Create assignment |
| POST | /api/assignments/{id}/submit | Submit assignment |
| POST | /api/attendance/bulk | Mark attendance for whole class |
| GET | /api/attendance/class/{id} | Get class attendance |
| GET | /api/schedule/today | Today's classes |
| POST | /api/exams | Create exam |
| POST | /api/exams/results | Record exam result |
| GET | /api/messages/inbox | Get inbox |
| POST | /api/messages | Send message |
| GET | /api/analytics/dashboard | Dashboard stats |
