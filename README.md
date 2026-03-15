# Doctor Scheduling Optimization System

A full-stack web application for doctor scheduling using NSGA-II (Non-dominated Sorting Genetic Algorithm II) optimization.

## 🏗️ Architecture

**Backend**: FastAPI (Python) with NSGA-II optimization
**Frontend**: Next.js 16 (React + TypeScript)
**Database**: In-memory state management
**Algorithm**: Improved NSGA-II for multi-objective optimization

## ✨ Features

### 1. **Setup** (`/setup`)

- Configure 6 constraint groups (A-F)
- Set optimization weights for fairness metrics
- Define hospital tier requirements and shift staffing rules

### 2. **Doctors** (`/doctors`)

- Manual doctor entry with experience levels and specialties
- Excel/CSV bulk import
- Availability matrix preview
- Track seniority scores and special circumstances

### 3. **Scheduling** (`/schedule/[month]`)

- Real-time NSGA-II optimization via Server-Sent Events (SSE)
- Pareto front visualization (scatter plot of objectives)
- Click to select optimal solutions
- Drag-drop schedule adjustments with constraint validation
- Live shift count visualization

### 4. **Reports** (`/reports`)

- Doctor fairness statistics (shifts, hours, night shifts, holidays)
- Bar chart visualizations
- Export to PDF or Excel

## 🚀 Quick Start

### Prerequisites

