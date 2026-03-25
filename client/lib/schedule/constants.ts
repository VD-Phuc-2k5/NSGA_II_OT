export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.trim() || "http://localhost:8000";

export const SHIFT_ORDER = ["morning", "afternoon"] as const;

export const SHIFT_LABELS: Record<string, string> = {
  morning: "Sáng",
  afternoon: "Chiều",
};

const JOB_STATUS_VI: Record<string, string> = {
  queued: "Đang chờ",
  running: "Đang chạy",
  completed: "Hoàn tất",
  failed: "Thất bại",
};

export function jobStatusLabel(status: string): string {
  return JOB_STATUS_VI[status] ?? status;
}

export const BADGE_TEXT_VI: Record<string, string> = {
  excellent: "Xuất sắc",
  good: "Tốt",
  acceptable: "Chấp nhận được",
  fair: "Trung bình",
  warning: "Cần lưu ý",
  poor: "Yếu",
  critical: "Nghiêm trọng",
};
