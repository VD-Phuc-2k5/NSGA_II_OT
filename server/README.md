# Doctor Duty Scheduling API — Tài liệu API & DTO

Backend FastAPI lập lịch ca trực bác sĩ bằng NSGA-II. OpenAPI tự sinh: **`/docs`** (Swagger), **`/redoc`**.

## Cơ bản

| Mục | Giá trị |
|-----|---------|
| Base URL (ví dụ) | `http://localhost:8000` |
| Tiền tố API | `/api/v1` |
| CORS (dev) | `http://localhost:3000` |

## Luồng gọi

1. **POST** `/api/v1/schedules/setup` — gửi dữ liệu, nhận `setup_id` (chưa chạy tối ưu).
2. **POST** `/api/v1/schedules/run` — bắt đầu job với `setup_id`.
3. **GET** `/api/v1/schedules/progress/{request_id}` — theo dõi tiến độ.
4. Khi `status` = `completed`:
   - **GET** `/api/v1/schedules/jobs/{request_id}/schedule` — lịch + Pareto.
   - **GET** `/api/v1/schedules/jobs/{request_id}/metrics` — chỉ số thuật toán + fitness.

---

## Endpoints

### `GET /health`

Kiểm tra server.

**Response:** `{ "status": "ok" }`

---

### `POST /api/v1/schedules/setup`

Lưu toàn bộ thông số và danh sách bác sĩ; **không** chạy tối ưu.

