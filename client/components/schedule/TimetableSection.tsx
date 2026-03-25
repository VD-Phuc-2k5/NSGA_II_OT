import { SHIFT_LABELS } from "@/lib/schedule/constants";
import { formatWeekdayLong } from "@/lib/schedule/utils";
import type { DoctorInput, ParetoScheduleAssignmentsDTO, ShiftDetailState } from "@/lib/schedule/types";

type WeekRow = {
  shift: string;
  cells: Array<Array<{ room: string; doctorIds: string[] }>>;
};

type ShiftDoctorDetail = {
  id: string;
  name: string;
  experiences: number;
  department_id: string;
  specialization: string;
  days_off: string[];
  preferred_extra_days: string[];
  role: string;
};

type Props = {
  selectedParetoSchedule: ParetoScheduleAssignmentsDTO;
  totalWeeks: number;
  weekIndex: number;
  visibleWeekDates: string[];
  weekRows: WeekRow[];
  doctorLookup: Map<string, DoctorInput>;
  selectedShiftDetail: ShiftDetailState | null;
  selectedShiftDoctors: ShiftDoctorDetail[];
  onPrevWeek: () => void;
  onNextWeek: () => void;
  onSelectShift: (state: ShiftDetailState) => void;
  onCloseShiftDetail: () => void;
};

export function TimetableSection({
  selectedParetoSchedule,
  totalWeeks,
  weekIndex,
  visibleWeekDates,
  weekRows,
  doctorLookup,
  selectedShiftDetail,
  selectedShiftDoctors,
  onPrevWeek,
  onNextWeek,
  onSelectShift,
  onCloseShiftDetail,
}: Props) {
  return (
    <section className="glass stagger-in overflow-hidden p-4 md:p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-bold">Thời khóa biểu ca trực theo tuần</h2>
        <div className="flex items-center gap-2">
          <p className="text-muted text-xs">
            Tuần {totalWeeks === 0 ? 0 : weekIndex + 1}/{totalWeeks}
          </p>
          <button
            type="button"
            onClick={onPrevWeek}
            disabled={weekIndex === 0}
            className="border-border rounded-md border bg-white px-2 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-40"
          >
            Trước
          </button>
          <button
            type="button"
            onClick={onNextWeek}
            disabled={weekIndex >= totalWeeks - 1 || totalWeeks === 0}
            className="border-border rounded-md border bg-white px-2 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-40"
          >
            Sau
          </button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-180 w-full border-collapse text-sm">
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
              <tr key={row.shift} className="border-border border-b align-top">
                <td className="border-border bg-amber-50 px-3 py-3 font-semibold">
                  {SHIFT_LABELS[row.shift]}
                </td>
                {row.cells.map((roomAssignments, idx) => (
                  <td
                    key={`${row.shift}-${visibleWeekDates[idx] || idx}`}
                    className="border-border min-h-30 border px-2 py-2 align-top"
                  >
                    {visibleWeekDates[idx] ? (
                      roomAssignments.length > 0 ? (
                        <div className="flex min-h-25 flex-col gap-2">
                          {roomAssignments.map((roomItem) => (
                            <button
                              key={`${row.shift}-${visibleWeekDates[idx]}-${roomItem.room}`}
                              type="button"
                              onClick={() =>
                                onSelectShift({
                                  date: visibleWeekDates[idx],
                                  shift: row.shift,
                                  room: roomItem.room,
                                  doctorIds: roomItem.doctorIds,
                                })
                              }
                              className="border-border w-full rounded-md border bg-white p-2 text-left transition hover:border-cyan-500 hover:bg-cyan-50"
                            >
                              <p className="text-xs font-semibold text-slate-700">
                                {SHIFT_LABELS[row.shift]} {roomItem.room} · {roomItem.doctorIds.length} bác sĩ
                              </p>
                              <p className="mt-1 line-clamp-2 text-xs text-slate-500">
                                {roomItem.doctorIds
                                  .slice(0, 3)
                                  .map((id) => doctorLookup.get(id)?.name ?? id)
                                  .join(", ") || "—"}
                              </p>
                            </button>
                          ))}
                        </div>
                      ) : (
                        <div className="text-xs text-slate-400">—</div>
                      )
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
                Ca trực {SHIFT_LABELS[selectedShiftDetail.shift]} — {formatWeekdayLong(selectedShiftDetail.date)} ({selectedShiftDetail.date})
              </p>
              <p className="text-muted text-xs">{selectedShiftDoctors.length} bác sĩ tham gia</p>
            </div>
            <button
              type="button"
              onClick={onCloseShiftDetail}
              className="border-border rounded-md border bg-white px-2 py-1 text-xs"
            >
              Đóng
            </button>
          </div>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {selectedShiftDoctors.map((doctor) => (
              <article
                key={`${selectedShiftDetail.date}-${selectedShiftDetail.shift}-${doctor.id}`}
                className="border-border rounded-md border p-3 text-xs"
              >
                <div className="mb-1 flex items-center justify-between gap-3">
                  <p className="font-semibold text-sm">{doctor.name}</p>
                  <p
                    className={`rounded-full px-2 py-0.5 font-semibold ${
                      doctor.experiences < 2 ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"
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
  );
}
