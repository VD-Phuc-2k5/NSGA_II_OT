type ShiftAverageStats = {
  theoreticalAvg: number;
  actualAvg: number;
  totalDutySlots: number;
  actualDutySlots: number;
  totalShiftSlots: number;
  actualSum: number;
  n: number;
  minCa: number;
  maxCa: number;
};

type Props = {
  stats: ShiftAverageStats;
};

export function ShiftAverageSection({ stats }: Props) {
  return (
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
            {stats.theoreticalAvg.toLocaleString("vi-VN", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </p>
          <p className="text-muted mt-2 text-xs">
            Tổng ô phân công: <span className="font-mono font-semibold text-slate-700">{stats.totalShiftSlots}</span>{" "}
            ca · {stats.n} bác sĩ
          </p>
        </article>
        <article className="border-border rounded-xl border bg-white p-5">
          <p className="text-muted text-sm font-medium">Trung bình thực tế (ca / bác sĩ)</p>
          <p className="mt-2 font-mono text-3xl font-bold tabular-nums text-cyan-800">
            {stats.actualAvg.toLocaleString("vi-VN", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </p>
          <p className="text-muted mt-2 text-xs">
            Tổng ca đã gán (trong danh sách):{" "}
            <span className="font-mono font-semibold text-slate-700">{stats.actualSum}</span>
            {stats.actualSum !== stats.totalShiftSlots ? (
              <span className="ml-1 text-amber-700">(khác tổng ô — có thể do ca trống hoặc mã bác sĩ ngoài danh sách)</span>
            ) : null}
          </p>
        </article>
      </div>
      <div className="border-border mt-4 rounded-xl border bg-slate-50 p-4 text-sm text-slate-700">
        <span className="font-medium">Phân tán thực tế:</span> ít nhất{" "}
        <span className="font-mono font-semibold">{stats.minCa}</span> ca, nhiều nhất{" "}
        <span className="font-mono font-semibold">{stats.maxCa}</span> ca / bác sĩ (phương án đang xem).
      </div>
    </section>
  );
}
