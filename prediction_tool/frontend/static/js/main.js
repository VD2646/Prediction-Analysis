const API = `${window.location.origin}/api`;
let charts = {};
let currentPeriod = 'last_month';

const PAGES = {
  dashboard: { title: 'Dashboard', sub: 'Revenue, cost and profit overview' },
  analysis: { title: 'Loss Analysis', sub: 'Where and why losses occur' },
  prediction: { title: 'ML Prediction', sub: 'Next month forecast using Random Forest' },
  factors: { title: 'Key Factors', sub: 'What drives profit and loss' },
  leakage: { title: 'Leakage Analysis', sub: 'Where money, yield and quality are leaking' }
};

function fmt(n, prefix = '₹') {
  if (n === undefined || n === null || isNaN(n)) return '—';
  const abs = Math.abs(n);
  let str;
  if (abs >= 1e7) str = (n / 1e7).toFixed(2) + ' Cr';
  else if (abs >= 1e5) str = (n / 1e5).toFixed(2) + ' L';
  else str = n.toFixed(0);
  return (n < 0 ? '-' : '') + prefix + str;
}

function fmtN(n, dec = 2) { return n !== undefined ? n.toFixed(dec) : '—'; }

function destroyChart(id) { if (charts[id]) { charts[id].destroy(); delete charts[id]; } }

function chartDefaults() {
  return {
    plugins: { legend: { labels: { color: '#94a3b8', boxWidth: 12, font: { size: 12 } } } },
    scales: {
      x: { ticks: { color: '#64748b', maxRotation: 45 }, grid: { color: 'rgba(255,255,255,.05)' } },
      y: { ticks: { color: '#64748b' }, grid: { color: 'rgba(255,255,255,.05)' } }
    }
  };
}

async function fetchJSON(url) {
  const res = await fetch(url);
  return res.json();
}

function showPage(name) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('page-' + name).classList.add('active');
  document.querySelector(`[data-page="${name}"]`).classList.add('active');
  document.getElementById('pageTitle').textContent = PAGES[name].title;
  document.getElementById('pageSub').textContent = PAGES[name].sub;
  loadPage(name);
}

function onPeriodChange() {
  currentPeriod = document.getElementById('periodSelect').value;
  const active = document.querySelector('.nav-item.active');
  if (active) loadPage(active.dataset.page);
}

async function loadPage(name) {
  if (name === 'dashboard') await loadDashboard();
  else if (name === 'analysis') await loadAnalysis();
  else if (name === 'prediction') await loadPrediction();
  else if (name === 'factors') await loadFactors();
  else if (name === 'leakage') await loadLeakage();
}

