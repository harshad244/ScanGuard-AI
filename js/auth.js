/**
 * ============================================================================
 * SCANGUARD AI - AUTHENTICATION & OTP CONTROLLER (auth.js)
 * ============================================================================
 * Handles:
 *  - Email OTP generation & verification flow for registration & login
 *  - Login & Registration UI state
 *  - Session validation on load
 *  - Profile management & Logout
 * ============================================================================
 */

const Auth = (function () {
  let otpTimerInterval = null;
  let otpCountdownSeconds = 60;
  let currentPendingEmail = "";

  function init() {
    setupAuthListeners();
    checkExistingSession();
    updateGasStatusUI();
  }

  function setupAuthListeners() {
    // Send OTP Button in Register Modal / Form
    const sendOtpBtn = document.getElementById("sendOtpBtn");
    if (sendOtpBtn) {
      sendOtpBtn.addEventListener("click", handleSendRegisterOtp);
    }

    // Register Form submission
    const registerForm = document.getElementById("registerForm");
    if (registerForm) {
      registerForm.addEventListener("submit", handleRegisterSubmit);
    }

    // Login Form submission
    const loginForm = document.getElementById("loginForm");
    if (loginForm) {
      loginForm.addEventListener("submit", handleLoginSubmit);
    }

    // Profile Form submission
    const profileForm = document.getElementById("profileForm");
    if (profileForm) {
      profileForm.addEventListener("submit", handleProfileSubmit);
    }

    // Logout buttons
    document.querySelectorAll(".btn-logout").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        API.clearSession();
        showToast("Logged out successfully.", "info");
        window.location.hash = "#home";
      });
    });

    // Listen to auth changes across the app
    window.addEventListener("scanguard:auth-change", (e) => {
      updateNavbarAndViews(e.detail.user);
    });

    // GAS URL Configuration Form
    const gasConfigForm = document.getElementById("gasConfigForm");
    if (gasConfigForm) {
      gasConfigForm.addEventListener("submit", (e) => {
        e.preventDefault();
        const urlInput = document.getElementById("gasUrlInput").value.trim();
        if (API.setGasUrl(urlInput)) {
          showToast("GAS Web App URL saved successfully!", "success");
          updateGasStatusUI();
          bootstrap.Modal.getInstance(document.getElementById("gasConfigModal"))?.hide();
        } else {
          showToast("Please enter a valid Google Apps Script URL (starts with https://script.google.com/)", "danger");
        }
      });
    }
  }

  async function checkExistingSession() {
    const user = API.getCurrentUser();
    if (user) {
      updateNavbarAndViews(user);
      // Verify token in background
      API.verifySession().then(res => {
        if (!res.success) {
          API.clearSession();
        }
      });
    } else {
      updateNavbarAndViews(null);
    }
  }

  // ==========================================
  // EMAIL OTP REGISTRATION FLOW
  // ==========================================

  async function handleSendRegisterOtp(e) {
    e.preventDefault();
    const emailInput = document.getElementById("regEmail");
    const email = emailInput ? emailInput.value.trim() : "";

    if (!email || !email.includes("@")) {
      showAuthAlert("regAlert", "Please enter a valid email address first.", "warning");
      return;
    }

    const btn = document.getElementById("sendOtpBtn");
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Sending OTP...';

    const res = await API.sendOTP(email, "registration");
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-paper-plane me-1"></i> Send OTP';

    if (res.success) {
      currentPendingEmail = email;
      showAuthAlert("regAlert", res.message || "OTP sent successfully! Check your inbox.", "success");
      
      // If local demo mode, highlight demo OTP
      if (res.demo_otp) {
        showToast(`[Demo Mode] OTP Code: ${res.demo_otp}`, "info", 10000);
        const otpInput = document.getElementById("regOtp");
        if (otpInput) otpInput.value = res.demo_otp;
      }

      startOtpCountdown();
    } else {
      showAuthAlert("regAlert", res.error || "Failed to send OTP email.", "danger");
    }
  }

  function startOtpCountdown() {
    const btn = document.getElementById("sendOtpBtn");
    const timerText = document.getElementById("otpTimerText");
    if (!btn) return;

    btn.disabled = true;
    otpCountdownSeconds = 60;

    if (otpTimerInterval) clearInterval(otpTimerInterval);

    otpTimerInterval = setInterval(() => {
      otpCountdownSeconds--;
      if (timerText) timerText.textContent = `Resend in ${otpCountdownSeconds}s`;
      btn.innerHTML = `<i class="fa-solid fa-clock me-1"></i> ${otpCountdownSeconds}s`;

      if (otpCountdownSeconds <= 0) {
        clearInterval(otpTimerInterval);
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-rotate me-1"></i> Resend OTP';
        if (timerText) timerText.textContent = "";
      }
    }, 1000);
  }

  async function handleRegisterSubmit(e) {
    e.preventDefault();
    const name = document.getElementById("regName").value.trim();
    const email = document.getElementById("regEmail").value.trim();
    const password = document.getElementById("regPassword").value.trim();
    const confirmPassword = document.getElementById("regConfirmPassword").value.trim();
    const otp = document.getElementById("regOtp").value.trim();

    if (!name || !email || !password) {
      showAuthAlert("regAlert", "Please fill in all required fields.", "warning");
      return;
    }

    if (password.length < 8) {
      showAuthAlert("regAlert", "Password must be at least 8 characters long.", "warning");
      return;
    }

    if (password !== confirmPassword) {
      showAuthAlert("regAlert", "Passwords do not match.", "warning");
      return;
    }

    if (!otp) {
      showAuthAlert("regAlert", "Please enter the 6-digit OTP sent to your email.", "warning");
      return;
    }

    const submitBtn = document.getElementById("regSubmitBtn");
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Verifying & Registering...';

    const res = await API.register({ name, email, password, otp });

    submitBtn.disabled = false;
    submitBtn.innerHTML = 'Create Account';

    if (res.success) {
      showToast("Account created successfully! Welcome to ScanGuard AI.", "success");
      bootstrap.Modal.getInstance(document.getElementById("registerModal"))?.hide();
      document.getElementById("registerForm").reset();
      window.location.hash = "#dashboard";
    } else {
      showAuthAlert("regAlert", res.error || "Registration failed. Please try again.", "danger");
    }
  }

  // ==========================================
  // LOGIN FLOW
  // ==========================================

  async function handleLoginSubmit(e) {
    e.preventDefault();
    const email = document.getElementById("loginEmail").value.trim();
    const password = document.getElementById("loginPassword").value.trim();

    if (!email || !password) {
      showAuthAlert("loginAlert", "Please enter your email and password.", "warning");
      return;
    }

    const submitBtn = document.getElementById("loginSubmitBtn");
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Authenticating...';

    const res = await API.login(email, password);

    submitBtn.disabled = false;
    submitBtn.innerHTML = 'Login to Account';

    if (res.success) {
      showToast(`Welcome back, ${res.user.name}!`, "success");
      bootstrap.Modal.getInstance(document.getElementById("loginModal"))?.hide();
      document.getElementById("loginForm").reset();
      window.location.hash = "#dashboard";
    } else {
      showAuthAlert("loginAlert", res.error || "Invalid login credentials.", "danger");
    }
  }

  // ==========================================
  // PROFILE FLOW
  // ==========================================

  async function handleProfileSubmit(e) {
    e.preventDefault();
    const name = document.getElementById("profileName").value.trim();
    const password = document.getElementById("profilePassword").value.trim();

    const res = await API.updateProfile({ name, password });
    if (res.success) {
      showToast("Profile updated successfully!", "success");
      document.getElementById("profilePassword").value = "";
    } else {
      showToast(res.error || "Failed to update profile.", "danger");
    }
  }

  // ==========================================
  // UI & NAVBAR SYNC
  // ==========================================

  function updateNavbarAndViews(user) {
    const authElements = document.querySelectorAll(".auth-only");
    const guestElements = document.querySelectorAll(".guest-only");
    const adminElements = document.querySelectorAll(".admin-only");
    const userNameDisplays = document.querySelectorAll(".user-name-display");
    const userEmailDisplays = document.querySelectorAll(".user-email-display");
    const userRoleDisplays = document.querySelectorAll(".user-role-display");

    if (user) {
      authElements.forEach(el => el.classList.remove("d-none"));
      guestElements.forEach(el => el.classList.add("d-none"));

      if (user.role === "admin") {
        adminElements.forEach(el => el.classList.remove("d-none"));
      } else {
        adminElements.forEach(el => el.classList.add("d-none"));
      }

      userNameDisplays.forEach(el => { el.textContent = user.name; });
      userEmailDisplays.forEach(el => { el.textContent = user.email; });
      userRoleDisplays.forEach(el => { el.textContent = user.role.toUpperCase(); });

      // Pre-fill profile fields
      const pName = document.getElementById("profileName");
      const pEmail = document.getElementById("profileEmail");
      const pRole = document.getElementById("profileRole");
      const pJoined = document.getElementById("profileJoined");
      if (pName) pName.value = user.name || "";
      if (pEmail) pEmail.value = user.email || "";
      if (pRole) pRole.textContent = (user.role || "user").toUpperCase();
      if (pJoined) pJoined.textContent = user.created_at ? new Date(user.created_at).toLocaleDateString() : "Active";
    } else {
      authElements.forEach(el => el.classList.add("d-none"));
      guestElements.forEach(el => el.classList.remove("d-none"));
      adminElements.forEach(el => el.classList.add("d-none"));
    }
  }

  function updateGasStatusUI() {
    const gasUrlInput = document.getElementById("gasUrlInput");
    if (gasUrlInput) {
      gasUrlInput.value = API.getGasUrl();
    }

    const pills = document.querySelectorAll(".gas-status-pill");
    pills.forEach(pill => {
      if (API.isGasConfigured()) {
        pill.className = "badge bg-success-subtle text-success border border-success-subtle gas-status-pill";
        pill.innerHTML = '<i class="fa-solid fa-cloud-check me-1"></i> GAS Backend Live';
      } else {
        pill.className = "badge bg-warning-subtle text-warning border border-warning-subtle gas-status-pill cursor-pointer";
        pill.innerHTML = '<i class="fa-solid fa-microchip me-1"></i> Client Engine (Click to Connect GAS)';
        pill.onclick = () => {
          bootstrap.Modal.getOrCreateInstance(document.getElementById("gasConfigModal")).show();
        };
      }
    });
  }

  function showAuthAlert(elId, msg, type = "danger") {
    const el = document.getElementById(elId);
    if (!el) return;
    el.className = `alert alert-${type} py-2 px-3 small`;
    el.innerHTML = msg;
    el.classList.remove("d-none");
  }

  return {
    init,
    updateNavbarAndViews,
    updateGasStatusUI
  };
})();

window.Auth = Auth;
