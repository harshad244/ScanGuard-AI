# AI-Based Scam & Phishing Detection System

A full-stack academic web application that helps users analyze **phishing URLs** and **scam messages** using Machine Learning (Random Forest + TF-IDF/Logistic Regression), NLP, and a rule-assisted risk scoring engine.


cd "C:\Users\Harshad Teli\Downloads\AI_SCAM"
& "C:\ProgramData\anaconda3\python.exe" app.py



> **Disclaimer:** Detection results are AI-based predictions and decision-support signals. They are **not** a guarantee of website or message safety.

## Features

- Phishing URL scanner with URL feature extraction (no automatic visiting of URLs)
- Scam message detector (SMS/email/chat text) with NLP preprocessing
- Risk score (0–100) and levels: LOW / MEDIUM / HIGH
- User registration, login, sessions, profile
- User dashboard with KPI cards and Chart.js charts (MySQL-backed)
- Scan history with search, filters, and sorting
- Admin dashboard: users, scan monitoring, reports, ML model metadata
- REST API endpoints with validation and role-based access
- Demo training datasets + training pipeline for real datasets later
- Render deployment ready (Gunicorn + external MySQL)

## Technology Stack

| Layer | Tools |
|------|--------|
| Frontend | HTML5, CSS3, JavaScript, Bootstrap 5, Chart.js, Font Awesome |
| Backend | Python, Flask, Flask-WTF (CSRF) |
| ML/NLP | scikit-learn, pandas, numpy, NLTK, TF-IDF |
| Database | MySQL (XAMPP local / hosted MySQL on Render) |

## Folder Structure

```
project/
├── app.py
├── config.py
├── requirements.txt
├── render.yaml
├── models/train_models.py
├── ml/
├── routes/
├── database/
├── templates/
├── static/
├── data/
├── scripts/
└── tests/
```

## System Requirements

- Python 3.10+
- XAMPP (Apache optional, **MySQL required** locally)
- Git (optional)
- 4 GB RAM recommended for ML training

## Local Installation (XAMPP + Flask)

### 1. Install Python & XAMPP

Install Python from [python.org](https://www.python.org/) and XAMPP from [apachefriends.org](https://www.apachefriends.org/).

### 2. Start MySQL

Open XAMPP Control Panel → **Start MySQL**.

### 3. Create database

1. Open `http://localhost/phpmyadmin`
2. Import `database/schema.sql` **or** run the SQL file (creates `scam_detection` and tables)

### 4. Project setup

```bash
cd AI_SCAM
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
```

Edit `.env` and set at minimum:

```env
SECRET_KEY=your-long-random-secret
DB_PASSWORD=
```

(Leave `DB_PASSWORD` empty if XAMPP root has no password.)

### 5. Train ML models (demo dataset)

```bash
python models/train_models.py
python scripts/sync_model_metadata.py
```

This creates `models/url_model.pkl` and `models/message_model.pkl`.

### 6. Create admin account

```bash
python scripts/create_admin.py --email admin@example.com --name "Admin User" --password "Admin@123"
```

### 7. Run Flask

```bash
python app.py
```

Open: **http://127.0.0.1:5000**

## Using the Application

### User flow

1. Register / Login
2. Dashboard → URL Scanner or Message Scanner
3. View result (risk score, reasons, indicators)
4. History & dashboard statistics update from MySQL

### Admin flow

1. Login with admin account
2. `/admin` dashboard, Users, Scan Records, Reports, ML Models

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/register` | Register user |
| POST | `/api/login` | Login |
| POST | `/api/logout` | Logout |
| POST | `/api/scan/url` | Scan URL (auth) |
| POST | `/api/scan/message` | Scan message (auth) |
| GET | `/api/history` | Scan history (auth) |
| GET | `/api/dashboard` | Dashboard stats (auth) |
| GET | `/api/admin/users` | List users (admin) |
| POST | `/api/admin/users/<id>/toggle` | Enable/disable user (admin) |
| GET | `/api/admin/reports` | Reports data (admin) |
| GET | `/api/admin/scans` | Scan records (admin) |

Send JSON requests with header `X-CSRFToken` from the page meta tag for POST routes.

## ML Model Training & Real Datasets

Demo CSV files (labeled **demonstration/training data only**):

- `data/url_dataset.csv` — columns: `url`, `label` (`0=safe`, `1=suspicious`, `2=scam/phishing`)
- `data/message_dataset.csv` — columns: `text`, `label`

Replace these files with larger datasets and rerun:

```bash
python models/train_models.py
python scripts/sync_model_metadata.py
```

If model files are missing:

- Development (`REQUIRE_ML_MODELS=0`): controlled rule-assisted fallback (app still runs)
- Production (`REQUIRE_ML_MODELS=1`): startup fails until models are trained

## Security Notes

- Passwords hashed with Werkzeug (never stored in plain text)
- Parameterized SQL queries
- Session-based authentication + admin role checks
- CSRF protection on mutating requests
- URLs analyzed as **data only** (no HTTP fetch to suspicious links)
- Rate limit: `SCAN_RATE_LIMIT` scans/user/hour (default 30)

## Testing

```bash
pytest -q
```

Some auth integration tests skip automatically if MySQL is unavailable.

## Render Deployment

1. Push project to GitHub
2. Create a **Web Service** on Render
3. Use **external MySQL** (PlanetScale, Aiven, Railway, etc.) — XAMPP is local only
4. Set environment variables from `.env.example`
5. Build command: `pip install -r requirements.txt && python models/train_models.py`
6. Start command: `gunicorn app:app --bind 0.0.0.0:$PORT`
7. Import `database/schema.sql` into hosted MySQL
8. Create admin via local script pointing to hosted DB credentials

See `render.yaml` for a starter blueprint.

## GitHub

```bash
git init
git add .
git commit -m "Initial commit: AI scam and phishing detection system"
git remote add origin <your-repo-url>
git push -u origin main
```

Do **not** commit `.env` or trained `.pkl` files if you prefer CI training (they are gitignored).

## Limitations

- Demo datasets are small — accuracy is **not** representative of production anti-phishing systems
- Risk scores are heuristic combinations, not calibrated probabilities
- English-focused NLP patterns
- No live threat intelligence feeds or browser integration

## Future Scope

- Larger public phishing datasets (PhishTank, OpenPhish exports)
- Model versioning & automated retraining jobs
- Explainability (SHAP/LIME) for URL features
- Multi-language message support
- Email `.eml` upload parsing
- 2FA for admin accounts
- Docker compose for one-command setup

## License

Academic/educational use. Verify compliance before production deployment.
