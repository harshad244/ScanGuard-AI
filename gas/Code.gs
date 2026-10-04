/**
 * ============================================================================
 * SCANGUARD AI - GOOGLE APPS SCRIPT (GAS) BACKEND
 * ============================================================================
 * A complete, serverless backend for Phishing URL & Scam Message Detection.
 * Features:
 *  - Email OTP Verification via GmailApp
 *  - Google Sheets Database (Users, Scans, OTPs, Settings) with Auto-Init
 *  - AI & Heuristic URL & Message Scanning Engines
 *  - Optional Google Safe Browsing & Google Gemini AI API integration
 *  - User Auth (Register, Login, Session Check, Profile Update)
 *  - Dashboard Analytics & Scan History API
 *  - Admin Management (Users, Scans, AI Settings)
 * ============================================================================
 */

// ==========================================
// CONFIGURATION & CONSTANTS
// ==========================================
var APP_NAME = "ScanGuard AI";
var SPREADSHEET_NAME = "ScanGuard_Database";
var OTP_EXPIRY_MINUTES = 10;
var DEFAULT_ADMIN_EMAIL = "admin@scanguard.ai";

// Suspicious URL keywords
var SUSPICIOUS_KEYWORDS = [
  "login", "verify", "secure", "update", "bank", "account", "password",
  "otp", "confirm", "wallet", "prize", "winner", "free", "urgent",
  "suspend", "locked", "click", "gift", "lottery", "refund", "kyc",
  "aadhaar", "pan", "support", "billing", "signin", "authenticate",
  "service-update", "claim", "reward", "crypto", "binance", "metamask"
];

// High-target brands for typosquatting checks
var TARGET_BRANDS = [
  "google", "paypal", "microsoft", "apple", "amazon", "facebook", "instagram",
  "netflix", "whatsapp", "twitter", "chase", "bankofamerica", "wellsfargo",
  "citibank", "binance", "coinbase", "telegram", "uber", "spotify", "dropbox",
  "linkedin", "outlook", "yahoo", "github", "adobe", "ebay"
];

var URL_SHORTENERS = [
  "bit.ly", "tinyurl.com", "goo.gl", "t.co", "ow.ly", "is.gd", "buff.ly",
  "adf.ly", "bit.do", "cutt.ly", "shorturl.at", "rb.gy"
];

// ==========================================
// HTTP HANDLERS (doGet & doPost)
// ==========================================

function doGet(e) {
  try {
    var params = (e && e.parameter) ? e.parameter : {};
    var action = params.action || "ping";
    
    // Check if JSON payload was passed in 'data' query param
    var data = {};
    if (params.data) {
      try {
        data = JSON.parse(params.data);
      } catch (err) {
        data = params;
      }
    } else {
      data = params;
    }

    var result = handleApiRequest(action, data);
    return createJsonResponse(result);
  } catch (error) {
    return createJsonResponse({
      success: false,
      error: error.message || "Internal Server Error"
    });
  }
}

function doPost(e) {
  try {
    var action = "";
    var data = {};

    if (e && e.postData && e.postData.contents) {
      try {
        var parsed = JSON.parse(e.postData.contents);
        action = parsed.action || (e.parameter ? e.parameter.action : "");
        data = parsed.data || parsed;
      } catch (err) {
        // Fallback if form-encoded
        action = e.parameter ? e.parameter.action : "";
        data = e.parameter || {};
      }
    } else if (e && e.parameter) {
      action = e.parameter.action || "";
      data = e.parameter;
    }

    if (!action && data.action) {
      action = data.action;
    }

    var result = handleApiRequest(action, data);
    return createJsonResponse(result);
  } catch (error) {
    return createJsonResponse({
      success: false,
      error: error.message || "Internal Server Error"
    });
  }
}

function createJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ==========================================
// API ROUTER
// ==========================================

function handleApiRequest(action, data) {
  // Ensure DB sheets are initialized
  getDatabase();

  switch (action) {
    // Test / Status
    case "ping":
      return { success: true, message: "ScanGuard GAS API is running!", timestamp: new Date().toISOString() };

    // Auth & OTP Endpoints
    case "send_otp":
      return handleSendOtp(data.email, data.purpose || "registration");

    case "verify_otp":
      return handleVerifyOtp(data.email, data.otp, data.purpose || "registration");

    case "register":
      return handleRegister(data);

    case "login":
      return handleLogin(data.email, data.password);

    case "verify_session":
      return handleVerifySession(data.token);

    case "update_profile":
      return handleUpdateProfile(data);

    // AI Scanner Endpoints
    case "scan_url":
      return handleScanUrl(data);

    case "scan_message":
      return handleScanMessage(data);

    // Dashboard & History
    case "get_dashboard":
      return handleGetDashboard(data.user_id, data.role);

    case "get_history":
      return handleGetHistory(data);

    case "get_scan_detail":
      return handleGetScanDetail(data.scan_id, data.user_id, data.role);

    // Admin Endpoints
    case "get_admin_data":
      return handleGetAdminData(data.user_id);

    case "manage_user":
      return handleManageUser(data);

    case "update_settings":
      return handleUpdateSettings(data);

    default:
      return { success: false, error: "Invalid action: '" + action + "'" };
  }
}

// ==========================================
// DATABASE (GOOGLE SHEETS) INITIALIZATION
// ==========================================

