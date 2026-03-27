"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { JobProgressSection } from "@/components/schedule/JobProgressSection";
import { ScheduleControlSection } from "@/components/schedule/ScheduleControlSection";
import { RunMetricsSection } from "@/components/schedule/RunMetricsSection";
import { ParetoOptionsSection } from "@/components/schedule/ParetoOptionsSection";
import { DoctorSummarySection } from "@/components/schedule/DoctorSummarySection";
import { TimetableSection } from "@/components/schedule/TimetableSection";
import { ErrorBanner } from "@/components/schedule/ErrorBanner";
import { SHIFT_ORDER } from "@/lib/schedule/constants";
import {
  fetchScheduleAndMetrics,
  fetchScheduleProgress,
  postRunSchedule,
} from "@/lib/schedule/api";
import {
  firstDayOfNextMonth,
  generateDoctors,
  numDaysThroughEndOfCalendarMonth,
  sanitizeInt,
  toLocalDateStr,
} from "@/lib/schedule/utils";
import type {
  DoctorInput,
  RequestJob,
  ScheduleJobMetricsResponseDTO,
  ScheduleJobScheduleResponseDTO,
  ScheduleJobStatusDTO,
  ScheduleRequestAcceptedDTO,
  ShiftDetailState,
} from "@/lib/schedule/types";

