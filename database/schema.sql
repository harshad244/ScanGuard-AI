-- AI-Based Scam & Phishing Detection System
-- Database: scam_detection

CREATE DATABASE IF NOT EXISTS scam_detection
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE scam_detection;

CREATE TABLE IF NOT EXISTS users (
  user_id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('user', 'admin') NOT NULL DEFAULT 'user',
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_login DATETIME NULL,
  INDEX idx_users_email (email),
  INDEX idx_users_role (role)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS scans (
  scan_id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  input_type ENUM('url', 'message') NOT NULL,
  input_value TEXT NOT NULL,
  result ENUM('SAFE', 'SUSPICIOUS', 'SCAM') NOT NULL,
  risk_score INT NOT NULL,
  risk_level ENUM('LOW', 'MEDIUM', 'HIGH') NOT NULL,
  reason TEXT NOT NULL,
  scan_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
  INDEX idx_scans_user (user_id),
  INDEX idx_scans_date (scan_date),
  INDEX idx_scans_result (result),
  INDEX idx_scans_type (input_type)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS url_analysis (
  url_id INT AUTO_INCREMENT PRIMARY KEY,
  scan_id INT NOT NULL UNIQUE,
  url VARCHAR(2048) NOT NULL,
  domain VARCHAR(255) NULL,
  url_length INT NOT NULL,
  https_used TINYINT(1) NOT NULL DEFAULT 0,
  suspicious_features JSON NULL,
  FOREIGN KEY (scan_id) REFERENCES scans(scan_id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS message_analysis (
  message_id INT AUTO_INCREMENT PRIMARY KEY,
  scan_id INT NOT NULL UNIQUE,
  message_text TEXT NOT NULL,
  message_type VARCHAR(50) NULL DEFAULT 'general',
  suspicious_features JSON NULL,
  FOREIGN KEY (scan_id) REFERENCES scans(scan_id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS ml_models (
  model_id INT AUTO_INCREMENT PRIMARY KEY,
  model_name VARCHAR(100) NOT NULL,
  model_type VARCHAR(50) NOT NULL,
  version VARCHAR(20) NOT NULL DEFAULT '1.0.0',
  accuracy DECIMAL(5, 4) NULL,
  trained_date DATETIME NULL,
  status ENUM('active', 'inactive', 'training') NOT NULL DEFAULT 'active',
  UNIQUE KEY uq_model_name (model_name)
) ENGINE=InnoDB;

-- Demo admin: password is Admin@123 (change after first login in production)
-- Hash generated with werkzeug; run app seed or register manually
INSERT INTO ml_models (model_name, model_type, version, accuracy, trained_date, status)
VALUES
  ('url_random_forest', 'RandomForestClassifier', '1.0.0', NULL, NULL, 'inactive'),
  ('message_logistic_regression', 'LogisticRegression', '1.0.0', NULL, NULL, 'inactive')
ON DUPLICATE KEY UPDATE model_name = model_name;
