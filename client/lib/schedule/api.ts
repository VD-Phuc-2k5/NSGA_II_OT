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
  const [schRes, metRes] = await Promise.all([
    fetch(`${API_BASE_URL}/api/v1/schedules/jobs/${requestId}/schedule`),
    fetch(`${API_BASE_URL}/api/v1/schedules/jobs/${requestId}/metrics`),
  ]);

  if (!schRes.ok) {
    throw new Error(await parseApiError(await schRes.text(), "Không tải được lịch trực"));
  }
  if (!metRes.ok) {
    throw new Error(await parseApiError(await metRes.text(), "Không tải được chỉ số"));
  }

  const schedule = (await schRes.json()) as ScheduleJobScheduleResponseDTO;
  const metrics = (await metRes.json()) as ScheduleJobMetricsResponseDTO;
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
  const response = await fetch(`${API_BASE_URL}/api/v1/schedules/progress/${requestId}`);
  if (!response.ok) throw new Error("Không thể đồng bộ tiến độ tác vụ");
  return (await response.json()) as ScheduleJobStatusDTO;
}
