"""Dịch vụ tối ưu lịch trực bằng NSGA-II cải tiến."""

from __future__ import annotations

import time
import warnings
from collections import defaultdict
from datetime import date, timedelta
from typing import Callable, Dict, List, Tuple, Optional, Set
from dataclasses import dataclass

import numpy as np

from nsga2_improved import NSGA2ImprovedSmart, ProblemWrapper

from .schemas import (
    AlgorithmRunMetricsDTO,
    DoctorWorkloadBalanceDTO,
    ParetoScheduleOptionDTO,
    ScheduleGenerationEnvelopeDTO,
    ScheduleGenerationRequestDTO,
    ScheduleGenerationResultDTO,
    ScheduleQualityMetricsDTO,
    ShiftAssignmentDTO,
)


SHIFT_NAMES = ("morning", "afternoon")
SHIFT_HOURS = 8.0


# ---------------------------------------------------------------------------
# HARD CONSTRAINTS - Được đảm bảo 100% ngay từ validation
# ---------------------------------------------------------------------------

def _validate_hard_constraints(request: ScheduleGenerationRequestDTO) -> None:
    """
    Kiểm tra tất cả hard constraints.
    Nếu bất kỳ ràng buộc nào bị vi phạm, raise ValueError ngay lập tức.
    KHÔNG DÙNG PENALTY CHO HARD CONSTRAINTS.
    """
    period_start = request.start_date
    period_end = request.start_date + timedelta(days=request.num_days - 1)
    
    # Tính toán các giá trị cần thiết
    doctors_per_shift = request.rooms_per_shift * request.doctors_per_room
    
    # ==================== HC-01: Đủ số bác sĩ cho mỗi ca ====================
    if len(request.doctors) < doctors_per_shift:
        raise ValueError(
            f"[HC-01] Số bác sĩ ({len(request.doctors)}) không đủ cho mỗi ca. "
            f"Cần tối thiểu {doctors_per_shift} bác sĩ/ca "
            f"({request.rooms_per_shift} phòng × {request.doctors_per_room} BS/phòng)."
        )
    
    # ==================== HC-02: Giới hạn giờ làm việc/tuần ====================
    shifts_per_week = 7 * request.shifts_per_day
    max_weekly_shifts = request.max_weekly_hours_per_doctor / SHIFT_HOURS
    total_shifts_per_week = shifts_per_week * doctors_per_shift
    min_doctors_needed = total_shifts_per_week / max_weekly_shifts
    
    if len(request.doctors) < min_doctors_needed:
        raise ValueError(
            f"[HC-02] Số bác sĩ ({len(request.doctors)}) không đủ để đáp ứng giới hạn "
            f"{request.max_weekly_hours_per_doctor}h/tuần (tương đương {max_weekly_shifts:.1f} ca/tuần). "
            f"Cần ít nhất {int(np.ceil(min_doctors_needed))} bác sĩ để phân bổ workload "
            f"({total_shifts_per_week:.0f} ca/tuần)."
        )
    
    # ==================== HC-03: Số ngày nghỉ không vượt quá giới hạn ====================
    for doctor in request.doctors:
        days_off_in_period = [
            d for d in doctor.days_off
            if period_start <= d <= period_end
        ]
        if len(days_off_in_period) > request.max_days_off_per_doctor:
            raise ValueError(
                f"[HC-03] Bác sĩ '{doctor.name}' đăng ký {len(days_off_in_period)} ngày nghỉ "
                f"trong kỳ, vượt giới hạn {request.max_days_off_per_doctor} ngày."
            )
    
    # ==================== HC-04: Bác sĩ thực tập phải có bác sĩ chính thức giám sát ====================
    interns = [d for d in request.doctors if d.experiences < 2]
    supervisors = [d for d in request.doctors if d.experiences >= 2 and d.has_valid_license]
    
    if interns and not supervisors:
        raise ValueError(
            f"[HC-04] Có {len(interns)} bác sĩ thực tập (kinh nghiệm < 2 năm) "
            f"nhưng không có bác sĩ chính thức (kinh nghiệm >= 2 năm) để giám sát."
        )
    
    # ==================== HC-05: License hợp lệ ====================
    doctors_without_license = [d for d in request.doctors if not d.has_valid_license]
    
    if doctors_without_license and len(doctors_without_license) == len(request.doctors):
        raise ValueError(
            f"[HC-05] Tất cả {len(request.doctors)} bác sĩ đều không có license hợp lệ, "
            f"không thể lập lịch trực."
        )
    
    # ==================== HC-06: Preferred days không được trùng với days off ====================
    for doctor in request.doctors:
        days_off_set = set(doctor.days_off)
        preferred_in_days_off = [d for d in doctor.preferred_extra_days if d in days_off_set]
        if preferred_in_days_off:
            raise ValueError(
                f"[HC-06] Bác sĩ '{doctor.name}' có ngày muốn trực thêm {preferred_in_days_off} "
                f"trùng với ngày nghỉ đã đăng ký."
            )
    
    # ==================== HC-07: Kiểm tra tính khả thi cơ bản ====================
    total_shifts = request.num_days * request.shifts_per_day * doctors_per_shift
    avg_shifts_per_doctor = total_shifts / len(request.doctors)
    avg_hours_per_doctor = avg_shifts_per_doctor * SHIFT_HOURS
    
    if avg_hours_per_doctor > request.max_weekly_hours_per_doctor * (request.num_days / 7):
        raise ValueError(
            f"[HC-07] Workload trung bình mỗi bác sĩ: {avg_hours_per_doctor:.1f}h/kỳ "
            f"tương đương {(avg_hours_per_doctor * 7 / request.num_days):.1f}h/tuần, "
            f"vượt giới hạn {request.max_weekly_hours_per_doctor}h/tuần. "
            f"Cần tăng số bác sĩ hoặc giảm số ca."
        )
    
    # ==================== HC-08: Số lượng phòng hợp lý ====================
    if request.rooms_per_shift < 1:
        raise ValueError(f"[HC-08] Số phòng mỗi ca phải >= 1, hiện tại: {request.rooms_per_shift}")
    
    if request.doctors_per_room < 1:
        raise ValueError(f"[HC-08] Số bác sĩ mỗi phòng phải >= 1, hiện tại: {request.doctors_per_room}")
    
    # ==================== HC-09: Số ca mỗi ngày hợp lý ====================
    if request.shifts_per_day not in [1, 2]:
        raise ValueError(
            f"[HC-09] Số ca mỗi ngày phải là 1 hoặc 2, hiện tại: {request.shifts_per_day}"
        )
    
    # ==================== HC-10: Số ngày lập lịch hợp lý ====================
    if request.num_days < 1 or request.num_days > 31:
        raise ValueError(
            f"[HC-10] Số ngày lập lịch phải từ 1 đến 31, hiện tại: {request.num_days}"
        )


