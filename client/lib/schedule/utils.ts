import type { DoctorInput } from "@/lib/schedule/types";

export function parseLocalDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function toLocalDateStr(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function firstDayOfNextMonth(from: Date = new Date()): Date {
  const y = from.getFullYear();
  const m = from.getMonth();
  return new Date(y, m + 1, 1);
}

export function daysInCalendarMonth(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

export function numDaysThroughEndOfCalendarMonth(startStr: string): number {
  const start = parseLocalDate(startStr);
  const lastDay = daysInCalendarMonth(start);
  const startDay = start.getDate();
  return Math.max(1, lastDay - startDay + 1);
}

function buildPeriodDates(startDate: string, numDays: number): string[] {
  const day0 = parseLocalDate(startDate);
  return Array.from({ length: numDays }, (_, i) => {
    const d = new Date(day0);
    d.setDate(day0.getDate() + i);
    return toLocalDateStr(d);
  });
}

export function generateDoctors(
  count: number,
  startDate: string,
  numDays: number,
  maxDaysOffPerDoctor: number
): DoctorInput[] {
  const periodDates = buildPeriodDates(startDate, numDays);
  const random = (seed: number) => {
    const x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
  };

  return Array.from({ length: count }, (_, index) => {
    const id = `DOC-${(index + 1).toString().padStart(4, "0")}`;
    let experiences: number;
    if (index % 10 === 0) {
      experiences = random(index * 7.1) * 2;
    } else if (index % 7 === 0) {
      experiences = 2 + random(index * 11.2) * 3;
    } else if (index % 5 === 0) {
      experiences = 5 + random(index * 13.3) * 5;
    } else {
      experiences = 10 + random(index * 17.4) * 20;
    }
    experiences = Math.round(experiences * 2) / 2;

    const hasDaysOff = random(index * 7.3) < 0.4;
    const requestedDaysOffCount = hasDaysOff
      ? Math.min(
          maxDaysOffPerDoctor,
          Math.max(1, Math.floor(random(index * 11.5) * maxDaysOffPerDoctor))
        )
      : 0;

    const daysOffSet = new Set<string>();
    if (requestedDaysOffCount > 0) {
      const step = Math.max(1, Math.floor(numDays / requestedDaysOffCount));
      for (let k = 0; k < requestedDaysOffCount; k++) {
        const dateIndex =
          (index * 13 + k * step + Math.floor(random(index * 17 + k) * step)) % numDays;
        daysOffSet.add(periodDates[dateIndex]);
      }
    }

    const wantsExtra = random(index * 19.2) < 0.3;
    const preferredSet = new Set<string>();
    if (wantsExtra) {
      const maxPreferred = Math.min(3, Math.floor(random(index * 23.7) * 3) + 1);
      for (let k = 0; preferredSet.size < maxPreferred && k < numDays * 2; k++) {
        const dateIndex = Math.floor(random(index * 29.1 + k * 31.3) * numDays);
        const candidate = periodDates[dateIndex];
        if (!daysOffSet.has(candidate)) {
          preferredSet.add(candidate);
        }
      }
    }

    const specializations = [
      "Nội tổng quát", "Ngoại tổng quát", "Nhi khoa", "Sản phụ khoa",
      "Cấp cứu", "Hồi sức tích cực", "Chấn thương chỉnh hình", "Tai mũi họng",
      "Mắt", "Răng hàm mặt", "Da liễu", "Tâm thần", "Lão khoa"
    ];
    const specialization = specializations[index % specializations.length];

    const deptMap: Record<string, string> = {
      "Nội tổng quát": "NỘI-01",
      "Ngoại tổng quát": "NGOẠI-01",
      "Nhi khoa": "NHI-01",
      "Sản phụ khoa": "SẢN-01",
      "Cấp cứu": "CẤP CỨU-01",
      "Hồi sức tích cực": "HSTC-01",
      "Chấn thương chỉnh hình": "CTCH-01",
      "Tai mũi họng": "TMH-01",
      "Mắt": "MẮT-01",
      "Răng hàm mặt": "RHM-01",
      "Da liễu": "DA-01",
      "Tâm thần": "TÂM THẦN-01",
      "Lão khoa": "LÃO-01"
    };

    return {
      id,
      name: `Bác sĩ ${["Nguyễn", "Trần", "Lê", "Phạm", "Hoàng", "Vũ", "Đặng", "Bùi", "Đỗ", "Hồ"][index % 10]} ${
        ["Văn", "Thị", "Hữu", "Minh", "Thanh", "Thu", "Hà", "Lan", "Hùng", "Cường"][index % 10]
      }`,
      experiences,
      department_id: deptMap[specialization] ?? `KHOA-${((index % 10) + 1).toString().padStart(2, "0")}`,
      specialization,
      days_off: Array.from(daysOffSet).sort(),
      preferred_extra_days: Array.from(preferredSet).sort(),
      has_valid_license: experiences >= 1 || random(index * 41.5) > 0.1,
      is_intern: experiences < 2
    };
  });
}

export function sanitizeInt(
  input: string,
  min: number,
  max: number,
  fallback: number
): number {
  const parsed = Number.parseInt(input, 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, parsed));
}

export function formatWeekdayLong(dateStr: string): string {
  const day = parseLocalDate(dateStr).getDay();
  if (day === 0) return "Chủ nhật";
  return `Thứ ${day + 1}`;
}

export function formatElapsedHhMmSs(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return [h, m, sec].map((n) => String(n).padStart(2, "0")).join(":");
}
