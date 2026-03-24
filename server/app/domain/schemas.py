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
    has_valid_license: bool = Field(default=True, description="Giấy phép hành nghề hợp lệ (HC-08)")
    is_intern: bool = Field(default=False, description="Bác sĩ thực tập — cần supervisor cùng ca (HC-08)")


class ScheduleGenerationRequestDTO(BaseModel):
    """Payload yêu cầu sinh lịch trực theo chu kỳ ngày."""

    start_date: date
    num_days: int = Field(default=7, ge=1, le=31)
    max_weekly_hours_per_doctor: int = Field(default=48, ge=24, le=96)
    max_days_off_per_doctor: int = Field(default=5, ge=0, le=14)
    rooms_per_shift: int = Field(default=1, ge=1, le=10, description="Số phòng khám hoạt động mỗi ca")
    doctors_per_room: int = Field(default=5, ge=1, le=15, description="Số bác sĩ yêu cầu mỗi phòng")
    shifts_per_day: int = Field(default=2, ge=2, le=2)
    doctors: List[DoctorProfileDTO] = Field(min_length=12)
    random_seed: Optional[int] = Field(default=None)
    randomization_strength: float = Field(default=0.08, ge=0.0, le=0.35)
    optimizer_population_size: int = Field(default=250, ge=50, le=500)
    optimizer_generations: int = Field(default=400, ge=50, le=800)
    pareto_options_limit: int = Field(default=6, ge=2, le=12)

    @field_validator("doctors")
    @classmethod
    def validate_unique_doctor_id(cls, value: List[DoctorProfileDTO]) -> List[DoctorProfileDTO]:
        ids = [d.id for d in value]
        if len(ids) != len(set(ids)):
            raise ValueError("Danh sách bác sĩ có id trùng")
        return value

    @model_validator(mode="after")
    def validate_doctor_constraints(self) -> "ScheduleGenerationRequestDTO":
        for doctor in self.doctors:
            unique_days_off = set(doctor.days_off)
            if len(unique_days_off) > self.max_days_off_per_doctor:
                raise ValueError(
                    f"Bác sĩ {doctor.id} vượt quá số ngày nghỉ tối đa "
                    f"({len(unique_days_off)} > {self.max_days_off_per_doctor})"
                )
        return self


class ShiftAssignmentDTO(BaseModel):
    """Kết quả phân công bác sĩ cho một phòng trong một ca trực."""

    date: date
    shift: str
    room: str = Field(description="Mã phòng, ví dụ P-01, P-02")
    doctor_ids: List[str]


class ScheduleQualityMetricsDTO(BaseModel):
    """Các chỉ số đánh giá chất lượng nghiệm lịch trực (4-objective NSGA-II)."""

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
    f3_workload_std: float = Field(default=0.0, description="Objective f3: workload std (SKILL §7)")
    f4_fairness: float = Field(default=0.0, description="Objective f4: 1 - JFI_overall (SKILL §7)")
    gini_workload: float = Field(default=0.0, description="Gini coefficient phan phoi ca (SKILL §5.2)")
    jfi_overall: float = Field(default=1.0, description="Jain Fairness Index tong hop (SKILL §5.2)")
    hard_score_visual: int
    soft_score_visual: int
    workload_score_visual: int = Field(default=100, description="Diem truc quan f3 (0-100)")
    fairness_score_visual: int
    overall_score_visual: int
    score_badges: Dict[str, str]
    weekly_underwork_doctors: List[str]


