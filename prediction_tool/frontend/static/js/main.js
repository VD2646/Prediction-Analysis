const API = 'http://localhost:5050/api';
let charts = {};
let currentPeriod = 'last_month';

const PAGES = {
  dashboard: { title: 'Dashboard', sub: 'Revenue, cost and profit overview' },
  analysis: { title: 'Loss Analysis', sub: 'Where and why losses occur' },
  prediction: { title: 'ML Prediction', sub: 'Next month forecast using Random Forest' },
  factors: { title: 'Key Factors', sub: 'What drives profit and loss' }
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
  document.getElementById('profitAmountCard').innerHTML = `
    <div class="label">Total Profit Amount</div>
    <div class="big val-green">${fmt(data.total_profit_amount)}</div>
    <div class="kpi-sub">Across ${data.profit_day_count} profitable days</div>`;
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
function toggleChat() {
  const box = document.getElementById('chatBox');
  box.style.display = box.style.display === 'none' ? 'flex' : 'none';
  box.style.flexDirection = 'column';
  if (box.style.display === 'flex' && document.getElementById('chatMessages').children.length === 0) {
    appendMsg('bot', "Hi! I can explain your charts, analyse losses, predict next month's revenue, and answer *what-if* questions. Try asking: \"Why am I making a loss?\" or \"What if mortality drops to 0.2%?\"");
  }
}

function appendMsg(role, text) {
  const div = document.getElementById('chatMessages');
  const msg = document.createElement('div');
  msg.style.cssText = `max-width:85%;padding:10px 13px;border-radius:10px;font-size:13px;line-height:1.5;${role==='user'?'align-self:flex-end;background:var(--accent);color:#fff':'align-self:flex-start;background:var(--surface2);color:var(--text)'}`;
  msg.textContent = text;
  div.appendChild(msg);
  div.scrollTop = div.scrollHeight;
}

async function sendChat() {
  const input = document.getElementById('chatInput');
  const q = input.value.trim();
  const isPredQ = /next month|predict|revenue|forecast|will i (make|lose)/i.test(q);

  if (!q) return;
  input.value = '';
  appendMsg('user', q);

  // Gather current dashboard context
  let ctx = {};
  try {
    const [dash, loss, pred, imp] = await Promise.all([
      fetchJSON(`${API}/dashboard?period=${currentPeriod}`),
      fetchJSON(`${API}/loss-analysis?period=${currentPeriod}`),
      fetchJSON(`${API}/predict-next-month`),
      fetchJSON(`${API}/feature-importance`)
    ]);
    ctx = { dash, loss, pred, imp };
  } catch(e) {}

  const systemPrompt = `You are a poultry processing business analytics assistant. You have access to real business data.

Current period: ${currentPeriod.replace('_',' ')}
Net Profit: ${ctx.dash?.net_profit?.toFixed(0)}
Total Revenue: ${ctx.dash?.total_revenue?.toFixed(0)}
Total Cost: ${ctx.dash?.total_cost?.toFixed(0)}
By-Product Income: ${ctx.dash?.total_byproduct_income?.toFixed(0)}
Profit Days: ${ctx.dash?.profit_days}, Loss Days: ${ctx.dash?.loss_days}
Avg Yield: ${ctx.dash?.avg_yield_pct}%, Avg Mortality: ${ctx.dash?.avg_mortality_pct}%, Avg Shrinkage: ${ctx.dash?.avg_shrinkage_pct}%
Total Loss Amount: ${ctx.loss?.total_loss_amount?.toFixed(0)}
Total Profit Amount: ${ctx.loss?.total_profit_amount?.toFixed(0)}
Factor correlations with profit: ${JSON.stringify(ctx.loss?.correlations)}
Top feature driving profit/loss: ${ctx.imp?.labels?.[0]} (${ctx.imp?.values?.[0]}%)
Next month predicted ${ctx.pred?.is_profit ? 'PROFIT' : 'LOSS'}: ₹${Math.abs(ctx.pred?.total_predicted_profit).toFixed(0)}
Predicted daily average: ₹${ctx.pred?.avg_daily_predicted?.toFixed(0)}
30-day forecast breakdown available: ${ctx.pred?.predictions?.length} days predicted

You can:
1. Explain any metric or chart in simple terms
2. Answer what-if questions (e.g. what if mortality drops, what if bird price rises)
3. Identify the root causes of losses
4. Give actionable recommendations
5. Predict revenue/loss impact of operational changes

For what-if questions, do rough mental math using the formulas:
- Revenue = Dressed Weight × Bird Price; Dressed Weight = Live Birds × Bird Weight × (1 - Mortality%) × Yield%
- Net Profit = Revenue + By-Product Income - (Bird Purchase Cost + Processing Cost + Transport Cost)
- Mortality cost = lost birds × weight × price

Be concise, specific with numbers, and practical. Use ₹ for currency amounts.`;

  appendMsg('bot', '...');
  const msgs = document.getElementById('chatMessages');
  const typing = msgs.lastChild;

  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer YOUR_GROQ_API_KEY' },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        max_tokens: 1000,
        messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: q }]
      })
    });
    const data = await res.json();
    typing.textContent = data.choices?.[0]?.message?.content || 'Sorry, could not get a response.';
  } catch(e) {
    typing.textContent = 'Error connecting to AI. Check your network.';
  }
  msgs.scrollTop = msgs.scrollHeight;
}