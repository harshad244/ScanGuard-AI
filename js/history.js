/**
 * ============================================================================
 * SCANGUARD AI - HISTORY & REPORTS CONTROLLER (history.js)
 * ============================================================================
 * Search, filter, inspect details, and export scan logs to CSV / JSON.
 * ============================================================================
 */

const History = (function () {
  let historyCache = [];

  function init() {
    const searchInput = document.getElementById("historySearchInput");
    const typeFilter = document.getElementById("historyTypeFilter");
    const resultFilter = document.getElementById("historyResultFilter");
    const sortFilter = document.getElementById("historySortFilter");

    const refreshHistory = () => loadHistory();

    [searchInput, typeFilter, resultFilter, sortFilter].forEach(el => {
      if (el) {
        el.addEventListener("input", refreshHistory);
        el.addEventListener("change", refreshHistory);
      }
    });

    // Export buttons
    const exportCsvBtn = document.getElementById("exportCsvBtn");
    if (exportCsvBtn) exportCsvBtn.addEventListener("click", exportToCsv);

    const exportJsonBtn = document.getElementById("exportJsonBtn");
    if (exportJsonBtn) exportJsonBtn.addEventListener("click", exportToJson);
  }

  async function loadHistory() {
    const tbody = document.getElementById("historyTableBody");
    const countBadge = document.getElementById("historyCountBadge");
    if (!tbody) return;

    const q = document.getElementById("historySearchInput")?.value.trim() || "";
    const input_type = document.getElementById("historyTypeFilter")?.value || "";
    const result = document.getElementById("historyResultFilter")?.value || "";
    const sort = document.getElementById("historySortFilter")?.value || "newest";

    tbody.innerHTML = '<tr><td colspan="7" class="text-center py-4 text-muted"><span class="spinner-border spinner-border-sm me-2"></span>Loading scan records...</td></tr>';

    try {
      const res = await API.getHistory({ q, input_type, result, sort });
      if (!res.success) {
        tbody.innerHTML = `<tr><td colspan="7" class="text-center py-4 text-danger">${res.error || 'Failed to fetch scan history.'}</td></tr>`;
        return;
      }

      historyCache = res.history || [];
      if (countBadge) countBadge.textContent = `${historyCache.length} Record(s)`;

      if (historyCache.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center py-5 text-muted"><i class="fa-regular fa-folder-open fa-2x mb-2 d-block opacity-50"></i>No matching scan history found.</td></tr>';
        return;
      }

      tbody.innerHTML = historyCache.map(s => {
        const badgeClass = s.result === "SAFE" ? "bg-success-subtle text-success border-success-subtle" :
                           s.result === "SCAM" ? "bg-danger-subtle text-danger border-danger-subtle" :
                           "bg-warning-subtle text-warning border-warning-subtle";

        return `
          <tr>
            <td class="fw-bold text-primary">#${s.scan_id}</td>
            <td><span class="badge bg-light text-dark border">${s.input_type.toUpperCase()}</span></td>
            <td class="text-truncate" style="max-width: 250px;" title="${escapeHtml(s.input_value)}">${escapeHtml(s.input_preview || s.input_value)}</td>
            <td><span class="badge ${badgeClass} border">${s.result}</span></td>
            <td><span class="fw-bold">${s.risk_score}</span>/100</td>
            <td class="small text-muted">${new Date(s.scan_date).toLocaleString()}</td>
            <td>
              <button class="btn btn-sm btn-outline-primary view-scan-btn" data-id="${s.scan_id}">
                <i class="fa-solid fa-eye me-1"></i> Inspect
              </button>
            </td>
          </tr>
        `;
      }).join("");

      // Bind inspect buttons
      tbody.querySelectorAll(".view-scan-btn").forEach(btn => {
        btn.addEventListener("click", () => {
          const scanId = btn.getAttribute("data-id");
          const scan = historyCache.find(x => x.scan_id === scanId);
          if (scan) {
            openDetailModal(scan);
          }
        });
      });

    } catch (e) {
      tbody.innerHTML = `<tr><td colspan="7" class="text-center py-4 text-danger">Error: ${e.message}</td></tr>`;
    }
  }

  function openDetailModal(scan) {
    const modalEl = document.getElementById("historyDetailModal");
    if (!modalEl) return;

    document.getElementById("modalScanId").textContent = `#${scan.scan_id}`;
    document.getElementById("modalScanType").textContent = scan.input_type.toUpperCase();
    document.getElementById("modalScanDate").textContent = new Date(scan.scan_date).toLocaleString();
    document.getElementById("modalScanInput").textContent = scan.input_value;

    const verdictEl = document.getElementById("modalScanVerdict");
    const badgeClass = scan.result === "SAFE" ? "bg-success" : scan.result === "SCAM" ? "bg-danger" : "bg-warning text-dark";
    verdictEl.className = `badge ${badgeClass} fs-6 px-3 py-2`;
    verdictEl.textContent = scan.result;

    document.getElementById("modalScanScore").textContent = `${scan.risk_score}/100 (${scan.risk_level})`;

    const reasonsList = document.getElementById("modalScanReasons");
    reasonsList.innerHTML = "";
    (scan.reasons || []).forEach(r => {
      const li = document.createElement("li");
      li.textContent = r;
      reasonsList.appendChild(li);
    });

    const indicatorsBox = document.getElementById("modalScanIndicators");
    indicatorsBox.innerHTML = "";
    (scan.indicators || []).forEach(ind => {
      const span = document.createElement("span");
      span.className = "badge bg-light text-dark border me-1 mb-1 p-2";
      span.innerHTML = `<i class="fa-solid fa-circle-exclamation text-warning me-1"></i> ${escapeHtml(ind)}`;
      indicatorsBox.appendChild(span);
    });

    bootstrap.Modal.getOrCreateInstance(modalEl).show();
  }

  // ==========================================
  // EXPORT UTILITIES
  // ==========================================

  function exportToCsv() {
    if (historyCache.length === 0) {
      showToast("No scan history to export.", "warning");
      return;
    }

    const headers = ["Scan ID", "Input Type", "Result", "Risk Score", "Risk Level", "Scan Date", "Input Value"];
    const rows = historyCache.map(s => [
      `"${s.scan_id}"`,
      `"${s.input_type}"`,
      `"${s.result}"`,
      s.risk_score,
      `"${s.risk_level}"`,
      `"${s.scan_date}"`,
      `"${(s.input_value || "").replace(/"/g, '""')}"`
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `scanguard_history_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("Scan history exported to CSV!", "success");
  }

  function exportToJson() {
    if (historyCache.length === 0) {
      showToast("No scan history to export.", "warning");
      return;
    }

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(historyCache, null, 2));
    const link = document.createElement("a");
    link.setAttribute("href", dataStr);
    link.setAttribute("download", `scanguard_history_${Date.now()}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("Scan history exported to JSON!", "success");
  }

  function escapeHtml(str) {
    return (str || "").replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  return {
    init,
    loadHistory
  };
})();

window.History = History;