async function loadDashboard() {
  const data = await fetchJSON(`${API}/dashboard?period=${currentPeriod}`);
  const isProfit = data.net_profit >= 0;

  document.getElementById('kpiGrid').innerHTML = `
    <div class="kpi-card kpi-neutral">
      <div class="kpi-label">Total Revenue</div>
      <div class="kpi-value val-blue">${fmt(data.total_revenue)}</div>
      <div class="kpi-sub">Gross from dressed birds</div>
    </div>
    <div class="kpi-card kpi-neutral">
      <div class="kpi-label">Total Operating Cost</div>
      <div class="kpi-value val-yellow">${fmt(data.total_cost)}</div>
      <div class="kpi-sub">Processing + transport</div>
    </div>
    <div class="kpi-card ${isProfit ? 'kpi-profit' : 'kpi-loss'}">
      <div class="kpi-label">Net Profit / Loss</div>
      <div class="kpi-value ${isProfit ? 'val-green' : 'val-red'}">${fmt(data.net_profit)}</div>
      <div class="kpi-sub">${isProfit ? '✅ Net profitable period' : '⚠️ Net loss period'}</div>
    </div>
    <div class="kpi-card kpi-neutral">
      <div class="kpi-label">By-Product Income</div>
      <div class="kpi-value val-green">${fmt(data.total_byproduct_income)}</div>
      <div class="kpi-sub">Offal & by-products</div>
    </div>
    <div class="kpi-card kpi-warn">
      <div class="kpi-label">Avg Mortality</div>
      <div class="kpi-value val-yellow">${fmtN(data.avg_mortality_pct, 2)}%</div>
      <div class="kpi-sub">Birds lost per batch</div>
    </div>
    <div class="kpi-card kpi-neutral">
      <div class="kpi-label">Avg Yield</div>
      <div class="kpi-value val-blue">${fmtN(data.avg_yield_pct)}%</div>
      <div class="kpi-sub">Dressed weight efficiency</div>
    </div>
    <div class="kpi-card kpi-neutral">
      <div class="kpi-label">Profit Days</div>
      <div class="kpi-value val-green">${data.profit_days}</div>
      <div class="kpi-sub">vs ${data.loss_days} loss days</div>
    </div>
    <div class="kpi-card kpi-neutral">
      <div class="kpi-label">Birds Processed</div>
      <div class="kpi-value val-blue">${data.total_birds_processed?.toLocaleString()}</div>
      <div class="kpi-sub">${fmtN(data.total_dressed_kg / 1000, 1)}T dressed weight</div>
    </div>
    <div class="kpi-card kpi-neutral">
  <div class="kpi-label">Expected Revenue (Potential)</div>
  <div class="kpi-value val-blue">${fmt(data.total_expected_revenue)}</div>
  <div class="kpi-sub">If mortality=0, shrinkage=0, yield=72%</div>
</div>
<div class="kpi-card kpi-loss">
  <div class="kpi-label">Revenue Gap</div>
  <div class="kpi-value val-red">${fmt(data.total_revenue_gap)}</div>
  <div class="kpi-sub">Lost due to mortality, shrinkage & yield inefficiency</div>
</div>
  `;

  // Trend chart
  destroyChart('trendChart');
  const trend = data.daily_trend || [];
  const labels = trend.map(d => d.Date.slice(5));
  charts['trendChart'] = new Chart(document.getElementById('trendChart'), {
    type: 'line',
    data: {
      labels,
      datasets: [
        { label: 'Revenue', data: trend.map(d => d.Revenue), borderColor: '#4f8ef7', tension: 0.3, pointRadius: 0, borderWidth: 2, fill: false },
        { label: 'Cost', data: trend.map(d => d.Total_Operating_Cost), borderColor: '#f59e0b', tension: 0.3, pointRadius: 0, borderWidth: 2, fill: false },
        { label: 'Net Profit', data: trend.map(d => d.Net_Profit), borderColor: '#22c55e', tension: 0.3, pointRadius: 0, borderWidth: 2, fill: true, backgroundColor: 'rgba(34,197,94,.08)' }
      ]
    },
    options: { ...chartDefaults(), responsive: true }
  });

  // Monthly chart
  destroyChart('monthlyChart');
  const monthly = data.monthly_summary || [];
  charts['monthlyChart'] = new Chart(document.getElementById('monthlyChart'), {
    type: 'bar',
    data: {
      labels: monthly.map(m => m.YearMonth),
      datasets: [
        { label: 'Revenue', data: monthly.map(m => m.Revenue), backgroundColor: 'rgba(79,142,247,.7)', borderRadius: 4 },
        { label: 'Cost', data: monthly.map(m => m.Cost), backgroundColor: 'rgba(245,158,11,.7)', borderRadius: 4 },
        { label: 'Net Profit', data: monthly.map(m => m.NetProfit), backgroundColor: monthly.map(m => m.NetProfit >= 0 ? 'rgba(34,197,94,.7)' : 'rgba(239,68,68,.7)'), borderRadius: 4 }
      ]
    },
    options: { ...chartDefaults(), responsive: true }
  });

  destroyChart('costChart');
const cb = data.cost_breakdown || {};
charts['costChart'] = new Chart(document.getElementById('costChart'), {
  type: 'bar',
  data: {
    labels: Object.keys(cb),
    datasets: [{ label: '₹ Cost', data: Object.values(cb),
      backgroundColor: ['#4f8ef7','#7c5cfc','#f59e0b','#06b6d4','#f43f5e','#10b981','#ef4444','#d946ef'].map(c=>c+'cc'),
      borderRadius: 4 }]
  },
  options: { ...chartDefaults(), responsive: true, indexAxis: 'y' }
});

}