export default function Home() {
  const [startDate, setStartDate] = useState(() =>
    toLocalDateStr(firstDayOfNextMonth())
  );
  const [numDoctorsInput, setNumDoctorsInput] = useState("20");
  const [roomsPerShiftInput, setRoomsPerShiftInput] = useState("2");
  const [doctorsPerRoomInput, setDoctorsPerRoomInput] = useState("6");
  const [maxWeeklyHoursInput, setMaxWeeklyHoursInput] = useState("48");
  const [maxDaysOffInput, setMaxDaysOffInput] = useState("4");

  const [doctors, setDoctors] = useState<DoctorInput[]>(() => {
    const s = toLocalDateStr(firstDayOfNextMonth());
    const n = numDaysThroughEndOfCalendarMonth(s);
    return generateDoctors(200, s, n, 4);
  });
  const [jobs, setJobs] = useState<RequestJob[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [scheduleData, setScheduleData] = useState<ScheduleJobScheduleResponseDTO | null>(null);
  const [metricsData, setMetricsData] = useState<ScheduleJobMetricsResponseDTO | null>(null);
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [weekIndex, setWeekIndex] = useState(0);
  const [selectedShiftDetail, setSelectedShiftDetail] = useState<ShiftDetailState | null>(null);
  const activePollsRef = useRef<Set<string>>(new Set());
  const pollTimersRef = useRef<Map<string, number>>(new Map());
  const pollInFlightRef = useRef<Set<string>>(new Set());

  const latestJob = jobs[0] ?? null;

  
  const STORAGE_KEY = "schedule_state";
  
  function saveState() {
    if (typeof window === "undefined") return;
    const state = { jobs, scheduleData, metricsData, selectedOptionId };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function loadState() {
    if (typeof window === "undefined") return null;
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  }

  function clearState() {
    if (typeof window === "undefined") return;
    localStorage.removeItem(STORAGE_KEY);
  }

  function stopPollingJob(requestId: string): void {
    activePollsRef.current.delete(requestId);
    pollInFlightRef.current.delete(requestId);
    const timerId = pollTimersRef.current.get(requestId);
    if (timerId !== undefined) {
      window.clearInterval(timerId);
      pollTimersRef.current.delete(requestId);
    }
  }

  function stopAllPolling(): void {
    pollTimersRef.current.forEach((timerId) => {
      window.clearInterval(timerId);
    });
    pollTimersRef.current.clear();
    activePollsRef.current.clear();
    pollInFlightRef.current.clear();
  }

  
  useEffect(() => {
    const stored = loadState();
    if (stored) {
      setJobs(stored.jobs || []);
      setScheduleData(stored.scheduleData || null);
      setMetricsData(stored.metricsData || null);
      setSelectedOptionId(stored.selectedOptionId || null);
      console.log("[localStorage] Loaded state:", stored);

      const runningJobs = (stored.jobs || []).filter(
        (job: RequestJob) => job.status === "queued" || job.status === "running"
      );
      if (runningJobs.length > 0) {
        console.log("[localStorage] Found running jobs, resuming polling:", runningJobs);
        runningJobs.forEach((job: RequestJob) => {
          void pollJobProgress(job.request_id).catch((err: unknown) => {
            console.error("[localStorage] Error resuming polling:", err);
            setError(err instanceof Error ? err.message : "Lỗi theo dõi tiến độ");
          });
        });
      }
    }
  }, []);

  
  useEffect(() => {
    saveState();
  }, [jobs, scheduleData, metricsData, selectedOptionId]);

  useEffect(() => {
    return () => {
      stopAllPolling();
    };
  }, []);
  
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

  function parseDateLocal(dateStr: string): Date {
    return new Date(`${dateStr}T00:00:00`);
  }

  function toDateStrLocal(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  function mondayOf(dateStr: string): string {
    const date = parseDateLocal(dateStr);
    const day = date.getDay() || 7; 
    date.setDate(date.getDate() - (day - 1)); 
    return toDateStrLocal(date);
  }

  const timetableData = useMemo(() => {
    if (!selectedParetoSchedule) {
      return {
        dates: [] as string[],
        rows: [] as Array<{
          shift: string;
          cells: Array<Array<{ room: string; doctorIds: string[] }>>;
        }>
      };
    }
    const dates = Array.from(
      new Set(selectedParetoSchedule.assignments.map((assignment) => assignment.date))
    ).sort((a, b) => a.localeCompare(b));

    
    const rows = SHIFT_ORDER.map((shift) => ({
      shift,
      cells: dates.map((date) => {
        return selectedParetoSchedule.assignments
          .filter((assignment) => assignment.date === date && assignment.shift === shift)
          .sort((a, b) => a.room.localeCompare(b.room))
          .map((assignment) => ({
            room: assignment.room,
            doctorIds: assignment.doctor_ids,
          }));
      })
    }));
    return { dates, rows };
  }, [selectedParetoSchedule]);

  const doctorLookup = useMemo(
    () => new Map(doctors.map((doctor) => [doctor.id, doctor])),
    [doctors]
  );

  const weekStartDates = useMemo(() => {
    if (timetableData.dates.length === 0) return [] as string[];

    const first = timetableData.dates[0];
    const last = timetableData.dates[timetableData.dates.length - 1];
    const starts: string[] = [];

    let cursor = parseDateLocal(mondayOf(first));
    const endDate = parseDateLocal(last);

    while (cursor <= endDate) {
      starts.push(toDateStrLocal(cursor));
      cursor.setDate(cursor.getDate() + 7);
    }

    return starts;
  }, [timetableData.dates]);

  const totalWeeks = useMemo(
    () => weekStartDates.length,
    [weekStartDates.length]
  );

  const visibleWeekDates = useMemo(() => {
    const weekStart = weekStartDates[weekIndex];
    if (!weekStart) return Array.from({ length: 7 }, () => "");

    const availableDates = new Set(timetableData.dates);
    const startDate = parseDateLocal(weekStart);

    return Array.from({ length: 7 }, (_, offset) => {
      const current = new Date(startDate);
      current.setDate(startDate.getDate() + offset);
      const dateStr = toDateStrLocal(current);
      return availableDates.has(dateStr) ? dateStr : "";
    });
  }, [weekStartDates, weekIndex, timetableData.dates]);

  const weekRows = useMemo(() => {
    if (visibleWeekDates.length === 0) {
      return [] as Array<{
        shift: string;
        cells: Array<Array<{ room: string; doctorIds: string[] }>>;
      }>;
    }
    const dateIndexMap = new Map(
      timetableData.dates.map((date, index) => [date, index])
    );
    return timetableData.rows.map((row) => ({
      shift: row.shift,
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

    
    const totalDutySlots = num_days * shifts_per_day * rooms_per_shift;
    
    const totalShiftSlots = totalDutySlots * doctors_per_room;
    const theoreticalAvg = totalShiftSlots / n;

    const counts = new Map<string, number>();
    for (const d of doctors) {
      counts.set(d.id, 0);
    }
    const dutySlotSet = new Set<string>();
    for (const a of selectedParetoSchedule.assignments) {
      dutySlotSet.add(`${a.date}-${a.shift}-${a.room}`);
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
    const actualDutySlots = dutySlotSet.size;

    return {
      theoreticalAvg,
      actualAvg,
      totalDutySlots,
      actualDutySlots,
      totalShiftSlots,
      actualSum,
      n,
      minCa,
      maxCa
    };
  }, [scheduleData, selectedParetoSchedule, doctors]);

  const totalsStats = useMemo(() => {
    const totalDaysOff = doctors.reduce((sum, d) => {
      
      return sum + new Set(d.days_off ?? []).size;
    }, 0);

    return { totalDaysOff };
  }, [doctors]);

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
      void fetchScheduleAndMetrics(progress.request_id)
        .then(({ schedule, metrics }) => {
          setScheduleData(schedule);
          setMetricsData(metrics);
          setSelectedOptionId(schedule.selected_option_id);
        })
        .catch((err: unknown) => {
          setError(err instanceof Error ? err.message : "Lỗi tải kết quả");
        });
    }
    if (progress.status === "failed") {
      setError(progress.error ?? "Yêu cầu tối ưu thất bại");
    }
  }

  async function pollJobProgress(requestId: string): Promise<void> {
    if (pollTimersRef.current.has(requestId)) {
      return;
    }

    activePollsRef.current.add(requestId);

    const tick = async (): Promise<void> => {
      if (!activePollsRef.current.has(requestId)) {
        return;
      }

      if (pollInFlightRef.current.has(requestId)) {
        return;
      }

      pollInFlightRef.current.add(requestId);
      try {
        const progress = await fetchScheduleProgress(requestId);
        console.log("[pollJobProgress] Status:", progress.status, "Progress:", progress.progress_percent);
        updateJobProgress(progress);

        if (progress.status === "completed" || progress.status === "failed") {
          console.log("[pollJobProgress] Job đã kết thúc, dừng polling");
          stopPollingJob(requestId);
        }
      } catch (err: unknown) {
        console.error("[pollJobProgress] Lỗi poll, sẽ thử lại:", err);
        setError(err instanceof Error ? err.message : "Lỗi đồng bộ tiến độ");
      } finally {
        pollInFlightRef.current.delete(requestId);
      }
    };

    void tick();
    const timerId = window.setInterval(() => {
      void tick();
    }, 5000);
    pollTimersRef.current.set(requestId, timerId);
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
        doctors: preparedDoctors
      };

      const accepted: ScheduleRequestAcceptedDTO = await postRunSchedule(payload);
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
      <ScheduleControlSection
        startDate={startDate}
        monthSpanDays={monthSpanDays}
        numDoctorsInput={numDoctorsInput}
        roomsPerShiftInput={roomsPerShiftInput}
        doctorsPerRoomInput={doctorsPerRoomInput}
        maxWeeklyHoursInput={maxWeeklyHoursInput}
        maxDaysOffInput={maxDaysOffInput}
        doctorsCount={doctors.length}
        onStartDateChange={setStartDate}
        onNumDoctorsChange={setNumDoctorsInput}
        onRoomsPerShiftChange={setRoomsPerShiftInput}
        onDoctorsPerRoomChange={setDoctorsPerRoomInput}
        onMaxWeeklyHoursChange={setMaxWeeklyHoursInput}
        onMaxDaysOffChange={setMaxDaysOffInput}
        onRegenerateDoctors={() => {
          const parsedDoctors = sanitizeInt(numDoctorsInput, 12, 400, 200);
          const parsedMaxOff = sanitizeInt(maxDaysOffInput, 0, 14, 4);
          setDoctors(generateDoctors(parsedDoctors, startDate, monthSpanDays, parsedMaxOff));
        }}
        onRunSchedule={() => {
          void handleRunSchedule();
        }}
      />

      <JobProgressSection totalProgress={totalProgress} jobs={jobs} />

      {(jobs.length > 0 || scheduleData) && (
        <div className="flex gap-2">
          <button
            onClick={() => {
              stopAllPolling();
              clearState();
              setJobs([]);
              setScheduleData(null);
              setMetricsData(null);
              setSelectedOptionId(null);
              window.location.reload();
            }}
            className="rounded bg-gray-300 px-3 py-1 text-sm hover:bg-gray-400"
          >
            Clear Cache
          </button>
        </div>
      )}

      {runMetrics ? <RunMetricsSection runMetrics={runMetrics} /> : null}

      {scheduleData && metricsData ? (
        <ParetoOptionsSection
          scheduleData={scheduleData}
          metricsData={metricsData}
          effectiveOptionId={effectiveOptionId}
          onSelectOption={setSelectedOptionId}
        />
      ) : null}

      {selectedParetoSchedule ? (
        <DoctorSummarySection selectedParetoSchedule={selectedParetoSchedule} doctors={doctors} />
      ) : null}

      {selectedParetoSchedule ? (
        <TimetableSection
          selectedParetoSchedule={selectedParetoSchedule}
          totalWeeks={totalWeeks}
          weekIndex={weekIndex}
          visibleWeekDates={visibleWeekDates}
          weekRows={weekRows}
          doctorLookup={doctorLookup}
          selectedShiftDetail={selectedShiftDetail}
          selectedShiftDoctors={selectedShiftDoctors}
          onPrevWeek={() => setWeekIndex((prev) => Math.max(prev - 1, 0))}
          onNextWeek={() => setWeekIndex((prev) => Math.min(prev + 1, Math.max(totalWeeks - 1, 0)))}
          onSelectShift={setSelectedShiftDetail}
          onCloseShiftDetail={() => setSelectedShiftDetail(null)}
        />
      ) : null}

      {error ? <ErrorBanner error={error} /> : null}
    </main>
  );
}