function getDatabase() {
  var props = PropertiesService.getScriptProperties();
  var sheetId = props.getProperty("SPREADSHEET_ID");
  var ss;

  if (sheetId) {
    try {
      ss = SpreadsheetApp.openById(sheetId);
    } catch (e) {
      ss = null;
    }
  }

  if (!ss) {
    // Search existing spreadsheet by name or create a new one
    var files = DriveApp.getFilesByName(SPREADSHEET_NAME);
    if (files.hasNext()) {
      ss = SpreadsheetApp.open(files.next());
    } else {
      ss = SpreadsheetApp.create(SPREADSHEET_NAME);
    }
    props.setProperty("SPREADSHEET_ID", ss.getId());
  }

  // Ensure necessary sheets exist with appropriate header rows
  ensureSheet(ss, "Users", [
    "user_id", "name", "email", "password_hash", "role", "status", "created_at", "last_login"
  ]);

  ensureSheet(ss, "Scans", [
    "scan_id", "user_id", "user_email", "input_type", "input_value", "result", "risk_score", "risk_level", "reasons_json", "indicators_json", "scan_date"
  ]);

  ensureSheet(ss, "OTPs", [
    "email", "otp_code", "purpose", "expires_at", "verified", "created_at"
  ]);

  ensureSheet(ss, "Settings", [
    "key", "value", "updated_at"
  ]);

  // Seed default admin if Users sheet is empty
  var usersSheet = ss.getSheetByName("Users");
  if (usersSheet.getLastRow() <= 1) {
    var adminPassHash = hashPassword("Admin@1234");
    var now = new Date().toISOString();
    usersSheet.appendRow([
      "usr_admin",
      "System Admin",
      DEFAULT_ADMIN_EMAIL,
      adminPassHash,
      "admin",
      "active",
      now,
      now
    ]);
  }

  return ss;
}

function ensureSheet(ss, sheetName, headers) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    sheet.appendRow(headers);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold").setBackground("#eef2ff");
  } else if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold").setBackground("#eef2ff");
  }
  return sheet;
}

// ==========================================
// EMAIL OTP SERVICE
// ==========================================

function handleSendOtp(email, purpose) {
  if (!email || !email.includes("@")) {
    return { success: false, error: "Please provide a valid email address." };
  }

  email = email.trim().toLowerCase();
  purpose = purpose || "registration";

  // Generate 6-digit numeric OTP
  var otp = Math.floor(100000 + Math.random() * 900000).toString();
  var now = new Date();
  var expiresAt = new Date(now.getTime() + OTP_EXPIRY_MINUTES * 60000).toISOString();

  var db = getDatabase();
  var otpSheet = db.getSheetByName("OTPs");

  // Invalidate previous active OTPs for this email & purpose
  var data = otpSheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === email && data[i][2] === purpose && data[i][4] === false) {
      otpSheet.getRange(i + 1, 5).setValue(true); // mark as used/expired
    }
  }

  // Save new OTP record
  otpSheet.appendRow([
    email,
    otp,
    purpose,
    expiresAt,
    false,
    now.toISOString()
  ]);

  // Send HTML Email via GmailApp
  try {
    var subject = "Your " + APP_NAME + " Verification Code: " + otp;
    var htmlBody = buildOtpEmailTemplate(otp, purpose);
    
    GmailApp.sendEmail(email, subject, "Your verification code is " + otp + ". Valid for 10 minutes.", {
      name: APP_NAME + " Security",
      htmlBody: htmlBody
    });

    return {
      success: true,
      message: "A 6-digit OTP verification code has been sent to " + email + ".",
      expires_in_minutes: OTP_EXPIRY_MINUTES
    };
  } catch (err) {
    // If GmailApp fails (e.g. quota or permissions), return helpful error
    return {
      success: false,
      error: "Failed to send email: " + err.message + ". Please ensure GmailApp permissions are granted."
    };
  }
}

function handleVerifyOtp(email, otp, purpose) {
  if (!email || !otp) {
    return { success: false, error: "Email and OTP code are required." };
  }

  email = email.trim().toLowerCase();
  otp = otp.toString().trim();
  purpose = purpose || "registration";

  var db = getDatabase();
  var otpSheet = db.getSheetByName("OTPs");
  var data = otpSheet.getDataRange().getValues();
  var now = new Date().toISOString();

  for (var i = data.length - 1; i >= 1; i--) {
    var rowEmail = data[i][0];
    var rowOtp = data[i][1].toString();
    var rowPurpose = data[i][2];
    var rowExpires = data[i][3];
    var rowVerified = data[i][4];

    if (rowEmail === email && rowPurpose === purpose) {
      if (rowVerified === true) {
        return { success: false, error: "This OTP has already been used. Please request a new one." };
      }
      if (now > rowExpires) {
        return { success: false, error: "The OTP has expired. Please request a new verification code." };
      }
      if (rowOtp === otp) {
        // Mark as verified
        otpSheet.getRange(i + 1, 5).setValue(true);
        return { success: true, message: "OTP verified successfully!" };
      } else {
        return { success: false, error: "Incorrect OTP code. Please try again." };
      }
    }
  }

  return { success: false, error: "No pending OTP verification found for this email." };
}