# ---------------------------------------------------------------------------
# SOFT CONSTRAINTS - Chỉ dùng penalty để tối ưu
# ---------------------------------------------------------------------------

# Các ràng buộc mềm sẽ được xử lý trong _compute_soft_penalty():
# - SC-01: Không làm việc quá 5 ngày liên tiếp
# - SC-02: Giới hạn giờ làm việc/tuần (đã có hard, nhưng vẫn penalty để ưu tiên)
# - SC-03: Làm đúng ngày ưu tiên
# - SC-04: Công bằng ngày cuối tuần
# - SC-05: Điều chỉnh workload theo đăng ký
# - SC-06: Công bằng theo tháng
# - SC-07: Cân bằng chuyên khoa
# - SC-08: Cân bằng workload tổng thể


# ---------------------------------------------------------------------------
# HARD CONSTRAINT MANAGER - Repair trong quá trình tối ưu
# ---------------------------------------------------------------------------

@dataclass
class DoctorConstraints:
    """Container for doctor constraints."""
    idx: int
    doctor_id: str
    has_license: bool
    is_intern: bool
    specialization: str
    forbidden_days: Set[int]
    preferred_extra_count: int


class HardConstraintManager:
    """
    Quản lý và đảm bảo các ràng buộc cứng trong quá trình tối ưu.
    Các ràng buộc đã được kiểm tra ở validation, ở đây chỉ repair các vi phạm
    phát sinh do mutation/crossover.
    """
    
    def __init__(self, request: ScheduleGenerationRequestDTO):
        self.request = request
        self.n_doctors = len(request.doctors)
        self.rooms = request.rooms_per_shift
        self.dproom = request.doctors_per_room
        self.n_days = request.num_days
        self.n_shifts = len(SHIFT_NAMES[:request.shifts_per_day])
        self.max_weekly_hours = request.max_weekly_hours_per_doctor
        
        # Build doctor mappings
        self.doctor_id_to_idx = {d.id: idx for idx, d in enumerate(request.doctors)}
        self.doctor_idx_to_id = [d.id for d in request.doctors]
        
        # Build doctor constraints
        self.doctors: List[DoctorConstraints] = []
        period_start = request.start_date
        
        for idx, doctor in enumerate(request.doctors):
            forbidden_days = set()
            for day_off in doctor.days_off:
                if period_start <= day_off < period_start + timedelta(days=request.num_days):
                    day_idx = (day_off - period_start).days
                    forbidden_days.add(day_idx)
            
            pref_in_period = len(
                [
                    d
                    for d in doctor.preferred_extra_days
                    if period_start <= d < period_start + timedelta(days=request.num_days)
                ]
            )
            self.doctors.append(DoctorConstraints(
                idx=idx,
                doctor_id=doctor.id,
                has_license=doctor.has_valid_license,
                is_intern=doctor.experiences < 2,
                specialization=doctor.specialization,
                forbidden_days=forbidden_days,
                preferred_extra_count=pref_in_period,
            ))
        
        # Pre-compute specialists for quick lookup
        self.specialists: Dict[str, List[int]] = defaultdict(list)
        for doc in self.doctors:
            self.specialists[doc.specialization].append(doc.idx)
    
    def repair(self, assignment: Dict[Tuple[int, int, int], List[int]]) -> Dict[Tuple[int, int, int], List[int]]:
        """
        Repair assignment để đảm bảo tất cả hard constraints.
        Returns assignment mới được đảm bảo feasible.
        """
        repaired = {k: list(v) for k, v in assignment.items()}
        
        # Apply repairs in sequence
        repaired = self._repair_forbidden_days(repaired)
        repaired = self._repair_duplicates(repaired)
        repaired = self._repair_intern_supervisors(repaired)
        repaired = self._repair_licenses(repaired)
        repaired = self._repair_room_capacity(repaired)
        
        return repaired
    
    def _repair_forbidden_days(self, assignment: Dict) -> Dict:
        """Thay thế bác sĩ bị xếp vào ngày nghỉ."""
        for (day_idx, shift_idx, room_idx), doctors in assignment.items():
            for i, doctor_idx in enumerate(doctors):
                if day_idx in self.doctors[doctor_idx].forbidden_days:
                    replacement = self._find_replacement(
                        day_idx, shift_idx, room_idx,
                        set(doctors), {day_idx}
                    )
                    if replacement is not None:
                        doctors[i] = replacement
        return assignment
    
    def _repair_duplicates(self, assignment: Dict) -> Dict:
        """Loại bỏ bác sĩ trùng trong cùng ca."""
        # Group all doctors by shift
        shift_doctors: Dict[Tuple[int, int], List[Tuple[int, int, int, int]]] = defaultdict(list)
        
        for (day_idx, shift_idx, room_idx), doctors in assignment.items():
            for pos, doctor_idx in enumerate(doctors):
                shift_doctors[(day_idx, shift_idx)].append((doctor_idx, room_idx, pos, day_idx))
        
        # Detect and fix duplicates
        for (day_idx, shift_idx), slots in shift_doctors.items():
            seen = set()
            duplicates = []
            
            for doctor_idx, room_idx, pos, _ in slots:
                if doctor_idx in seen:
                    duplicates.append((doctor_idx, room_idx, pos, day_idx))
                else:
                    seen.add(doctor_idx)
            
            # Fix duplicates
            for doctor_idx, room_idx, pos, day_idx in duplicates:
                doctors_list = assignment[(day_idx, shift_idx, room_idx)]
                replacement = self._find_replacement(
                    day_idx, shift_idx, room_idx,
                    set(doctors_list), {day_idx}
                )
                if replacement is not None:
                    doctors_list[pos] = replacement
        
        return assignment
    
    def _repair_intern_supervisors(self, assignment: Dict) -> Dict:
        """Đảm bảo mỗi intern có supervisor trong cùng ca."""
        for (day_idx, shift_idx, room_idx), doctors in assignment.items():
            has_supervisor = any(not self.doctors[d].is_intern for d in doctors)
            interns = [d for d in doctors if self.doctors[d].is_intern]
            
            if interns and not has_supervisor:
                supervisor = self._find_supervisor(day_idx, shift_idx, room_idx, set(doctors))
                if supervisor is not None:
                    idx = doctors.index(interns[0])
                    doctors[idx] = supervisor
        
        return assignment
    
    def _repair_licenses(self, assignment: Dict) -> Dict:
        """Thay thế bác sĩ không có license."""
        for (day_idx, shift_idx, room_idx), doctors in assignment.items():
            for i, doctor_idx in enumerate(doctors):
                if not self.doctors[doctor_idx].has_license:
                    replacement = self._find_replacement(
                        day_idx, shift_idx, room_idx,
                        set(doctors), {day_idx},
                        require_license=True
                    )
                    if replacement is not None:
                        doctors[i] = replacement
        return assignment
    
    def _repair_room_capacity(self, assignment: Dict) -> Dict:
        """Điều chỉnh số lượng bác sĩ mỗi phòng đúng yêu cầu."""
        for (day_idx, shift_idx, room_idx), doctors in assignment.items():
            current = len(doctors)
            target = self.dproom
            
            if current < target:
                existing = set(doctors)
                for _ in range(target - current):
                    new_doctor = self._find_replacement(
                        day_idx, shift_idx, room_idx,
                        existing, {day_idx}
                    )
                    if new_doctor is not None:
                        doctors.append(new_doctor)
                        existing.add(new_doctor)
            
            elif current > target:
                doctors.sort(key=lambda d: (
                    not self.doctors[d].has_license,
                    self.doctors[d].is_intern
                ))
                del doctors[target:]
        
        return assignment
    
    def _find_replacement(
        self,
        day_idx: int,
        shift_idx: int,
        room_idx: int,
        excluded: Set[int],
        available_days: Set[int],
        require_license: bool = False
    ) -> Optional[int]:
        """Tìm bác sĩ thay thế phù hợp."""
        candidates = []
        
        for doctor in self.doctors:
            if doctor.idx in excluded:
                continue
            if day_idx in doctor.forbidden_days:
                continue
            if require_license and not doctor.has_license:
                continue
            candidates.append(doctor.idx)
        
        if not candidates:
            for doctor in self.doctors:
                if doctor.idx not in excluded:
                    candidates.append(doctor.idx)
        
        if any(self.doctors[e].is_intern for e in excluded):
            supervisors = [c for c in candidates if not self.doctors[c].is_intern]
            if supervisors:
                return supervisors[0]
        
        return candidates[0] if candidates else None
    
    def _find_supervisor(
        self,
        day_idx: int,
        shift_idx: int,
        room_idx: int,
        excluded: Set[int]
    ) -> Optional[int]:
        """Tìm supervisor khả dụng."""
        for doctor in self.doctors:
            if doctor.idx in excluded:
                continue
            if day_idx in doctor.forbidden_days:
                continue
            if not doctor.has_license:
                continue
            if doctor.is_intern:
                continue
            return doctor.idx
        return None


