// TrustGuard Content Script
// Automatically shows trust indicators on news websites

const API_URL = 'https://budnnhrplhvimsrvdhuc.supabase.co/functions/v1';

// Analysis cache with 30-minute expiry
const CACHE_EXPIRY_MS = 30 * 60 * 1000;

// News domain patterns to auto-analyze
const NEWS_DOMAINS = [
  'news.', 'breaking.', '-news.', 'daily', 'times', 'post', 
  'tribune', 'herald', 'gazette', 'journal', 'chronicle',
  'reuters', 'apnews', 'bbc', 'cnn', 'foxnews', 'msnbc',
  'nytimes', 'washingtonpost', 'theguardian', 'huffpost'
];

(function() {
  // Prevent multiple injections
  if (window.__trustGuardInjected) return;
  window.__trustGuardInjected = true;

  let currentAnalysisData = null;
  const domain = window.location.hostname.toLowerCase();
  const pageUrl = window.location.href;
  const isNewsLikely = NEWS_DOMAINS.some(pattern => domain.includes(pattern));

  // Create floating button
  const floatingBtn = document.createElement('div');
  floatingBtn.id = 'trustguard-floating-btn';
  floatingBtn.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    </svg>
  `;
  floatingBtn.title = 'Check Trust Score';
  
  document.body.appendChild(floatingBtn);

  // Create persistent floating indicator (always visible after first analysis)
  const persistentIndicator = document.createElement('div');
  persistentIndicator.id = 'trustguard-persistent-indicator';
  persistentIndicator.className = 'trustguard-hidden';
  persistentIndicator.innerHTML = `
    <div class="persistent-badge">
      <span class="persistent-score">--</span>
      <span class="persistent-label">Trust</span>
    </div>
    <div class="persistent-details trustguard-hidden">
      <div class="persistent-domain">${domain}</div>
      <div class="persistent-rating">--</div>
      <div class="persistent-breakdown">
        <div class="mini-bar"><span class="bar-label">Text</span><div class="bar-fill text-bar"></div></div>
        <div class="mini-bar"><span class="bar-label">Domain</span><div class="bar-fill domain-bar"></div></div>
        <div class="mini-bar"><span class="bar-label">Evidence</span><div class="bar-fill evidence-bar"></div></div>
        <div class="mini-bar"><span class="bar-label">Sentiment</span><div class="bar-fill sentiment-bar"></div></div>
      </div>
      <button class="persistent-view-more">View Details</button>
    </div>
  `;
  document.body.appendChild(persistentIndicator);

  // Create trust indicator overlay (hidden by default)
  const indicator = document.createElement('div');
  indicator.id = 'trustguard-indicator';
  indicator.className = 'trustguard-hidden';
  indicator.innerHTML = `
    <div class="trustguard-header">
      <span class="trustguard-title">TrustGuard Analysis</span>
      <button class="trustguard-close">&times;</button>
    </div>
    <div class="trustguard-score">
      <span class="trustguard-score-value">--</span>
      <span class="trustguard-score-label">Trust Score</span>
    </div>
    <div class="trustguard-rating"></div>
    <button class="trustguard-details-btn">View Details</button>
  `;
  document.body.appendChild(indicator);

  // Create detailed analysis popup
  const detailsPopup = document.createElement('div');
  detailsPopup.id = 'trustguard-details-popup';
  detailsPopup.className = 'trustguard-hidden';
  detailsPopup.innerHTML = `
    <div class="trustguard-popup-content">
      <div class="trustguard-popup-header">
        <h3>Detailed Analysis</h3>
        <button class="trustguard-popup-close">&times;</button>
      </div>
      <div class="trustguard-popup-body">
        <div class="trustguard-popup-score-section">
          <div class="trustguard-popup-main-score">
            <span class="trustguard-popup-score-value">--</span>
            <span class="trustguard-popup-rating">--</span>
          </div>
        </div>
        <div class="trustguard-popup-breakdown">
          <h4>Score Breakdown</h4>
          <div class="trustguard-score-item">
            <span class="trustguard-score-label">Text Quality</span>
            <div class="trustguard-score-bar-container">
              <div class="trustguard-score-bar" id="text-bar"></div>
            </div>
            <span class="trustguard-score-value" id="text-score">--</span>
          </div>
          <div class="trustguard-score-item">
            <span class="trustguard-score-label">Domain Trust</span>
            <div class="trustguard-score-bar-container">
              <div class="trustguard-score-bar" id="domain-bar"></div>
            </div>
            <span class="trustguard-score-value" id="domain-score">--</span>
          </div>
          <div class="trustguard-score-item">
            <span class="trustguard-score-label">Evidence</span>
            <div class="trustguard-score-bar-container">
              <div class="trustguard-score-bar" id="evidence-bar"></div>
            </div>
            <span class="trustguard-score-value" id="evidence-score">--</span>
          </div>
          <div class="trustguard-score-item">
            <span class="trustguard-score-label">Sentiment</span>
            <div class="trustguard-score-bar-container">
              <div class="trustguard-score-bar" id="sentiment-bar"></div>
            </div>
            <span class="trustguard-score-value" id="sentiment-score">--</span>
          </div>
        </div>
        <div class="trustguard-popup-details">
          <h4>Analysis Details</h4>
          <div id="trustguard-details-list"></div>
        </div>
        <div class="trustguard-popup-actions">
          <button id="trustguard-add-whitelist" class="trustguard-action-btn trustguard-btn-success">Add to Trusted</button>
          <button id="trustguard-add-blacklist" class="trustguard-action-btn trustguard-btn-danger">Add to Suspicious</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(detailsPopup);

  // Style injection
  const style = document.createElement('style');
  style.textContent = `
    #trustguard-floating-btn {
      position: fixed;
      bottom: 24px;
      right: 24px;
      width: 48px;
      height: 48px;
      background: linear-gradient(135deg, #0ea5e9 0%, #06b6d4 100%);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(14, 165, 233, 0.4);
      z-index: 999999;
      transition: transform 0.2s, box-shadow 0.2s;
    }
    #trustguard-floating-btn:hover {
      transform: scale(1.1);
      box-shadow: 0 6px 16px rgba(14, 165, 233, 0.5);
    }
    #trustguard-floating-btn svg {
      width: 24px;
      height: 24px;
      color: white;
    }
    #trustguard-floating-btn.analyzing {
      animation: pulse 1.5s infinite;
    }
    #trustguard-floating-btn.warning {
      background: linear-gradient(135deg, #f97316 0%, #ef4444 100%);
      box-shadow: 0 4px 12px rgba(239, 68, 68, 0.4);
    }
    #trustguard-floating-btn.trusted {
      background: linear-gradient(135deg, #22c55e 0%, #10b981 100%);
      box-shadow: 0 4px 12px rgba(34, 197, 94, 0.4);
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.6; }
    }
    #trustguard-indicator {
      position: fixed;
      bottom: 80px;
      right: 24px;
      background: #1e293b;
      border-radius: 12px;
      padding: 16px;
      box-shadow: 0 8px 24px rgba(0,0,0,0.3);
      z-index: 999999;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      min-width: 160px;
      transition: opacity 0.2s, transform 0.2s;
    }
    #trustguard-indicator.trustguard-hidden {
      opacity: 0;
      pointer-events: none;
      transform: translateY(10px);
    }
    .trustguard-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
    }
    .trustguard-title {
      font-size: 11px;
      color: #94a3b8;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      font-weight: 600;
    }
    .trustguard-score {
      text-align: center;
      margin-bottom: 8px;
    }
    .trustguard-score-value {
      font-size: 36px;
      font-weight: bold;
      display: block;
    }
    .trustguard-score-label {
      font-size: 11px;
      color: #94a3b8;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .trustguard-rating {
      text-align: center;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      margin-bottom: 12px;
    }
    .trustguard-rating.reliable {
      background: rgba(34, 197, 94, 0.2);
      color: #22c55e;
    }
    .trustguard-rating.verify {
      background: rgba(234, 179, 8, 0.2);
      color: #eab308;
    }
    .trustguard-rating.suspicious {
      background: rgba(239, 68, 68, 0.2);
      color: #ef4444;
    }
    .trustguard-details-btn {
      width: 100%;
      padding: 8px 12px;
      background: rgba(45, 212, 191, 0.2);
      border: 1px solid rgba(45, 212, 191, 0.3);
      border-radius: 6px;
      color: #2dd4bf;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
    }
    .trustguard-details-btn:hover {
      background: rgba(45, 212, 191, 0.3);
    }
    .trustguard-close {
      background: none;
      border: none;
      color: #64748b;
      font-size: 18px;
      cursor: pointer;
      padding: 4px;
      line-height: 1;
    }
    .trustguard-close:hover {
      color: #94a3b8;
    }

    /* Details Popup Styles */
    #trustguard-details-popup {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.7);
      z-index: 9999999;
      display: flex;
      align-items: center;
      justify-content: center;
      opacity: 1;
      transition: opacity 0.3s;
    }
    #trustguard-details-popup.trustguard-hidden {
      opacity: 0;
      pointer-events: none;
    }
    .trustguard-popup-content {
      background: #1e293b;
      border-radius: 16px;
      width: 90%;
      max-width: 480px;
      max-height: 85vh;
      overflow-y: auto;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }
    .trustguard-popup-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 20px 24px;
      border-bottom: 1px solid rgba(148, 163, 184, 0.1);
    }
    .trustguard-popup-header h3 {
      margin: 0;
      font-size: 18px;
      color: #f1f5f9;
    }
    .trustguard-popup-close {
      background: none;
      border: none;
      color: #64748b;
      font-size: 24px;
      cursor: pointer;
      padding: 4px 8px;
      line-height: 1;
    }
    .trustguard-popup-close:hover {
      color: #94a3b8;
    }
    .trustguard-popup-body {
      padding: 24px;
    }
    .trustguard-popup-score-section {
      text-align: center;
      margin-bottom: 24px;
    }
    .trustguard-popup-main-score {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
    }
    .trustguard-popup-score-value {
      font-size: 64px;
      font-weight: 800;
      line-height: 1;
    }
    .trustguard-popup-rating {
      padding: 6px 16px;
      border-radius: 20px;
      font-size: 14px;
      font-weight: 600;
      text-transform: uppercase;
    }
    .trustguard-popup-rating.reliable {
      background: rgba(34, 197, 94, 0.2);
      color: #22c55e;
    }
    .trustguard-popup-rating.verify {
      background: rgba(234, 179, 8, 0.2);
      color: #eab308;
    }
    .trustguard-popup-rating.suspicious {
      background: rgba(239, 68, 68, 0.2);
      color: #ef4444;
    }
    .trustguard-popup-breakdown {
      margin-bottom: 24px;
    }
    .trustguard-popup-breakdown h4,
    .trustguard-popup-details h4 {
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #94a3b8;
      margin: 0 0 16px 0;
    }
    .trustguard-score-item {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 12px;
    }
    .trustguard-score-item .trustguard-score-label {
      width: 100px;
      font-size: 13px;
      color: #cbd5e1;
    }
    .trustguard-score-bar-container {
      flex: 1;
      height: 8px;
      background: #334155;
      border-radius: 4px;
      overflow: hidden;
    }
    .trustguard-score-bar {
      height: 100%;
      border-radius: 4px;
      transition: width 0.5s ease;
      width: 0;
    }
    .trustguard-score-item .trustguard-score-value {
      width: 36px;
      text-align: right;
      font-size: 14px;
      font-weight: 600;
      color: #f1f5f9;
    }
    #trustguard-details-list {
      background: rgba(15, 23, 42, 0.5);
      border-radius: 8px;
      padding: 16px;
    }
    .trustguard-detail-item {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      padding: 8px 0;
      border-bottom: 1px solid rgba(148, 163, 184, 0.1);
      font-size: 13px;
      color: #cbd5e1;
    }
    .trustguard-detail-item:last-child {
      border-bottom: none;
    }
    .trustguard-detail-icon {
      font-size: 14px;
    }
    .trustguard-popup-actions {
      display: flex;
      gap: 12px;
      margin-top: 24px;
    }
    .trustguard-action-btn {
      flex: 1;
      padding: 12px 16px;
      border: none;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
    }
    .trustguard-btn-success {
      background: rgba(34, 197, 94, 0.2);
      color: #22c55e;
    }
    .trustguard-btn-success:hover {
      background: rgba(34, 197, 94, 0.3);
    }
    .trustguard-btn-danger {
      background: rgba(239, 68, 68, 0.2);
      color: #ef4444;
    }
    .trustguard-btn-danger:hover {
      background: rgba(239, 68, 68, 0.3);
    }
  `;
  document.head.appendChild(style);

  // Add persistent indicator styles
  const persistentStyle = document.createElement('style');
  persistentStyle.textContent = `
    #trustguard-persistent-indicator {
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 2147483646;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      transition: all 0.3s ease;
    }
    #trustguard-persistent-indicator.trustguard-hidden {
      display: none;
    }
    .persistent-badge {
      background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
      border-radius: 24px;
      padding: 8px 16px;
      display: flex;
      align-items: center;
      gap: 8px;
      cursor: pointer;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
      border: 1px solid rgba(45, 212, 191, 0.3);
      transition: all 0.2s ease;
    }
    .persistent-badge:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 24px rgba(0, 0, 0, 0.4);
      border-color: rgba(45, 212, 191, 0.6);
    }
    .persistent-score {
      font-size: 20px;
      font-weight: 700;
      min-width: 30px;
      text-align: center;
    }
    .persistent-score.reliable { color: #22c55e; }
    .persistent-score.verify { color: #eab308; }
    .persistent-score.suspicious { color: #ef4444; }
    .persistent-label {
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #94a3b8;
    }
    .persistent-details {
      background: #1e293b;
      border-radius: 12px;
      padding: 16px;
      margin-top: 8px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
      border: 1px solid rgba(148, 163, 184, 0.1);
      min-width: 200px;
    }
    .persistent-details.trustguard-hidden {
      display: none;
    }
    .persistent-domain {
      font-size: 11px;
      color: #64748b;
      margin-bottom: 8px;
      word-break: break-all;
    }
    .persistent-rating {
      font-size: 13px;
      font-weight: 600;
      text-transform: uppercase;
      padding: 4px 10px;
      border-radius: 4px;
      display: inline-block;
      margin-bottom: 12px;
    }
    .persistent-rating.reliable {
      background: rgba(34, 197, 94, 0.2);
      color: #22c55e;
    }
    .persistent-rating.verify {
      background: rgba(234, 179, 8, 0.2);
      color: #eab308;
    }
    .persistent-rating.suspicious {
      background: rgba(239, 68, 68, 0.2);
      color: #ef4444;
    }
    .persistent-breakdown {
      margin-bottom: 12px;
    }
    .mini-bar {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 6px;
    }
    .mini-bar .bar-label {
      font-size: 10px;
      color: #94a3b8;
      width: 60px;
    }
    .mini-bar .bar-fill {
      height: 6px;
      border-radius: 3px;
      flex: 1;
      transition: width 0.5s ease;
      background: #334155;
    }
    .mini-bar .bar-fill::after {
      content: '';
      display: block;
      height: 100%;
      border-radius: 3px;
      transition: width 0.5s ease;
    }
    .persistent-view-more {
      width: 100%;
      padding: 8px 12px;
      background: rgba(45, 212, 191, 0.2);
      border: 1px solid rgba(45, 212, 191, 0.3);
      border-radius: 6px;
      color: #2dd4bf;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
    }
    .persistent-view-more:hover {
      background: rgba(45, 212, 191, 0.3);
    }
    .cached-indicator {
      font-size: 9px;
      color: #64748b;
      margin-top: 8px;
      text-align: center;
    }
    .cached-indicator::before {
      content: '⚡ ';
    }

    /* Light theme overrides for content script elements */
    .trustguard-light #trustguard-floating-btn {
      background: linear-gradient(135deg, #0d9488 0%, #14b8a6 100%);
    }
    .trustguard-light #trustguard-indicator {
      background: #ffffff;
      box-shadow: 0 8px 24px rgba(0,0,0,0.12);
      border: 1px solid #e2e8f0;
    }
    .trustguard-light .trustguard-title { color: #475569; }
    .trustguard-light .trustguard-score-label { color: #64748b; }
    .trustguard-light .trustguard-close { color: #94a3b8; }
    .trustguard-light .trustguard-close:hover { color: #475569; }
    .trustguard-light .trustguard-details-btn {
      background: rgba(13, 148, 136, 0.15);
      border-color: rgba(13, 148, 136, 0.3);
      color: #0d9488;
    }
    .trustguard-light .trustguard-details-btn:hover {
      background: rgba(13, 148, 136, 0.25);
    }
    .trustguard-light .persistent-badge {
      background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);
      border-color: rgba(13, 148, 136, 0.3);
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
    }
    .trustguard-light .persistent-badge:hover {
      border-color: rgba(13, 148, 136, 0.6);
      box-shadow: 0 6px 24px rgba(0, 0, 0, 0.15);
    }
    .trustguard-light .persistent-label { color: #64748b; }
    .trustguard-light .persistent-details {
      background: #ffffff;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
      border-color: #e2e8f0;
    }
    .trustguard-light .persistent-domain { color: #475569; }
    .trustguard-light .persistent-view-more {
      background: rgba(13, 148, 136, 0.15);
      border-color: rgba(13, 148, 136, 0.3);
      color: #0d9488;
    }
    .trustguard-light .persistent-view-more:hover {
      background: rgba(13, 148, 136, 0.25);
    }
    .trustguard-light .mini-bar .bar-label { color: #64748b; }
    .trustguard-light .mini-bar .bar-fill { background: #e2e8f0; }
    .trustguard-light .cached-indicator { color: #94a3b8; }
    .trustguard-light .trustguard-popup-content {
      background: #ffffff;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
    }
    .trustguard-light .trustguard-popup-header {
      border-color: #e2e8f0;
    }
    .trustguard-light .trustguard-popup-header h3 { color: #0f172a; }
    .trustguard-light .trustguard-popup-close { color: #94a3b8; }
    .trustguard-light .trustguard-popup-close:hover { color: #475569; }
    .trustguard-light .trustguard-score-item .trustguard-score-label { color: #475569; }
    .trustguard-light .trustguard-score-bar-container { background: #e2e8f0; }
    .trustguard-light .trustguard-score-item .trustguard-score-value { color: #0f172a; }
    .trustguard-light .trustguard-popup-breakdown h4,
    .trustguard-light .trustguard-popup-details h4 { color: #64748b; }
    .trustguard-light #trustguard-details-list {
      background: #f8fafc;
    }
    .trustguard-light .trustguard-detail-item {
      color: #475569;
      border-color: #e2e8f0;
    }
    .trustguard-light .trustguard-btn-success {
      background: rgba(34, 197, 94, 0.1);
    }
    .trustguard-light .trustguard-btn-danger {
      background: rgba(239, 68, 68, 0.1);
    }
  `;
  document.head.appendChild(persistentStyle);

  // Apply theme from storage
  function applyTheme(theme) {
    if (theme === 'light') {
      document.documentElement.classList.add('trustguard-light');
    } else {
      document.documentElement.classList.remove('trustguard-light');
    }
  }

  // Load and apply saved theme
  chrome.storage?.local?.get(['theme'], (result) => {
    applyTheme(result?.theme || 'dark');
  });

  // Listen for theme changes from popup
  chrome.storage?.onChanged?.addListener((changes, area) => {
    if (area === 'local' && changes.theme) {
      applyTheme(changes.theme.newValue);
    }
  });

  // Toggle persistent indicator details
  persistentIndicator.querySelector('.persistent-badge').addEventListener('click', () => {
    persistentIndicator.querySelector('.persistent-details').classList.toggle('trustguard-hidden');
  });

  // View more from persistent indicator
  persistentIndicator.querySelector('.persistent-view-more').addEventListener('click', () => {
    if (currentAnalysisData) {
      showDetailsPopup(currentAnalysisData);
    }
  });

  // Update persistent indicator
  function updatePersistentIndicator(data, fromCache = false) {
    const score = data.finalScore;
    const rating = data.rating;
    const scores = data.scores || {
      text: data.textScore || 50,
      domain: data.domainScore || 50,
      evidence: data.evidenceScore || 50,
      sentiment: data.sentimentScore || 50
    };
    
    const scoreEl = persistentIndicator.querySelector('.persistent-score');
    scoreEl.textContent = score;
    scoreEl.className = 'persistent-score ' + rating.toLowerCase();
    
    const ratingEl = persistentIndicator.querySelector('.persistent-rating');
    ratingEl.textContent = rating;
    ratingEl.className = 'persistent-rating ' + rating.toLowerCase();
    
    // Update mini bars
    const bars = persistentIndicator.querySelectorAll('.bar-fill');
    const scoreValues = [scores.text, scores.domain, scores.evidence, scores.sentiment];
    bars.forEach((bar, i) => {
      const value = scoreValues[i] || 50;
      bar.style.background = `linear-gradient(90deg, ${getScoreColor(value)} ${value}%, #334155 ${value}%)`;
    });
    
    // Show cached indicator
    let cachedEl = persistentIndicator.querySelector('.cached-indicator');
    if (fromCache) {
      if (!cachedEl) {
        cachedEl = document.createElement('div');
        cachedEl.className = 'cached-indicator';
        persistentIndicator.querySelector('.persistent-details').appendChild(cachedEl);
      }
      cachedEl.textContent = 'Cached result';
    } else if (cachedEl) {
      cachedEl.remove();
    }
    
    persistentIndicator.classList.remove('trustguard-hidden');
  }

  // Cache analysis result
  async function cacheAnalysis(url, data) {
    const cacheKey = 'tg_cache_' + btoa(url).replace(/[^a-zA-Z0-9]/g, '').substring(0, 32);
    const cacheData = {
      data,
      timestamp: Date.now(),
      url
    };
    
    try {
      if (chrome.storage?.local) {
        chrome.storage.local.get(['analysisCache'], (result) => {
          const cache = result.analysisCache || {};
          cache[cacheKey] = cacheData;
          
          // Keep only last 100 cached items
          const keys = Object.keys(cache);
          if (keys.length > 100) {
            const oldest = keys.sort((a, b) => cache[a].timestamp - cache[b].timestamp).slice(0, keys.length - 100);
            oldest.forEach(k => delete cache[k]);
          }
          
          chrome.storage.local.set({ analysisCache: cache });
        });
      }
    } catch (e) {
      console.log('TrustGuard: Cache save failed', e);
    }
  }

  // Get cached analysis
  async function getCachedAnalysis(url) {
    return new Promise((resolve) => {
      const cacheKey = 'tg_cache_' + btoa(url).replace(/[^a-zA-Z0-9]/g, '').substring(0, 32);
      
      try {
        if (chrome.storage?.local) {
          chrome.storage.local.get(['analysisCache'], (result) => {
            const cache = result.analysisCache || {};
            const cached = cache[cacheKey];
            
            if (cached && (Date.now() - cached.timestamp) < CACHE_EXPIRY_MS) {
              resolve({ found: true, data: cached.data });
            } else {
              resolve({ found: false });
            }
          });
        } else {
          resolve({ found: false });
        }
      } catch (e) {
        resolve({ found: false });
      }
    });
  }

  // Handle click on floating button
  floatingBtn.addEventListener('click', async () => {
    if (floatingBtn.classList.contains('analyzing')) return;
    
    // Check cache first
    const cached = await getCachedAnalysis(pageUrl);
    if (cached.found) {
      currentAnalysisData = cached.data;
      showIndicator(cached.data);
      updateFloatingButtonState(cached.data.finalScore);
      updatePersistentIndicator(cached.data, true);
      chrome.runtime?.sendMessage({ 
        type: 'UPDATE_BADGE', 
        score: cached.data.finalScore 
      });
      return;
    }
    
    floatingBtn.classList.add('analyzing');
    
    try {
      const content = extractPageContent();
      const response = await fetch(`${API_URL}/analyze-api`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          url: pageUrl,
          text: content.content 
        })
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          currentAnalysisData = result.data;
          showIndicator(result.data);
          updateFloatingButtonState(result.data.finalScore);
          updatePersistentIndicator(result.data, false);
          // Cache the result
          await cacheAnalysis(pageUrl, result.data);
          // Update badge
          chrome.runtime?.sendMessage({ 
            type: 'UPDATE_BADGE', 
            score: result.data.finalScore 
          });
        }
      } else {
        // Fallback to local analysis
        const localResult = analyzeLocally(content.content, pageUrl);
        currentAnalysisData = localResult;
        showIndicator(localResult);
        updateFloatingButtonState(localResult.finalScore);
        updatePersistentIndicator(localResult, false);
        await cacheAnalysis(pageUrl, localResult);
      }
    } catch (error) {
      console.error('TrustGuard analysis error:', error);
    } finally {
      floatingBtn.classList.remove('analyzing');
    }
  });

  // Auto-load cached result on page load
  (async () => {
    const cached = await getCachedAnalysis(pageUrl);
    if (cached.found) {
      currentAnalysisData = cached.data;
      updateFloatingButtonState(cached.data.finalScore);
      updatePersistentIndicator(cached.data, true);
      chrome.runtime?.sendMessage({ 
        type: 'UPDATE_BADGE', 
        score: cached.data.finalScore 
      });
    }
  })();

  // Update floating button appearance based on score
  function updateFloatingButtonState(score) {
    floatingBtn.classList.remove('warning', 'trusted');
    if (score >= 70) {
      floatingBtn.classList.add('trusted');
    } else if (score < 40) {
      floatingBtn.classList.add('warning');
    }
  }

  // Close indicator
  indicator.querySelector('.trustguard-close').addEventListener('click', () => {
    indicator.classList.add('trustguard-hidden');
  });

  // Open details popup
  indicator.querySelector('.trustguard-details-btn').addEventListener('click', () => {
    if (currentAnalysisData) {
      showDetailsPopup(currentAnalysisData);
    }
  });

  // Close details popup
  detailsPopup.querySelector('.trustguard-popup-close').addEventListener('click', () => {
    detailsPopup.classList.add('trustguard-hidden');
  });

  // Close popup on overlay click
  detailsPopup.addEventListener('click', (e) => {
    if (e.target === detailsPopup) {
      detailsPopup.classList.add('trustguard-hidden');
    }
  });

  // Whitelist/Blacklist buttons
  document.getElementById('trustguard-add-whitelist').addEventListener('click', () => {
    addToList('whitelist');
  });

  document.getElementById('trustguard-add-blacklist').addEventListener('click', () => {
    addToList('blacklist');
  });

  function addToList(listType) {
    const domain = window.location.hostname.replace(/^www\./, '');
    
    chrome.storage?.local?.get([listType], (result) => {
      const list = result[listType] || [];
      if (!list.includes(domain)) {
        list.push(domain);
        chrome.storage.local.set({ [listType]: list }, () => {
          detailsPopup.classList.add('trustguard-hidden');
          alert(`${domain} added to ${listType === 'whitelist' ? 'trusted' : 'suspicious'} sites!`);
        });
      } else {
        alert(`${domain} is already in ${listType === 'whitelist' ? 'trusted' : 'suspicious'} sites.`);
      }
    });
  }

  function showIndicator(data) {
    const score = data.finalScore;
    const rating = data.rating;
    
    indicator.querySelector('.trustguard-score-value').textContent = score;
    indicator.querySelector('.trustguard-score-value').style.color = getScoreColor(score);
    
    const ratingEl = indicator.querySelector('.trustguard-rating');
    ratingEl.textContent = rating;
    ratingEl.className = 'trustguard-rating ' + rating.toLowerCase();
    
    indicator.classList.remove('trustguard-hidden');
  }

  function showDetailsPopup(data) {
    const score = data.finalScore;
    const rating = data.rating;
    const scores = data.scores || {
      text: data.textScore || 50,
      domain: data.domainScore || 50,
      evidence: data.evidenceScore || 50,
      sentiment: data.sentimentScore || 50
    };

    // Main score
    const scoreEl = detailsPopup.querySelector('.trustguard-popup-score-value');
    scoreEl.textContent = score;
    scoreEl.style.color = getScoreColor(score);

    // Rating
    const ratingEl = detailsPopup.querySelector('.trustguard-popup-rating');
    ratingEl.textContent = rating;
    ratingEl.className = 'trustguard-popup-rating ' + rating.toLowerCase();

    // Score bars
    setTimeout(() => {
      setScoreBar('text', scores.text);
      setScoreBar('domain', scores.domain);
      setScoreBar('evidence', scores.evidence);
      setScoreBar('sentiment', scores.sentiment);
    }, 100);

    // Details list
    const detailsList = document.getElementById('trustguard-details-list');
    const details = [];
    
    if (data.whitelisted) {
      details.push({ icon: '✓', text: 'This domain is in your trusted list' });
    }
    if (data.blacklisted) {
      details.push({ icon: '⚠', text: 'This domain is in your suspicious list' });
    }
    if (data.details?.clickbaitWords?.length > 0) {
      details.push({ icon: '📢', text: `Found ${data.details.clickbaitWords.length} clickbait patterns` });
    }
    if (scores.domain >= 80) {
      details.push({ icon: '✓', text: 'Domain appears reputable' });
    } else if (scores.domain < 40) {
      details.push({ icon: '⚠', text: 'Domain has low trust indicators' });
    }
    if (data.details?.sslValid !== undefined) {
      details.push({ 
        icon: data.details.sslValid ? '🔒' : '⚠', 
        text: data.details.sslValid ? 'Secure connection (HTTPS)' : 'No secure connection' 
      });
    }
    if (scores.evidence >= 70) {
      details.push({ icon: '📚', text: 'Good amount of evidence and sources' });
    } else if (scores.evidence < 40) {
      details.push({ icon: '📝', text: 'Limited evidence or sources found' });
    }
    if (scores.sentiment < 40) {
      details.push({ icon: '😤', text: 'High emotional or biased language detected' });
    }
    if (details.length === 0) {
      details.push({ icon: 'ℹ️', text: 'No specific concerns detected' });
    }

    detailsList.innerHTML = details.map(d => `
      <div class="trustguard-detail-item">
        <span class="trustguard-detail-icon">${d.icon}</span>
        <span>${d.text}</span>
      </div>
    `).join('');

    detailsPopup.classList.remove('trustguard-hidden');
  }

  function setScoreBar(id, score) {
    const bar = document.getElementById(`${id}-bar`);
    const scoreEl = document.getElementById(`${id}-score`);
    if (bar && scoreEl) {
      bar.style.width = `${score}%`;
      bar.style.background = getScoreColor(score);
      scoreEl.textContent = score;
    }
  }

  function getScoreColor(score) {
    if (score >= 70) return '#22c55e';
    if (score >= 40) return '#eab308';
    return '#ef4444';
  }

  function extractPageContent() {
    const title = document.title;
    
    const selectors = [
      'article', '[role="article"]', '.article-content',
      '.post-content', '.entry-content', 'main', '.content'
    ];

    let content = '';
    for (const selector of selectors) {
      const el = document.querySelector(selector);
      if (el) {
        content = el.innerText;
        break;
      }
    }

    if (!content) {
      content = document.body.innerText;
    }

    return { title, content: content.slice(0, 5000), url: window.location.href };
  }

  function analyzeLocally(content, url) {
    const clickbaitWords = [
      'shocking', 'unbelievable', 'won\'t believe', 'secret',
      'breaking', 'urgent', 'exclusive', 'bombshell'
    ];

    const text = content.toLowerCase();
    let textScore = 70;
    let domainScore = 60;
    let evidenceScore = 50;
    let sentimentScore = 65;

    const foundClickbait = clickbaitWords.filter(w => text.includes(w));
    textScore -= foundClickbait.length * 8;

    try {
      const hostname = new URL(url).hostname;
      const trusted = ['reuters', 'apnews', 'bbc', 'npr', 'nytimes'];
      if (trusted.some(d => hostname.includes(d))) {
        domainScore = 90;
      } else if (hostname.endsWith('.gov') || hostname.endsWith('.edu')) {
        domainScore = 85;
      }
    } catch {}

    const finalScore = Math.round(
      Math.max(0, Math.min(100, textScore)) * 0.35 +
      Math.max(0, Math.min(100, domainScore)) * 0.25 +
      evidenceScore * 0.25 + sentimentScore * 0.15
    );

    let rating = 'verify';
    if (finalScore >= 70) rating = 'reliable';
    else if (finalScore < 40) rating = 'suspicious';

    return { 
      finalScore, 
      rating,
      scores: { text: textScore, domain: domainScore, evidence: evidenceScore, sentiment: sentimentScore },
      details: { clickbaitWords: foundClickbait }
    };
  }

  // Check domain list on load
  chrome.storage?.local?.get(['whitelist', 'blacklist', 'showFloatingButton'], (result) => {
    const showButton = result.showFloatingButton !== false;
    if (!showButton) {
      floatingBtn.style.display = 'none';
    }

    const currentDomain = domain.replace(/^www\./, '');
    const whitelist = result.whitelist || [];
    const blacklist = result.blacklist || [];

    if (whitelist.some(d => currentDomain === d || currentDomain.endsWith('.' + d))) {
      floatingBtn.classList.add('trusted');
    } else if (blacklist.some(d => currentDomain === d || currentDomain.endsWith('.' + d))) {
      floatingBtn.classList.add('warning');
    }
  });

  // Auto-analyze on news sites after a delay
  if (isNewsLikely) {
    chrome.storage?.local?.get(['autoAnalyze'], (result) => {
      if (result?.autoAnalyze) {
        setTimeout(() => {
          floatingBtn.click();
        }, 2000);
      }
    });
  }

  // Play alert sound function
  function playAlertSound() {
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.value = 440;
      oscillator.type = 'sine';
      
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.3);
      
      // Second beep
      setTimeout(() => {
        const osc2 = audioContext.createOscillator();
        const gain2 = audioContext.createGain();
        osc2.connect(gain2);
        gain2.connect(audioContext.destination);
        osc2.frequency.value = 523;
        osc2.type = 'sine';
        gain2.gain.setValueAtTime(0.3, audioContext.currentTime);
        gain2.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
        osc2.start(audioContext.currentTime);
        osc2.stop(audioContext.currentTime + 0.3);
      }, 150);
    } catch (e) {
      console.error('TrustGuard: Could not play alert sound', e);
    }
  }

  // Listen for messages from popup and service worker
  chrome.runtime?.onMessage?.addListener((request, sender, sendResponse) => {
    if (request.action === 'getPageContent') {
      sendResponse(extractPageContent());
    }
    if (request.type === 'SETTINGS_UPDATED') {
      const settings = request.settings;
      if (settings.showFloatingButton === false) {
        floatingBtn.style.display = 'none';
      } else {
        floatingBtn.style.display = 'flex';
      }
    }
    if (request.type === 'PLAY_ALERT_SOUND') {
      playAlertSound();
      sendResponse({ success: true });
    }
    if (request.type === 'TRIGGER_ANALYSIS') {
      floatingBtn.click();
      sendResponse({ success: true });
    }
    if (request.type === 'TOGGLE_OVERLAY') {
      indicator.classList.toggle('trustguard-hidden');
      sendResponse({ success: true });
    }
    return true;
  });
})();