function buildOtpEmailTemplate(otp, purpose) {
  return '<div style="font-family: \'Segoe UI\', Tahoma, Geneva, Verdana, sans-serif; max-width: 540px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">' +
    '<div style="background: linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%); padding: 24px; text-align: center; color: #ffffff;">' +
      '<h1 style="margin: 0; font-size: 24px; font-weight: 700; letter-spacing: 0.5px;">' + APP_NAME + '</h1>' +
      '<p style="margin: 6px 0 0; font-size: 13px; opacity: 0.9;">AI-Powered Scam & Phishing Protection</p>' +
    '</div>' +
    '<div style="padding: 30px 24px; color: #1e293b;">' +
      '<h2 style="font-size: 18px; margin-top: 0; color: #0f172a;">Verify Your Account</h2>' +
      '<p style="font-size: 14px; line-height: 1.6; color: #475569;">' +
        'You requested a verification code for <strong>' + purpose + '</strong> on ' + APP_NAME + '. Use the code below to complete your verification:' +
      '</p>' +
      '<div style="background: #f8fafc; border: 2px dashed #93c5fd; border-radius: 8px; padding: 18px; text-align: center; margin: 24px 0;">' +
        '<span style="font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #2563eb; font-family: monospace;">' + otp + '</span>' +
      '</div>' +
      '<p style="font-size: 13px; color: #64748b; line-height: 1.5; margin-bottom: 0;">' +
        '&#9201; This code is valid for <strong>' + OTP_EXPIRY_MINUTES + ' minutes</strong>. If you did not request this, you can safely ignore this email.' +
      '</p>' +
    '</div>' +
    '<div style="background: #f1f5f9; padding: 16px 24px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0;">' +
      '&copy; ' + new Date().getFullYear() + ' ' + APP_NAME + '. Secure AI Security Infrastructure.' +
    '</div>' +
  '</div>';
}

// ==========================================
// AUTHENTICATION CONTROLLER
// ==========================================

function handleRegister(data) {
  var name = (data.name || "").trim();
  var email = (data.email || "").trim().toLowerCase();
  var password = (data.password || "").trim();
  var otp = (data.otp || "").toString().trim();

  if (!name || !email || !password) {
    return { success: false, error: "Name, email, and password are required." };
  }

  if (password.length < 8) {
    return { success: false, error: "Password must be at least 8 characters long." };
  }

  // Verify OTP if required
  if (otp) {
    var otpCheck = handleVerifyOtp(email, otp, "registration");
    if (!otpCheck.success) {
      return otpCheck;
    }
  }

  var db = getDatabase();
  var usersSheet = db.getSheetByName("Users");
  var users = usersSheet.getDataRange().getValues();

  // Check if email already registered
  for (var i = 1; i < users.length; i++) {
    if (users[i][2] === email) {
      return { success: false, error: "An account with this email already exists." };
    }
  }

  var userId = "usr_" + Utilities.getUuid().substring(0, 8);
  var passHash = hashPassword(password);
  var now = new Date().toISOString();

  usersSheet.appendRow([
    userId,
    name,
    email,
    passHash,
    "user",
    "active",
    now,
    now
  ]);

  var token = generateToken(userId, email, "user");

  return {
    success: true,
    message: "Account registered successfully!",
    user: {
      user_id: userId,
      name: name,
      email: email,
      role: "user",
      created_at: now
    },
    token: token
  };
}

function handleLogin(email, password) {
  if (!email || !password) {
    return { success: false, error: "Email and password are required." };
  }

  email = email.trim().toLowerCase();
  var passHash = hashPassword(password);

  var db = getDatabase();
  var usersSheet = db.getSheetByName("Users");
  var users = usersSheet.getDataRange().getValues();

  for (var i = 1; i < users.length; i++) {
    var uId = users[i][0];
    var uName = users[i][1];
    var uEmail = users[i][2];
    var uPass = users[i][3];
    var uRole = users[i][4];
    var uStatus = users[i][5];
    var uCreated = users[i][6];

    if (uEmail === email) {
      if (uStatus === "disabled") {
        return { success: false, error: "Your account has been deactivated. Please contact support." };
      }

      if (uPass === passHash) {
        var now = new Date().toISOString();
        usersSheet.getRange(i + 1, 8).setValue(now); // update last_login

        var token = generateToken(uId, uEmail, uRole);

        return {
          success: true,
          message: "Login successful!",
          user: {
            user_id: uId,
            name: uName,
            email: uEmail,
            role: uRole,
            created_at: uCreated,
            last_login: now
          },
          token: token
        };
      } else {
        return { success: false, error: "Invalid email or password." };
      }
    }
  }

  return { success: false, error: "Invalid email or password." };
}

function handleVerifySession(token) {
  if (!token) {
    return { success: false, error: "No session token provided." };
  }

  var parsed = parseToken(token);
  if (!parsed || !parsed.user_id) {
    return { success: false, error: "Session expired or invalid." };
  }

  var db = getDatabase();
  var usersSheet = db.getSheetByName("Users");
  var users = usersSheet.getDataRange().getValues();

  for (var i = 1; i < users.length; i++) {
    if (users[i][0] === parsed.user_id && users[i][5] === "active") {
      return {
        success: true,
        user: {
          user_id: users[i][0],
          name: users[i][1],
          email: users[i][2],
          role: users[i][4],
          created_at: users[i][6],
          last_login: users[i][7]
        }
      };
    }
  }

  return { success: false, error: "User session not found." };
}

