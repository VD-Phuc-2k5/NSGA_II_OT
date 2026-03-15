"use client";

import { useEffect, useMemo, useState } from "react";

import {
  getDoctors,
  importDoctorsExcel,
  saveDoctors,
  seedSampleData
} from "@/lib/api";
import type { Doctor } from "@/lib/types";

const emptyDoctor: Doctor = {
  id: "",
  full_name: "",
  title: "BS",
  specialty: "general",
  seniority_score: 1,
  flags: {
    pregnant: false,
    senior: false,
    part_time: false,
    difficult_circumstances: false
  },
  preferences: {},
  fixed_locked_slots: [],
  historical_night_count_12m: 0,
  historical_holiday_count_12m: 0
};

export default function DoctorsPage() {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [form, setForm] = useState<Doctor>(emptyDoctor);
  const [csvText, setCsvText] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => {
    getDoctors()
      .then(setDoctors)
      .catch((err: Error) => setStatus(err.message));
  }, []);

  const previewAvailability = useMemo(() => {
    const slots = ["01:HC", "01:TR", "01:NIGHT", "02:HC", "02:TR", "02:NIGHT"];
    return doctors.map((d) => {
      const locked = new Set(d.fixed_locked_slots);
      const blockedNight = d.flags.pregnant || d.flags.part_time;
      const values = slots.map((s) => {
        if (locked.has(s)) return "1";
        if (blockedNight && s.endsWith("NIGHT")) return "0";
        return "1";
      });
      return { name: d.full_name, values };
    });
  }, [doctors]);

  function addDoctor() {
    if (!form.id || !form.full_name) {
      setStatus("Cần nhập id và tên bác sĩ");
      return;
    }
    setDoctors((prev) => [...prev, form]);
    setForm(emptyDoctor);
    setStatus("Đã thêm bác sĩ vào danh sách tạm");
  }

  function importCsv() {
    const lines = csvText
      .split(/\r?\n/)
      .map((v) => v.trim())
      .filter(Boolean);
    if (lines.length <= 1) {
      setStatus("CSV không đủ dữ liệu");
      return;
    }

    const parsed: Doctor[] = [];
    for (let i = 1; i < lines.length; i += 1) {
      const fields = lines[i].split(",").map((f) => f.trim());
      const [
        id,
        full_name,
        title,
        specialty,
        seniority_score,
        pregnant,
        senior,
        part_time,
        difficult
      ] = fields;

      if (!id || !full_name) continue; // Skip invalid rows

      parsed.push({
        ...emptyDoctor,
        id,
        full_name,
        title: title || "BS",
        specialty: specialty || "general",
        seniority_score: Number(seniority_score || 1),
        flags: {
          pregnant: pregnant === "1" || pregnant?.toLowerCase() === "true",
          senior: senior === "1" || senior?.toLowerCase() === "true",
          part_time: part_time === "1" || part_time?.toLowerCase() === "true",
          difficult_circumstances:
            difficult === "1" || difficult?.toLowerCase() === "true"
        }
      });
    }

    if (parsed.length === 0) {
      setStatus("Không tìm thấy bác sĩ nào trong CSV");
      return;
    }

    setDoctors((prev) => [...prev, ...parsed]);
    setStatus(`Đã import ${parsed.length} bác sĩ`);
  }

  return (
    <section className='panel'>
      <h1 className='title'>Bước 2 - Quản lý bác sĩ</h1>
      <p className='small'>
        ✔ Cách 1: Nhập tay từng bác sĩ | ✔ Cách 2: Import từ file CSV/Excel
      </p>

      {status && (
        <p
          style={{
            color:
              status.includes("lỗi") || status.includes("khong")
                ? "#d94f2b"
                : "#177b63",
            padding: "8px 12px",
            borderRadius: "8px",
            backgroundColor:
              status.includes("lỗi") || status.includes("khong")
                ? "rgba(217,79,43,0.1)"
                : "rgba(23,123,99,0.1)",
            marginBottom: "16px"
          }}>
          {status}
        </p>
      )}

      <div style={{ marginBottom: "16px" }}>
        <button
          className='btn'
          onClick={async () => {
            try {
              const result = await seedSampleData();
              const list = await getDoctors();
              setDoctors(list);
              setStatus(
                `✓ Đã load ${result.count} bác sĩ mẫu! Click "Lưu backend" để lưu.`
              );
            } catch (err) {
              setStatus(`Lỗi: ${(err as Error).message}`);
            }
          }}>
          ⚡ Load sample doctors (15 người)
        </button>
      </div>

      <div className='grid-2' style={{ marginTop: 12 }}>
        <div>
          <h3>Nhập thủ công</h3>
          <label>ID</label>
          <input
            className='input'
            value={form.id}
            onChange={(e) => setForm({ ...form, id: e.target.value })}
          />
          <label>Họ tên</label>
          <input
            className='input'
            value={form.full_name}
            onChange={(e) => setForm({ ...form, full_name: e.target.value })}
          />
          <label>Chức danh</label>
          <input
            className='input'
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />
          <label>Chuyên khoa</label>
          <input
            className='input'
            value={form.specialty}
            onChange={(e) => setForm({ ...form, specialty: e.target.value })}
          />
          <label>Điểm seniority</label>
          <input
            className='input'
            type='number'
            value={form.seniority_score}
            onChange={(e) =>
              setForm({ ...form, seniority_score: Number(e.target.value) })
            }
          />

          <label>
            <input
              type='checkbox'
              checked={form.flags.pregnant}
              onChange={(e) =>
                setForm({
                  ...form,
                  flags: { ...form.flags, pregnant: e.target.checked }
                })
              }
            />{" "}
            Mang thai
          </label>
          <label>
            <input
              type='checkbox'
              checked={form.flags.senior}
              onChange={(e) =>
                setForm({
                  ...form,
                  flags: { ...form.flags, senior: e.target.checked }
                })
              }
            />{" "}
            Lớn tuổi
          </label>
          <label>
            <input
              type='checkbox'
              checked={form.flags.part_time}
              onChange={(e) =>
                setForm({
                  ...form,
                  flags: { ...form.flags, part_time: e.target.checked }
                })
              }
            />{" "}
            Bán thời gian
          </label>
          <label>
            <input
              type='checkbox'
              checked={form.flags.difficult_circumstances}
              onChange={(e) =>
                setForm({
                  ...form,
                  flags: {
                    ...form.flags,
                    difficult_circumstances: e.target.checked
                  }
                })
              }
            />{" "}
            Hoàn cảnh khó khăn
          </label>

          <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
            <button className='btn secondary' onClick={addDoctor}>
              Thêm vào danh sách
            </button>
          </div>
        </div>

        <div>
          <h3>Import CSV / Excel</h3>
          <p className='small'>
            CSV format:
            id,full_name,title,specialty,seniority_score,pregnant,senior,part_time
          </p>
          <textarea
            rows={6}
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
            placeholder='id,full_name,title,specialty,seniority_score,pregnant,senior,part_time'
          />
          <div
            style={{
              marginTop: 10,
              display: "flex",
              gap: 8,
              flexWrap: "wrap"
            }}>
            <button className='btn secondary' onClick={importCsv}>
              Import CSV text
            </button>
            <label
              className='btn secondary'
              style={{ display: "inline-flex", alignItems: "center" }}>
              Import Excel
              <input
                type='file'
                accept='.xlsx,.xls'
                style={{ display: "none" }}
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  try {
                    const count = await importDoctorsExcel(file);
                    const list = await getDoctors();
                    setDoctors(list);
                    setStatus(`Đã import Excel ${count} bác sĩ`);
                  } catch (err) {
                    setStatus((err as Error).message);
                  }
                }}
              />
            </label>
            <button
              className='btn'
              onClick={async () => {
                try {
                  await saveDoctors(doctors);
                  setStatus("Đã lưu danh sách bác sĩ");
                } catch (err) {
                  setStatus((err as Error).message);
                }
              }}>
              Lưu backend
            </button>
          </div>
        </div>
      </div>

      <h3>Danh sách hiện tại</h3>
      <table className='table'>
        <thead>
          <tr>
            <th>ID</th>
            <th>Tên</th>
            <th>Chuyên khoa</th>
            <th>Flag</th>
          </tr>
        </thead>
        <tbody>
          {doctors.map((d) => (
            <tr key={d.id}>
              <td>{d.id}</td>
              <td>{d.full_name}</td>
              <td>{d.specialty}</td>
              <td>
                {d.flags.pregnant ? (
                  <span className='badge'>Pregnant</span>
                ) : null}{" "}
                {d.flags.senior ? <span className='badge'>Senior</span> : null}{" "}
                {d.flags.part_time ? (
                  <span className='badge'>Part-time</span>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3>Availability matrix preview (2 ngày đầu)</h3>
      <table className='table'>
        <thead>
          <tr>
            <th>Bác sĩ</th>
            <th>01:HC</th>
            <th>01:TR</th>
            <th>01:NIGHT</th>
            <th>02:HC</th>
            <th>02:TR</th>
            <th>02:NIGHT</th>
          </tr>
        </thead>
        <tbody>
          {previewAvailability.map((r) => (
            <tr key={r.name}>
              <td>{r.name}</td>
              {r.values.map((v, idx) => (
                <td key={idx}>{v}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      {status ? <p className='small'>{status}</p> : null}
    </section>
  );
}
