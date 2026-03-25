type ShiftAverageStats = {
  actualDutySlots: number;
};

type TotalsStats = {
  totalDaysOff: number;
};

type Props = {
  shiftAverageStats: ShiftAverageStats;
  totalsStats: TotalsStats;
};

export function TotalsSummarySection({ shiftAverageStats, totalsStats }: Props) {
  return (
    <section className="glass stagger-in p-4 md:p-6">
      <h2 className="mb-3 text-lg font-bold">Tổng số liệu trong kỳ</h2>
      <div className="overflow-x-auto">
        <table className="min-w-105 w-full border-collapse text-sm">
          <thead>
            <tr className="bg-slate-100 text-left">
              <th className="border-border border px-3 py-2 font-medium text-slate-800">Chỉ số</th>
              <th className="border-border border px-3 py-2 text-right font-medium text-slate-800">Giá trị</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-border border-b bg-white">
              <td className="border-border border px-3 py-2 font-medium text-slate-700">Tổng số ca trực</td>
              <td className="border-border border px-3 py-2 text-right font-mono text-lg font-bold tabular-nums text-accent">
                {shiftAverageStats.actualDutySlots.toLocaleString("vi-VN")}
              </td>
            </tr>
            <tr className="border-border border-b bg-white">
              <td className="border-border border px-3 py-2 font-medium text-slate-700">Tổng số ngày nghỉ</td>
              <td className="border-border border px-3 py-2 text-right font-mono text-lg font-bold tabular-nums text-slate-800">
                {totalsStats.totalDaysOff.toLocaleString("vi-VN")}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}
