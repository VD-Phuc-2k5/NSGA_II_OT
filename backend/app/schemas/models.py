from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Dict, List, Optional

from pydantic import BaseModel, Field


class HospitalTier(str, Enum):
    district = "district"
    provincial = "provincial"
    central = "central"


class ShiftType(str, Enum):
    hc = "HC"
    tr = "TR"
    night = "NIGHT"


class ConstraintGroupB(BaseModel):
    max_hours_per_week: int = 48
    min_rest_hours_after_night: int = 10
    allow_two_consecutive_nights: bool = False


class ConstraintGroupC(BaseModel):
    hospital_tier: HospitalTier = HospitalTier.provincial
    required_specialties_per_shift: Dict[str, List[str]] = Field(default_factory=lambda: {"HC": ["general"], "TR": ["general"], "NIGHT": ["emergency"]})
    min_doctors_per_shift: Dict[str, int] = Field(default_factory=lambda: {"HC": 2, "TR": 2, "NIGHT": 2})


class ConstraintGroupD(BaseModel):
    protect_pregnant: bool = True
    protect_senior: bool = True
    protect_part_time: bool = True
    forbidden_shift_by_flag: Dict[str, List[str]] = Field(default_factory=lambda: {
        "pregnant": ["NIGHT"],
        "senior": [],
        "part_time": ["NIGHT"],
    })


class SoftWeights(BaseModel):
    balance_load: float = 1.0
    preference: float = 1.0
    historical_fairness: float = 1.0


class ConstraintsConfig(BaseModel):
    group_a_label: str = "General setup"
    group_b: ConstraintGroupB = Field(default_factory=ConstraintGroupB)
    group_c: ConstraintGroupC = Field(default_factory=ConstraintGroupC)
    group_d: ConstraintGroupD = Field(default_factory=ConstraintGroupD)
    group_e: SoftWeights = Field(default_factory=SoftWeights)
    group_f: SoftWeights = Field(default_factory=SoftWeights)


class DoctorFlags(BaseModel):
    pregnant: bool = False
    senior: bool = False
    part_time: bool = False
    difficult_circumstances: bool = False


class Doctor(BaseModel):
    id: str
    full_name: str
    title: str
    specialty: str
    seniority_score: int = 1
    weekly_hour_limit: Optional[int] = None
    flags: DoctorFlags = Field(default_factory=DoctorFlags)
    preferences: Dict[str, int] = Field(default_factory=dict)
    fixed_locked_slots: List[str] = Field(default_factory=list)
    historical_night_count_12m: int = 0
    historical_holiday_count_12m: int = 0


class AvailabilityMatrix(BaseModel):
    doctor_id: str
    slots: Dict[str, bool]


class SetupPayload(BaseModel):
    config: ConstraintsConfig


class DoctorsPayload(BaseModel):
    doctors: List[Doctor]


class OptimizeRequest(BaseModel):
    month: str
    population_size: int = 80
    generations: int = 120


class ParetoPoint(BaseModel):
    solution_id: str
    f1: float
    f2: float
    f3: float


class Assignment(BaseModel):
    slot_id: str
    shift_type: ShiftType
    doctor_ids: List[str]


class ScheduleSolution(BaseModel):
    solution_id: str
    objectives: Dict[str, float]
    assignments: List[Assignment]


class JobStatus(str, Enum):
    pending = "pending"
    running = "running"
    done = "done"
    failed = "failed"


class OptimizationJob(BaseModel):
    id: str
    month: str
    status: JobStatus = JobStatus.pending
    progress: float = 0.0
    generation: int = 0
    message: str = ""
    pareto_front: List[ParetoPoint] = Field(default_factory=list)
    solutions: List[ScheduleSolution] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class ReportItem(BaseModel):
    doctor_id: str
    doctor_name: str
    total_shifts: int
    total_hours: int
    night_shifts: int
    holiday_shifts: int
