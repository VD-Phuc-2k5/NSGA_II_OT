import { formatElapsedHhMmSs } from "@/lib/schedule/utils";
import type { AlgorithmRunMetricsDTO } from "@/lib/schedule/types";

type Props = {
  runMetrics: AlgorithmRunMetricsDTO;
};

export function RunMetricsSection({ runMetrics }: Props) {
  return (
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
  );
}
