# 🚀 Quick Start - Doctor Scheduling

**Chạy ứng dụng trong 5 phút!**

## 1️⃣ Start Servers (2 cửa sổ)

**Cửa sổ 1 - Backend:**

```batch
start-backend.bat
```

**Cửa sổ 2 - Frontend:**

```batch
start-frontend.bat
```

Chờ khoảng 10 giây để servers khởi động xong.

## 2️⃣ Open Browser

Mở trình duyệt, vào: **http://localhost:3000**

Bạn sẽ thấy trang chủ với 4 bước:

- 📋 Bước 1: Cấu hình
- 👨‍⚕️ Bước 2: Bác sĩ
- ⚙️ Bước 3: Tối ưu hóa
- 📊 Bước 4: Báo cáo

## 3️⃣ Quick Test Flow

### Bước 1 - Setup (1 phút)

- Vào trang **Setup**
- Không cần thay đổi gì, setup mặc định đã tốt
- Click button **Lưu cấu hình** (Save Config)
- ✅ Xong!

### Bước 2 - Doctors (30 giây)

- Vào trang **Doctors**
- **Đơn giản nhất:** Kéo xuống, click button xanh **⚡ Load sample doctors (15 người)**
- Tự động load 15 bác sĩ mẫu - thấy thông báo "✓ Đã load 15 bác sĩ mẫu!"
- Click **Lưu backend** để confirm (tùy chọn, nhưng tốt để chắc)
- ✅ Xong! 15 bác sĩ đã sẵn sàng

**Hoặc nếu muốn import CSV thủ công:**

- Kéo xuống phần "Import CSV"
- Mở file [doctors-sample.csv](../doctors-sample.csv) bằng Notepad
- Copy toàn bộ nội dung
- Dán vào textarea "Dữ liệu CSV"
- Click **Import từ CSV**

### Bước 3 - Optimize (1 phút)

- Vào trang **Schedule**
- Nhập: Population = **50**, Generations = **30**
- Click **Tối ưu hóa**
- Chờ ~10s... hệ thống sẽ tìm ra giải pháp tối ưu
- Khi xong, bạn sẽ thấy:
  - **Scatter plot** ở trên - các điểm đại diện cho giải pháp khác nhau
  - **Lịch làm việc** ở dưới - chi tiết phân công ca
  - Click vào bất kỳ điểm nào trên biểu đồ để xem lịch khác

### Bước 4 - Reports (1 phút)

- Vào trang **Reports**
- Chọn tháng (VD: **2026-03** cho tháng 3 năm 2026)
- Click **Tải báo cáo**
- Xem biểu đồ + bảng thống kê công bằng
- Export thành **PDF** hoặc **Excel** nếu cần

## ✅ Hoàn thành!

Bạn vừa:

- ✔️ Cấu hình ràng buộc
- ✔️ Import danh sách bác sĩ
- ✔️ Chạy tối ưu hóa NSGA-II
- ✔️ Xem kết quả lịch làm việc
- ✔️ Xuất báo cáo

## 🐛 Troubleshooting

### Backend không khởi động

```batch
taskkill /F /IM python.exe
start-backend.bat
```

### Frontend không load

- Bấm **Ctrl+Shift+R** để hard refresh
- Độ trễ 5s, hãy chờ thêm một chút

### Port bị chiếm

```batch
netstat -ano | findstr :8000
:: Rồi taskkill /PID [PID] /F
```

## 📚 Tìm hiểu thêm

Xem [README.md](../README.md) để biết chi tiết hơn về:

- Các ràng buộc
- Thuật toán NSGA-II
- Cách tùy chỉnh
- API endpoints

## 💡 CSV Format

Nếu muốn tự tạo file CSV thay vì dùng sample, dùng định dạng này:

```csv
id,full_name,title,specialty,seniority_score,pregnant,senior,part_time,difficult_circumstances
001,Nguyễn Văn An,Dr.,Cardiology,8,0,0,0,0
002,Trần Thị Bình,Dr.,General,6,1,0,0,0
```

**Giải thích:**

- `id`: Mã bác sĩ (unique)
- `full_name`: Họ và tên
- `title`: Chức danh (VD: Dr., Prof., BS)
- `specialty`: Chuyên khoa (VD: Cardiology, Surgery, General, Pediatrics, etc.)
- `seniority_score`: Điểm kinh nghiệm (1-10)
- `pregnant`: 1 = Mang thai, 0 = Không
- `senior`: 1 = Lớn tuổi, 0 = Không
- `part_time`: 1 = Bán thời gian, 0 = Toàn thời gian
- `difficult_circumstances`: 1 = Hoàn cảnh khó khăn, 0 = Không

---
