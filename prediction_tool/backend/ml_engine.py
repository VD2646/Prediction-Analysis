import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import train_test_split
from sklearn.metrics import r2_score, mean_absolute_error
from sklearn.preprocessing import StandardScaler
import warnings
warnings.filterwarnings('ignore')

DATA_PATH = "../data/processing_data1.xlsx"

def load_and_prepare():
    df = pd.read_excel(DATA_PATH)
    print("COLUMNS:", df.columns.tolist())  # ADD THIS
    print("SHAPE:", df.shape)               # ADD THIS
    df.columns = df.columns.str.strip()     # strip whitespace
    df = pd.read_excel(DATA_PATH)
    df.columns = df.columns.str.strip()
    df.rename(columns=lambda c: c.strip(), inplace=True)
    df['Date'] = pd.to_datetime(df['Date'])
    df = df.sort_values('Date').reset_index(drop=True)

    # Compute derived columns
    df['Total_Live_Weight_Kg'] = df['Live Birds'] * df['Average Bird Weight (Kg)']
    df['Mortality_Loss_Birds'] = df['Live Birds'] * (df['Mortality %'] / 100)
    df['Effective_Birds'] = df['Live Birds'] * (1 - df['Mortality %'] / 100)
    df['Effective_Weight_Kg'] = df['Effective_Birds'] * df['Average Bird Weight (Kg)']
    df['Dressed_Weight_Kg'] = df['Effective_Weight_Kg'] * (df['Yield %'] / 100)
    df['Shrinkage_Loss_Kg'] = df['Effective_Weight_Kg'] * (df['Transit Shrinkage %'] / 100)

    # Revenue = dressed weight * live bird price (market proxy)
    df['Revenue'] = df['Dressed_Weight_Kg'] * df['Live Bird Price']

    # Cost = operating + transport (per kg of live weight)
    df['Total_Cost_Per_Kg'] = df['Operating Cost/Kg'] + df['Transport Cost/Kg']
    df['Total_Operating_Cost'] = df['Total_Live_Weight_Kg'] * df['Total_Cost_Per_Kg']
    df['By_Product_Income'] = df['Effective_Weight_Kg'] * df['By Product Income/Kg']

    df['Net_Profit'] = df['Revenue'] + df['By_Product_Income'] - df['Total_Operating_Cost']
    df['Is_Loss'] = (df['Net_Profit'] < 0).astype(int)

    # Time features
    df['Month'] = df['Date'].dt.month
    df['DayOfWeek'] = df['Date'].dt.dayofweek
    df['WeekOfYear'] = df['Date'].dt.isocalendar().week.astype(int)


    df['Prev_Day_Profit'] = df['Net_Profit'].shift(1).fillna(0)
    df['Prev_7Day_Avg_Profit'] = df['Net_Profit'].shift(1).rolling(7, min_periods=1).mean().fillna(0)
    df['Prev_30Day_Avg_Profit'] = df['Net_Profit'].shift(1).rolling(30, min_periods=1).mean().fillna(0)
    df['Price_7Day_Avg'] = df['Live Bird Price'].shift(1).rolling(7, min_periods=1).mean().fillna(df['Live Bird Price'])
    df['Cost_7Day_Avg'] = df['Operating Cost/Kg'].shift(1).rolling(7, min_periods=1).mean().fillna(df['Operating Cost/Kg'])

    return df

def train_model(df):
    features = [
    'Live Birds', 'Average Bird Weight (Kg)', 'Mortality %',
    'Transit Shrinkage %', 'Yield %', 'Live Bird Price',
    'Operating Cost/Kg', 'By Product Income/Kg', 'Transport Cost/Kg',
    'Month', 'DayOfWeek', 'WeekOfYear',
    'Prev_Day_Profit', 'Prev_7Day_Avg_Profit', 'Prev_30Day_Avg_Profit',
    'Price_7Day_Avg', 'Cost_7Day_Avg'
]
    target = 'Net_Profit'

    X = df[features].copy()
    y = df[target]

    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

    model = RandomForestRegressor(n_estimators=200, max_depth=12, min_samples_split=3,
                                   min_samples_leaf=2, random_state=42, n_jobs=-1)
    model.fit(X_train, y_train)

    y_pred = model.predict(X_test)
    r2 = r2_score(y_test, y_pred)
    mae = mean_absolute_error(y_test, y_pred)

    importance = dict(zip(features, model.feature_importances_))

    return model, r2, mae, importance, features

