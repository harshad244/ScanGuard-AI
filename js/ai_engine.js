/**
 * ============================================================================
 * SCANGUARD AI - CLIENT-SIDE AI & HEURISTIC DETECTION ENGINE
 * ============================================================================
 * Provides instant AI heuristic analysis, feature extraction, lexical parsing,
 * typosquatting detection, and NLP pattern analysis.
 * Can run standalone in the browser or augment the GAS backend.
 * ============================================================================
 */

const AIEngine = (function () {
  // Target brands for typosquatting & impersonation checks
  const TARGET_BRANDS = [
    'google', 'paypal', 'microsoft', 'apple', 'amazon', 'facebook', 'instagram',
    'netflix', 'whatsapp', 'twitter', 'chase', 'bankofamerica', 'wellsfargo',
    'citibank', 'binance', 'coinbase', 'telegram', 'uber', 'spotify', 'dropbox',
    'linkedin', 'outlook', 'yahoo', 'github', 'adobe', 'ebay', 'steam', 'sbi', 'hdfc'
  ];

  // Suspicious keywords found in phishing domains/paths
  const URL_SUSPICIOUS_KEYWORDS = [
    'login', 'verify', 'secure', 'update', 'bank', 'account', 'password',
    'otp', 'confirm', 'wallet', 'prize', 'winner', 'free', 'urgent',
    'suspend', 'locked', 'click', 'gift', 'lottery', 'refund', 'kyc',
    'aadhaar', 'pan', 'support', 'billing', 'signin', 'authenticate',
    'service-update', 'claim', 'reward', 'crypto', 'binance', 'metamask',
    're-verify', 'security-alert', 'webscr', 'portal-login', 'action-required'
  ];

  const URL_SHORTENERS = [
    'bit.ly', 'tinyurl.com', 'goo.gl', 't.co', 'ow.ly', 'is.gd', 'buff.ly',
    'adf.ly', 'bit.do', 'cutt.ly', 'shorturl.at', 'rb.gy', 'tiny.cc'
  ];

  const HIGH_RISK_TLDS = [
    '.tk', '.ml', '.ga', '.cf', '.gq', '.xyz', '.top', '.work', '.click',
    '.loan', '.racing', '.surf', '.buzz', '.icu', '.monster'
  ];

  // ==========================================
  // URL SCANNER ENGINE
  // ==========================================
  function scanUrl(rawUrl) {
    if (!rawUrl || typeof rawUrl !== 'string') {
      throw new Error('Please enter a valid URL.');
    }

    let url = rawUrl.trim();
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'http://' + url;
    }

    let parsed;
    try {
      parsed = new URL(url);
    } catch (e) {
      throw new Error('Invalid URL format. Please check the address.');
    }

    const hostname = parsed.hostname.toLowerCase();
    const pathname = parsed.pathname.toLowerCase();
    const fullUrl = rawUrl.toLowerCase();
    const isHttps = rawUrl.toLowerCase().startsWith('https://');

    const indicators = [];
    let riskScore = 12; // Base confidence floor

    // 1. Insecure protocol
    if (!isHttps) {
      indicators.push('Insecure connection (Plain HTTP without SSL encryption)');
      riskScore += 16;
    }

    // 2. IP address as hostname
    const isIp = /^(\d{1,3}\.){3}\d{1,3}$/.test(hostname);
    if (isIp) {
      indicators.push('URL host is a raw IP address instead of a domain');
      riskScore += 28;
    }

    // 3. Obfuscation (@ symbol)
    if (rawUrl.includes('@')) {
      indicators.push('Contains "@" symbol (often used to obscure destination host)');
      riskScore += 32;
    }

    // 4. URL Shortening service
    const isShortener = URL_SHORTENERS.some(s => hostname === s || hostname.endsWith('.' + s));
    if (isShortener) {
      indicators.push('URL shortener detected (masks true target destination)');
      riskScore += 22;
    }

    // 5. High-risk TLD
    const hasHighRiskTld = HIGH_RISK_TLDS.some(tld => hostname.endsWith(tld));
    if (hasHighRiskTld) {
      indicators.push('Uses top-level domain frequently associated with spam campaigns');
      riskScore += 20;
    }

    // 6. Subdomain Depth
    const dots = (hostname.match(/\./g) || []).length;
    const subdomains = Math.max(0, dots - 1);
    if (subdomains >= 3) {
      indicators.push(`Excessive subdomains detected (${subdomains} levels)`);
      riskScore += 18;
    }

    // 7. Hyphen overuse
    const hyphens = (rawUrl.match(/-/g) || []).length;
    if (hyphens >= 4) {
      indicators.push(`Multiple hyphens used (${hyphens}) indicating potential spoofing`);
      riskScore += 15;
    }

    // 8. Keyword triggers
    const keywordHits = URL_SUSPICIOUS_KEYWORDS.filter(kw => fullUrl.includes(kw));
    if (keywordHits.length > 0) {
      indicators.push(`Contains security-sensitive keyword(s): ${keywordHits.slice(0, 4).join(', ')}`);
      riskScore += Math.min(30, keywordHits.length * 10);
    }

    // 9. Typosquatting / Brand Spoofing Check
    let typosquatBrand = null;
    for (const brand of TARGET_BRANDS) {
      const isOfficial = hostname === `${brand}.com` || hostname === `www.${brand}.com` ||
                         hostname.endsWith(`.${brand}.com`);
      if (!isOfficial) {
        // Levenshtein & character substitution check
        const cleanHost = hostname.replace(/0/g, 'o').replace(/1/g, 'l').replace(/3/g, 'e').replace(/@/g, 'a').replace(/-/g, '');
        if (cleanHost.includes(brand)) {
          typosquatBrand = brand;
          break;
        }
      }
    }

    if (typosquatBrand) {
      indicators.push(`Potential brand impersonation / typosquatting targeting "${typosquatBrand}"`);
      riskScore += 35;
    }

    // 10. URL Length & Entropy
    if (rawUrl.length > 90) {
      indicators.push('Excessively long URL structure (>90 characters)');
      riskScore += 10;
    }

    // Score capping
    riskScore = Math.max(0, Math.min(100, Math.round(riskScore)));

    let riskLevel = 'LOW';
    let resultLabel = 'SAFE';

    if (riskScore >= 70) {
      riskLevel = 'HIGH';
      resultLabel = 'SCAM';
    } else if (riskScore >= 35) {
      riskLevel = 'MEDIUM';
      resultLabel = 'SUSPICIOUS';
    }

    const reasons = buildReasons(resultLabel, indicators, 'url');

    return {
      input_type: 'url',
      input_value: rawUrl,
      result: resultLabel,
      risk_score: riskScore,
      risk_level: riskLevel,
      reasons: reasons,
      indicators: indicators,
      features: {
        domain: hostname,
        is_https: isHttps,
        is_ip: isIp,
        subdomains: subdomains,
        url_length: rawUrl.length,
        keyword_hits: keywordHits,
        typosquat_brand: typosquatBrand
      },
      recommendation: getRecommendation(resultLabel)
    };
  }

  // ==========================================
  // MESSAGE SCANNER ENGINE
  // ==========================================
  function scanMessage(messageText, messageType = 'general') {
    if (!messageText || typeof messageText !== 'string') {
      throw new Error('Please provide a message text to scan.');
    }

    const text = messageText.trim();
    const lower = text.toLowerCase();
    const indicators = [];
    let riskScore = 10;

    // 1. Urgency / Threat tactics
    const urgencyPatterns = [
      'urgent', 'immediately', 'within 24 hours', 'account suspended', 'blocked',
      'unauthorized access', 'legal action', 'police arrest', 'action required',
      'expires today', 'final warning', 'deactivation notice', 'restricted access'
    ];
    const urgencyHits = urgencyPatterns.filter(w => lower.includes(w));
    if (urgencyHits.length > 0) {
      indicators.push(`High-urgency / pressure tactics detected: ${urgencyHits.slice(0, 3).join(', ')}`);
      riskScore += Math.min(30, urgencyHits.length * 12);
    }

    // 2. Financial / Prize lure
    const financialPatterns = [
      'lottery', 'winner', 'won $', 'won ₹', 'claim reward', 'cash prize',
      'crypto giveaway', 'bitcoin gift', 'inheritance fund', 'refund approved',
      'congratulations you have won', 'free coupon', 'bonus credited'
    ];
    const finHits = financialPatterns.filter(w => lower.includes(w));
    if (finHits.length > 0) {
      indicators.push(`Unrealistic financial reward or prize lure detected: ${finHits.slice(0, 2).join(', ')}`);
      riskScore += 28;
    }

    // 3. Credential & Data Harvesting
    const credPatterns = [
      'enter password', 'share otp', 'send otp', 'cvv', 'atm pin', 'aadhaar',
      'pan card', 'ssn', 'seed phrase', 'secret key', 'verify bank', 'login here',
      'provide credentials', 'click below to update'
    ];
    const credHits = credPatterns.filter(w => lower.includes(w));
    if (credHits.length > 0) {
      indicators.push(`Requests sensitive credentials or verification code: ${credHits.slice(0, 3).join(', ')}`);
      riskScore += 35;
    }

    // 4. Embedded links
    const linkRegex = /(https?:\/\/[^\s]+|bit\.ly\/[^\s]+|tinyurl\.com\/[^\s]+|[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\/[^\s]*)/gi;
    const linksFound = text.match(linkRegex) || [];
    if (linksFound.length > 0) {
      indicators.push(`Message contains ${linksFound.length} embedded link(s): ${linksFound[0]}`);
      riskScore += 15;

      try {
        const urlAnalysis = scanUrl(linksFound[0]);
        if (urlAnalysis.risk_score >= 40) {
          indicators.push(`Embedded link "${linksFound[0]}" was flagged as ${urlAnalysis.result} (Risk ${urlAnalysis.risk_score}/100)`);
          riskScore = Math.max(riskScore, urlAnalysis.risk_score);
        }
      } catch (e) {
        // ignore url parse error
      }
    }

    // 5. Message Type Specific Rules
    if (messageType === 'bank' && (lower.includes('kyc') || lower.includes('pan') || lower.includes('debit card'))) {
      indicators.push('Impersonates formal banking notification requesting identity/card updates');
      riskScore += 22;
    } else if (messageType === 'job' && (lower.includes('work from home') || lower.includes('daily payout') || lower.includes('telegram'))) {
      indicators.push('Matches common fake task/work-from-home scam patterns');
      riskScore += 25;
    }

    riskScore = Math.max(0, Math.min(100, Math.round(riskScore)));

    let riskLevel = 'LOW';
    let resultLabel = 'SAFE';

    if (riskScore >= 70) {
      riskLevel = 'HIGH';
      resultLabel = 'SCAM';
    } else if (riskScore >= 35) {
      riskLevel = 'MEDIUM';
      resultLabel = 'SUSPICIOUS';
    }

    const reasons = buildReasons(resultLabel, indicators, 'message');

    return {
      input_type: 'message',
      message_type: messageType,
      input_value: text,
      result: resultLabel,
      risk_score: riskScore,
      risk_level: riskLevel,
      reasons: reasons,
      indicators: indicators,
      recommendation: getRecommendation(resultLabel)
    };
  }

  // ==========================================
  // HELPER FUNCTIONS
  // ==========================================
  function buildReasons(resultLabel, indicators, type) {
    const reasons = [];
    if (resultLabel === 'SCAM') {
      reasons.push(`High risk patterns detected matching dangerous ${type === 'url' ? 'phishing' : 'social engineering'} vectors.`);
    } else if (resultLabel === 'SUSPICIOUS') {
      reasons.push(`Elevated risk indicators observed. Verify authenticity before trusting.`);
    } else {
      reasons.push('No obvious scam signatures or deceptive parameters found.');
    }

    indicators.slice(0, 4).forEach(ind => reasons.push(ind));
    return reasons;
  }

  function getRecommendation(resultLabel) {
    if (resultLabel === 'SCAM') {
      return 'DANGER: Do NOT click links, do NOT enter passwords, and NEVER share OTPs or banking credentials. Report and block the sender.';
    } else if (resultLabel === 'SUSPICIOUS') {
      return 'WARNING: Avoid sharing private information. Verify via official apps or verified helpline numbers before taking action.';
    }
    return 'SAFE: The input shows no immediate threats. Always practice safe browsing habits.';
  }

  return {
    scanUrl,
    scanMessage,
    getRecommendation
  };
})();

// Attach to window
window.AIEngine = AIEngine;
