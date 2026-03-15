"use client";

import { use, useEffect, useMemo, useRef, useState } from "react";

import {
  API_BASE,
  getDoctors,
  getSchedule,
  selectSolution,
  startOptimization
} from "@/lib/api";
import type { ParetoPoint, ScheduleSolution } from "@/lib/types";

function objectiveToPoint(
  points: ParetoPoint[],
  width: number,
  height: number,
  p: ParetoPoint
) {
  const f1Min = Math.min(...points.map((i) => i.f1));
  const f1Max = Math.max(...points.map((i) => i.f1));
  const f2Min = Math.min(...points.map((i) => i.f2));
  const f2Max = Math.max(...points.map((i) => i.f2));

  const x =
    ((p.f1 - f1Min) / Math.max(0.0001, f1Max - f1Min)) * (width - 20) + 10;
  const y =
    height -
    (((p.f2 - f2Min) / Math.max(0.0001, f2Max - f2Min)) * (height - 20) + 10);
  return { x, y };
}

export default function SchedulePage({
  params
}: {
  params: Promise<{ month: string }>;
}) {
  const { month } = use(params);
  const [doctorNameById, setDoctorNameById] = useState<Record<string, string>>(
    {}
  );
  const [populationSize, setPopulationSize] = useState(80);
  const [generations, setGenerations] = useState(120);
  const [progress, setProgress] = useState(0);
  const [generation, setGeneration] = useState(0);
  const [paretoCount, setParetoCount] = useState(0);
  const [paretoFront, setParetoFront] = useState<ParetoPoint[]>([]);
  const [allSolutions, setAllSolutions] = useState<ScheduleSolution[]>([]);
  const [solution, setSolution] = useState<ScheduleSolution | null>(null);
  const [toast, setToast] = useState<{
    type: "error" | "warn";
    text: string;
  } | null>(null);
  const [dragSource, setDragSource] = useState<{
    slotId: string;
    doctorId: string;
  } | null>(null);
  const [activeWeek, setActiveWeek] = useState(0);
  const [status, setStatus] = useState("Idle");
  const sourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    getDoctors()
      .then((list) => {
        const map: Record<string, string> = {};
        list.forEach((d) => {
          map[d.id] = d.full_name;
        });
        setDoctorNameById(map);
      })
      .catch(() => {
        // Ignore doctor name lookup errors; ids will still be shown.
      });

    getSchedule(month)
      .then((data) => {
        setSolution(data.solution);
        setAllSolutions(data.all_solutions);
      })
      .catch((err: Error) => setStatus(err.message));
  }, [month]);

  async function runOptimization() {
    try {
      setToast(null);
      const doctors = await getDoctors();
      if (doctors.length === 0) {
        setStatus(
          "Chưa có bác sĩ. Vào Bước 2 và bấm 'Load sample doctors' hoặc import danh sách rồi thử lại."
        );
        setToast({
          type: "warn",
          text: "Không thể tối ưu khi chưa có bác sĩ."
        });
        return;
      }

      setStatus("Starting optimization...");
      const jobId = await startOptimization(month, populationSize, generations);
      const source = new EventSource(`${API_BASE}/optimize/stream/${jobId}`);
      sourceRef.current = source;

      source.onmessage = (event) => {
        const data = JSON.parse(event.data) as {
          type: string;
          generation?: number;
          progress?: number;
          pareto_count?: number;
          objectives?: number[][];
          pareto_front?: ParetoPoint[];
          solutions?: ScheduleSolution[];
          message?: string;
        };

        if (data.type === "progress") {
          setGeneration(data.generation ?? 0);
          setProgress(data.progress ?? 0);
          setParetoCount(data.pareto_count ?? 0);
          if (data.objectives) {
            setStatus(`Gen ${data.generation}: objective preview cập nhật`);
          }
        }

        if (data.type === "completed") {
          setStatus("Optimization completed");
          setParetoFront(data.pareto_front ?? []);
          setAllSolutions(data.solutions ?? []);
          setSolution(data.solutions?.[0] ?? null);
          source.close();
        }

        if (data.type === "failed") {
          setStatus(data.message ?? "Optimization failed");
          source.close();
        }
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Optimize failed";
      setStatus(message);
      setToast({ type: "error", text: message });
    }
  }

  useEffect(() => {
    return () => {
      sourceRef.current?.close();
    };
  }, []);

  const bars = useMemo(() => {
    if (!solution) return [];
    const map = new Map<string, number>();
    solution.assignments.forEach((a) => {
      a.doctor_ids.forEach((id) => map.set(id, (map.get(id) ?? 0) + 1));
    });
    return [...map.entries()].map(([id, count]) => ({ id, count }));
  }, [solution]);

  function validateDrop(slotId: string): {
    hardError?: string;
    softWarning?: string;
  } {
    if (!solution) return {};
    const assignment = solution.assignments.find((a) => a.slot_id === slotId);
    if (!assignment) return { hardError: "Slot không tồn tại" };

    if (assignment.doctor_ids.length === 0) {
      return { hardError: "Vi phạm cứng: thiếu nhân lực tối thiểu" };
    }

    if (assignment.shift_type === "NIGHT" && assignment.doctor_ids.length < 2) {
      return { hardError: "Vi phạm cứng: thiếu giám sát ca đêm" };
    }

    if (assignment.doctor_ids.length > 4) {
      return { softWarning: "Vi phạm mềm: lệch cân bằng tải" };
    }

    return {};
  }

  function moveAssignment(
    fromSlotId: string,
    toSlotId: string,
    doctorId: string
  ) {
    if (!solution) return;
    if (fromSlotId === toSlotId) return;

    const clone: ScheduleSolution = {
      ...solution,
      assignments: solution.assignments.map((a) => ({
        ...a,
        doctor_ids: [...a.doctor_ids]
      }))
    };

    const from = clone.assignments.find((a) => a.slot_id === fromSlotId);
    const to = clone.assignments.find((a) => a.slot_id === toSlotId);
    if (!from || !to || from.doctor_ids.length === 0) return;

    const sourceIndex = from.doctor_ids.indexOf(doctorId);
    if (sourceIndex === -1) return;
    if (to.doctor_ids.includes(doctorId)) return;

    from.doctor_ids.splice(sourceIndex, 1);
    to.doctor_ids.push(doctorId);

    const result = validateDrop(toSlotId);
    if (result.hardError) {
      setToast({ type: "error", text: result.hardError });
      return;
    }

    if (result.softWarning) {
      setToast({ type: "warn", text: result.softWarning });
    } else {
      setToast(null);
    }

    setSolution(clone);
  }

  const [year, monthValue] = month.split("-").map(Number);
  const daysInMonth =
    Number.isFinite(year) && Number.isFinite(monthValue)
      ? new Date(year, monthValue, 0).getDate()
      : 30;

  const weekRanges = useMemo(() => {
    const weeks: number[][] = [];
    for (let day = 1; day <= daysInMonth; day += 7) {
      const end = Math.min(day + 6, daysInMonth);
      const days = [];
      for (let value = day; value <= end; value += 1) {
        days.push(value);
      }
      weeks.push(days);
    }
    return weeks;
  }, [daysInMonth]);

  useEffect(() => {
    if (activeWeek >= weekRanges.length) {
      setActiveWeek(Math.max(0, weekRanges.length - 1));
    }
  }, [activeWeek, weekRanges]);

  const visibleDays = weekRanges[activeWeek] ?? [];
  const shiftRows: Array<{ shift: "HC" | "TR" | "NIGHT"; label: string }> = [
    { shift: "HC", label: "Sáng" },
    { shift: "TR", label: "Chiều" },
    { shift: "NIGHT", label: "Đêm" }
  ];

  const assignmentBySlot = useMemo(() => {
    const map = new Map<string, ScheduleSolution["assignments"][number]>();
    (solution?.assignments ?? []).forEach((a) => map.set(a.slot_id, a));
    return map;
  }, [solution]);

  function dayLabel(day: number): string {
    const date = new Date(year, monthValue - 1, day);
    const labels = [
      "Chủ nhật",
      "Thứ 2",
      "Thứ 3",
      "Thứ 4",
      "Thứ 5",
      "Thứ 6",
      "Thứ 7"
    ];
    return labels[date.getDay()] ?? "Ngày";
  }

  function formatSlot(day: number, shift: "HC" | "TR" | "NIGHT"): string {
    return `${String(day).padStart(2, "0")}:${shift}`;
  }

  return (
    <section className='panel'>
      <h1 className='title'>Bước 3-5 - Tối ưu và tinh chỉnh lịch</h1>
      <p className='small'>
        NSGA-II chạy bất đồng bộ, frontend stream realtime qua SSE.
      </p>

      <div className='grid-2' style={{ marginTop: 12 }}>
        <div className='panel' style={{ padding: 12 }}>
          <h3>Luồng tối ưu hóa</h3>
          <label>Population</label>
          <input
            className='input'
            type='number'
            value={populationSize}
            onChange={(e) => setPopulationSize(Number(e.target.value))}
          />
          <label>Generations</label>
          <input
            className='input'
            type='number'
            value={generations}
            onChange={(e) => setGenerations(Number(e.target.value))}
          />
          <button className='btn' onClick={runOptimization}>
            Tối ưu hóa
          </button>

          <div style={{ marginTop: 12 }}>
            <div className='small'>Generation: {generation}</div>
            <div className='small'>Pareto solutions: {paretoCount}</div>
            <div className='small'>Status: {status}</div>
            <div
              style={{
                width: "100%",
                background: "#f2dbc2",
                height: 14,
                borderRadius: 99,
                marginTop: 8
              }}>
              <div
                style={{
                  width: `${Math.round(progress * 100)}%`,
                  height: 14,
                  borderRadius: 99,
                  background: "#177b63",
                  transition: "width 240ms ease"
                }}
              />
            </div>
          </div>
        </div>

        <div className='panel' style={{ padding: 12 }}>
          <h3>Pareto scatter plot (f1 vs f2)</h3>
          <svg
            width='100%'
            viewBox='0 0 420 220'
            role='img'
            aria-label='pareto scatter'>
            <rect
              x='0'
              y='0'
              width='420'
              height='220'
              fill='#fff'
              stroke='#d7c4af'
            />
            {paretoFront.map((p) => {
              const { x, y } = objectiveToPoint(paretoFront, 420, 220, p);
              return (
                <circle
                  key={p.solution_id}
                  cx={x}
                  cy={y}
                  r={6}
                  fill='#d94f2b'
                  onClick={async () => {
                    const chosen =
                      allSolutions.find(
                        (s) => s.solution_id === p.solution_id
                      ) ?? null;
                    setSolution(chosen);
                    if (chosen) {
                      await selectSolution(month, chosen.solution_id);
                    }
                  }}
                  style={{ cursor: "pointer" }}
                />
              );
            })}
          </svg>
          <p className='small'>Click từng điểm để preview và chọn solution.</p>
        </div>
      </div>

      <div className='grid-2' style={{ marginTop: 12 }}>
        <div className='panel' style={{ padding: 12 }}>
          <h3>Lịch tuần (drag and drop theo ca)</h3>
          <div
            style={{
              display: "flex",
              gap: 8,
              marginBottom: 8,
              flexWrap: "wrap"
            }}>
            {weekRanges.map((week, idx) => (
              <button
                key={`week-${idx}`}
                className={`btn ${idx === activeWeek ? "" : "secondary"}`}
                onClick={() => setActiveWeek(idx)}>
                Tuần {idx + 1} ({String(week[0]).padStart(2, "0")}-
                {String(week[week.length - 1]).padStart(2, "0")})
              </button>
            ))}
          </div>

          <div style={{ overflowX: "auto" }}>
            <table className='week-calendar'>
              <thead>
                <tr>
                  <th className='shift-col'>Ca trực</th>
                  {visibleDays.map((day) => (
                    <th key={`h-${day}`}>
                      <div style={{ fontWeight: 700 }}>{dayLabel(day)}</div>
                      <div className='small'>
                        {String(day).padStart(2, "0")}/
                        {String(monthValue).padStart(2, "0")}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {shiftRows.map((row) => (
                  <tr key={row.shift}>
                    <td className='shift-col'>
                      <strong>{row.label}</strong>
                    </td>
                    {visibleDays.map((day) => {
                      const slotId = formatSlot(day, row.shift);
                      const doctorsInSlot =
                        assignmentBySlot.get(slotId)?.doctor_ids ?? [];
                      return (
                        <td
                          key={`${slotId}-cell`}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={() => {
                            if (dragSource) {
                              moveAssignment(
                                dragSource.slotId,
                                slotId,
                                dragSource.doctorId
                              );
                              setDragSource(null);
                            }
                          }}>
                          <div className='week-cell'>
                            {doctorsInSlot.length === 0 ? (
                              <div className='slot-empty'>(trống)</div>
                            ) : (
                              doctorsInSlot.map((doctorId) => (
                                <div
                                  key={`${slotId}-${doctorId}`}
                                  className='doctor-card'
                                  draggable
                                  onDragStart={() =>
                                    setDragSource({ slotId, doctorId })
                                  }>
                                  <div className='doctor-name'>
                                    {doctorNameById[doctorId] ?? doctorId}
                                  </div>
                                  <div className='doctor-meta'>{doctorId}</div>
                                </div>
                              ))
                            )}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className='panel' style={{ padding: 12 }}>
          <h3>Bar chart tổng ca theo bác sĩ</h3>
          <div style={{ display: "grid", gap: 8 }}>
            {bars.map((b) => (
              <div key={b.id}>
                <div className='small'>{b.id}</div>
                <div
                  style={{
                    height: 12,
                    borderRadius: 99,
                    background: "#efdfcb"
                  }}>
                  <div
                    style={{
                      height: 12,
                      borderRadius: 99,
                      background: b.count > 20 ? "#b5312f" : "#177b63",
                      width: `${Math.min(100, b.count * 4)}%`
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {toast ? <div className={`toast ${toast.type}`}>{toast.text}</div> : null}
    </section>
  );
}
