# Poultry Processing — Prediction Analytics Tool

## Project Structure
```
prediction_tool/
├── backend/
│   ├── app.py          # Flask API server (all endpoints)
│   └── ml_engine.py    # Data processing + Random Forest ML
├── frontend/
│   ├── index.html      # Single-page app shell
│   └── static/
│       ├── css/style.css
│       └── js/main.js
├── data/
│   └── processing_data1.xlsx
├── requirements.txt
└── start.sh
```

## Setup & Run

### 1. Install dependencies
```bash
pip install -r requirements.txt
```

### 2. Start the backend
```bash
cd backend
python app.py
```

### 3. Open the app
Visit: http://localhost:5050

---

## Features

### Dashboard
- KPIs: Revenue, Operating Cost, Net Profit, By-Product Income, Mortality, Yield, Profit Days
- Daily Revenue vs Cost vs Profit trend chart
- Monthly summary bar chart
- Period filter: Last Week / Last Month / Last 3 Months

### Loss Analysis
- Profit vs Loss days donut chart
- Factor correlation with Net Profit (horizontal bar)
- Worst performing days table
- Total loss and profit amounts

### ML Prediction (Random Forest)
- Predicts next month's daily profit/loss
- Shows total predicted monthly P&L
- Model accuracy (R²) and MAE displayed
- Trained on all historical data, ≥80% accuracy target

### Key Factors
- Feature importance chart (which inputs drive profit/loss the most)
- Operational KPIs for context

---

## Model Details
- **Algorithm**: Random Forest Regressor (200 trees)
- **Target**: Net Profit per day
- **Features**: Live Birds, Bird Weight, Mortality %, Transit Shrinkage %, Yield %, Live Bird Price, Operating Cost/Kg, By-Product Income/Kg, Transport Cost/Kg, Month, Day of Week, Week of Year
- **Accuracy**: R² ≥ 0.80 on test set

## Business Logic
- **Revenue** = Dressed Weight (Kg) × Live Bird Price
- **Cost** = Live Weight × (Operating Cost/Kg + Transport Cost/Kg)
- **Net Profit** = Revenue + By-Product Income − Total Cost
- **Dressed Weight** = Live Weight × (1 − Mortality%) × Yield%