- **Body:** [`ScheduleGenerationRequestDTO`](#schedulegenerationrequestdto)
- **Response:** [`ScheduleSetupAcceptedDTO`](#schedulesetupaccepteddto)
- **Lỗi:** `400` — validation (id trùng, quá nhiều ngày nghỉ trong kỳ, …).

---

### `POST /api/v1/schedules/run`

Đưa job NSGA-II vào hàng đợi theo cấu hình đã lưu.

- **Body:** [`ScheduleRunRequestDTO`](#schedulerunrequestdto)
- **Response:** [`ScheduleRequestAcceptedDTO`](#schedulerequestaccepteddto)
- **Lỗi:** `404` — `setup_id` không tồn tại; `400` — lỗi nghiệp vụ.

---

### `GET /api/v1/schedules/progress/{request_id}`

Tiến độ job (không kèm lịch/chỉ số chi tiết).

- **Response:** [`ScheduleJobStatusDTO`](#schedulejobstatusdto)
- **Lỗi:** `404` — không có `request_id`.

---

### `GET /api/v1/schedules/jobs/{request_id}/schedule`

Lịch trực và phương án Pareto **sau khi job hoàn tất**.

- **Response:** [`ScheduleJobScheduleResponseDTO`](#schedulejobscheduleresponsedto)
- **Lỗi:** `404` — không tìm thấy; `409` — job chưa xong, thất bại, hoặc lịch chưa sẵn sàng.

---

### `GET /api/v1/schedules/jobs/{request_id}/metrics`

Chỉ số chạy thuật toán và fitness từng phương án Pareto.

- **Response:** [`ScheduleJobMetricsResponseDTO`](#schedulejobmetricsresponsedto)
- **Lỗi:** giống endpoint schedule (`404` / `409`).

---

## Ví dụ JSON — body & response

Dưới đây là **cấu trúc thật** khi gửi/nhận (kiểu `date` = chuỗi `YYYY-MM-DD`). Giá trị số/chuỗi chỉ mang tính minh họa.

### `GET /health` — response

```json
{
  "status": "ok"
}
```

### `POST /api/v1/schedules/setup` — request body

Tối thiểu **12** bác sĩ (`doctors`), `id` không trùng. Ví dụ rút gọn: 12 bản ghi cùng khuôn (đổi `id` / `name`).

```json
{
  "start_date": "2025-04-01",
  "num_days": 7,
  "max_weekly_hours_per_doctor": 48,
  "max_days_off_per_doctor": 5,
  "rooms_per_shift": 1,
  "doctors_per_room": 5,
  "shifts_per_day": 2,
  "doctors": [
    {
      "id": "BS01",
      "name": "Nguyễn Văn A",
      "experiences": 8.5,
      "department_id": "KHOA-NOI",
      "specialization": "Nội tổng quát",
      "days_off": ["2025-04-03"],
      "preferred_extra_days": ["2025-04-05"],
      "has_valid_license": true,
      "is_intern": false
    },
    {
      "id": "BS02",
      "name": "Trần Thị B",
      "experiences": 3.0,
      "department_id": "KHOA-NOI",
      "specialization": "Tim mạch",
      "days_off": [],
      "preferred_extra_days": [],
      "has_valid_license": true,
      "is_intern": false
    }
  ],
  "random_seed": 42,
  "randomization_strength": 0.08,
  "optimizer_population_size": 250,
  "optimizer_generations": 400,
  "pareto_options_limit": 6
}
```

> **Lưu ý:** JSON trên chỉ có **2** phần tử trong `doctors` để dễ đọc; khi gọi API thật cần thêm bác sĩ cho đủ **≥ 12** object cùng cấu trúc.

**Ví dụ tối giản đủ 12 bác sĩ** (có thể dùng để thử nhanh — đổi ngày/`id` theo nhu cầu):

```json
{
  "start_date": "2025-04-01",
  "num_days": 7,
  "max_weekly_hours_per_doctor": 48,
  "max_days_off_per_doctor": 5,
  "rooms_per_shift": 1,
  "doctors_per_room": 5,
  "shifts_per_day": 2,
  "doctors": [
    {"id":"BS01","name":"Bác sĩ 01","experiences":5,"department_id":"K1","specialization":"Nội","days_off":[],"preferred_extra_days":[],"has_valid_license":true,"is_intern":false},
    {"id":"BS02","name":"Bác sĩ 02","experiences":5,"department_id":"K1","specialization":"Nội","days_off":[],"preferred_extra_days":[],"has_valid_license":true,"is_intern":false},
    {"id":"BS03","name":"Bác sĩ 03","experiences":5,"department_id":"K1","specialization":"Nội","days_off":[],"preferred_extra_days":[],"has_valid_license":true,"is_intern":false},
    {"id":"BS04","name":"Bác sĩ 04","experiences":5,"department_id":"K1","specialization":"Nội","days_off":[],"preferred_extra_days":[],"has_valid_license":true,"is_intern":false},
    {"id":"BS05","name":"Bác sĩ 05","experiences":5,"department_id":"K1","specialization":"Nội","days_off":[],"preferred_extra_days":[],"has_valid_license":true,"is_intern":false},
    {"id":"BS06","name":"Bác sĩ 06","experiences":5,"department_id":"K1","specialization":"Nội","days_off":[],"preferred_extra_days":[],"has_valid_license":true,"is_intern":false},
    {"id":"BS07","name":"Bác sĩ 07","experiences":5,"department_id":"K1","specialization":"Nội","days_off":[],"preferred_extra_days":[],"has_valid_license":true,"is_intern":false},
    {"id":"BS08","name":"Bác sĩ 08","experiences":5,"department_id":"K1","specialization":"Nội","days_off":[],"preferred_extra_days":[],"has_valid_license":true,"is_intern":false},
    {"id":"BS09","name":"Bác sĩ 09","experiences":5,"department_id":"K1","specialization":"Nội","days_off":[],"preferred_extra_days":[],"has_valid_license":true,"is_intern":false},
    {"id":"BS10","name":"Bác sĩ 10","experiences":5,"department_id":"K1","specialization":"Nội","days_off":[],"preferred_extra_days":[],"has_valid_license":true,"is_intern":false},
    {"id":"BS11","name":"Bác sĩ 11","experiences":5,"department_id":"K1","specialization":"Nội","days_off":[],"preferred_extra_days":[],"has_valid_license":true,"is_intern":false},
    {"id":"BS12","name":"Bác sĩ 12","experiences":5,"department_id":"K1","specialization":"Nội","days_off":[],"preferred_extra_days":[],"has_valid_license":true,"is_intern":false}
  ],
  "random_seed": 42,
  "randomization_strength": 0.08,
  "optimizer_population_size": 250,
  "optimizer_generations": 400,
  "pareto_options_limit": 6
}
```

### `POST /api/v1/schedules/setup` — response

```json
{
  "setup_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "message": "Đã lưu cấu hình tạo lịch."
}
```

### `POST /api/v1/schedules/run` — request body

```json
{
  "setup_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

### `POST /api/v1/schedules/run` — response

```json
{
  "request_id": "req-7f91-4c2b-9e00-111111222222",
  "status": "queued",
  "progress_percent": 0,
  "message": "Job đã được đưa vào hàng đợi."
}
```

### `GET /api/v1/schedules/progress/{request_id}` — response

```json
{
  "request_id": "req-7f91-4c2b-9e00-111111222222",
  "status": "running",
  "progress_percent": 45,
  "message": "Đang tối ưu thế hệ 180/400…",
  "error": null
}
```

Khi thất bại, `status` = `"failed"`, `error` có thể là chuỗi mô tả lỗi.

### `GET /api/v1/schedules/jobs/{request_id}/schedule` — response

Cấu trúc: `selected` = lịch phương án chọn; `pareto_options` = các phương án khác (cùng dạng lịch + `doctor_workload_balances`). `assignments` trong thực tế rất dài (mọi ngày × ca × phòng). Với `shifts_per_day: 2`, giá trị `shift` thường là `"morning"` hoặc `"afternoon"` (theo `SHIFT_NAMES` trong code).

```json
{
  "request_id": "req-7f91-4c2b-9e00-111111222222",
  "selected_option_id": "opt-0",
  "selected": {
    "start_date": "2025-04-01",
    "num_days": 7,
    "rooms_per_shift": 1,
    "doctors_per_room": 5,
    "shifts_per_day": 2,
    "assignments": [
      {
        "date": "2025-04-01",
        "shift": "morning",
        "room": "P-01",
        "doctor_ids": ["BS01", "BS02", "BS03", "BS04", "BS05"]
      },
      {
        "date": "2025-04-01",
        "shift": "afternoon",
        "room": "P-01",
        "doctor_ids": ["BS06", "BS07", "BS08", "BS09", "BS10"]
      }
    ]
  },
  "pareto_options": [
    {
      "option_id": "opt-1",
      "assignments": [
        {
          "date": "2025-04-01",
          "shift": "morning",
          "room": "P-01",
          "doctor_ids": ["BS02", "BS03", "BS04", "BS05", "BS06"]
        }
      ],
      "doctor_workload_balances": [
        {
          "doctor_id": "BS01",
          "doctor_name": "Nguyễn Văn A",
          "period_shift_count": 6,
          "weekly_shift_count": 6,
          "monthly_shift_count": 6,
          "yearly_estimated_shift_count": 72,
          "holiday_shift_count": 0,
          "day_off_count": 1,
          "days_without_shift": ["2025-04-03"],
          "registered_days_off_in_period": 1,
          "registered_days_off_dates": ["2025-04-03"]
        }
      ]
    }
  ]
}
```

### `GET /api/v1/schedules/jobs/{request_id}/metrics` — response

`pareto_options` có thể có nhiều phần tử; mỗi phần tử gắn `metrics` đầy đủ như bảng [`ScheduleQualityMetricsDTO`](#schedulequalitymetricsdto).

```json
{
  "request_id": "req-7f91-4c2b-9e00-111111222222",
  "algorithm_run_metrics": {
    "elapsed_seconds": 12.34,
    "n_generations": 400,
    "population_size": 250,
    "pareto_front_size": 8,
    "best_hard_objective": 0.0,
    "best_soft_objective": 1.25,
    "best_workload_std_objective": 0.42,
    "best_fairness_objective": 0.08,
    "convergence_hard_ratio": 0.95,
    "convergence_soft_ratio": 0.72,
    "convergence_workload_ratio": 0.61,
    "convergence_fairness_ratio": 0.55
  },
  "pareto_options": [
    {
      "option_id": "opt-0",
      "metrics": {
        "hard_violation_score": 0.0,
        "soft_violation_score": 2.1,
        "fairness_std": 0.15,
        "shift_fairness_std": 0.12,
        "day_off_fairness_std": 0.09,
        "day_off_fairness_jain": 0.92,
        "weekly_fairness_jain": 0.88,
        "monthly_fairness_jain": 0.9,
        "yearly_fairness_jain": 0.87,
        "holiday_fairness_jain": 1.0,
        "f3_workload_std": 0.5,
        "f4_fairness": 0.1,
        "gini_workload": 0.08,
        "jfi_overall": 0.9,
        "hard_score_visual": 100,
        "soft_score_visual": 85,
        "workload_score_visual": 80,
        "fairness_score_visual": 82,
        "overall_score_visual": 87,
        "score_badges": {
          "hard": "Tốt",
          "soft": "Khá"
        },
        "weekly_underwork_doctors": []
      }
    }
  ]
}
```

### Lỗi validation (ví dụ `400`) — response FastAPI

```json
{
  "detail": "Danh sách bác sĩ có id trùng"
}
```

Hoặc dạng danh sách lỗi từng field (tùy phiên bản / middleware).

---

## DTO (schema chi tiết)

Các model tương ứng file `app/domain/schemas.py` (Pydantic).

### `DoctorProfileDTO`

Thông tin bác sĩ phục vụ tối ưu lịch.

| Thuộc tính | Kiểu | Ràng buộc / mặc định | Mô tả |
|------------|------|----------------------|--------|
| `id` | `string` | — | Định danh duy nhất trong danh sách |
| `name` | `string` | — | Tên hiển thị |
| `experiences` | `number` | ≥ 0 | Kinh nghiệm |
| `department_id` | `string` | — | Mã khoa |
| `specialization` | `string` | — | Chuyên khoa |
| `days_off` | `date[]` | `[]` | Ngày nghỉ đăng ký |
| `preferred_extra_days` | `date[]` | `[]` | Ngày muốn làm thêm (ưu tiên mềm) |
| `has_valid_license` | `boolean` | `true` | Giấy phép hành nghề hợp lệ (ràng buộc cứng) |
| `is_intern` | `boolean` | `false` | Thực tập — cần supervisor cùng ca |

---

### `ScheduleGenerationRequestDTO`

Payload yêu cầu sinh lịch theo chu kỳ ngày.

| Thuộc tính | Kiểu | Ràng buộc / mặc định | Mô tả |
|------------|------|----------------------|--------|
| `start_date` | `date` | — | Ngày bắt đầu kỳ |
| `num_days` | `integer` | 1–31, default 7 | Số ngày trong kỳ |
| `max_weekly_hours_per_doctor` | `integer` | 24–96, default 48 | Giờ làm tối đa/tuần/bác sĩ |
| `max_days_off_per_doctor` | `integer` | 0–14, default 5 | Ngày nghỉ tối đa trong kỳ |
| `rooms_per_shift` | `integer` | 1–10, default 1 | Số phòng mỗi ca |
| `doctors_per_room` | `integer` | 1–15, default 5 | Số bác sĩ yêu cầu mỗi phòng |
| `shifts_per_day` | `integer` | 2 (cố định 2–2) | Số ca/ngày |
| `doctors` | `DoctorProfileDTO[]` | min 12 phần tử | Danh sách bác sĩ |
| `random_seed` | `integer \| null` | `null` | Seed ngẫu nhiên |
| `randomization_strength` | `number` | 0–0.35, default 0.08 | Độ trộn ngẫu nhiên |
| `optimizer_population_size` | `integer` | 50–500, default 250 | Quần thể NSGA-II |
| `optimizer_generations` | `integer` | 50–800, default 400 | Số thế hệ |
| `pareto_options_limit` | `integer` | 2–12, default 6 | Số phương án Pareto trả về |

**Validation thêm:** `doctors[].id` không trùng; số ngày nghỉ của từng bác sĩ **trong kỳ** không vượt `max_days_off_per_doctor`.

---

### `ShiftAssignmentDTO`

Một ô phân công: một phòng trong một ca một ngày.

| Thuộc tính | Kiểu | Mô tả |
|------------|------|--------|
| `date` | `date` | Ngày |
| `shift` | `string` | Mã/tên ca |
| `room` | `string` | Mã phòng (vd. `P-01`) |
| `doctor_ids` | `string[]` | Id bác sĩ trong phòng đó |

---

### `ScheduleQualityMetricsDTO`

Chỉ số chất lượng một phương án lịch (đa mục tiêu).

| Thuộc tính | Kiểu | Mô tả |
|------------|------|--------|
| `hard_violation_score` | `number` | Điểm vi phạm ràng buộc cứng |
| `soft_violation_score` | `number` | Điểm vi phạm mềm |
| `fairness_std` | `number` | Độ lệch công bằng |
| `shift_fairness_std` | `number` | Công bằng theo ca |
| `day_off_fairness_std` | `number` | Công bằng ngày nghỉ |
| `day_off_fairness_jain` | `number` | Jain — ngày nghỉ |
| `weekly_fairness_jain` | `number` | Jain — tuần |
| `monthly_fairness_jain` | `number` | Jain — tháng |
| `yearly_fairness_jain` | `number` | Jain — năm |
| `holiday_fairness_jain` | `number` | Jain — ngày lễ |
| `f3_workload_std` | `number` | Mục tiêu f3: độ lệch workload (default 0) |
| `f4_fairness` | `number` | Mục tiêu f4: 1 − JFI tổng (default 0) |
| `gini_workload` | `number` | Hệ số Gini phân phối ca (default 0) |
| `jfi_overall` | `number` | Jain Fairness Index tổng hợp (default 1) |
| `hard_score_visual` | `integer` | Điểm hiển thị ràng buộc cứng |
| `soft_score_visual` | `integer` | Điểm hiển thị mềm |
| `workload_score_visual` | `integer` | Điểm hiển thị f3, 0–100 (default 100) |
| `fairness_score_visual` | `integer` | Điểm hiển thị công bằng |
| `overall_score_visual` | `integer` | Điểm tổng hợp UI |
| `score_badges` | `object` (map string → string) | Nhãn/badge cho UI |
| `weekly_underwork_doctors` | `string[]` | Id bác sĩ làm ít giờ/tuần (theo logic backend) |

---

### `ScheduleGenerationResultDTO`

Một kết quả lịch đầy đủ (metrics + assignments).

| Thuộc tính | Kiểu | Mô tả |
|------------|------|--------|
| `start_date` | `date` | — |
| `num_days` | `integer` | — |
| `rooms_per_shift` | `integer` | — |
| `doctors_per_room` | `integer` | — |
| `shifts_per_day` | `integer` | — |
| `metrics` | `ScheduleQualityMetricsDTO` | Chỉ số chất lượng |
| `assignments` | `ShiftAssignmentDTO[]` | Danh sách phân công |

---

### `DoctorWorkloadBalanceDTO`

Thống kê cân bằng ca theo từng bác sĩ.

| Thuộc tính | Kiểu | Mô tả |
|------------|------|--------|
| `doctor_id` | `string` | — |
| `doctor_name` | `string` | — |
| `period_shift_count` | `integer` | Tổng ca trong kỳ (theo lịch đã xếp) |
| `weekly_shift_count` | `integer` | — |
| `monthly_shift_count` | `integer` | — |
| `yearly_estimated_shift_count` | `integer` | Ước lượng theo năm |
| `holiday_shift_count` | `integer` | — |
| `day_off_count` | `integer` | Số ngày trong kỳ không có ca (theo lịch) |
| `days_without_shift` | `date[]` | Ngày trong kỳ không được xếp ca |
| `registered_days_off_in_period` | `integer` | Số ngày nghỉ đăng ký trong kỳ (default 0) |
| `registered_days_off_dates` | `date[]` | Các ngày nghỉ đăng ký |

---

### `ParetoScheduleOptionDTO`

Một phương án thuộc tập Pareto (dùng nội bộ / envelope).

| Thuộc tính | Kiểu | Mô tả |
|------------|------|--------|
| `option_id` | `string` | — |
| `metrics` | `ScheduleQualityMetricsDTO` | — |
| `assignments` | `ShiftAssignmentDTO[]` | — |
| `doctor_workload_balances` | `DoctorWorkloadBalanceDTO[]` | — |

---

### `AlgorithmRunMetricsDTO`

Chỉ số một lần chạy NSGA-II.

| Thuộc tính | Kiểu | Mô tả |
|------------|------|--------|
| `elapsed_seconds` | `number` | Thời gian chạy (giây) |
| `n_generations` | `integer` | Số thế hệ |
| `population_size` | `integer` | Kích thước quần thể |
| `pareto_front_size` | `integer` | Số nghiệm trên Pareto front |
| `best_hard_objective` | `number` | f1 tốt nhất (penalty cứng) |
| `best_soft_objective` | `number` | f2 tốt nhất (default 0) |
| `best_workload_std_objective` | `number` | f3 tốt nhất (default 0) |
| `best_fairness_objective` | `number` | f4 tốt nhất (default 0) |
| `convergence_hard_ratio` | `number \| null` | Cải thiện f1 đầu → cuối |
| `convergence_soft_ratio` | `number \| null` | Cải thiện f2 |
| `convergence_workload_ratio` | `number \| null` | Cải thiện f3 |
| `convergence_fairness_ratio` | `number \| null` | Cải thiện f4 |

---

### `ScheduleGenerationEnvelopeDTO`

Kết quả tổng hợp sau tối ưu (lưu trong job manager).

| Thuộc tính | Kiểu | Mô tả |
|------------|------|--------|
| `selected_option_id` | `string` | Phương án được chọn |
| `selected_schedule` | `ScheduleGenerationResultDTO` | Lịch + metrics phương án chọn |
| `pareto_options` | `ParetoScheduleOptionDTO[]` | Các phương án Pareto |
| `algorithm_run_metrics` | `AlgorithmRunMetricsDTO \| null` | Thống kê lần chạy thuật toán |

---

### `ScheduleSetupAcceptedDTO`

Phản hồi sau **setup**.

| Thuộc tính | Kiểu | Mô tả |
|------------|------|--------|
| `setup_id` | `string` | Dùng cho `POST /schedules/run` |
| `message` | `string` | Thông báo |

---

### `ScheduleRunRequestDTO`

Body **run**.

| Thuộc tính | Kiểu | Mô tả |
|------------|------|--------|
| `setup_id` | `string` | Mã từ `POST /schedules/setup` |

---

### `ScheduleSliceDTO`

Lịch thuần phân công (không kèm `metrics`).

| Thuộc tính | Kiểu | Mô tả |
|------------|------|--------|
| `start_date` | `date` | — |
| `num_days` | `integer` | — |
| `rooms_per_shift` | `integer` | — |
| `doctors_per_room` | `integer` | — |
| `shifts_per_day` | `integer` | — |
| `assignments` | `ShiftAssignmentDTO[]` | — |

---

### `ParetoScheduleAssignmentsDTO`

Một phương án Pareto trả về API **schedule** (lịch + cân bằng, không metrics tại đây).

| Thuộc tính | Kiểu | Mô tả |
|------------|------|--------|
| `option_id` | `string` | — |
| `assignments` | `ShiftAssignmentDTO[]` | — |
| `doctor_workload_balances` | `DoctorWorkloadBalanceDTO[]` | — |

---

### `ScheduleJobScheduleResponseDTO`

Response **GET** `.../jobs/{request_id}/schedule`.

| Thuộc tính | Kiểu | Mô tả |
|------------|------|--------|
| `request_id` | `string` | — |
| `selected_option_id` | `string` | — |
| `selected` | `ScheduleSliceDTO` | Lịch phương án chọn |
| `pareto_options` | `ParetoScheduleAssignmentsDTO[]` | Các phương án khác |

---

### `ParetoScheduleMetricsItemDTO`

Một dòng metrics trong response **metrics**.

| Thuộc tính | Kiểu | Mô tả |
|------------|------|--------|
| `option_id` | `string` | — |
| `metrics` | `ScheduleQualityMetricsDTO` | — |

---

### `ScheduleJobMetricsResponseDTO`

Response **GET** `.../jobs/{request_id}/metrics`.

| Thuộc tính | Kiểu | Mô tả |
|------------|------|--------|
| `request_id` | `string` | — |
| `algorithm_run_metrics` | `AlgorithmRunMetricsDTO \| null` | Thống kê lần chạy |
| `pareto_options` | `ParetoScheduleMetricsItemDTO[]` | Fitness/chỉ số từng phương án |

---

### `ScheduleRequestAcceptedDTO`

Phản hồi ngay sau **run** (job bất đồng bộ).

| Thuộc tính | Kiểu | Mô tả |
|------------|------|--------|
| `request_id` | `string` | Tra cứu tiến độ / kết quả |
| `status` | `"queued" \| "running" \| "completed" \| "failed"` | Trạng thái |
| `progress_percent` | `integer` | 0–100 |
| `message` | `string` | Thông báo |

---

### `ScheduleJobStatusDTO`

Response **progress** (polling).

| Thuộc tính | Kiểu | Mô tả |
|------------|------|--------|
| `request_id` | `string` | — |
| `status` | `"queued" \| "running" \| "completed" \| "failed"` | — |
| `progress_percent` | `integer` | 0–100 |
| `message` | `string` | — |
| `error` | `string \| null` | Chi tiết khi `failed` |

---

## Chạy server (tham khảo)

```bash
cd server
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Mã nguồn router: `app/api/v1/scheduling.py`. Schema: `app/domain/schemas.py`.