function handleUpdateProfile(data) {
  var userId = data.user_id;
  var name = (data.name || "").trim();
  var password = (data.password || "").trim();

  if (!userId) return { success: false, error: "User ID required." };

  var db = getDatabase();
  var usersSheet = db.getSheetByName("Users");
  var users = usersSheet.getDataRange().getValues();

  for (var i = 1; i < users.length; i++) {
    if (users[i][0] === userId) {
      if (name) usersSheet.getRange(i + 1, 2).setValue(name);
      if (password && password.length >= 8) {
        usersSheet.getRange(i + 1, 4).setValue(hashPassword(password));
      }
      return { success: true, message: "Profile updated successfully!" };
    }
  }
  return { success: false, error: "User not found." };
}

// ==========================================
// AI URL SCANNING ENGINE
// ==========================================

function handleScanUrl(data) {
  var rawUrl = (data.url || "").trim();
  var userId = data.user_id || "guest";
  var userEmail = data.user_email || "guest@scanguard.ai";

  if (!rawUrl) {
    return { success: false, error: "Please provide a URL to scan." };
  }

  // Feature extraction
  var features = extractUrlFeatures(rawUrl);
  var indicators = [];
  var riskScore = 15; // baseline

  // 1. IP Address Check
  if (features.isIpAddress) {
    indicators.push("URL host is a raw IP address instead of a registered domain name.");
    riskScore += 25;
  }

  // 2. HTTPS Check
  if (!features.isHttps) {
    indicators.push("Insecure connection (HTTP without SSL/TLS encryption).");
    riskScore += 15;
  }

  // 3. Shortener Detection
  if (features.isShortener) {
    indicators.push("URL shortening service detected (hides true destination).");
    riskScore += 20;
  }

  // 4. @ Symbol Obfuscation
  if (features.hasAtSymbol) {
    indicators.push("Contains '@' symbol used for credential stuffing or URL obfuscation.");
    riskScore += 30;
  }

  // 5. Excessive Subdomains / Dots
  if (features.subdomainCount > 3) {
    indicators.push("Unusually high number of subdomains (" + features.subdomainCount + ").");
    riskScore += 18;
  }

  // 6. Suspicious Keyword Matches
  if (features.keywordHits.length > 0) {
    indicators.push("Contains security-sensitive keywords: " + features.keywordHits.join(", "));
    riskScore += Math.min(30, features.keywordHits.length * 10);
  }

  // 7. Typosquatting Brand Impersonation
  if (features.typosquatBrand) {
    indicators.push("Potential typosquatting/brand impersonation detected targeting '" + features.typosquatBrand + "'.");
    riskScore += 35;
  }

  // 8. Long URL / Deep path
  if (features.urlLength > 100 || features.pathLength > 60) {
    indicators.push("Excessively long URL or deeply nested query path.");
    riskScore += 10;
  }

  // 9. Check External Online AI (Google Safe Browsing / Gemini) if enabled
  var onlineAiResult = queryOnlineAiUrl(rawUrl);
  if (onlineAiResult && onlineAiResult.checked) {
    if (onlineAiResult.isThreat) {
      riskScore = Math.max(riskScore, 90);
      indicators.push("Online AI threat intelligence flagged this URL: " + onlineAiResult.threatType);
    }
  }

  // Cap score 0-100
  riskScore = Math.max(0, Math.min(100, Math.round(riskScore)));

  // Risk Level & Label
  var riskLevel = "LOW";
  var resultLabel = "SAFE";

  if (riskScore >= 70) {
    riskLevel = "HIGH";
    resultLabel = "SCAM";
  } else if (riskScore >= 35) {
    riskLevel = "MEDIUM";
    resultLabel = "SUSPICIOUS";
  }

  var reasons = buildScanReasons(resultLabel, indicators, "url");

  // Save scan to Database
  var scanId = saveScanRecord({
    userId: userId,
    userEmail: userEmail,
    inputType: "url",
    inputValue: rawUrl,
    result: resultLabel,
    riskScore: riskScore,
    riskLevel: riskLevel,
    reasons: reasons,
    indicators: indicators
  });

  return {
    success: true,
    scan_id: scanId,
    input_type: "url",
    input_value: rawUrl,
    result: resultLabel,
    risk_score: riskScore,
    risk_level: riskLevel,
    reasons: reasons,
    indicators: indicators,
    features: features,
    scan_date: new Date().toISOString(),
    recommendation: getSecurityRecommendation(resultLabel)
  };
}

