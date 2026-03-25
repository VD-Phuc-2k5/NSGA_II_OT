# NSGA-II Cải Tiến Cho Bài Toán Lập Lịch Ca Trực Bác Sĩ

Tài liệu này tóm tắt cách ứng dụng NSGA-II cải tiến trong dự án để sinh lịch trực ngoài trú theo ràng buộc nghiệp vụ bệnh viện.

## 1. Mục tiêu bài toán

- Đầu vào là thông tin bác sĩ, ngày bắt đầu, số ngày lập lịch, cấu hình ca/phòng và các ràng buộc.
- Đầu ra là tập phương án Pareto và một phương án được chọn sẵn (selected option).
- Ràng buộc cứng được đảm bảo 100% (nếu vi phạm thì dừng sớm), ràng buộc mềm được tối ưu bằng objective.

## 2. Input thuật toán là gì?

### 2.1 Một cá thể trong quá trình chạy thuật toán là gì?

Trong code, một cá thể (individual) là 1 vector số nguyên 1 chiều `x` có độ dài:

```text
n_var = num_days * shifts_per_day * rooms_per_shift * doctors_per_room
```

Mỗi phần tử trong vector là `doctor_idx` (chỉ số bác sĩ), sau đó được `decode()` thành lịch 4 chiều:

```text
(day_idx, shift_idx, room_idx, slot_idx) -> doctor_idx
```

Bảng dữ liệu minh hoạ (ví dụ nhỏ):

| day_idx | shift_idx     | room_idx | slot_idx | doctor_idx (gen) | ý nghĩa                                                 |
| ------- | ------------- | -------- | -------- | ---------------- | ------------------------------------------------------- |
| 0       | 0 (morning)   | 0 (P-01) | 0        | 12               | Bác sĩ #12 trực ngày đầu, ca sáng, phòng P-01, vị trí 1 |
| 0       | 0 (morning)   | 0 (P-01) | 1        | 4                | Bác sĩ #4 cùng ca/phòng trên, vị trí 2                  |
| 0       | 0 (morning)   | 1 (P-02) | 0        | 7                | Bác sĩ #7 trực ngày đầu, ca sáng, phòng P-02            |
| 0       | 1 (afternoon) | 0 (P-01) | 0        | 2                | Bác sĩ #2 trực ngày đầu, ca chiều, phòng P-01           |
| 1       | 0 (morning)   | 0 (P-01) | 0        | 15               | Bác sĩ #15 trực ngày thứ 2, ca sáng, phòng P-01         |

Lưu ý quan trọng:

- Vector thuần này có thể chứa trùng/vi phạm ràng buộc.
- Sau `decode()`, hệ thống chạy `repair()` để sửa vi phạm hard constraints (ngày nghỉ, trùng người, intern-supervisor, license, đủ số người mỗi phòng).
- Vì vậy, cá thể được đánh giá objective là lịch sau khi đã decode + repair.

Ví dụ JSON sau decode (rút gọn):

```json
{
	"assignments": [
		{
			"date": "2026-04-01",
			"shift": "morning",
			"room": "P-01",
			"doctor_ids": ["BS13", "BS05", "BS22", "BS03", "BS09", "BS31"]
		},
		{
			"date": "2026-04-01",
			"shift": "morning",
			"room": "P-02",
			"doctor_ids": ["BS07", "BS16", "BS28", "BS11", "BS02", "BS18"]
		}
	]
}
```

## 3. Fitness function

Trong implementation hiện tại, `evaluate()` dùng 2 objective:

- `f1`: tổng soft-penalty (càng nhỏ càng tốt).
- `f2`: combined unfairness (đánh giá công bằng, càng nhỏ càng tốt).

### 3.1 Hard constraints (HC) được xử lý trước objective

Hard constraints được xử lý theo 2 lớp:

Repair trong `HardConstraintManager.repair()` để sửa vi phạm phát sinh do crossover/mutation

Danh sách HC chính:

- HC-01: Đủ số bác sĩ cho mỗi ca (rooms x doctors_per_room)
- HC-02: Đủ nhân lực để tránh vượt giới hạn giờ/tuần
- HC-03: Số ngày nghỉ đăng ký của từng bác sĩ không vượt trần
- HC-04: Intern phải có supervisor trong ca
- HC-05: License hợp lệ
- HC-06: `preferred_extra_days` không trùng `days_off`
- HC-07: Feasibility workload trung bình
- HC-08: Số phòng và số bác sĩ/phòng hợp lý
- HC-09: Số ca/ngày hợp lý
- HC-10: Số ngày lập lịch trong miền hợp lệ

Nếu HC vi phạm ở validate: trả lời lỗi ngay, không tối ưu.

### 3.2 Soft constraints trong f1 (`_compute_soft_penalty`)

f1 gồm các thành phần penalty/bonus:

