type Props = {
  startDate: string;
  monthSpanDays: number;
  numDoctorsInput: string;
  roomsPerShiftInput: string;
  doctorsPerRoomInput: string;
  maxWeeklyHoursInput: string;
  maxDaysOffInput: string;
  doctorsCount: number;
  onStartDateChange: (value: string) => void;
  onNumDoctorsChange: (value: string) => void;
  onRoomsPerShiftChange: (value: string) => void;
  onDoctorsPerRoomChange: (value: string) => void;
  onMaxWeeklyHoursChange: (value: string) => void;
  onMaxDaysOffChange: (value: string) => void;
  onRegenerateDoctors: () => void;
  onRunSchedule: () => void;
};

export function ScheduleControlSection({
  startDate,
  monthSpanDays,
  numDoctorsInput,
  roomsPerShiftInput,
  doctorsPerRoomInput,
  maxWeeklyHoursInput,
  maxDaysOffInput,
  doctorsCount,
  onStartDateChange,
  onNumDoctorsChange,
  onRoomsPerShiftChange,
  onDoctorsPerRoomChange,
  onMaxWeeklyHoursChange,
  onMaxDaysOffChange,
  onRegenerateDoctors,
  onRunSchedule,
}: Props) {
  return (
    <section className="glass stagger-in overflow-hidden p-6 md:p-8">
      <div className="mb-4 flex flex-col gap-2">
        <p className="text-accent text-sm font-semibold uppercase tracking-[0.16em]">
          Tối ưu NSGA-II · Lập lịch trực
        </p>
        <h1 className="text-2xl font-extrabold leading-tight md:text-4xl">
          Lịch trực ngoại trú theo tháng
        </h1>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <label className="flex flex-col gap-2 text-sm">
          Ngày bắt đầu lập lịch
          <input
            type="date"
            value={startDate}
            onChange={(e) => onStartDateChange(e.target.value)}
            className="border-border rounded-xl border bg-white px-3 py-2"
          />
        </label>
        <div className="flex flex-col gap-2 text-sm">
          <span>Độ dài kỳ lập lịch</span>
          <div className="border-border rounded-xl border bg-slate-50 px-3 py-2 text-slate-800">
            {monthSpanDays}
          </div>
        </div>
        <label className="flex flex-col gap-2 text-sm">
          Số bác sĩ
          <input
            type="number"
            min={12}
            max={400}
            value={numDoctorsInput}
            onChange={(e) => onNumDoctorsChange(e.target.value)}
            className="border-border rounded-xl border bg-white px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-2 text-sm">
          Số phòng / ca
          <input
            type="number"
            min={1}
            max={10}
            value={roomsPerShiftInput}
            onChange={(e) => onRoomsPerShiftChange(e.target.value)}
            className="border-border rounded-xl border bg-white px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-2 text-sm">
          Bác sĩ / phòng
          <input
            type="number"
            min={1}
            max={15}
            value={doctorsPerRoomInput}
            onChange={(e) => onDoctorsPerRoomChange(e.target.value)}
            className="border-border rounded-xl border bg-white px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-2 text-sm">
          Giờ làm tối đa / tuần
          <input
            type="number"
            min={24}
            max={96}
            value={maxWeeklyHoursInput}
            onChange={(e) => onMaxWeeklyHoursChange(e.target.value)}
            className="border-border rounded-xl border bg-white px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-2 text-sm">
          Số ngày nghỉ tối đa
          <input
            type="number"
            min={0}
            max={14}
            value={maxDaysOffInput}
            onChange={(e) => onMaxDaysOffChange(e.target.value)}
            className="border-border rounded-xl border bg-white px-3 py-2"
          />
        </label>
      </div>

      <div className="mt-3 flex flex-col flex-wrap justify-end gap-2 text-sm md:flex-row md:items-center">
        <button
          type="button"
          onClick={onRegenerateDoctors}
          className="border-accent text-accent rounded-xl border px-4 py-2 font-semibold transition hover:bg-teal-50"
        >
          Tạo lại dữ liệu bác sĩ
        </button>
        <button
          type="button"
          onClick={onRunSchedule}
          className="bg-accent rounded-xl px-4 py-2 font-semibold text-white transition hover:bg-teal-800"
        >
          Chạy tối ưu và tạo lịch
        </button>
      </div>
      <p className="text-muted mt-2 text-xs">
        Đang có <strong>{doctorsCount}</strong> bác sĩ trong bộ dữ liệu gửi lên.
      </p>
    </section>
  );
}
