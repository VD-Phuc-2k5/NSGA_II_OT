from __future__ import annotations

import asyncio
import calendar
import uuid
from dataclasses import dataclass
from datetime import datetime
from typing import AsyncGenerator, Dict, List, Tuple

import numpy as np

from nsga2_improved.algorithm import NSGA2ImprovedSmart
from nsga2_improved.core import ProblemWrapper

from ..schemas.models import (
    Assignment,
    ConstraintsConfig,
    Doctor,
    JobStatus,
    OptimizationJob,
    ParetoPoint,
    ScheduleSolution,
    ShiftType,
)
from ..state import state


SHIFT_HOURS = {
    ShiftType.hc.value: 8,
    ShiftType.tr.value: 8,
    ShiftType.night.value: 12,
}


@dataclass
class SchedulingContext:
    month: str
    slots: List[str]
    slots_meta: List[Tuple[int, str]]
    doctors: List[Doctor]
    config: ConstraintsConfig
    availability: np.ndarray


class DoctorSchedulingProblem:
    def __init__(self, ctx: SchedulingContext):
        self.ctx = ctx
        self.n_var = len(ctx.doctors) * len(ctx.slots)
        self.n_obj = 3
        self.xl = np.zeros(self.n_var)
        self.xu = np.ones(self.n_var)

    def evaluate(self, x: np.ndarray) -> np.ndarray:
        if x.ndim == 1:
            x = x.reshape(1, -1)
        vals = []
        for row in x:
            matrix = decode_vector(row, len(self.ctx.doctors), len(self.ctx.slots))
            repaired = repair_schedule(matrix, self.ctx)
            f1, f2, f3 = compute_objectives(repaired, self.ctx)
            vals.append([f1, f2, -f3])
        return np.array(vals)


def decode_vector(vec: np.ndarray, n_doctors: int, n_slots: int) -> np.ndarray:
    return (vec.reshape(n_doctors, n_slots) >= 0.5).astype(int)


def encode_schedule(matrix: np.ndarray) -> List[Assignment]:
    assignments: List[Assignment] = []
    n_doctors, n_slots = matrix.shape
    for slot_idx in range(n_slots):
        day, shift = parse_slot_id(slot_idx)
        doctor_ids = [str(doc_idx) for doc_idx in range(n_doctors) if matrix[doc_idx, slot_idx] == 1]
        assignments.append(
            Assignment(
                slot_id=f"{day:02d}:{shift}",
                shift_type=ShiftType(shift),
                doctor_ids=doctor_ids,
            )
        )
    return assignments


def parse_slot_id(slot_idx: int) -> Tuple[int, str]:
    shift_order = [ShiftType.hc.value, ShiftType.tr.value, ShiftType.night.value]
    day = slot_idx // 3 + 1
    shift = shift_order[slot_idx % 3]
    return day, shift


def build_context(month: str, doctors: List[Doctor], config: ConstraintsConfig) -> SchedulingContext:
    year, month_value = [int(v) for v in month.split("-")]
    _, days = calendar.monthrange(year, month_value)

    slots: List[str] = []
    slots_meta: List[Tuple[int, str]] = []
    shifts = [ShiftType.hc.value, ShiftType.tr.value, ShiftType.night.value]

    for day in range(1, days + 1):
        for shift in shifts:
            slots.append(f"{day:02d}:{shift}")
            slots_meta.append((day, shift))

    availability = build_availability_matrix(doctors, slots_meta, config)
    return SchedulingContext(month=month, slots=slots, slots_meta=slots_meta, doctors=doctors, config=config, availability=availability)


def build_availability_matrix(doctors: List[Doctor], slots_meta: List[Tuple[int, str]], config: ConstraintsConfig) -> np.ndarray:
    matrix = np.ones((len(doctors), len(slots_meta)), dtype=int)
    forbidden = config.group_d.forbidden_shift_by_flag

    for d_idx, doctor in enumerate(doctors):
        banned_shifts: List[str] = []
        if doctor.flags.pregnant and config.group_d.protect_pregnant:
            banned_shifts.extend(forbidden.get("pregnant", []))
        if doctor.flags.senior and config.group_d.protect_senior:
            banned_shifts.extend(forbidden.get("senior", []))
        if doctor.flags.part_time and config.group_d.protect_part_time:
            banned_shifts.extend(forbidden.get("part_time", []))

        for s_idx, (_, shift) in enumerate(slots_meta):
            if shift in banned_shifts:
                matrix[d_idx, s_idx] = 0

        for locked in doctor.fixed_locked_slots:
            if locked in [f"{day:02d}:{shift}" for day, shift in slots_meta]:
                locked_idx = [f"{day:02d}:{shift}" for day, shift in slots_meta].index(locked)
                matrix[d_idx, locked_idx] = 1

    return matrix


