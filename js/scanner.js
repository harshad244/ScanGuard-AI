/**
 * ============================================================================
 * SCANGUARD AI - SCANNER CONTROLLER (scanner.js)
 * ============================================================================
 * Manages URL Scanning, Message/Text Scanning, Progress Animation, and Result Rendering.
 * ============================================================================
 */

const Scanner = (function () {
  let latestScanResult = null;

  function init() {
    setupUrlScanner();
    setupMessageScanner();
    setupQuickSamples();
  }

  function setupUrlScanner() {
    const form = document.getElementById("urlScannerForm");
    if (!form) return;

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const urlInput = document.getElementById("targetUrlInput");
      const url = urlInput ? urlInput.value.trim() : "";

      if (!url) {
        showToast("Please enter a URL to scan.", "warning");
        return;
      }

      await runScanProcess("url", async () => {
        return await API.scanUrl(url);
      });
    });
  }

  function setupMessageScanner() {
    const form = document.getElementById("messageScannerForm");
    if (!form) return;

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const msgInput = document.getElementById("targetMessageInput");
      const typeSelect = document.getElementById("messageTypeSelect");
      const message = msgInput ? msgInput.value.trim() : "";
      const messageType = typeSelect ? typeSelect.value : "general";

      if (!message) {
        showToast("Please enter a message to scan.", "warning");
        return;
      }

      await runScanProcess("message", async () => {
        return await API.scanMessage(message, messageType);
      });
    });
  }

  function setupQuickSamples() {
    // Quick URL demo buttons
    document.querySelectorAll(".sample-url-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const url = btn.getAttribute("data-sample");
        const input = document.getElementById("targetUrlInput");
        if (input && url) {
          input.value = url;
          input.focus();
        }
      });
    });

    // Quick Message demo buttons
    document.querySelectorAll(".sample-msg-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const msg = btn.getAttribute("data-sample");
        const type = btn.getAttribute("data-type") || "general";
        const input = document.getElementById("targetMessageInput");
        const typeSelect = document.getElementById("messageTypeSelect");
        if (input && msg) {
          input.value = msg;
          if (typeSelect) typeSelect.value = type;
          input.focus();
        }
      });
    });
  }

  // ==========================================
  // SCAN EXECUTION & ANIMATION
  // ==========================================

  async function runScanProcess(type, scanFn) {
    const prefix = type === "message" ? "msg" : "url";
    const loadingCard = document.getElementById(`${prefix}ScanLoadingCard`) || document.getElementById("scanLoadingCard");
    const resultCard = document.getElementById(`${prefix}ScanResultCard`) || document.getElementById("scanResultCard");
    const progressEl = document.getElementById(`${prefix}ScanProgressBar`) || document.getElementById("scanProgressBar");
    const progressText = document.getElementById(`${prefix}ScanProgressText`) || document.getElementById("scanProgressText");

    if (loadingCard) loadingCard.classList.remove("d-none");
    if (resultCard) resultCard.classList.add("d-none");

    // Smooth progress simulation while backend runs
    let progress = 10;
    if (progressEl) progressEl.style.width = "10%";
    if (progressText) {
      progressText.textContent = type === "message"
        ? "Extracting message tokens and analyzing linguistic indicators..."
        : "Extracting lexical & structural security features...";
    }

    const interval = setInterval(() => {
      progress += 20;
      if (progress > 85) progress = 85;
      if (progressEl) progressEl.style.width = `${progress}%`;

      if (progress === 30 && progressText) {
        progressText.textContent = type === "message"
          ? "Evaluating social engineering tactics, urgency patterns & financial lures..."
          : "Evaluating against AI scam threat heuristics & brand spoof database...";
      }
      if (progress === 60 && progressText) {
        progressText.textContent = "Querying threat intelligence & calculating calibrated risk score...";
      }
    }, 250);

    try {
      const res = await scanFn();
      clearInterval(interval);

      if (progressEl) progressEl.style.width = "100%";
      if (progressText) progressText.textContent = "Analysis complete!";

      setTimeout(() => {
        if (loadingCard) loadingCard.classList.add("d-none");
        if (res && res.success) {
          latestScanResult = res;
          renderScanResult(res, type);
        } else {
          showToast((res && res.error) || "Analysis failed. Please check your connection.", "danger");
        }
      }, 400);

    } catch (err) {
      clearInterval(interval);
      if (loadingCard) loadingCard.classList.add("d-none");
      showToast("Error during scan: " + err.message, "danger");
    }
  }

  // ==========================================
  // RESULT DISPLAY RENDERING
  // ==========================================

  function renderScanResult(scan, type = "url") {
    const prefix = type === "message" ? "msg" : "url";
    const resultCard = document.getElementById(`${prefix}ScanResultCard`) || document.getElementById("scanResultCard");
    if (!resultCard) return;

    const verdict = (scan.result || "SAFE").toUpperCase();
    const score = Number(scan.risk_score || 0);
    const level = (scan.risk_level || "LOW").toUpperCase();

    // Verdict styling classes
    let colorClass = "safe";
    let badgeClass = "bg-success text-white";
    let scoreColor = "#10b981";

    if (verdict === "SCAM" || level === "HIGH") {
      colorClass = "scam";
      badgeClass = "bg-danger text-white";
      scoreColor = "#ef4444";
    } else if (verdict === "SUSPICIOUS" || level === "MEDIUM") {
      colorClass = "suspicious";
      badgeClass = "bg-warning text-dark";
      scoreColor = "#f59e0b";
    }

    // Set Header Verdict & Badges
    const resTitle = document.getElementById(`${prefix}ResultVerdictTitle`) || document.getElementById("resultVerdictTitle");
    const resBadge = document.getElementById(`${prefix}ResultVerdictBadge`) || document.getElementById("resultVerdictBadge");
    const resLevel = document.getElementById(`${prefix}ResultLevelBadge`) || document.getElementById("resultLevelBadge");
    const resScoreText = document.getElementById(`${prefix}ResultScoreNumber`) || document.getElementById("resultScoreNumber");
    const resScoreFill = document.getElementById(`${prefix}ResultScoreMeter`) || document.getElementById("resultScoreMeter");

    if (resTitle) {
      resTitle.className = `h3 fw-bold mb-0 text-${colorClass}`;
      resTitle.textContent = verdict === "SAFE" ? "Verified Safe" : verdict === "SCAM" ? "Scam / Phishing Detected" : "Suspicious Activity Detected";
    }

    if (resBadge) {
      resBadge.className = `badge ${badgeClass} fs-6 px-3 py-2`;
      resBadge.innerHTML = `<i class="fa-solid ${verdict === 'SAFE' ? 'fa-shield-check' : verdict === 'SCAM' ? 'fa-skull-crossbones' : 'fa-triangle-exclamation'} me-1"></i> ${verdict}`;
    }

    if (resLevel) {
      resLevel.className = `badge bg-light text-dark border fs-6 px-3 py-2`;
      resLevel.innerHTML = `Risk Level: <strong class="text-${colorClass}">${level}</strong>`;
    }

    if (resScoreText) {
      resScoreText.textContent = `${score}/100`;
      resScoreText.style.color = scoreColor;
    }

    if (resScoreFill) {
      resScoreFill.style.width = `${score}%`;
      resScoreFill.style.backgroundColor = scoreColor;
    }

    // Render Input Preview
    const previewEl = document.getElementById(`${prefix}ResultInputPreview`) || document.getElementById("resultInputPreview");
    if (previewEl) {
      previewEl.textContent = scan.input_value || "";
    }

    // Render Reasons
    const reasonsList = document.getElementById(`${prefix}ResultReasonsList`) || document.getElementById("resultReasonsList");
    if (reasonsList) {
      reasonsList.innerHTML = "";
      const reasons = scan.reasons || [];
      if (reasons.length > 0) {
        reasons.forEach(r => {
          const li = document.createElement("li");
          li.className = "mb-1";
          li.textContent = r;
          reasonsList.appendChild(li);
        });
      } else {
        reasonsList.innerHTML = '<li class="text-muted">No immediate suspicious anomalies found.</li>';
      }
    }

    // Render Indicator Chips
    const indicatorsBox = document.getElementById(`${prefix}ResultIndicatorsBox`) || document.getElementById("resultIndicatorsBox");
    if (indicatorsBox) {
      indicatorsBox.innerHTML = "";
      const indicators = scan.indicators || [];
      if (indicators.length > 0) {
        indicators.forEach(ind => {
          const chip = document.createElement("span");
          chip.className = `badge bg-light-subtle text-${colorClass} border border-${colorClass}-subtle p-2 me-2 mb-2 text-wrap`;
          chip.innerHTML = `<i class="fa-solid fa-circle-exclamation me-1"></i> ${escapeHtml(ind)}`;
          indicatorsBox.appendChild(chip);
        });
      } else {
        indicatorsBox.innerHTML = '<p class="text-muted small mb-0"><i class="fa-solid fa-circle-check text-success me-1"></i> Zero critical threat indicators found.</p>';
      }
    }

    // Recommendation Text
    const recText = document.getElementById(`${prefix}ResultRecommendationText`) || document.getElementById("resultRecommendationText");
    if (recText) {
      recText.textContent = scan.recommendation || (window.AIEngine && window.AIEngine.getRecommendation(verdict)) || "Stay vigilant with online links and messages.";
    }

    // Scan ID & Timestamp
    const scanMeta = document.getElementById(`${prefix}ResultScanMeta`) || document.getElementById("resultScanMeta");
    if (scanMeta) {
      scanMeta.textContent = `Scan ID: #${scan.scan_id || 'N/A'} • ${new Date(scan.scan_date || Date.now()).toLocaleString()}`;
    }

    // Show Card and Scroll Into View
    resultCard.classList.remove("d-none");
    resultCard.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function escapeHtml(str) {
    return (str || "").replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  return {
    init,
    renderScanResult,
    getLatestResult: () => latestScanResult
  };
})();

window.Scanner = Scanner;
