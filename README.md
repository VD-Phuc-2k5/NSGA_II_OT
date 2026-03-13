# Improved NSGA-II

Cài đặt cải tiến của thuật toán NSGA-II (Non-dominated Sorting Genetic Algorithm II) với các kỹ thuật tối ưu hóa hiện đại để giải quyết bài toán tối ưu hóa đa mục tiêu.

## Mục lục

- [Tổng quan](#tổng-quan)
- [Các cải tiến chính](#các-cải-tiến-chính)
- [Kết quả thực nghiệm](#kết-quả-thực-nghiệm)
- [Độ phức tạp thuật toán](#độ-phức-tạp-thuật-toán)
- [Cài đặt](#cài-đặt)
- [Sử dụng](#sử-dụng)
- [Tài liệu tham khảo](#tài-liệu-tham-khảo)

## Tổng quan

Improved NSGA-II là phiên bản cải tiến của thuật toán NSGA-II cổ điển, được thiết kế để cải thiện:

- **Chất lượng nghiệm**: Khả năng hội tụ về Pareto front thực
- **Độ đa dạng**: Phân bố đều các nghiệm trên Pareto front
- **Hiệu suất**: Tốc độ hội tụ nhanh hơn với ít thế hệ hơn
- **Khả năng khám phá**: Tránh rơi vào tối ưu cục bộ

## Các cải tiến chính

### 1. Opposition-Based Learning (OBL)

- **Mục đích**: Cải thiện chất lượng quần thể khởi tạo
- **Cách thức**: Với mỗi cá thể ngẫu nhiên `x`, tạo thêm cá thể đối ngược `x_opp = lb + ub - x`
- **Lợi ích**: Tăng khả năng khám phá không gian tìm kiếm ngay từ đầu, giảm số thế hệ cần thiết để hội tụ

### 2. Adaptive Mutation Probability

- **Công thức**: `pm(t) = pm_max - (pm_max - pm_min) × (t / T)`
- **pm_max**: 0.3 (thế hệ đầu - khám phá mạnh)
- **pm_min**: 0.05 (thế hệ cuối - khai thác)
- **Lợi ích**: Cân bằng giữa khám phá (exploration) và khai thác (exploitation) theo thời gian

### 3. Simulated Binary Crossover (SBX)

- **Tham số**: `eta_c = 20` (distribution index)
- **Đặc điểm**: Con cái thường gần với cha mẹ hơn, phù hợp cho tối ưu hóa liên tục
- **Lợi ích**: Tạo ra các biến thể chất lượng cao từ các nghiệm tốt

### 4. Polynomial Mutation

- **Tham số**: `eta_m = 20` (distribution index)
- **Đặc điểm**: Độ lớn đột biến giảm dần khi tiến gần đến nghiệm tối ưu
- **Lợi ích**: Tinh chỉnh nghiệm hiệu quả ở giai đoạn sau

### 5. Tournament Selection

- **Kích thước giải đấu**: 2
- **Tiêu chí**: Ưu tiên rank thấp hơn → crowding distance lớn hơn
- **Lợi ích**: Duy trì áp lực chọn lọc vừa phải, bảo toàn đa dạng

## Kết quả thực nghiệm

### So sánh với các thuật toán khác

Improved NSGA-II được so sánh với các thuật toán tiên tiến:

- **NSGA-II**: Phiên bản chuẩn gốc (Deb et al., 2002)
- **RNSGA-II**: Reference-point based NSGA-II
- **DNSGA-II**: Dynamic NSGA-II
- **MOPSO-CD**: Multi-Objective Particle Swarm Optimization with Crowding Distance

### Kết quả trên bộ test ZDT

| Bài toán | Đánh giá                 | Chi tiết                                                  |
| -------- | ------------------------ | --------------------------------------------------------- |
| **ZDT1** | ⭐⭐⭐⭐⭐ **Tốt nhất**  | IGD thấp, HV cao, hội tụ nhanh và ổn định                 |
| **ZDT2** | ⭐⭐⭐⭐⭐ **Tốt nhất**  | Cân bằng tốt giữa chất lượng hội tụ và độ đa dạng         |
| **ZDT3** | ⭐⭐⭐⭐ **HV tốt nhất** | Nổi bật về độ phủ Pareto front theo chỉ số hypervolume    |
| **ZDT4** | ⭐⭐⭐⭐⭐ **Tốt nhất**  | Hiệu quả cao trên bài toán nhiều local optima             |
| **ZDT6** | ⭐⭐⭐⭐⭐ **Tốt nhất**  | Xử lý tốt Pareto front không đều, miền tìm kiếm phi tuyến |

### Chỉ số đánh giá

- **IGD (Inverted Generational Distance)**: Đo khoảng cách trung bình từ Pareto front thực đến tập nghiệm
  - _Giá trị thấp hơn = tốt hơn_
  - Improved NSGA-II cho kết quả mạnh nhất trên ZDT1, ZDT2, ZDT4 và ZDT6

- **HV (Hypervolume)**: Đo thể tích vùng không gian được chi phối bởi tập nghiệm
  - _Giá trị cao hơn = tốt hơn_
  - Improved NSGA-II đạt HV nổi bật trên toàn bộ bộ ZDT, đặc biệt tốt nhất trên ZDT3

- **Độ ổn định**: Độ lệch chuẩn (std) qua nhiều lần chạy
  - ZDT1, ZDT2, ZDT4, ZDT6: Ổn định và cho kết quả tốt nhất
  - ZDT3: Nổi bật hơn ở tiêu chí HV

### Ưu điểm nổi bật

- [x] **Chất lượng nghiệm cao**: Đạt kết quả tốt nhất trên ZDT1, ZDT2, ZDT4 và ZDT6
- [x] **Độ phủ tốt**: HV rất cao, đặc biệt nổi bật trên ZDT3
- [x] **Khả năng khám phá**: Xử lý tốt ZDT4 (nhiều local optima)
- [x] **Thích ứng**: OBL và adaptive mutation giúp hội tụ nhanh
- [x] **Đa dạng**: Duy trì phân bố nghiệm tốt trên các Pareto front phức tạp

## Độ phức tạp thuật toán

### Độ phức tạp thời gian

Cho quần thể kích thước $N$, số mục tiêu $M$:

| Thành phần             | Độ phức tạp           | Giải thích                               |
| ---------------------- | --------------------- | ---------------------------------------- |
| **Khởi tạo OBL**       | $O(N \cdot n_{var})$  | Tạo $N$ cá thể và $N$ cá thể đối ngược   |
| **Non-dominated Sort** | $O(M \cdot N^2)$      | Thuật toán Fast Non-dominated Sort (Deb) |
| **Crowding Distance**  | $O(M \cdot N \log N)$ | Sắp xếp theo từng mục tiêu               |
| **Selection**          | $O(N)$                | Tournament selection                     |
| **Crossover**          | $O(N \cdot n_{var})$  | SBX cho từng cặp cha mẹ                  |
| **Mutation**           | $O(N \cdot n_{var})$  | Polynomial mutation                      |
| **Đánh giá**           | $O(N \cdot T_{eval})$ | $T_{eval}$ = thời gian đánh giá 1 cá thể |

**Tổng mỗi thế hệ**: $O(M \cdot N^2 + N \cdot n_{var} + N \cdot T_{eval})$

Trong thực tế:

- Nếu $T_{eval}$ nhỏ (hàm đơn giản): Chi phí chính là **Non-dominated Sort** $O(M \cdot N^2)$
- Nếu $T_{eval}$ lớn (mô phỏng phức tạp): Chi phí chính là **Đánh giá** $O(N \cdot T_{eval})$

### Độ phức tạp không gian

$O(N \cdot (n_{var} + M))$

- Lưu trữ quần thể: $N$ cá thể
- Mỗi cá thể: $n_{var}$ biến quyết định + $M$ giá trị mục tiêu
- Metadata: rank, crowding distance

### So sánh với NSGA-II gốc

| Thuật toán           | Thời gian/thế hệ | Không gian     | Ghi chú                |
| -------------------- | ---------------- | -------------- | ---------------------- |
| NSGA-II              | $O(M \cdot N^2)$ | $O(N \cdot M)$ | Baseline               |
| **Improved NSGA-II** | $O(M \cdot N^2)$ | $O(N \cdot M)$ | Không tăng độ phức tạp |

**Kết luận**: Các cải tiến (OBL, adaptive mutation) không làm tăng độ phức tạp tiệm cận, chỉ thêm hằng số nhỏ.

## Cài đặt

### Yêu cầu hệ thống

- Python 3.8+
- pip hoặc conda

### Cài đặt thư viện

```bash
# Clone repository (nếu có)
git clone <repository-url>
cd source_code

# Cài đặt các thư viện cần thiết
pip install -r requirements.txt
```

### Các thư viện chính

- `numpy`: Tính toán số học và mảng
- `pandas`: Xử lý và xuất kết quả
- `matplotlib`: Vẽ đồ thị
- `seaborn`: Trực quan hóa nâng cao
- `pymoo`: Framework tối ưu hóa đa mục tiêu (cung cấp bộ test ZDT/DTLZ)
- `tabulate`: Hiển thị bảng đẹp trên console

## Sử dụng

```bash
# Chạy với quần thể 100, 200 thế hệ, 10 lần lặp
python benchmark.py --pop 100 --gen 200 --runs 10

# Chạy với quần thể lớn hơn và nhiều thế hệ hơn
python benchmark.py --pop 200 --gen 300 --runs 20

# Chạy bộ test DTLZ (3 mục tiêu)
python benchmark.py --suite dtlz --pop 150 --gen 250
```

### Các tham số dòng lệnh

| Tham số   | Mặc định | Mô tả                                    |
| --------- | -------- | ---------------------------------------- |
| `--suite` | `zdt`    | Bộ bài toán: `zdt` hoặc `dtlz`           |
| `--pop`   | `100`    | Kích thước quần thể                      |
| `--gen`   | `200`    | Số thế hệ tối đa                         |
| `--runs`  | `10`     | Số lần chạy lặp lại (để tính mean ± std) |
| `--seed`  | `42`     | Seed ngẫu nhiên gốc                      |

### Kết quả đầu ra

Sau khi chạy xong, bạn sẽ nhận được:

1. **Đồ thị hội tụ**: IGD, HV theo thế hệ + Pareto front 2D/3D
   - Hiển thị True Pareto Front (đường đen)
   - Hiển thị NSGA-II Front (chấm đỏ rỗng)

2. **Biểu đồ boxplot**: Phân phối IGD, HV qua tất cả bài toán

3. **Bảng tổng hợp** (console): Mean ± std của IGD, HV, Time

4. **File CSV**:
   - `benchmark_raw.csv`: Dữ liệu thô từng lần chạy
   - `benchmark_summary.csv`: Kết quả tổng hợp (mean, std)

### Sử dụng trong code Python

```python
from nsga2_improved import NSGA2ImprovedSmart, ProblemWrapper
from pymoo.problems import get_problem
import numpy as np

# Tạo bài toán
problem = get_problem("zdt1", n_var=30)
wrapper = ProblemWrapper(problem)

# Khởi tạo thuật toán
solver = NSGA2ImprovedSmart(wrapper, pop_size=100, n_gen=200)

# Chạy thuật toán
pareto_front = solver.run()

# Kết quả
print(f"Số nghiệm Pareto: {len(pareto_front)}")
print(f"Giá trị mục tiêu:\n{pareto_front}")
```

## Tài liệu tham khảo

1. **Deb, K., et al. (2002)**  
   _"A fast and elitist multiobjective genetic algorithm: NSGA-II"_  
   IEEE Transactions on Evolutionary Computation, 6(2), 182-197.  
   Link: https://doi.org/10.1109/4235.996017

2. **Tizhoosh, H. R. (2005)**  
   _"Opposition-based learning: A new scheme for machine intelligence"_  
   International Conference on Computational Intelligence for Modelling, Control and Automation.  
   Link: https://ieeexplore.ieee.org/abstract/document/1631345/

3. **Deb, K., & Agrawal, R. B. (1995)**  
   _"Simulated binary crossover for continuous search space"_  
   Complex Systems, 9(2), 115-148.  
   Link: https://www.complex-systems.com/abstracts/v09_i02_a02/

4. **Zitzler, E., et al. (2000)**  
   _"Comparison of multiobjective evolutionary algorithms: Empirical results"_  
   Evolutionary Computation, 8(2), 173-195.  
   Link: https://doi.org/10.1162/106365600568202

5. **Deb, K., Thiele, L., Laumanns, M., & Zitzler, E. (2005)**  
   _"Scalable test problems for evolutionary multiobjective optimization"_  
   Evolutionary Multiobjective Optimization, 105-145.  
   Link: https://doi.org/10.1007/1-84628-137-7_6

6. **Zitzler, E., Knowles, J., & Thiele, L. (2008)**  
   _"Quality assessment of Pareto set approximations"_  
   Multiobjective Optimization, 373-404.  
   Link: https://doi.org/10.1007/978-3-540-88908-3_14

7. **Ishibuchi, H., Masuda, H., Tanigaki, Y., & Nojima, Y. (2015)**  
   _"Modified distance calculation in generational distance and inverted generational distance"_  
   EMO 2015, Part I, LNCS 9018, 110-125.  
   Link: https://doi.org/10.1007/978-3-319-15892-1_8

8. **Blank, J., & Deb, K. (2020)**  
   _"pymoo: Multi-objective optimization in Python"_  
   IEEE Access, 8, 89497-89509.  
   Link: https://ieeexplore.ieee.org/abstract/document/9078759/

## License

MIT License - Tự do sử dụng cho mục đích nghiên cứu và thương mại.

## Liên hệ

Nếu có câu hỏi hoặc vấn đề, vui lòng tạo Issue trên GitHub.

---

**Improved NSGA-II** - Tối ưu hóa đa mục tiêu hiệu quả cho thế kỷ 21 🚀
