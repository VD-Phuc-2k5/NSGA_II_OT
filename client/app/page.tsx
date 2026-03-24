"use client";

import { useEffect, useMemo, useState } from "react";

type DoctorInput = {
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

type ShiftAssignment = {
  date: string;
  shift: string;
  room: string;
  doctor_ids: string[];
};

type ScheduleQualityMetricsDTO = {
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

type DoctorWorkloadBalanceDTO = {
  doctor_id: string;
  doctor_name: string;
  weekly_shift_count: number;
  monthly_shift_count: number;
  yearly_estimated_shift_count: number;
  holiday_shift_count: number;
  day_off_count: number;
};

type ParetoScheduleAssignmentsDTO = {
  option_id: string;
  assignments: ShiftAssignment[];
  doctor_workload_balances: DoctorWorkloadBalanceDTO[];
};

type ScheduleSliceDTO = {
  start_date: string;
  num_days: number;
  rooms_per_shift: number;
  doctors_per_room: number;
  shifts_per_day: number;
  assignments: ShiftAssignment[];
};

type ScheduleJobScheduleResponseDTO = {
  request_id: string;
  selected_option_id: string;
  selected: ScheduleSliceDTO;
  pareto_options: ParetoScheduleAssignmentsDTO[];
};

type ParetoScheduleMetricsItemDTO = {
  option_id: string;
  metrics: ScheduleQualityMetricsDTO;
};

type AlgorithmRunMetricsDTO = {
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

type ScheduleJobMetricsResponseDTO = {
  request_id: string;
  algorithm_run_metrics: AlgorithmRunMetricsDTO | null;
  pareto_options: ParetoScheduleMetricsItemDTO[];
};

type ScheduleJobStatusDTO = {
  request_id: string;
  status: "queued" | "running" | "completed" | "failed";
  progress_percent: number;
  message: string;
  error: string | null;
};

type ScheduleSetupAcceptedDTO = {
  setup_id: string;
  message: string;
};

type ScheduleRequestAcceptedDTO = {
  request_id: string;
  status: "queued" | "running" | "completed" | "failed";
  progress_percent: number;
  message: string;
};

type RequestJob = {
  request_id: string;
  status: "queued" | "running" | "completed" | "failed";
  progress_percent: number;
  message: string;
  error?: string;
};

type ShiftDetailState = {
  date: string;
  shift: string;
  room: string;
  doctorIds: string[];
};

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.trim() || "http://localhost:8000";
const SHIFT_ORDER = ["morning", "afternoon"];
const SHIFT_LABELS: Record<string, string> = {
  morning: "Sáng",
  afternoon: "Chiều"
};

/** Nhãn trạng thái tác vụ (API trả tiếng Anh — hiển thị tiếng Việt) */
const JOB_STATUS_VI: Record<string, string> = {
  queued: "Đang chờ",
  running: "Đang chạy",
  completed: "Hoàn tất",
  failed: "Thất bại"
};

function jobStatusLabel(status: string): string {
  return JOB_STATUS_VI[status] ?? status;
}

function parseLocalDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function toLocalDateStr(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Ngày 1 của tháng kế tiếp (theo giờ địa phương). */
function firstDayOfNextMonth(from: Date = new Date()): Date {
  const y = from.getFullYear();
  const m = from.getMonth();
  return new Date(y, m + 1, 1);
}

/** Số ngày trong tháng dương lịch của `date`. */
function daysInCalendarMonth(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

/**
 * Lập lịch trọn một tháng dương lịch: từ `startStr` đến hết tháng chứa ngày đó.
 * (Nếu bắt đầu ngày 1 → đủ cả tháng.)
 */
function numDaysThroughEndOfCalendarMonth(startStr: string): number {
  const start = parseLocalDate(startStr);
  const lastDay = daysInCalendarMonth(start);
  const startDay = start.getDate();
  return Math.max(1, lastDay - startDay + 1);
}

function buildPeriodDates(startDate: string, numDays: number): string[] {
  const day0 = parseLocalDate(startDate);
  return Array.from({ length: numDays }, (_, i) => {
    const d = new Date(day0);
    d.setDate(day0.getDate() + i);
    return toLocalDateStr(d);
  });
}

function generateDoctors(
  count: number,
  startDate: string,
  numDays: number,
  maxDaysOffPerDoctor: number
): DoctorInput[] {
  const periodDates = buildPeriodDates(startDate, numDays);
  const random = (seed: number) => {
    let x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
  };

  return Array.from({ length: count }, (_, index) => {
    const id = `DOC-${(index + 1).toString().padStart(4, "0")}`;
    let experiences: number;
    if (index % 10 === 0) {
      experiences = random(index * 7.1) * 2;
    } else if (index % 7 === 0) {
      experiences = 2 + random(index * 11.2) * 3;
    } else if (index % 5 === 0) {
      experiences = 5 + random(index * 13.3) * 5;
    } else {
      experiences = 10 + random(index * 17.4) * 20;
    }
    experiences = Math.round(experiences * 2) / 2;

    const hasDaysOff = random(index * 7.3) < 0.4;
    const requestedDaysOffCount = hasDaysOff
      ? Math.min(
          maxDaysOffPerDoctor,
          Math.max(1, Math.floor(random(index * 11.5) * maxDaysOffPerDoctor))
        )
      : 0;

    const daysOffSet = new Set<string>();
    if (requestedDaysOffCount > 0) {
      const step = Math.max(1, Math.floor(numDays / requestedDaysOffCount));
      for (let k = 0; k < requestedDaysOffCount; k++) {
        const dateIndex =
          (index * 13 + k * step + Math.floor(random(index * 17 + k) * step)) % numDays;
        daysOffSet.add(periodDates[dateIndex]);
      }
    }

    const wantsExtra = random(index * 19.2) < 0.3;
    const preferredSet = new Set<string>();
    if (wantsExtra) {
      const maxPreferred = Math.min(3, Math.floor(random(index * 23.7) * 3) + 1);
      for (let k = 0; preferredSet.size < maxPreferred && k < numDays * 2; k++) {
        const dateIndex = Math.floor(random(index * 29.1 + k * 31.3) * numDays);
        const candidate = periodDates[dateIndex];
        if (!daysOffSet.has(candidate)) {
          preferredSet.add(candidate);
        }
      }
    }

    const specializations = [
      "Nội tổng quát", "Ngoại tổng quát", "Nhi khoa", "Sản phụ khoa",
      "Cấp cứu", "Hồi sức tích cực", "Chấn thương chỉnh hình", "Tai mũi họng",
      "Mắt", "Răng hàm mặt", "Da liễu", "Tâm thần", "Lão khoa"
    ];
    const specialization = specializations[index % specializations.length];

    const deptMap: Record<string, string> = {
      "Nội tổng quát": "NỘI-01",
      "Ngoại tổng quát": "NGOẠI-01",
      "Nhi khoa": "NHI-01",
      "Sản phụ khoa": "SẢN-01",
      "Cấp cứu": "CẤP CỨU-01",
      "Hồi sức tích cực": "HSTC-01",
      "Chấn thương chỉnh hình": "CTCH-01",
      "Tai mũi họng": "TMH-01",
      "Mắt": "MẮT-01",
      "Răng hàm mặt": "RHM-01",
      "Da liễu": "DA-01",
      "Tâm thần": "TÂM THẦN-01",
      "Lão khoa": "LÃO-01"
    };

    return {
      id,
      name: `Bác sĩ ${["Nguyễn", "Trần", "Lê", "Phạm", "Hoàng", "Vũ", "Đặng", "Bùi", "Đỗ", "Hồ"][index % 10]} ${
        ["Văn", "Thị", "Hữu", "Minh", "Thanh", "Thu", "Hà", "Lan", "Hùng", "Cường"][index % 10]
      }`,
      experiences,
      department_id: deptMap[specialization] ?? `KHOA-${((index % 10) + 1).toString().padStart(2, "0")}`,
      specialization,
      days_off: Array.from(daysOffSet).sort(),
      preferred_extra_days: Array.from(preferredSet).sort(),
      has_valid_license: experiences >= 1 || random(index * 41.5) > 0.1,
      is_intern: experiences < 2
    };
  });
}

function sanitizeInt(
  input: string,
  min: number,
  max: number,
  fallback: number
): number {
  const parsed = Number.parseInt(input, 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, parsed));
}

function formatWeekdayLong(dateStr: string): string {
  const day = parseLocalDate(dateStr).getDay();
  if (day === 0) return "Chủ nhật";
  return `Thứ ${day + 1}`;
}

/** Định dạng thời gian chạy thuật toán: giờ:phút:giây */
function formatElapsedHhMmSs(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return [h, m, sec].map((n) => String(n).padStart(2, "0")).join(":");
}

const BADGE_TEXT_VI: Record<string, string> = {
  excellent: "Xuất sắc",
  good: "Tốt",
  acceptable: "Chấp nhận được",
  fair: "Trung bình",
  warning: "Cần lưu ý",
  poor: "Yếu",
  critical: "Nghiêm trọng"
};

function BadgeLabel({ badge }: { badge: string }) {
  const colorMap: Record<string, string> = {
    excellent: "bg-emerald-100 text-emerald-800",
    good: "bg-teal-100 text-teal-800",
    acceptable: "bg-blue-100 text-blue-800",
    fair: "bg-amber-100 text-amber-800",
    warning: "bg-amber-100 text-amber-800",
    poor: "bg-red-100 text-red-800",
    critical: "bg-red-100 text-red-800"
  };
  const normalizedBadge = badge.toLowerCase();
  const colorClass = colorMap[normalizedBadge] ?? "bg-slate-100 text-slate-600";
  const textVi = BADGE_TEXT_VI[normalizedBadge] ?? badge;
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${colorClass}`}>
      {textVi}
    </span>
  );
}

export default function Home() {
  const [startDate, setStartDate] = useState(() =>
    toLocalDateStr(firstDayOfNextMonth())
  );
  const [numDoctorsInput, setNumDoctorsInput] = useState("200");
  const [roomsPerShiftInput, setRoomsPerShiftInput] = useState("2");
  const [doctorsPerRoomInput, setDoctorsPerRoomInput] = useState("6");
  const [maxWeeklyHoursInput, setMaxWeeklyHoursInput] = useState("48");
  const [maxDaysOffInput, setMaxDaysOffInput] = useState("4");
  const [populationSizeInput, setPopulationSizeInput] = useState("250");
  const [generationsInput, setGenerationsInput] = useState("400");
  const [paretoLimitInput, setParetoLimitInput] = useState("6");

  const [doctors, setDoctors] = useState<DoctorInput[]>(() => {
    const s = toLocalDateStr(firstDayOfNextMonth());
    const n = numDaysThroughEndOfCalendarMonth(s);
    return generateDoctors(200, s, n, 4);
  });
  const [jobs, setJobs] = useState<RequestJob[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [lastSetupId, setLastSetupId] = useState<string | null>(null);
  const [scheduleData, setScheduleData] = useState<ScheduleJobScheduleResponseDTO | null>(null);
  const [metricsData, setMetricsData] = useState<ScheduleJobMetricsResponseDTO | null>(null);
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [weekIndex, setWeekIndex] = useState(0);
  const [selectedShiftDetail, setSelectedShiftDetail] = useState<ShiftDetailState | null>(null);

  const latestJob = jobs[0] ?? null;

  /** Luôn lập đủ phần còn lại của tháng dương lịch từ ngày bắt đầu. */
  const monthSpanDays = useMemo(
    () => numDaysThroughEndOfCalendarMonth(startDate),
    [startDate]
  );

  const totalProgress = useMemo(() => {
    const active = jobs.filter(
      (job) => job.status === "queued" || job.status === "running"
    );
    if (active.length === 0) {
      return latestJob?.status === "completed" ? 100 : 0;
    }
    const avg =
      active.reduce((sum, job) => sum + job.progress_percent, 0) /
      active.length;
    return Math.round(avg);
  }, [jobs, latestJob]);

  const effectiveOptionId =
    selectedOptionId ?? scheduleData?.selected_option_id ?? null;

  const selectedParetoSchedule = useMemo(() => {
    if (!scheduleData?.pareto_options.length) return null;
    const id = effectiveOptionId ?? scheduleData.selected_option_id;
    return (
      scheduleData.pareto_options.find((o) => o.option_id === id) ??
      scheduleData.pareto_options[0]
    );
  }, [scheduleData, effectiveOptionId]);

  const selectedParetoMetrics = useMemo(() => {
    if (!metricsData?.pareto_options.length) return null;
    const id = effectiveOptionId ?? scheduleData?.selected_option_id;
    return (
      metricsData.pareto_options.find((o) => o.option_id === id) ??
      metricsData.pareto_options[0]
    );
  }, [metricsData, effectiveOptionId, scheduleData?.selected_option_id]);

  const timetableData = useMemo(() => {
    if (!selectedParetoSchedule) {
      return {
        dates: [] as string[],
        rooms: [] as string[],
        rows: [] as Array<{ shift: string; room: string; cells: string[][] }>
      };
    }
    const dateSet = new Set<string>();
    const roomSet = new Set<string>();
    for (const assignment of selectedParetoSchedule.assignments) {
      dateSet.add(assignment.date);
      roomSet.add(assignment.room);
    }
    const dates = Array.from(dateSet).sort((a, b) => a.localeCompare(b));
    const rooms = Array.from(roomSet).sort();

    const assignmentMap = new Map<string, string[]>();
    for (const assignment of selectedParetoSchedule.assignments) {
      assignmentMap.set(
        `${assignment.date}-${assignment.shift}-${assignment.room}`,
        assignment.doctor_ids
      );
    }

    const rows = SHIFT_ORDER.flatMap((shift) =>
      rooms.map((room) => ({
        shift,
        room,
        cells: dates.map((date) => assignmentMap.get(`${date}-${shift}-${room}`) ?? [])
      }))
    );
    return { dates, rooms, rows };
  }, [selectedParetoSchedule]);

  const doctorLookup = useMemo(
    () => new Map(doctors.map((doctor) => [doctor.id, doctor])),
    [doctors]
  );

  const totalWeeks = useMemo(
    () =>
      timetableData.dates.length === 0
        ? 0
        : Math.ceil(timetableData.dates.length / 7),
    [timetableData.dates.length]
  );

  const weekDates = useMemo(() => {
    const start = weekIndex * 7;
    return timetableData.dates.slice(start, start + 7);
  }, [timetableData.dates, weekIndex]);

  const visibleWeekDates = useMemo(() => {
    const placeholders = Math.max(0, 7 - weekDates.length);
    return [...weekDates, ...Array.from({ length: placeholders }, () => "")];
  }, [weekDates]);

  const weekRows = useMemo(() => {
    if (visibleWeekDates.length === 0) {
      return [] as Array<{ shift: string; room: string; cells: string[][] }>;
    }
    const dateIndexMap = new Map(
      timetableData.dates.map((date, index) => [date, index])
    );
    return timetableData.rows.map((row) => ({
      shift: row.shift,
      room: row.room,
      cells: visibleWeekDates.map((date) => {
        if (!date) return [];
        const globalIndex = dateIndexMap.get(date);
        return globalIndex === undefined ? [] : (row.cells[globalIndex] ?? []);
      })
    }));
  }, [timetableData.dates, timetableData.rows, visibleWeekDates]);

  /**
   * Trung bình lý thuyết: tổng ô phân công trong kỳ / số bác sĩ (mức đều nếu chia đều).
   * Trung bình thực tế: trung bình số ca đã gán trên từng bác sĩ (đếm từ lịch).
   * Khi mọi ô đều đủ người và chỉ gán bác sĩ trong danh sách, hai giá trị khớp nhau.
   */
  const shiftAverageStats = useMemo(() => {
    if (!scheduleData?.selected || !selectedParetoSchedule) return null;
    const { num_days, shifts_per_day, rooms_per_shift, doctors_per_room } =
      scheduleData.selected;
    const n = doctors.length;
    if (n === 0) return null;

    const totalShiftSlots =
      num_days * shifts_per_day * rooms_per_shift * doctors_per_room;
    const theoreticalAvg = totalShiftSlots / n;

    const counts = new Map<string, number>();
    for (const d of doctors) {
      counts.set(d.id, 0);
    }
    for (const a of selectedParetoSchedule.assignments) {
      for (const id of a.doctor_ids) {
        if (counts.has(id)) {
          counts.set(id, (counts.get(id) ?? 0) + 1);
        }
      }
    }
    const perDoctor = doctors.map((d) => counts.get(d.id) ?? 0);
    const actualSum = perDoctor.reduce((s, v) => s + v, 0);
    const actualAvg = actualSum / n;
    const minCa = Math.min(...perDoctor);
    const maxCa = Math.max(...perDoctor);

    return {
      theoreticalAvg,
      actualAvg,
      totalShiftSlots,
      actualSum,
      n,
      minCa,
      maxCa
    };
  }, [scheduleData, selectedParetoSchedule, doctors]);

  const selectedShiftDoctors = useMemo(() => {
    if (!selectedShiftDetail) return [] as Array<DoctorInput & { role: string }>;
    return selectedShiftDetail.doctorIds.map((doctorId) => {
      const doctor = doctorLookup.get(doctorId);
      const experiences = doctor?.experiences ?? 0;
      return {
        id: doctor?.id ?? doctorId,
        name: doctor?.name ?? doctorId,
        experiences,
        department_id: doctor?.department_id ?? "—",
        specialization: doctor?.specialization ?? "—",
        days_off: doctor?.days_off ?? [],
        preferred_extra_days: doctor?.preferred_extra_days ?? [],
        role: experiences < 2 ? "Bác sĩ thực tập" : "Bác sĩ chính thức"
      };
    });
  }, [doctorLookup, selectedShiftDetail]);

  useEffect(() => {
    if (!scheduleData) return;
    if (!selectedOptionId) setSelectedOptionId(scheduleData.selected_option_id);
  }, [scheduleData, selectedOptionId]);

  useEffect(() => {
    if (weekIndex >= totalWeeks) setWeekIndex(0);
  }, [totalWeeks, weekIndex]);

  useEffect(() => {
    setSelectedShiftDetail(null);
  }, [selectedOptionId, weekIndex]);

  async function parseApiError(raw: string, fallback: string): Promise<string> {
    let message = raw || fallback;
    try {
      const parsed = JSON.parse(raw) as {
        detail?: string | string[] | Array<{ loc?: string[]; msg?: string }>;
      };
      if (typeof parsed.detail === "string") {
        message = parsed.detail;
      } else if (Array.isArray(parsed.detail) && parsed.detail[0] && typeof parsed.detail[0] === "object") {
        const first = parsed.detail[0] as { msg?: string };
        if (first.msg) message = first.msg;
      }
    } catch {
      /* giữ message */
    }
    return message;
  }

  async function fetchScheduleAndMetrics(requestId: string): Promise<void> {
    const [schRes, metRes] = await Promise.all([
      fetch(`${API_BASE_URL}/api/v1/schedules/jobs/${requestId}/schedule`),
      fetch(`${API_BASE_URL}/api/v1/schedules/jobs/${requestId}/metrics`)
    ]);
    if (!schRes.ok) {
      throw new Error(await parseApiError(await schRes.text(), "Không tải được lịch trực"));
    }
    if (!metRes.ok) {
      throw new Error(await parseApiError(await metRes.text(), "Không tải được chỉ số"));
    }
    const sch = (await schRes.json()) as ScheduleJobScheduleResponseDTO;
    const met = (await metRes.json()) as ScheduleJobMetricsResponseDTO;
    setScheduleData(sch);
    setMetricsData(met);
    setSelectedOptionId(sch.selected_option_id);
  }

  function updateJobProgress(progress: ScheduleJobStatusDTO): void {
    setJobs((prev) =>
      prev.map((job) =>
        job.request_id === progress.request_id
          ? {
              ...job,
              status: progress.status,
              progress_percent: progress.progress_percent,
              message: progress.message,
              error: progress.error ?? undefined
            }
          : job
      )
    );
    if (progress.status === "completed") {
      void fetchScheduleAndMetrics(progress.request_id).catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Lỗi tải kết quả");
      });
    }
    if (progress.status === "failed") {
      setError(progress.error ?? "Yêu cầu tối ưu thất bại");
    }
  }

  async function pollJobProgress(requestId: string): Promise<void> {
    const pollOnce = async () => {
      const response = await fetch(`${API_BASE_URL}/api/v1/schedules/progress/${requestId}`);
      if (!response.ok) throw new Error("Không thể đồng bộ tiến độ tác vụ");
      const progress = (await response.json()) as ScheduleJobStatusDTO;
      updateJobProgress(progress);
      if (progress.status === "queued" || progress.status === "running") {
        setTimeout(() => {
          pollOnce().catch((err: unknown) => {
            setError(err instanceof Error ? err.message : "Lỗi đồng bộ tiến độ");
          });
        }, 1000);
      }
    };
    await pollOnce();
  }

  async function handleRunSchedule(): Promise<void> {
    setError(null);
    setScheduleData(null);
    setMetricsData(null);
    setSelectedOptionId(null);
    try {
      const numDays = monthSpanDays;
      const numDoctors = sanitizeInt(numDoctorsInput, 12, 400, 200);
      const roomsPerShift = sanitizeInt(roomsPerShiftInput, 1, 10, 2);
      const doctorsPerRoom = sanitizeInt(doctorsPerRoomInput, 1, 15, 6);
      const maxWeeklyHours = sanitizeInt(maxWeeklyHoursInput, 24, 96, 48);
      const maxDaysOffPerDoctor = sanitizeInt(maxDaysOffInput, 0, 14, 4);
      const populationSize = sanitizeInt(populationSizeInput, 50, 500, 250);
      const generations = sanitizeInt(generationsInput, 50, 800, 400);
      const paretoLimit = sanitizeInt(paretoLimitInput, 2, 12, 6);

      const preparedDoctors = generateDoctors(
        numDoctors,
        startDate,
        numDays,
        maxDaysOffPerDoctor
      );
      for (const doc of preparedDoctors) {
        const offSet = new Set(doc.days_off);
        doc.preferred_extra_days = doc.preferred_extra_days.filter((d) => !offSet.has(d));
      }
      setDoctors(preparedDoctors);

      const payload = {
        start_date: startDate,
        num_days: numDays,
        max_weekly_hours_per_doctor: maxWeeklyHours,
        max_days_off_per_doctor: maxDaysOffPerDoctor,
        rooms_per_shift: roomsPerShift,
        doctors_per_room: doctorsPerRoom,
        shifts_per_day: 2,
        optimizer_population_size: populationSize,
        optimizer_generations: generations,
        pareto_options_limit: paretoLimit,
        doctors: preparedDoctors
      };

      const setupRes = await fetch(`${API_BASE_URL}/api/v1/schedules/setup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!setupRes.ok) {
        const t = await setupRes.text();
        throw new Error(await parseApiError(t, "Không lưu được thông số"));
      }
      const setupJson = (await setupRes.json()) as ScheduleSetupAcceptedDTO;
      setLastSetupId(setupJson.setup_id);

      const runRes = await fetch(`${API_BASE_URL}/api/v1/schedules/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ setup_id: setupJson.setup_id })
      });
      if (!runRes.ok) {
        const t = await runRes.text();
        throw new Error(await parseApiError(t, "Không khởi chạy được tác vụ tạo lịch"));
      }

      const accepted = (await runRes.json()) as ScheduleRequestAcceptedDTO;
      setJobs((prev) => [
        {
          request_id: accepted.request_id,
          status: accepted.status,
          progress_percent: accepted.progress_percent,
          message: accepted.message
        },
        ...prev
      ]);

      void pollJobProgress(accepted.request_id).catch((pollError: unknown) => {
        setError(pollError instanceof Error ? pollError.message : "Lỗi theo dõi tiến độ");
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi không xác định");
    }
  }

  const runMetrics = metricsData?.algorithm_run_metrics ?? null;
  const m = selectedParetoMetrics?.metrics;

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-8 md:px-8">
      <section className="glass stagger-in overflow-hidden p-6 md:p-8">
        <div className="mb-4 flex flex-col gap-2">
          <p className="text-accent text-sm font-semibold uppercase tracking-[0.16em]">
            Tối ưu NSGA-II · Lập lịch trực
          </p>
          <h1 className="text-2xl font-extrabold leading-tight md:text-4xl">
            Lịch trực ngoại trú theo tháng
          </h1>
          <p className="text-muted max-w-3xl text-sm md:text-base">
            <strong>Bước 1:</strong> lưu thông số lên máy chủ. <strong>Bước 2:</strong> chạy tối ưu sinh lịch.
            Ngày bắt đầu mặc định là <strong>ngày 1 tháng sau</strong>; kỳ lập lịch luôn là{" "}
            <strong>phần còn lại của tháng dương lịch</strong> từ ngày đó đến cuối tháng.
            Khi hoàn tất, ứng dụng tải <strong>lịch phân công</strong> và <strong>chỉ số công bằng</strong>.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <label className="flex flex-col gap-2 text-sm">
            Ngày bắt đầu lập lịch
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="border-border rounded-xl border bg-white px-3 py-2"
            />
          </label>
          <div className="flex flex-col gap-2 text-sm">
            <span>Độ dài kỳ lập lịch</span>
            <div className="border-border rounded-xl border bg-slate-50 px-3 py-2 text-slate-800">
              {monthSpanDays}
            </div>
          </div>
          <label className="flex flex-col gap-2 text-sm">
            Số bác sĩ
            <input
              type="number"
              min={12}
              max={400}
              value={numDoctorsInput}
              onChange={(e) => setNumDoctorsInput(e.target.value)}
              className="border-border rounded-xl border bg-white px-3 py-2"
            />
          </label>
          <label className="flex flex-col gap-2 text-sm">
            Số phòng / ca
            <input
              type="number"
              min={1}
              max={10}
              value={roomsPerShiftInput}
              onChange={(e) => setRoomsPerShiftInput(e.target.value)}
              className="border-border rounded-xl border bg-white px-3 py-2"
            />
          </label>
          <label className="flex flex-col gap-2 text-sm">
            Bác sĩ / phòng
            <input
              type="number"
              min={1}
              max={15}
              value={doctorsPerRoomInput}
              onChange={(e) => setDoctorsPerRoomInput(e.target.value)}
              className="border-border rounded-xl border bg-white px-3 py-2"
            />
          </label>
          <label className="flex flex-col gap-2 text-sm">
            Giờ làm tối đa / tuần
            <input
              type="number"
              min={24}
              max={96}
              value={maxWeeklyHoursInput}
              onChange={(e) => setMaxWeeklyHoursInput(e.target.value)}
              className="border-border rounded-xl border bg-white px-3 py-2"
            />
          </label>
          <label className="flex flex-col gap-2 text-sm">
            Số ngày nghỉ tối đa
            <input
              type="number"
              min={0}
              max={14}
              value={maxDaysOffInput}
              onChange={(e) => setMaxDaysOffInput(e.target.value)}
              className="border-border rounded-xl border bg-white px-3 py-2"
            />
          </label>
          <label className="flex flex-col gap-2 text-sm">
            Cỡ quần thể NSGA
            <input
              type="number"
              min={50}
              max={500}
              value={populationSizeInput}
              onChange={(e) => setPopulationSizeInput(e.target.value)}
              className="border-border rounded-xl border bg-white px-3 py-2"
            />
          </label>
          <label className="flex flex-col gap-2 text-sm">
            Số thế hệ
            <input
              type="number"
              min={50}
              max={800}
              value={generationsInput}
              onChange={(e) => setGenerationsInput(e.target.value)}
              className="border-border rounded-xl border bg-white px-3 py-2"
            />
          </label>
          <label className="flex flex-col gap-2 text-sm">
            Số phương án Pareto
            <input
              type="number"
              min={2}
              max={12}
              value={paretoLimitInput}
              onChange={(e) => setParetoLimitInput(e.target.value)}
              className="border-border rounded-xl border bg-white px-3 py-2"
            />
          </label>
        </div>

        <div className="mt-3 flex flex-col flex-wrap justify-end gap-2 text-sm md:flex-row md:items-center">
          <button
            type="button"
            onClick={() => {
              const parsedDoctors = sanitizeInt(numDoctorsInput, 12, 400, 200);
              const parsedMaxOff = sanitizeInt(maxDaysOffInput, 0, 14, 4);
              setDoctors(
                generateDoctors(parsedDoctors, startDate, monthSpanDays, parsedMaxOff)
              );
            }}
            className="border-accent text-accent rounded-xl border px-4 py-2 font-semibold transition hover:bg-teal-50"
          >
            Tạo lại dữ liệu bác sĩ
          </button>
          <button
            type="button"
            onClick={handleRunSchedule}
            className="bg-accent rounded-xl px-4 py-2 font-semibold text-white transition hover:bg-teal-800"
          >
            Lưu thông số và tạo lịch
          </button>
          {lastSetupId ? (
            <span className="text-muted text-xs">
              Mã cấu hình gần nhất:{" "}
              <span className="font-mono">{lastSetupId.slice(0, 8)}…</span>
            </span>
          ) : null}
        </div>
        <p className="text-muted mt-2 text-xs">
          Đang có <strong>{doctors.length}</strong> bác sĩ trong bộ dữ liệu gửi lên.
        </p>
      </section>

      <section className="glass stagger-in p-4 md:p-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold">Tiến độ xử lý</h2>
          <span className="text-muted text-xs tracking-wide">
            Hoàn thành: {totalProgress}%
          </span>
        </div>
        <div className="border-border mb-3 h-3 w-full overflow-hidden rounded-full border bg-white">
          <div
            className="bg-accent h-full transition-all duration-500"
            style={{ width: `${totalProgress}%` }}
          />
        </div>
        <div className="space-y-2">
          {jobs.length === 0 ? (
            <p className="text-muted text-sm">Chưa có tác vụ nào được gửi.</p>
          ) : (
            jobs.slice(0, 5).map((job) => (
              <article
                key={job.request_id}
                className="border-border rounded-xl border bg-white p-3"
              >
                <div className="mb-1 flex items-center justify-between gap-3">
                  <p className="font-mono text-xs">{job.request_id}</p>
                  <p className="text-sm font-semibold">{jobStatusLabel(job.status)}</p>
                </div>
                <div className="border-border mb-2 h-2 overflow-hidden rounded-full border bg-slate-100">
                  <div
                    className="bg-accent h-full transition-all duration-500"
                    style={{ width: `${job.progress_percent}%` }}
                  />
                </div>
                <p className="text-muted text-sm">{job.message}</p>
                {job.error ? (
                  <p className="mt-1 text-sm text-red-700">{job.error}</p>
                ) : null}
              </article>
            ))
          )}
        </div>
      </section>

      {runMetrics ? (
        <section className="glass stagger-in p-4 md:p-6">
          <h2 className="mb-3 text-lg font-bold">Thời gian chạy thuật toán</h2>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <article className="border-border rounded-xl border bg-white p-4">
              <p className="text-muted text-xs font-medium tracking-wide">Thời gian chạy</p>
              <p className="mt-1 font-mono text-2xl font-bold">
                {formatElapsedHhMmSs(runMetrics.elapsed_seconds)}
              </p>
              <p className="text-muted text-xs">Định dạng giờ : phút : giây</p>
            </article>
            <article className="border-border rounded-xl border bg-white p-4">
              <p className="text-muted text-xs font-medium tracking-wide">Số thế hệ</p>
              <p className="mt-1 text-2xl font-bold">{runMetrics.n_generations}</p>
            </article>
            <article className="border-border rounded-xl border bg-white p-4">
              <p className="text-muted text-xs font-medium tracking-wide">Cỡ quần thể</p>
              <p className="mt-1 text-2xl font-bold">{runMetrics.population_size}</p>
            </article>
            <article className="border-border rounded-xl border bg-white p-4">
              <p className="text-muted text-xs font-medium tracking-wide">Tiền tuyến Pareto (hạng 1)</p>
              <p className="mt-1 text-2xl font-bold">{runMetrics.pareto_front_size}</p>
              <p className="text-muted mt-1 text-[11px]">Số nghiệm không bị chi phối</p>
            </article>
          </div>
        </section>
      ) : null}

      {scheduleData && metricsData ? (
        <section className="glass stagger-in p-4 md:p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold">Các phương án Pareto — lịch trực</h2>
            <p className="text-muted text-xs">
              {scheduleData.pareto_options.length} phương án · Chọn một phương án để xem lịch và chỉ số
            </p>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {scheduleData.pareto_options.map((opt) => {
              const met = metricsData.pareto_options.find((x) => x.option_id === opt.option_id);
              const mm = met?.metrics;
              const active = opt.option_id === (effectiveOptionId ?? scheduleData.selected_option_id);
              const b = mm?.score_badges ?? {};
              return (
                <button
                  key={opt.option_id}
                  type="button"
                  onClick={() => setSelectedOptionId(opt.option_id)}
                  className={`rounded-xl border p-4 text-left transition ${
                    active ? "border-accent bg-teal-50" : "border-border bg-white hover:border-accent"
                  }`}
                >
                  <div className="mb-2 flex items-center justify-between">
                    <p className="font-semibold">{opt.option_id}</p>
                    {b.overall ? <BadgeLabel badge={b.overall} /> : null}
                  </div>
                  {mm ? (
                    <div className="space-y-2 text-sm">
                      <p className="text-muted text-xs font-semibold tracking-wide">
                        Giá trị hàm mục tiêu (độ phù hợp)
                      </p>
                      <div className="flex justify-between gap-2">
                        <span className="text-muted">f₁ — phạt ràng buộc mềm</span>
                        <span className="font-mono">{mm.soft_violation_score.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between gap-2">
                        <span className="text-muted">f₂ — mức mất công bằng tổng thể</span>
                        <span className="font-mono">{mm.f4_fairness.toFixed(4)}</span>
                      </div>
                      <hr className="border-border" />
                      <div className="flex justify-between text-xs">
                        <span className="text-muted">Hệ số Gini (phân bổ ca)</span>
                        <span className="font-mono">{(mm.gini_workload ?? 0).toFixed(4)}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-muted">Chỉ số công bằng Jain (JFI)</span>
                        <span className="font-semibold text-emerald-700">
                          {(mm.jfi_overall ?? 0).toFixed(4)}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-muted text-xs">Chưa có chỉ số cho phương án này.</p>
                  )}
                </button>
              );
            })}
          </div>
        </section>
      ) : null}

      {m ? (
        <section className="glass stagger-in p-4 md:p-6">
          <h2 className="mb-1 text-lg font-bold">Chỉ số công bằng (phương án đang chọn)</h2>
          <p className="text-muted mb-3 text-sm">
            Đánh giá công bằng theo phân bổ ca <strong>tổng thể</strong> trong kỳ (Gini + JFI trên cùng vector;
            không còn ràng buộc hay trọng số riêng cho ngày lễ).
          </p>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <article className="border-border rounded-xl border bg-white p-3 md:col-span-2">
              <p className="text-muted text-xs font-semibold tracking-wide">
                JFI tổng thể (theo phân bổ ca)
              </p>
              <p className="mt-1 font-mono text-2xl font-bold text-emerald-700">
                {(m.jfi_overall ?? 0).toFixed(4)}
              </p>
            </article>
            <article className="border-border rounded-xl border bg-white p-3 md:col-span-2">
              <p className="text-muted text-xs font-semibold tracking-wide">
                Hệ số Gini (phân bổ ca tổng thể)
              </p>
              <p className="mt-1 font-mono text-2xl font-bold text-slate-800">
                {(m.gini_workload ?? 0).toFixed(4)}
              </p>
            </article>
            <article className="border-border rounded-xl border bg-white p-3">
              <p className="text-muted text-xs">JFI theo tuần (tham khảo)</p>
              <p className="mt-1 font-mono text-lg font-semibold">
                {(m.weekly_fairness_jain ?? 0).toFixed(4)}
              </p>
            </article>
            <article className="border-border rounded-xl border bg-white p-3">
              <p className="text-muted text-xs">JFI theo tháng (tham khảo)</p>
              <p className="mt-1 font-mono text-lg font-semibold">
                {(m.monthly_fairness_jain ?? 0).toFixed(4)}
              </p>
            </article>
            <article className="border-border rounded-xl border bg-white p-3">
              <p className="text-muted text-xs">Độ lệch công bằng ngày nghỉ (std)</p>
              <p className="mt-1 font-mono text-lg font-semibold">
                {(m.day_off_fairness_std ?? 0).toFixed(4)}
              </p>
            </article>
            <article className="border-border rounded-xl border bg-white p-3">
              <p className="text-muted text-xs">Jain theo ngày nghỉ</p>
              <p className="mt-1 font-mono text-lg font-semibold">
                {(m.day_off_fairness_jain ?? 0).toFixed(4)}
              </p>
            </article>
          </div>
        </section>
      ) : null}

      {shiftAverageStats ? (
        <section className="glass stagger-in p-4 md:p-6">
          <h2 className="mb-1 text-lg font-bold">Trung bình số ca trực trong kỳ</h2>
          <p className="text-muted mb-4 text-sm">
            <strong>Lý thuyết:</strong> tổng số ô cần phân công (ngày × ca × phòng × bác sĩ/phòng) chia
            cho số bác sĩ. <strong>Thực tế:</strong> trung bình số ca đã xếp cho mỗi bác sĩ theo phương án
            đang chọn.
          </p>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <article className="border-border rounded-xl border bg-white p-5">
              <p className="text-muted text-sm font-medium">Trung bình lý thuyết (ca / bác sĩ)</p>
              <p className="text-accent mt-2 font-mono text-3xl font-bold tabular-nums">
                {shiftAverageStats.theoreticalAvg.toLocaleString("vi-VN", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2
                })}
              </p>
              <p className="text-muted mt-2 text-xs">
                Tổng ô phân công:{" "}
                <span className="font-mono font-semibold text-slate-700">
                  {shiftAverageStats.totalShiftSlots}
                </span>{" "}
                ca · {shiftAverageStats.n} bác sĩ
              </p>
            </article>
            <article className="border-border rounded-xl border bg-white p-5">
              <p className="text-muted text-sm font-medium">Trung bình thực tế (ca / bác sĩ)</p>
              <p className="mt-2 font-mono text-3xl font-bold tabular-nums text-cyan-800">
                {shiftAverageStats.actualAvg.toLocaleString("vi-VN", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2
                })}
              </p>
              <p className="text-muted mt-2 text-xs">
                Tổng ca đã gán (trong danh sách):{" "}
                <span className="font-mono font-semibold text-slate-700">
                  {shiftAverageStats.actualSum}
                </span>
                {shiftAverageStats.actualSum !== shiftAverageStats.totalShiftSlots ? (
                  <span className="ml-1 text-amber-700">
                    (khác tổng ô — có thể do ca trống hoặc mã bác sĩ ngoài danh sách)
                  </span>
                ) : null}
              </p>
            </article>
          </div>
          <div className="border-border mt-4 rounded-xl border bg-slate-50 p-4 text-sm text-slate-700">
            <span className="font-medium">Phân tán thực tế:</span> ít nhất{" "}
            <span className="font-mono font-semibold">{shiftAverageStats.minCa}</span> ca, nhiều nhất{" "}
            <span className="font-mono font-semibold">{shiftAverageStats.maxCa}</span> ca / bác sĩ
            (phương án đang xem).
          </div>
        </section>
      ) : null}

      {selectedParetoSchedule ? (
        <section className="glass stagger-in overflow-hidden p-4 md:p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold">Thời khóa biểu ca trực theo tuần</h2>
            <div className="flex items-center gap-2">
              <p className="text-muted text-xs">
                Tuần {totalWeeks === 0 ? 0 : weekIndex + 1}/{totalWeeks}
              </p>
              <button
                type="button"
                onClick={() => setWeekIndex((prev) => Math.max(prev - 1, 0))}
                disabled={weekIndex === 0}
                className="border-border rounded-md border bg-white px-2 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-40"
              >
                Trước
              </button>
              <button
                type="button"
                onClick={() =>
                  setWeekIndex((prev) => Math.min(prev + 1, Math.max(totalWeeks - 1, 0)))
                }
                disabled={weekIndex >= totalWeeks - 1 || totalWeeks === 0}
                className="border-border rounded-md border bg-white px-2 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-40"
              >
                Sau
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-[720px] w-full border-collapse text-sm">
              <thead>
                <tr className="bg-slate-100 text-left">
                  <th className="border-border w-28 border px-3 py-2">Ca trực</th>
                  {visibleWeekDates.map((date, index) => (
                    <th
                      key={date || `placeholder-${index}`}
                      className="border-border w-32 border px-3 py-2 text-center"
                    >
                      {date ? formatWeekdayLong(date) : ""}
                      <div className="text-muted font-mono text-xs">{date}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {weekRows.map((row) => (
                  <tr key={`${row.shift}-${row.room}`} className="border-border border-b align-top">
                    <td className="border-border bg-amber-50 px-3 py-3 font-semibold">
                      {SHIFT_LABELS[row.shift]}
                      <div className="text-muted mt-0.5 text-xs font-normal">{row.room}</div>
                    </td>
                    {row.cells.map((doctorIds, idx) => (
                      <td
                        key={`${row.shift}-${row.room}-${visibleWeekDates[idx] || idx}`}
                        className="border-border min-h-[120px] border px-2 py-2 align-top"
                      >
                        {visibleWeekDates[idx] ? (
                          <button
                            type="button"
                            onClick={() =>
                              setSelectedShiftDetail({
                                date: visibleWeekDates[idx],
                                shift: row.shift,
                                room: row.room,
                                doctorIds
                              })
                            }
                            className="border-border h-full min-h-[100px] w-full rounded-md border bg-white p-2 text-left transition hover:border-cyan-500 hover:bg-cyan-50"
                          >
                            <p className="text-xs font-semibold text-slate-700">
                              {SHIFT_LABELS[row.shift]} {row.room} · {doctorIds.length} bác sĩ
                            </p>
                            <p className="mt-2 line-clamp-2 text-xs text-slate-500">
                              {doctorIds
                                .slice(0, 3)
                                .map((id) => doctorLookup.get(id)?.name ?? id)
                                .join(", ") || "—"}
                            </p>
                            <p className="mt-2 text-[11px] font-semibold text-cyan-700">
                              Xem chi tiết
                            </p>
                          </button>
                        ) : null}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {selectedShiftDetail ? (
            <article className="border-border mt-4 rounded-xl border bg-white p-4">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">
                    Ca trực {SHIFT_LABELS[selectedShiftDetail.shift]} — {selectedShiftDetail.room}{" "}
                    — {formatWeekdayLong(selectedShiftDetail.date)} ({selectedShiftDetail.date})
                  </p>
                  <p className="text-muted text-xs">
                    {selectedShiftDoctors.length} bác sĩ tham gia
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedShiftDetail(null)}
                  className="border-border rounded-md border bg-white px-2 py-1 text-xs"
                >
                  Đóng
                </button>
              </div>
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                {selectedShiftDoctors.map((doctor) => (
                  <article
                    key={`${selectedShiftDetail.date}-${selectedShiftDetail.shift}-${selectedShiftDetail.room}-${doctor.id}`}
                    className="border-border rounded-md border p-3 text-xs"
                  >
                    <div className="mb-1 flex items-center justify-between gap-3">
                      <p className="font-semibold text-sm">{doctor.name}</p>
                      <p
                        className={`rounded-full px-2 py-0.5 font-semibold ${
                          doctor.experiences < 2
                            ? "bg-amber-100 text-amber-800"
                            : "bg-emerald-100 text-emerald-800"
                        }`}
                      >
                        {doctor.role}
                      </p>
                    </div>
                    <p className="font-mono text-slate-600">{doctor.id}</p>
                    <p className="text-slate-600">Kinh nghiệm: {doctor.experiences} năm</p>
                    <p className="text-slate-600">Khoa: {doctor.department_id}</p>
                    <p className="text-slate-600">Chuyên khoa: {doctor.specialization}</p>
                  </article>
                ))}
              </div>
            </article>
          ) : null}
        </section>
      ) : null}

      {error ? (
        <section className="glass border-accent-2 border-l-4 p-4 text-sm text-amber-900">
          {error}
        </section>
      ) : null}
    </main>
  );
}
