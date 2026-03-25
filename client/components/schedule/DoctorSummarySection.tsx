import type { ParetoScheduleAssignmentsDTO } from "@/lib/schedule/types";
import { useMemo } from "react";

type Props = {
  selectedParetoSchedule: ParetoScheduleAssignmentsDTO;
};

export function DoctorSummarySection({ selectedParetoSchedule }: Props) {
  const doctorRows = useMemo(() => {
    // Extract all unique dates from assignments
    const allDates = Array.from(
      new Set(selectedParetoSchedule.assignments.map((a) => a.date))
    ).sort((a, b) => a.localeCompare(b));

    // Build assigned dates per doctor
    const assignedDatesPerDoctor = new Map<string, Set<string>>();
    for (const doctor of selectedParetoSchedule.doctor_workload_balances) {
      assignedDatesPerDoctor.set(doctor.doctor_id, new Set<string>());
    }
    for (const assignment of selectedParetoSchedule.assignments) {
      for (const doctorId of assignment.doctor_ids) {
        const assigned = assignedDatesPerDoctor.get(doctorId);
        if (assigned) {
          assigned.add(assignment.date);
        }
      }
    }

    // Calculate days off per doctor
    return selectedParetoSchedule.doctor_workload_balances.map((workload, idx) => {
      const assignedDates = assignedDatesPerDoctor.get(workload.doctor_id) || new Set();
      const daysOff = allDates.filter((date) => !assignedDates.has(date));

      return {
        stt: idx + 1,
        doctor_id: workload.doctor_id,
        doctor_name: workload.doctor_name,
        monthly_shifts: workload.monthly_shift_count,
        day_off_count: workload.day_off_count,
        specific_days_off: daysOff.join(", "),
      };
    });
  }, [selectedParetoSchedule]);

  return (
    <section className="glass stagger-in p-4 md:p-6">
      <h2 className="mb-1 text-lg font-bold">Bác sĩ - Thống kê ca trực</h2>
      <p className="text-muted mb-4 text-sm">
        Danh sách toàn bộ bác sĩ với số ca trực hàng tháng, số ngày nghỉ, và danh sách các ngày nghỉ cụ thể trong phương án được chọn.
      </p>

      <div className="overflow-x-auto rounded-lg border border-border bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-slate-50">
            <tr>
              <th className="whitespace-nowrap px-3 py-2 text-left font-semibold text-slate-700">STT</th>
              <th className="whitespace-nowrap px-3 py-2 text-left font-semibold text-slate-700">Bác sĩ</th>
              <th className="whitespace-nowrap px-3 py-2 text-right font-semibold text-slate-700">Ca trực (tháng)</th>
              <th className="whitespace-nowrap px-3 py-2 text-right font-semibold text-slate-700">Ngày nghỉ</th>
              <th className="px-3 py-2 text-left font-semibold text-slate-700">Ngày nghỉ cụ thể</th>
            </tr>
          </thead>
          <tbody>
            {doctorRows.map((row) => (
              <tr key={row.doctor_id} className="border-b border-border last:border-b-0 hover:bg-slate-50">
                <td className="whitespace-nowrap px-3 py-2 text-slate-600">{row.stt}</td>
                <td className="whitespace-nowrap px-3 py-2 font-medium text-slate-900">{row.doctor_name}</td>
                <td className="whitespace-nowrap px-3 py-2 text-right font-mono font-semibold text-emerald-700">
                  {row.monthly_shifts}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-right font-mono font-semibold text-amber-700">
                  {row.day_off_count}
                </td>
                <td className="px-3 py-2 text-slate-600">
                  {row.specific_days_off ? (
                    <span className="font-mono text-xs">{row.specific_days_off}</span>
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {doctorRows.length === 0 && (
        <div className="rounded-lg border border-dashed border-border bg-slate-50 p-4 text-center text-sm text-slate-500">
          Chưa có dữ liệu bác sĩ.
        </div>
      )}
    </section>
  );
}
