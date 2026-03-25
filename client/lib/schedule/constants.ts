export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.trim() || "http://localhost:8000";

export const SHIFT_ORDER = ["morning", "afternoon"] as const;

export const SHIFT_LABELS: Record<string, string> = {
  morning: "Sáng",
  afternoon: "Chiều",
};

/**
 * Sort dates from Monday (T2) to Sunday (CN)
 * Monday=1, Tuesday=2, ..., Sunday=0 → 7
 */
export function sortDatesByWeekday(dates: string[]): string[] {
  return [...dates].sort((a, b) => {
    const dateA = new Date(a);
    const dateB = new Date(b);
    const dayA = dateA.getDay() || 7; // 0 (Sun) => 7
    const dayB = dateB.getDay() || 7;
    return dayA - dayB;
  });
}

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
