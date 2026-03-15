from __future__ import annotations

import asyncio
from collections import defaultdict
from dataclasses import dataclass, field
from typing import Dict, List, Optional

from .schemas.models import ConstraintsConfig, Doctor, OptimizationJob, ScheduleSolution


@dataclass
class AppState:
    config: ConstraintsConfig = field(default_factory=ConstraintsConfig)
    doctors: List[Doctor] = field(default_factory=list)
    jobs: Dict[str, OptimizationJob] = field(default_factory=dict)
    schedules_by_month: Dict[str, List[ScheduleSolution]] = field(default_factory=dict)
    selected_solution_by_month: Dict[str, str] = field(default_factory=dict)
    event_channels: Dict[str, asyncio.Queue] = field(default_factory=lambda: defaultdict(asyncio.Queue))

    def get_selected_solution(self, month: str) -> Optional[ScheduleSolution]:
        solutions = self.schedules_by_month.get(month, [])
        selected_id = self.selected_solution_by_month.get(month)
        if not selected_id:
            return solutions[0] if solutions else None
        for item in solutions:
            if item.solution_id == selected_id:
                return item
        return None


state = AppState()
