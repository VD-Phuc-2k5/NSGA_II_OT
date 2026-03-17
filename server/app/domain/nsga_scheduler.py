"""
Dịch vụ tối ưu lịch trực bằng NSGA-II cải tiến (khong sua doi thuat toan goc).
"""

from __future__ import annotations

from datetime import timedelta
from typing import Callable, Dict, List, Tuple

import numpy as np

from nsga2_improved import NSGA2ImprovedSmart, ProblemWrapper

from .schemas import (
    DoctorWorkloadBalanceDTO,
    ParetoScheduleOptionDTO,
    ScheduleGenerationEnvelopeDTO,
    ScheduleGenerationRequestDTO,
    ScheduleGenerationResultDTO,
    ScheduleQualityMetricsDTO,
    ShiftAssignmentDTO,
)


SHIFT_NAMES = ("morning", "afternoon")


class DutySchedulingProblem:
    """Bọc bài toán lập lịch vào giao diện ProblemWrapper của NSGA-II."""

    def __init__(self, request: ScheduleGenerationRequestDTO) -> None:
        self.request = request
        self.doctors = request.doctors
        self.n_doctors = len(self.doctors)
        self.shift_names = SHIFT_NAMES[: request.shifts_per_day]
        self.shift_hours = 8.0
        self.total_shift_slots = (
            request.num_days
            * len(self.shift_names)
            * request.required_doctors_per_shift
        )
        self.avg_shift_per_doctor = self.total_shift_slots / max(self.n_doctors, 1)

        # Min shift target cân bằng: lấy 70% của trung bình sẵn có, không vượt áp lực từ min_weekly_hours
        desired_min_weekly_shift = self.request.min_weekly_hours / self.shift_hours
        desired_min_for_period = desired_min_weekly_shift * (self.request.num_days / 7.0)
        # Mục tiêu thực: 70% trung bình hoặc mục tiêu mong muốn, cái nào thấp hơn
        self.min_shift_target = min(desired_min_for_period, max(1.0, self.avg_shift_per_doctor * 0.7))
        self.must_assign_everyone = self.total_shift_slots >= self.n_doctors

        self.n_obj = 2
        self.n_var = request.num_days * len(self.shift_names) * request.required_doctors_per_shift
        self.xl = np.zeros(self.n_var)
        self.xu = np.full(self.n_var, self.n_doctors - 1)

        self.doctor_index_to_id = [d.id for d in self.doctors]
        self.doctor_id_to_index = {d.id: i for i, d in enumerate(self.doctors)}
        self.primary_days_off: Dict[str, set] = {}
        self.overflow_days_off: Dict[str, set] = {}

        for doctor in self.doctors:
            unique_days = sorted(set(doctor.days_off))
            primary = set(unique_days[: self.request.max_days_off_per_doctor])
            overflow = set(unique_days[self.request.max_days_off_per_doctor :])
            self.primary_days_off[doctor.id] = primary
            self.overflow_days_off[doctor.id] = overflow

    def evaluate(self, x: np.ndarray) -> np.ndarray:
        """Đánh giá batch nghiệm, trả về ma trận mục tiêu shape (n, 2)."""
        if x.ndim == 1:
            x = x.reshape(1, -1)

        f_values = []
        for candidate in x:
            decoded = self._decode_candidate(candidate)
            hard_score, underwork_ids = self._hard_penalty(decoded)
            soft_score = self._soft_penalty(decoded)
            shift_fairness_std = self._fairness_std(decoded)
            day_off_fairness_std, _day_off_jain = self._day_off_fairness(decoded)

            # Mục tiêu 1: hard constraint (ưu tiên tuyệt đối)
            # Mục tiêu 2: balance = soft + fairness (ưu tiên cân bằng shifts)
            # Tăng trọng số fairness shifts lên 1.2 để cân bằng tốt hơn
            fairness_std = (1.2 * shift_fairness_std) + (1.65 * day_off_fairness_std)
            balance_objective = soft_score + fairness_std

            # Nếu còn bác sĩ dưới mục tiêu, tăng hard penalty nữa
            if underwork_ids:
                hard_score += float(len(underwork_ids) * 5000.0)

            f_values.append([hard_score, balance_objective])

        return np.array(f_values, dtype=float)

    def _decode_candidate(self, candidate: np.ndarray) -> Dict[Tuple[int, int], List[int]]:
        """Giải mã vector liên tục thành chỉ số bác sĩ theo từng ca."""
        slots = candidate.reshape(self.request.num_days, len(self.shift_names), self.request.required_doctors_per_shift)
        decoded: Dict[Tuple[int, int], List[int]] = {}

        for day_idx in range(self.request.num_days):
            for shift_idx in range(len(self.shift_names)):
                raw = np.rint(slots[day_idx, shift_idx]).astype(int)
                clipped = np.clip(raw, 0, self.n_doctors - 1)
                decoded[(day_idx, shift_idx)] = clipped.tolist()

        return decoded

    def _hard_penalty(self, decoded: Dict[Tuple[int, int], List[int]]) -> Tuple[float, List[str]]:
        """Tính tổng phạt ràng buộc cứng. Ưu tiên: 1) mỗi bác sĩ ≥1 ca, 2) ngày lễ cân bằng, 3) an toàn sức khỏe."""
        penalty = 0.0
        doctor_shift_count: Dict[str, int] = {d.id: 0 for d in self.doctors}
        doctor_holiday_count: Dict[str, int] = {d.id: 0 for d in self.doctors}
        doctor_consecutive: Dict[str, int] = {d.id: 0 for d in self.doctors}  # Track max consecutive shifts
        holiday_set = set(self.request.holiday_dates)

        for (day_idx, shift_idx), doctor_indices in decoded.items():
            # Kiểm tra số lượng bác sĩ chính xác mỗi ca
            if len(doctor_indices) != self.request.required_doctors_per_shift:
                penalty += 50000.0

            # Tránh lặp bác sĩ trong cùng ca
            duplicates = len(doctor_indices) - len(set(doctor_indices))
            penalty += duplicates * 20000.0

            current_date = self.request.start_date + timedelta(days=day_idx)
            is_holiday = current_date in holiday_set

            has_intern = False
            has_senior = False

            for idx in doctor_indices:
                doc = self.doctors[idx]
                doctor_shift_count[doc.id] += 1
                
                if is_holiday:
                    doctor_holiday_count[doc.id] += 1

                if doc.experiences < 2:
                    has_intern = True
                else:
                    has_senior = True

            # Ca phải có ít nhất 1 thực tập (trainee) nếu có thực tập
            interns = sum(1 for idx in doctor_indices if self.doctors[idx].experiences < 2)
            if interns == 0 and has_intern:
                penalty += 6000.0
            
            # Không được toàn bác sĩ mới (không có senior kèm)
            if has_intern and not has_senior:
                penalty += 6000.0

        # === KIỂM TRA NGÀY LIÊN TIẾP (SỨC KHỎE) ===
        doctor_schedule: Dict[str, List[int]] = {d.id: [] for d in self.doctors}
        for (day_idx, shift_idx), doctor_indices in decoded.items():
            for idx in doctor_indices:
                doc = self.doctors[idx]
                if day_idx not in doctor_schedule[doc.id]:
                    doctor_schedule[doc.id].append(day_idx)
        
        for doc in self.doctors:
            days_worked = sorted(doctor_schedule[doc.id])
            if days_worked:
                # Tìm streak dài nhất (ngày liên tiếp làm việc)
                max_consecutive = 1
                current_consecutive = 1
                for i in range(1, len(days_worked)):
                    if days_worked[i] == days_worked[i-1] + 1:
                        current_consecutive += 1
                        max_consecutive = max(max_consecutive, current_consecutive)
                    else:
                        current_consecutive = 1
                
                # Phạt nặng nếu quá 4 ngày liên tiếp
                if max_consecutive > 4:
                    penalty += float((max_consecutive - 4) * 4000.0)
                
                doctor_consecutive[doc.id] = max_consecutive

        underwork_ids: List[str] = []
        min_shift_target = max(1.0, self.min_shift_target)
        
        for doc in self.doctors:
            worked = doctor_shift_count[doc.id]

            # CRITICAL: Nếu năng lực đủ, mỗi bác sĩ bắt buộc ≥1 ca
            if self.must_assign_everyone and worked == 0:
                underwork_ids.append(doc.id)
                penalty += 50000.0
            
            # Nếu có ca nhưng dưới mục tiêu tối thiểu
            elif worked < min_shift_target:
                underwork_ids.append(doc.id)
                gap = min_shift_target - worked
                penalty += gap * 2000.0

            # Tránh dồn quá nhiều ca cho một người (sức khỏe)
            max_healthy_target = max(self.avg_shift_per_doctor * 1.8, min_shift_target + 2.0)
            if worked > max_healthy_target:
                penalty += (worked - max_healthy_target) * 3000.0

            # Phạt nặng cho số ngày nghỉ đăng ký vượt trần
            overflow_days = len(self.overflow_days_off[doc.id])
            if overflow_days > 0:
                penalty += float((overflow_days ** 2) * 1500.0)

        # === NGÀY LỄ PHẢI CÂN BẰNG HOÀN TOÀN ===
        if holiday_set and doctor_holiday_count:
            holiday_counts = list(doctor_holiday_count.values())
            if holiday_counts and len(holiday_counts) > 1:
                min_holiday = min(holiday_counts)
                max_holiday = max(holiday_counts)
                holiday_gap = max_holiday - min_holiday
                
                # Phạt rất nặng nếu ngày lễ không cân bằng
                if holiday_gap > 0:
                    penalty += float((holiday_gap ** 2) * 5000.0)

        return penalty, underwork_ids

    def _soft_penalty(self, decoded: Dict[Tuple[int, int], List[int]]) -> float:
        """Tính phạt cho các ưu tiên mềm: day-off requests, rest periods, shift balance, extra requests."""
        penalty = 0.0

        doctor_day_shift: Dict[str, Dict[int, List[int]]] = {
            d.id: {day: [] for day in range(self.request.num_days)} for d in self.doctors
        }

        for (day_idx, shift_idx), doctor_indices in decoded.items():
            for idx in doctor_indices:
                doctor_day_shift[self.doctors[idx].id][day_idx].append(shift_idx)

        # Tính số ca của mỗi bác sĩ
        doctor_shift_count: Dict[str, int] = {}
        for doc in self.doctors:
            doc_days = doctor_day_shift[doc.id]
            worked_days = sum(
                1 for shifts in doc_days.values() if len(shifts) > 0
            )
            doctor_shift_count[doc.id] = worked_days

        for doc in self.doctors:
            doc_days = doctor_day_shift[doc.id]

            for day_idx, shift_list in doc_days.items():
                normalized = sorted(shift_list)

                # Soft: tránh 2 ca trong cùng ngày (mệt)
                if len(normalized) > 1:
                    penalty += 80.0 * (len(normalized) - 1)

                # Soft: tránh combo sáng-chiều (sáng chiều không thích hợp)
                if 0 in normalized and 1 in normalized:
                    penalty += 60.0

                current_date = self.request.start_date + timedelta(days=day_idx)
                
                # Soft: xin ngày nghỉ mà không được làm = phạt
                if current_date in self.primary_days_off[doc.id] and shift_list:
                    penalty += 150.0
                elif current_date in self.overflow_days_off[doc.id] and shift_list:
                    penalty += 70.0
                
                # Soft: thưởng nếu được xếp vào ngày muốn trực thêm
                if current_date in doc.preferred_extra_days and shift_list:
                    penalty -= 5.0

        # === KIỂM TRA KHOẢNG NGHỈ (REST PERIOD) ===
        # Khuyến khích để bác sĩ có ít nhất 1 ngày nghỉ sau mỗi 3 ngày làm
        for doc in self.doctors:
            days_worked = sorted(set([day_idx for day_idx in doctor_day_shift[doc.id] if len(doctor_day_shift[doc.id][day_idx]) > 0]))
            if len(days_worked) > 3:
                for i in range(len(days_worked) - 3):
                    # Kiểm tra: 3 ngày liên tiếp (hoặc gần) có khoảng nghỉ không?
                    if days_worked[i+2] - days_worked[i] <= 2:  # 3 ngày trong 3 ngày liên tiếp
                        # Nên có 1 ngày nghỉ trong đó
                        gap_found = False
                        for check_day in range(days_worked[i], days_worked[i+2]+1):
                            if check_day not in days_worked:
                                gap_found = True
                                break
                        if not gap_found:
                            penalty += 150.0  # Phạt vì không có ngày nghỉ

        # === CÂN BẰNG SỐ CA: Phạt nặng cho sự chênh lệch ===
        shift_counts = list(doctor_shift_count.values())
        if shift_counts and len(shift_counts) > 1:
            min_shifts = min(shift_counts)
            max_shifts = max(shift_counts)
            shift_gap = max_shifts - min_shifts
            
            # Phạt rất nặng nếu gap lớn (chỉ số: gap > 2)
            if shift_gap > 2:
                penalty += float((shift_gap - 2) ** 1.5 * 350.0)
            elif shift_gap > 1:
                penalty += float((shift_gap - 1) * 200.0)
            
            # Phạt thêm dựa trên std của shift distribution
            shift_std = float(np.std(np.array(shift_counts, dtype=float)))
            penalty += shift_std * 120.0

        # === CÂN BẰNG NGÀY NGHỈ ===
        day_off_counts: List[int] = []
        for doc in self.doctors:
            worked_days = doctor_shift_count[doc.id]
            day_off_counts.append(self.request.num_days - worked_days)

        if day_off_counts and len(day_off_counts) > 1:
            gap = max(day_off_counts) - min(day_off_counts)
            std_off = float(np.std(np.array(day_off_counts, dtype=float)))

            # Soft: cho phép gap nhỏ, phạt khi lớn
            if gap > 1:
                penalty += float((gap - 1) * 85.0)
            penalty += std_off * 25.0

        return max(penalty, 0.0)

    def _fairness_std(self, decoded: Dict[Tuple[int, int], List[int]]) -> float:
        """Đo độ cân bằng số ca bằng độ lệch chuẩn, có trọng số ngày lễ."""
        weighted_count: Dict[str, float] = {d.id: 0.0 for d in self.doctors}

        holiday_set = set(self.request.holiday_dates)
        for (day_idx, _shift_idx), doctor_indices in decoded.items():
            current_date = self.request.start_date + timedelta(days=day_idx)
            # Ngày lễ được tính 1.2x để thể hiện giá trị cao hơn
            weight = 1.2 if current_date in holiday_set else 1.0
            for idx in doctor_indices:
                weighted_count[self.doctors[idx].id] += weight

        values = np.array(list(weighted_count.values()), dtype=float)
        return float(np.std(values))

    def _day_off_fairness(self, decoded: Dict[Tuple[int, int], List[int]]) -> Tuple[float, float]:
        """Tính chỉ số cân bằng ngày nghỉ thực tế: (std, Jain)."""
        doctor_day_shift: Dict[str, Dict[int, List[int]]] = {
            d.id: {day: [] for day in range(self.request.num_days)} for d in self.doctors
        }

        for (day_idx, shift_idx), doctor_indices in decoded.items():
            for idx in doctor_indices:
                doctor_day_shift[self.doctors[idx].id][day_idx].append(shift_idx)

        day_off_counts: List[float] = []
        for doc in self.doctors:
            worked_days = sum(
                1 for shifts in doctor_day_shift[doc.id].values() if len(shifts) > 0
            )
            day_off_counts.append(float(self.request.num_days - worked_days))

        if not day_off_counts:
            return 0.0, 1.0

        values = np.array(day_off_counts, dtype=float)
        std_value = float(np.std(values))
        sum_value = float(np.sum(values))
        sum_squares = float(np.sum(values ** 2))
        jain_value = (sum_value ** 2) / (len(values) * sum_squares) if sum_squares > 0 else 1.0
        return std_value, float(jain_value)