class ScheduleGenerationResultDTO(BaseModel):
    """Kết quả lịch trực sau khi tối ưu hoàn tất."""

    start_date: date
    num_days: int
    rooms_per_shift: int
    doctors_per_room: int
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
    """Chỉ số đánh giá hiệu quả lần chạy thuật toán NSGA-II (4-objective)."""

    elapsed_seconds: float = Field(description="Thời gian chạy (giây)")
    n_generations: int = Field(description="Số thế hệ đã chạy")
    population_size: int = Field(description="Kích thước quần thể")
    pareto_front_size: int = Field(description="Số nghiệm trên Pareto front 1")
    best_hard_objective: float = Field(description="f1: hard penalty tốt nhất")
    best_soft_objective: float = Field(default=0.0, description="f2: soft penalty tốt nhất")
    best_workload_std_objective: float = Field(default=0.0, description="f3: workload std tốt nhất")
    best_fairness_objective: float = Field(default=0.0, description="f4: 1-JFI tốt nhất")
    convergence_hard_ratio: Optional[float] = Field(
        default=None,
        description="Mức cải thiện f1 từ gen đầu → gen cuối (0–1)",
    )
    convergence_soft_ratio: Optional[float] = Field(
        default=None,
        description="Mức cải thiện f2 từ gen đầu → gen cuối (0–1)",
    )
    convergence_workload_ratio: Optional[float] = Field(
        default=None,
        description="Mức cải thiện f3 từ gen đầu → gen cuối (0–1)",
    )
    convergence_fairness_ratio: Optional[float] = Field(
        default=None,
        description="Mức cải thiện f4 từ gen đầu → gen cuối (0–1)",
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


class ScheduleSetupAcceptedDTO(BaseModel):
    """Phản hồi sau khi lưu thông số tạo lịch (chưa chạy tối ưu)."""

    setup_id: str = Field(description="Mã cấu hình dùng khi gọi API chạy tạo lịch")
    message: str


class ScheduleRunRequestDTO(BaseModel):
    """Payload bắt đầu job tạo lịch từ cấu hình đã setup."""

    setup_id: str = Field(description="Mã setup từ POST /schedules/setup")


class ScheduleSliceDTO(BaseModel):
    """Một lịch trực thuần phân công (không kèm chỉ số chất lượng)."""

    start_date: date
    num_days: int
    rooms_per_shift: int
    doctors_per_room: int
    shifts_per_day: int
    assignments: List[ShiftAssignmentDTO]


class ParetoScheduleAssignmentsDTO(BaseModel):
    """Một phương án Pareto — chỉ lịch và cân bằng ca (phục vụ biểu đồ)."""

    option_id: str
    assignments: List[ShiftAssignmentDTO]
    doctor_workload_balances: List[DoctorWorkloadBalanceDTO]


class ScheduleJobScheduleResponseDTO(BaseModel):
    """Kết quả lịch sau khi job hoàn tất (tách khỏi chỉ số)."""

    request_id: str
    selected_option_id: str
    selected: ScheduleSliceDTO
    pareto_options: List[ParetoScheduleAssignmentsDTO]


class ParetoScheduleMetricsItemDTO(BaseModel):
    """Chỉ số / fitness của một phương án Pareto."""

    option_id: str
    metrics: ScheduleQualityMetricsDTO


class ScheduleJobMetricsResponseDTO(BaseModel):
    """Chỉ số thuật toán và fitness từng phương án (API riêng)."""

    request_id: str
    algorithm_run_metrics: Optional[AlgorithmRunMetricsDTO] = None
    pareto_options: List[ParetoScheduleMetricsItemDTO]


class ScheduleRequestAcceptedDTO(BaseModel):
    """Phản hồi khi server nhận yêu cầu và xử lý bất đồng bộ."""

    request_id: str = Field(description="Mã yêu cầu dùng để tra cứu tiến độ")
    status: Literal["queued", "running", "completed", "failed"]
    progress_percent: int = Field(ge=0, le=100)
    message: str


class ScheduleJobStatusDTO(BaseModel):
    """Trạng thái tiến độ job (không gắn kết quả lịch/chỉ số — gọi API riêng)."""

    request_id: str
    status: Literal["queued", "running", "completed", "failed"]
    progress_percent: int = Field(ge=0, le=100)
    message: str
    error: Optional[str] = None