async function loadAnalysis() {
  const [data, dash] = await Promise.all([
    fetchJSON(`${API}/loss-analysis?period=${currentPeriod}`),
    fetchJSON(`${API}/dashboard?period=${currentPeriod}`)
  ]);

  // PnL Donut
  destroyChart('pnlDonut');
  charts['pnlDonut'] = new Chart(document.getElementById('pnlDonut'), {
    type: 'doughnut',
    data: {
      labels: ['Profit Days', 'Loss Days'],
      datasets: [{ data: [data.profit_day_count, data.loss_day_count], backgroundColor: ['#22c55e', '#ef4444'], borderWidth: 0 }]
    },
    options: { plugins: { legend: { labels: { color: '#94a3b8' } } }, cutout: '65%' }
  });

  // Correlation chart
  destroyChart('corrChart');
  const corrKeys = Object.keys(data.correlations);
  const corrVals = corrKeys.map(k => data.correlations[k]);
  charts['corrChart'] = new Chart(document.getElementById('corrChart'), {
    type: 'bar',
    data: {
      labels: corrKeys,
      datasets: [{
        label: 'Correlation with Net Profit',
        data: corrVals,
        backgroundColor: corrVals.map(v => v > 0 ? 'rgba(34,197,94,.7)' : 'rgba(239,68,68,.7)'),
        borderRadius: 4
      }]
    },
    options: { ...chartDefaults(), indexAxis: 'y', responsive: true }
  });

  // Worst days table
  const rows = (data.worst_days || []).map(d => `
    <tr class="loss-row">
      <td>${d.Date}</td>
      <td>${fmt(d.Net_Profit)}</td>
      <td>${fmtN(d['Mortality %'], 2)}%</td>
      <td>${fmtN(d['Transit Shrinkage %'], 2)}%</td>
      <td>${fmtN(d['Yield %'], 2)}%</td>
      <td>${(d['Live Birds'] || 0).toLocaleString()}</td>
    </tr>`).join('');
  document.getElementById('worstTable').innerHTML = `
    <table>
      <thead><tr><th>Date</th><th>Net Profit</th><th>Mortality %</th><th>Shrinkage %</th><th>Yield %</th><th>Live Birds</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="6" style="text-align:center;color:var(--muted)">No loss days in period</td></tr>'}</tbody>
    </table>`;

  document.getElementById('lossAmountCard').innerHTML = `
    <div class="label">Total Loss Amount</div>
    <div class="big val-red">${fmt(data.total_loss_amount)}</div>
    <div class="kpi-sub">Across ${data.loss_day_count} loss days</div>`;

    document.getElementById('lossAmountCard').innerHTML = `
  <div class="label">Total Loss Amount</div>
  <div class="big val-red">${fmt(data.total_loss_amount)}</div>
  <div class="kpi-sub">Across ${data.loss_day_count} loss days</div>
  <div style="margin-top:12px;font-size:12px;color:var(--muted)">
    💡 <b>Mortality</b> & <b>Shrinkage</b> are your biggest controllable losses.<br>
    Reducing mortality by 0.1% saves ~₹${Math.round(dash.total_birds_processed * 0.001 * 2.4 * 200).toLocaleString()} over this period.<br>
    High operating cost days: review equipment/labour on worst days above.
  </div>`;
  
}

async function loadPrediction() {
  const pred = await fetchJSON(`${API}/predict-next-month`);
  const model = await fetchJSON(`${API}/model-info`);

  document.getElementById('predKpiGrid').innerHTML = `
    <div class="kpi-card ${pred.is_profit ? 'kpi-profit' : 'kpi-loss'}">
      <div class="kpi-label">Predicted Monthly Profit</div>
      <div class="kpi-value ${pred.is_profit ? 'val-green' : 'val-red'}">${fmt(pred.total_predicted_profit)}</div>
      <div class="kpi-sub">${pred.is_profit ? '📈 Profitable month ahead' : '⚠️ Loss month predicted'}</div>
    </div>
    <div class="kpi-card kpi-neutral">
      <div class="kpi-label">Avg Daily Forecast</div>
      <div class="kpi-value val-blue">${fmt(pred.avg_daily_predicted)}</div>
      <div class="kpi-sub">Per processing day</div>
    </div>
    <div class="kpi-card kpi-neutral">
      <div class="kpi-label">Model R² Score</div>
      <div class="kpi-value val-green">${(model.r2_score * 100).toFixed(1)}%</div>
      <div class="kpi-sub">Prediction accuracy</div>
    </div>
    <div class="kpi-card kpi-neutral">
      <div class="kpi-label">Mean Abs Error</div>
      <div class="kpi-value val-yellow">${fmt(model.mae)}</div>
      <div class="kpi-sub">Avg daily error margin</div>
    </div>
    <div class="kpi-card kpi-warn">
  <div class="kpi-label">Expected Monthly Expenditure</div>
  <div class="kpi-value val-yellow">${fmt(pred.total_expected_expenditure)}</div>
  <div class="kpi-sub">Bird purchase + processing + transport</div>
</div>
<div class="kpi-card kpi-neutral">
  <div class="kpi-value val-blue">${fmt(pred.total_expected_revenue)}</div>
  <div class="kpi-label">Expected Monthly Revenue</div>
  <div class="kpi-sub">Before costs</div>
</div>`;

  destroyChart('forecastChart');
  const days = pred.predictions || [];
  charts['forecastChart'] = new Chart(document.getElementById('forecastChart'), {
    type: 'bar',
    data: {
      labels: days.map(d => `Day ${d.day}`),
      datasets: [{
        label: 'Predicted Net Profit',
        data: days.map(d => d.predicted_profit),
        backgroundColor: days.map(d => d.predicted_profit >= 0 ? 'rgba(34,197,94,.75)' : 'rgba(239,68,68,.75)'),
        borderRadius: 4
      }]
    },
    options: { ...chartDefaults(), responsive: true }
  });
}

