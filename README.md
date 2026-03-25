# NSGA-II Cải Tiến Cho Bài Toán Lập Lịch Ca Trực Bác Sĩ

Tài liệu này giới thiệu cách hệ thống sử dụng NSGA-II để lập lịch trực bác sĩ ngoài trú, đảm bảo thỏa mãn các yêu cầu vận hành của bệnh viện.

## 1. Mục tiêu

- **Đầu vào**: Danh sách bác sĩ, ngày bắt đầu, số ngày, ...
- **Đầu ra**: Nhiều phương án tối ưu cùng của Pareto + một phương án đã được chọn.

## 2. Input của thuật toán

### 2.1 Cá thể (candidate solution) là gì?

Một cá thể được biểu diễn là một danh sách số (vector), có độ dài:

```text
n_var = num_days * shifts_per_day * rooms_per_shift * doctors_per_room
```

Mỗi số trong danh sách là **chỉ số của một bác sĩ**. Khi xử lý, hệ thống `decode()` nó thành lịch cụ thể:

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

**Quá trình xử lý:**

1. Danh sách số ban đầu có thể vi phạm yêu cầu (người trùng, giờ quá, v.v).
2. **`decode()`**: Chuyển danh sách thành lịch cụ thể.
3. **`repair()`**: Sửa các yêu cầu cứng bị vi phạm (ngày nghỉ, người trùng, v.v).
4. **Đánh giá**: Lịch sau khi sửa mới được đánh giá chất lượng.

**Lịch sau khi xử lý** (JSON):

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

## 3. Hàm mục tiêu

Hệ thống dùng **2 chỉ số** để đánh giá chất lượng lịch:

- **f1**: Mức độ vi phạm yêu cầu mềm (càng nhỏ càng tốt).
- **f2**: Mức độ công bằng trong phân công ca (càng nhỏ - càng công bằng - càng tốt).

### 3.1 Yêu cầu cứng (Hard constraints)

**Yêu cầu cứng** là những quy tắc phải được thỏa 100%. Nếu vi phạm sẽ bị loại. Hệ thống có 2 cách xử lý:

1. **Lúc kiểm tra**: Nếu vi phạm nặng, dừng ngay.
2. **Sau tạo**: Nếu có vi phạm nhẹ, tự động sửa.

**Danh sách (10 quy tắc)**:

1. Mỗi ca phải có đủ bác sĩ.
2. Không vượt giờ làm việc mỗi tuần.
3. Số ngày nghỉ của từng bác sĩ không vượt hạn.
4. Thực tập phải làm cùng bác sĩ kinh nghiệm.
5. Bác sĩ phải có chứng chỉ hợp lệ.
6. Ngày muốn trực thêm không trùng ngày nghỉ.
7. Lượng công việc hợp lý.
8. Số phòng và số bác sĩ/phòng hợp lý.
9. Số ca mỗi ngày hợp lý.
10. Tổng số ngày lập lịch hợp lý.

Nếu HC vi phạm ở validate: trả lời lỗi ngay, không tối ưu.

### 3.2 Yêu cầu mềm (Soft constraints) trong f1

Các quy tắc mềm giúp làm lịch tốt hơn. Hệ thống đánh giá chúng qua f1:

- **SC-01**: Không làm liên tiếp quá 5 ngày.
- **SC-02**: Không vượt giờ mỗi tuần.
- **SC-03**: Mức độ thỏa ngày muốn trực thêm, tránh quá ít.
- **SC-04**: Trực cuối tuần có quãng.
- **SC-04b**: Tránh bác sĩ không có ca (khi có thể).
- **SC-05**: Cân bằng số ca giữa các bác sĩ.

### 3.3 Bảng điểm phạt thưởng

**Cách tính f1**:

```
f1 = max(0, Tổng Phạt - Tổng Thưởng)
```

**Nguyên tắc**:

- **Yêu cầu cứng**: Không thể vi phạm. Nếu có, sẽ bị loại hoặc được sửa tự động.
- **Yêu cầu mềm**: Quy thành điểm để hệ thống so sánh và chọn lịch tốt nhất.

**Chi tiết bảng điểm**:

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

## 4. Yêu cầu công bằng (f2)

**f2** là chỉ số đánh giá mức độ công bằng trong việc chia ca giữa các bác sĩ. Nó kết hợp 3 yếu tố:

1. **Độ công bằng Gini**: So sánh mức ca thực tế.
2. **Cân bằng**: Không ai cao hơn hoặc thấp hơn bình quân.
3. **Tránh 0 ca**: Không ai không có ca (khi có thể).

**Công thức**:

```
f2 = 0.28 × công bằng Gini + 0.52 × cân bằng + 0.20 × tránh 0 ca
```

**Tại sao cần f2 riêng?**

- **f1** chỉ tập trung vào: có thực hiện đúng các quy tắc không?
- **f2** chỉ tập trung vào: có công bằng không?

## 5. Cơ chế hoạt động

Hệ thống thực hiện các bước:

1. **Khởi tạo**: Tạo nhiều lịch ngẫu nhiên để thử.
2. **Biến đổi**: Tổng hợp, lai ghép, đột biến để có cá thể mới.
3. **Decode + Repair**: Chuyển danh sách số thành lịch cụ thể, sửa yêu cầu cứng.
4. **Đánh giá**: Tính f1, f2 cho mỗi lịch.
5. **Lựa chọn tốt**: Dùng non-dominated sorting để giữ những lịch tối ưu Pareto.
6. **Lặp lại**: Cho đến khi không còn tiến bộ hoặc hết thời gian.
7. **Kết quả**: Trả ra danh sách lịch Pareto + 1 lịch được chọn.

## 7. Đánh giá độ tin cậy

Độ tin cậy nên được đánh giá theo 4 khía cạnh:

### A. Tính đúng yêu cầu cứng

### B. Tính ổn định kết quả

- Độ lệch chuẩn của "độ công bằng"
- Độ lệch chuẩn của khoảng min-max số ca.

### C. Công bằng vận hành

**Theo dõi qua các lần chạy**:

- Số bác sĩ không có ca (có thể tránh được).
- Khoảng cách P90-P10 (số ca giữa người nhiều và người ít).
- Khoảng min-max số ca.

### D. Hiệu năng

- Thời gian chạy
- Kích cỡ danh sách Pareto.
