"""
Runner thực nghiệm cho Improved NSGA-II trên các bộ bài toán chuẩn ZDT / DTLZ.

Chức năng
---------
    - Cấu hình thực nghiệm qua ExperimentConfig
    - Chạy nhiều lần (multi-run) với các seed khác nhau
    - Tính IGD, HV theo từng thế hệ
    - Tổng hợp mean ± std qua các lần chạy
    - Vẽ đồ thị hội tụ và boxplot
    - Xuất kết quả ra CSV và Word (.docx) theo đúng định dạng báo cáo

Dùng từ dòng lệnh
-----------------
    python benchmark.py                        # ZDT suite, cài đặt mặc định
    python benchmark.py --suite dtlz           # DTLZ suite
    python benchmark.py --pop 100 --gen 200 --runs 10
"""

from __future__ import annotations

import argparse
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, List, Optional

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import seaborn as sns
from pymoo.indicators.hv import HV
from pymoo.indicators.igd import IGD
from pymoo.problems import get_problem
from tabulate import tabulate

from nsga2_improved import NSGA2ImprovedSmart, ProblemWrapper


# ─────────────────────────────────────────────────────────────────────────────
# Cấu hình thực nghiệm
# ─────────────────────────────────────────────────────────────────────────────

@dataclass
class ExperimentConfig:
    """Toàn bộ tham số cho một phiên benchmark."""
    pop_size:  int = 100
    n_gen:     int = 200
    n_runs:    int = 10
    seed_base: int = 42

    # Bộ bài toán ZDT
    ZDT_PROBLEMS: List[str] = field(default_factory=lambda: [
        "zdt1", "zdt2", "zdt3", "zdt4", "zdt6",
    ])
    ZDT_N_VAR: Dict[str, int] = field(default_factory=lambda: {
        "zdt1": 30, "zdt2": 30, "zdt3": 30,
        "zdt4": 10, "zdt6": 10,
    })

    # Bộ bài toán DTLZ
    DTLZ_PROBLEMS: List[str] = field(default_factory=lambda: [
        "dtlz1", "dtlz2", "dtlz3", "dtlz4", "dtlz5", "dtlz6", "dtlz7",
    ])
    DTLZ_K: Dict[str, int] = field(default_factory=lambda: {
        "dtlz1": 5,  "dtlz2": 10, "dtlz3": 10, "dtlz4": 10,
        "dtlz5": 10, "dtlz6": 10, "dtlz7": 20,
    })
    DTLZ_N_OBJ: int = 3


# ─────────────────────────────────────────────────────────────────────────────
# Xây dựng bài toán
# ─────────────────────────────────────────────────────────────────────────────
def build_problem(
    name: str,
    cfg:  ExperimentConfig,
) -> tuple[ProblemWrapper, int, int]:
    """Tạo ProblemWrapper và trả về (wrapper, n_var, n_obj).

    Tham số
    -------
    name : tên bài toán (vd: 'zdt1', 'dtlz2')
    cfg  : cấu hình chứa thông tin số biến / số mục tiêu
    """
    name_lower = name.lower()

    if "dtlz" in name_lower:
        n_obj = cfg.DTLZ_N_OBJ
        k     = cfg.DTLZ_K.get(name_lower, 10)
        n_var = n_obj + k - 1
        pymoo_prob = get_problem(name_lower, n_obj=n_obj, n_var=n_var)
    else:
        n_var      = cfg.ZDT_N_VAR.get(name_lower, 30)
        pymoo_prob = get_problem(name_lower, n_var=n_var)
        n_obj      = pymoo_prob.n_obj

    return ProblemWrapper(pymoo_prob), n_var, n_obj


# ─────────────────────────────────────────────────────────────────────────────
# Kết quả một lần chạy
# ─────────────────────────────────────────────────────────────────────────────
@dataclass
class RunResult:
    """Lưu trữ toàn bộ kết quả của một lần chạy thuật toán."""
    problem:     str
    algorithm:   str
    n_var:       int
    n_obj:       int
    igd:         float
    hv:          float
    time_s:      float
    igd_history: List[float]
    hv_history:  List[float]
    final_front: np.ndarray
    true_pf:     Optional[np.ndarray] = None