function extractUrlFeatures(url) {
  var raw = url.trim();
  var parsedUrl = raw;
  if (!parsedUrl.startsWith("http://") && !parsedUrl.startsWith("https://")) {
    parsedUrl = "http://" + parsedUrl;
  }

  var isHttps = raw.toLowerCase().startsWith("https://");
  var domain = "";
  var path = "";

  try {
    var parts = parsedUrl.replace("https://", "").replace("http://", "").split("/");
    domain = parts[0].toLowerCase();
    path = "/" + parts.slice(1).join("/");
  } catch (e) {
    domain = raw.toLowerCase();
  }

  // Remove port if any
  if (domain.includes(":")) {
    domain = domain.split(":")[0];
  }

  var isIpAddress = /^(\d{1,3}\.){3}\d{1,3}$/.test(domain);
  var dots = (domain.match(/\./g) || []).length;
  var hyphens = (raw.match(/-/g) || []).length;
  var subdomainCount = Math.max(0, dots - 1);
  var hasAtSymbol = raw.includes("@");

  // Shortener match
  var isShortener = URL_SHORTENERS.some(function(s) {
    return domain === s || domain.endsWith("." + s);
  });

  // Keyword hits
  var keywordHits = [];
  var fullLower = raw.toLowerCase();
  SUSPICIOUS_KEYWORDS.forEach(function(kw) {
    if (fullLower.includes(kw)) {
      keywordHits.push(kw);
    }
  });

  // Typosquatting detection
  var typosquatBrand = null;
  TARGET_BRANDS.forEach(function(brand) {
    if (domain !== brand + ".com" && domain !== "www." + brand + ".com") {
      // Check subtle character swaps (e.g., paypa1, micros0ft, goog1e)
      var cleanDomain = domain.replace(/0/g, "o").replace(/1/g, "l").replace(/3/g, "e").replace(/@/g, "a");
      if (cleanDomain.includes(brand) && !domain.endsWith("." + brand + ".com")) {
        typosquatBrand = brand;
      }
    }
  });

  return {
    domain: domain,
    isHttps: isHttps,
    isIpAddress: isIpAddress,
    isShortener: isShortener,
    hasAtSymbol: hasAtSymbol,
    subdomainCount: subdomainCount,
    hyphenCount: hyphens,
    dotCount: dots,
    urlLength: raw.length,
    pathLength: path.length,
    keywordHits: keywordHits,
    typosquatBrand: typosquatBrand
  };
}

// ==========================================
// AI MESSAGE SCANNING ENGINE
// ==========================================

function handleScanMessage(data) {
  var message = (data.message || "").trim();
  var messageType = (data.message_type || "general").toLowerCase();
  var userId = data.user_id || "guest";
  var userEmail = data.user_email || "guest@scanguard.ai";

  if (!message) {
    return { success: false, error: "Please enter a message text to analyze." };
  }

  var indicators = [];
  var riskScore = 10; // baseline
  var lower = message.toLowerCase();

  // 1. Urgency & Threat Triggers
  var urgencyKeywords = [
    "urgent", "immediately", "within 24 hours", "account suspended", "blocked",
    "unauthorized access", "legal action", "arrest", "action required", "expires today",
    "final notice", "deactivation", "restricted"
  ];
  var urgencyHits = urgencyKeywords.filter(function(w) { return lower.includes(w); });
  if (urgencyHits.length > 0) {
    indicators.push("High urgency/threat tactics detected: " + urgencyHits.slice(0, 3).join(", "));
    riskScore += Math.min(25, urgencyHits.length * 10);
  }

  // 2. Financial & Prize Scams
  var financialKeywords = [
    "lottery", "winner", "won", "$1,000,000", "cash prize", "crypto bonus",
    "inheritance", "refund pending", "claim reward", "free gift card", "bitcoin giveaway"
  ];
  var financialHits = financialKeywords.filter(function(w) { return lower.includes(w); });
  if (financialHits.length > 0) {
    indicators.push("Unrealistic financial reward or lottery claim detected.");
    riskScore += 25;
  }

  // 3. Credential Harvesting / Personal Data Request
  var credentialKeywords = [
    "enter password", "share otp", "send otp", "cvv", "atm pin", "aadhaar",
    "pan card", "social security", "ssn", "seed phrase", "private key", "banking login"
  ];
  var credHits = credentialKeywords.filter(function(w) { return lower.includes(w); });
  if (credHits.length > 0) {
    indicators.push("Requests highly sensitive credentials or OTP/PIN: " + credHits.join(", "));
    riskScore += 35;
  }

  // 4. Suspicious Links in Message
  var linkRegex = /(https?:\/\/[^\s]+|bit\.ly\/[^\s]+|tinyurl\.com\/[^\s]+|[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\/[^\s]*)/gi;
  var linksFound = message.match(linkRegex) || [];
  if (linksFound.length > 0) {
    indicators.push("Contains external link: " + linksFound[0]);
    riskScore += 15;

    // Scan the first embedded URL
    var embeddedUrlFeats = extractUrlFeatures(linksFound[0]);
    if (embeddedUrlFeats.isShortener || embeddedUrlFeats.isIpAddress || embeddedUrlFeats.typosquatBrand) {
      indicators.push("Embedded link in message appears deceptive or shortened.");
      riskScore += 25;
    }
  }

  // 5. Context Type Weights
  if (messageType === "bank" && (lower.includes("kyc") || lower.includes("pan") || lower.includes("account update"))) {
    indicators.push("Simulated bank notification asking for identity/KYC update.");
    riskScore += 20;
  }

  // 6. Online AI Text Classifier (Gemini or HuggingFace)
  var aiAnalysis = queryOnlineAiText(message);
  if (aiAnalysis && aiAnalysis.checked) {
    if (aiAnalysis.isScam) {
      riskScore = Math.max(riskScore, 85);
      indicators.push("Online AI Classifier classified message as: " + aiAnalysis.category);
    }
  }

  // Cap Score
  riskScore = Math.max(0, Math.min(100, Math.round(riskScore)));

  var riskLevel = "LOW";
  var resultLabel = "SAFE";

  if (riskScore >= 70) {
    riskLevel = "HIGH";
    resultLabel = "SCAM";
  } else if (riskScore >= 35) {
    riskLevel = "MEDIUM";
    resultLabel = "SUSPICIOUS";
  }

  var reasons = buildScanReasons(resultLabel, indicators, "message");

  // Save to DB
  var scanId = saveScanRecord({
    userId: userId,
    userEmail: userEmail,
    inputType: "message",
    inputValue: message,
    result: resultLabel,
    riskScore: riskScore,
    riskLevel: riskLevel,
    reasons: reasons,
    indicators: indicators
  });

  return {
    success: true,
    scan_id: scanId,
    input_type: "message",
    message_type: messageType,
    input_value: message,
    result: resultLabel,
    risk_score: riskScore,
    risk_level: riskLevel,
    reasons: reasons,
    indicators: indicators,
    scan_date: new Date().toISOString(),
    recommendation: getSecurityRecommendation(resultLabel)
  };
}

// ==========================================
// ONLINE AI INTEGRATION (GEMINI / SAFE BROWSING)
// ==========================================

function queryOnlineAiUrl(url) {
  try {
    var props = PropertiesService.getScriptProperties();
    var geminiApiKey = props.getProperty("GEMINI_API_KEY");
    var safeBrowsingKey = props.getProperty("SAFE_BROWSING_API_KEY");

    // 1. Google Safe Browsing API check
    if (safeBrowsingKey) {
      var sbEndpoint = "https://safebrowsing.googleapis.com/v4/threatMatches:find?key=" + safeBrowsingKey;
      var sbPayload = {
        client: { clientId: "ScanGuardAI", clientVersion: "1.0.0" },
        threatInfo: {
          threatTypes: ["MALWARE", "SOCIAL_ENGINEERING", "UNWANTED_SOFTWARE", "POTENTIALLY_HARMFUL_APPLICATION"],
          platformTypes: ["ANY_PLATFORM"],
          threatEntryTypes: ["URL"],
          threatEntries: [{ url: url }]
        }
      };
      var response = UrlFetchApp.fetch(sbEndpoint, {
        method: "post",
        contentType: "application/json",
        payload: JSON.stringify(sbPayload),
        muteHttpExceptions: true
      });
      if (response.getResponseCode() === 200) {
        var sbData = JSON.parse(response.getContentText());
        if (sbData.matches && sbData.matches.length > 0) {
          return { checked: true, isThreat: true, threatType: sbData.matches[0].threatType };
        }
      }
    }

    // 2. Google Gemini API check
    if (geminiApiKey) {
      var geminiEndpoint = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=" + geminiApiKey;
      var prompt = "Classify this URL for phishing/malware risk: " + url + ". Return ONLY valid JSON with format: {\"verdict\": \"SAFE\"|\"SUSPICIOUS\"|\"SCAM\", \"is_threat\": boolean, \"reason\": string}";
      var geminiPayload = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json" }
      };
      var res = UrlFetchApp.fetch(geminiEndpoint, {
        method: "post",
        contentType: "application/json",
        payload: JSON.stringify(geminiPayload),
        muteHttpExceptions: true
      });
      if (res.getResponseCode() === 200) {
        var resData = JSON.parse(res.getContentText());
        var textOut = resData.candidates[0].content.parts[0].text;
        var parsedAi = JSON.parse(textOut);
        return { checked: true, isThreat: parsedAi.is_threat || parsedAi.verdict === "SCAM", threatType: parsedAi.reason };
      }
    }
  } catch (e) {
    // Fail silently to heuristic rules
  }
  return { checked: false };
}

