from flask import Flask, jsonify, send_from_directory, request
from flask_cors import CORS
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from ml_engine import load_and_prepare, train_model, predict_next_month, get_period_data, aggregate_period

app = Flask(__name__, static_folder='../frontend', static_url_path='')
CORS(app)

# Load and train on startup
print("Loading data and training model...")
df = load_and_prepare()
model, r2, mae, importance, features = train_model(df)
print(f"Model trained — R² Score: {r2:.4f}, MAE: {mae:.2f}")

@app.route('/')
def index():
    return send_from_directory('../frontend', 'index.html')

@app.route('/api/model-info')
def model_info():
    return jsonify({
        'r2_score': round(r2, 4),
        'mae': round(mae, 2),
        'accuracy_pct': round(r2 * 100, 1),
        'training_samples': len(df),
        'date_range': {
            'start': df['Date'].min().strftime('%Y-%m-%d'),
            'end': df['Date'].max().strftime('%Y-%m-%d')
        }
    })

@app.route('/api/dashboard')
def dashboard():
    period = request.args.get('period', 'last_month')
    filtered = get_period_data(df, period)
    stats = aggregate_period(filtered)
    return jsonify(stats)

@app.route('/api/feature-importance')
def feature_importance():
    sorted_imp = sorted(importance.items(), key=lambda x: x[1], reverse=True)
    labels = [k.replace('_', ' ').replace('%', '').strip() for k, v in sorted_imp]
    values = [round(v * 100, 2) for k, v in sorted_imp]
    return jsonify({'labels': labels, 'values': values})

@app.route('/api/predict-next-month')
def predict_next():
    predictions = predict_next_month(df, model, features)
    total_pred = sum(p['predicted_profit'] for p in predictions)
    avg_daily = total_pred / len(predictions)
    total_expenditure = sum(p['expected_expenditure'] for p in predictions)
    total_revenue = sum(p['expected_revenue'] for p in predictions)
    return jsonify({
    'predictions': predictions,
    'total_predicted_profit': round(total_pred, 2),
    'avg_daily_predicted': round(avg_daily, 2),
    'total_expected_expenditure': round(total_expenditure, 2),
    'total_expected_revenue': round(total_revenue, 2),
    'is_profit': bool(total_pred >= 0)
})

@app.route('/api/loss-analysis')
def loss_analysis():
    period = request.args.get('period', 'last_month')
    filtered = get_period_data(df, period)
    loss_days_df = filtered[filtered['Net_Profit'] < 0]
    profit_days_df = filtered[filtered['Net_Profit'] >= 0]

    corr_cols = ['Mortality %', 'Transit Shrinkage %', 'Operating Cost/Kg',
                 'Transport Cost/Kg', 'Yield %', 'Live Bird Price']
    correlations = {}
    for col in corr_cols:
        c = filtered['Net_Profit'].corr(filtered[col])
        correlations[col] = round(float(c), 3)

    top_loss_days = loss_days_df.nsmallest(5, 'Net_Profit')[
        ['Date', 'Net_Profit', 'Mortality %', 'Transit Shrinkage %', 'Yield %', 'Live Birds']
    ].copy()
    top_loss_days['Date'] = top_loss_days['Date'].dt.strftime('%Y-%m-%d')
    top_loss_days = top_loss_days.round(2).to_dict(orient='records')

    return jsonify({
        'total_loss_amount': round(float(loss_days_df['Net_Profit'].sum()), 2) if len(loss_days_df) > 0 else 0,
        'total_profit_amount': round(float(profit_days_df['Net_Profit'].sum()), 2) if len(profit_days_df) > 0 else 0,
        'correlations': correlations,
        'worst_days': top_loss_days,
        'loss_day_count': len(loss_days_df),
        'profit_day_count': len(profit_days_df),
    })

@app.route('/api/leakage-analysis')
def leakage_analysis():
    period = request.args.get('period', 'last_month')
    filtered = get_period_data(df, period)

    total_live_weight = float((filtered['Live Birds'] * filtered['Average Bird Weight (Kg)']).sum())
    effective_weight = float(filtered['Effective_Weight_Kg'].sum())
    dressed_weight = float(filtered['Dressed_Weight_Kg'].sum())

    mortality_birds = float(filtered['Mortality_Loss_Birds'].sum())
    mortality_value = float((filtered['Mortality_Loss_Birds'] * filtered['Average Bird Weight (Kg)'] * filtered['Live Bird Price']).sum())

    shrinkage_kg = float(filtered['Shrinkage_Loss_Kg'].sum())
    shrinkage_value = float((filtered['Shrinkage_Loss_Kg'] * filtered['Selling Price']).sum())

    yield_gap_kg = float(((filtered['Effective_Weight_Kg'] * (0.72 - filtered['Yield %'] / 100)).clip(lower=0)).sum())
    yield_gap_value = float(((filtered['Effective_Weight_Kg'] * (0.72 - filtered['Yield %'] / 100)).clip(lower=0) * filtered['Selling Price']).sum())

    avg_op_cost = float(filtered['Operating Cost/Kg'].mean())
    min_op_cost = float(filtered['Operating Cost/Kg'].min())
    op_cost_waste = float(((filtered['Operating Cost/Kg'] - min_op_cost) * filtered['Dressed_Weight_Kg']).sum())

    avg_transport = float(filtered['Transport Cost/Kg'].mean())
    min_transport = float(filtered['Transport Cost/Kg'].min())
    transport_waste = float(((filtered['Transport Cost/Kg'] - min_transport) * filtered['Live Birds'] * filtered['Average Bird Weight (Kg)']).sum())

    total_leakage = mortality_value + shrinkage_value + yield_gap_value + op_cost_waste + transport_waste

    return jsonify({
        'mortality_birds': round(mortality_birds, 0),
        'mortality_value': round(mortality_value, 2),
        'avg_mortality_pct': round(float(filtered['Mortality %'].mean()), 3),

        'shrinkage_kg': round(shrinkage_kg, 2),
        'shrinkage_value': round(shrinkage_value, 2),
        'avg_shrinkage_pct': round(float(filtered['Transit Shrinkage %'].mean()), 3),

        'yield_gap_kg': round(yield_gap_kg, 2),
        'yield_gap_value': round(yield_gap_value, 2),
        'avg_yield_pct': round(float(filtered['Yield %'].mean()), 2),

        'op_cost_waste': round(op_cost_waste, 2),
        'avg_op_cost': round(avg_op_cost, 2),
        'min_op_cost': round(min_op_cost, 2),

        'transport_waste': round(transport_waste, 2),
        'avg_transport': round(avg_transport, 2),
        'min_transport': round(min_transport, 2),

        'total_leakage': round(total_leakage, 2),
        'total_live_weight': round(total_live_weight, 2),
        'dressed_weight': round(dressed_weight, 2),
    })

@app.route('/api/upload', methods=['POST'])
def upload():
    global df, model, r2, mae, importance, features
    if 'file' not in request.files:
        return jsonify({'error': 'No file'}), 400
    file = request.files['file']
    contents = file.read()
    import tempfile, os
    with tempfile.NamedTemporaryFile(suffix='.xlsx', delete=False) as tmp:
        tmp.write(contents)
        tmp_path = tmp.name
    try:
        import ml_engine
        ml_engine.DATA_PATH = tmp_path
        df = ml_engine.load_and_prepare()
        model, r2, mae, importance, features = train_model(df)
        return jsonify({'success': True, 'rows': len(df), 'r2': round(r2, 4)})
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500
    finally:
        os.unlink(tmp_path)

if __name__ == '__main__':
    app.run(debug=False, port=5050)
