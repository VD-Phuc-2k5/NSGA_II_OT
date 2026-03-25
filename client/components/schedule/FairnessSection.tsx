import type { ScheduleQualityMetricsDTO } from "@/lib/schedule/types";

type Props = {
  metrics: ScheduleQualityMetricsDTO;
};

export function FairnessSection({ metrics: m }: Props) {
  return (
    <section className="glass stagger-in p-4 md:p-6">
      <h2 className="mb-1 text-lg font-bold">Chỉ số công bằng (phương án đang chọn)</h2>
      <p className="text-muted mb-3 text-sm">
        Đánh giá công bằng theo phân bổ ca <strong>tổng thể</strong> trong kỳ (Gini + JFI trên cùng
        vector; không còn ràng buộc hay trọng số riêng cho ngày lễ).
      </p>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <article className="border-border rounded-xl border bg-white p-3 md:col-span-2">
          <p className="text-muted text-xs font-semibold tracking-wide">JFI tổng thể (theo phân bổ ca)</p>
          <p className="mt-1 font-mono text-2xl font-bold text-emerald-700">
            {(m.jfi_overall ?? 0).toFixed(4)}
          </p>
        </article>
        <article className="border-border rounded-xl border bg-white p-3 md:col-span-2">
          <p className="text-muted text-xs font-semibold tracking-wide">Hệ số Gini (phân bổ ca tổng thể)</p>
          <p className="mt-1 font-mono text-2xl font-bold text-slate-800">
            {(m.gini_workload ?? 0).toFixed(4)}
          </p>
        </article>
        <article className="border-border rounded-xl border bg-white p-3">
          <p className="text-muted text-xs">JFI theo tuần (tham khảo)</p>
          <p className="mt-1 font-mono text-lg font-semibold">{(m.weekly_fairness_jain ?? 0).toFixed(4)}</p>
        </article>
        <article className="border-border rounded-xl border bg-white p-3">
          <p className="text-muted text-xs">JFI theo tháng (tham khảo)</p>
          <p className="mt-1 font-mono text-lg font-semibold">{(m.monthly_fairness_jain ?? 0).toFixed(4)}</p>
        </article>
        <article className="border-border rounded-xl border bg-white p-3">
          <p className="text-muted text-xs">Độ lệch công bằng ngày nghỉ (std)</p>
          <p className="mt-1 font-mono text-lg font-semibold">{(m.day_off_fairness_std ?? 0).toFixed(4)}</p>
        </article>
        <article className="border-border rounded-xl border bg-white p-3">
          <p className="text-muted text-xs">Jain theo ngày nghỉ</p>
          <p className="mt-1 font-mono text-lg font-semibold">{(m.day_off_fairness_jain ?? 0).toFixed(4)}</p>
        </article>
      </div>
    </section>
  );
}
