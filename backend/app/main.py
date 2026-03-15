from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api.routes import router


tags_metadata = [
    {
        "name": "System",
        "description": "Health check and system-level endpoints.",
    },
    {
        "name": "Setup",
        "description": "Read and update scheduling constraints configuration.",
    },
    {
        "name": "Doctors",
        "description": "Manage doctor roster and import sample/source data.",
    },
    {
        "name": "Optimization",
        "description": "Start NSGA-II optimization and stream realtime progress via SSE.",
    },
    {
        "name": "Schedule",
        "description": "Retrieve generated schedules and select preferred solution.",
    },
    {
        "name": "Reports",
        "description": "View fairness reports and export to Excel/PDF.",
    },
]


app = FastAPI(
    title="Doctor Scheduling NSGA-II API",
    version="0.2.0",
    description=(
        "API for hospital doctor scheduling using NSGA-II multi-objective optimization. "
        "Workflow: setup constraints -> load doctors -> start optimization -> "
        "monitor SSE stream -> select schedule -> export reports."
    ),
    openapi_tags=tags_metadata,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)
