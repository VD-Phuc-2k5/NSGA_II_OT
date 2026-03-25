"""Router API v1 cho nghiệp vụ lập lịch ca trực (1 endpoint submit)."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.application.services.schedule_job_manager import ScheduleJobManager
from app.application.services.schedule_view_builder import (
    build_metrics_response,
    build_schedule_response,
)
from app.domain.schemas import (
    ScheduleGenerationEnvelopeDTO,
    ScheduleJobMetricsResponseDTO,
    ScheduleJobScheduleResponseDTO,
    ScheduleJobStatusDTO,
    ScheduleRequestAcceptedDTO,
    ScheduleRunRequestDTO,
)

router = APIRouter(prefix="/schedules", tags=["Schedules"])
job_manager = ScheduleJobManager(max_workers=3)


def _require_completed_envelope(request_id: str) -> ScheduleGenerationEnvelopeDTO:
    code, envelope, err = job_manager.resolve_job_envelope(request_id)
    if code == "missing":
        raise HTTPException(status_code=404, detail="Không tìm thấy request_id")
    if code == "failed":
        raise HTTPException(
            status_code=409,
            detail=err or "Sinh lịch thất bại",
        )
    if code == "pending":
        raise HTTPException(
            status_code=409,
            detail="Lịch chưa sẵn sàng hoặc job đang chạy",
        )
    return envelope


@router.post(
    "/run",
    response_model=ScheduleRequestAcceptedDTO,
    summary="Bắt đầu tạo lịch trực",
)
def run_schedule(payload: ScheduleRunRequestDTO) -> ScheduleRequestAcceptedDTO:
    """Đưa job vào hàng đợi tối ưu NSGA-II với payload nghiệp vụ."""
    try:
        return job_manager.submit(payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get(
    "/progress/{request_id}",
    response_model=ScheduleJobStatusDTO,
    summary="Theo dõi tiến độ job (không kèm lịch/chỉ số)",
)
def get_schedule_progress(request_id: str) -> ScheduleJobStatusDTO:
    progress = job_manager.get_status(request_id)
    if progress is None:
        raise HTTPException(status_code=404, detail="Không tìm thấy request_id")
    return progress


@router.get(
    "/jobs/{request_id}/schedule",
    response_model=ScheduleJobScheduleResponseDTO,
    summary="Lấy lịch trực và các phương án Pareto (sau khi job xong)",
)
def get_job_schedule(request_id: str) -> ScheduleJobScheduleResponseDTO:
    envelope = _require_completed_envelope(request_id)
    return build_schedule_response(request_id, envelope)


@router.get(
    "/jobs/{request_id}/metrics",
    response_model=ScheduleJobMetricsResponseDTO,
    summary="Lấy chỉ số công bằng và fitness từng phương án (sau khi job xong)",
)
def get_job_metrics(request_id: str) -> ScheduleJobMetricsResponseDTO:
    envelope = _require_completed_envelope(request_id)
    return build_metrics_response(request_id, envelope)