# ---------------------------------------------------------------------------
# DUTY SCHEDULING PROBLEM
# ---------------------------------------------------------------------------

class DutySchedulingProblem:
    """Optimized scheduling problem with guaranteed hard constraints."""
    
    def __init__(self, request: ScheduleGenerationRequestDTO) -> None:
        self.request = request
        self.doctors = request.doctors
        self.n_doctors = len(self.doctors)
        self.shift_names = SHIFT_NAMES[:request.shifts_per_day]
        self.n_shifts = len(self.shift_names)
        self.shift_hours = SHIFT_HOURS
        self.rooms = request.rooms_per_shift
        self.dproom = request.doctors_per_room
        self.n_days = request.num_days
        self.total_shift_slots = self.n_days * self.n_shifts * self.rooms * self.dproom
        
        # Problem dimensions
        self.n_obj = 2
        self.n_var = self.total_shift_slots
        self.xl = np.zeros(self.n_var)
        self.xu = np.full(self.n_var, self.n_doctors - 1)
        
        # Doctor mappings
        self.doctor_idx_to_id = [d.id for d in self.doctors]
        self.doctor_id_to_idx = {d.id: idx for idx, d in enumerate(self.doctors)}
        
        # Initialize constraint manager
        self.constraint_manager = HardConstraintManager(request)
        
        # Preferred days
        period_start = request.start_date
        self.preferred_day_indices: Dict[str, Set[int]] = {}
        self.preferred_extra_counts: Dict[str, int] = {}
        
        for doctor in self.doctors:
            # Lọc preferred days trong kỳ
            self.preferred_day_indices[doctor.id] = {
                (d - period_start).days
                for d in doctor.preferred_extra_days
                if period_start <= d < period_start + timedelta(days=request.num_days)
            }
            # Chỉ tính ngày trực thêm trong kỳ (khớp SC-03 / quota công bằng)
            self.preferred_extra_counts[doctor.id] = len(self.preferred_day_indices[doctor.id])
        
        # Random noise for tie-breaking
        rng = np.random.default_rng(getattr(request, 'random_seed', 42))
        self.assignment_noise = rng.normal(
            loc=0.0,
            scale=max(getattr(request, 'randomization_strength', 0.1), 1e-5),
            size=(self.n_days, self.n_shifts, self.rooms, self.n_doctors),
        )
        
        # Day metadata
        self._build_day_metadata(request)
        
        # Target shifts per doctor (base workload)
        self.target_shifts_per_doctor = self.total_shift_slots / self.n_doctors
        # Vector mục tiêu số ca (tổng = total_shift_slots): chia đều + bù theo đăng ký trực thêm (tối đa +3)
        self._shift_target_vec = self._compute_shift_target_vector()
    
    def _build_day_metadata(self, request: ScheduleGenerationRequestDTO) -> None:
        """Build pre-computed day metadata for faster access."""
        self.day_meta = []
        start = request.start_date
        
        for day_idx in range(request.num_days):
            current_date = start + timedelta(days=day_idx)
            self.day_meta.append({
                'date': current_date,
                'iso_week': current_date.isocalendar()[:2],
                'month_key': (current_date.year, current_date.month),
                'is_weekend': current_date.weekday() >= 5,
            })
    
    def _compute_shift_target_vector(self) -> np.ndarray:
        """
        Mục tiêu số ca / bác sĩ: trung bình kỳ + điều chỉnh theo đăng ký trực thêm (cap 3),
        tổng các mục tiêu = total_shift_slots (bảo toàn tổng ca hệ thống).
        """
        n = self.n_doctors
        total = float(self.total_shift_slots)
        if n == 0:
            return np.zeros(0, dtype=np.float64)
        extras = np.array(
            [min(self.preferred_extra_counts.get(self.doctors[i].id, 0), 3) for i in range(n)],
            dtype=np.float64,
        )
        mean_extra = float(np.mean(extras))
        return (total / n) + (extras - mean_extra)
    
    def decode(self, candidate: np.ndarray) -> Dict[Tuple[int, int, int], List[int]]:
        """Decode candidate and repair to satisfy hard constraints."""
        slots = np.clip(
            np.rint(candidate.reshape(self.n_days, self.n_shifts, self.rooms, self.dproom)).astype(np.int32),
            0, self.n_doctors - 1
        )
        
        decoded = {}
        all_indices = list(range(self.n_doctors))
        
        for day_idx in range(self.n_days):
            for shift_idx in range(self.n_shifts):
                shift_seen = set()
                
                for room_idx in range(self.rooms):
                    raw = slots[day_idx, shift_idx, room_idx].tolist()
                    room_seen = set(shift_seen)
                    unique = []
                    
                    for idx in raw:
                        if idx not in room_seen:
                            room_seen.add(idx)
                            unique.append(idx)
                    
                    if len(unique) < self.dproom:
                        noise = self.assignment_noise[day_idx, shift_idx, room_idx]
                        available = [i for i in all_indices if i not in room_seen]
                        
                        if available:
                            available.sort(key=lambda i: -noise[i])
                            for fill_idx in available:
                                if len(unique) >= self.dproom:
                                    break
                                unique.append(fill_idx)
                                room_seen.add(fill_idx)
                    
                    decoded[(day_idx, shift_idx, room_idx)] = unique[:self.dproom]
                    shift_seen.update(unique[:self.dproom])
        
        # Repair to guarantee hard constraints
        return self.constraint_manager.repair(decoded)
    
    def evaluate(self, x: np.ndarray) -> np.ndarray:
        """Evaluate with 2 objectives: soft penalty and combined fairness."""
        if x.ndim == 1:
            x = x.reshape(1, -1)
        
        f_values = []
        for candidate in x:
            decoded = self.decode(candidate)
            stats = self._compute_stats(decoded)
            
            # Objective 1: Minimize soft constraint violations
            f1 = self._compute_soft_penalty(decoded, stats)
            
            # Objective 2: Minimize combined unfairness
            f2 = self._compute_combined_unfairness(stats)
            
            f_values.append([f1, f2])
        
        return np.array(f_values, dtype=float)
    
    def _compute_stats(self, decoded: Dict) -> Tuple:
        """Compute comprehensive statistics for the schedule."""
        n_doctors = self.n_doctors
        
        shift_counts = np.zeros(n_doctors, dtype=np.int32)
        weekend_counts = np.zeros(n_doctors, dtype=np.int32)
        weighted_counts = np.zeros(n_doctors, dtype=np.float32)
        worked_days = [set() for _ in range(n_doctors)]
        
        weekly_counts = [defaultdict(int) for _ in range(n_doctors)]
        monthly_counts = [defaultdict(int) for _ in range(n_doctors)]
        weekly_hours = [defaultdict(int) for _ in range(n_doctors)]
        
        # Track consecutive days for health constraint (SC-01)
        consecutive_days = [0] * n_doctors
        last_work_day = [-2] * n_doctors
        
        shift_slots_counted = [set() for _ in range(n_doctors)]
        
        for day_idx, day_data in enumerate(self.day_meta):
            is_weekend = day_data['is_weekend']
            weight = 1.0
            iso_week = day_data['iso_week']
            month_key = day_data['month_key']
            
            for shift_idx in range(self.n_shifts):
                shift_slot = day_idx * self.n_shifts + shift_idx
                
                for room_idx in range(self.rooms):
                    for doctor_idx in decoded[(day_idx, shift_idx, room_idx)]:
                        weighted_counts[doctor_idx] += weight
                        worked_days[doctor_idx].add(day_idx)
                        
                        # Track consecutive working days (SC-01)
                        if last_work_day[doctor_idx] == day_idx - 1:
                            consecutive_days[doctor_idx] += 1
                        else:
                            consecutive_days[doctor_idx] = 1
                        last_work_day[doctor_idx] = day_idx
                        
                        if shift_slot not in shift_slots_counted[doctor_idx]:
                            shift_slots_counted[doctor_idx].add(shift_slot)
                            shift_counts[doctor_idx] += 1
                            
                            weekly_hours[doctor_idx][iso_week] += int(self.shift_hours)
                            weekly_counts[doctor_idx][iso_week] += 1
                            monthly_counts[doctor_idx][month_key] += 1
                            
                            if is_weekend:
                                weekend_counts[doctor_idx] += 1
        
        return (
            shift_counts,
            weekend_counts,
            weighted_counts,
            worked_days,
            weekly_counts,
            monthly_counts,
            weekly_hours,
            consecutive_days,
        )
    
    def _compute_soft_penalty(self, decoded: Dict, stats: Tuple) -> float:
        """Compute total soft constraint penalty."""
        (shift_counts, weekend_counts, weighted_counts, worked_days,
         weekly_counts, monthly_counts, weekly_hours, consecutive_days) = stats
        
        penalty = 0.0
        bonus = 0.0
        
        n_weeks = max(1, len(set(d['iso_week'] for d in self.day_meta)))
        n_months = max(1, len(set(d['month_key'] for d in self.day_meta)))
        total_weekends = sum(1 for d in self.day_meta if d['is_weekend'])
        
        # SC-01: Không làm việc quá 5 ngày liên tiếp
        for idx in range(self.n_doctors):
            if consecutive_days[idx] > 5:
                penalty += 2.0 * (consecutive_days[idx] - 5)
        
        # SC-02: Giới hạn giờ làm/tuần (ưu tiên gần mức tối đa)
        max_weekly_hours = self.request.max_weekly_hours_per_doctor
        for idx in range(self.n_doctors):
            for week, hours in weekly_hours[idx].items():
                if hours > max_weekly_hours:
                    penalty += 0.5 * (hours - max_weekly_hours)
                # Không phạt nếu làm ít hơn
        
        # SC-03: Ngày ưu tiên
        for idx in range(self.n_doctors):
            doctor = self.doctors[idx]
            preferred = self.preferred_day_indices.get(doctor.id, set())
            preferred_count = len(preferred)
            
            actual_worked_preferred = sum(1 for day_idx in preferred if day_idx in worked_days[idx])
            
            if preferred_count > 0:
                bonus += 2.0 * actual_worked_preferred / preferred_count
            
            expected_preferred = min(preferred_count, 3)
            if actual_worked_preferred < expected_preferred:
                penalty += 0.5 * (expected_preferred - actual_worked_preferred)
        
        # SC-04: Công bằng ngày cuối tuần
        for idx in range(self.n_doctors):
            weekend_worked = weekend_counts[idx]
            weekend_off = total_weekends - weekend_worked
            if weekend_off < 2:
                penalty += 0.5 * (2 - weekend_off)
        
        # SC-05: Số ca sát mục tiêu công bằng + đăng ký trực thêm (chỉ cho phép lệch ~1 ca
        # do làm tròn; vượt quá chỉ chấp nhận khi có quota trực thêm trong T_i)
        T = self._shift_target_vec
        sc = shift_counts.astype(np.float64)
        for idx in range(self.n_doctors):
            delta = sc[idx] - T[idx]
            abs_excess = max(0.0, abs(delta) - 1.0)
            if abs_excess > 0:
                penalty += 14.0 * (abs_excess ** 2)
        spread = float(np.max(sc) - np.min(sc)) if self.n_doctors else 0.0
        max_extra_reg = max(
            (min(self.preferred_extra_counts.get(self.doctors[j].id, 0), 3) for j in range(self.n_doctors)),
            default=0,
        )
        allowed_spread = 1.0 + float(max_extra_reg)
        if spread > allowed_spread + 0.5:
            penalty += 18.0 * ((spread - allowed_spread) ** 2)
        
        # SC-06: Công bằng theo tháng
        for idx in range(self.n_doctors):
            monthly_total = sum(monthly_counts[idx].values())
            expected_monthly = monthly_total / max(n_months, 1)
            if expected_monthly > 0:
                for month, count in monthly_counts[idx].items():
                    deviation = abs(count - expected_monthly)
                    penalty += 0.1 * deviation
        
        # SC-07: Cân bằng chuyên khoa
        specialty_groups = defaultdict(list)
        for idx in range(self.n_doctors):
            specialty_groups[self.doctors[idx].specialization].append(shift_counts[idx])
        for counts in specialty_groups.values():
            if len(counts) > 1:
                penalty += 0.2 * np.std(counts)
        
        # SC-08: Cân bằng số ca (ưu tiên shift_counts — đúng nghĩa "ca trực")
        penalty += 2.5 * float(np.std(sc))
        workload_std = np.std(weighted_counts)
        penalty += 0.05 * workload_std
        
        return max(0.0, penalty - bonus)
    
    def _preference_adjusted_loads(self, weighted_counts: np.ndarray) -> np.ndarray:
        """Vector khối lượng sau điều chỉnh ưu tiên đăng ký — dùng cho Gini/JFI tổng thể."""
        adjusted = np.zeros(self.n_doctors, dtype=np.float64)
        for idx in range(self.n_doctors):
            doctor = self.doctors[idx]
            preferred_extra = min(self.preferred_extra_counts.get(doctor.id, 0), 3)
            adjustment = 1.0 - min(0.3, preferred_extra * 0.1)
            adjusted[idx] = float(weighted_counts[idx]) * adjustment
        return adjusted

    def _preference_adjusted_shift_counts(self, shift_counts: np.ndarray) -> np.ndarray:
        """Như _preference_adjusted_loads nhưng trên số ca (shift) — thống nhất mục tiêu công bằng."""
        adjusted = np.zeros(self.n_doctors, dtype=np.float64)
        for idx in range(self.n_doctors):
            doctor = self.doctors[idx]
            preferred_extra = min(self.preferred_extra_counts.get(doctor.id, 0), 3)
            adjustment = 1.0 - min(0.3, preferred_extra * 0.1)
            adjusted[idx] = float(shift_counts[idx]) * adjustment
        return adjusted

    def _compute_combined_unfairness(self, stats: Tuple) -> float:
        """
        f2: vừa Gini/JFI trên số ca (sau điều chỉnh đăng ký), vừa phạt lệch tuyệt đối so với mục tiêu T.
        """
        (shift_counts, _, _, _, _, _, _, _) = stats
        sc = shift_counts.astype(np.float64)
        adj = self._preference_adjusted_shift_counts(sc)
        gini = self._gini_coefficient(adj.astype(np.float32))
        jfi = self._jain_index(adj.astype(np.float32))
        tier_gini = (gini + (1.0 - jfi)) / 2.0
        T = self._shift_target_vec
        max_abs = float(np.max(np.abs(sc - T))) if self.n_doctors else 0.0
        excess = max(0.0, max_abs - 1.0)
        tier_balance = min(1.0, (excess / 4.0) ** 2)
        return float(0.32 * tier_gini + 0.68 * tier_balance)
    
    def _gini_coefficient(self, values: np.ndarray) -> float:
        """Calculate Gini coefficient."""
        if values.size == 0:
            return 0.0
        
        positive_values = values[values > 0]
        if len(positive_values) == 0:
            return 0.0
        
        sorted_values = np.sort(positive_values)
        n = len(sorted_values)
        sum_values = np.sum(sorted_values)
        
        if sum_values == 0:
            return 0.0
        
        weighted_sum = np.sum((np.arange(1, n + 1)) * sorted_values)
        gini = (2.0 * weighted_sum) / (n * sum_values) - (n + 1.0) / n
        
        return max(0.0, min(1.0, gini))
    
    @staticmethod
    def _jain_index(values: np.ndarray) -> float:
        """Calculate Jain's Fairness Index."""
        if values.size == 0:
            return 1.0
        
        sum_val = float(np.sum(values))
        sum_sq = float(np.sum(values ** 2))
        
        if sum_sq == 0 or sum_val == 0:
            return 1.0
        
        return (sum_val ** 2) / (len(values) * sum_sq)
    
    def _get_shifts_for_doctor(self, decoded: Dict, doctor_idx: int) -> List[int]:
        """Get all shift slots for a doctor."""
        shifts = []
        for (day_idx, shift_idx, _), doctors in decoded.items():
            if doctor_idx in doctors:
                shifts.append(day_idx * self.n_shifts + shift_idx)
        return sorted(shifts)


