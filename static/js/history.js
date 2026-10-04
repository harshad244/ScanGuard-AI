let historyCache = [];

function badge(result) {
  return `<span class="badge result-badge result-${result.toLowerCase()}">${result}</span>`;
}

function renderHistory(rows) {
  const body = document.getElementById('historyBody');
  if (!rows.length) {
    body.innerHTML = '<tr><td colspan="8" class="text-center text-muted py-4">No scan history found.</td></tr>';
    return;
  }
  body.innerHTML = rows.map((r) => `
    <tr>
      <td><a href="/result/${r.scan_id}">#${r.scan_id}</a></td>
      <td>${r.input_type.toUpperCase()}</td>
      <td class="text-truncate" style="max-width:180px">${escapeHtml(r.input_preview || '')}</td>
      <td>${badge(r.result)}</td>
      <td>${r.risk_score}/100</td>
      <td>${r.risk_level}</td>
      <td class="small text-muted">${r.scan_date}</td>
      <td>
        ${r.input_type === 'message' ? `<button type="button" class="btn btn-sm btn-outline-secondary view-full" data-id="${r.scan_id}">View</button>` : ''}
      </td>
    </tr>
  `).join('');

  body.querySelectorAll('.view-full').forEach((btn) => {
    btn.addEventListener('click', () => {
      const row = historyCache.find((x) => x.scan_id === Number(btn.dataset.id));
      document.getElementById('fullMessageContent').textContent = row ? row.input_value : '';
      bootstrap.Modal.getOrCreateInstance(document.getElementById('fullMessageModal')).show();
    });
  });
}

function escapeHtml(str) {
  return str.replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

async function loadHistory() {
  const q = document.getElementById('historySearch').value.trim();
  const result = document.getElementById('filterResult').value;
  const input_type = document.getElementById('filterType').value;
  const sort = document.getElementById('sortDate').value;
  const params = new URLSearchParams({ q, result, input_type, sort });
  const { res, data } = await App.fetchJSON(`/api/history?${params.toString()}`);
  if (!res.ok) return;
  historyCache = data.history || [];
  renderHistory(historyCache);
}

['historySearch', 'filterResult', 'filterType', 'sortDate'].forEach((id) => {
  document.getElementById(id).addEventListener('change', loadHistory);
  document.getElementById(id).addEventListener('input', loadHistory);
});

loadHistory();
