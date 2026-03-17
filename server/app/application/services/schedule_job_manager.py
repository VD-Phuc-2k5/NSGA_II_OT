"""Quan ly job sinh lich truc bat dong bo, ho tro nhieu request dong thoi."""

from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from threading import Lock
from typing import Dict, Literal, Optional
from uuid import uuid4

from app.application.use_cases.generate_schedule import GenerateScheduleUseCase
from app.domain.schemas import (
    ScheduleGenerationEnvelopeDTO,
    ScheduleGenerationRequestDTO,
    ScheduleRequestAcceptedDTO,
    ScheduleRequestProgressDTO,
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

    def submit(self, payload: ScheduleGenerationRequestDTO) -> ScheduleRequestAcceptedDTO:
        request_id = str(uuid4())
        job = _JobState(
            request_id=request_id,
            status="queued",
            progress_percent=0,
            message="Yeu cau da duoc dua vao hang doi",
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

    def get_progress(self, request_id: str) -> Optional[ScheduleRequestProgressDTO]:
        with self._lock:
            job = self._jobs.get(request_id)
            if job is None:
                return None

            return ScheduleRequestProgressDTO(
                request_id=job.request_id,
                status=job.status,
                progress_percent=job.progress_percent,
                message=job.message,
                result=job.result,
                error=job.error,
            )

    def _update(self, request_id: str, **kwargs: object) -> None:
        with self._lock:
            job = self._jobs.get(request_id)
            if job is None:
                return

            for key, value in kwargs.items():
                setattr(job, key, value)

    def _run_job(self, request_id: str, payload: ScheduleGenerationRequestDTO) -> None:
        try:
            self._update(
                request_id,
                status="running",
                progress_percent=10,
                message="Dang kiem tra du lieu dau vao",
            )

            use_case = GenerateScheduleUseCase()

            self._update(
                request_id,
                progress_percent=35,
                message="Dang toi uu bang NSGA-II cai tien",
            )

            def on_generation(generation: int, total_generations: int) -> None:
                # Chia tien do toi uu vao khoang 35% -> 85% de UI thay duoc tung generation.
                ratio = generation / max(total_generations, 1)
                progress = min(85, 35 + int(ratio * 50))
                self._update(
                    request_id,
                    progress_percent=progress,
                    message=(
                        f"Dang toi uu bang NSGA-II cai tien "
                        f"(generation {generation}/{total_generations})"
                    ),
                )

            result = use_case.execute(payload, progress_callback=on_generation)

            self._update(
                request_id,
                progress_percent=85,
                message="Dang dong goi ket qua lich truc",
            )

            self._update(
                request_id,
                status="completed",
                progress_percent=100,
                message="Hoan tat sinh lich truc",
                result=result,
            )
        except Exception as exc:  # pragma: no cover - defensive runtime branch
            self._update(
                request_id,
                status="failed",
                progress_percent=100,
                message="Sinh lich that bai",
                error=str(exc),
            )
