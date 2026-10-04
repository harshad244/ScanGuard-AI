const Scanner = {
  setLoading(loading) {
    const loadingEl = document.getElementById('scanLoading');
    const btn = document.querySelector('form button[type="submit"]');
    if (loadingEl) loadingEl.classList.toggle('d-none', !loading);
    if (btn) btn.disabled = loading;
  },
  showAlert(message, type = 'danger') {
    const el = document.getElementById('scanAlert');
    if (!el) return;
    el.className = `alert alert-${type}`;
    el.textContent = message;
    el.classList.remove('d-none');
  },
  async submitScan(url, payload) {
    this.setLoading(true);
    const alert = document.getElementById('scanAlert');
    if (alert) alert.classList.add('d-none');
    const { res, data } = await App.fetchJSON(url, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    this.setLoading(false);
    if (res.ok) {
      window.location.href = data.redirect;
      return;
    }
    this.showAlert(data.error || 'Unable to perform analysis. Please try again.');
  },
  initUrlScanner() {
    const form = document.getElementById('urlScanForm');
    if (!form) return;
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      Scanner.submitScan('/api/scan/url', { url: document.getElementById('url').value.trim() });
    });
  },
  initMessageScanner() {
    const form = document.getElementById('messageScanForm');
    if (!form) return;
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      Scanner.submitScan('/api/scan/message', {
        message: document.getElementById('message').value,
        message_type: document.getElementById('message_type').value
      });
    });
  }
};
window.Scanner = Scanner;
