import { BadgeLabel } from "@/components/schedule/BadgeLabel";
import type {
  ScheduleJobMetricsResponseDTO,
  ScheduleJobScheduleResponseDTO,
} from "@/lib/schedule/types";

type Props = {
  scheduleData: ScheduleJobScheduleResponseDTO;
  metricsData: ScheduleJobMetricsResponseDTO;
  effectiveOptionId: string | null;
  onSelectOption: (optionId: string) => void;
};

export function ParetoOptionsSection({
  scheduleData,
  metricsData,
  effectiveOptionId,
  onSelectOption,
}: Props) {
  return (
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
              onClick={() => onSelectOption(opt.option_id)}
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
  );
}
