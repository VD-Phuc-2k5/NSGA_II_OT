# Doctor Duty Scheduling API

Backend FastAPI cho bài toán lập lịch ca trực bác sĩ bằng NSGA-II cải tiến.

## Base URL

- Local: http://localhost:8000
- Prefix: /api/v1

## Flow API

1. POST /api/v1/schedules/run
2. GET /api/v1/schedules/progress/{request_id}
3. GET /api/v1/schedules/jobs/{request_id}/schedule
4. GET /api/v1/schedules/jobs/{request_id}/metrics

## POST /api/v1/schedules/run

Endpoint submit duy nhất để chạy tối ưu.

Request body (dữ liệu nghiệp vụ và ràng buộc lịch vẫn gửi từ client):

```json
{
  "start_date": "2025-04-01",
  "num_days": 7,
  "max_weekly_hours_per_doctor": 48,
  "max_days_off_per_doctor": 5,
  "rooms_per_shift": 2,
  "doctors_per_room": 6,
  "shifts_per_day": 2,
  "doctors": [
    {
      "id": "BS01",
      "name": "Nguyen Van A",
      "experiences": 8,
      "department_id": "KHOA-01",
      "specialization": "Noi tong quat",
      "days_off": ["2025-04-03"],
      "preferred_extra_days": [],
      "has_valid_license": true,
      "is_intern": false
    }
  ]
}
```

Response:

```json
{
  "request_id": "4d41ecf5-bcf4-4a16-b8d6-2a5cc4f2f8df",
  "status": "queued",
  "progress_percent": 0,
  "message": "Yeu cau da duoc dua vao hang doi"
}
```

## GET /api/v1/schedules/progress/{request_id}

Theo doi tien do xu ly job.

Response (dang chay):

```json
{
  "request_id": "4d41ecf5-bcf4-4a16-b8d6-2a5cc4f2f8df",
  "status": "running",
  "progress_percent": 37,
  "message": "Dang toi uu bang NSGA-II cai tien (the he 148/400)",
  "error": null
}
```

Response (hoan tat):

```json
{
  "request_id": "4d41ecf5-bcf4-4a16-b8d6-2a5cc4f2f8df",
  "status": "completed",
  "progress_percent": 100,
  "message": "Hoan tat sinh lich truc",
  "error": null
}
```

## GET /api/v1/schedules/jobs/{request_id}/schedule

Lay lich truc va danh sach phuong an Pareto sau khi job hoan tat.

Response:

```json
{
  "request_id": "4d41ecf5-bcf4-4a16-b8d6-2a5cc4f2f8df",
  "selected_option_id": "opt-1",
  "selected": {
    "start_date": "2025-04-01",
    "num_days": 7,
    "rooms_per_shift": 2,
    "doctors_per_room": 6,
    "shifts_per_day": 2,
    "assignments": [
      {
        "date": "2025-04-01",
        "shift": "morning",
        "room": "P-01",
        "doctor_ids": ["BS01", "BS02", "BS03", "BS04", "BS05", "BS06"]
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
          "doctor_ids": ["BS01", "BS02", "BS03", "BS04", "BS05", "BS06"]
        }
      ],
      "doctor_workload_balances": [
        {
          "doctor_id": "BS01",
          "doctor_name": "Nguyen Van A",
          "weekly_shift_count": 4,
          "monthly_shift_count": 4,
          "yearly_estimated_shift_count": 208,
          "holiday_shift_count": 0,
          "day_off_count": 1
        }
      ]
    }
  ]
}
```

## Error samples

POST /api/v1/schedules/run (400):

```json
{
  "detail": "Danh sach bac si co id trung"
}
```

GET /api/v1/schedules/progress/{request_id} (404):

```json
{
  "detail": "Khong tim thay request_id"
}
```

GET /api/v1/schedules/jobs/{request_id}/schedule (409):

```json
{
  "detail": "Lich chua san sang hoac job dang chay"
}
```
