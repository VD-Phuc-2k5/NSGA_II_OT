"use client";

import { useMemo, useState } from "react";

import { getReports, reportsExcelUrl, reportsPdfUrl } from "@/lib/api";
import type { ReportRow } from "@/lib/types";

export default function ReportsPage() {
  const [month, setMonth] = useState("2026-03");
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [status, setStatus] = useState("Nhấn tải báo cáo để xem thống kê");

  const maxHours = useMemo(
    () => Math.max(1, ...rows.map((r) => r.total_hours)),
    [rows]
  );

  return (
    <section className='panel'>
      <h1 className='title'>Bước 6 - Báo cáo và xuất lịch</h1>
      <p className='small'>
        Thống kê tổng ca, giờ, đêm, lễ theo tháng phục vụ lịch sử F25/F26 cho
        tháng tiếp theo.
      </p>

      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        <input
          className='input'
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          placeholder='YYYY-MM'
        />
        <button
          className='btn'
          onClick={async () => {
            try {
              const data = await getReports(month);
              setRows(data);
              setStatus(`Đã tải ${data.length} bản ghi`);
            } catch (err) {
              setStatus((err as Error).message);
            }
          }}>
          Tải báo cáo
        </button>
      </div>

      <p className='small'>{status}</p>

      <div className='panel' style={{ marginTop: 10, padding: 12 }}>
        <h3>Biểu đồ giờ trực</h3>
        <div style={{ display: "grid", gap: 8 }}>
          {rows.map((r) => (
            <div key={r.doctor_id}>
              <div className='small'>
                {r.doctor_name} ({r.total_hours}h)
              </div>
              <div
                style={{ height: 12, background: "#ecd9c2", borderRadius: 99 }}>
                <div
                  style={{
                    height: 12,
                    width: `${(r.total_hours / maxHours) * 100}%`,
                    borderRadius: 99,
                    background: "#d94f2b"
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <table className='table' style={{ marginTop: 10 }}>
        <thead>
          <tr>
            <th>Bác sĩ</th>
            <th>Tổng ca</th>
            <th>Tổng giờ</th>
            <th>Ca đêm</th>
            <th>Ca lễ</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.doctor_id}>
              <td>{r.doctor_name}</td>
              <td>{r.total_shifts}</td>
              <td>{r.total_hours}</td>
              <td>{r.night_shifts}</td>
              <td>{r.holiday_shifts}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        <button
          className='btn secondary'
          onClick={() => {
            window.open(reportsPdfUrl(month), "_blank", "noopener,noreferrer");
            setStatus("Đang tải file PDF");
          }}>
          Xuất PDF
        </button>
        <button
          className='btn secondary'
          onClick={() => {
            window.open(reportsExcelUrl(month), "_blank", "noopener,noreferrer");
            setStatus("Đang tải file Excel");
          }}>
          Xuất Excel
        </button>
      </div>
    </section>
  );
}