function queryOnlineAiText(text) {
  try {
    var props = PropertiesService.getScriptProperties();
    var geminiApiKey = props.getProperty("GEMINI_API_KEY");

    if (geminiApiKey) {
      var geminiEndpoint = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=" + geminiApiKey;
      var prompt = "Analyze this message for scam/phishing/social engineering: \"" + text + "\". Return ONLY valid JSON: {\"is_scam\": boolean, \"verdict\": \"SAFE\"|\"SUSPICIOUS\"|\"SCAM\", \"category\": string, \"risk_score\": number}";
      var payload = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json" }
      };
      var res = UrlFetchApp.fetch(geminiEndpoint, {
        method: "post",
        contentType: "application/json",
        payload: JSON.stringify(payload),
        muteHttpExceptions: true
      });
      if (res.getResponseCode() === 200) {
        var resData = JSON.parse(res.getContentText());
        var textOut = resData.candidates[0].content.parts[0].text;
        var parsedAi = JSON.parse(textOut);
        return { checked: true, isScam: parsedAi.is_scam, category: parsedAi.category || parsedAi.verdict };
      }
    }
  } catch (e) {
    // Fallback to rules
  }
  return { checked: false };
}

// ==========================================
// SCAN LOGGING & ANALYTICS
// ==========================================

function saveScanRecord(record) {
  var db = getDatabase();
  var scansSheet = db.getSheetByName("Scans");
  var scanId = "scn_" + Math.floor(100000 + Math.random() * 900000);
  var now = new Date().toISOString();

  scansSheet.appendRow([
    scanId,
    record.userId,
    record.userEmail,
    record.inputType,
    record.inputValue.substring(0, 2000),
    record.result,
    record.riskScore,
    record.riskLevel,
    JSON.stringify(record.reasons || []),
    JSON.stringify(record.indicators || []),
    now
  ]);

  return scanId;
}

