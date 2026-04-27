from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import Base, engine
from app.routers.auth import router as auth_router
from app.routers.students import router as students_router
from app.routers.assignments import router as assignments_router
from app.routers.other_routers import (
    classes_router,
    attendance_router,
    schedule_router,
    exams_router,
    messages_router,
    announcements_router,
    analytics_router,
)

# Create all database tables on startup
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="EduHub API",
    description="Backend API for the EduHub Learning Management System",
    version="1.0.0",
)

# CORS — allow the frontend to talk to this backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",                        # Next.js local dev
        "https://v0-learning-manage.vercel.app",        # deployed frontend
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register all routers
app.include_router(auth_router)
app.include_router(classes_router)
app.include_router(students_router)
app.include_router(assignments_router)
app.include_router(attendance_router)
app.include_router(schedule_router)
app.include_router(exams_router)
app.include_router(messages_router)
app.include_router(announcements_router)
app.include_router(analytics_router)


@app.get("/")
def root():
    return {"message": "EduHub API is running", "docs": "/docs"}