async function loadFactors() {
  const [imp, dash] = await Promise.all([
    fetchJSON(`${API}/feature-importance`),
    fetchJSON(`${API}/dashboard?period=${currentPeriod}`)
  ]);

  destroyChart('importanceChart');
  charts['importanceChart'] = new Chart(document.getElementById('importanceChart'), {
    type: 'bar',
    data: {
      labels: imp.labels,
      datasets: [{
        label: 'Importance (%)',
        data: imp.values,
        backgroundColor: imp.values.map((v, i) => {
          const colors = ['#4f8ef7','#7c5cfc','#22c55e','#f59e0b','#ef4444','#06b6d4','#8b5cf6','#f43f5e','#10b981','#d946ef','#0ea5e9','#84cc16'];
          return colors[i % colors.length] + 'cc';
        }),
        borderRadius: 4
      }]
    },
    options: { ...chartDefaults(), responsive: true, indexAxis: 'y' }
  });

  document.getElementById('factorStatsGrid').innerHTML = `
    <div class="kpi-card kpi-neutral">
      <div class="kpi-label">Top Driver</div>
      <div class="kpi-value val-blue" style="font-size:16px">${imp.labels[0] || '—'}</div>
      <div class="kpi-sub">${imp.values[0]}% importance</div>
    </div>
    <div class="kpi-card kpi-neutral">
      <div class="kpi-label">2nd Driver</div>
      <div class="kpi-value val-blue" style="font-size:16px">${imp.labels[1] || '—'}</div>
      <div class="kpi-sub">${imp.values[1]}% importance</div>
    </div>
    <div class="kpi-card kpi-warn">
      <div class="kpi-label">Avg Yield</div>
      <div class="kpi-value val-yellow">${fmtN(dash.avg_yield_pct)}%</div>
      <div class="kpi-sub">Higher = more dressed meat</div>
    </div>
    <div class="kpi-card kpi-warn">
      <div class="kpi-label">Avg Mortality</div>
      <div class="kpi-value val-red">${fmtN(dash.avg_mortality_pct, 3)}%</div>
      <div class="kpi-sub">Lower = better performance</div>
    </div>
    <div class="kpi-card kpi-neutral">
      <div class="kpi-label">Avg Shrinkage</div>
      <div class="kpi-value val-yellow">${fmtN(dash.avg_shrinkage_pct, 3)}%</div>
      <div class="kpi-sub">Transit weight loss</div>
    </div>`;
}