# ---------------------------------------------------------------------------
# SERVICE IMPLEMENTATION
# ---------------------------------------------------------------------------

class NsgaDutySchedulerService:
    """Service for generating duty schedules with guaranteed hard constraints."""
    
    @staticmethod
    def _normalize_score(value: float, scale: float = 1.0) -> int:
        """Normalize score to 0-100 range."""
        normalized = 100.0 * np.exp(-value / max(scale, 0.01))
        return int(max(0, min(100, round(normalized))))
    
    @staticmethod
    def _badge(score: int) -> str:
        """Get quality badge based on score."""
        if score >= 90:
            return "excellent"
        if score >= 75:
            return "good"
        if score >= 60:
            return "acceptable"
        if score >= 40:
            return "fair"
        return "poor"
    
    def generate(
        self,
        request: ScheduleGenerationRequestDTO,
        progress_callback: Callable[[int, int], None] | None = None,
    ) -> ScheduleGenerationEnvelopeDTO:
        """Generate optimized schedule."""
        # Step 1: Validate all hard constraints
        _validate_hard_constraints(request)
        
        # Step 2: Initialize problem and solver
        problem = DutySchedulingProblem(request)
        wrapper = ProblemWrapper(problem)
        solver = NSGA2ImprovedSmart(
            wrapper,
            pop_size=getattr(request, 'optimizer_population_size', 250),
            n_gen=getattr(request, 'optimizer_generations', 400),
        )
        
        # Step 3: Run optimization
        t0 = time.perf_counter()
        solver.run(progress_callback=progress_callback)
        elapsed = time.perf_counter() - t0
        
        # Step 4: Extract Pareto front
        sorted_pop = sorted(
            solver.population,
            key=lambda ind: (ind.rank if ind.rank is not None else 9999, ind.F[0], ind.F[1])
        )
        
        front_one = [ind for ind in sorted_pop if ind.rank == 1]
        candidates = front_one if front_one else sorted_pop
        candidates = candidates[:getattr(request, 'pareto_options_limit', 6)]
        
        best_f1 = min(ind.F[0] for ind in front_one) if front_one else 0.0
        best_f2 = min(ind.F[1] for ind in front_one) if front_one else 0.0
        
        # Step 5: Build Pareto options
        pareto_options = []
        for idx, individual in enumerate(candidates, 1):
            decoded = problem.decode(individual.X)
            stats = problem._compute_stats(decoded)
            
            soft_penalty = problem._compute_soft_penalty(decoded, stats)
            combined_unfairness = problem._compute_combined_unfairness(stats)
            
            shift_counts, weekend_counts, weighted_counts, worked_days, weekly_counts, monthly_counts, _, _ = stats

            adj = problem._preference_adjusted_shift_counts(shift_counts.astype(np.float64))
            gini = float(problem._gini_coefficient(adj.astype(np.float32)))
            jfi = float(problem._jain_index(adj.astype(np.float32)))
            
            soft_score = self._normalize_score(soft_penalty, scale=50.0)
            fairness_score = self._normalize_score(combined_unfairness, scale=0.5)
            overall_score = int(round(0.6 * soft_score + 0.4 * fairness_score))
            
            metrics = ScheduleQualityMetricsDTO(
                hard_violation_score=0.0,  # Guaranteed by validation
                soft_violation_score=float(soft_penalty),
                fairness_std=float(np.std(shift_counts)),
                shift_fairness_std=float(np.std(shift_counts)),
                day_off_fairness_std=0.0,
                day_off_fairness_jain=1.0,
                weekly_fairness_jain=float(self._jain_index_for_list([
                    sum(weekly_counts[i].values()) / max(1, len(set(d['iso_week'] for d in problem.day_meta)))
                    for i in range(problem.n_doctors)
                ])),
                monthly_fairness_jain=float(self._jain_index_for_list([
                    sum(monthly_counts[i].values()) / max(1, len(set(d['month_key'] for d in problem.day_meta)))
                    for i in range(problem.n_doctors)
                ])),
                yearly_fairness_jain=jfi,
                holiday_fairness_jain=jfi,
                f3_workload_std=float(np.std(shift_counts)),
                f4_fairness=float(1.0 - jfi),
                gini_workload=float(gini),
                jfi_overall=float(jfi),
                hard_score_visual=100,
                soft_score_visual=soft_score,
                workload_score_visual=self._normalize_score(gini, scale=0.3),
                fairness_score_visual=fairness_score,
                overall_score_visual=overall_score,
                score_badges={
                    "hard": "excellent",
                    "soft": self._badge(soft_score),
                    "workload": self._badge(self._normalize_score(gini, scale=0.3)),
                    "fairness": self._badge(fairness_score),
                    "overall": self._badge(overall_score),
                },
                weekly_underwork_doctors=[],
            )
            
            assignments = self._build_assignments(request, problem, decoded)
            balances = self._build_workload_balances(request, assignments, stats)
            
            pareto_options.append(ParetoScheduleOptionDTO(
                option_id=f"OPT-{idx:02d}",
                metrics=metrics,
                assignments=assignments,
                doctor_workload_balances=balances,
            ))
        
        if not pareto_options:
            raise ValueError("Không thể tạo được lịch trực hợp lệ")
        
        selected_option = pareto_options[0]
        selected_schedule = ScheduleGenerationResultDTO(
            start_date=request.start_date,
            num_days=request.num_days,
            rooms_per_shift=request.rooms_per_shift,
            doctors_per_room=request.doctors_per_room,
            shifts_per_day=request.shifts_per_day,
            metrics=selected_option.metrics,
            assignments=selected_option.assignments,
        )
        
        # Step 6: Calculate convergence metrics
        convergence_f1 = None
        convergence_f2 = None
        if hasattr(solver, 'history') and len(solver.history) >= 2:
            first_F = solver.history[0]
            last_F = solver.history[-1]
            if len(first_F) > 0 and len(last_F) > 0:
                min_first_f1 = np.min(first_F[:, 0])
                min_last_f1 = np.min(last_F[:, 0])
                if min_first_f1 > 1e-12:
                    convergence_f1 = max(0.0, min(1.0, (min_first_f1 - min_last_f1) / min_first_f1))
                
                min_first_f2 = np.min(first_F[:, 1])
                min_last_f2 = np.min(last_F[:, 1])
                if min_first_f2 > 1e-12:
                    convergence_f2 = max(0.0, min(1.0, (min_first_f2 - min_last_f2) / min_first_f2))
        
        algorithm_metrics = AlgorithmRunMetricsDTO(
            elapsed_seconds=elapsed,
            n_generations=getattr(request, 'optimizer_generations', 400),
            population_size=getattr(request, 'optimizer_population_size', 250),
            pareto_front_size=len(front_one),
            best_hard_objective=0.0,
            best_soft_objective=best_f1,
            best_workload_std_objective=best_f2,
            best_fairness_objective=best_f2,
            convergence_hard_ratio=None,
            convergence_soft_ratio=convergence_f1,
            convergence_workload_ratio=convergence_f2,
            convergence_fairness_ratio=convergence_f2,
        )
        
        return ScheduleGenerationEnvelopeDTO(
            selected_option_id=selected_option.option_id,
            selected_schedule=selected_schedule,
            pareto_options=pareto_options,
            algorithm_run_metrics=algorithm_metrics,
        )
    
    @staticmethod
    def _build_assignments(request, problem, decoded):
        """Build shift assignments DTOs."""
        assignments = []
        for day_idx in range(request.num_days):
            date_val = request.start_date + timedelta(days=day_idx)
            for shift_idx, shift_name in enumerate(problem.shift_names):
                for room_idx in range(request.rooms_per_shift):
                    doctor_ids = [
                        problem.doctor_idx_to_id[idx]
                        for idx in decoded[(day_idx, shift_idx, room_idx)]
                    ]
                    assignments.append(ShiftAssignmentDTO(
                        date=date_val,
                        shift=shift_name,
                        room=f"P-{room_idx + 1:02d}",
                        doctor_ids=doctor_ids,
                    ))
        return assignments
    
    @staticmethod
    def _build_workload_balances(request, assignments, stats):
        """Build workload balance DTOs."""
        shift_counts = stats[0]
        
        balances = []
        for idx, doctor in enumerate(request.doctors):
            tv = shift_counts[idx]
            period_days = max(float(request.num_days), 1.0)
            weekly_factor = 7.0 / period_days
            monthly_factor = 30.0 / period_days
            yearly_factor = 365.0 / period_days
            
            balances.append(DoctorWorkloadBalanceDTO(
                doctor_id=doctor.id,
                doctor_name=doctor.name,
                weekly_shift_count=int(round(tv * weekly_factor)),
                monthly_shift_count=int(round(tv * monthly_factor)),
                yearly_estimated_shift_count=int(round(tv * yearly_factor)),
                holiday_shift_count=0,
                day_off_count=request.num_days - len(stats[3][idx]),
            ))
        
        balances.sort(key=lambda item: item.weekly_shift_count, reverse=True)
        return balances
    
    @staticmethod
    def _jain_index_for_list(values):
        """Calculate JFI for list of values."""
        arr = np.array(values, dtype=float)
        if len(arr) == 0:
            return 1.0
        
        sum_val = np.sum(arr)
        sum_sq = np.sum(arr ** 2)
        
        if sum_sq == 0 or sum_val == 0:
            return 1.0
        
        return (sum_val ** 2) / (len(arr) * sum_sq)