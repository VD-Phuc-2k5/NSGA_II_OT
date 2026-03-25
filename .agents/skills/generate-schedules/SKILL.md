# SKILL: generate-schedules

> **Phiên bản:** 3.0 | **Ngày cập nhật:** 2026-03-23  
> **Phạm vi áp dụng:** Cơ sở khám bệnh, chữa bệnh **CHỈ NGOẠI TRÚ** — không có giường nội trú, không có ca trực 24h liên tục, không có khoa đặc biệt ICU/hồi sức.  
> **Điển hình:** Phòng khám đa khoa, phòng khám chuyên khoa, trung tâm y tế ngoại trú, bệnh viện ban ngày (day hospital).

---

## ⚠️ ĐIỂM KHÁC BIỆT THEN CHỐT SO VỚI CƠ SỞ NỘI TRÚ

| Đặc điểm                          | Cơ sở Ngoại trú (hệ thống này)           | Cơ sở Nội trú            |
| --------------------------------- | ---------------------------------------- | ------------------------ |
| Khung giờ hoạt động               | Có giờ mở/đóng cửa cố định               | 24/24 giờ                |
| Ca trực đêm                       | **Không có** (trừ khi có khung giờ tối)  | Bắt buộc                 |
| Ca trực 24h liên tục              | **Không áp dụng**                        | Phổ biến                 |
| Nghỉ bù sau trực đêm              | **Không áp dụng**                        | Bắt buộc                 |
| Yêu cầu trực ngoài giờ hành chính | Tùy theo đăng ký giấy phép               | Bắt buộc theo TT 32/2023 |
| Định mức nhân lực/phiên trực      | Theo lịch khám, không theo giường        | Theo số giường bệnh      |
| Quy định TT 32/2023/TT-BYT        | **Không áp dụng Chương VIII** (trực 24h) | Áp dụng đầy đủ           |

> **Căn cứ pháp lý:** Thông tư 32/2023/TT-BYT Điều 43: chế độ trực 24/24 chỉ áp dụng với cơ sở **có giường bệnh nội trú, giường lưu, hoặc cấp cứu ngoại viện**.  
> **Link xác nhận:** https://xaydungchinhsach.chinhphu.vn/quy-dinh-moi-ve-truc-kham-chua-benh-tu-1-1-2024-119240103065651053.htm

---

## MỤC LỤC

