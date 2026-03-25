"""
Use case sinh lịch trực bác sĩ.
"""

from __future__ import annotations

from typing import Callable

from app.config import AppSettings, get_settings
from app.domain.nsga_scheduler import NsgaDutySchedulerService
from app.domain.schemas import (
    ScheduleGenerationEnvelopeDTO,
    ScheduleGenerationRequestDTO,
    ScheduleRunRequestDTO,
)


class GenerateScheduleUseCase:
    """Điểm vào của tầng ứng dụng cho nghiệp vụ tạo lịch."""

    def __init__(
        self,
        scheduler_service: NsgaDutySchedulerService | None = None,
        settings: AppSettings | None = None,
    ) -> None:
        self.scheduler_service = scheduler_service or NsgaDutySchedulerService()
        self.settings = settings or get_settings()

    def _build_generation_request(
        self,
        request: ScheduleRunRequestDTO,
    ) -> ScheduleGenerationRequestDTO:
        return ScheduleGenerationRequestDTO(
            start_date=request.start_date,
            num_days=request.num_days,
            max_weekly_hours_per_doctor=request.max_weekly_hours_per_doctor,
            max_days_off_per_doctor=request.max_days_off_per_doctor,
            rooms_per_shift=request.rooms_per_shift,
            doctors_per_room=request.doctors_per_room,
            shifts_per_day=request.shifts_per_day,
            doctors=request.doctors,
            random_seed=self.settings.random_seed,
            randomization_strength=self.settings.randomization_strength,
            optimizer_population_size=self.settings.optimizer_population_size,
            optimizer_generations=self.settings.optimizer_generations,
            pareto_options_limit=self.settings.pareto_options_limit,
        )

    def execute(
        self,
        request: ScheduleRunRequestDTO,
        progress_callback: Callable[[int, int], None] | None = None,
    ) -> ScheduleGenerationEnvelopeDTO:
        generation_request = self._build_generation_request(request)
        return self.scheduler_service.generate(generation_request, progress_callback=progress_callback)