- Python 3.12+ (✅ Already installed)
- Node.js 20+ (✅ Already installed)
- Virtual environment active: `source_code\venv\`

### Installation (Already Done ✅)

**Backend dependencies**:

```bash
cd backend
pip install -r requirements.txt
```

**Frontend dependencies**:

```bash
cd frontend
npm install
```

### Running the Application

#### Option 1: Batch Files (Windows - Easiest)

From the `source_code` directory, open **two command prompts** side-by-side:

**Terminal 1** - Right-click and run:

```bash
start-backend.bat
```

**Terminal 2** - Right-click and run:

```bash
start-frontend.bat
```

Then open http://localhost:3000 in your browser.

#### Option 2: PowerShell Script

```powershell
# From the source_code directory
.\run-dev-simple.ps1
```

#### Option 3: Manual Commands

**Terminal 1 - Backend**:

```powershell
cd backend
& ..\venv\Scripts\Activate.ps1
$env:PYTHONPATH = ".."
python -m uvicorn app.main:app --reload --port 8000
```

**Terminal 2 - Frontend**:

```powershell
cd frontend
npm run dev
```

**Then open**: http://localhost:3000

## 📚 API Documentation

Once backend is running, visit:

- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

### Key Endpoints

| Method       | Endpoint                                 | Purpose                            |
| ------------ | ---------------------------------------- | ---------------------------------- |
| GET/PUT      | `/setup`                                 | Load/save constraint configuration |
| GET/PUT/POST | `/doctors/{id}`                          | Manage doctor roster               |
| POST         | `/doctors/import-excel`                  | Bulk import from Excel             |
| POST         | `/optimize/start`                        | Start NSGA-II optimization job     |
| GET          | `/optimize/stream/{job_id}`              | Stream optimization progress (SSE) |
| GET          | `/schedule/{month}`                      | Get Pareto solutions for month     |
| POST         | `/schedule/{month}/select/{solution_id}` | Select solution                    |
| GET          | `/reports/{month}`                       | Generate fairness report           |
| GET          | `/reports/{month}/export/excel`          | Export as Excel file               |
| GET          | `/reports/{month}/export/pdf`            | Export as PDF file                 |

## 📂 Project Structure

```
source_code/
├── backend/
│   ├── app/
│   │   ├── main.py                 # FastAPI app setup
│   │   ├── state.py               # Global application state
│   │   ├── api/
│   │   │   └── routes.py          # All 14 REST endpoints
│   │   ├── schemas/
│   │   │   └── models.py          # Pydantic data models
│   │   └── services/
│   │       └── scheduler.py       # NSGA-II integration
│   └── requirements.txt
├── frontend/
│   ├── app/
│   │   ├── page.tsx               # Home page
│   │   ├── setup/page.tsx         # Constraint configuration
│   │   ├── doctors/page.tsx       # Doctor management
│   │   ├── schedule/[month]/page.tsx  # Optimization & selection
│   │   ├── reports/page.tsx       # Fairness statistics
│   │   ├── layout.tsx             # Root layout
│   │   └── globals.css            # Global styles
│   ├── lib/
│   │   ├── api.ts                 # API client
│   │   └── types.ts               # TypeScript interfaces
│   ├── components/
│   │   └── nav.tsx                # Navigation bar
│   └── package.json
├── nsga2_improved/                 # Original NSGA-II library
├── venv/                           # Python virtual environment ✅
└── run-dev.ps1                     # Development launcher script
```

## 🔄 Workflow

1. **Setup**: Define constraints and optimization weights
2. **Doctors**: Add doctors and their availability
3. **Optimize**: Run NSGA-II to generate Pareto-optimal solutions
4. **Schedule**: Select best solution and make manual adjustments
5. **Reports**: View fairness metrics and export results

### Quick Test Workflow

Want to test quickly? Here's the fastest way:

1. ✅ Go to **Setup** page → Click "Lưu cấu hình" (save config) with defaults
2. 📋 Go to **Doctors** page → Import sample CSV:
   - Open [doctors-sample.csv](doctors-sample.csv)
   - Copy all content
   - Paste into "Import CSV" textarea
   - Click "Import từ CSV"
3. ⚙️ Go to **Schedule** page:
   - Set Population = 50, Generations = 30
   - Click "Tối ưu hóa"
   - Wait ~10 seconds for optimization to complete
4. 📊 See results with Pareto scatter plot
5. 📈 Go to **Reports** to see fairness metrics

## 🎯 Algorithm: Improved NSGA-II

Optimizes for three objectives:

1. **f1 → Minimize**: Load imbalance (std dev of shift counts)
2. **f2 → Minimize**: Weighted penalty (night shift imbalance, preferences, fairness)
3. **f3 → Maximize**: Preference satisfaction score

### Hard Constraints

- Doctor availability respected
- Minimum staffing per shift met
- Night shift rules enforced (rest hours, consecutive night blocking)
- Seniority weighting applied

## 💡 Usage Tips

- **CSV Import**: Use the provided [doctors-sample.csv](doctors-sample.csv) format
  - Headers: `id,full_name,title,specialty,seniority_score,pregnant,senior,part_time,difficult_circumstances`
  - pregnant/senior/part_time/difficult_circumstances: use `true` or `false`
- **Quick Test**: Use the sample CSV + default config to test scheduling
- **Optimization**: Start with 50 population, 30 generations for quick results
- **Results**: Click scatter plot points to select different solutions
- **Exports**: Generate PDF/Excel reports after scheduling

## 🛠️ Development

### Adding a New Doctor Field

1. Update [backend/app/schemas/models.py](backend/app/schemas/models.py) `Doctor` class
2. Update [frontend/lib/types.ts](frontend/lib/types.ts) `Doctor` interface
3. Update [frontend/app/doctors/page.tsx](frontend/app/doctors/page.tsx) form

### Modifying Objectives

Edit [backend/app/services/scheduler.py](backend/app/services/scheduler.py) `compute_objectives()` method

### Changing Frontend Styling

Edit [frontend/app/globals.css](frontend/app/globals.css) CSS variables and component classes

## 🐛 Troubleshooting

**Port 8000 already in use:**

```bash
# Find and kill process on port 8000
netstat -ano | findstr :8000
taskkill /PID <PID> /F
```

**Python module not found:**

```bash
# Ensure PYTHONPATH includes source_code directory
$env:PYTHONPATH = ".."
```

**Frontend styles not loading:**

```bash
# Clear Next.js cache
rm -r frontend/.next
npm run dev
```

## 📝 License

See LICENSE file

## 🤝 Contributing

This is an improved version of the original NSGA-II algorithm, tailored for doctor scheduling with real-world fairness constraints.

---

**Last Updated**: March 15, 2026
**Python**: 3.12.10
**Node.js**: v24.13.0
**Status**: ✅ Ready for Development
