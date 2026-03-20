"""DTO schema cho API lập lịch ca trực bác sĩ."""

from __future__ import annotations

from datetime import date
from typing import Dict, List, Literal, Optional

from pydantic import BaseModel, Field, field_validator, model_validator


class DoctorProfileDTO(BaseModel):
    """Thông tin hồ sơ bác sĩ dùng cho tối ưu lịch trực."""

    id: str
    name: str
    experiences: float = Field(ge=0)
    department_id: str
    specialization: str
    days_off: List[date] = Field(default_factory=list)
    preferred_extra_days: List[date] = Field(default_factory=list)


class ScheduleGenerationRequestDTO(BaseModel):
    """Payload yêu cầu sinh lịch trực theo chu kỳ ngày."""

    start_date: date
    num_days: int = Field(default=7, ge=1, le=31)
    max_weekly_hours_per_doctor: int = Field(default=48, ge=24, le=96)
    max_days_off_per_doctor: int = Field(default=5, ge=0, le=14)
    required_doctors_per_shift: int = Field(default=5, ge=1)
    shifts_per_day: int = Field(default=2, ge=2, le=2)
    doctors: List[DoctorProfileDTO] = Field(min_length=12)
    holiday_dates: List[date] = Field(default_factory=list)
    random_seed: Optional[int] = Field(default=None)
    randomization_strength: float = Field(default=0.08, ge=0.0, le=0.35)
    optimizer_population_size: int = Field(default=120, ge=50, le=400)
    optimizer_generations: int = Field(default=150, ge=50, le=500)
    pareto_options_limit: int = Field(default=6, ge=2, le=12)

    @field_validator("doctors")
    @classmethod
    def validate_unique_doctor_id(cls, value: List[DoctorProfileDTO]) -> List[DoctorProfileDTO]:
        ids = [d.id for d in value]
        if len(ids) != len(set(ids)):
            raise ValueError("Danh sach bac si co id bi trung")
        return value

    @model_validator(mode="after")
    def validate_doctor_constraints(self) -> "ScheduleGenerationRequestDTO":
        for doctor in self.doctors:
            unique_days_off = set(doctor.days_off)
            if len(unique_days_off) > self.max_days_off_per_doctor:
                raise ValueError(
                    f"Bac si {doctor.id} vuot qua so ngay nghi toi da "
                    f"({len(unique_days_off)} > {self.max_days_off_per_doctor})"
                )
        return self


class ShiftAssignmentDTO(BaseModel):
    """Kết quả phân công bác sĩ cho một ca trực."""

    date: date
    shift: str
    doctor_ids: List[str]


class ScheduleQualityMetricsDTO(BaseModel):
    """Các chỉ số đánh giá chất lượng nghiệm lịch trực."""

    hard_violation_score: float
    soft_violation_score: float
    fairness_std: float
    shift_fairness_std: float
    day_off_fairness_std: float
    day_off_fairness_jain: float
    weekly_fairness_jain: float
    monthly_fairness_jain: float
    yearly_fairness_jain: float
    holiday_fairness_jain: float
    hard_score_visual: int
    soft_score_visual: int
    fairness_score_visual: int
    overall_score_visual: int
    score_badges: Dict[str, str]
    weekly_underwork_doctors: List[str]


class ScheduleGenerationResultDTO(BaseModel):
    """Kết quả lịch trực sau khi tối ưu hoàn tất."""

    start_date: date
    num_days: int
    required_doctors_per_shift: int
    shifts_per_day: int
    metrics: ScheduleQualityMetricsDTO
    assignments: List[ShiftAssignmentDTO]


class DoctorWorkloadBalanceDTO(BaseModel):
    """Thong ke can bang so luong ca truc cua bac si."""

    doctor_id: str
    doctor_name: str
    weekly_shift_count: int
    monthly_shift_count: int
    yearly_estimated_shift_count: int
    holiday_shift_count: int
    day_off_count: int


class ParetoScheduleOptionDTO(BaseModel):
    """Mot phuong an lich truc thuoc tap Pareto de truong khoa lua chon."""

    option_id: str
    metrics: ScheduleQualityMetricsDTO
    assignments: List[ShiftAssignmentDTO]
    doctor_workload_balances: List[DoctorWorkloadBalanceDTO]


class AlgorithmRunMetricsDTO(BaseModel):
    """Chỉ số đánh giá hiệu quả lần chạy thuật toán NSGA-II."""

    elapsed_seconds: float = Field(description="Thời gian chạy (giây)")
    n_generations: int = Field(description="Số thế hệ đã chạy")
    population_size: int = Field(description="Kích thước quần thể")
    pareto_front_size: int = Field(description="Số nghiệm trên Pareto front 1")
    best_hard_objective: float = Field(description="Giá trị mục tiêu hard (penalty) tốt nhất trên front 1")
    best_balance_objective: float = Field(description="Giá trị mục tiêu balance tốt nhất trên front 1")
    convergence_hard_ratio: Optional[float] = Field(
        default=None,
        description="Mức cải thiện mục tiêu hard từ gen đầu → gen cuối (0–1, càng cao càng tốt)",
    )
    convergence_balance_ratio: Optional[float] = Field(
        default=None,
        description="Mức cải thiện mục tiêu balance từ gen đầu → gen cuối (0–1)",
    )


class ScheduleGenerationEnvelopeDTO(BaseModel):
    """Ket qua tong hop gom nghiem chon va danh sach phuong an Pareto."""

    selected_option_id: str
    selected_schedule: ScheduleGenerationResultDTO
    pareto_options: List[ParetoScheduleOptionDTO]
    algorithm_run_metrics: Optional[AlgorithmRunMetricsDTO] = Field(
        default=None,
        description="Chỉ số hiệu quả lần chạy thuật toán (để đánh giá độ hội tụ, thời gian)",
    )


class ScheduleRequestAcceptedDTO(BaseModel):
    """Phản hồi khi server nhận yêu cầu và xử lý bất đồng bộ."""

    request_id: str = Field(description="Mã yêu cầu dùng để tra cứu tiến độ")
    status: Literal["queued", "running", "completed", "failed"]
    progress_percent: int = Field(ge=0, le=100)
    message: str


class ScheduleRequestProgressDTO(BaseModel):
    """Trạng thái tiến độ của một yêu cầu sinh lịch trực."""

    request_id: str
    status: Literal["queued", "running", "completed", "failed"]
    progress_percent: int = Field(ge=0, le=100)
    message: str
    result: Optional[ScheduleGenerationEnvelopeDTO] = None
    error: Optional[str] = None