- SC-01: Phạt nếu làm quá 5 ngày liên tiếp
- SC-02: Phạt nếu vượt giới hạn giờ/tuần
- SC-03: Thường khi đập ứng ngày ưu tiên, phạt nếu thiếu mục kữ vọng
- SC-04: Công bằng trực cuối tuần
- SC-04b: Phạt mạnh bác sĩ 0 ca (trừ phần bất khã káng khi tổng slot < số bác sĩ)
- SC-05: Phạt lệch số ca so với vector mục tiêu T (có tính đến đăng ký trực thêm)
- Tăng cường SC-05: Phạt outlier dưới theo khoảng `P90 - P10`
- SC-06: Công bằng theo tháng
- SC-07: Cân bằng theo nhóm chuyên khoa
- SC-08: Phạt độ lệch chuẩn workload tổng thể

### 3.3 Đánh giá thưởng/phạt dựa theo ràng buộc (chi tiết)

Cơ chế chấm điểm trong code:

```text
f1 = max(0, TongPhat - TongThuong)
```

Trong đó:

- `TổngPhạt`: tổng penalty từ SC-01..SC-08
- `TổngThưởng`: bonus từ mục đáp ứng ngày ưu tiên (SC-03)

Nguyên tắc:

- Hard constraints (HC): không chấm điểm. Nếu vi phạm năng ở validate thì loại ngay, nếu vi phạm nhẹ trong quá trình tạo nghiệm thì được repair.
- Soft constraints (SC): được quy đổi thành điểm phạt/thưởng để NSGA-II so sánh các cá thể.

Bảng hệ số thưởng/phạt đang áp dụng:

| Ràng buộc                            | Kiểu        | Công thức chính                            | Hệ số |
| ------------------------------------ | ----------- | ------------------------------------------ | ----- |
| SC-01 Quá 5 ngày liên tiếp           | Phạt        | `2.0 * (consecutive_days - 5)`             | 2.0   |
| SC-02 Vượt giờ/tuần                  | Phạt        | `0.5 * (hours - max_weekly_hours)`         | 0.5   |
| SC-03 Đáp ứng ngày ưu tiên           | Thưởng      | `2.0 * actual_preferred / preferred_count` | +2.0  |
| SC-03 Thiếu mục kữ vọng ngày ưu tiên | Phạt        | `0.5 * (expected - actual)`                | 0.5   |
| SC-04 Công bằng cuối tuần            | Phạt        | `0.5 * (2 - weekend_off)`                  | 0.5   |
| SC-04b Có bác sĩ 0 ca có thể tránh   | Phạt mạnh   | `30.0 * avoidable_zero_count`              | 30.0  |
| SC-05 Lệch mục tiêu số ca T          | Phạt bậnc 2 | `14.0 * (abs(delta)-1)^2`                  | 14.0  |
| SC-05 Spread max-min quá ngưỡng      | Phạt bậnc 2 | `18.0 * (spread-allowed_spread)^2`         | 18.0  |
| SC-05 Tail gap P90-P10 quá ngưỡng    | Phạt bậnc 2 | `12.0 * (tail_gap-threshold)^2`            | 12.0  |
| SC-06 Lệch theo tháng                | Phạt        | `0.1 * deviation`                          | 0.1   |
| SC-07 Lệch theo chuyên khoa          | Phạt        | `0.2 * std(group)`                         | 0.2   |
| SC-08 Lệch chuẩn số ca               | Phạt        | `2.5 * std(shift_counts)`                  | 2.5   |
| SC-08 Lệch chuẩn weighted workload   | Phạt        | `0.05 * std(weighted_counts)`              | 0.05  |

Vì sao cần hệ số khác nhau?

- Mục vi phạm gây rủi ro văn hành cao (ví dụ: bác sĩ 0 ca có thể tránh, lệch dưới lớn) được gán trong số cao.
- Mục điều chỉnh nhẹ (ví dụ: cân bằng theo tháng/chuyên khoa) có hệ số nhỏ hơn để tránh làm mềm tất cả objective.

Ví dụ mini:

```text
TỏngPhạt = 40.8
TỏngThưởng = 3.2
=> f1 = max(0, 40.8 - 3.2) = 37.6
```

Kết luận:

- f1 càng thấp thì lịch càng "tốt" theo quy tắc nghiệp vụ mềm.
- Bonus không được phép làm f1 âm (có chắn `max(0, ...)`)

## 3.4. f2 là gì? f2 có các ràng buộc nào?

f2 trong `_compute_combined_unfairness()` là tổng hợp 3 tier:

1. `tier_gini`: kết hợp Gini và `(1 - JFI)` trên số ca đã điều chỉnh theo đăng ký trực thêm.
2. `tier_balance`: phạt độ lệch tuyệt đối tới đa số với mục tiêu T.
3. `tier_zero`: phạt tỷ lệ bác sĩ 0 ca có thể tránh được.

Công thức trong code hiện tại:

```text
f2 = 0.28 * tier_gini + 0.52 * tier_balance + 0.20 * tier_zero
```

Tại sao tách f2 riêng?

- f1 tập trung vào "đúng quy tắc".
- f2 tập trung vào "phân bố công bằng".
- NSGA-II cân bằng 2 mục tiêu xung đột thay vì ẇp một số duy nhất.

## 7. Output thuật toán là gì?

Lịch và phương án Pareto (`/schedule`)
