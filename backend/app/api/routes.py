from __future__ import annotations

from io import BytesIO
import json

import pandas as pd
from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import Response, StreamingResponse
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas

from ..schemas.models import DoctorsPayload, OptimizeRequest, SetupPayload
from ..services.scheduler import compute_reports, create_job, run_optimization_job, stream_events
from ..schemas.models import Doctor
from ..state import state


router = APIRouter(prefix="/api")


@router.get(
    "/health",
    tags=["System"],
    summary="Health check",
    description="Check if backend API is running and reachable.",
)
async def health() -> dict:
    return {"ok": True}


@router.get(
    "/setup",
    tags=["Setup"],
    summary="Get constraints setup",
    description="Read current constraint configuration used by the optimizer.",
)
async def get_setup() -> dict:
    return state.config.model_dump()


@router.put(
    "/setup",
    tags=["Setup"],
    summary="Update constraints setup",
    description="Save scheduling constraint groups A-F into in-memory state.",
)
async def update_setup(payload: SetupPayload) -> dict:
    state.config = payload.config
    return {"ok": True, "config": state.config.model_dump()}


@router.get(
    "/doctors",
    tags=["Doctors"],
    summary="Get doctor roster",
    description="Return the full doctor list currently loaded in backend memory.",
)
async def get_doctors() -> dict:
    return {"doctors": [d.model_dump() for d in state.doctors]}


@router.put(
    "/doctors",
    tags=["Doctors"],
    summary="Replace doctor roster",
    description="Overwrite doctor list in backend memory with provided doctors payload.",
)
async def set_doctors(payload: DoctorsPayload) -> dict:
    state.doctors = payload.doctors
    return {"ok": True, "count": len(state.doctors)}


@router.post(
    "/doctors/import-excel",
    tags=["Doctors"],
    summary="Import doctors from Excel",
    description=(
        "Upload Excel file (.xlsx/.xls) with doctor columns to parse and store roster. "
        "Required columns: id, full_name, title, specialty."
    ),
)
async def import_doctors_excel(file: UploadFile = File(...)) -> dict:
    content = await file.read()
    frame = pd.read_excel(BytesIO(content))

    required = {"id", "full_name", "title", "specialty"}
    if not required.issubset(set(frame.columns)):
        raise HTTPException(status_code=400, detail=f"Missing columns: {sorted(required)}")

    doctors = []
    for _, row in frame.iterrows():
        doctors.append(
            Doctor(
                id=str(row.get("id", "")).strip(),
                full_name=str(row.get("full_name", "")).strip(),
                title=str(row.get("title", "BS")).strip(),
                specialty=str(row.get("specialty", "general")).strip(),
                seniority_score=int(row.get("seniority_score", 1) or 1),
                flags={
                    "pregnant": bool(row.get("pregnant", False)),
                    "senior": bool(row.get("senior", False)),
                    "part_time": bool(row.get("part_time", False)),
                    "difficult_circumstances": bool(row.get("difficult_circumstances", False)),
                },
                historical_night_count_12m=int(row.get("historical_night_count_12m", 0) or 0),
                historical_holiday_count_12m=int(row.get("historical_holiday_count_12m", 0) or 0),
            )
        )

    state.doctors = doctors
    return {"ok": True, "count": len(doctors)}


@router.post(
    "/optimize/start",
    tags=["Optimization"],
    summary="Start NSGA-II optimization",
    description="Create optimization job and run asynchronously for requested month.",
)
async def optimize_start(payload: OptimizeRequest) -> dict:
    if not state.doctors:
        raise HTTPException(status_code=400, detail="No doctors configured")

    job = create_job(payload.month)

    async def run_wrapper() -> None:
        try:
            await run_optimization_job(job.id, payload.month, payload.population_size, payload.generations)
        except Exception as exc:  # noqa: BLE001
            state.jobs[job.id].status = "failed"
            await state.event_channels[job.id].put({"type": "failed", "message": str(exc)})

    import asyncio

    asyncio.create_task(run_wrapper())
    return {"job_id": job.id}


@router.get(
    "/optimize/stream/{job_id}",
    tags=["Optimization"],
    summary="Stream optimization progress (SSE)",
    description="Server-Sent Events stream for realtime progress and final Pareto results.",
)
async def optimize_stream(job_id: str) -> StreamingResponse:
    if job_id not in state.jobs:
        raise HTTPException(status_code=404, detail="Job not found")

    async def event_generator():
        async for payload in stream_events(job_id):
            text = json.dumps(payload, ensure_ascii=True)
            yield f"data: {text}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@router.get(
    "/schedule/{month}",
    tags=["Schedule"],
    summary="Get monthly schedule solutions",
    description="Return selected solution and all generated solutions for a month.",
)
async def get_schedule(month: str) -> dict:
    selected = state.get_selected_solution(month)
    return {
        "month": month,
        "selected_solution_id": selected.solution_id if selected else None,
        "solution": selected.model_dump() if selected else None,
        "all_solutions": [s.model_dump() for s in state.schedules_by_month.get(month, [])],
    }


@router.post(
    "/schedule/{month}/select/{solution_id}",
    tags=["Schedule"],
    summary="Select active schedule solution",
    description="Set selected solution id to be used by reports and UI detail view.",
)
async def select_solution(month: str, solution_id: str) -> dict:
    available = state.schedules_by_month.get(month, [])
    if not any(s.solution_id == solution_id for s in available):
        raise HTTPException(status_code=404, detail="Solution not found")
    state.selected_solution_by_month[month] = solution_id
    return {"ok": True}


