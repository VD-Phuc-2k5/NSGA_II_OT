"""
Use case sinh lịch trực bác sĩ.
"""

from __future__ import annotations

from typing import Callable

from app.domain.nsga_scheduler import NsgaDutySchedulerService
from app.domain.schemas import ScheduleGenerationEnvelopeDTO, ScheduleGenerationRequestDTO


class GenerateScheduleUseCase:
    """Điểm vào của tầng ứng dụng cho nghiệp vụ tạo lịch."""

    def __init__(self, scheduler_service: NsgaDutySchedulerService | None = None) -> None:
        self.scheduler_service = scheduler_service or NsgaDutySchedulerService()

    def execute(
        self,
        request: ScheduleGenerationRequestDTO,
        progress_callback: Callable[[int, int], None] | None = None,
    ) -> ScheduleGenerationEnvelopeDTO:
        return self.scheduler_service.generate(request, progress_callback=progress_callback)
