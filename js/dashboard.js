/**
 * ============================================================================
 * SCANGUARD AI - DASHBOARD CONTROLLER (dashboard.js)
 * ============================================================================
 * Manages KPI metric counters, Chart.js graphs, and recent scan logs.
 * ============================================================================
 */

const Dashboard = (function () {
  let distChartInstance = null;
  let activityChartInstance = null;

  async function loadDashboard() {
    const totalEl = document.getElementById("dashTotalScans");
    const safeEl = document.getElementById("dashSafeScans");
    const suspEl = document.getElementById("dashSuspiciousScans");
    const scamEl = document.getElementById("dashScamScans");
    const recentTableBody = document.getElementById("dashRecentScansBody");

    try {
      const res = await API.getDashboard();
      if (!res.success) return;

      const stats = res.stats || { total: 0, safe: 0, suspicious: 0, scam: 0 };
      if (totalEl) totalEl.textContent = stats.total;
      if (safeEl) safeEl.textContent = stats.safe;
      if (suspEl) suspEl.textContent = stats.suspicious;
      if (scamEl) scamEl.textContent = stats.scam;

      // Render Charts
      renderDistributionChart(res.distribution || []);
      renderActivityChart(res.activity || []);

      // Render Recent Scans
      if (recentTableBody) {
        const recent = res.recent || [];
        if (recent.length === 0) {
          recentTableBody.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-4"><i class="fa-regular fa-folder-open me-1"></i> No scans recorded yet. Perform a scan above!</td></tr>';
        } else {
          recentTableBody.innerHTML = recent.map(s => {
            const badgeClass = s.result === "SAFE" ? "bg-success-subtle text-success" :
                               s.result === "SCAM" ? "bg-danger-subtle text-danger" : "bg-warning-subtle text-warning";
            return `
              <tr>
                <td class="fw-semibold text-primary">#${s.scan_id}</td>
                <td><span class="badge bg-light text-dark border">${s.input_type.toUpperCase()}</span></td>
                <td class="text-truncate" style="max-width: 220px;" title="${escapeHtml(s.input_preview)}">${escapeHtml(s.input_preview)}</td>
                <td><span class="badge ${badgeClass} border">${s.result}</span></td>
                <td><span class="fw-bold">${s.risk_score}</span>/100</td>
                <td class="small text-muted">${new Date(s.scan_date).toLocaleDateString()}</td>
              </tr>
            `;
          }).join("");
        }
      }

    } catch (e) {
      console.warn("Failed to load dashboard data", e);
    }
  }

  function renderDistributionChart(dist) {
    const canvas = document.getElementById("dashDistChart");
    if (!canvas || typeof Chart === "undefined") return;

    const map = { SAFE: 0, SUSPICIOUS: 0, SCAM: 0 };
    dist.forEach(d => { map[d.result] = d.cnt; });

    if (distChartInstance) {
      distChartInstance.destroy();
    }

    distChartInstance = new Chart(canvas, {
      type: "doughnut",
      data: {
        labels: ["Safe", "Suspicious", "Scam / Phishing"],
        datasets: [{
          data: [map.SAFE, map.SUSPICIOUS, map.SCAM],
          backgroundColor: ["#10b981", "#f59e0b", "#ef4444"],
          borderWidth: 2,
          borderColor: "#ffffff"
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: "bottom",
            labels: { boxWidth: 12, font: { size: 12 } }
          }
        },
        cutout: "68%"
      }
    });
  }

  function renderActivityChart(activity) {
    const canvas = document.getElementById("dashActivityChart");
    if (!canvas || typeof Chart === "undefined") return;

    if (activityChartInstance) {
      activityChartInstance.destroy();
    }

    const labels = activity.map(a => a.day);
    const data = activity.map(a => a.cnt);

    activityChartInstance = new Chart(canvas, {
      type: "line",
      data: {
        labels: labels.length ? labels : ["No data"],
        datasets: [{
          label: "Scans",
          data: data.length ? data : [0],
          borderColor: "#2563eb",
          backgroundColor: "rgba(37, 99, 235, 0.12)",
          fill: true,
          tension: 0.35,
          pointRadius: 4,
          pointBackgroundColor: "#2563eb"
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true,
            ticks: { precision: 0 }
          },
          x: {
            grid: { display: false }
          }
        },
        plugins: {
          legend: { display: false }
        }
      }
    });
  }

  function escapeHtml(str) {
    return (str || "").replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  return {
    loadDashboard
  };
})();

window.Dashboard = Dashboard;