def repair_schedule(matrix: np.ndarray, ctx: SchedulingContext) -> np.ndarray:
    repaired = matrix.copy()
    n_doctors, n_slots = repaired.shape

    repaired = repaired * ctx.availability

    for slot_idx, (_, shift) in enumerate(ctx.slots_meta):
        required = ctx.config.group_c.min_doctors_per_shift.get(shift, 1)
        current = int(np.sum(repaired[:, slot_idx]))
        if current < required:
            candidates = [i for i in range(n_doctors) if ctx.availability[i, slot_idx] == 1 and repaired[i, slot_idx] == 0]
            np.random.shuffle(candidates)
            for c in candidates[: required - current]:
                repaired[c, slot_idx] = 1
        elif current > required:
            assigned = [i for i in range(n_doctors) if repaired[i, slot_idx] == 1]
            np.random.shuffle(assigned)
            for c in assigned[: current - required]:
                repaired[c, slot_idx] = 0

    for d_idx in range(n_doctors):
        for s_idx, (day, shift) in enumerate(ctx.slots_meta):
            if shift != ShiftType.night.value or repaired[d_idx, s_idx] == 0:
                continue

            min_rest = max(ctx.config.group_b.min_rest_hours_after_night, 8)
            next_indices = [
                i for i, (next_day, next_shift) in enumerate(ctx.slots_meta)
                if next_day == day + 1 and next_shift in (ShiftType.hc.value, ShiftType.tr.value)
            ]
            for idx in next_indices:
                repaired[d_idx, idx] = 0

            if min_rest >= 24:
                extra_indices = [
                    i for i, (next_day, next_shift) in enumerate(ctx.slots_meta)
                    if next_day == day + 1 and next_shift == ShiftType.night.value
                ]
                for idx in extra_indices:
                    repaired[d_idx, idx] = 0

            if not ctx.config.group_b.allow_two_consecutive_nights:
                consecutive_night = [
                    i for i, (next_day, next_shift) in enumerate(ctx.slots_meta)
                    if next_day == day + 1 and next_shift == ShiftType.night.value
                ]
                for idx in consecutive_night:
                    repaired[d_idx, idx] = 0

    senior_mask = np.array([doc.seniority_score >= 3 for doc in ctx.doctors], dtype=bool)
    for slot_idx in range(n_slots):
        assigned = repaired[:, slot_idx] == 1
        if np.any(assigned) and np.any(~senior_mask & assigned) and not np.any(senior_mask & assigned):
            senior_candidates = np.where((ctx.availability[:, slot_idx] == 1) & senior_mask)[0]
            if len(senior_candidates) > 0:
                repaired[senior_candidates[0], slot_idx] = 1

    return repaired


def compute_objectives(matrix: np.ndarray, ctx: SchedulingContext) -> Tuple[float, float, float]:
    shift_counts = matrix.sum(axis=1)
    f1_std_load = float(np.std(shift_counts))

    weights = ctx.config.group_e
    historical_weights = ctx.config.group_f

    night_indices = [i for i, (_, shift) in enumerate(ctx.slots_meta) if shift == ShiftType.night.value]
    night_counts = matrix[:, night_indices].sum(axis=1) if night_indices else np.zeros(len(ctx.doctors))
    night_balance_penalty = float(np.std(night_counts))

    preference_penalty = 0.0
    preference_score = 0.0

    for d_idx, doctor in enumerate(ctx.doctors):
        for s_idx, (day, shift) in enumerate(ctx.slots_meta):
            key = f"{day:02d}:{shift}"
            pref = doctor.preferences.get(key, 0)
            if matrix[d_idx, s_idx] == 1:
                if pref < 0:
                    preference_penalty += abs(pref)
                else:
                    preference_score += pref

    historical_penalty = 0.0
    for d_idx, doctor in enumerate(ctx.doctors):
        current_night = float(night_counts[d_idx]) if len(night_counts) > d_idx else 0.0
        historical_penalty += max(0.0, current_night + doctor.historical_night_count_12m * 0.05 - np.mean(night_counts) if len(night_counts) > 0 else 0.0)
        if doctor.flags.difficult_circumstances:
            historical_penalty += max(0.0, shift_counts[d_idx] - np.mean(shift_counts))

    f2_soft_penalty = (
        weights.balance_load * night_balance_penalty
        + weights.preference * preference_penalty
        + historical_weights.historical_fairness * historical_penalty
    )

    f3_preference_satisfaction = float(preference_score)
    return f1_std_load, f2_soft_penalty, f3_preference_satisfaction


def matrix_to_solution(solution_id: str, matrix: np.ndarray, ctx: SchedulingContext, objectives: Dict[str, float]) -> ScheduleSolution:
    assignments: List[Assignment] = []
    for slot_idx, (day, shift) in enumerate(ctx.slots_meta):
        doctor_ids = [ctx.doctors[d_idx].id for d_idx in range(len(ctx.doctors)) if matrix[d_idx, slot_idx] == 1]
        assignments.append(
            Assignment(
                slot_id=f"{day:02d}:{shift}",
                shift_type=ShiftType(shift),
                doctor_ids=doctor_ids,
            )
        )

    return ScheduleSolution(solution_id=solution_id, objectives=objectives, assignments=assignments)


