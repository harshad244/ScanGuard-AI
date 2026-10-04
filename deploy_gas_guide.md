# 🚀 Google Apps Script (GAS) Backend Deployment Guide

This guide walks you through deploying the **ScanGuard AI** backend on Google Apps Script so your HTML/CSS/JS frontend can send real **Email OTPs via Gmail**, store users & scans in **Google Sheets**, and run **AI Threat Intelligence**.

---

## 📋 Step 1: Create a Google Apps Script Project

1. Go to [script.google.com](https://script.google.com/) and sign in with your Google account.
2. Click on **"+ New project"** in the top left.
3. Name the project **"ScanGuard AI Backend"** (top left title).

---

## 📝 Step 2: Paste the Backend Code

1. In the Apps Script editor, open the file `Code.gs`.
2. Delete any default code inside `Code.gs`.
3. Open the file [`gas/Code.gs`](file:///c:/Users/Harshad%20Teli/Videos/ScanGuard/gas/Code.gs) in your VS Code workspace.
4. Copy all of its content and paste it into `Code.gs` on Google Apps Script.
5. Press `Ctrl + S` (or click the disk icon) to save.

---

## 🌐 Step 3: Deploy as a Web App

1. Click the blue **"Deploy"** button at the top right.
2. Select **"New deployment"**.
3. In the modal that opens, click the gear icon (⚙️) next to *Select type* and choose **"Web app"**.
4. Configure the settings exactly as follows:
   - **Description**: `ScanGuard AI Production v1.0`
   - **Execute as**: `Me (your_email@gmail.com)` *(Ensures permissions to send OTP emails and access the Google Sheets database)*
   - **Who has access**: `Anyone` *(Crucial: allows your HTML/JS frontend in VS Code / browser to connect via API)*
5. Click **"Deploy"**.

---

## 🔑 Step 4: Authorize Google Permissions

1. Google will display an **"Authorize access"** dialog.
2. Choose your Google account.
3. Click **"Advanced"** (in small text) ➔ Click **"Go to ScanGuard AI Backend (unsafe)"**.
4. Click **"Allow"** to grant permissions:
   - *Send email on your behalf (for 6-digit OTP verification)*
   - *Create & edit Google Sheets (for cloud user database & scan history)*
   - *Connect to external services (for AI scanning)*

---

## 🔗 Step 5: Copy Web App URL & Configure `js/api.js`

1. Once deployed, copy the **Web App URL** (it looks like: `https://script.google.com/macros/s/AKfycb.../exec`).
2. Open [`js/api.js`](file:///c:/Users/Harshad%20Teli/Videos/ScanGuard/js/api.js) in your VS Code workspace.
3. Replace the `DEFAULT_GAS_URL` on line 14 with your copied URL:
   ```javascript
   const DEFAULT_GAS_URL = "https://script.google.com/macros/s/AKfycb.../exec";
   ```
4. Save `js/api.js`.

> **Alternatively:** You can open `index.html` in your browser, click on the **"GAS Endpoint"** status badge in the navbar, and paste your URL directly into the popup modal!

---

## 🤖 Step 6: (Optional) Add Free Google Gemini AI Key for Message Analysis

To enable generative AI LLM analysis for scam messages:
1. In Google Apps Script, go to **Project Settings (⚙️)** on the left sidebar.
2. Scroll to **Script Properties** ➔ Click **Add script property**.
3. Set Property Name: `GEMINI_API_KEY`
4. Set Value: Your free Gemini API key from [Google AI Studio](https://aistudio.google.com/).
5. Click **Save script properties**.

---

## 🧪 Step 7: Test the Application

1. In VS Code, open `index.html`.
2. Right-click and choose **"Open with Live Server"** (or double-click `index.html` to open directly in Google Chrome / Edge).
3. Test the following modules:
   - **Register with Email OTP**: Enter your real Gmail address ➔ Click **"Send OTP"** ➔ Check your Gmail inbox for the 6-digit code ➔ Enter code & Register!
   - **Phishing URL Scanner**: Try typing a legitimate URL (`https://www.google.com`) and a scam link (`http://secure-login-paypa1-update.com/verify`).
   - **Scam Message Scanner**: Try pasting an SMS or banking message with urgent threats or lottery claims.
   - **Dashboard & Charts**: Check live KPI cards, distribution doughnut chart, and daily activity trends.
   - **Scan History**: Search, filter by risk level, inspect records, and download CSV / JSON reports.
   - **Admin Panel**: Login with `admin@scanguard.ai` / `Admin@1234` to manage registered users and view system logs.

---

## 📂 Google Sheets Database Auto-Creation

On your first API call, Google Apps Script will automatically create a spreadsheet in your Google Drive named **`ScanGuard_Database`** with 4 sheets:
- **`Users`**: Holds registered user credentials & roles.
- **`Scans`**: Logs all scanned URLs, messages, risk scores, and reasons.
- **`OTPs`**: Stores 6-digit OTP codes and expiration timestamps.
- **`Settings`**: Holds system & AI configuration.