def predict_next_month(df, model, features):
    last_date = df['Date'].iloc[-1]

    if last_date.month == 12:
        next_month_start = pd.Timestamp(last_date.year + 1, 1, 1)
    else:
        next_month_start = pd.Timestamp(last_date.year, last_date.month + 1, 1)

    next_month = next_month_start.month
    next_year = next_month_start.year
    days_in_month = pd.Period(f'{next_year}-{next_month:02d}').days_in_month

    same_month_hist = df[df['Month'] == next_month]
    base_df = same_month_hist if len(same_month_hist) >= 5 else df.tail(30)
    base = base_df[features].mean()

    recent = df.tail(30)[['Live Bird Price', 'Operating Cost/Kg', 'Live Birds', 'Transport Cost/Kg']].mean()
    prior  = df.tail(60).head(30)[['Live Bird Price', 'Operating Cost/Kg', 'Live Birds', 'Transport Cost/Kg']].mean()
    price_trend = recent['Live Bird Price'] / prior['Live Bird Price'] if prior['Live Bird Price'] else 1
    cost_trend  = recent['Operating Cost/Kg'] / prior['Operating Cost/Kg'] if prior['Operating Cost/Kg'] else 1
    birds_trend = recent['Live Birds'] / prior['Live Birds'] if prior['Live Birds'] else 1
    transport_trend = recent['Transport Cost/Kg'] / prior['Transport Cost/Kg'] if prior['Transport Cost/Kg'] else 1

    predictions = []
    rolling_profits = list(df['Net_Profit'].tail(30))
    prev_day_profit = float(df['Net_Profit'].iloc[-1])
    np.random.seed(42)

    for day_num in range(1, days_in_month + 1):
        date = pd.Timestamp(next_year, next_month, day_num)
        row = base.copy()
        row['Month']      = next_month
        row['DayOfWeek']  = date.dayofweek
        row['WeekOfYear'] = int(date.isocalendar().week)

        noise = np.random.normal(0, 0.015)
        row['Live Bird Price']    = base['Live Bird Price']    * price_trend * (1 + noise)
        row['Operating Cost/Kg']  = base['Operating Cost/Kg'] * cost_trend  * (1 + noise * 0.5)
        row['Live Birds']         = base['Live Birds']         * birds_trend * (1 + noise * 0.3)
        row['Transport Cost/Kg']  = base['Transport Cost/Kg'] * transport_trend * (1 + noise * 0.3)

        # Lag features
        row['Prev_Day_Profit']      = prev_day_profit
        row['Prev_7Day_Avg_Profit'] = float(np.mean(rolling_profits[-7:]))
        row['Prev_30Day_Avg_Profit']= float(np.mean(rolling_profits[-30:]))
        row['Price_7Day_Avg']       = row['Live Bird Price']
        row['Cost_7Day_Avg']        = row['Operating Cost/Kg']

        pred = model.predict([row[features].values])[0]
        pred = float(round(pred, 2))

        # Compute expected expenditure for this day
        live_weight = float(row['Live Birds']) * float(base['Average Bird Weight (Kg)'])
        effective_weight = live_weight * (1 - float(base['Mortality %']) / 100)
        bird_purchase = live_weight * float(row['Live Bird Price'])
        processing    = effective_weight * float(row['Operating Cost/Kg'])
        transport     = live_weight * float(row['Transport Cost/Kg'])
        total_expenditure = float(round(bird_purchase + processing + transport, 2))

        predictions.append({
            'day': day_num,
            'date': date.strftime('%Y-%m-%d'),
            'predicted_profit': pred,
            'expected_expenditure': total_expenditure,
            'expected_revenue': float(round(pred + total_expenditure, 2))
        })

        rolling_profits.append(pred)
        prev_day_profit = pred

    return predictions

