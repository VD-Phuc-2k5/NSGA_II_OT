import { jobStatusLabel } from "@/lib/schedule/constants";
import type { RequestJob } from "@/lib/schedule/types";

type Props = {
  totalProgress: number;
  jobs: RequestJob[];
};

export function JobProgressSection({ totalProgress, jobs }: Props) {
  return (
    <section className="glass stagger-in p-4 md:p-6">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-bold">Tiến độ xử lý</h2>
        <span className="text-muted text-xs tracking-wide">Hoàn thành: {totalProgress}%</span>
      </div>
      <div className="border-border mb-3 h-3 w-full overflow-hidden rounded-full border bg-white">
        <div
          className="bg-accent h-full transition-all duration-500"
          style={{ width: `${totalProgress}%` }}
        />
      </div>
      <div className="space-y-2">
        {jobs.length === 0 ? (
          <p className="text-muted text-sm">Chưa có tác vụ nào được gửi.</p>
        ) : (
          jobs.slice(0, 5).map((job) => (
            <article key={job.request_id} className="border-border rounded-xl border bg-white p-3">
              <div className="mb-1 flex items-center justify-between gap-3">
                <p className="font-mono text-xs">{job.request_id}</p>
                <p className="text-sm font-semibold">{jobStatusLabel(job.status)}</p>
              </div>
              <div className="border-border mb-2 h-2 overflow-hidden rounded-full border bg-slate-100">
                <div
                  className="bg-accent h-full transition-all duration-500"
                  style={{ width: `${job.progress_percent}%` }}
                />
              </div>
              <p className="text-muted text-sm">{job.message}</p>
              {job.error ? <p className="mt-1 text-sm text-red-700">{job.error}</p> : null}
            </article>
          ))
        )}
      </div>
    </section>
  );
}
