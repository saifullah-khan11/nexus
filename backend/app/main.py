from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from sqlalchemy import text

from app.api.chat import router as chat_router
from app.api.auth import router as auth_router
from app.api.approval import router as approval_router
from app.api.requests import router as requests_router
from app.api.notifications import router as notifications_router
from app.api import admin
from app.core.database import engine
from app.api.nexus import router as nexus_router
from app.api.signup import router as signup_router
from app.api.student import router as student_router
from app.api.documents import router as documents_router
from app.api.service_catalog import router as service_catalog_router
from app.api.service_template_upload import router as service_template_upload_router

app = FastAPI(
    title="NEXUS API",
    description="Human-governed autonomous university service agent",
    version="0.1.0",
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000",
                   "https://nexus-209lorh4v-saifullah-khan11s-projects.vercel.app",
                   "https://asknexus.in",],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(chat_router)
app.include_router(auth_router)
app.include_router(approval_router)
app.include_router(requests_router)
app.include_router(notifications_router)
app.include_router(admin.router)
app.include_router(nexus_router)
app.include_router(signup_router)
app.include_router(student_router)
app.include_router(documents_router)
app.include_router(service_catalog_router)
app.include_router(service_template_upload_router)

@app.get("/")
def root():
    return {
        "name": "NEXUS",
        "status": "online",
        "version": "0.1.0",
    }


@app.get("/health")
def health():
    return {
        "status": "healthy",
    }


@app.get("/db-health")
def db_health():
    with engine.connect() as connection:
        result = connection.execute(text("SELECT 1"))
        return {
            "database": "connected",
            "result": result.scalar(),
        }