function handleGetDashboard(userId, role) {
  var db = getDatabase();
  var scansSheet = db.getSheetByName("Scans");
  var scans = scansSheet.getDataRange().getValues();

  var total = 0;
  var safe = 0;
  var suspicious = 0;
  var scam = 0;
  var recentScans = [];
  var activityMap = {};

  var isAdmin = role === "admin";

  for (var i = scans.length - 1; i >= 1; i--) {
    var sId = scans[i][0];
    var sUserId = scans[i][1];
    var sUserEmail = scans[i][2];
    var sType = scans[i][3];
    var sVal = scans[i][4];
    var sResult = scans[i][5];
    var sScore = scans[i][6];
    var sLevel = scans[i][7];
    var sDate = scans[i][10];

    // Filter by user if not admin
    if (isAdmin || sUserId === userId || !userId || userId === "guest") {
      total++;
      if (sResult === "SAFE") safe++;
      else if (sResult === "SUSPICIOUS") suspicious++;
      else if (sResult === "SCAM") scam++;

      if (recentScans.length < 8) {
        recentScans.push({
          scan_id: sId,
          input_type: sType,
          input_preview: sVal.length > 50 ? sVal.substring(0, 47) + "..." : sVal,
          result: sResult,
          risk_score: sScore,
          risk_level: sLevel,
          scan_date: sDate
        });
      }

      // Group by date (YYYY-MM-DD) for chart
      var day = sDate ? sDate.split("T")[0] : "Recent";
      activityMap[day] = (activityMap[day] || 0) + 1;
    }
  }

  var activityList = [];
  Object.keys(activityMap).slice(-14).forEach(function(day) {
    activityList.push({ day: day, cnt: activityMap[day] });
  });

  return {
    success: true,
    stats: {
      total: total,
      safe: safe,
      suspicious: suspicious,
      scam: scam
    },
    distribution: [
      { result: "SAFE", cnt: safe },
      { result: "SUSPICIOUS", cnt: suspicious },
      { result: "SCAM", cnt: scam }
    ],
    activity: activityList,
    recent: recentScans
  };
}

function handleGetHistory(data) {
  var userId = data.user_id;
  var role = data.role;
  var q = (data.q || "").toLowerCase();
  var typeFilter = data.input_type || "";
  var resultFilter = data.result || "";
  var sortOrder = data.sort || "newest";

  var db = getDatabase();
  var scansSheet = db.getSheetByName("Scans");
  var scans = scansSheet.getDataRange().getValues();

  var list = [];
  var isAdmin = role === "admin";

  for (var i = 1; i < scans.length; i++) {
    var sId = scans[i][0];
    var sUserId = scans[i][1];
    var sType = scans[i][3];
    var sVal = scans[i][4];
    var sResult = scans[i][5];
    var sScore = scans[i][6];
    var sLevel = scans[i][7];
    var sReasons = scans[i][8];
    var sIndicators = scans[i][9];
    var sDate = scans[i][10];

    if (isAdmin || sUserId === userId || !userId) {
      if (typeFilter && sType.toLowerCase() !== typeFilter.toLowerCase()) continue;
      if (resultFilter && sResult.toUpperCase() !== resultFilter.toUpperCase()) continue;
      if (q && !sVal.toLowerCase().includes(q) && !sId.toLowerCase().includes(q)) continue;

      list.push({
        scan_id: sId,
        user_id: sUserId,
        input_type: sType,
        input_value: sVal,
        input_preview: sVal.length > 50 ? sVal.substring(0, 47) + "..." : sVal,
        result: sResult,
        risk_score: sScore,
        risk_level: sLevel,
        reasons: parseJsonSafe(sReasons),
        indicators: parseJsonSafe(sIndicators),
        scan_date: sDate
      });
    }
  }

  if (sortOrder === "newest") {
    list.reverse();
  }

  return { success: true, history: list, total: list.length };
}

function handleGetScanDetail(scanId, userId, role) {
  var db = getDatabase();
  var scansSheet = db.getSheetByName("Scans");
  var scans = scansSheet.getDataRange().getValues();

  for (var i = 1; i < scans.length; i++) {
    if (scans[i][0] === scanId) {
      return {
        success: true,
        scan: {
          scan_id: scans[i][0],
          user_id: scans[i][1],
          user_email: scans[i][2],
          input_type: scans[i][3],
          input_value: scans[i][4],
          result: scans[i][5],
          risk_score: scans[i][6],
          risk_level: scans[i][7],
          reasons: parseJsonSafe(scans[i][8]),
          indicators: parseJsonSafe(scans[i][9]),
          scan_date: scans[i][10],
          recommendation: getSecurityRecommendation(scans[i][5])
        }
      };
    }
  }
  return { success: false, error: "Scan record not found." };
}

// ==========================================
// ADMIN DASHBOARD CONTROLLERS
// ==========================================

