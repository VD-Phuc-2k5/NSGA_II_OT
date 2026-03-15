"use client";

import { useEffect, useState } from "react";

import { getSetup, saveSetup } from "@/lib/api";
import type { ConstraintsConfig } from "@/lib/types";

export default function SetupPage() {
  const [config, setConfig] = useState<ConstraintsConfig | null>(null);
  const [status, setStatus] = useState<string>("");

  useEffect(() => {
    getSetup()
      .then(setConfig)
      .catch((err: Error) => setStatus(err.message));
  }, []);

  if (!config) {
    return <section className='panel'>Dang tai cau hinh...</section>;
  }

  return (
    <section className='panel'>
      <h1 className='title'>Bước 1 - Cấu hình ràng buộc</h1>
      <p className='small'>
        6 nhóm A-F được tách thành accordion như bảng đặc tả.
      </p>

      <details open>
        <summary>
          <strong>A. General</strong>
        </summary>
        <label>Tên cấu hình</label>
        <input
          className='input'
          value={config.group_a_label}
          onChange={(e) =>
            setConfig({ ...config, group_a_label: e.target.value })
          }
        />
      </details>

      <details>
        <summary>
          <strong>B. Thời gian và số ca</strong>
        </summary>
        <label>Giới hạn giờ/tuần mặc định</label>
        <input
          className='input'
          type='number'
          value={config.group_b.max_hours_per_week}
          onChange={(e) =>
            setConfig({
              ...config,
              group_b: {
                ...config.group_b,
                max_hours_per_week: Number(e.target.value)
              }
            })
          }
        />

        <label>Nghỉ tối thiểu sau ca đêm (giờ)</label>
        <input
          className='input'
          type='number'
          value={config.group_b.min_rest_hours_after_night}
          onChange={(e) =>
            setConfig({
              ...config,
              group_b: {
                ...config.group_b,
                min_rest_hours_after_night: Number(e.target.value)
              }
            })
          }
        />

        <label>
          <input
            type='checkbox'
            checked={config.group_b.allow_two_consecutive_nights}
            onChange={(e) =>
              setConfig({
                ...config,
                group_b: {
                  ...config.group_b,
                  allow_two_consecutive_nights: e.target.checked
                }
              })
            }
          />
          Cho phép trực 2 đêm liên tiếp
        </label>
      </details>

      <details>
        <summary>
          <strong>C. Chuyên môn</strong>
        </summary>
        <label>Hạng bệnh viện</label>
        <select
          className='select'
          value={config.group_c.hospital_tier}
          onChange={(e) =>
            setConfig({
              ...config,
              group_c: {
                ...config.group_c,
                hospital_tier: e.target
                  .value as ConstraintsConfig["group_c"]["hospital_tier"]
              }
            })
          }>
          <option value='district'>Huyện</option>
          <option value='provincial'>Tỉnh</option>
          <option value='central'>Trung ương</option>
        </select>

        <label>Số bác sĩ tối thiểu mỗi ca</label>
        <input
          className='input'
          type='number'
          min='1'
          max='20'
          value={config.group_c.min_doctors_per_shift?.day ?? 2}
          onChange={(e) =>
            setConfig({
              ...config,
              group_c: {
                ...config.group_c,
                min_doctors_per_shift: {
                  day: Number(e.target.value),
                  night: Number(e.target.value)
                }
              }
            })
          }
        />
      </details>

      <details>
        <summary>
          <strong>D. Đối tượng đặc biệt</strong>
        </summary>
        <label>
          <input
            type='checkbox'
            checked={config.group_d.protect_pregnant}
            onChange={(e) =>
              setConfig({
                ...config,
                group_d: {
                  ...config.group_d,
                  protect_pregnant: e.target.checked
                }
              })
            }
          />{" "}
          Bảo vệ bác sĩ mang thai
        </label>
        <label>
          <input
            type='checkbox'
            checked={config.group_d.protect_senior}
            onChange={(e) =>
              setConfig({
                ...config,
                group_d: { ...config.group_d, protect_senior: e.target.checked }
              })
            }
          />{" "}
          Bảo vệ bác sĩ lớn tuổi
        </label>
        <label>
          <input
            type='checkbox'
            checked={config.group_d.protect_part_time}
            onChange={(e) =>
              setConfig({
                ...config,
                group_d: {
                  ...config.group_d,
                  protect_part_time: e.target.checked
                }
              })
            }
          />{" "}
          Bảo vệ bác sĩ bán thời gian
        </label>
      </details>

      <details>
        <summary>
          <strong>E. Ràng buộc mềm - ưu tiên vận hành</strong>
        </summary>
        <label>Cân bằng số ca: {config.group_e.balance_load.toFixed(1)}</label>
        <input
          type='range'
          min={0}
          max={5}
          step={0.1}
          value={config.group_e.balance_load}
          onChange={(e) =>
            setConfig({
              ...config,
              group_e: {
                ...config.group_e,
                balance_load: Number(e.target.value)
              }
            })
          }
        />

        <label>
          Thỏa mãn nguyện vọng: {config.group_e.preference.toFixed(1)}
        </label>
        <input
          type='range'
          min={0}
          max={5}
          step={0.1}
          value={config.group_e.preference}
          onChange={(e) =>
            setConfig({
              ...config,
              group_e: { ...config.group_e, preference: Number(e.target.value) }
            })
          }
        />

        <label>
          Công bằng lịch sử: {config.group_e.historical_fairness.toFixed(1)}
        </label>
        <input
          type='range'
          min={0}
          max={5}
          step={0.1}
          value={config.group_e.historical_fairness}
          onChange={(e) =>
            setConfig({
              ...config,
              group_e: {
                ...config.group_e,
                historical_fairness: Number(e.target.value)
              }
            })
          }
        />
      </details>

      <details>
        <summary>
          <strong>F. Ràng buộc mềm - chính sách dài hạn</strong>
        </summary>
        <label>Cân bằng số ca: {config.group_f.balance_load.toFixed(1)}</label>
        <input
          type='range'
          min={0}
          max={5}
          step={0.1}
          value={config.group_f.balance_load}
          onChange={(e) =>
            setConfig({
              ...config,
              group_f: {
                ...config.group_f,
                balance_load: Number(e.target.value)
              }
            })
          }
        />

        <label>
          Thỏa mãn nguyện vọng: {config.group_f.preference.toFixed(1)}
        </label>
        <input
          type='range'
          min={0}
          max={5}
          step={0.1}
          value={config.group_f.preference}
          onChange={(e) =>
            setConfig({
              ...config,
              group_f: { ...config.group_f, preference: Number(e.target.value) }
            })
          }
        />

        <label>
          Công bằng lịch sử: {config.group_f.historical_fairness.toFixed(1)}
        </label>
        <input
          type='range'
          min={0}
          max={5}
          step={0.1}
          value={config.group_f.historical_fairness}
          onChange={(e) =>
            setConfig({
              ...config,
              group_f: {
                ...config.group_f,
                historical_fairness: Number(e.target.value)
              }
            })
          }
        />
      </details>

      <div style={{ marginTop: 16, display: "flex", gap: 8 }}>
        <button
          className='btn'
          onClick={async () => {
            setStatus("Dang luu...");
            try {
              await saveSetup(config);
              setStatus("Da luu cau hinh thanh cong");
            } catch (err) {
              setStatus((err as Error).message);
            }
          }}>
          Lưu cấu hình
        </button>
      </div>

      {status ? <p className='small'>{status}</p> : null}
    </section>
  );
}