def get_period_data(df, period):
    now = df['Date'].max()
    if period == 'last_week':
        start = now - pd.Timedelta(days=7)
    elif period == 'last_month':
        start = now - pd.DateOffset(months=1)
    elif period == 'last_3_months':
        start = now - pd.DateOffset(months=3)
    else:
        start = now - pd.DateOffset(months=1)
    return df[df['Date'] >= start]

def aggregate_period(filtered_df):
    if len(filtered_df) == 0:
        return {}
    total_revenue = float(filtered_df['Revenue'].sum())
    total_cost = float(filtered_df['Total_Operating_Cost'].sum())
    total_byproduct = float(filtered_df['By_Product_Income'].sum())
    net_profit = float(filtered_df['Net_Profit'].sum())
    loss_days = int((filtered_df['Net_Profit'] < 0).sum())
    profit_days = int((filtered_df['Net_Profit'] >= 0).sum())
    avg_yield = float(filtered_df['Yield %'].mean())
    avg_mortality = float(filtered_df['Mortality %'].mean())
    avg_shrinkage = float(filtered_df['Transit Shrinkage %'].mean())
    total_birds = int(filtered_df['Live Birds'].sum())
    total_dressed_kg = float(filtered_df['Dressed_Weight_Kg'].sum())

    daily_trend = filtered_df[['Date', 'Net_Profit', 'Revenue', 'Total_Operating_Cost']].copy()
    daily_trend['Date'] = daily_trend['Date'].dt.strftime('%Y-%m-%d')
    daily_trend['Revenue'] = daily_trend['Revenue'].round(2)
    daily_trend['Total_Operating_Cost'] = daily_trend['Total_Operating_Cost'].round(2)
    daily_trend['Net_Profit'] = daily_trend['Net_Profit'].round(2)

    # Cost breakdown
    cost_breakdown = {
        'Operating Cost': float(filtered_df['Total_Operating_Cost'].sum()),
        'By-Product Income': -float(filtered_df['By_Product_Income'].sum()),
    }

    loss_factors = {
        'Mortality Loss (Birds)': float(filtered_df['Mortality_Loss_Birds'].sum()),
        'Transit Shrinkage Loss (Kg)': float(filtered_df['Shrinkage_Loss_Kg'].sum()),
        'High Operating Cost Impact': float(((filtered_df['Operating Cost/Kg'] - filtered_df['Operating Cost/Kg'].min()) * filtered_df['Effective_Weight_Kg']).sum()),
    }

    monthly_summary = filtered_df.copy()
    monthly_summary['YearMonth'] = monthly_summary['Date'].dt.to_period('M').astype(str)
    monthly = monthly_summary.groupby('YearMonth').agg(
        Revenue=('Revenue', 'sum'),
        Cost=('Total_Operating_Cost', 'sum'),
        NetProfit=('Net_Profit', 'sum'),
        ByProduct=('By_Product_Income', 'sum')
    ).reset_index()
    monthly = monthly.round(2).to_dict(orient='records')

    return {
        'total_revenue': round(total_revenue, 2),
        'total_cost': round(total_cost, 2),
        'total_byproduct_income': round(total_byproduct, 2),
        'net_profit': round(net_profit, 2),
        'loss_days': loss_days,
        'profit_days': profit_days,
        'avg_yield_pct': round(avg_yield, 2),
        'avg_mortality_pct': round(avg_mortality, 3),
        'avg_shrinkage_pct': round(avg_shrinkage, 3),
        'total_birds_processed': total_birds,
        'total_dressed_kg': round(total_dressed_kg, 2),
        'daily_trend': daily_trend.to_dict(orient='records'),
        'cost_breakdown': cost_breakdown,
        'loss_factors': loss_factors,
        'monthly_summary': monthly,
    }