# ─────────────────────────────────────────────────────────────────────────────
# Chạy một lần thực nghiệm
# ─────────────────────────────────────────────────────────────────────────────
def run_single(
    problem_name: str,
    cfg:          ExperimentConfig,
    seed:         int,
    initial_x:    Optional[np.ndarray] = None,
) -> RunResult:
    """Thực thi thuật toán một lần và trả về kết quả đầy đủ.

    Tham số
    -------
    problem_name : tên bài toán
    cfg          : cấu hình thực nghiệm
    seed         : seed ngẫu nhiên để tái lập kết quả
    initial_x    : vector quyết định khởi đầu (tuỳ chọn, None = dùng OBL)
    """
    np.random.seed(seed)

    wrapper, n_var, n_obj = build_problem(problem_name, cfg)
    pymoo_prob            = wrapper._prob
    solver                = NSGA2ImprovedSmart(wrapper, pop_size=cfg.pop_size, n_gen=cfg.n_gen)

    # Đo thời gian chạy
    t0          = time.perf_counter()
    final_front = solver.run(initial_x=initial_x)
    elapsed     = time.perf_counter() - t0

    # Chuẩn bị chỉ tiêu IGD và HV
    true_pf = pymoo_prob.pareto_front()
    ref_pt  = (
        np.max(true_pf, axis=0) if true_pf is not None
        else np.max(final_front, axis=0)
    ) * 1.1

    igd_fn = IGD(true_pf) if true_pf is not None else None
    hv_fn  = HV(ref_point=ref_pt)

    # Tính IGD và HV theo từng thế hệ từ lịch sử hội tụ
    igd_history: List[float] = []
    hv_history:  List[float] = []

    for gen_F in solver.history:
        igd_history.append(float(igd_fn(gen_F)) if igd_fn is not None else 0.0)
        try:
            hv_history.append(float(hv_fn(gen_F)))
        except Exception:
            hv_history.append(0.0)

    return RunResult(
        problem     = problem_name.upper(),
        algorithm   = "Improved NSGA-II",
        n_var       = n_var,
        n_obj       = n_obj,
        igd         = igd_history[-1] if igd_history else 0.0,
        hv          = hv_history[-1]  if hv_history  else 0.0,
        time_s      = elapsed,
        igd_history = igd_history,
        hv_history  = hv_history,
        final_front = final_front,
        true_pf     = true_pf,
    )


# ─────────────────────────────────────────────────────────────────────────────
# Benchmark nhiều bài toán × nhiều runs
# ─────────────────────────────────────────────────────────────────────────────