1. [Nguồn pháp lý & học thuật](#1-nguồn-pháp-lý--học-thuật)
2. [Định nghĩa bài toán ngoại trú](#2-định-nghĩa-bài-toán-ngoại-trú)
3. [Ràng buộc cứng (Hard Constraints)](#3-ràng-buộc-cứng-hard-constraints)
4. [Ràng buộc mềm (Soft Constraints)](#4-ràng-buộc-mềm-soft-constraints)
5. [Hệ thống Công bằng (Fairness System) ⭐ MỚI](#5-hệ-thống-công-bằng-fairness-system)
6. [Xử lý Yêu cầu Đặc biệt ⭐ MỚI](#6-xử-lý-yêu-cầu-đặc-biệt)
7. [Hàm mục tiêu cho NSGA-II (đã cập nhật)](#7-hàm-mục-tiêu-cho-nsga-ii)
8. [Kiểm tra độ đúng đắn mô hình](#8-kiểm-tra-độ-đúng-đắn-mô-hình)
9. [Phát hiện & phòng ngừa Overfitting](#9-phát-hiện--phòng-ngừa-overfitting)
10. [Checklist triển khai](#10-checklist-triển-khai)

---

## 1. Nguồn pháp lý & học thuật

### 1.1. Văn bản pháp luật Việt Nam

| Mã       | Văn bản                                                                     | Link xác minh                                                                                                           | Điều khoản liên quan                                                                                        |
| -------- | --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| **[L1]** | Bộ luật Lao động 2019 (Luật 45/2019/QH14)                                   | https://thuvienphapluat.vn/van-ban/Lao-dong-Tien-luong/Bo-luat-lao-dong-2019-333670.aspx                                | Điều 105–111: giờ làm việc, làm thêm, nghỉ ngơi                                                             |
| **[L2]** | Luật Khám bệnh, chữa bệnh 2023 (Luật 15/2023/QH15, hiệu lực 01/01/2024)     | https://thuvienphapluat.vn/van-ban/The-thao-Y-te/Luat-Kham-benh-chua-benh-2023-15-2023-QH15-505488.aspx                 | Điều 40–42: quyền/nghĩa vụ người hành nghề; Điều 60: điều trị ngoại trú                                     |
| **[L3]** | Nghị định 96/2023/NĐ-CP (hướng dẫn Luật KBCB, hiệu lực 01/01/2024)          | https://thuvienphapluat.vn/van-ban/The-thao-Y-te/Nghi-dinh-96-2023-ND-CP-huong-dan-Luat-Kham-benh-chua-benh-583328.aspx | Khoản 2 Điều 2: giờ làm việc hành chính; phân cấp cơ sở KCB                                                 |
| **[L4]** | Thông tư 32/2023/TT-BYT (hiệu lực 01/01/2024)                               | https://xaydungchinhsach.chinhphu.vn/quy-dinh-moi-ve-truc-kham-chua-benh-tu-1-1-2024-119240103065651053.htm             | Điều 43: chế độ trực **chỉ áp dụng cơ sở có giường** — xác nhận cơ sở ngoại trú không bị ràng buộc trực 24h |
| **[L5]** | Nghị định 12/2022/NĐ-CP (xử phạt vi phạm lao động)                          | https://yplawfirm.vn/lao-dong/quy-dinh-phap-luat-ve-thoi-gian-lam-viec-cua-nguoi-lao-dong                               | Điều 18: mức xử phạt vi phạm giờ làm việc                                                                   |
| **[L6]** | Thông tư 35/2024/TT-BYT (tiêu chuẩn chất lượng bệnh viện, hiệu lực 11/2024) | https://kcb.vn/tin-tuc/thong-tu-35-2024-tt-byt-quy-dinh-5-tieu-chuan-chat-luong-co-ban-doi-voi-benh-vien.html           | Tiêu chuẩn nhân sự: phân công đúng phạm vi hành nghề                                                        |

### 1.2. Nghiên cứu học thuật

| Mã       | Tên & nguồn                                                                      | Link                                                                                  | Nội dung áp dụng                                        |
| -------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| **[A1]** | "Scheduling by NSGA-II: Review and Bibliometric Analysis" – MDPI Processes 2022  | https://www.mdpi.com/2227-9717/10/1/98                                                | Review tổng quan NSGA-II trong lập lịch                 |
| **[A2]** | pymoo: Multi-objective Optimization Python – metrics HV, IGD, GD                 | https://pymoo.org/                                                                    | API tính toán Hypervolume, IGD, spacing                 |
| **[A3]** | "Performance metrics in multi-objective optimization" – Academia.edu             | https://www.academia.edu/20446419/Performance_metrics_in_multi_objective_optimization | HV là metric phổ biến nhất (>91 citations)              |
| **[A4]** | "Effect on Patient Safety: Resident Schedule without 24-Hour Shifts" – NEJM 2019 | https://www.nejm.org/doi/full/10.1056/NEJMoa1900669                                   | Cơ sở khoa học: loại bỏ ca > 16h giảm lỗi y khoa 36%    |
| **[A5]** | "Physicians' Working Time Restriction and Patient Safety" – PMC 2020             | https://pmc.ncbi.nlm.nih.gov/articles/PMC7394539/                                     | Giới hạn 80h/tuần và ≤24h/ca liên tục; hậu quả khi vượt |
| **[A6]** | "Is NSGA-II Ready for Large-Scale Multi-Objective Optimization?" – MDPI 2022     | https://www.mdpi.com/2297-8747/27/6/103                                               | Auto-configuration, stopping condition bằng HV          |

---

## 2. Định nghĩa bài toán ngoại trú

### 2.1. Các loại ca làm việc trong cơ sở ngoại trú

Cơ sở ngoại trú **không có ca trực đêm bắt buộc**. Các ca phổ biến:

```
CA_SANG        = 4–5h   (7h00 – 11h30 hoặc 7h00 – 12h00)
CA_CHIEU       = 4–5h   (13h00 – 17h00 hoặc 13h30 – 17h30)
CA_HANH_CHINH  = 8h     (7h00 – 16h30, nghỉ trưa 1–1.5h)
CA_MO_RONG_TOI = 3–4h   (16h00 – 19h00 hoặc 17h00 – 20h00)
                         ← nếu cơ sở đăng ký giờ hoạt động ngoài giờ hành chính
```

> **Lưu ý quan trọng:** Giờ hoạt động phải **đúng với giấy phép đã đăng ký** với Sở Y tế — **[L3]** Khoản 2 Điều 2 Nghị định 96/2023/NĐ-CP.  
> **Thực tế phổ biến:** Thứ 2–Thứ 6: 7h–17h; Thứ 7: 7h–12h; Chủ nhật & lễ: nghỉ hoặc chỉ có bác sĩ trực tối thiểu.

### 2.2. Cấp chuyên môn kỹ thuật (theo [L3])

Theo Nghị định 96/2023/NĐ-CP, cơ sở ngoại trú thường thuộc:

- **Cấp ban đầu:** Khám bệnh, điều trị ngoại trú, chăm sóc sức khỏe ban đầu
- **Cấp cơ bản:** Khám bệnh, điều trị ngoại trú tổng quát

---

## 3. Ràng buộc cứng (Hard Constraints)

> ⚠️ Vi phạm = nghiệm **VÔ HIỆU** (loại khỏi quần thể, penalty = ∞).

---

### HC-01 | Giờ làm việc tối đa mỗi ngày

```
Mỗi bác sĩ không làm quá 8 giờ thực tế khám bệnh/ngày trong ca hành chính.
Trường hợp làm thêm giờ: tối đa 12 giờ/ngày (bao gồm cả thời gian nghỉ giải lao).
```

- **Căn cứ:** [L1] Điều 105 Khoản 1 (8h/ngày hành chính); Điều 107 (tối đa 12h khi làm thêm)
- **Link:** https://thuvienphapluat.vn/lao-dong-tien-luong/luat-lao-dong-quy-dinh-ve-thoi-gio-lam-viec-cua-nguoi-lao-dong-nhu-the-nao-34960.html
- **Áp dụng code:**

```python
MAX_HOURS_NORMAL_DAY  = 8   # giờ, ca hành chính thông thường
MAX_HOURS_OVERTIME    = 12  # giờ, khi có làm thêm
```

---

### HC-02 | Giờ làm việc tối đa mỗi tuần

```
Không quá 48 giờ/tuần.
Nhà nước khuyến khích 40 giờ/tuần (áp dụng làm soft constraint SC-01).
```

- **Căn cứ:** [L1] Điều 105 Khoản 2
- **Link:** https://thuvienphapluat.vn/lao-dong-tien-luong/luat-lao-dong-quy-dinh-ve-thoi-gio-lam-viec-cua-nguoi-lao-dong-nhu-the-nao-34960.html
- **Áp dụng code:**

```python
MAX_HOURS_PER_WEEK    = 48
TARGET_HOURS_PER_WEEK = 40  # mục tiêu (soft constraint)
```

---

### HC-03 | Giới hạn làm thêm giờ

```
Tổng làm thêm không quá 40 giờ/tháng và 200 giờ/năm.
(Trường hợp đặc biệt được phép Bộ Y tế: 300 giờ/năm — không áp dụng phổ biến cho ngoại trú)
```

- **Căn cứ:** [L1] Điều 107 Khoản 2
- **Link:** https://luatpvlgroup.com/bac-si-co-bi-gioi-han-ve-so-gio-lam-viec-trong-tuan-khong/
- **Áp dụng code:**

```python
MAX_OVERTIME_MONTH = 40    # giờ/tháng
MAX_OVERTIME_YEAR  = 200   # giờ/năm
```

---

### HC-04 | Nghỉ giải lao bắt buộc giữa ca

```
Ca ≥ 6 giờ: nghỉ ≥ 30 phút liên tục (được tính vào giờ làm việc).
Không được xếp lịch khám bệnh nhân liên tục > 6 giờ không có nghỉ.
```

- **Căn cứ:** [L1] Điều 109; Nghị định 145/2020/NĐ-CP Điều 64
- **Link:** https://baochinhphu.vn/thoi-gian-nghi-trong-gio-lam-viec-co-duoc-tinh-tra-luong-102291050.htm

---

### HC-05 | Nghỉ hằng tuần

```
Mỗi bác sĩ được nghỉ ≥ 24 giờ liên tục mỗi 7 ngày.
Ưu tiên ngày Chủ nhật; nếu bố trí ngày khác phải bồi thường theo quy định.
```

- **Căn cứ:** [L1] Điều 110, 111
- **Áp dụng code:**

```python
MIN_REST_HOURS_PER_WEEK = 24  # giờ nghỉ liên tục/tuần
PREFERRED_DAY_OFF       = 6   # 0=Thứ 2, ..., 6=Chủ nhật
```

---

### HC-06 | Không xếp ca chồng chéo

```
Một bác sĩ không thể đồng thời ở 2 phòng khám/chuyên khoa khác nhau.
Nếu bác sĩ làm nhiều cơ sở: thời gian không được trùng nhau.
```

- **Căn cứ:** [L3] Điều 5 NĐ 96/2023/NĐ-CP — "thời gian hành nghề không được trùng nhau giữa các cơ sở"
- **Link:** https://dichvuyduoc.net/thu-tuc-mo-phong-kham-ngoai-gio/
- **Áp dụng code:**

```python
# Với mọi bác sĩ d, mọi cặp (shift_i, shift_j):
# NOT (assigned[d][i] == 1 AND assigned[d][j] == 1 AND overlap(i, j))
```

---

### HC-07 | Bác sĩ không làm việc khi đang nghỉ phép/ốm

```
Bác sĩ đã đăng ký nghỉ hằng năm, nghỉ ốm, nghỉ thai sản
không được xếp ca trong thời gian đó.
```

- **Căn cứ:** [L1] Điều 113 (nghỉ hằng năm), Điều 137 (thai sản)
- **Áp dụng code:**

```python
# leave_schedule[doctor_id][date] ∈ {'annual', 'sick', 'maternity', None}
# HC: if leave_schedule[d][date] is not None → blocked[d][date] = True
```

---

### HC-08 | Bác sĩ phải có chứng chỉ hành nghề hợp lệ

```
Chỉ bác sĩ có giấy phép hành nghề còn hiệu lực mới được xếp ca khám bệnh.
Bác sĩ thực tập (chưa có chứng chỉ độc lập) không được xếp ca khám một mình.
```

- **Căn cứ:** [L2] Điều 27 Luật Khám bệnh, chữa bệnh 2023; [L3] Điều 3 NĐ 96/2023 — thực hành 12 tháng trước khi cấp phép (09 tháng chuyên môn + 03 tháng hồi sức cấp cứu)
- **Link:** https://viwa-s.gov.vn/nghi-dinh-96-2023-nd-cp-quy-dinh-chi-tiet-mot-so-dieu-cua-luat-kham-benh-chua-benh.html
- **Áp dụng code:**

```python
# Điều kiện: doctor.has_valid_license == True
# Nếu doctor.is_intern == True → chỉ được xếp khi có bác sĩ supervising trong cùng ca
```

---

### HC-09 | Số lượng bác sĩ tối thiểu mỗi ca khám

```
Mỗi ca phải có đủ số bác sĩ tối thiểu để đảm bảo phục vụ bệnh nhân theo đăng ký.
Không được để phòng khám hoạt động mà không có bác sĩ hợp lệ trực tiếp.
```

- **Căn cứ:** [L3] Khoản 2 Điều 2 NĐ 96/2023 — "giờ làm việc phải đảm bảo hoạt động khám bệnh theo đăng ký"; [L6] TT 35/2024/TT-BYT — tiêu chuẩn nhân sự theo phạm vi hành nghề
- **Link:** https://kcb.vn/tin-tuc/thong-tu-35-2024-tt-byt-quy-dinh-5-tieu-chuan-chat-luong-co-ban-doi-voi-benh-vien.html
- **Áp dụng code:**

```python
MIN_DOCTORS_PER_SHIFT = {
    'phong_kham_don_khoa':     1,  # tối thiểu 1 bác sĩ/ca/phòng
    'phong_kham_da_khoa':      2,  # tối thiểu 2 bác sĩ/ca (đa khoa)
    'trung_tam_ngoai_tru':     3,  # tối thiểu theo quy mô
}
# Điều chỉnh theo số phòng khám và lưu lượng bệnh nhân thực tế
```

---

### HC-10 | Bác sĩ chuyên khoa chỉ khám đúng chuyên khoa

```
Bác sĩ có giấy phép hành nghề chuyên khoa X không được xếp khám tại chuyên khoa Y
trừ trường hợp có văn bản phê duyệt mở rộng phạm vi hành nghề.
```

- **Căn cứ:** [L2] Điều 27 Khoản 2 Luật KBCB 2023 — "phạm vi hành nghề ghi trong giấy phép"; [L6] TT 35/2024/TT-BYT
- **Áp dụng code:**

```python
# Kiểm tra: schedule[d][s].specialty == doctor[d].license_specialty
# Hoặc: schedule[d][s].specialty ∈ doctor[d].approved_specialties
```

---

### HC-11 | Không xếp ca khi hết giờ hoạt động đăng ký

```
Không được xếp ca khám ngoài khung giờ hoạt động đã đăng ký với Sở Y tế.
Ví dụ: nếu giấy phép ghi 7h–17h, không xếp ca 17h–19h.
```

- **Căn cứ:** [L3] Khoản 2 Điều 2 NĐ 96/2023/NĐ-CP — "giờ làm việc do cơ sở xác định và công bố công khai"
- **Link:** https://nhathuoclongchau.com.vn/bai-viet/benh-vien-lam-viec-den-may-gio.html
- **Áp dụng code:**

```python
OPERATING_HOURS = {
    'weekday': ('07:00', '17:00'),
    'saturday': ('07:00', '12:00'),
    'sunday': None,   # đóng cửa hoặc theo đăng ký riêng
}
# HC: shift.start_time >= OPERATING_HOURS[day_type][0]
#     shift.end_time   <= OPERATING_HOURS[day_type][1]
```

---

### HC-12 | Khoảng cách tối thiểu giữa 2 ca liên tiếp

```
Giữa kết thúc ca làm việc và bắt đầu ca tiếp theo: tối thiểu 11 giờ.
(Đây là tiêu chuẩn châu Âu EWTD được khuyến nghị áp dụng tại Việt Nam)
```

- **Căn cứ:** [A5] PMC 2020 — "rest between shifts minimum 11 hours"; EU Working Time Directive (EWTD) minimum rest period
- **Link tham chiếu:** https://pmc.ncbi.nlm.nih.gov/articles/PMC7394539/
- **Áp dụng code:**

```python
MIN_REST_BETWEEN_SHIFTS = 11  # giờ
# Ví dụ: ca sáng kết thúc 12h → ca tiếp sớm nhất là 23h cùng ngày
```

---

## 4. Ràng buộc mềm (Soft Constraints)

> Vi phạm → **tăng penalty** trong hàm fitness. Không loại nghiệm.  
> Trọng số `w_i` có thể điều chỉnh theo chính sách từng cơ sở.

---

### SC-01 | Hướng tới 40 giờ/tuần (w = 9)

```
Mỗi bác sĩ nên làm gần 40 giờ/tuần (HC-02 cho phép tới 48h).
penalty += w * max(0, weekly_hours[d] - 40)
```

- **Căn cứ:** [L1] Điều 105 Khoản 1 — "Nhà nước khuyến khích thực hiện tuần làm việc 40 giờ"

---

### SC-02 | Cân bằng tải giữa các bác sĩ cùng chuyên khoa (w = 10)

```
Phân phối số ca / số giờ khám đồng đều giữa bác sĩ cùng chuyên khoa.
penalty += w * std_dev(hours_per_doctor[specialty])
```

- **Lý do:** Giảm nguy cơ burnout, giữ chân nhân lực; bằng chứng y học từ [A4]

---

### SC-03 | Ưu tiên ca sáng cho bác sĩ cao tuổi/có bệnh lý (w = 6)

```
Bác sĩ có hồ sơ sức khỏe hạn chế (cao tuổi, bệnh tim, v.v.) nên ưu tiên
xếp ca sáng, tránh ca tối/ca mở rộng.
penalty += w * evening_shifts_for_restricted_doctors
```

---

### SC-04 | Không xếp 2 ca dài liên tiếp cùng ngày (w = 8)

```
Không nên xếp bác sĩ làm ca sáng + ca chiều liền kề trong cùng một ngày
nếu tổng > 8 giờ thực tế.
penalty += w * double_shift_same_day[d]
```

- **Căn cứ học thuật:** [A4] NEJM 2019 — sai sót y tế tăng khi làm việc > 8h liên tục

---

### SC-05 | Ưu tiên nguyện vọng bác sĩ (w = 5)

```
Nếu bác sĩ đăng ký ngày ưu tiên nghỉ (không phải phép chính thức):
penalty += w * (1 if assigned_on_preference_day[d] else 0)
```

---

### SC-06 | Phân bổ cuối tuần công bằng (w = 7)

```
Mỗi bác sĩ nên có ít nhất 2 ngày Thứ 7 và Chủ nhật nghỉ trong tháng.
penalty += w * max(0, 2 - weekend_off_count[d])
```

- **Căn cứ:** [L1] Điều 111 — ưu tiên nghỉ Chủ nhật

---

### SC-07 | Bố trí ca linh hoạt theo lưu lượng bệnh nhân (w = 8)

```
Ca sáng (7h–12h) thường đông hơn ca chiều.
Nên xếp nhiều bác sĩ hơn vào ca có dự báo lưu lượng cao.
penalty += w * |actual_doctors[slot] - required_doctors[slot]|
```

- **Lý do thực tiễn:** Tối ưu trải nghiệm bệnh nhân, giảm thời gian chờ

---

### SC-08 | Không xếp nhiều hơn N ngày làm việc liên tục (w = 7)

```
Không nên xếp bác sĩ làm việc quá 6 ngày liên tiếp không nghỉ.
penalty += w * max(0, consecutive_working_days[d] - 6)
```

- **Căn cứ học thuật:** [A5] PMC 2020 — làm việc liên tục > 5 ngày không nghỉ tăng lỗi y tế

---

### SC-09 | Chuyên khoa ít bác sĩ: phân bổ đảm bảo mỗi ca (w = 9)

```
Với chuyên khoa chỉ có 2–3 bác sĩ, cần đảm bảo mỗi ca làm việc
có ít nhất 1 bác sĩ của chuyên khoa đó.
penalty += w * missing_specialty_coverage_slots
```

---

### SC-10 | Đào tạo liên tục (CME) không bị trùng lịch (w = 4)

```
Bác sĩ đăng ký tham gia hội thảo/đào tạo CME không nên bị xếp ca trong ngày đó.
penalty += w * training_conflict_count[d]
```

- **Căn cứ:** [L4] TT 32/2023/TT-BYT Điều 3 — bác sĩ cần 120 giờ CME/5 năm
- **Link:** https://luatvietan.vn/thong-tu-32-2023-tt-byt-huong-dan-luat-kham-benh-chua-benh.html

---

### SC-11 | Ca mở rộng tối: phân bổ luân phiên (w = 6)

```
Nếu cơ sở hoạt động ca tối (16h–19h), các bác sĩ nên luân phiên đảm nhận
ca tối này công bằng trong tháng.
penalty += w * std_dev(evening_shifts_count_per_doctor)
```

---

## 5. Hệ thống Công bằng (Fairness System)

> **Tại sao cần một section riêng?**  
> Nghiên cứu tại PMC 2024 xác nhận: đảm bảo công bằng trong phân bổ ca trực và giờ làm việc là ưu tiên hàng đầu của hệ thống lập lịch y tế, đặc biệt trong bối cảnh lưu lượng bệnh nhân thay đổi theo tháng.  
> Nghiên cứu về fairness trong scheduling phân biệt 2 chuẩn mực: **equality** (phân phối đồng đều cho mọi người) và **equity** (tính đến sự khác biệt cá nhân, nhu cầu và hiệu suất). Hệ thống này áp dụng **cả hai**.

---

### 5.1. Các chiều công bằng cần đo lường

Nghiên cứu tại bệnh viện Pháp (ScienceDirect 2024) xác định 4 chiều công bằng then chốt: cân bằng tổng tải làm việc, cân bằng theo loại ca, cân bằng ngày cuối tuần/lễ được nghỉ, và cân bằng tỷ lệ đáp ứng yêu cầu cá nhân so với số lượng yêu cầu bày tỏ.

```
Chiều 1 — WORKLOAD BALANCE:   Tổng giờ làm/tháng mỗi bác sĩ
Chiều 2 — SHIFT TYPE BALANCE: Số ca sáng / ca chiều / ca tối mỗi người
Chiều 3 — WEEKEND BALANCE:    Số cuối tuần & ngày lễ được nghỉ
Chiều 4 — PREFERENCE RATE:    % yêu cầu được đáp ứng (tương đối, không tuyệt đối)
```

---

### 5.2. Metrics đo công bằng

#### Metric 1: Jain's Fairness Index (JFI) — khuyến nghị sử dụng

Jain et al. (1984) định nghĩa chỉ số công bằng bao hàm các yêu cầu về tính bị chặn, liên tục, và trực giác: giá trị = 1 khi hoàn toàn công bằng, giảm dần khi bất công tăng lên. Chỉ số này vượt trội hơn variance, coefficient of variation và min-max ratio vì thỏa mãn đầy đủ các tiêu chí lý thuyết.

```python
import numpy as np

def jain_fairness_index(workloads: list) -> float:
    """
    Jain's Fairness Index — phổ biến nhất trong tài liệu về fairness.
    Nguồn: Jain et al. 1984; áp dụng cho scheduling tại [A7] arxiv 2511.14135
    Link: https://arxiv.org/pdf/2511.14135

    JFI = 1.0  → hoàn toàn công bằng (mọi người có tải bằng nhau)
    JFI → 0    → rất bất công
    JFI ≥ 0.9  → chấp nhận được trong thực tế y tế
    """
    x = np.array(workloads, dtype=float)
    n = len(x)
    if n == 0 or x.sum() == 0:
        return 1.0
    return (x.sum() ** 2) / (n * (x ** 2).sum())


def compute_all_fairness(schedule) -> dict:
    """Tính JFI trên cả 4 chiều công bằng."""
    result = {}

    # Chiều 1: tổng giờ làm/tháng
    hours = [total_hours_month(schedule, d) for d in all_doctors(schedule)]
    result['JFI_workload'] = jain_fairness_index(hours)

    # Chiều 2: số ca sáng
    morning = [count_shifts(schedule, d, 'CA_SANG') for d in all_doctors(schedule)]
    result['JFI_morning_shifts'] = jain_fairness_index(morning)

    # Chiều 2b: số ca chiều
    afternoon = [count_shifts(schedule, d, 'CA_CHIEU') for d in all_doctors(schedule)]
    result['JFI_afternoon_shifts'] = jain_fairness_index(afternoon)

    # Chiều 3: số ngày cuối tuần/lễ được nghỉ
    weekend_off = [count_weekend_off(schedule, d) for d in all_doctors(schedule)]
    result['JFI_weekend_off'] = jain_fairness_index(weekend_off)

    # Chiều 4: preference satisfaction rate (tương đối)
    pref_rates = [preference_satisfaction_rate(schedule, d) for d in all_doctors(schedule)]
    result['JFI_preference'] = jain_fairness_index(pref_rates)

    result['JFI_overall'] = np.mean(list(result.values()))
    return result

FAIRNESS_THRESHOLDS = {
    'JFI_workload':        0.92,  # tải làm việc — yêu cầu cao
    'JFI_morning_shifts':  0.88,
    'JFI_afternoon_shifts':0.88,
    'JFI_weekend_off':     0.85,  # cuối tuần — chấp nhận biến động hơn
    'JFI_preference':      0.80,  # preference — khó đạt cao hoàn toàn
    'JFI_overall':         0.88,
}
```

#### Metric 2: Gini Coefficient (bổ sung cho JFI)

Hệ số Gini được điều chỉnh từ kinh tế học để đo bất bình đẳng trong phân phối ca trực — giá trị thấp hơn cho thấy phân bổ ca công bằng hơn.

```python
def gini_coefficient(workloads: list) -> float:
    """
    Gini Coefficient cho scheduling.
    Nguồn: myshyft.com/blog/fairness-measurement-metrics
    Link: https://www.myshyft.com/blog/fairness-measurement-metrics/

    0.0 = hoàn toàn bằng nhau
    1.0 = hoàn toàn bất công
    Mục tiêu: Gini < 0.15 trong thực tế y tế
    """
    x = np.sort(np.array(workloads, dtype=float))
    n = len(x)
    if n == 0 or x.sum() == 0:
        return 0.0
    cumx = np.cumsum(x)
    return (n + 1 - 2 * cumx.sum() / x.sum()) / n

GINI_THRESHOLD = 0.15  # Gini < 0.15 → phân phối chấp nhận được
```

#### Metric 3: Preference Satisfaction Rate (tỷ lệ tương đối)

Nghiên cứu bệnh viện Pháp (ScienceDirect 2024) đề xuất đo mức độ đáp ứng yêu cầu **tương đối** so với số lượng yêu cầu bày tỏ của mỗi nhân viên, thay vì đếm tuyệt đối — vì một số bác sĩ đặt nhiều yêu cầu hơn những người khác.

```python
def preference_satisfaction_rate(schedule, doctor_id) -> float:
    """
    Tỷ lệ tương đối: số yêu cầu được đáp ứng / tổng số yêu cầu đã đặt.
    Đây là metric CÔNG BẰNG hơn so với đếm tuyệt đối.
    """
    requests = get_doctor_requests(doctor_id)  # list of (date, type, priority)
    if not requests:
        return 1.0  # không có yêu cầu → luôn thỏa

    satisfied = sum(
        1 for req in requests
        if is_request_satisfied(schedule, doctor_id, req)
    )
    return satisfied / len(requests)
```

---

### 5.3. Fairness như hàm mục tiêu độc lập trong NSGA-II

Nghiên cứu về cân bằng tải trong bệnh viện (optimization-online.org) mô hình hóa bài toán như bi-objective: một mục tiêu là chi phí vận hành, mục tiêu kia là chỉ số bất bình đẳng cần tối thiểu hóa — tạo ra tập nghiệm Pareto để phân tích đánh đổi giữa hiệu quả và công bằng.

```python
def f4_fairness_objective(schedule) -> float:
    """
    Hàm mục tiêu thứ 4: tối đa hóa công bằng tổng thể.
    Đưa vào NSGA-II như objective thứ 4 (tối thiểu hóa 1 - JFI_overall).

    Giá trị = 0  → hoàn toàn công bằng (lý tưởng)
    Giá trị → 1  → hoàn toàn bất công
    """
    fairness = compute_all_fairness(schedule)
    return 1.0 - fairness['JFI_overall']
```

> ⚠️ **Lưu ý khi thêm f4:** NSGA-II với 4 objectives cần tăng `pop_size` lên ít nhất 200–300 để duy trì đa dạng Pareto front. Tham khảo [A6].

---

### 5.4. Lịch sử tích lũy (Fairness Memory)

Nghiên cứu tại bệnh viện Pháp nhấn mạnh tầm quan trọng của việc xét **lịch sử tháng trước** khi lên lịch tháng mới — ví dụ nếu tháng trước bác sĩ A đã làm nhiều ca chiều, tháng này ưu tiên phân ca sáng cho họ.

```python
class FairnessMemory:
    """
    Lưu trữ tích lũy công bằng qua nhiều tháng.
    Sử dụng để initialize NSGA-II với bias bù đắp cho tháng tiếp theo.
    """
    def __init__(self):
        self.history = {}  # {doctor_id: {'hours': [], 'morning': [], 'weekend_off': []}}

    def update(self, schedule, month_key: str):
        for d in all_doctors(schedule):
            if d not in self.history:
                self.history[d] = {'hours': [], 'morning': [], 'afternoon': [], 'weekend_off': []}
            self.history[d]['hours'].append(total_hours_month(schedule, d))
            self.history[d]['morning'].append(count_shifts(schedule, d, 'CA_SANG'))
            self.history[d]['afternoon'].append(count_shifts(schedule, d, 'CA_CHIEU'))
            self.history[d]['weekend_off'].append(count_weekend_off(schedule, d))

    def get_debt(self, doctor_id: str, dimension: str, n_months: int = 3) -> float:
        """
        Tính 'nợ công bằng': bác sĩ nào đang bị thiệt so với trung bình nhóm?
        Trả về số dương nếu bác sĩ đang bị thiệt (cần được ưu tiên),
        số âm nếu đang được lợi (có thể nhường).
        """
        recent = self.history.get(doctor_id, {}).get(dimension, [])[-n_months:]
        if not recent:
            return 0.0
        group_avg = self._group_average(dimension, n_months)
        return group_avg - np.mean(recent)

    def get_fairness_priority_scores(self, dimension: str) -> dict:
        """
        Trả về dict {doctor_id: priority_score} để seed quần thể NSGA-II.
        Bác sĩ có priority_score cao hơn → ưu tiên được phân ca tốt hơn.
        """
        debts = {d: self.get_debt(d, dimension) for d in self.history}
        return debts
```

---

## 6. Xử lý Yêu cầu Đặc biệt

> Section này xử lý 3 tình huống thực tế phổ biến:
>
> 1. **Bác sĩ xin trực thêm** (volunteer extra shifts)
> 2. **Bác sĩ xin nghỉ quá nhiều** (excessive leave requests)
> 3. **Xung đột giữa nhiều yêu cầu cùng lúc**

---

### 6.1. Phân loại yêu cầu

```python
from enum import Enum
from dataclasses import dataclass
from datetime import date
from typing import Optional

class RequestType(Enum):
    # Nhóm 1: Yêu cầu nghỉ (leave)
    ANNUAL_LEAVE          = "annual_leave"       # nghỉ phép năm (có quyền pháp lý)
    SICK_LEAVE            = "sick_leave"          # nghỉ ốm (có quyền pháp lý)
    MATERNITY_LEAVE       = "maternity_leave"     # thai sản (có quyền pháp lý)
    PERSONAL_DAY_OFF      = "personal_day_off"    # xin nghỉ nguyện vọng (không bắt buộc)
    TRAINING_DAY          = "training_day"        # đào tạo CME

    # Nhóm 2: Yêu cầu làm thêm
    VOLUNTEER_EXTRA_SHIFT = "volunteer_extra"     # xin trực thêm tự nguyện
    SWAP_REQUEST          = "swap_request"        # xin đổi ca với đồng nghiệp

class RequestPriority(Enum):
    LEGAL_RIGHT   = 3   # quyền pháp lý — PHẢI đáp ứng (HC-07)
    HIGH          = 2   # ưu tiên cao (lý do cá nhân nghiêm trọng)
    NORMAL        = 1   # yêu cầu thông thường
    LOW           = 0   # nguyện vọng đơn thuần

@dataclass
class DoctorRequest:
    doctor_id:    str
    request_type: RequestType
    target_date:  date
    priority:     RequestPriority
    reason:       Optional[str] = None
    approved:     Optional[bool] = None
```

---

### 6.2. Xử lý: Bác sĩ xin trực thêm (Volunteer Extra Shifts)

Fairness trong scheduling không chỉ là phân phối đồng đều — mà còn bao gồm đảm bảo cơ hội tiếp cận ca làm thêm và ca có phụ cấp cao một cách công bằng giữa các nhân viên.

#### Quy trình xử lý xin trực thêm

```
Bác sĩ nộp đơn xin trực thêm
         ↓
[HC Check] Có vi phạm ràng buộc cứng không?
  • HC-01: Tổng ngày làm > 6 ngày/tuần?
  • HC-02: Tổng giờ > 48h/tuần?
  • HC-03: Tổng OT > 40h/tháng?
  • HC-12: Khoảng cách < 11h với ca liền kề?
         ↓ Không vi phạm
[Fairness Check] Có gây bất công không?
  • Bác sĩ này đã làm nhiều hơn trung bình nhóm?
  • Có bác sĩ khác cần ca này nhưng chưa đủ giờ?
         ↓
[Priority Queue] Xếp hàng theo fairness debt
         ↓
[Phê duyệt có điều kiện] với ghi chú vào FairnessMemory
```

```python
def handle_volunteer_extra_shift(
    request: DoctorRequest,
    current_schedule,
    fairness_memory: FairnessMemory,
    config: dict
) -> dict:
    """
    Xử lý yêu cầu xin trực thêm.

    Nguồn học thuật:
    - Google OR-Tools Nurse Scheduling: https://developers.google.com/optimization/scheduling/employee_scheduling
    - ScienceDirect PMC heuristic medical staff scheduling: https://pmc.ncbi.nlm.nih.gov/articles/PMC10454947/
    """
    d = request.doctor_id
    target = request.target_date

    # === BƯỚC 1: Kiểm tra hard constraints ===
    projected = add_shift_to_schedule(current_schedule, d, target)

    hc_check = {
        'HC01_daily':   check_HC01_daily_hours(projected),
        'HC02_weekly':  check_HC02_weekly_hours(projected),
        'HC03_overtime':check_HC03_overtime_limit(projected),
        'HC12_rest':    check_HC12_min_rest_between_shifts(projected),
    }
    hc_violations = sum(hc_check.values())

    if hc_violations > 0:
        return {
            'approved': False,
            'reason': 'vi_pham_rang_buoc_cung',
            'detail': hc_check,
            'suggestion': suggest_alternative_dates(d, target, current_schedule)
        }

    # === BƯỚC 2: Kiểm tra fairness ===
    current_hours   = total_hours_month(current_schedule, d)
    group_avg_hours = group_average_hours_month(current_schedule, d)

    # Bác sĩ đã làm vượt 115% trung bình nhóm?
    OVERWORK_THRESHOLD = config.get('overwork_threshold_pct', 1.15)
    if current_hours > group_avg_hours * OVERWORK_THRESHOLD:
        # Tìm bác sĩ khác dưới trung bình để ưu tiên
        candidates = find_underworked_doctors(current_schedule)
        return {
            'approved': False,
            'reason':   'fairness_concern',
            'message':  f'Bác sĩ đã làm {current_hours:.1f}h, trung bình nhóm {group_avg_hours:.1f}h. '
                        f'Ưu tiên phân ca cho: {candidates}',
            'suggestion': None
        }

    # === BƯỚC 3: Kiểm tra nhu cầu thực tế ca đó ===
    shift_demand  = get_shift_demand(target, current_schedule)
    shift_current = get_shift_current_staff(target, current_schedule)

    if shift_current >= shift_demand:
        # Ca đã đủ người — ghi nhận vào waiting list
        return {
            'approved': False,
            'reason':   'shift_already_covered',
            'message':  f'Ca {target} đã đủ {shift_current}/{shift_demand} người. '
                        f'Đã thêm vào danh sách dự phòng.',
            'waitlisted': True
        }

    # === BƯỚC 4: Phê duyệt + cập nhật FairnessMemory ===
    fairness_memory.record_volunteer(d, target)
    return {
        'approved': True,
        'reason':   'ok',
        'overtime_pay': calculate_overtime_pay(d, target, config)
    }
```

#### Giới hạn số ca tình nguyện tháng (Hard Constraint bổ sung)

```python
# HC-13 (ngoại trú đặc thù): Bác sĩ tình nguyện trực thêm tối đa
MAX_VOLUNTEER_SHIFTS_MONTH = 4  # ca/tháng — tránh tình trạng 1 bác sĩ ôm quá nhiều ca
# Căn cứ: HC-03 (overtime ≤ 40h/tháng) + nguyên tắc fairness [A7]
```

---

### 6.3. Xử lý: Bác sĩ xin nghỉ quá nhiều

> **Tình huống thực tế:** Một bác sĩ xin nghỉ 25–30 ngày/tháng (trong khi tháng chỉ có 22 ngày làm việc). Hệ thống cần phân biệt rõ **quyền pháp lý** và **nguyện vọng**.

#### Phân tầng xử lý

```
Yêu cầu nghỉ ngày X
        ↓
┌──────────────────────────────────────────────────┐
│ Loại 1: QUYỀN PHÁP LÝ                           │
│ • Nghỉ phép năm (Điều 113 BLLĐ 2019)            │
│ • Nghỉ ốm có giấy xác nhận (Luật BHXH 2014)     │
│ • Nghỉ thai sản (Điều 137 BLLĐ 2019)            │
│ → PHẢI chấp nhận, đây là HC-07                  │
└──────────────────────────────────────────────────┘
        ↓ Nếu không thuộc Loại 1
┌──────────────────────────────────────────────────┐
│ Loại 2: NGUYỆN VỌNG CÁ NHÂN                     │
│ • "personal_day_off" — xin nghỉ thêm ngoài phép  │
│ → Áp dụng quota + fairness check bên dưới       │
└──────────────────────────────────────────────────┘
```

```python
def handle_excessive_leave_requests(
    doctor_id: str,
    all_requests: list,
    current_schedule,
    fairness_memory: FairnessMemory,
    config: dict
) -> dict:
    """
    Xử lý khi bác sĩ nộp quá nhiều yêu cầu nghỉ (ví dụ: 25–30 ngày/tháng).

    Phân loại, validate, và trả về danh sách được duyệt/từ chối với lý do rõ ràng.
    """
    working_days_month = config.get('working_days_month', 22)  # ~22 ngày/tháng
    min_required_days  = config.get('min_required_working_days', 10)  # tối thiểu 10 ngày/tháng

    results = {
        'approved_legal':    [],  # được duyệt tự động (quyền pháp lý)
        'approved_optional': [],  # được duyệt (nguyện vọng)
        'rejected_optional': [],  # bị từ chối (nguyện vọng)
        'warnings':          [],
    }

    # === TÁCH legal vs optional ===
    legal_requests    = [r for r in all_requests
                         if r.priority == RequestPriority.LEGAL_RIGHT]
    optional_requests = [r for r in all_requests
                         if r.priority != RequestPriority.LEGAL_RIGHT]

    # --- Xử lý legal (HC-07, bắt buộc duyệt) ---
    legal_days_off = len(legal_requests)
    for req in legal_requests:
        results['approved_legal'].append({
            'request': req,
            'reason': 'legal_right_guaranteed'
        })

    # --- Tính số ngày làm còn lại sau khi trừ legal ---
    remaining_working_days = working_days_month - legal_days_off

    # Cảnh báo nếu legal leave đã chiếm quá nhiều
    if remaining_working_days < min_required_days:
        results['warnings'].append({
            'code':    'CRITICAL_UNDERSTAFFING_RISK',
            'message': f'Bác sĩ {doctor_id} đã có {legal_days_off} ngày nghỉ pháp lý. '
                       f'Chỉ còn {remaining_working_days} ngày làm — dưới mức tối thiểu '
                       f'{min_required_days} ngày. Cần xem xét bố trí bác sĩ thay thế.',
            'action_required': True
        })

    # --- Xử lý optional requests (có quota) ---
    OPTIONAL_LEAVE_QUOTA  = config.get('optional_leave_quota_per_month', 2)  # ngày/tháng
    optional_budget       = max(0, OPTIONAL_LEAVE_QUOTA)
    optional_approved_cnt = 0

    # Sắp xếp theo priority (cao trước) và ngày nộp đơn (sớm trước)
    optional_requests_sorted = sorted(
        optional_requests,
        key=lambda r: (-r.priority.value, r.target_date)
    )

    for req in optional_requests_sorted:
        if optional_approved_cnt >= optional_budget:
            results['rejected_optional'].append({
                'request': req,
                'reason': f'quota_exceeded: tối đa {OPTIONAL_LEAVE_QUOTA} ngày nghỉ tự nguyện/tháng',
                'suggestion': 'Chuyển sang tháng sau hoặc đổi sang nghỉ phép năm'
            })
            continue

        # Kiểm tra coverage: có đủ bác sĩ khác trực ca đó không?
        coverage_ok = check_minimum_coverage_without(
            current_schedule, doctor_id, req.target_date, config
        )
        if not coverage_ok:
            results['rejected_optional'].append({
                'request': req,
                'reason': 'insufficient_coverage',
                'message': f'Ngày {req.target_date}: không đủ bác sĩ nếu thiếu thêm 1 người.',
                'suggestion': 'Tìm người đổi ca hoặc chọn ngày khác'
            })
            continue

        # Kiểm tra fairness: bác sĩ này đã nghỉ nhiều hơn trung bình nhóm chưa?
        avg_off_days    = group_average_off_days(current_schedule, doctor_id)
        doctor_off_days = count_off_days(current_schedule, doctor_id) + optional_approved_cnt

        FAIRNESS_OFF_CAP_MULTIPLIER = config.get('fairness_off_cap_multiplier', 1.5)
        if doctor_off_days > avg_off_days * FAIRNESS_OFF_CAP_MULTIPLIER:
            results['rejected_optional'].append({
                'request': req,
                'reason': 'fairness_violation',
                'message': f'Bác sĩ {doctor_id} đã có {doctor_off_days} ngày nghỉ, '
                           f'trung bình nhóm {avg_off_days:.1f} ngày. '
                           f'Vượt quá {FAIRNESS_OFF_CAP_MULTIPLIER}x trung bình.',
                'suggestion': 'Phân bổ công bằng — ưu tiên bác sĩ chưa được nghỉ'
            })
            continue

        # Thông qua
        results['approved_optional'].append({'request': req, 'reason': 'ok'})
        optional_approved_cnt += 1

    # === Tổng kết + cảnh báo ===
    total_off = legal_days_off + optional_approved_cnt
    total_working = working_days_month - total_off
    results['summary'] = {
        'doctor_id':            doctor_id,
        'total_off_days':       total_off,
        'legal_off_days':       legal_days_off,
        'optional_approved':    optional_approved_cnt,
        'optional_rejected':    len(results['rejected_optional']),
        'remaining_work_days':  total_working,
        'coverage_risk':        total_working < min_required_days,
    }

    # Cảnh báo đặc biệt: bác sĩ gần như không đi làm cả tháng
    if total_working < 5:
        results['warnings'].append({
            'code':    'NEAR_FULL_MONTH_ABSENCE',
            'message': f'⚠️ Bác sĩ {doctor_id} chỉ còn {total_working} ngày làm '
                       f'trong tháng. Ban quản lý cần xem xét và bố trí nhân sự thay thế.',
            'escalate_to': 'head_of_department'
        })

    return results
```

---

### 6.4. Xử lý xung đột: nhiều bác sĩ cùng xin nghỉ 1 ngày

Phương pháp Balanced Fair assignment Method (BFM) phát triển tại nghiên cứu bệnh viện Thổ Nhĩ Kỳ (PMC 2023) đề xuất: khi nhiều nhân viên cùng xin nghỉ, ưu tiên người có tỷ lệ yêu cầu được đáp ứng thấp nhất trong lịch sử, đảm bảo mỗi người được đáp ứng ở mức cao nhất và cân bằng nhau.

```python
def resolve_leave_conflict(
    conflict_requests: list,  # nhiều bác sĩ xin nghỉ cùng ngày
    current_schedule,
    fairness_memory: FairnessMemory,
    config: dict
) -> list:
    """
    Khi nhiều bác sĩ cùng xin nghỉ 1 ngày và không thể duyệt tất cả:
    Chọn người được nghỉ dựa trên fairness history.

    Nguồn: BFM method — PMC 2023 https://pmc.ncbi.nlm.nih.gov/articles/PMC9972317/
    """
    target_date = conflict_requests[0].target_date

    # Tính số người tối đa có thể nghỉ ngày đó (coverage constraint)
    min_staff   = config['MIN_DOCTORS_PER_SHIFT']
    total_staff = len(all_doctors(current_schedule))
    max_can_off = total_staff - min_staff['phong_kham_da_khoa']

    # Phân nhóm: legal (ưu tiên tuyệt đối) vs optional
    legal_requests    = [r for r in conflict_requests
                         if r.priority == RequestPriority.LEGAL_RIGHT]
    optional_requests = [r for r in conflict_requests
                         if r.priority != RequestPriority.LEGAL_RIGHT]

    approved = list(legal_requests)  # legal luôn được duyệt trước

    if len(approved) >= max_can_off:
        # Legal đã chiếm hết slot — từ chối tất cả optional
        return approved + [{'request': r, 'approved': False,
                             'reason': 'coverage_limit_by_legal'} for r in optional_requests]

    # Rank optional theo fairness: ai có lịch sử ít được nghỉ nhất → ưu tiên hơn
    optional_ranked = sorted(
        optional_requests,
        key=lambda r: fairness_memory.get_debt(r.doctor_id, 'weekend_off'),
        reverse=True  # debt cao nhất → ưu tiên nhất
    )

    remaining_slots = max_can_off - len(approved)
    approved += optional_ranked[:remaining_slots]
    rejected  = optional_ranked[remaining_slots:]

    return approved + [{'request': r, 'approved': False,
                        'reason': 'conflict_resolved_by_fairness_history'} for r in rejected]
```

---

### 6.5. Config tham số xử lý yêu cầu

```python
REQUEST_HANDLING_CONFIG = {
    # Giới hạn ca tình nguyện trực thêm
    'max_volunteer_shifts_month':    4,    # ca/tháng
    'overwork_threshold_pct':        1.15, # 115% trung bình nhóm → từ chối xin thêm

    # Quota nghỉ tự nguyện
    'optional_leave_quota_per_month': 2,   # ngày/tháng (ngoài phép pháp lý)
    'fairness_off_cap_multiplier':    1.5, # tối đa 1.5x trung bình nhóm

    # Ngưỡng cảnh báo
    'min_required_working_days':     10,   # tối thiểu 10 ngày làm/tháng
    'near_absence_threshold':         5,   # < 5 ngày làm → cảnh báo nghiêm trọng

    # Fairness memory
    'fairness_lookback_months':       3,   # xét 3 tháng gần nhất
}
```

---

## 7. Hàm mục tiêu cho NSGA-II

### 7.1. Bốn hàm mục tiêu (tối thiểu hóa) — cập nhật từ phiên bản 2.0

```python
import numpy as np

def f1_hard_constraint_violations(schedule, config):
    """Tổng vi phạm ràng buộc cứng HC-01 → HC-12. Mục tiêu = 0."""
    v = 0
    v += check_HC01_daily_max_hours(schedule)
    v += check_HC02_weekly_max_hours(schedule)
    v += check_HC03_overtime_limit(schedule)
    v += check_HC04_mandatory_break(schedule)
    v += check_HC05_weekly_rest(schedule)
    v += check_HC06_no_overlap(schedule)
    v += check_HC07_leave_conflict(schedule)
    v += check_HC08_valid_license(schedule)
    v += check_HC09_min_doctors_per_shift(schedule, config)
    v += check_HC10_specialty_match(schedule)
    v += check_HC11_operating_hours(schedule, config)
    v += check_HC12_min_rest_between_shifts(schedule)
    return v

def f2_soft_constraint_penalty(schedule, weights=DEFAULT_WEIGHTS):
    """Tổng penalty ràng buộc mềm SC-01 → SC-11."""
    p = 0
    p += weights['SC01'] * SC01_weekly_40h_target(schedule)
    p += weights['SC02'] * SC02_workload_balance(schedule)
    p += weights['SC03'] * SC03_senior_doctor_morning(schedule)
    p += weights['SC04'] * SC04_no_double_long_shift(schedule)
    p += weights['SC05'] * SC05_preference_violations(schedule)
    p += weights['SC06'] * SC06_weekend_fairness(schedule)
    p += weights['SC07'] * SC07_demand_mismatch(schedule)
    p += weights['SC08'] * SC08_consecutive_days(schedule)
    p += weights['SC09'] * SC09_specialty_coverage(schedule)
    p += weights['SC10'] * SC10_training_conflict(schedule)
    p += weights['SC11'] * SC11_evening_shift_rotation(schedule)
    return p

def f3_workload_std(schedule):
    """Độ lệch chuẩn giờ làm việc trong cùng chuyên khoa. Mục tiêu = 0."""
    stds = []
    for specialty in get_all_specialties(schedule):
        hours = [compute_total_hours(schedule, d)
                 for d in get_doctors_by_specialty(specialty)]
        if len(hours) > 1:
            stds.append(np.std(hours))
    return np.mean(stds) if stds else 0.0

def f4_fairness(schedule):
    """
    1 - JFI_overall: đo mức độ bất công tổng thể. Mục tiêu = 0 (hoàn toàn công bằng).
    Nguồn: Jain's Fairness Index — arxiv 2511.14135, ScienceDirect 2024
    """
    return 1.0 - compute_all_fairness(schedule)['JFI_overall']

DEFAULT_WEIGHTS = {
    'SC01': 9, 'SC02': 10, 'SC03': 6,  'SC04': 8,
    'SC05': 5, 'SC06': 7,  'SC07': 8,  'SC08': 7,
    'SC09': 9, 'SC10': 4,  'SC11': 6
}
```

### 7.2. Cấu hình NSGA-II (cập nhật cho 4 objectives)

```python
NSGA2_CONFIG = {
    # 4 objectives yêu cầu pop_size lớn hơn để duy trì đa dạng Pareto front
    # Tham khảo: [A6] https://www.mdpi.com/2297-8747/27/6/103
    'n_gen':            400,   # tăng từ 300 lên 400 do thêm objective
    'pop_size':         250,   # tăng từ 150 lên 250 cho 4-objective problem
    'crossover':        'SBX',
    'crossover_prob':   0.9,
    'mutation':         'PM',
    'mutation_prob':    0.08,
    'tournament_size':  2,
    'n_objectives':     4,     # f1, f2, f3, f4
    'seed_runs':        30,
}
```

---

## 8. Kiểm tra độ đúng đắn mô hình

### 6.1. Metrics đánh giá Pareto front

```python
from pymoo.indicators.hv  import HV
from pymoo.indicators.igd import IGD
from pymoo.indicators.gd  import GD
import numpy as np
from scipy.spatial.distance import cdist

def evaluate_pareto_quality(pareto_F, ref_point=None, pf_reference=None):
    """
    Đánh giá toàn diện chất lượng Pareto front tìm được.
    Nguồn: pymoo https://pymoo.org/ và [A3] academia.edu/20446419

    Returns:
        dict với HV, IGD, GD, Spacing
    """
    results = {}

    # 1. Hypervolume (HV) — metric quan trọng nhất [A3]
    #    HV lớn → Pareto front tốt (bao phủ không gian mục tiêu nhiều)
    if ref_point is None:
        ref_point = pareto_F.max(axis=0) * 1.1  # tự động tính reference point
    hv = HV(ref_point=ref_point)
    results['HV'] = hv.do(pareto_F)

    # 2. IGD — đo khoảng cách từ Pareto chuẩn đến Pareto tìm được
    #    IGD nhỏ → kết quả gần optimal [A3]
    if pf_reference is not None:
        igd = IGD(pf_reference)
        results['IGD'] = igd.do(pareto_F)
        gd = GD(pf_reference)
        results['GD'] = gd.do(pareto_F)

    # 3. Spacing — đo tính đa dạng của Pareto front
    D = cdist(pareto_F, pareto_F)
    np.fill_diagonal(D, np.inf)
    d_min  = D.min(axis=1)
    d_bar  = d_min.mean()
    results['Spacing'] = float(np.sqrt(np.mean((d_min - d_bar) ** 2)))

    # 4. Tỷ lệ nghiệm hợp lệ (HC violations = 0)
    results['Feasibility_Rate'] = None  # tính bên ngoài dựa trên f1

    return results
```

### 6.2. Kiểm tra hội tụ

```python
def check_convergence(hv_history, window=30, threshold=0.001):
    """
    Model hội tụ khi HV không cải thiện > 0.1% trong 30 thế hệ gần nhất.
    Nguồn: [A6] MDPI 2022 — "stopping condition: no HV improvement"
    Link: https://www.mdpi.com/2297-8747/27/6/103
    """
    if len(hv_history) < window:
        return False, 0.0
    recent     = hv_history[-window:]
    if min(recent) < 1e-9:
        return False, 0.0
    improvement = (max(recent) - min(recent)) / min(recent)
    return improvement < threshold, improvement


def stopping_criterion(gen, hv_history, config):
    """
    Dừng khi thỏa một trong các điều kiện:
    1. Đạt tối đa thế hệ
    2. HV hội tụ (không cải thiện)
    3. Tất cả nghiệm trong quần thể đều feasible (f1 = 0)
    """
    if gen >= config['n_gen']:
        return True, "max_generation"
    converged, delta = check_convergence(hv_history)
    if converged:
        return True, f"converged (delta={delta:.6f})"
    return False, None
```

### 6.3. Validate toàn bộ Hard Constraints

```python
def validate_outpatient_schedule(schedule, hospital_config):
    """
    Kiểm tra 12 ràng buộc cứng, trả về báo cáo chi tiết.
    Chạy lần này trước khi giao lịch cho bệnh viện.
    """
    report = {}
    report['HC01_daily_hours']          = check_HC01(schedule)
    report['HC02_weekly_hours']         = check_HC02(schedule)
    report['HC03_overtime']             = check_HC03(schedule)
    report['HC04_break']                = check_HC04(schedule)
    report['HC05_weekly_rest']          = check_HC05(schedule)
    report['HC06_no_overlap']           = check_HC06(schedule)
    report['HC07_leave_conflict']       = check_HC07(schedule)
    report['HC08_license_valid']        = check_HC08(schedule)
    report['HC09_min_staff']            = check_HC09(schedule, hospital_config)
    report['HC10_specialty_match']      = check_HC10(schedule)
    report['HC11_operating_hours']      = check_HC11(schedule, hospital_config)
    report['HC12_rest_between_shifts']  = check_HC12(schedule)

    total = sum(report.values())
    return {
        'is_valid':         total == 0,
        'total_violations': total,
        'detail':           report,
        'compliance_rate':  1.0 - (total / max_possible_violations(schedule))
    }
```

### 6.4. So sánh với baseline và kiểm định thống kê

```python
import scipy.stats as stats

BASELINES = [
    'random_schedule',   # ngẫu nhiên
    'greedy_round_robin', # round-robin đơn giản
    'manual_schedule',   # lịch tay của cơ sở (nếu có)
    'standard_nsga2',    # NSGA-II gốc không cải tiến
]

def statistical_comparison(hv_improved: list, hv_baseline: list, alpha=0.05):
    """
    Wilcoxon rank-sum test (non-parametric, phù hợp với optimization).
    p < alpha → cải tiến có ý nghĩa thống kê.
    Nguồn: [A1] MDPI Processes 2022
    """
    stat, p = stats.ranksums(hv_improved, hv_baseline)
    return {
        'statistic': stat,
        'p_value':   p,
        'significant': p < alpha,
        'conclusion': 'Cải tiến có ý nghĩa thống kê' if p < alpha
                      else 'Không có sự khác biệt đáng kể'
    }

# Quy trình chuẩn: chạy 30 lần mỗi method, so sánh HV
N_RUNS = 30
hv_improved = [run_improved_nsga2(seed=i) for i in range(N_RUNS)]
hv_standard = [run_standard_nsga2(seed=i) for i in range(N_RUNS)]
result = statistical_comparison(hv_improved, hv_standard)
print(result)
```

---

## 9. Phát hiện & phòng ngừa Overfitting

> Trong NSGA-II, "overfitting" = **overtuning** trên một tháng/cơ sở cụ thể, dẫn đến kém hiệu quả khi áp dụng sang tháng/cơ sở khác.

### 7.1. Dấu hiệu nhận biết

| Triệu chứng                                       | Nguyên nhân                         | Cách phát hiện          |
| ------------------------------------------------- | ----------------------------------- | ----------------------- |
| HV tốt trên tháng training, xấu trên tháng test   | Hyperparameter tune quá mức         | K-fold theo tháng       |
| Pareto front co cụm 1 vùng nhỏ                    | Mất đa dạng (premature convergence) | Spacing metric < ngưỡng |
| Lịch không còn hợp lệ khi thêm/bớt 1 bác sĩ       | Quá phụ thuộc cấu trúc input        | Robustness test         |
| Thế hệ >200 HV không cải thiện nhưng vẫn tiếp tục | Lãng phí computation                | Dùng stopping criterion |

### 7.2. Cross-validation theo tháng

```python
def cross_validate_by_month(all_months_data: list, model_params: dict):
    """
    Leave-one-month-out cross validation.
    Train trên N-1 tháng, evaluate trên 1 tháng.
    Nếu HV_val ≈ HV_train → model tổng quát tốt.
    """
    n = len(all_months_data)
    hv_train_scores = []
    hv_val_scores   = []

    for val_idx in range(n):
        train_data = [all_months_data[i] for i in range(n) if i != val_idx]
        val_data   = all_months_data[val_idx]

        # Tune params trên train
        tuned_params = tune_hyperparams(train_data, model_params)

        # Evaluate trên val
        hv_train = np.mean([run(d, tuned_params)['HV'] for d in train_data])
        hv_val   = run(val_data, tuned_params)['HV']

        hv_train_scores.append(hv_train)
        hv_val_scores.append(hv_val)

    # Model tốt: std nhỏ, HV_val / HV_train > 0.9
    ratio = np.mean(hv_val_scores) / (np.mean(hv_train_scores) + 1e-9)
    return {
        'mean_hv_train': np.mean(hv_train_scores),
        'mean_hv_val':   np.mean(hv_val_scores),
        'generalization_ratio': ratio,
        'acceptable': ratio > 0.9   # >90% → model tổng quát tốt
    }
```

### 7.3. Diversity monitoring và Restart

```python
def population_entropy(population_F):
    """Đo mức độ đa dạng của quần thể."""
    if len(population_F) < 2:
        return 0.0
    # Normalize objectives
    F_norm = (population_F - population_F.min(0)) / (
              population_F.ptp(0) + 1e-9)
    # Entropy dựa trên khoảng cách crowding
    D = cdist(F_norm, F_norm)
    np.fill_diagonal(D, np.inf)
    min_dists = D.min(axis=1)
    return float(np.mean(min_dists))

DIVERSITY_THRESHOLD = 0.05  # điều chỉnh theo bài toán

def apply_diversity_restart(population, n_inject=30):
    """
    Khi entropy < threshold: inject 20% cá thể ngẫu nhiên để phục hồi đa dạng.
    """
    if population_entropy(population.get('F')) < DIVERSITY_THRESHOLD:
        new_individuals = generate_random_schedules(n_inject)
        population = inject_into_population(population, new_individuals)
    return population
```

### 7.4. Sensitivity analysis

```python
def sensitivity_analysis(base_params: dict, data, delta=0.2):
    """
    Thay đổi ±20% từng hyperparameter.
    Model robust nếu HV thay đổi < 5%.
    """
    base_hv = np.mean([run(data, base_params)['HV'] for _ in range(10)])
    results = {}

    for param in ['n_gen', 'pop_size', 'crossover_prob', 'mutation_prob']:
        val     = base_params[param]
        low_hv  = np.mean([run(data, {**base_params, param: val*(1-delta)})['HV']
                           for _ in range(10)])
        high_hv = np.mean([run(data, {**base_params, param: val*(1+delta)})['HV']
                           for _ in range(10)])
        sensitivity = max(abs(low_hv - base_hv), abs(high_hv - base_hv)) / (base_hv + 1e-9)
        results[param] = {
            'sensitivity': sensitivity,
            'robust': sensitivity < 0.05  # < 5% thay đổi → robust
        }
    return results
```

---

## 10. Checklist triển khai

### ✅ Checklist Fairness & Yêu cầu Đặc biệt (MỚI v3.0)

- [ ] `jain_fairness_index()` đã được implement và trả về JFI ≥ 0.88 cho nghiệm tốt nhất
- [ ] `gini_coefficient()` trả về Gini < 0.15 cho phân phối giờ làm việc
- [ ] `FairnessMemory` được khởi tạo và cập nhật cuối mỗi tháng
- [ ] Fairness được thêm như **f4** vào NSGA-II (không chỉ là soft constraint)
- [ ] `handle_volunteer_extra_shift()` kiểm tra HC + fairness trước khi duyệt
- [ ] `handle_excessive_leave_requests()` phân tách đúng legal vs optional
- [ ] Quota nghỉ tự nguyện đã được cấu hình: `optional_leave_quota_per_month = 2`
- [ ] Cảnh báo `NEAR_FULL_MONTH_ABSENCE` được escalate đến trưởng khoa
- [ ] `resolve_leave_conflict()` dùng fairness history để phân xử xung đột
- [ ] `REQUEST_HANDLING_CONFIG` đã được xác nhận với ban quản lý

### ✅ Checklist Đặc thù Ngoại trú

- [ ] **Xác nhận giấy phép hoạt động** của cơ sở: khung giờ, chuyên khoa, loại hình (phòng khám đơn/đa khoa, trung tâm)
- [ ] **Không áp dụng** HC liên quan đến trực 24h, ca đêm, trực thường trú (chỉ áp dụng cho cơ sở có giường nội trú)
- [ ] **Xác nhận** cơ sở không có giường lưu > 72h (nếu có → phải xem xét thêm quy định TT 32/2023)
- [ ] Đã xác định `OPERATING_HOURS` đúng với giấy phép đăng ký tại Sở Y tế
- [ ] Đã xác định `MIN_DOCTORS_PER_SHIFT` theo quy mô và số phòng khám

### ✅ Checklist Ràng buộc

- [ ] HC-01 đến HC-12 đã được implement đầy đủ
- [ ] `validate_outpatient_schedule()` trả về `is_valid = True` cho nghiệm tốt nhất
- [ ] Đã kiểm tra edge case: bác sĩ nghỉ phép đột xuất, ngày lễ Tết, chuyên khoa chỉ có 1 bác sĩ
- [ ] Trọng số soft constraint đã được xác nhận với ban giám đốc/quản lý cơ sở

### ✅ Checklist Validation

- [ ] Chạy ≥ 30 lần độc lập (random seeds khác nhau)
- [ ] Wilcoxon test p < 0.05 so với baseline (lịch tay hoặc NSGA-II gốc)
- [ ] Cross-validate ≥ 3 tháng, generalization_ratio > 0.9
- [ ] HV hội tụ ổn định (deviation < 0.1% trong 30 thế hệ cuối)
- [ ] Spacing metric không giảm đột ngột (không premature convergence)
- [ ] Sensitivity analysis: tất cả hyperparameter có sensitivity < 5%

### ✅ Checklist Pháp lý

- [ ] Tuân thủ Bộ luật Lao động 2019: ≤ 8h/ngày, ≤ 48h/tuần, ≤ 40h làm thêm/tháng
- [ ] Đăng ký giờ làm việc chính xác với Sở Y tế theo NĐ 96/2023/NĐ-CP
- [ ] Tất cả bác sĩ có giấy phép hành nghề hợp lệ theo Luật KBCB 2023
- [ ] Bác sĩ được phân công đúng chuyên khoa được cấp phép (TT 35/2024/TT-BYT)
- [ ] Không áp dụng chế độ trực 24h (cơ sở này không có giường nội trú — xác nhận theo TT 32/2023)

---

## Phụ lục: Tóm tắt nhanh cho Cursor

```
BÀI TOÁN: Lập lịch ca trực bác sĩ ngoại trú (KHÔNG có nội trú)
THUẬT TOÁN: NSGA-II cải tiến
SỐ HÀM MỤC TIÊU: 4 (f1: vi phạm HC, f2: penalty SC, f3: workload std, f4: 1-JFI fairness)
RÀNG BUỘC CỨNG: 12 (HC-01 → HC-12)
RÀNG BUỘC MỀM: 11 (SC-01 → SC-11)

FAIRNESS SYSTEM (v3.0):
✓ Jain's Fairness Index (JFI) — 4 chiều: workload, shift type, weekend, preference
✓ Gini Coefficient — ngưỡng < 0.15
✓ FairnessMemory — lịch sử tích lũy 3 tháng, dùng để seed NSGA-II
✓ Fairness là objective f4 độc lập, không chỉ là soft constraint

XỬ LÝ YÊU CẦU ĐẶC BIỆT (v3.0):
✓ Bác sĩ xin trực thêm: kiểm tra HC → fairness → coverage → phê duyệt
✓ Bác sĩ xin nghỉ quá nhiều: phân tầng legal (HC-07) vs optional (quota=2 ngày/tháng)
✓ Xung đột nhiều người xin nghỉ cùng ngày: ưu tiên theo fairness debt lịch sử
✓ Cảnh báo tự động khi bác sĩ < 5 ngày làm trong tháng

ĐIỂM ĐẶC THÙ NGOẠI TRÚ:
✗ Không có ca trực đêm bắt buộc
✗ Không áp dụng TT 32/2023/TT-BYT Chương VIII (trực 24h)
✓ Giờ hoạt động cố định (theo giấy phép Sở Y tế)
✓ HC-11: không xếp ca ngoài giờ đăng ký
✓ HC-12: nghỉ tối thiểu 11h giữa 2 ca liên tiếp

METRICS VALIDATION: HV (quan trọng nhất) > IGD > GD > Spacing + JFI overall ≥ 0.88
KIỂM ĐỊNH: Wilcoxon test, 30 lần chạy, cross-validate theo tháng
NSGA-II CONFIG: 4 objectives → pop_size=250, n_gen=400
```
