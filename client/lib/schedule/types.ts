export type DoctorInput = {
  id: string;
  name: string;
  experiences: number;
  department_id: string;
  specialization: string;
  days_off: string[];
  preferred_extra_days: string[];
  has_valid_license: boolean;
  is_intern: boolean;
};

export type ShiftAssignment = {
  date: string;
  shift: string;
  room: string;
  doctor_ids: string[];
};

export type ScheduleQualityMetricsDTO = {
  hard_violation_score: number;
  soft_violation_score: number;
  fairness_std: number;
  shift_fairness_std: number;
  day_off_fairness_std: number;
  day_off_fairness_jain: number;
  weekly_fairness_jain: number;
  monthly_fairness_jain: number;
  yearly_fairness_jain: number;
  holiday_fairness_jain: number;
  f3_workload_std: number;
  f4_fairness: number;
  gini_workload: number;
  jfi_overall: number;
  hard_score_visual: number;
  soft_score_visual: number;
  workload_score_visual: number;
  fairness_score_visual: number;
  overall_score_visual: number;
  score_badges: Record<string, string>;
  weekly_underwork_doctors: string[];
};

export type DoctorWorkloadBalanceDTO = {
  doctor_id: string;
  doctor_name: string;
  weekly_shift_count: number;
  monthly_shift_count: number;
  yearly_estimated_shift_count: number;
  holiday_shift_count: number;
  day_off_count: number;
};

export type ParetoScheduleAssignmentsDTO = {
  option_id: string;
  assignments: ShiftAssignment[];
  doctor_workload_balances: DoctorWorkloadBalanceDTO[];
};

export type ScheduleSliceDTO = {
  start_date: string;
  num_days: number;
  rooms_per_shift: number;
  doctors_per_room: number;
  shifts_per_day: number;
  assignments: ShiftAssignment[];
};

export type ScheduleJobScheduleResponseDTO = {
  request_id: string;
  selected_option_id: string;
  selected: ScheduleSliceDTO;
  pareto_options: ParetoScheduleAssignmentsDTO[];
};

export type ParetoScheduleMetricsItemDTO = {
  option_id: string;
  metrics: ScheduleQualityMetricsDTO;
};

export type AlgorithmRunMetricsDTO = {
  elapsed_seconds: number;
  n_generations: number;
  population_size: number;
  pareto_front_size: number;
  best_hard_objective: number;
  best_soft_objective: number;
  best_workload_std_objective: number;
  best_fairness_objective: number;
  convergence_hard_ratio: number | null;
  convergence_soft_ratio: number | null;
  convergence_workload_ratio: number | null;
  convergence_fairness_ratio: number | null;
};

export type ScheduleJobMetricsResponseDTO = {
  request_id: string;
  algorithm_run_metrics: AlgorithmRunMetricsDTO | null;
  pareto_options: ParetoScheduleMetricsItemDTO[];
};

export type JobStatus = "queued" | "running" | "completed" | "failed";

export type ScheduleJobStatusDTO = {
  request_id: string;
  status: JobStatus;
  progress_percent: number;
  message: string;
  error: string | null;
};

export type ScheduleRequestAcceptedDTO = {
  request_id: string;
  status: JobStatus;
  progress_percent: number;
  message: string;
};

export type RequestJob = {
  request_id: string;
  status: JobStatus;
  progress_percent: number;
  message: string;
  error?: string;
};

export type ShiftDetailState = {
  date: string;
  shift: string;
  room: string;
  doctorIds: string[];
};
