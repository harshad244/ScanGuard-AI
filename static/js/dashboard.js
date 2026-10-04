(async function initDashboardCharts() {
  const resultCanvas = document.getElementById('resultChart');
  const activityCanvas = document.getElementById('activityChart');
  if (!resultCanvas || !activityCanvas || typeof Chart === 'undefined') return;

  const { res, data } = await App.fetchJSON('/api/dashboard');
  if (!res.ok) return;

  const distMap = { SAFE: 0, SUSPICIOUS: 0, SCAM: 0 };
  (data.distribution || []).forEach((row) => { distMap[row.result] = row.cnt; });

  new Chart(resultCanvas, {
    type: 'doughnut',
    data: {
      labels: ['SAFE', 'SUSPICIOUS', 'SCAM'],
      datasets: [{
        data: [distMap.SAFE, distMap.SUSPICIOUS, distMap.SCAM],
        backgroundColor: ['#198754', '#fd7e14', '#dc3545']
      }]
    },
    options: { plugins: { legend: { position: 'bottom' } } }
  });

  const activity = data.activity || [];
  new Chart(activityCanvas, {
    type: 'line',
    data: {
      labels: activity.map((a) => a.day),
      datasets: [{
        label: 'Scans',
        data: activity.map((a) => a.cnt),
        borderColor: '#2563eb',
        backgroundColor: 'rgba(37,99,235,0.1)',
        fill: true,
        tension: 0.25
      }]
    },
    options: {
      scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
      plugins: { legend: { display: false } }
    }
  });
})();
