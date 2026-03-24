"""Chuyển envelope nội bộ sang DTO API tách lịch / chỉ số."""

from __future__ import annotations

from app.domain.schemas import (
    ParetoScheduleAssignmentsDTO,
    ParetoScheduleMetricsItemDTO,
    ScheduleGenerationEnvelopeDTO,
    ScheduleJobMetricsResponseDTO,
    ScheduleJobScheduleResponseDTO,
    ScheduleSliceDTO,
)


def build_schedule_response(
    request_id: str,
    envelope: ScheduleGenerationEnvelopeDTO,
) -> ScheduleJobScheduleResponseDTO:
    sel = envelope.selected_schedule
    selected = ScheduleSliceDTO(
        start_date=sel.start_date,
        num_days=sel.num_days,
        rooms_per_shift=sel.rooms_per_shift,
        doctors_per_room=sel.doctors_per_room,
        shifts_per_day=sel.shifts_per_day,
        assignments=sel.assignments,
    )
    pareto = [
        ParetoScheduleAssignmentsDTO(
            option_id=opt.option_id,
            assignments=opt.assignments,
            doctor_workload_balances=opt.doctor_workload_balances,
        )
        for opt in envelope.pareto_options
    ]
    return ScheduleJobScheduleResponseDTO(
        request_id=request_id,
        selected_option_id=envelope.selected_option_id,
        selected=selected,
        pareto_options=pareto,
    )


def build_metrics_response(
    request_id: str,
    envelope: ScheduleGenerationEnvelopeDTO,
) -> ScheduleJobMetricsResponseDTO:
    return ScheduleJobMetricsResponseDTO(
        request_id=request_id,
        algorithm_run_metrics=envelope.algorithm_run_metrics,
        pareto_options=[
            ParetoScheduleMetricsItemDTO(option_id=opt.option_id, metrics=opt.metrics)
            for opt in envelope.pareto_options
        ],
    )
