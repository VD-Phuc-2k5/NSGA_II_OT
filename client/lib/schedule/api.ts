import { API_BASE_URL } from "@/lib/schedule/constants";
import type {
  ScheduleJobMetricsResponseDTO,
  ScheduleJobScheduleResponseDTO,
  ScheduleJobStatusDTO,
  ScheduleRequestAcceptedDTO,
} from "@/lib/schedule/types";

export async function parseApiError(raw: string, fallback: string): Promise<string> {
  let message = raw || fallback;
  try {
    const parsed = JSON.parse(raw) as {
      detail?: string | string[] | Array<{ loc?: string[]; msg?: string }>;
    };
    if (typeof parsed.detail === "string") {
      message = parsed.detail;
    } else if (
      Array.isArray(parsed.detail) &&
      parsed.detail[0] &&
      typeof parsed.detail[0] === "object"
    ) {
      const first = parsed.detail[0] as { msg?: string };
      if (first.msg) message = first.msg;
    }
  } catch {
    // giữ message gốc nếu không parse được JSON
  }
  return message;
}

export async function fetchScheduleAndMetrics(
  requestId: string
): Promise<{ schedule: ScheduleJobScheduleResponseDTO; metrics: ScheduleJobMetricsResponseDTO }> {
  console.log("[fetchScheduleAndMetrics] Calling proxy endpoints for:", requestId);
  
  const [schRes, metRes] = await Promise.all([
    fetch(`/api/schedules/jobs/${requestId}?type=schedule`),
    fetch(`/api/schedules/jobs/${requestId}?type=metrics`),
  ]);

  if (!schRes.ok) {
    const errText = await schRes.text();
    const errMsg = await parseApiError(errText, "Không tải được lịch trực");
    console.error("[fetchScheduleAndMetrics] Schedule fetch failed:", { status: schRes.status, error: errMsg });
    throw new Error(errMsg);
  }
  if (!metRes.ok) {
    const errText = await metRes.text();
    const errMsg = await parseApiError(errText, "Không tải được chỉ số");
    console.error("[fetchScheduleAndMetrics] Metrics fetch failed:", { status: metRes.status, error: errMsg });
    throw new Error(errMsg);
  }

  const schedule = (await schRes.json()) as ScheduleJobScheduleResponseDTO;
  const metrics = (await metRes.json()) as ScheduleJobMetricsResponseDTO;
  console.log("[fetchScheduleAndMetrics] ✓ Both proxy endpoints called and succeeded");
  return { schedule, metrics };
}

export async function postRunSchedule(payload: unknown): Promise<ScheduleRequestAcceptedDTO> {
  const runRes = await fetch(`${API_BASE_URL}/api/v1/schedules/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!runRes.ok) {
    const text = await runRes.text();
    throw new Error(await parseApiError(text, "Không khởi chạy được tác vụ tạo lịch"));
  }

  return (await runRes.json()) as ScheduleRequestAcceptedDTO;
}

export async function fetchScheduleProgress(requestId: string): Promise<ScheduleJobStatusDTO> {
  const base = API_BASE_URL.replace(/\/+$/, "");
  const endpoint = `${base}/api/v1/schedules/progress/${requestId}`;
  const response = await fetch(`${endpoint}?_t=${Date.now()}`, {
    cache: "no-store",
  });
  if (!response.ok) throw new Error("Không thể đồng bộ tiến độ tác vụ");
  return (await response.json()) as ScheduleJobStatusDTO;
}
