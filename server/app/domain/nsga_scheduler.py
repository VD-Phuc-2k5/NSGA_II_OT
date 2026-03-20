"""Dịch vụ tối ưu lịch trực bằng NSGA-II cải tiến."""

from __future__ import annotations

import time
from datetime import date, timedelta
from typing import Callable, Dict, List, Tuple

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


class DutySchedulingProblem:
    """Bọc bài toán lập lịch vào giao diện ProblemWrapper của NSGA-II."""

    def __init__(self, request: ScheduleGenerationRequestDTO) -> None:
        self.request = request
        self.doctors = request.doctors
        self.n_doctors = len(self.doctors)
        self.shift_names = SHIFT_NAMES[: request.shifts_per_day]
        self.shift_hours = 8.0
        self.total_shifts = request.num_days * len(self.shift_names)
        self.total_shift_slots = self.total_shifts * request.required_doctors_per_shift
        self.avg_shift_per_doctor = self.total_shift_slots / max(self.n_doctors, 1)

        self.n_obj = 2
        self.n_var = request.num_days * len(self.shift_names) * request.required_doctors_per_shift
        self.xl = np.zeros(self.n_var)
        self.xu = np.full(self.n_var, self.n_doctors - 1)

        self.doctor_index_to_id = [d.id for d in self.doctors]
        self.doctor_id_to_index = {doctor.id: index for index, doctor in enumerate(self.doctors)}
        self.primary_days_off: Dict[str, set[date]] = {}
        self.preferred_extra_days: Dict[str, set[date]] = {}
        for doctor in self.doctors:
            self.primary_days_off[doctor.id] = set(doctor.days_off)
            self.preferred_extra_days[doctor.id] = set(doctor.preferred_extra_days)

        # Nhiễu nhỏ để giảm overfitting theo một pattern cố định khi tối ưu.
        rng = np.random.default_rng(request.random_seed)
        self.assignment_noise = rng.normal(
            loc=0.0,
            scale=max(request.randomization_strength, 1e-5),
            size=(request.num_days, len(self.shift_names), self.n_doctors),
        )

    def evaluate(self, x: np.ndarray) -> np.ndarray:
        """Đánh giá batch nghiệm, trả về ma trận mục tiêu shape (n, 2)."""
        if x.ndim == 1:
            x = x.reshape(1, -1)

        f_values = []
        for candidate in x:
            decoded = self._decode_candidate(candidate)
            hard_score, _underwork_ids = self._hard_penalty(decoded)
            soft_score = self._soft_penalty(decoded)
            fairness_std = self._fairness_std(decoded)
            day_off_fairness_std, _day_off_jain = self._day_off_fairness(decoded)
            fairness = self._fairness_dimensions(decoded)

            fairness_penalty = (
                fairness_std * 80.0
                + day_off_fairness_std * 100.0
                + (1.0 - fairness["weekly_jain"]) * 250.0
                + (1.0 - fairness["monthly_jain"]) * 170.0
                + (1.0 - fairness["yearly_jain"]) * 120.0
                + (1.0 - fairness["holiday_jain"]) * 280.0
            )
            balance_objective = soft_score + fairness_penalty
            f_values.append([hard_score, balance_objective])

        return np.array(f_values, dtype=float)

    def _decode_candidate(self, candidate: np.ndarray) -> Dict[Tuple[int, int], List[int]]:
        """Giải mã vector liên tục thành chỉ số bác sĩ theo từng ca."""
        slots = candidate.reshape(
            self.request.num_days,
            len(self.shift_names),
            self.request.required_doctors_per_shift,
        )
        decoded: Dict[Tuple[int, int], List[int]] = {}
        for day_idx in range(self.request.num_days):
            for shift_idx in range(len(self.shift_names)):
                raw = np.rint(slots[day_idx, shift_idx]).astype(int)
                clipped = np.clip(raw, 0, self.n_doctors - 1)
                decoded[(day_idx, shift_idx)] = clipped.tolist()
        return decoded

    def _assignment_maps(
        self, decoded: Dict[Tuple[int, int], List[int]]
    ) -> tuple[Dict[str, int], Dict[str, int], Dict[str, Dict[tuple[int, int], int]], Dict[str, set[int]], Dict[str, List[int]]]:
        doctor_shift_count: Dict[str, int] = {d.id: 0 for d in self.doctors}
        doctor_holiday_count: Dict[str, int] = {d.id: 0 for d in self.doctors}
        doctor_weekly_hours: Dict[str, Dict[tuple[int, int], int]] = {d.id: {} for d in self.doctors}
        doctor_worked_days: Dict[str, set[int]] = {d.id: set() for d in self.doctors}
        doctor_slot_positions: Dict[str, List[int]] = {d.id: [] for d in self.doctors}
        holiday_set = set(self.request.holiday_dates)

        for day_idx in range(self.request.num_days):
            for shift_idx in range(len(self.shift_names)):
                slot_number = day_idx * len(self.shift_names) + shift_idx
                current_date = self.request.start_date + timedelta(days=day_idx)
                iso_key = current_date.isocalendar()[:2]
                for idx in decoded[(day_idx, shift_idx)]:
                    doctor_id = self.doctors[idx].id
                    doctor_shift_count[doctor_id] += 1
                    doctor_worked_days[doctor_id].add(day_idx)
                    doctor_slot_positions[doctor_id].append(slot_number)
                    doctor_weekly_hours[doctor_id][iso_key] = (
                        doctor_weekly_hours[doctor_id].get(iso_key, 0) + int(self.shift_hours)
                    )
                    if current_date in holiday_set:
                        doctor_holiday_count[doctor_id] += 1
        return (
            doctor_shift_count,
            doctor_holiday_count,
            doctor_weekly_hours,
            doctor_worked_days,
            doctor_slot_positions,
        )

    def _hard_penalty(self, decoded: Dict[Tuple[int, int], List[int]]) -> Tuple[float, List[str]]:
        """Ràng buộc cứng: đúng số bác sĩ/ca (theo param), không vượt trần giờ/tuần (theo param), trần ngày nghỉ."""
        penalty = 0.0

        (
            doctor_shift_count,
            _doctor_holiday_count,
            doctor_weekly_hours,
            _doctor_worked_days,
            _doctor_slot_positions,
        ) = self._assignment_maps(decoded)

        for day_idx in range(self.request.num_days):
            for shift_idx in range(len(self.shift_names)):
                doctor_indices = decoded[(day_idx, shift_idx)]
                if len(doctor_indices) != self.request.required_doctors_per_shift:
                    penalty += 120_000.0
                duplicate_count = len(doctor_indices) - len(set(doctor_indices))
                if duplicate_count > 0:
                    penalty += duplicate_count * 75_000.0

        underwork_ids: List[str] = []
        for doctor in self.doctors:
            doctor_id = doctor.id
            for week_hours in doctor_weekly_hours[doctor_id].values():
                if week_hours > self.request.max_weekly_hours_per_doctor:
                    excess = week_hours - self.request.max_weekly_hours_per_doctor
                    penalty += float((excess ** 2) * 420.0)

            unique_days_off = len(set(doctor.days_off))
            if unique_days_off > self.request.max_days_off_per_doctor:
                penalty += float((unique_days_off - self.request.max_days_off_per_doctor) * 65_000.0)

        return penalty, underwork_ids

    def _soft_penalty(self, decoded: Dict[Tuple[int, int], List[int]]) -> float:
        """Ràng buộc mềm: không trực 2 ca liên tiếp, ưu tiên extra shifts, tôn trọng ngày nghỉ đăng ký."""
        penalty = 0.0
        (
            doctor_shift_count,
            _doctor_holiday_count,
            _doctor_weekly_hours,
            _doctor_worked_days,
            doctor_slot_positions,
        ) = self._assignment_maps(decoded)

        for doctor in self.doctors:
            doctor_id = doctor.id
            doctor_index = self.doctor_id_to_index[doctor_id]
            slots = sorted(doctor_slot_positions[doctor_id])
            for prev_slot, curr_slot in zip(slots, slots[1:]):
                if curr_slot == prev_slot + 1:
                    penalty += 140.0

            for day_idx in range(self.request.num_days):
                day_date = self.request.start_date + timedelta(days=day_idx)
                shifts_today = [
                    shift_idx
                    for shift_idx in range(len(self.shift_names))
                    if doctor_index in decoded[(day_idx, shift_idx)]
                ]

                if day_date in self.primary_days_off[doctor_id] and shifts_today:
                    penalty += 180.0

                if day_date in self.preferred_extra_days[doctor_id]:
                    if shifts_today:
                        penalty -= 45.0
                    else:
                        penalty += 14.0

        counts = np.array(list(doctor_shift_count.values()), dtype=float)
        if len(counts) > 1:
            penalty += float(np.std(counts) * 130.0)
            penalty += float(max(0.0, np.max(counts) - np.min(counts) - 1.0) * 95.0)

        # Nhiễu nhỏ theo tham số randomization để giảm việc solver bám cứng 1 pattern.
        for day_idx in range(self.request.num_days):
            for shift_idx in range(len(self.shift_names)):
                for doctor_index in decoded[(day_idx, shift_idx)]:
                    penalty += float(-self.assignment_noise[day_idx, shift_idx, doctor_index] * 10.0)

        return max(penalty, 0.0)

    def _fairness_std(self, decoded: Dict[Tuple[int, int], List[int]]) -> float:
        """Đo độ cân bằng số ca bằng độ lệch chuẩn, có trọng số ngày lễ."""
        weighted_count: Dict[str, float] = {d.id: 0.0 for d in self.doctors}
        holiday_set = set(self.request.holiday_dates)
        for (day_idx, _shift_idx), doctor_indices in decoded.items():
            current_date = self.request.start_date + timedelta(days=day_idx)
            weight = 1.2 if current_date in holiday_set else 1.0
            for idx in doctor_indices:
                weighted_count[self.doctors[idx].id] += weight
        values = np.array(list(weighted_count.values()), dtype=float)
        return float(np.std(values))

    def _day_off_fairness(self, decoded: Dict[Tuple[int, int], List[int]]) -> Tuple[float, float]:
        """Tính chỉ số cân bằng ngày nghỉ thực tế: (std, Jain)."""
        worked_days: Dict[str, set[int]] = {d.id: set() for d in self.doctors}
        for (day_idx, _shift_idx), doctor_indices in decoded.items():
            for idx in doctor_indices:
                worked_days[self.doctors[idx].id].add(day_idx)

        day_off_counts = np.array(
            [float(self.request.num_days - len(worked_days[d.id])) for d in self.doctors],
            dtype=float,
        )
        if len(day_off_counts) == 0:
            return 0.0, 1.0
        return float(np.std(day_off_counts)), self._jain_index(day_off_counts)

    @staticmethod
    def _jain_index(values: np.ndarray) -> float:
        if values.size == 0:
            return 1.0
        sum_value = float(np.sum(values))
        sum_squares = float(np.sum(values ** 2))
        if sum_squares == 0.0:
            return 1.0
        return float((sum_value ** 2) / (len(values) * sum_squares))

    def _fairness_dimensions(self, decoded: Dict[Tuple[int, int], List[int]]) -> Dict[str, float]:
        doctor_counts = {doctor.id: 0 for doctor in self.doctors}
        holiday_counts = {doctor.id: 0 for doctor in self.doctors}
        holiday_set = set(self.request.holiday_dates)

        for (day_idx, _shift_idx), doctor_indices in decoded.items():
            current_date = self.request.start_date + timedelta(days=day_idx)
            for idx in doctor_indices:
                doctor_id = self.doctors[idx].id
                doctor_counts[doctor_id] += 1
                if current_date in holiday_set:
                    holiday_counts[doctor_id] += 1

        period_days = max(float(self.request.num_days), 1.0)
        counts_array = np.array(list(doctor_counts.values()), dtype=float)
        weekly = counts_array * (7.0 / period_days)
        monthly = counts_array * (30.0 / period_days)
        yearly = counts_array * (365.0 / period_days)
        holiday = np.array(list(holiday_counts.values()), dtype=float)

        return {
            "weekly_jain": self._jain_index(weekly),
            "monthly_jain": self._jain_index(monthly),
            "yearly_jain": self._jain_index(yearly),
            "holiday_jain": self._jain_index(holiday),
        }


