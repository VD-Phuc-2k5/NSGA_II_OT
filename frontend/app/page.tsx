import Link from "next/link";

export default function HomePage() {
  return (
    <section className='panel'>
      <h1 className='title'>
        Nền tảng lập lịch trực bác sĩ với NSGA-II cải tiến
      </h1>
      <p className='lead'>
        Cấu hình ràng buộc, tối ưu đa mục tiêu, xem Pareto front và tinh chỉnh
        thủ công trên một giao diện thống nhất.
      </p>
      <div className='hero-grid'>
        <Link href='/setup' className='card-link'>
          Bước 1. Cấu hình ràng buộc
        </Link>
        <Link href='/doctors' className='card-link'>
          Bước 2. Quản lý bác sĩ
        </Link>
        <Link href='/schedule/2026-03' className='card-link'>
          Bước 3-5. Tối ưu và chỉnh lịch
        </Link>
        <Link href='/reports' className='card-link'>
          Bước 6. Báo cáo và xuất lịch
        </Link>
      </div>
    </section>
  );
}