def run_benchmark(
    problems: List[str],
    cfg:      ExperimentConfig,
) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Chạy benchmark toàn bộ danh sách bài toán với n_runs seed khác nhau.

    Trả về
    ------
    df_summary : DataFrame một hàng mỗi bài toán, chứa mean ± std
    df_raw     : DataFrame một hàng mỗi (bài toán, lần chạy), chứa số liệu thô
    """
    print(f"\n{'='*70}")
    print(
        f"  Benchmark: Improved NSGA-II  |  "
        f"pop={cfg.pop_size}  gen={cfg.n_gen}  runs={cfg.n_runs}"
    )
    print(f"{'='*70}\n")

    summary_rows: List[dict] = []
    raw_rows:     List[dict] = []

    for p_name in problems:
        print(f"  → {p_name.upper()} ({cfg.n_runs} lần chạy)  ", end="", flush=True)
        run_results: List[RunResult] = []

        for run_idx in range(cfg.n_runs):
            result = run_single(p_name, cfg, seed=cfg.seed_base + run_idx)
            run_results.append(result)
            raw_rows.append({
                "Problem":   result.problem,
                "Algorithm": result.algorithm,
                "n_Var":     result.n_var,
                "n_Obj":     result.n_obj,
                "IGD":       result.igd,
                "HV":        result.hv,
                "Time (s)":  result.time_s,
            })
            print(".", end="", flush=True)

        # Tổng hợp kết quả qua các lần chạy
        igds  = [r.igd    for r in run_results]
        hvs   = [r.hv     for r in run_results]
        times = [r.time_s for r in run_results]

        summary_rows.append({
            "Problem":   p_name.upper(),
            "Algorithm": "Improved NSGA-II",
            "n_Var":     run_results[0].n_var,
            "n_Obj":     run_results[0].n_obj,
            "IGD_mean":  float(np.mean(igds)),
            "IGD_std":   float(np.std(igds)),
            "HV_mean":   float(np.mean(hvs)),
            "HV_std":    float(np.std(hvs)),
            "Time_mean": float(np.mean(times)),
        })

        # Vẽ biểu đồ cho lần chạy cuối cùng
        _plot_convergence_and_front(run_results[-1])
        print("  XONG")

    return pd.DataFrame(summary_rows), pd.DataFrame(raw_rows)


# ─────────────────────────────────────────────────────────────────────────────
# Định dạng số khoa học
# ─────────────────────────────────────────────────────────────────────────────

def _fmt_sci(value: float, precision: int = 4) -> str:
    """Định dạng số thực sang ký hiệu khoa học

    Ví dụ:
        0.0061  → "6.1000e-03"
        1.0228  → "1.0228e+00"
        0.0018  → "1.8000e-03"

    Tham số
    -------
    value     : số cần định dạng
    precision : số chữ số sau dấu thập phân trong phần định trị
    """
    formatted = f"{value:.{precision}e}"

    # Chuẩn hoá số mũ về 2 chữ số
    mantissa, exponent = formatted.split("e")
    sign = exponent[0]                             # '+' hoặc '-'
    exp_digits = exponent[1:].lstrip("0") or "0"  # bỏ số 0 thừa đầu
    exp_padded = exp_digits.zfill(2)               # đảm bảo ít nhất 2 chữ số
    return f"{mantissa}e{sign}{exp_padded}"

# ─────────────────────────────────────────────────────────────────────────────
# Vẽ đồ thị
# ─────────────────────────────────────────────────────────────────────────────
plt.style.use("seaborn-v0_8-whitegrid")


def _plot_convergence_and_front(result: RunResult) -> None:
    """Vẽ 3 biểu đồ: IGD theo thế hệ, HV theo thế hệ, Pareto front tìm được."""
    is_3d = result.n_obj == 3
    fig   = plt.figure(figsize=(18, 5))
    fig.suptitle(f"Kết quả thực nghiệm: {result.problem}", fontsize=14, fontweight="bold")

    # Biểu đồ 1: IGD hội tụ theo thế hệ
    ax1 = fig.add_subplot(1, 3, 1)
    ax1.plot(result.igd_history, color="#1f77b4", linewidth=2)
    ax1.set_title("IGD hội tụ  (thấp hơn = tốt hơn)", fontsize=11)
    ax1.set_xlabel("Thế hệ")
    ax1.set_ylabel("IGD")

    # Biểu đồ 2: HV hội tụ theo thế hệ
    ax2 = fig.add_subplot(1, 3, 2)
    ax2.plot(result.hv_history, color="#2ca02c", linewidth=2)
    ax2.set_title("HV hội tụ  (cao hơn = tốt hơn)", fontsize=11)
    ax2.set_xlabel("Thế hệ")
    ax2.set_ylabel("Hypervolume")

    # Biểu đồ 3: Pareto front tìm được so với True Pareto Front
    if is_3d:
        ax3 = fig.add_subplot(1, 3, 3, projection="3d")
        # Vẽ True Pareto Front nếu có
        if result.true_pf is not None:
            ax3.plot(
                result.true_pf[:, 0], result.true_pf[:, 1], result.true_pf[:, 2],
                color="black", linewidth=2, label="True Pareto Front", alpha=0.7
            )
        # Vẽ kết quả NSGA-II
        ax3.scatter(
            result.final_front[:, 0], result.final_front[:, 1], result.final_front[:, 2],
            facecolors='none', s=50, edgecolors="red", linewidth=0.8, label="NSGA-II"
        )
        ax3.set_title("Pareto front (3D)", fontsize=11)
        ax3.view_init(elev=30, azim=45)
    else:
        ax3 = fig.add_subplot(1, 3, 3)
        # Vẽ True Pareto Front nếu có
        if result.true_pf is not None:
            ax3.plot(
                result.true_pf[:, 0], result.true_pf[:, 1],
                color="black", linewidth=2, label="True Pareto Front", alpha=0.7
            )
        # Vẽ kết quả NSGA-II
        ax3.scatter(
            result.final_front[:, 0], result.final_front[:, 1],
            facecolors='none', s=50, edgecolors="red", linewidth=0.5, label="NSGA-II"
        )
        ax3.set_title("Pareto front (2D)", fontsize=11)

    ax3.legend(loc='best')
    ax3.grid(True, alpha=0.3)
    plt.tight_layout()
    plt.show()


def plot_boxplots(df_raw: pd.DataFrame) -> None:
    """Vẽ boxplot phân phối IGD và HV qua tất cả bài toán."""
    fig, axes = plt.subplots(1, 2, figsize=(16, 6))

    sns.boxplot(
        data=df_raw, x="Problem", y="IGD", hue="Problem",
        legend=False, ax=axes[0], palette="Blues",
    )
    axes[0].set_title("Phân phối IGD  (thấp hơn = tốt hơn)", fontsize=12, fontweight="bold")
    axes[0].set_ylabel("IGD")
    axes[0].grid(True, linestyle="--", alpha=0.7)

    sns.boxplot(
        data=df_raw, x="Problem", y="HV", hue="Problem",
        legend=False, ax=axes[1], palette="Greens",
    )
    axes[1].set_title("Phân phối HV  (cao hơn = tốt hơn)", fontsize=12, fontweight="bold")
    axes[1].set_ylabel("Hypervolume")
    axes[1].grid(True, linestyle="--", alpha=0.7)

    plt.tight_layout()
    plt.show()


# ─────────────────────────────────────────────────────────────────────────────
# Entry point
# ─────────────────────────────────────────────────────────────────────────────
def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Benchmark Improved NSGA-II")
    parser.add_argument("--suite", choices=["zdt", "dtlz"], default="zdt",
                        help="Bộ bài toán chuẩn (mặc định: zdt)")
    parser.add_argument("--pop",   type=int, default=100,  help="Kích thước quần thể")
    parser.add_argument("--gen",   type=int, default=200,  help="Số thế hệ")
    parser.add_argument("--runs",  type=int, default=10,   help="Số lần chạy lặp lại")
    parser.add_argument("--seed",  type=int, default=42,   help="Seed gốc")
    return parser.parse_args()


def main() -> None:
    args = _parse_args()
    cfg  = ExperimentConfig(
        pop_size  = args.pop,
        n_gen     = args.gen,
        n_runs    = args.runs,
        seed_base = args.seed,
    )
    suite_title = "ZDT Suite" if args.suite == "zdt" else "DTLZ Suite"
    problems    = cfg.ZDT_PROBLEMS if args.suite == "zdt" else cfg.DTLZ_PROBLEMS

    df_summary, df_raw = run_benchmark(problems, cfg)

    # ── In bảng tổng hợp ra console ──────────────────────────────────────
    print(f"\n{'='*80}")
    print(f"  KẾT QUẢ TỔNG HỢP ({cfg.n_runs} lần chạy mỗi bài toán)".center(80))
    print(f"{'='*80}")

    # Format cột console để dễ đọc
    df_display = df_summary.copy()
    df_display["IGD (mean±std)"] = df_display.apply(
        lambda r: f"{_fmt_sci(r['IGD_mean'])} (±{_fmt_sci(r['IGD_std'])})", axis=1
    )
    df_display["HV (mean±std)"] = df_display.apply(
        lambda r: f"{_fmt_sci(r['HV_mean'])} (±{_fmt_sci(r['HV_std'])})", axis=1
    )
    print(tabulate(
        df_display[["Problem", "Algorithm", "n_Var", "n_Obj",
                    "IGD (mean±std)", "HV (mean±std)", "Time_mean"]],
        headers=["Problem", "Algorithm", "n_Var", "n_Obj",
                 "IGD (mean±std)", "HV (mean±std)", "Time (s)"],
        tablefmt="fancy_grid", showindex=False,
    ))

    # ── Vẽ boxplot ───────────────────────────────────────────────────────
    plot_boxplots(df_raw)

    # ── Xuất file ────────────────────────────────────────────────────────
    print("\nĐang lưu kết quả...")

    # CSV thô — để phân tích thêm sau
    df_raw.to_csv("benchmark_raw.csv", index=False)

    # CSV tổng hợp — giữ cột số để dễ tải lại
    df_summary.to_csv("benchmark_summary.csv", index=False)

    print("Đã lưu:\n  • benchmark_raw.csv\n  • benchmark_summary.csv\n")


if __name__ == "__main__":
    main()