class NsgaDutySchedulerService:
    """Service miền nghiệp vụ: tạo lịch trực bằng NSGA-II cải tiến."""

    @staticmethod
    def _normalize_penalty(score: float, scale: float) -> int:
        bounded = 100.0 * np.exp(-max(score, 0.0) / max(scale, 1.0))
        return int(max(0, min(100, round(bounded))))

    @staticmethod
    def _badge(score: int) -> str:
        if score >= 90:
            return "excellent"
        if score >= 75:
            return "good"
        if score >= 60:
            return "acceptable"
        if score >= 40:
            return "warning"
        return "critical"

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
        worked_days: Dict[str, set[date]] = {doctor.id: set() for doctor in request.doctors}

        holiday_set = set(request.holiday_dates)
        for assignment in assignments:
            for doctor_id in assignment.doctor_ids:
                total_count[doctor_id] += 1
                worked_days[doctor_id].add(assignment.date)
                if assignment.date in holiday_set:
                    holiday_count[doctor_id] += 1

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
                    day_off_count=request.num_days - len(worked_days[doctor.id]),
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
        fairness_jain = problem._fairness_dimensions(decoded)

        fairness_std = (0.6 * shift_fairness_std) + (1.4 * day_off_fairness_std)
        fairness_core = (
            fairness_jain["weekly_jain"]
            + fairness_jain["monthly_jain"]
            + fairness_jain["yearly_jain"]
            + fairness_jain["holiday_jain"]
        ) / 4.0

        hard_score_visual = self._normalize_penalty(hard_score, scale=8000.0)
        soft_score_visual = self._normalize_penalty(soft_score, scale=2000.0)
        fairness_score_visual = int(
            max(0, min(100, round((fairness_core * 100.0) - (fairness_std * 6.0))))
        )
        overall_score_visual = int(
            round((0.5 * hard_score_visual) + (0.2 * soft_score_visual) + (0.3 * fairness_score_visual))
        )

        metrics = ScheduleQualityMetricsDTO(
            hard_violation_score=float(hard_score),
            soft_violation_score=float(soft_score),
            fairness_std=float(fairness_std),
            shift_fairness_std=float(shift_fairness_std),
            day_off_fairness_std=float(day_off_fairness_std),
            day_off_fairness_jain=float(day_off_fairness_jain),
            weekly_fairness_jain=float(fairness_jain["weekly_jain"]),
            monthly_fairness_jain=float(fairness_jain["monthly_jain"]),
            yearly_fairness_jain=float(fairness_jain["yearly_jain"]),
            holiday_fairness_jain=float(fairness_jain["holiday_jain"]),
            hard_score_visual=hard_score_visual,
            soft_score_visual=soft_score_visual,
            fairness_score_visual=fairness_score_visual,
            overall_score_visual=overall_score_visual,
            score_badges={
                "hard": self._badge(hard_score_visual),
                "soft": self._badge(soft_score_visual),
                "fairness": self._badge(fairness_score_visual),
                "overall": self._badge(overall_score_visual),
            },
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
        solver = NSGA2ImprovedSmart(
            wrapper,
            pop_size=request.optimizer_population_size,
            n_gen=request.optimizer_generations,
        )
        t0 = time.perf_counter()
        solver.run(progress_callback=progress_callback)
        elapsed_seconds = time.perf_counter() - t0

        sorted_population = sorted(
            solver.population,
            key=lambda ind: (ind.rank if ind.rank is not None else 9999, *tuple(float(v) for v in ind.F)),
        )
        front_one = [ind for ind in sorted_population if ind.rank == 1]
        candidates = front_one if front_one else sorted_population
        limited_candidates = candidates[: request.pareto_options_limit]

        best_hard = float(min(ind.F[0] for ind in front_one)) if front_one else 0.0
        best_balance = float(min(ind.F[1] for ind in front_one)) if front_one else 0.0
        conv_hard: float | None = None
        conv_balance: float | None = None
        if getattr(solver, "history", None) and len(solver.history) >= 2:
            first_F = solver.history[0]
            last_F = solver.history[-1]
            min_h0_first = float(np.min(first_F[:, 0]))
            min_h0_last = float(np.min(last_F[:, 0]))
            min_b_first = float(np.min(first_F[:, 1]))
            min_b_last = float(np.min(last_F[:, 1]))
            if min_h0_first > 1e-12:
                conv_hard = max(0.0, min(1.0, (min_h0_first - min_h0_last) / min_h0_first))
            if min_b_first > 1e-12:
                conv_balance = max(0.0, min(1.0, (min_b_first - min_b_last) / min_b_first))

        algorithm_run_metrics = AlgorithmRunMetricsDTO(
            elapsed_seconds=elapsed_seconds,
            n_generations=request.optimizer_generations,
            population_size=request.optimizer_population_size,
            pareto_front_size=len(front_one),
            best_hard_objective=best_hard,
            best_balance_objective=best_balance,
            convergence_hard_ratio=conv_hard,
            convergence_balance_ratio=conv_balance,
        )

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
            algorithm_run_metrics=algorithm_run_metrics,
        )
