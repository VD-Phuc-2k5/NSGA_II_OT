"""
Package thuật toán Improved NSGA-II.

Dùng nhanh
----------
    from nsga2 import ProblemWrapper, NSGA2ImprovedSmart
    solver = NSGA2ImprovedSmart(problem, pop_size=100, n_gen=200)
    front  = solver.run()
"""

from .algorithm import NSGA2ImprovedSmart
from .core import CreationMode, Individual, ProblemWrapper

__all__ = ["NSGA2ImprovedSmart", "ProblemWrapper", "Individual", "CreationMode"]