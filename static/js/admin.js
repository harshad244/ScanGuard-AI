const AdminUsers = {
  async load(q = '') {
    const params = q ? `?q=${encodeURIComponent(q)}` : '';
    const { res, data } = await App.fetchJSON(`/api/admin/users${params}`);
    const body = document.getElementById('usersBody');
    if (!res.ok) {
      body.innerHTML = '<tr><td colspan="7" class="text-danger text-center">Failed to load users.</td></tr>';
      return;
    }
    const users = data.users || [];
    if (!users.length) {
      body.innerHTML = '<tr><td colspan="7" class="text-muted text-center py-4">No users found.</td></tr>';
      return;
    }
    body.innerHTML = users.map((u) => `
      <tr>
        <td>${u.user_id}</td>
        <td>${u.name}</td>
        <td>${u.email}</td>
        <td>${u.role}</td>
        <td>${u.is_active ? 'Active' : 'Disabled'}</td>
        <td class="small">${u.created_at || ''}</td>
        <td>
          ${u.role !== 'admin' ? `<button class="btn btn-sm btn-outline-secondary toggle-user" data-id="${u.user_id}">${u.is_active ? 'Disable' : 'Enable'}</button>` : '—'}
        </td>
      </tr>`).join('');
    body.querySelectorAll('.toggle-user').forEach((btn) => {
      btn.addEventListener('click', async () => {
        await App.fetchJSON(`/api/admin/users/${btn.dataset.id}/toggle`, { method: 'POST', body: '{}' });
        AdminUsers.load(document.getElementById('userSearch').value.trim());
      });
    });
  },
  init() {
    const search = document.getElementById('userSearch');
    search.addEventListener('input', () => AdminUsers.load(search.value.trim()));
    AdminUsers.load();
  }
};

const AdminReports = {
  async init() {
    const { res, data } = await App.fetchJSON('/api/admin/reports');
    if (!res.ok || typeof Chart === 'undefined') return;
    const byType = data.by_type || [];
    new Chart(document.getElementById('typeChart'), {
      type: 'bar',
      data: {
        labels: byType.map((x) => x.input_type.toUpperCase()),
        datasets: [{ label: 'Scans', data: byType.map((x) => x.cnt), backgroundColor: ['#2563eb', '#64748b'] }]
      },
      options: { plugins: { legend: { display: false } } }
    });
    const daily = data.daily || [];
    new Chart(document.getElementById('dailyChart'), {
      type: 'line',
      data: {
        labels: daily.map((d) => d.day),
        datasets: [{ label: 'Daily scans', data: daily.map((d) => d.cnt), borderColor: '#2563eb', tension: 0.25 }]
      }
    });
    const monthly = data.monthly || [];
    new Chart(document.getElementById('monthlyChart'), {
      type: 'bar',
      data: {
        labels: monthly.map((m) => m.month),
        datasets: [{ label: 'Monthly scans', data: monthly.map((m) => m.cnt), backgroundColor: '#94a3b8' }]
      },
      options: { plugins: { legend: { display: false } } }
    });
  }
};

const AdminScans = {
  async init() {
    const { res, data } = await App.fetchJSON('/api/admin/scans');
    const body = document.getElementById('adminScansBody');
    if (!res.ok) return;
    const scans = data.scans || [];
    body.innerHTML = scans.length ? scans.map((s) => `
      <tr>
        <td>#${s.scan_id}</td>
        <td class="small">${s.email}</td>
        <td>${s.input_type}</td>
        <td class="text-truncate" style="max-width:200px">${s.input_preview || ''}</td>
        <td>${s.result}</td>
        <td>${s.risk_score}</td>
        <td class="small">${s.scan_date}</td>
      </tr>`).join('') : '<tr><td colspan="7" class="text-muted text-center py-4">No scans.</td></tr>';
  }
};

window.AdminUsers = AdminUsers;
window.AdminReports = AdminReports;
window.AdminScans = AdminScans;
