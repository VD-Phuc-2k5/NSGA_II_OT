"""
Router tổng hợp cho toàn bộ API của hệ thống.
"""

from fastapi import APIRouter

from app.api.v1.scheduling import router as scheduling_router

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(scheduling_router)
