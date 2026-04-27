# EduHub LMS — Backend

FastAPI + PostgreSQL backend for the EduHub Learning Management System.

> **Frontend** lives at [v0-learning-manage.vercel.app](https://v0-learning-manage.vercel.app) and is managed via [v0.app](https://v0.app/chat/projects/prj_B2qxi9W9MQWofa0TD0UAo7RA1QUI).

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

### 3. Configure environment
Copy `.env.example` to `.env` and fill in:
```
DATABASE_URL=postgresql://postgres:yourpassword@localhost:5432/eduhub
SECRET_KEY=pick-any-long-random-string
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60
```

### 4. Run the server
```bash
uvicorn main:app --reload
```

Visit http://localhost:8000/docs for the Swagger UI.

## Project structure
```
eduhub/
├── main.py
├── requirements.txt
├── Procfile               # Railway deploy
├── railway.toml
└── app/
    ├── config.py
    ├── database.py
    ├── models.py
    ├── schemas.py
    ├── auth.py
    └── routers/
        ├── auth.py
        ├── students.py
        ├── assignments.py
        └── other_routers.py
```

## API endpoints
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/auth/register | Create account |
| POST | /api/auth/login | Get JWT token |
| GET | /api/students | List all students |
| POST | /api/students/enroll | Enroll student in class |
| GET | /api/assignments | List assignments |
| POST | /api/assignments | Create assignment |
| POST | /api/assignments/{id}/submit | Submit assignment |
| POST | /api/attendance/bulk | Mark attendance |
| GET | /api/analytics/dashboard | Dashboard stats |