class NsgaDutySchedulerService:
    """Service miền nghiệp vụ: tạo lịch trực bằng NSGA-II cải tiến."""

    def _build_assignments(
        self,
        request: ScheduleGenerationRequestDTO,
        problem: DutySchedulingProblem,
        decoded: Dict[Tuple[int, int], List[int]],
    ) -> List[ShiftAssignmentDTO]:
        assignments: List[ShiftAssignmentDTO] = []
        for day_idx in range(request.num_days):
            date_value = request.start_date + timedelta(days=day_idx)
            for shift_idx, shift_name in enumerate(problem.shift_names):
                doctor_ids = [problem.doctor_index_to_id[idx] for idx in decoded[(day_idx, shift_idx)]]
                assignments.append(
                    ShiftAssignmentDTO(
                        date=date_value,
                        shift=shift_name,
                        doctor_ids=doctor_ids,
                    )
                )
        return assignments

    def _build_workload_balances(
        self,
        request: ScheduleGenerationRequestDTO,
        assignments: List[ShiftAssignmentDTO],
    ) -> List[DoctorWorkloadBalanceDTO]:
        total_count: Dict[str, int] = {doctor.id: 0 for doctor in request.doctors}
        holiday_count: Dict[str, int] = {doctor.id: 0 for doctor in request.doctors}

        holiday_set = set(request.holiday_dates)
        for assignment in assignments:
            assignment_date = assignment.date
            for doctor_id in assignment.doctor_ids:
                total_count[doctor_id] += 1.0
                if assignment_date in holiday_set:
                    holiday_count[doctor_id] += 1.0

        period_days = max(float(request.num_days), 1.0)
        weekly_factor = 7.0 / period_days
        monthly_factor = 30.0 / period_days
        yearly_factor = 365.0 / period_days

        balances: List[DoctorWorkloadBalanceDTO] = []
        for doctor in request.doctors:
            total_value = total_count[doctor.id]
            balances.append(
                DoctorWorkloadBalanceDTO(
                    doctor_id=doctor.id,
                    doctor_name=doctor.name,
                    weekly_shift_count=int(round(total_value * weekly_factor)),
                    monthly_shift_count=int(round(total_value * monthly_factor)),
                    yearly_estimated_shift_count=int(round(total_value * yearly_factor)),
                    holiday_shift_count=holiday_count[doctor.id],
                    day_off_count=len(doctor.days_off),
                )
            )

        balances.sort(key=lambda item: item.weekly_shift_count, reverse=True)
        return balances

    def _evaluate_candidate(
        self,
        request: ScheduleGenerationRequestDTO,
        problem: DutySchedulingProblem,
        decoded: Dict[Tuple[int, int], List[int]],
    ) -> tuple[ScheduleQualityMetricsDTO, List[ShiftAssignmentDTO], List[DoctorWorkloadBalanceDTO]]:
        hard_score, underwork_ids = problem._hard_penalty(decoded)
        soft_score = problem._soft_penalty(decoded)
        shift_fairness_std = problem._fairness_std(decoded)
        day_off_fairness_std, day_off_fairness_jain = problem._day_off_fairness(decoded)
        fairness_std = (0.35 * shift_fairness_std) + (1.65 * day_off_fairness_std)

        metrics = ScheduleQualityMetricsDTO(
            hard_violation_score=float(hard_score),
            soft_violation_score=float(soft_score),
            fairness_std=float(fairness_std),
            shift_fairness_std=float(shift_fairness_std),
            day_off_fairness_std=float(day_off_fairness_std),
            day_off_fairness_jain=float(day_off_fairness_jain),
            weekly_underwork_doctors=underwork_ids,
        )
        assignments = self._build_assignments(request, problem, decoded)
        balances = self._build_workload_balances(request, assignments)
        return metrics, assignments, balances

    def generate(
        self,
        request: ScheduleGenerationRequestDTO,
        progress_callback: Callable[[int, int], None] | None = None,
    ) -> ScheduleGenerationEnvelopeDTO:
        if len(request.doctors) < request.required_doctors_per_shift:
            raise ValueError("So bac si phai lon hon hoac bang so luong toi thieu moi ca")

        problem = DutySchedulingProblem(request)
        wrapper = ProblemWrapper(problem)

        # Giữ nguyên thuật toán NSGA-II cải tiến hiện có.
        solver = NSGA2ImprovedSmart(
            wrapper,
            pop_size=request.optimizer_population_size,
            n_gen=request.optimizer_generations,
        )
        solver.run(progress_callback=progress_callback)

        sorted_population = sorted(
            solver.population,
            key=lambda ind: (ind.rank if ind.rank is not None else 9999, *tuple(float(v) for v in ind.F)),
        )
        front_one = [ind for ind in sorted_population if ind.rank == 1]
        candidates = front_one if front_one else sorted_population
        limited_candidates = candidates[: request.pareto_options_limit]

        pareto_options: List[ParetoScheduleOptionDTO] = []
        for idx, individual in enumerate(limited_candidates, start=1):
            decoded = problem._decode_candidate(individual.X)
            metrics, assignments, balances = self._evaluate_candidate(request, problem, decoded)
            pareto_options.append(
                ParetoScheduleOptionDTO(
                    option_id=f"OPT-{idx:02d}",
                    metrics=metrics,
                    assignments=assignments,
                    doctor_workload_balances=balances,
                )
            )

        if not pareto_options:
            raise ValueError("Khong tao duoc nghiem Pareto hop le")

        selected_option = pareto_options[0]
        selected_schedule = ScheduleGenerationResultDTO(
            start_date=request.start_date,
            num_days=request.num_days,
            required_doctors_per_shift=request.required_doctors_per_shift,
            shifts_per_day=request.shifts_per_day,
            metrics=selected_option.metrics,
            assignments=selected_option.assignments,
        )

        return ScheduleGenerationEnvelopeDTO(
            selected_option_id=selected_option.option_id,
            selected_schedule=selected_schedule,
            pareto_options=pareto_options,
        )