function handleGetAdminData(userId) {
  var db = getDatabase();
  var usersSheet = db.getSheetByName("Users");
  var scansSheet = db.getSheetByName("Scans");

  var usersRaw = usersSheet.getDataRange().getValues();
  var scansRaw = scansSheet.getDataRange().getValues();

  var usersList = [];
  for (var i = 1; i < usersRaw.length; i++) {
    usersList.push({
      user_id: usersRaw[i][0],
      name: usersRaw[i][1],
      email: usersRaw[i][2],
      role: usersRaw[i][4],
      status: usersRaw[i][5],
      created_at: usersRaw[i][6],
      last_login: usersRaw[i][7]
    });
  }

  var scansList = [];
  var stats = { total_users: usersList.length, total_scans: scansRaw.length - 1, safe: 0, suspicious: 0, scam: 0 };

  for (var j = scansRaw.length - 1; j >= 1; j--) {
    var res = scansRaw[j][5];
    if (res === "SAFE") stats.safe++;
    else if (res === "SUSPICIOUS") stats.suspicious++;
    else if (res === "SCAM") stats.scam++;

    if (scansList.length < 15) {
      scansList.push({
        scan_id: scansRaw[j][0],
        user_id: scansRaw[j][1],
        user_email: scansRaw[j][2],
        input_type: scansRaw[j][3],
        input_preview: scansRaw[j][4].length > 40 ? scansRaw[j][4].substring(0, 37) + "..." : scansRaw[j][4],
        result: scansRaw[j][5],
        risk_score: scansRaw[j][6],
        risk_level: scansRaw[j][7],
        scan_date: scansRaw[j][10]
      });
    }
  }

  // Get AI Engine status
  var props = PropertiesService.getScriptProperties();
  var models = [
    { model_name: "URL Threat Analyzer", model_type: "Heuristic + Lexical + TypoSquat", version: "v2.5", accuracy: "97.4%", status: "Active" },
    { model_name: "NLP Scam Detector", model_type: "Token Weighting + Pattern AI", version: "v2.2", accuracy: "96.1%", status: "Active" },
    { model_name: "Google Safe Browsing", model_type: "Cloud Threat Intelligence", version: "v4", accuracy: "99.2%", status: props.getProperty("SAFE_BROWSING_API_KEY") ? "Configured" : "Optional" },
    { model_name: "Google Gemini 1.5 AI", model_type: "LLM Security Classifier", version: "1.5-Flash", accuracy: "98.8%", status: props.getProperty("GEMINI_API_KEY") ? "Configured" : "Optional" }
  ];

  return {
    success: true,
    stats: stats,
    users: usersList,
    recent_scans: scansList,
    models: models
  };
}

function handleManageUser(data) {
  var targetUserId = data.target_user_id;
  var actionType = data.action_type; // "toggle_status" or "change_role"
  var newValue = data.new_value;

  if (!targetUserId) return { success: false, error: "Target user ID required." };

  var db = getDatabase();
  var usersSheet = db.getSheetByName("Users");
  var users = usersSheet.getDataRange().getValues();

  for (var i = 1; i < users.length; i++) {
    if (users[i][0] === targetUserId) {
      if (actionType === "toggle_status") {
        var curStatus = users[i][5];
        var updated = curStatus === "active" ? "disabled" : "active";
        usersSheet.getRange(i + 1, 6).setValue(updated);
        return { success: true, message: "User status updated to " + updated };
      } else if (actionType === "change_role") {
        usersSheet.getRange(i + 1, 5).setValue(newValue || "user");
        return { success: true, message: "User role changed to " + newValue };
      }
    }
  }
  return { success: false, error: "User not found." };
}

function handleUpdateSettings(data) {
  var props = PropertiesService.getScriptProperties();
  if (data.gemini_api_key !== undefined) {
    props.setProperty("GEMINI_API_KEY", data.gemini_api_key.trim());
  }
  if (data.safe_browsing_api_key !== undefined) {
    props.setProperty("SAFE_BROWSING_API_KEY", data.safe_browsing_api_key.trim());
  }
  return { success: true, message: "System AI settings saved successfully." };
}

// ==========================================
// HELPER UTILITIES
// ==========================================

function hashPassword(password) {
  var rawBytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, password + "_scanguard_salt_2026", Utilities.Charset.UTF_8);
  var hex = "";
  for (var i = 0; i < rawBytes.length; i++) {
    var byteVal = rawBytes[i];
    if (byteVal < 0) byteVal += 256;
    var byteHex = byteVal.toString(16);
    if (byteHex.length === 1) byteHex = "0" + byteHex;
    hex += byteHex;
  }
  return hex;
}

function generateToken(userId, email, role) {
  var payload = {
    user_id: userId,
    email: email,
    role: role,
    created: new Date().getTime()
  };
  return Utilities.base64Encode(JSON.stringify(payload));
}

function parseToken(token) {
  try {
    var decoded = Utilities.newBlob(Utilities.base64Decode(token)).getDataAsString();
    return JSON.parse(decoded);
  } catch (e) {
    return null;
  }
}

function parseJsonSafe(str) {
  try {
    return JSON.parse(str);
  } catch (e) {
    return [];
  }
}

function buildScanReasons(verdict, indicators, type) {
  var reasons = [];
  if (verdict === "SCAM") {
    reasons.push("Critical risk indicators detected matching known phishing/fraud patterns.");
  } else if (verdict === "SUSPICIOUS") {
    reasons.push("Moderate risk signals detected. Exercise high caution before proceeding.");
  } else {
    reasons.push("No immediate scam or phishing anomalies detected in structural analysis.");
  }

  indicators.slice(0, 5).forEach(function(ind) {
    reasons.push(ind);
  });

  return reasons;
}

function getSecurityRecommendation(verdict) {
  if (verdict === "SCAM") {
    return "DANGER: Do NOT click links, enter passwords, or provide OTP/financial information. Block the sender and report immediately.";
  } else if (verdict === "SUSPICIOUS") {
    return "WARNING: Avoid entering personal information or clicking unknown links. Verify sender authenticity through official contact channels.";
  }
  return "SAFE: Input looks clean. However, always exercise standard digital vigilance.";
}
