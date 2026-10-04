const App = {
  csrfToken() {
    const meta = document.querySelector('meta[name="csrf-token"]');
    return meta ? meta.getAttribute('content') : '';
  },
  async fetchJSON(url, options = {}) {
    const headers = options.headers || {};
    headers['Accept'] = 'application/json';
    if (!(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
    }
    if (options.method && options.method !== 'GET') {
      headers['X-CSRFToken'] = this.csrfToken();
    }
    const res = await fetch(url, { ...options, headers, credentials: 'same-origin' });
    let data = {};
    try { data = await res.json(); } catch (_) {}
    return { res, data };
  }
};

const AppAuth = {
  showAlert(message, type = 'danger') {
    const el = document.getElementById('authAlert');
    if (!el) return;
    el.className = `alert alert-${type}`;
    el.textContent = message;
    el.classList.remove('d-none');
  },
  async submitAuth(url, payload, btn) {
    btn.disabled = true;
    const original = btn.textContent;
    btn.textContent = 'Please wait...';
    const { res, data } = await App.fetchJSON(url, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      window.location.href = data.redirect || '/dashboard';
      return;
    }
    AppAuth.showAlert(data.error || 'Request failed.');
    btn.disabled = false;
    btn.textContent = original;
  }
};

window.App = App;
window.AppAuth = AppAuth;