async function loadLeakage() {
  const data = await fetchJSON(`${API}/leakage-analysis?period=${currentPeriod}`);

  document.getElementById('leakageGrid').innerHTML = `
    <div class="kpi-card kpi-loss" style="grid-column: span 2">
      <div class="kpi-label">⚠️ Total Estimated Leakage</div>
      <div class="kpi-value val-red">${fmt(data.total_leakage)}</div>
      <div class="kpi-sub">Sum of all preventable losses in this period</div>
    </div>

    <div class="kpi-card kpi-loss">
      <div class="kpi-label">🐦 Mortality Loss</div>
      <div class="kpi-value val-red">${fmt(data.mortality_value)}</div>
      <div class="kpi-sub">${data.mortality_birds} birds lost · avg ${data.avg_mortality_pct}% mortality</div>
    </div>

    <div class="kpi-card kpi-warn">
      <div class="kpi-label">🚛 Transit Shrinkage Loss</div>
      <div class="kpi-value val-yellow">${fmt(data.shrinkage_value)}</div>
      <div class="kpi-sub">${data.shrinkage_kg} Kg lost · avg ${data.avg_shrinkage_pct}% shrinkage</div>
    </div>

    <div class="kpi-card kpi-warn">
      <div class="kpi-label">⚙️ Yield Gap Loss</div>
      <div class="kpi-value val-yellow">${fmt(data.yield_gap_value)}</div>
      <div class="kpi-sub">${data.yield_gap_kg} Kg below 72% benchmark · avg yield ${data.avg_yield_pct}%</div>
    </div>

    <div class="kpi-card kpi-warn">
      <div class="kpi-label">🏭 Operating Cost Waste</div>
      <div class="kpi-value val-yellow">${fmt(data.op_cost_waste)}</div>
      <div class="kpi-sub">Avg ₹${data.avg_op_cost}/Kg · best day ₹${data.min_op_cost}/Kg</div>
    </div>

    <div class="kpi-card kpi-warn">
      <div class="kpi-label">🚚 Transport Cost Waste</div>
      <div class="kpi-value val-yellow">${fmt(data.transport_waste)}</div>
      <div class="kpi-sub">Avg ₹${data.avg_transport}/Kg · best day ₹${data.min_transport}/Kg</div>
    </div>

    <div class="kpi-card kpi-neutral">
      <div class="kpi-label">📦 Total Dressed Weight</div>
      <div class="kpi-value val-blue">${fmtN(data.dressed_weight / 1000, 1)}T</div>
      <div class="kpi-sub">From ${fmtN(data.total_live_weight / 1000, 1)}T live weight input</div>
    </div>
  `;

  document.getElementById('leakageTips').innerHTML = `
  <div class="card-header"><div class="card-title">💡 How to Reduce These Leakages</div></div>
  <div style="padding: 16px; display: grid; grid-template-columns: 1fr 1fr; gap: 16px; font-size: 13px; color: var(--muted)">
    <div><b style="color:var(--text)">🐦 Mortality</b><br>Improve ventilation, reduce stocking density, monitor feed/water quality daily. Target &lt;0.5%.</div>
    <div><b style="color:var(--text)">🚛 Shrinkage</b><br>Reduce transit time, avoid overloading, use temperature-controlled transport. Target &lt;0.3%.</div>
    <div><b style="color:var(--text)">⚙️ Yield Gap</b><br>Calibrate slaughter line regularly, train staff on evisceration technique. Target &gt;72%.</div>
    <div><b style="color:var(--text)">🏭 Operating Cost</b><br>Benchmark against your lowest-cost days — identify equipment or shift patterns driving spikes.</div>
    <div><b style="color:var(--text)">🚚 Transport Cost</b><br>Consolidate loads, negotiate fixed-route rates, track cost per Kg per route.</div>
    <div><b style="color:var(--text)">📊 Overall</b><br>Reducing all leakages to benchmark levels could recover <b style="color:var(--accent)">${fmt(data.total_leakage)}</b> this period.</div>
  </div>`;
}

async function uploadFile(input) {
  const file = input.files[0];
  if (!file) return;
  document.getElementById('uploadStatus').textContent = 'Uploading...';
  const form = new FormData();
  form.append('file', file);
  try {
    const res = await fetch(`${API}/upload`, { method: 'POST', body: form });
    const data = await res.json();
    if (data.success) {
      document.getElementById('uploadStatus').textContent = `✅ ${data.rows} rows loaded, R²: ${(data.r2*100).toFixed(1)}%`;
      document.getElementById('modelAccuracy').textContent = (data.r2*100).toFixed(1) + '%';
      loadPage(document.querySelector('.nav-item.active').dataset.page);
    } else {
      document.getElementById('uploadStatus').textContent = '❌ ' + data.error;
    }
  } catch(e) {
    document.getElementById('uploadStatus').textContent = '❌ Upload failed';
  }
}

async function init() {
  const model = await fetchJSON(`${API}/model-info`);
  document.getElementById('modelAccuracy').textContent = (model.r2_score * 100).toFixed(1) + '%';
  await loadDashboard();
}

init();