@router.get(
    "/reports/{month}",
    tags=["Reports"],
    summary="Get fairness report",
    description="Calculate per-doctor summary metrics from selected schedule.",
)
async def reports(month: str) -> dict:
    data = compute_reports(month)
    return {"month": month, "rows": data}


@router.get(
    "/reports/{month}/export/excel",
    tags=["Reports"],
    summary="Export report to Excel",
    description="Download fairness report as XLSX file.",
)
async def export_reports_excel(month: str) -> StreamingResponse:
    rows = compute_reports(month)
    frame = pd.DataFrame(rows)

    stream = BytesIO()
    frame.to_excel(stream, index=False)
    stream.seek(0)

    headers = {"Content-Disposition": f"attachment; filename=reports-{month}.xlsx"}
    return StreamingResponse(
        stream,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers=headers,
    )


@router.get(
    "/reports/{month}/export/pdf",
    tags=["Reports"],
    summary="Export report to PDF",
    description="Download fairness report as PDF file.",
)
async def export_reports_pdf(month: str) -> Response:
    rows = compute_reports(month)

    stream = BytesIO()
    pdf = canvas.Canvas(stream, pagesize=A4)
    width, height = A4
    y = height - 40

    pdf.setFont("Helvetica-Bold", 12)
    pdf.drawString(40, y, f"Doctor Scheduling Report - {month}")
    y -= 24

    pdf.setFont("Helvetica", 9)
    for row in rows:
        line = (
            f"{row['doctor_name']}: shifts={row['total_shifts']}, hours={row['total_hours']}, "
            f"night={row['night_shifts']}, holiday={row['holiday_shifts']}"
        )
        pdf.drawString(40, y, line)
        y -= 14
        if y < 50:
            pdf.showPage()
            y = height - 40
            pdf.setFont("Helvetica", 9)

    pdf.save()
    stream.seek(0)
    headers = {"Content-Disposition": f"attachment; filename=reports-{month}.pdf"}
    return Response(content=stream.getvalue(), media_type="application/pdf", headers=headers)


@router.post(
    "/seed",
    tags=["Doctors"],
    summary="Seed sample doctors",
    description="Load 15 sample doctors for quick demo/testing without manual import.",
)
async def seed_sample_data() -> dict:
    """Initialize with 15 sample doctors for quick testing."""
    sample_doctors = [
        Doctor(id="001", full_name="Nguyễn Văn An", title="Dr.", specialty="Cardiology", seniority_score=8),
        Doctor(id="002", full_name="Trần Thị Bình", title="Dr.", specialty="General", seniority_score=6, flags={"pregnant": True, "senior": False, "part_time": False, "difficult_circumstances": False}),
        Doctor(id="003", full_name="Lê Văn Công", title="Prof.", specialty="Surgery", seniority_score=9, flags={"pregnant": False, "senior": True, "part_time": False, "difficult_circumstances": False}),
        Doctor(id="004", full_name="Hoàng Thị Diệu", title="Dr.", specialty="Pediatrics", seniority_score=5),
        Doctor(id="005", full_name="Phạm Minh Đức", title="Dr.", specialty="Orthopedic", seniority_score=7, flags={"pregnant": False, "senior": False, "part_time": False, "difficult_circumstances": True}),
        Doctor(id="006", full_name="Võ Thị Emilia", title="Dr.", specialty="Dermatology", seniority_score=4, flags={"pregnant": False, "senior": False, "part_time": True, "difficult_circumstances": False}),
        Doctor(id="007", full_name="Đặng Văn Phong", title="Dr.", specialty="ENT", seniority_score=6),
        Doctor(id="008", full_name="Cao Thị Giang", title="Dr.", specialty="Oncology", seniority_score=8),
        Doctor(id="009", full_name="Vũ Văn Hùng", title="Dr.", specialty="Neurology", seniority_score=7, flags={"pregnant": False, "senior": True, "part_time": False, "difficult_circumstances": False}),
        Doctor(id="010", full_name="Bùi Thị Iris", title="Dr.", specialty="General", seniority_score=5),
        Doctor(id="011", full_name="Dương Văn Khiêm", title="Dr.", specialty="Cardiology", seniority_score=6, flags={"pregnant": False, "senior": False, "part_time": True, "difficult_circumstances": False}),
        Doctor(id="012", full_name="Trương Thị Liễu", title="Prof.", specialty="Surgery", seniority_score=9, flags={"pregnant": False, "senior": True, "part_time": False, "difficult_circumstances": False}),
        Doctor(id="013", full_name="Lý Văn Minh", title="Dr.", specialty="Pediatrics", seniority_score=5),
        Doctor(id="014", full_name="Ngô Thị Nhi", title="Dr.", specialty="General", seniority_score=7),
        Doctor(id="015", full_name="Phan Văn Oán", title="Dr.", specialty="Orthopedic", seniority_score=4, flags={"pregnant": False, "senior": False, "part_time": False, "difficult_circumstances": True}),
    ]
    state.doctors = sample_doctors
    return {"ok": True, "message": f"Seeded {len(sample_doctors)} sample doctors", "count": len(sample_doctors)}
