"""Quan ly job sinh lich truc bat dong bo, ho tro nhieu request dong thoi."""

from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from threading import Lock
from typing import Dict, Literal, Optional, Tuple
from uuid import uuid4

from app.application.use_cases.generate_schedule import GenerateScheduleUseCase
from app.domain.schemas import (
    ScheduleGenerationEnvelopeDTO,
    ScheduleGenerationRequestDTO,
    ScheduleJobStatusDTO,
    ScheduleRequestAcceptedDTO,
    ScheduleSetupAcceptedDTO,
)


JobStatus = Literal["queued", "running", "completed", "failed"]


@dataclass
class _JobState:
    request_id: str
    status: JobStatus
    progress_percent: int
    message: str
    result: Optional[ScheduleGenerationEnvelopeDTO] = None
    error: Optional[str] = None


class ScheduleJobManager:
    """Quan ly vong doi cua cac job sinh lich truc."""

    def __init__(self, max_workers: int = 2) -> None:
        self._executor = ThreadPoolExecutor(max_workers=max_workers)
        self._lock = Lock()
        self._jobs: Dict[str, _JobState] = {}
        self._setups: Dict[str, ScheduleGenerationRequestDTO] = {}

    def create_setup(self, payload: ScheduleGenerationRequestDTO) -> ScheduleSetupAcceptedDTO:
        setup_id = str(uuid4())
        with self._lock:
            self._setups[setup_id] = payload
        return ScheduleSetupAcceptedDTO(
            setup_id=setup_id,
            message="Đã lưu thông số. Gọi POST /schedules/run để bắt đầu tối ưu.",
        )

    def start_from_setup(self, setup_id: str) -> ScheduleRequestAcceptedDTO:
        with self._lock:
            payload = self._setups.get(setup_id)
        if payload is None:
            raise KeyError("Không tìm thấy setup_id")
        return self.submit(payload)

    def submit(self, payload: ScheduleGenerationRequestDTO) -> ScheduleRequestAcceptedDTO:
        request_id = str(uuid4())
        job = _JobState(
            request_id=request_id,
            status="queued",
            progress_percent=0,
            message="Yêu cầu đã được đưa vào hàng đợi",
        )

        with self._lock:
            self._jobs[request_id] = job

        self._executor.submit(self._run_job, request_id, payload)

        return ScheduleRequestAcceptedDTO(
            request_id=request_id,
            status=job.status,
            progress_percent=job.progress_percent,
            message=job.message,
        )

    def get_status(self, request_id: str) -> Optional[ScheduleJobStatusDTO]:
        with self._lock:
            job = self._jobs.get(request_id)
            if job is None:
                return None

            return ScheduleJobStatusDTO(
                request_id=job.request_id,
                status=job.status,
                progress_percent=job.progress_percent,
                message=job.message,
                error=job.error,
            )

    def resolve_job_envelope(
        self, request_id: str
    ) -> Tuple[
        Literal["missing", "pending", "failed", "ok"],
        Optional[ScheduleGenerationEnvelopeDTO],
        Optional[str],
    ]:
        with self._lock:
            job = self._jobs.get(request_id)
            if job is None:
                return "missing", None, None
            if job.status == "failed":
                return "failed", None, job.error
            if job.status != "completed" or job.result is None:
                return "pending", None, None
            return "ok", job.result, None

    def _update(self, request_id: str, **kwargs: object) -> None:
        with self._lock:
            job = self._jobs.get(request_id)
            if job is None:
                return

            for key, value in kwargs.items():
                setattr(job, key, value)

    def _run_job(self, request_id: str, payload: ScheduleGenerationRequestDTO) -> None:
        try:
            use_case = GenerateScheduleUseCase()

            self._update(
                request_id,
                progress_percent=1,
                message="Đang tối ưu bằng NSGA-II cải tiến",
            )

            def on_generation(generation: int, total_generations: int) -> None:
                ratio = generation / max(total_generations, 1)
                progress = min(99, 1 + int(ratio * 98))
                self._update(
                    request_id,
                    progress_percent=progress,
                    message=(
                        f"Đang tối ưu bằng NSGA-II cải tiến "
                        f"(thế hệ {generation}/{total_generations})"
                    ),
                )

            result = use_case.execute(payload, progress_callback=on_generation)

            self._update(
                request_id,
                status="completed",
                progress_percent=100,
                message="Hoàn tất sinh lịch trực",
                result=result,
            )
        except Exception as exc:
            self._update(
                request_id,
                status="failed",
                progress_percent=100,
                message="Sinh lịch thất bại",
                error=str(exc),
            )