async def run_optimization_job(job_id: str, month: str, pop_size: int, generations: int) -> None:
    doctors = state.doctors
    if not doctors:
        raise ValueError("No doctors configured")

    config = state.config
    ctx = build_context(month, doctors, config)

    problem = DoctorSchedulingProblem(ctx)
    wrapper = ProblemWrapper(problem)
    solver = NSGA2ImprovedSmart(wrapper, pop_size=pop_size, n_gen=generations)

    job = state.jobs[job_id]
    job.status = JobStatus.running
    job.updated_at = datetime.utcnow()
    await push_event(job_id, {"type": "status", "status": job.status.value, "message": "Starting optimization"})

    solutions: List[ScheduleSolution] = []

    for gen in range(generations):
        if gen == 0:
            solver.population = solver._build_initial_population(None)
            solver.history.clear()
        else:
            solver.population = solver.population

        stagnation_counter = 0
        last_ideal = None
        stagnation_counter, last_ideal = solver._check_and_handle_stagnation(stagnation_counter, last_ideal)
        offspring = solver._generate_offspring(gen)
        solver._evaluate_unevaluated(offspring)
        combined = solver.population + offspring
        from nsga2_improved.selection import environmental_selection, remove_duplicates

        combined = remove_duplicates(combined)
        combined = solver._fill_if_too_small(combined)
        solver.population = environmental_selection(combined, solver.pop_size, solver.n_obj)
        solver._update_adaptive_parameters(offspring)

        fronts = np.array([ind.F for ind in solver.population])
        if len(fronts) == 0:
            continue

        job.generation = gen + 1
        job.progress = (gen + 1) / generations
        job.updated_at = datetime.utcnow()

        pareto_preview = sorted(fronts.tolist(), key=lambda x: x[0] + x[1])[:8]
        await push_event(
            job_id,
            {
                "type": "progress",
                "generation": job.generation,
                "progress": job.progress,
                "objectives": pareto_preview,
                "pareto_count": len(fronts),
            },
        )
        await asyncio.sleep(0.01)

    final_front = np.array([ind.F for ind in solver.population])
    pareto_points: List[ParetoPoint] = []

    selected = sorted(solver.population, key=lambda ind: (ind.rank or 99, np.sum(ind.F)))[:20]
    for idx, ind in enumerate(selected):
        matrix = repair_schedule(decode_vector(ind.X, len(ctx.doctors), len(ctx.slots)), ctx)
        solution_id = f"sol-{idx+1}"
        objectives = {"f1": float(ind.F[0]), "f2": float(ind.F[1]), "f3": float(-ind.F[2])}
        solutions.append(matrix_to_solution(solution_id, matrix, ctx, objectives))
        pareto_points.append(ParetoPoint(solution_id=solution_id, f1=objectives["f1"], f2=objectives["f2"], f3=objectives["f3"]))

    job.status = JobStatus.done
    job.progress = 1.0
    job.pareto_front = pareto_points
    job.solutions = solutions
    job.updated_at = datetime.utcnow()

    state.schedules_by_month[month] = solutions
    if solutions:
        state.selected_solution_by_month[month] = solutions[0].solution_id

    await push_event(
        job_id,
        {
            "type": "completed",
            "status": job.status.value,
            "pareto_front": [p.model_dump() for p in pareto_points],
            "solutions": [s.model_dump() for s in solutions],
        },
    )


def compute_reports(month: str) -> List[Dict[str, object]]:
    solution = state.get_selected_solution(month)
    if not solution:
        return []

    doctor_map = {d.id: d for d in state.doctors}
    stats: Dict[str, Dict[str, int]] = {
        d.id: {"total_shifts": 0, "total_hours": 0, "night_shifts": 0, "holiday_shifts": 0}
        for d in state.doctors
    }

    for assignment in solution.assignments:
        day = int(assignment.slot_id.split(":")[0])
        for doctor_id in assignment.doctor_ids:
            if doctor_id not in stats:
                continue
            stats[doctor_id]["total_shifts"] += 1
            stats[doctor_id]["total_hours"] += SHIFT_HOURS.get(assignment.shift_type.value, 8)
            if assignment.shift_type == ShiftType.night:
                stats[doctor_id]["night_shifts"] += 1
            if day in {1, 2, 28, 29, 30, 31}:
                stats[doctor_id]["holiday_shifts"] += 1

    rows: List[Dict[str, object]] = []
    for doctor_id, values in stats.items():
        rows.append(
            {
                "doctor_id": doctor_id,
                "doctor_name": doctor_map[doctor_id].full_name,
                **values,
            }
        )
    return rows


async def push_event(job_id: str, payload: Dict[str, object]) -> None:
    await state.event_channels[job_id].put(payload)


async def stream_events(job_id: str) -> AsyncGenerator[Dict[str, object], None]:
    queue = state.event_channels[job_id]
    while True:
        data = await queue.get()
        yield data
        if data.get("type") == "completed" or data.get("type") == "failed":
            break


def create_job(month: str) -> OptimizationJob:
    job_id = str(uuid.uuid4())
    job = OptimizationJob(id=job_id, month=month)
    state.jobs[job_id] = job
    return job
