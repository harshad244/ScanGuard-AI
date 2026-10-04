/**
 * ============================================================================
 * SCANGUARD AI - ADMIN PANEL CONTROLLER (admin.js)
 * ============================================================================
 * Handles user management, global scan audit logs, AI engine status, and API settings.
 * ============================================================================
 */

const Admin = (function () {
  function init() {
    setupSettingsForm();
  }

  async function loadAdminData() {
    const user = API.getCurrentUser();
    if (!user || user.role !== "admin") {
      showToast("Access restricted: Administrator role required.", "danger");
      window.location.hash = "#dashboard";
      return;
    }

    try {
      const res = await API.getAdminData();
      if (!res.success) {
        showToast(res.error || "Failed to load admin data.", "danger");
        return;
      }

      // Update KPI counters
      const stats = res.stats || {};
      document.getElementById("adminTotalUsers").textContent = stats.total_users || 0;
      document.getElementById("adminTotalScans").textContent = stats.total_scans || 0;
      document.getElementById("adminSafeScans").textContent = stats.safe || 0;
      document.getElementById("adminSuspiciousScans").textContent = stats.suspicious || 0;
      document.getElementById("adminScamScans").textContent = stats.scam || 0;

      // Render Users Table
      renderUsersTable(res.users || []);

      // Render Global Scans Table
      renderGlobalScansTable(res.recent_scans || []);

      // Render AI Models Table
      renderModelsTable(res.models || []);

    } catch (e) {
      console.warn("Failed to load admin panel data", e);
    }
  }

  function renderUsersTable(users) {
    const tbody = document.getElementById("adminUsersTableBody");
    if (!tbody) return;

    if (users.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted py-4">No users found.</td></tr>';
      return;
    }

    tbody.innerHTML = users.map(u => {
      const isActive = u.status === "active";
      const statusBadge = isActive ? '<span class="badge bg-success-subtle text-success border-success-subtle">Active</span>' :
                                     '<span class="badge bg-danger-subtle text-danger border-danger-subtle">Disabled</span>';
      const roleBadge = u.role === "admin" ? '<span class="badge bg-primary-subtle text-primary border-primary-subtle">ADMIN</span>' :
                                            '<span class="badge bg-light text-dark border">USER</span>';

      return `
        <tr>
          <td class="fw-bold text-secondary">#${u.user_id}</td>
          <td class="fw-semibold">${escapeHtml(u.name)}</td>
          <td>${escapeHtml(u.email)}</td>
          <td>${roleBadge}</td>
          <td>${statusBadge}</td>
          <td class="small text-muted">${u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}</td>
          <td>
            <div class="btn-group btn-group-sm">
              <button class="btn btn-outline-secondary toggle-user-btn" data-id="${u.user_id}" title="Toggle Active/Disabled">
                <i class="fa-solid ${isActive ? 'fa-user-slash text-danger' : 'fa-user-check text-success'}"></i>
              </button>
              <button class="btn btn-outline-secondary role-user-btn" data-id="${u.user_id}" data-role="${u.role === 'admin' ? 'user' : 'admin'}" title="Toggle Admin Role">
                <i class="fa-solid fa-crown ${u.role === 'admin' ? 'text-warning' : 'text-muted'}"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join("");

    // Bind action buttons
    tbody.querySelectorAll(".toggle-user-btn").forEach(btn => {
      btn.addEventListener("click", async () => {
        const uid = btn.getAttribute("data-id");
        btn.disabled = true;
        const res = await API.manageUser(uid, "toggle_status");
        if (res.success) {
          showToast(res.message, "success");
          loadAdminData();
        } else {
          showToast(res.error || "Failed to update user", "danger");
          btn.disabled = false;
        }
      });
    });

    tbody.querySelectorAll(".role-user-btn").forEach(btn => {
      btn.addEventListener("click", async () => {
        const uid = btn.getAttribute("data-id");
        const newRole = btn.getAttribute("data-role");
        btn.disabled = true;
        const res = await API.manageUser(uid, "change_role", newRole);
        if (res.success) {
          showToast(res.message, "success");
          loadAdminData();
        } else {
          showToast(res.error || "Failed to update role", "danger");
          btn.disabled = false;
        }
      });
    });
  }

  function renderGlobalScansTable(scans) {
    const tbody = document.getElementById("adminScansTableBody");
    if (!tbody) return;

    if (scans.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted py-4">No global scans logged yet.</td></tr>';
      return;
    }

    tbody.innerHTML = scans.map(s => {
      const badgeClass = s.result === "SAFE" ? "bg-success-subtle text-success" :
                         s.result === "SCAM" ? "bg-danger-subtle text-danger" : "bg-warning-subtle text-warning";
      return `
        <tr>
          <td class="fw-bold text-primary">#${s.scan_id}</td>
          <td><small class="text-muted">${escapeHtml(s.user_email || s.user_id || 'guest')}</small></td>
          <td><span class="badge bg-light text-dark border">${s.input_type.toUpperCase()}</span></td>
          <td class="text-truncate" style="max-width: 200px;">${escapeHtml(s.input_preview)}</td>
          <td><span class="badge ${badgeClass} border">${s.result}</span></td>
          <td><strong>${s.risk_score}</strong>/100</td>
          <td class="small text-muted">${new Date(s.scan_date).toLocaleDateString()}</td>
        </tr>
      `;
    }).join("");
  }

  function renderModelsTable(models) {
    const tbody = document.getElementById("adminModelsTableBody");
    if (!tbody) return;

    tbody.innerHTML = models.map(m => `
      <tr>
        <td class="fw-semibold"><i class="fa-solid fa-brain text-primary me-2"></i>${escapeHtml(m.model_name)}</td>
        <td>${escapeHtml(m.model_type)}</td>
        <td><span class="badge bg-light text-dark border">${escapeHtml(m.version)}</span></td>
        <td><span class="text-success fw-bold">${escapeHtml(m.accuracy)}</span></td>
        <td><span class="badge bg-success-subtle text-success border border-success-subtle">${escapeHtml(m.status)}</span></td>
      </tr>
    `).join("");
  }

  function setupSettingsForm() {
    const form = document.getElementById("adminSettingsForm");
    if (!form) return;

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const geminiKey = document.getElementById("settingGeminiKey").value.trim();
      const safeBrowsingKey = document.getElementById("settingSafeBrowsingKey").value.trim();

      const res = await API.saveSettings({
        gemini_api_key: geminiKey,
        safe_browsing_api_key: safeBrowsingKey
      });

      if (res.success) {
        showToast("AI Threat Intelligence API Keys saved!", "success");
      } else {
        showToast(res.error || "Failed to save settings", "danger");
      }
    });
  }

  function escapeHtml(str) {
    return (str || "").replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  return {
    init,
    loadAdminData
  };
})();

window.Admin = Admin;
