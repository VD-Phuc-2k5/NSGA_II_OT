"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  ChartOptions,
  Legend,
  LinearScale,
  Title,
  Tooltip
} from "chart.js";
import { Bar } from "react-chartjs-2";

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

type DoctorInput = {
  id: string;
  name: string;
  experiences: number;
  department_id: string;
  specialization: string;
  days_off: string[];
  preferred_extra_days: string[];
};

type ShiftAssignment = {
  date: string;
  shift: string;
  doctor_ids: string[];
};

type ScheduleQualityMetricsDTO = {
  hard_violation_score: number;
  soft_violation_score: number;
  fairness_std: number;
  shift_fairness_std: number;
  day_off_fairness_std: number;
  day_off_fairness_jain: number;
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

type ParetoScheduleOptionDTO = {
  option_id: string;
  metrics: ScheduleQualityMetricsDTO;
  assignments: ShiftAssignment[];
  doctor_workload_balances: DoctorWorkloadBalanceDTO[];
};

type ScheduleGenerationResultDTO = {
  start_date: string;
  num_days: number;
  required_doctors_per_shift: number;
  shifts_per_day: number;
  metrics: ScheduleQualityMetricsDTO;
  assignments: ShiftAssignment[];
};

type ScheduleGenerationEnvelopeDTO = {
  selected_option_id: string;
  selected_schedule: ScheduleGenerationResultDTO;
  pareto_options: ParetoScheduleOptionDTO[];
};

type ScheduleRequestAcceptedDTO = {
  request_id: string;
  status: "queued" | "running" | "completed" | "failed";
  progress_percent: number;
  message: string;
};

type ScheduleRequestProgressDTO = {
  request_id: string;
  status: "queued" | "running" | "completed" | "failed";
  progress_percent: number;
  message: string;
  result: ScheduleGenerationEnvelopeDTO | null;
  error: string | null;
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
  doctorIds: string[];
};

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.trim() || "http://localhost:8000";
const SHIFT_ORDER = ["morning", "afternoon"];
const SHIFT_LABELS: Record<string, string> = {
  morning: "Sang",
  afternoon: "Chieu"
};

function generateDoctors(
  count: number,
  startDate: string,
  numDays: number,
  maxDaysOffPerDoctor: number
): DoctorInput[] {
  const day0 = new Date(startDate);
  return Array.from({ length: count }, (_, index) => {
    const id = `DOC-${(index + 1).toString().padStart(4, "0")}`;
    const experiences = (index % 12) + (index % 5 === 0 ? 0.5 : 1.5);

    const requestedDaysOffCount = Math.min(
      numDays,
      // Keep `days_off` within backend constraint:
      // `len(unique(doctor.days_off)) <= max_days_off_per_doctor`
      //
      // The old formula could exceed `maxDaysOffPerDoctor`, causing FastAPI 422.
      Math.max(
        0,
        Math.min(
          maxDaysOffPerDoctor,
          maxDaysOffPerDoctor + Math.min(0, (index % 5) - 1)
        )
      )
    );
    const daysOffSet = new Set<string>();
    for (let offset = 0; offset < requestedDaysOffCount; offset += 1) {
      const offDate = new Date(day0);
      offDate.setDate(day0.getDate() + ((index * 3 + offset * 2) % numDays));
      daysOffSet.add(offDate.toISOString().slice(0, 10));
    }

    const preferredSet = new Set<string>();
    for (let offset = 0; offset < 2; offset += 1) {
      const prefDate = new Date(day0);
      prefDate.setDate(day0.getDate() + ((index + offset * 4 + 1) % numDays));
      preferredSet.add(prefDate.toISOString().slice(0, 10));
    }

    return {
      id,
      name: `Bac si ${index + 1}`,
      experiences,
      department_id: `DEP-${((index % 6) + 1).toString().padStart(2, "0")}`,
      specialization: ["Noi", "Ngoai", "Nhi", "Cap cuu", "Gay me", "Chan doan"][
        index % 6
      ],
      days_off: Array.from(daysOffSet).sort((a, b) => a.localeCompare(b)),
      preferred_extra_days: Array.from(preferredSet).sort((a, b) =>
        a.localeCompare(b)
      )
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

function formatWeekday(dateStr: string): string {
  const day = new Date(dateStr).getDay();
  if (day === 0) {
    return "CN";
  }
  return `T${day + 1}`;
}

function formatWeekdayLong(dateStr: string): string {
  const day = new Date(dateStr).getDay();
  if (day === 0) {
    return "Chu nhat";
  }
  return `Thu ${day + 1}`;
}

function parseHolidayInput(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

export default function Home() {
  const today = new Date().toISOString().slice(0, 10);
  const currentYear = new Date().getFullYear();

  const [startDate, setStartDate] = useState(today);
  const [numDoctorsInput, setNumDoctorsInput] = useState("200");
  const [numDaysInput, setNumDaysInput] = useState("30");
  const [requiredDoctorsInput, setRequiredDoctorsInput] = useState("12");
  const [maxWeeklyHoursInput, setMaxWeeklyHoursInput] = useState("48");
  const [maxDaysOffInput, setMaxDaysOffInput] = useState("4");
  const [populationSizeInput, setPopulationSizeInput] = useState("120");
  const [generationsInput, setGenerationsInput] = useState("150");
  const [paretoLimitInput, setParetoLimitInput] = useState("6");
  const [holidayInput, setHolidayInput] = useState(
    `${currentYear}-04-30, ${currentYear}-05-01, ${currentYear}-09-02, ${currentYear}-01-01`
  );

  const [doctors, setDoctors] = useState<DoctorInput[]>(() =>
    generateDoctors(200, today, 30, 4)
  );
  const [jobs, setJobs] = useState<RequestJob[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [resultEnvelope, setResultEnvelope] =
    useState<ScheduleGenerationEnvelopeDTO | null>(null);
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [weekIndex, setWeekIndex] = useState(0);
  const [selectedShiftDetail, setSelectedShiftDetail] =
    useState<ShiftDetailState | null>(null);

  const latestJob = jobs[0] ?? null;
  const doctorPreview = useMemo(() => doctors, [doctors]);

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

  const selectedOption = useMemo(() => {
    if (!resultEnvelope) {
      return null;
    }
    const optionId = selectedOptionId ?? resultEnvelope.selected_option_id;
    return (
      resultEnvelope.pareto_options.find(
        (item) => item.option_id === optionId
      ) ??
      resultEnvelope.pareto_options[0] ??
      null
    );
  }, [resultEnvelope, selectedOptionId]);

  const timetableData = useMemo(() => {
    if (!selectedOption) {
      return {
        dates: [] as string[],
        rows: [] as Array<{ shift: string; cells: string[][] }>
      };
    }

    const dateSet = new Set<string>();
    for (const assignment of selectedOption.assignments) {
      dateSet.add(assignment.date);
    }

    const dates = Array.from(dateSet).sort((a, b) => a.localeCompare(b));
    const assignmentMap = new Map<string, string[]>();
    for (const assignment of selectedOption.assignments) {
      assignmentMap.set(
        `${assignment.date}-${assignment.shift}`,
        assignment.doctor_ids
      );
    }

    const rows = SHIFT_ORDER.map((shift) => ({
      shift,
      cells: dates.map((date) => assignmentMap.get(`${date}-${shift}`) ?? [])
    }));

    return { dates, rows };
  }, [selectedOption]);

  const doctorLookup = useMemo(() => {
    return new Map(doctors.map((doctor) => [doctor.id, doctor]));
  }, [doctors]);

  const totalWeeks = useMemo(() => {
    if (timetableData.dates.length === 0) {
      return 0;
    }
    return Math.ceil(timetableData.dates.length / 7);
  }, [timetableData.dates.length]);

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
      return [] as Array<{ shift: string; cells: string[][] }>;
    }

    const dateIndexMap = new Map(
      timetableData.dates.map((date, index) => [date, index])
    );

    return timetableData.rows.map((row) => ({
      shift: row.shift,
      cells: visibleWeekDates.map((date) => {
        if (!date) {
          return [];
        }
        const globalIndex = dateIndexMap.get(date);
        return globalIndex === undefined ? [] : (row.cells[globalIndex] ?? []);
      })
    }));
  }, [timetableData.dates, timetableData.rows, visibleWeekDates]);

  const balanceTop = useMemo(() => {
    if (!selectedOption) {
      return [] as DoctorWorkloadBalanceDTO[];
    }

    const holidaySet = new Set(parseHolidayInput(holidayInput));
    const weekDateSet = new Set(weekDates);
    const periodDateSet = new Set(timetableData.dates);
    const activeDate = (
      weekDates[0] ??
      timetableData.dates[0] ??
      startDate
    );
    const activeYear = activeDate.slice(0, 4);
    const activeMonth = activeDate.slice(0, 7);

    const counters = new Map<
      string,
      {
        doctor_name: string;
        weekly_shift_count: number;
        monthly_shift_count: number;
        yearly_estimated_shift_count: number;
        holiday_shift_count: number;
        day_off_count: number;
      }
    >();

    for (const doctor of doctors) {
      counters.set(doctor.id, {
        doctor_name: doctor.name,
        weekly_shift_count: 0,
        monthly_shift_count: 0,
        yearly_estimated_shift_count: 0,
        holiday_shift_count: 0,
        day_off_count: doctor.days_off.filter((date) =>
          date.startsWith(`${activeMonth}-`)
        ).length
      });
    }

    for (const assignment of selectedOption.assignments) {
      const inVisibleWeek = weekDateSet.has(assignment.date);
      const inCurrentPeriod = periodDateSet.has(assignment.date);
      const inActiveYear = assignment.date.startsWith(`${activeYear}-`);
      const isHoliday = holidaySet.has(assignment.date);

      for (const doctorId of assignment.doctor_ids) {
        const counter = counters.get(doctorId);
        if (!counter) {
          counters.set(doctorId, {
            doctor_name: doctorId,
            weekly_shift_count: inVisibleWeek ? 1 : 0,
            monthly_shift_count: inCurrentPeriod ? 1 : 0,
            yearly_estimated_shift_count: inActiveYear ? 1 : 0,
            holiday_shift_count: isHoliday ? 1 : 0,
            day_off_count: 0
          });
          continue;
        }

        if (inVisibleWeek) {
          counter.weekly_shift_count += 1;
        }
        if (inCurrentPeriod) {
          counter.monthly_shift_count += 1;
        }
        if (inActiveYear) {
          counter.yearly_estimated_shift_count += 1;
        }
        if (isHoliday) {
          counter.holiday_shift_count += 1;
        }
      }
    }

    return Array.from(counters.entries())
      .map(([doctor_id, item]) => ({
        doctor_id,
        doctor_name: item.doctor_name,
        weekly_shift_count: item.weekly_shift_count,
        monthly_shift_count: item.monthly_shift_count,
        yearly_estimated_shift_count: item.yearly_estimated_shift_count,
        holiday_shift_count: item.holiday_shift_count,
        day_off_count: item.day_off_count
      }))
      .sort((a, b) => b.monthly_shift_count - a.monthly_shift_count);
  }, [
    doctors,
    holidayInput,
    selectedOption,
    startDate,
    timetableData.dates,
    weekDates
  ]);

  const doctorLabels = useMemo(
    () => balanceTop.map((item) => `${item.doctor_name} (${item.doctor_id})`),
    [balanceTop]
  );

  const chartHeight = useMemo(
    () => Math.max(360, balanceTop.length * 28),
    [balanceTop.length]
  );

  const baseChartOptions = useMemo<ChartOptions<"bar">>(
    () => ({
      indexAxis: "y" as const,
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      plugins: {
        legend: { display: false },
        tooltip: { enabled: true },
        title: { display: false }
      },
      scales: {
        x: {
          beginAtZero: true,
          ticks: { precision: 0 }
        },
        y: {
          ticks: {
            autoSkip: false,
            font: { size: 10 }
          }
        }
      }
    }),
    []
  );

  const weeklyChartData = useMemo(
    () => ({
      labels: doctorLabels,
      datasets: [
        {
          label: "So ca theo tuan",
          data: balanceTop.map((item) => item.weekly_shift_count),
          backgroundColor: "rgba(15, 118, 110, 0.85)",
          borderColor: "rgba(15, 118, 110, 1)",
          borderWidth: 1
        }
      ]
    }),
    [balanceTop, doctorLabels]
  );

  const monthlyChartData = useMemo(
    () => ({
      labels: doctorLabels,
      datasets: [
        {
          label: "So ca theo thang",
          data: balanceTop.map((item) => item.monthly_shift_count),
          backgroundColor: "rgba(6, 182, 212, 0.85)",
          borderColor: "rgba(6, 182, 212, 1)",
          borderWidth: 1
        }
      ]
    }),
    [balanceTop, doctorLabels]
  );

  const yearlyChartData = useMemo(
    () => ({
      labels: doctorLabels,
      datasets: [
        {
          label: "So ca theo nam",
          data: balanceTop.map((item) => item.yearly_estimated_shift_count),
          backgroundColor: "rgba(59, 130, 246, 0.85)",
          borderColor: "rgba(59, 130, 246, 1)",
          borderWidth: 1
        }
      ]
    }),
    [balanceTop, doctorLabels]
  );

  const monthlyDayOffChartData = useMemo(
    () => ({
      labels: doctorLabels,
      datasets: [
        {
          label: "So ngay nghi theo thang",
          data: balanceTop.map((item) => item.day_off_count),
          backgroundColor: "rgba(244, 63, 94, 0.85)",
          borderColor: "rgba(244, 63, 94, 1)",
          borderWidth: 1
        }
      ]
    }),
    [balanceTop, doctorLabels]
  );

  const balanceMath = useMemo(() => {
    if (balanceTop.length === 0) {
      return null;
    }

    const buildStats = (values: number[]) => {
      const n = values.length;
      const sum = values.reduce((acc, value) => acc + value, 0);
      const mean = sum / n;
      const variance =
        values.reduce((acc, value) => acc + (value - mean) ** 2, 0) / n;
      const std = Math.sqrt(variance);
      const cv = mean > 0 ? std / mean : 0;
      const sumSquares = values.reduce((acc, value) => acc + value ** 2, 0);
      const jain = sumSquares > 0 ? sum ** 2 / (n * sumSquares) : 0;
      return { mean, std, cv, jain };
    };

    return {
      week: buildStats(balanceTop.map((item) => item.weekly_shift_count)),
      month: buildStats(balanceTop.map((item) => item.monthly_shift_count)),
      year: buildStats(
        balanceTop.map((item) => item.yearly_estimated_shift_count)
      )
    };
  }, [balanceTop]);

  const selectedShiftDoctors = useMemo(() => {
    if (!selectedShiftDetail) {
      return [] as Array<DoctorInput & { role: string }>;
    }

    return selectedShiftDetail.doctorIds.map((doctorId) => {
      const doctor = doctorLookup.get(doctorId);
      const experiences = doctor?.experiences ?? 0;
      return {
        id: doctor?.id ?? doctorId,
        name: doctor?.name ?? doctorId,
        experiences,
        department_id: doctor?.department_id ?? "N/A",
        specialization: doctor?.specialization ?? "N/A",
        days_off: doctor?.days_off ?? [],
        preferred_extra_days: doctor?.preferred_extra_days ?? [],
        role: experiences < 2 ? "Bac si thuc tap" : "Bac si chinh thuc"
      };
    });
  }, [doctorLookup, selectedShiftDetail]);

  useEffect(() => {
    if (!resultEnvelope) {
      return;
    }
    if (!selectedOptionId) {
      setSelectedOptionId(resultEnvelope.selected_option_id);
    }
  }, [resultEnvelope, selectedOptionId]);

  useEffect(() => {
    if (weekIndex >= totalWeeks) {
      setWeekIndex(0);
    }
  }, [totalWeeks, weekIndex]);

  useEffect(() => {
    setSelectedShiftDetail(null);
  }, [selectedOptionId, weekIndex]);

  function updateJobProgress(progress: ScheduleRequestProgressDTO): void {
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

    if (progress.status === "completed" && progress.result) {
      setResultEnvelope(progress.result);
      setSelectedOptionId(progress.result.selected_option_id);
    }

    if (progress.status === "failed") {
      setError(progress.error ?? "Yeu cau toi uu that bai");
    }
  }

  async function pollJobProgress(requestId: string): Promise<void> {
    const pollOnce = async () => {
      const response = await fetch(
        `${API_BASE_URL}/api/v1/schedules/progress/${requestId}`
      );
      if (!response.ok) {
        throw new Error("Khong the dong bo tien do job");
      }

      const progress = (await response.json()) as ScheduleRequestProgressDTO;
      updateJobProgress(progress);

      if (progress.status === "queued" || progress.status === "running") {
        setTimeout(() => {
          pollOnce().catch((err: unknown) => {
            const message =
              err instanceof Error ? err.message : "Loi dong bo tien do";
            setError(message);
          });
        }, 1000);
      }
    };

    await pollOnce();
  }

  async function handleGenerateSchedule(): Promise<void> {
    setError(null);

    try {
      const numDays = sanitizeInt(numDaysInput, 7, 31, 7);
      const numDoctors = sanitizeInt(numDoctorsInput, 12, 400, 200);
      const requiredDoctors = sanitizeInt(requiredDoctorsInput, 6, 30, 12);
      const maxWeeklyHours = sanitizeInt(maxWeeklyHoursInput, 24, 96, 48);
      const maxDaysOffPerDoctor = sanitizeInt(maxDaysOffInput, 0, 14, 4);
      const populationSize = sanitizeInt(populationSizeInput, 50, 400, 120);
      const generations = sanitizeInt(generationsInput, 50, 500, 150);
      const paretoLimit = sanitizeInt(paretoLimitInput, 2, 12, 6);

      const preparedDoctors = generateDoctors(
        numDoctors,
        startDate,
        numDays,
        maxDaysOffPerDoctor
      );
      setDoctors(preparedDoctors);

      const payload = {
        start_date: startDate,
        num_days: numDays,
        max_weekly_hours_per_doctor: maxWeeklyHours,
        max_days_off_per_doctor: maxDaysOffPerDoctor,
        required_doctors_per_shift: requiredDoctors,
        shifts_per_day: 2,
        holiday_dates: parseHolidayInput(holidayInput),
        optimizer_population_size: populationSize,
        optimizer_generations: generations,
        pareto_options_limit: paretoLimit,
        doctors: preparedDoctors
      };

      const response = await fetch(
        `${API_BASE_URL}/api/v1/schedules/generate`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(payload)
        }
      );

      if (!response.ok) {
        const raw = await response.text();
        let message = raw || "Khong the tao lich";

        try {
          const parsed = JSON.parse(raw) as {
            detail?: Array<{ loc?: string[]; msg?: string; input?: unknown }>;
          };
          const shiftError = parsed.detail?.find((item) =>
            item.loc?.includes("shifts_per_day")
          );
          if (shiftError) {
            message =
              "Tham so shifts_per_day khong hop le. He thong hien chi ho tro 2 ca: sang, chieu.";
          }
        } catch {
          // Giu nguyen message text goc neu khong phai JSON.
        }

        throw new Error(message);
      }

      const accepted = (await response.json()) as ScheduleRequestAcceptedDTO;
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
        const message =
          pollError instanceof Error ? pollError.message : "Loi poll tien do";
        setError(message);
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Loi khong xac dinh";
      setError(message);
    }
  }

  return (
    <main className='mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-8 md:px-8'>
      <section className='glass stagger-in overflow-hidden p-6 md:p-8'>
        <div className='mb-4 flex flex-col gap-2'>
          <p className='text-accent text-sm font-semibold uppercase tracking-[0.16em]'>
            NSGA-II Improved Scheduling
          </p>
          <h1 className='text-2xl font-extrabold leading-tight md:text-4xl'>
            Lich truc theo thang voi 2 ca (sang, chieu)
          </h1>
          <p className='text-muted max-w-3xl text-sm md:text-base'>
            Cho phep cau hinh tham so toi uu, hien thi nhieu phuong an Pareto,
            va thong ke can bang theo tuan, nam, dip nghi le.
          </p>
        </div>

        <div className='grid grid-cols-1 gap-3 md:grid-cols-4'>
          <label className='flex flex-col gap-2 text-sm'>
            Ngay bat dau
            <input
              type='date'
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className='border-border rounded-xl border bg-white px-3 py-2'
            />
          </label>
          <label className='flex flex-col gap-2 text-sm'>
            So ngay lap lich
            <input
              type='number'
              min={7}
              max={31}
              value={numDaysInput}
              onChange={(e) => setNumDaysInput(e.target.value)}
              className='border-border rounded-xl border bg-white px-3 py-2'
            />
          </label>
          <label className='flex flex-col gap-2 text-sm'>
            So bac si
            <input
              type='number'
              min={12}
              max={400}
              value={numDoctorsInput}
              onChange={(e) => setNumDoctorsInput(e.target.value)}
              className='border-border rounded-xl border bg-white px-3 py-2'
            />
          </label>
          <label className='flex flex-col gap-2 text-sm'>
            Bac si moi ca
            <input
              type='number'
              min={6}
              max={30}
              value={requiredDoctorsInput}
              onChange={(e) => setRequiredDoctorsInput(e.target.value)}
              className='border-border rounded-xl border bg-white px-3 py-2'
            />
          </label>
          <label className='flex flex-col gap-2 text-sm'>
            Gio lam toi da / tuan
            <input
              type='number'
              min={24}
              max={96}
              value={maxWeeklyHoursInput}
              onChange={(e) => setMaxWeeklyHoursInput(e.target.value)}
              className='border-border rounded-xl border bg-white px-3 py-2'
            />
          </label>
          <label className='flex flex-col gap-2 text-sm'>
            So ngay nghi toi da
            <input
              type='number'
              min={0}
              max={14}
              value={maxDaysOffInput}
              onChange={(e) => setMaxDaysOffInput(e.target.value)}
              className='border-border rounded-xl border bg-white px-3 py-2'
            />
          </label>
          <label className='flex flex-col gap-2 text-sm'>
            Population NSGA
            <input
              type='number'
              min={50}
              max={400}
              value={populationSizeInput}
              onChange={(e) => setPopulationSizeInput(e.target.value)}
              className='border-border rounded-xl border bg-white px-3 py-2'
            />
          </label>
          <label className='flex flex-col gap-2 text-sm'>
            Generations NSGA
            <input
              type='number'
              min={50}
              max={500}
              value={generationsInput}
              onChange={(e) => setGenerationsInput(e.target.value)}
              className='border-border rounded-xl border bg-white px-3 py-2'
            />
          </label>
          <label className='flex flex-col gap-2 text-sm'>
            So option Pareto
            <input
              type='number'
              min={2}
              max={12}
              value={paretoLimitInput}
              onChange={(e) => setParetoLimitInput(e.target.value)}
              className='border-border rounded-xl border bg-white px-3 py-2'
            />
          </label>
        </div>

        <label className='mt-3 flex flex-col gap-2 text-sm'>
          Ngay nghi le (phan tach dau phay: 30/4, 1/5, 2/9, tet,...)
          <input
            type='text'
            value={holidayInput}
            onChange={(e) => setHolidayInput(e.target.value)}
            className='border-border rounded-xl border bg-white px-3 py-2'
          />
        </label>

        <div className='mt-3 flex flex-col justify-end gap-2 text-sm md:flex-row'>
          <button
            type='button'
            onClick={() => {
              const parsedDoctors = sanitizeInt(numDoctorsInput, 12, 400, 200);
              const parsedDays = sanitizeInt(numDaysInput, 7, 31, 30);
              const parsedMaxOff = sanitizeInt(maxDaysOffInput, 0, 14, 4);
              setDoctors(
                generateDoctors(parsedDoctors, startDate, parsedDays, parsedMaxOff)
              );
            }}
            className='border-accent text-accent rounded-xl border px-4 py-2 font-semibold transition hover:bg-teal-50'>
            Tao du lieu bac si
          </button>
          <button
            type='button'
            onClick={handleGenerateSchedule}
            className='bg-accent rounded-xl px-4 py-2 font-semibold text-white transition hover:bg-teal-800'>
            Gui request toi uu
          </button>
        </div>
      </section>

      <section className='glass stagger-in p-4 md:p-6'>
        <div className='mb-3 flex items-center justify-between'>
          <h2 className='text-lg font-bold'>Tien do xu ly request</h2>
          <span className='text-muted text-xs uppercase tracking-[0.15em]'>
            Tong quan {totalProgress}%
          </span>
        </div>
        <div className='border-border mb-3 h-3 w-full overflow-hidden rounded-full border bg-white'>
          <div
            className='bg-accent h-full transition-all duration-500'
            style={{ width: `${totalProgress}%` }}
          />
        </div>
        <div className='space-y-2'>
          {jobs.length === 0 ? (
            <p className='text-muted text-sm'>Chua co request nao duoc gui.</p>
          ) : (
            jobs.slice(0, 8).map((job) => (
              <article
                key={job.request_id}
                className='border-border rounded-xl border bg-white p-3'>
                <div className='mb-1 flex items-center justify-between gap-3'>
                  <p className='font-mono text-xs'>{job.request_id}</p>
                  <p className='text-sm font-semibold'>{job.status}</p>
                </div>
                <div className='border-border mb-2 h-2 overflow-hidden rounded-full border bg-slate-100'>
                  <div
                    className='bg-accent h-full transition-all duration-500'
                    style={{ width: `${job.progress_percent}%` }}
                  />
                </div>
                <p className='text-muted text-sm'>{job.message}</p>
                {job.error ? (
                  <p className='mt-1 text-sm text-red-700'>{job.error}</p>
                ) : null}
              </article>
            ))
          )}
        </div>
      </section>

      <section className='glass stagger-in p-4 md:p-6'>
        <div className='mb-4 flex items-center justify-between'>
          <h2 className='text-lg font-bold'>Danh sach bac si da load</h2>
          <p className='text-muted text-xs uppercase tracking-[0.15em]'>
            Tong {doctors.length} bac si
          </p>
        </div>
        <div className='overflow-x-auto'>
          <div className='max-h-96 overflow-y-auto'>
            <table className='min-w-full w-full border-collapse text-sm'>
              <thead>
                <tr className='sticky top-0 bg-teal-50 text-left'>
                  <th className='px-3 py-2'>ID</th>
                  <th className='px-3 py-2'>Ten</th>
                  <th className='px-3 py-2'>Kinh nghiem</th>
                  <th className='px-3 py-2'>Khoa</th>
                  <th className='px-3 py-2'>Chuyen khoa</th>
                </tr>
              </thead>
              <tbody>
                {doctorPreview.map((doctor) => (
                  <tr key={doctor.id} className='border-border border-b'>
                    <td className='px-3 py-2 font-mono text-xs'>{doctor.id}</td>
                    <td className='px-3 py-2'>{doctor.name}</td>
                    <td className='px-3 py-2'>{doctor.experiences}</td>
                    <td className='px-3 py-2'>{doctor.department_id}</td>
                    <td className='px-3 py-2'>{doctor.specialization}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {resultEnvelope ? (
        <section className='glass stagger-in p-4 md:p-6'>
          <div className='mb-4 flex items-center justify-between'>
            <h2 className='text-lg font-bold'>Lua chon phuong an Pareto</h2>
            <p className='text-muted text-xs uppercase tracking-[0.15em]'>
              Co {resultEnvelope.pareto_options.length} phuong an
            </p>
          </div>
          <div className='grid grid-cols-1 gap-3 md:grid-cols-3'>
            {resultEnvelope.pareto_options.map((option) => {
              const active =
                option.option_id ===
                (selectedOptionId ?? resultEnvelope.selected_option_id);
              return (
                <button
                  key={option.option_id}
                  type='button'
                  onClick={() => setSelectedOptionId(option.option_id)}
                  className={`rounded-xl border p-4 text-left transition ${active ? "border-accent bg-teal-50" : "border-border bg-white hover:border-accent"}`}>
                  <p className='mb-1 font-semibold'>{option.option_id}</p>
                  <p className='text-muted text-sm'>
                    Hard: {option.metrics.hard_violation_score.toFixed(1)}
                  </p>
                  <p className='text-muted text-sm'>
                    Soft: {option.metrics.soft_violation_score.toFixed(1)}
                  </p>
                  <p className='text-muted text-sm'>
                    Fairness: {option.metrics.fairness_std.toFixed(2)}
                  </p>
                  <p className='text-muted text-sm'>
                    Day-off std: {option.metrics.day_off_fairness_std.toFixed(2)}
                  </p>
                  <p className='text-muted text-sm'>
                    Day-off Jain: {option.metrics.day_off_fairness_jain.toFixed(4)}
                  </p>
                </button>
              );
            })}
          </div>
        </section>
      ) : null}

      {selectedOption ? (
        <>
          <section className='stagger-in grid grid-cols-1 gap-4 md:grid-cols-3'>
            <article className='glass p-5'>
              <p className='text-muted text-xs uppercase tracking-[0.15em]'>
                Hard violations
              </p>
              <p className='text-accent mt-2 text-3xl font-bold'>
                {selectedOption.metrics.hard_violation_score.toFixed(2)}
              </p>
            </article>
            <article className='glass p-5'>
              <p className='text-muted text-xs uppercase tracking-[0.15em]'>
                Soft violations
              </p>
              <p className='text-accent-2 mt-2 text-3xl font-bold'>
                {selectedOption.metrics.soft_violation_score.toFixed(2)}
              </p>
            </article>
            <article className='glass p-5'>
              <p className='text-muted text-xs uppercase tracking-[0.15em]'>
                Fairness std
              </p>
              <p className='mt-2 text-3xl font-bold text-slate-700'>
                {selectedOption.metrics.fairness_std.toFixed(2)}
              </p>
            </article>
          </section>

          <section className='stagger-in grid grid-cols-1 gap-4 md:grid-cols-2'>
            <article className='glass p-5'>
              <p className='text-muted text-xs uppercase tracking-[0.15em]'>
                Day-off fairness std
              </p>
              <p className='mt-2 text-3xl font-bold text-slate-700'>
                {selectedOption.metrics.day_off_fairness_std.toFixed(2)}
              </p>
            </article>
            <article className='glass p-5'>
              <p className='text-muted text-xs uppercase tracking-[0.15em]'>
                Day-off fairness Jain
              </p>
              <p className='mt-2 text-3xl font-bold text-emerald-700'>
                {selectedOption.metrics.day_off_fairness_jain.toFixed(4)}
              </p>
            </article>
          </section>

          <section className='glass stagger-in overflow-hidden p-4 md:p-6'>
            <div className='mb-4 flex items-center justify-between'>
              <h2 className='text-lg font-bold'>
                Thoi khoa bieu ca truc theo tuan
              </h2>
              <div className='flex items-center gap-2'>
                <p className='text-muted text-xs uppercase tracking-[0.15em]'>
                  Tuan {totalWeeks === 0 ? 0 : weekIndex + 1}/{totalWeeks}
                </p>
                <button
                  type='button'
                  onClick={() => setWeekIndex((prev) => Math.max(prev - 1, 0))}
                  disabled={weekIndex === 0}
                  className='border-border rounded-md border bg-white px-2 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-40'>
                  Truoc
                </button>
                <button
                  type='button'
                  onClick={() =>
                    setWeekIndex((prev) => Math.min(prev + 1, totalWeeks - 1))
                  }
                  disabled={weekIndex >= totalWeeks - 1}
                  className='border-border rounded-md border bg-white px-2 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-40'>
                  Tiep
                </button>
              </div>
            </div>
            <div className='overflow-x-auto'>
              <table className='min-w-245 w-full border-collapse text-sm'>
                <thead>
                  <tr className='bg-slate-100 text-left'>
                    <th className='border-border w-24 border px-3 py-2'>
                      Ca hoc
                    </th>
                    {visibleWeekDates.map((date, index) => (
                      <th
                        key={date || `placeholder-${index}`}
                        className='border-border w-32 border px-3 py-2 text-center'>
                        {date ? formatWeekdayLong(date) : ""}
                        <div className='text-muted font-mono text-xs'>
                          {date}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {weekRows.map((row) => (
                    <tr
                      key={row.shift}
                      className='border-border border-b align-top'>
                      <td className='border-border bg-amber-50 px-3 py-3 font-semibold'>
                        {SHIFT_LABELS[row.shift]}
                      </td>
                      {row.cells.map((doctorIds, idx) => (
                        <td
                          key={`${row.shift}-${visibleWeekDates[idx] || idx}`}
                          className='border-border h-45 border px-2 py-2 align-top'>
                          {visibleWeekDates[idx] ? (
                            <button
                              type='button'
                              onClick={() =>
                                setSelectedShiftDetail({
                                  date: visibleWeekDates[idx],
                                  shift: row.shift,
                                  doctorIds
                                })
                              }
                              className='border-border h-full w-full rounded-md border bg-white p-2 text-left transition hover:border-cyan-500 hover:bg-cyan-50'>
                              <p className='text-xs font-semibold text-slate-700'>
                                {SHIFT_LABELS[row.shift]} • {doctorIds.length} bac si
                              </p>
                              <p className='mt-2 line-clamp-2 text-xs text-slate-500'>
                                {doctorIds
                                  .slice(0, 3)
                                  .map((doctorId) => doctorLookup.get(doctorId)?.name ?? doctorId)
                                  .join(", ") || "Chua co bac si"}
                              </p>
                              <p className='mt-3 text-[11px] font-semibold text-cyan-700'>
                                Bam de xem chi tiet ca truc
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
              <article className='border-border mt-4 rounded-xl border bg-white p-4'>
                <div className='mb-3 flex items-start justify-between gap-3'>
                  <div>
                    <p className='text-sm font-semibold'>
                      Chi tiet ca {SHIFT_LABELS[selectedShiftDetail.shift]} - {formatWeekdayLong(selectedShiftDetail.date)} ({selectedShiftDetail.date})
                    </p>
                    <p className='text-muted text-xs'>
                      Tong {selectedShiftDoctors.length} bac si tham gia
                    </p>
                  </div>
                  <button
                    type='button'
                    onClick={() => setSelectedShiftDetail(null)}
                    className='border-border rounded-md border bg-white px-2 py-1 text-xs'>
                    Dong
                  </button>
                </div>

                <div className='grid grid-cols-1 gap-2 md:grid-cols-2'>
                  {selectedShiftDoctors.map((doctor) => (
                    <article
                      key={`${selectedShiftDetail.date}-${selectedShiftDetail.shift}-${doctor.id}`}
                      className='border-border rounded-md border p-3 text-xs'>
                      <div className='mb-1 flex items-center justify-between gap-3'>
                        <p className='font-semibold text-sm'>{doctor.name}</p>
                        <p
                          className={`rounded-full px-2 py-0.5 font-semibold ${doctor.experiences < 2 ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"}`}>
                          {doctor.role}
                        </p>
                      </div>
                      <p className='font-mono text-slate-600'>{doctor.id}</p>
                      <p className='text-slate-600'>Kinh nghiem: {doctor.experiences} nam</p>
                      <p className='text-slate-600'>Khoa: {doctor.department_id}</p>
                      <p className='text-slate-600'>Chuyen khoa: {doctor.specialization}</p>
                    </article>
                  ))}
                </div>
              </article>
            ) : null}
          </section>

          <section className='glass stagger-in p-4 md:p-6'>
            <div className='mb-4 flex items-center justify-between'>
              <h2 className='text-lg font-bold'>
                Thong ke can bang so luong ca truc (co chung minh toan hoc)
              </h2>
              <p className='text-muted text-xs uppercase tracking-[0.15em]'>
                Tong {balanceTop.length} bac si
              </p>
            </div>

            {balanceMath ? (
              <article className='border-border mb-4 rounded-xl border bg-white p-4 text-sm'>
                <p className='mb-2 font-semibold'>Chi so can bang toan hoc</p>
                <p className='text-muted'>
                  Theo TUAN: mu = {balanceMath.week.mean.toFixed(2)}, sigma = {balanceMath.week.std.toFixed(2)}, CV = {balanceMath.week.cv.toFixed(4)}, Jain = {balanceMath.week.jain.toFixed(4)}
                </p>
                <p className='text-muted'>
                  Theo THANG: mu = {balanceMath.month.mean.toFixed(2)}, sigma = {balanceMath.month.std.toFixed(2)}, CV = {balanceMath.month.cv.toFixed(4)}, Jain = {balanceMath.month.jain.toFixed(4)}
                </p>
                <p className='text-muted'>
                  Theo NAM: mu = {balanceMath.year.mean.toFixed(2)}, sigma = {balanceMath.year.std.toFixed(2)}, CV = {balanceMath.year.cv.toFixed(4)}, Jain = {balanceMath.year.jain.toFixed(4)}
                </p>
                <p className='text-muted mt-1'>
                  Luu y: chi so co the khac nhau giua cac bieu do vi moi bieu do dung bo du lieu khac nhau (tuan/thang/nam).
                </p>
                {selectedOption ? (
                  <p className='text-muted mt-1'>
                    Chi so can bang ngay nghi tu THUAT TOAN: std = {selectedOption.metrics.day_off_fairness_std.toFixed(2)}, Jain = {selectedOption.metrics.day_off_fairness_jain.toFixed(4)}.
                  </p>
                ) : null}
              </article>
            ) : null}

            <div className='grid grid-cols-1 gap-4'>
              <article className='border-border rounded-xl border bg-white p-4'>
                <p className='mb-2 text-sm font-semibold'>Bieu do so ca theo tuan</p>
                <div style={{ height: `${chartHeight}px` }}>
                  <Bar data={weeklyChartData} options={baseChartOptions} />
                </div>
              </article>

              <article className='border-border rounded-xl border bg-white p-4'>
                <p className='mb-2 text-sm font-semibold'>Bieu do so ca theo thang</p>
                <div style={{ height: `${chartHeight}px` }}>
                  <Bar data={monthlyChartData} options={baseChartOptions} />
                </div>
              </article>

              <article className='border-border rounded-xl border bg-white p-4'>
                <p className='mb-2 text-sm font-semibold'>Bieu do so ca theo nam</p>
                <div style={{ height: `${chartHeight}px` }}>
                  <Bar data={yearlyChartData} options={baseChartOptions} />
                </div>
              </article>

              <article className='border-border rounded-xl border bg-white p-4'>
                <p className='mb-2 text-sm font-semibold'>Bieu do so ngay nghi theo thang</p>
                <div style={{ height: `${chartHeight}px` }}>
                  <Bar data={monthlyDayOffChartData} options={baseChartOptions} />
                </div>
              </article>
            </div>
          </section>
        </>
      ) : null}

      {error ? (
        <section className='glass border-accent-2 border-l-4 p-4 text-sm text-amber-900'>
          {error}
        </section>
      ) : null}
    </main>
  );
}
