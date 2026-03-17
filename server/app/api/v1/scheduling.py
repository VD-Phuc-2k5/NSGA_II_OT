"""
Router API v1 cho nghiệp vụ lập lịch ca trực.
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.application.services.schedule_job_manager import ScheduleJobManager
from app.application.use_cases.generate_schedule import GenerateScheduleUseCase
from app.domain.schemas import (
    ScheduleGenerationEnvelopeDTO,
    ScheduleGenerationRequestDTO,
    ScheduleRequestAcceptedDTO,
    ScheduleRequestProgressDTO,
)

router = APIRouter(prefix="/schedules", tags=["Schedules"])
job_manager = ScheduleJobManager(max_workers=3)


@router.post(
    "/generate",
    response_model=ScheduleRequestAcceptedDTO,
    summary="Gửi yêu cầu sinh lịch trực",
)
def generate_schedule(payload: ScheduleGenerationRequestDTO) -> ScheduleRequestAcceptedDTO:
    """Nhận yêu cầu sinh lịch trực và trả mã request để theo dõi tiến độ."""
    try:
        return job_manager.submit(payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get(
    "/progress/{request_id}",
    response_model=ScheduleRequestProgressDTO,
    summary="Theo dõi tiến độ sinh lịch trực",
)
def get_schedule_progress(request_id: str) -> ScheduleRequestProgressDTO:
    """Trả tiến độ hiện tại; khi completed sẽ kèm kết quả lịch trực."""
    progress = job_manager.get_progress(request_id)
    if progress is None:
        raise HTTPException(status_code=404, detail="Khong tim thay request_id")
    return progress


@router.post(
    "/generate-sync",
    response_model=ScheduleGenerationEnvelopeDTO,
    summary="Sinh lịch trực đồng bộ (fallback)",
)
def generate_schedule_sync(payload: ScheduleGenerationRequestDTO) -> ScheduleGenerationEnvelopeDTO:
    """API đồng bộ để debug nhanh hoặc tích hợp đơn giản."""
    try:
        use_case = GenerateScheduleUseCase()
        return use_case.execute(payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
