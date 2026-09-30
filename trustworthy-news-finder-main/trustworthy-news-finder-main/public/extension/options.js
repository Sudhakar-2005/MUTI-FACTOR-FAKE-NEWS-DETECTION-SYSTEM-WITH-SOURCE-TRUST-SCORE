// TrustGuard Options Page

document.addEventListener('DOMContentLoaded', () => {
  loadTheme();
  loadSettings();
  loadSyncSettings();
  loadHistory();
  loadDomainLists();
  loadAnalytics();
  setupEventListeners();
  setupBulkScanner();
  setupScheduledScan();
  loadScheduledScanSettings();
  loadCooldownSettings();
});

// Load saved theme
function loadTheme() {
  chrome.storage.local.get(['theme'], (result) => {
    if (result.theme === 'light') {
      document.body.classList.add('light-theme');
    }
  });
}

// Toggle theme
function toggleTheme() {
  document.body.classList.toggle('light-theme');
  const isLight = document.body.classList.contains('light-theme');
  chrome.storage.local.set({ theme: isLight ? 'light' : 'dark' });
}

// Load saved settings
function loadSettings() {
  chrome.storage.local.get([
    'autoAnalyze',
    'showFloatingButton',
    'notificationsEnabled',
    'soundEnabled',
    'alertThreshold',
    'useReputationAPI'
  ], (result) => {
    document.getElementById('autoAnalyze').checked = result.autoAnalyze ?? false;
    document.getElementById('showFloatingButton').checked = result.showFloatingButton ?? true;
    document.getElementById('notificationsEnabled').checked = result.notificationsEnabled ?? true;
    document.getElementById('soundEnabled').checked = result.soundEnabled ?? true;
    document.getElementById('useReputationAPI').checked = result.useReputationAPI ?? true;
    
    const threshold = result.alertThreshold ?? 40;
    document.getElementById('alertThreshold').value = threshold;
    document.getElementById('thresholdValue').textContent = threshold;
  });
}

// Load sync settings
function loadSyncSettings() {
  chrome.storage.local.get(['syncEnabled'], (result) => {
    document.getElementById('syncEnabled').checked = result.syncEnabled ?? false;
    updateSyncStatus();
  });
}

// Update sync status display
async function updateSyncStatus() {
  try {
    chrome.storage.sync.get(['_lastSynced'], (syncResult) => {
      chrome.storage.sync.getBytesInUse(null, (bytesInUse) => {
        const lastSynced = syncResult._lastSynced 
          ? new Date(syncResult._lastSynced).toLocaleString() 
          : 'Never';
        const bytesLimit = chrome.storage.sync.QUOTA_BYTES || 102400;
        const bytesUsedKB = (bytesInUse / 1024).toFixed(1);
        const bytesLimitKB = (bytesLimit / 1024).toFixed(0);
        
        document.getElementById('lastSynced').textContent = lastSynced;
        document.getElementById('syncStorage').textContent = `${bytesUsedKB} / ${bytesLimitKB} KB`;
      });
    });
  } catch (e) {
    console.log('Error getting sync status:', e);
  }
}

// Load domain lists
function loadDomainLists() {
  chrome.storage.local.get(['whitelist', 'blacklist'], (result) => {
    renderDomainList('whitelist', result.whitelist || []);
    renderDomainList('blacklist', result.blacklist || []);
  });
}

// Render a domain list
function renderDomainList(listType, domains) {
  const containerId = listType === 'whitelist' ? 'whitelistItems' : 'blacklistItems';
  const container = document.getElementById(containerId);
  const itemClass = listType === 'whitelist' ? 'trusted' : 'suspicious';
  
  if (domains.length === 0) {
    container.innerHTML = `<span class="empty-list">No domains added yet</span>`;
    return;
  }
  
  container.innerHTML = domains.map(domain => `
    <div class="domain-item ${itemClass}" data-domain="${domain}">
      <span>${domain}</span>
      <button class="domain-remove" title="Remove">&times;</button>
    </div>
  `).join('');
  
  // Add remove event listeners
  container.querySelectorAll('.domain-remove').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const item = e.target.closest('.domain-item');
      const domain = item.dataset.domain;
      removeDomain(listType, domain);
    });
  });
}

// Add domain to list
function addDomain(listType, domain) {
  if (!domain) return;
  
  // Clean domain
  domain = domain.toLowerCase().trim()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/.*$/, '');
  
  if (!domain) return;
  
  chrome.storage.local.get([listType], (result) => {
    const list = result[listType] || [];
    
    if (list.includes(domain)) {
      showSaveStatus(`${domain} is already in the list`);
      return;
    }
    
    // Remove from opposite list if present
    const oppositeList = listType === 'whitelist' ? 'blacklist' : 'whitelist';
    chrome.storage.local.get([oppositeList], (oppositeResult) => {
      const opposite = oppositeResult[oppositeList] || [];
      const filteredOpposite = opposite.filter(d => d !== domain);
      
      list.push(domain);
      
      chrome.storage.local.set({ 
        [listType]: list,
        [oppositeList]: filteredOpposite
      }, () => {
        loadDomainLists();
        showSaveStatus(`${domain} added to ${listType === 'whitelist' ? 'trusted' : 'suspicious'} sites`);
      });
    });
  });
}

// Remove domain from list
function removeDomain(listType, domain) {
  chrome.storage.local.get([listType], (result) => {
    const list = result[listType] || [];
    const filtered = list.filter(d => d !== domain);
    
    chrome.storage.local.set({ [listType]: filtered }, () => {
      loadDomainLists();
      showSaveStatus(`${domain} removed`);
    });
  });
}

// Load analysis history
function loadHistory() {
  chrome.storage.local.get(['analysisHistory'], (result) => {
    const history = result.analysisHistory || [];
    const historyList = document.getElementById('historyList');
    
    if (history.length === 0) {
      historyList.innerHTML = '<p class="empty-state">No analysis history yet. Start analyzing pages to see them here!</p>';
      return;
    }
    
    historyList.innerHTML = history.map(item => {
      const date = new Date(item.timestamp);
      const formattedDate = date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const domain = extractDomain(item.url);
      
      return `
        <div class="history-item">
          <div class="history-score" style="background: ${getScoreColor(item.score)}">
            ${item.score}
          </div>
          <div class="history-details">
            <div class="history-url" title="${item.url}">${domain}</div>
            <div class="history-meta">${formattedDate}</div>
          </div>
          <span class="history-rating" style="background: ${getScoreColor(item.score)}20; color: ${getScoreColor(item.score)}">
            ${item.rating || getRating(item.score)}
          </span>
        </div>
      `;
    }).join('');
  });
}

// Extract domain from URL
function extractDomain(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch {
    return url;
  }
}

// Get rating from score
function getRating(score) {
  if (score >= 80) return 'Highly Trusted';
  if (score >= 60) return 'Generally Trusted';
  if (score >= 40) return 'Questionable';
  if (score >= 20) return 'Unreliable';
  return 'Very Suspicious';
}

// Get score color
function getScoreColor(score) {
  if (score >= 80) return '#22c55e';
  if (score >= 60) return '#2dd4bf';
  if (score >= 40) return '#facc15';
  if (score >= 20) return '#fb923c';
  return '#ef4444';
}

// Setup event listeners
function setupEventListeners() {
  // Theme toggle
  document.getElementById('themeToggle')?.addEventListener('click', toggleTheme);
  
  // Settings changes
  const settingInputs = ['autoAnalyze', 'showFloatingButton', 'notificationsEnabled', 'soundEnabled', 'useReputationAPI'];
  settingInputs.forEach(id => {
    document.getElementById(id)?.addEventListener('change', saveSettings);
  });
  
  // Unified notification panel wiring
  document.getElementById('unifiedEmailNotify')?.addEventListener('change', (e) => {
    const checked = e.target.checked;
    chrome.storage.local.set({ scheduledScanEmailNotify: checked });
    document.getElementById('unifiedEmailDetail').style.display = checked ? '' : 'none';
    // Keep old checkbox in sync if it exists
    const old = document.getElementById('scheduledScanEmailNotify');
    if (old) old.checked = checked;
    showSaveStatus(checked ? 'Email reports enabled' : 'Email reports disabled');
  });
  
  document.getElementById('saveUnifiedEmail')?.addEventListener('click', () => {
    const email = document.getElementById('unifiedNotificationEmail').value.trim();
    if (!email || !email.includes('@')) { showSaveStatus('Please enter a valid email'); return; }
    chrome.storage.local.set({ notificationEmail: email }, () => {
      // Sync to old field if it exists
      const old = document.getElementById('notificationEmail');
      if (old) old.value = email;
      showSaveStatus('Email saved!');
    });
  });
  
  document.getElementById('unifiedWatchlistEmail')?.addEventListener('change', (e) => {
    chrome.storage.local.set({ watchlistEmailAlerts: e.target.checked });
    const old = document.getElementById('watchlistEmailAlerts');

  // Weekly alert digest toggle
  document.getElementById('unifiedWeeklyAlertDigest')?.addEventListener('change', (e) => {
    chrome.storage.local.set({ weeklyAlertDigestEnabled: e.target.checked });
    const detail = document.getElementById('weeklyDigestDetail');
    if (detail) detail.style.display = e.target.checked ? '' : 'none';
    updateNextDigestDate();
  });
    if (old) old.checked = e.target.checked;
    showSaveStatus(e.target.checked ? 'Watchlist email alerts enabled' : 'Watchlist email alerts disabled');
  });
  
  document.getElementById('unifiedScoreChangeAlerts')?.addEventListener('change', (e) => {
    chrome.storage.local.set({ scoreChangeAlerts: e.target.checked });
    const old = document.getElementById('scoreChangeAlerts');
    if (old) old.checked = e.target.checked;
    showSaveStatus(e.target.checked ? 'Score drop alerts enabled' : 'Score drop alerts disabled');
  });
  
  // Cooldown settings
  ['cooldownBrowser', 'cooldownSound', 'cooldownEmail', 'cooldownWatchlist'].forEach(id => {
    document.getElementById(id)?.addEventListener('change', saveCooldownSettings);
  });
  
  // Sync toggle
  document.getElementById('syncEnabled')?.addEventListener('change', handleSyncToggle);
  document.getElementById('syncNow')?.addEventListener('click', handleSyncNow);
  document.getElementById('loadFromSync')?.addEventListener('click', handleLoadFromSync);
  
  // Test sound button
  document.getElementById('testSound')?.addEventListener('click', playTestSound);
  
  // Import buttons
  document.getElementById('importWhitelist')?.addEventListener('click', () => importDomains('whitelist'));
  document.getElementById('importBlacklist')?.addEventListener('click', () => importDomains('blacklist'));
  document.getElementById('exportWhitelist')?.addEventListener('click', () => exportDomains('whitelist'));
  document.getElementById('exportBlacklist')?.addEventListener('click', () => exportDomains('blacklist'));
  
  // Threshold slider
  const thresholdSlider = document.getElementById('alertThreshold');
  thresholdSlider.addEventListener('input', (e) => {
    document.getElementById('thresholdValue').textContent = e.target.value;
  });
  thresholdSlider.addEventListener('change', saveSettings);
  
  // Whitelist add
  document.getElementById('addWhitelist').addEventListener('click', () => {
    const input = document.getElementById('whitelistInput');
    addDomain('whitelist', input.value);
    input.value = '';
  });
  
  document.getElementById('whitelistInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      addDomain('whitelist', e.target.value);
      e.target.value = '';
    }
  });
  
  // Blacklist add
  document.getElementById('addBlacklist').addEventListener('click', () => {
    const input = document.getElementById('blacklistInput');
    addDomain('blacklist', input.value);
    input.value = '';
  });
  
  document.getElementById('blacklistInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      addDomain('blacklist', e.target.value);
      e.target.value = '';
    }
  });
  
  // Clear history
  document.getElementById('clearHistory').addEventListener('click', () => {
    if (confirm('Are you sure you want to clear all analysis history?')) {
      chrome.storage.local.set({ analysisHistory: [] }, () => {
        loadHistory();
        showSaveStatus('History cleared!');
      });
    }
  });
  
  // Export history
  document.getElementById('exportHistory').addEventListener('click', exportHistory);
}

// Handle sync toggle
async function handleSyncToggle(e) {
  const enabled = e.target.checked;
  
  chrome.runtime.sendMessage({ type: 'TOGGLE_SYNC', enabled }, (response) => {
    if (response?.success) {
      showSaveStatus(enabled ? 'Sync enabled!' : 'Sync disabled');
      if (enabled) {
        updateSyncStatus();
      }
    } else {
      showSaveStatus('Failed to toggle sync');
      e.target.checked = !enabled;
    }
  });
}

// Handle sync now button
function handleSyncNow() {
  chrome.runtime.sendMessage({ type: 'SYNC_SETTINGS' }, (response) => {
    if (response?.success) {
      showSaveStatus('Settings synced to cloud!');
      updateSyncStatus();
    } else {
      showSaveStatus('Sync failed: ' + (response?.error || 'Unknown error'));
    }
  });
}

// Handle load from sync button
function handleLoadFromSync() {
  if (!confirm('This will overwrite your current settings with the synced settings. Continue?')) {
    return;
  }
  
  chrome.runtime.sendMessage({ type: 'LOAD_SYNC_SETTINGS' }, (response) => {
    if (response?.success && response.data) {
      showSaveStatus('Settings loaded from cloud!');
      loadSettings();
      loadDomainLists();
      updateSyncStatus();
    } else if (response?.success && !response.data) {
      showSaveStatus('No synced settings found');
    } else {
      showSaveStatus('Failed to load: ' + (response?.error || 'Unknown error'));
    }
  });
}

// Save settings
function saveSettings() {
  const settings = {
    autoAnalyze: document.getElementById('autoAnalyze').checked,
    showFloatingButton: document.getElementById('showFloatingButton').checked,
    notificationsEnabled: document.getElementById('notificationsEnabled').checked,
    soundEnabled: document.getElementById('soundEnabled').checked,
    alertThreshold: parseInt(document.getElementById('alertThreshold').value),
    useReputationAPI: document.getElementById('useReputationAPI').checked
  };
  
  chrome.storage.local.set(settings, () => {
    showSaveStatus();
    
    // Sync to cloud if enabled
    chrome.storage.local.get(['syncEnabled'], (result) => {
      if (result.syncEnabled) {
        chrome.runtime.sendMessage({ type: 'SYNC_SETTINGS' });
      }
    });
    
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach(tab => {
        chrome.tabs.sendMessage(tab.id, { type: 'SETTINGS_UPDATED', settings }).catch(() => {});
      });
    });
  });
}

// Save/load cooldown settings
function saveCooldownSettings() {
  const cooldowns = {
    browser: parseInt(document.getElementById('cooldownBrowser')?.value || '60'),
    sound: parseInt(document.getElementById('cooldownSound')?.value || '5'),
    email: parseInt(document.getElementById('cooldownEmail')?.value || '60'),
    watchlist: parseInt(document.getElementById('cooldownWatchlist')?.value || '360'),
  };
  chrome.storage.local.set({ notificationCooldowns: cooldowns }, () => {
    showSaveStatus('Cooldown settings saved');
  });
}

function updateNextDigestDate() {
  const el = document.getElementById('nextDigestDate');
  if (!el) return;
  const now = new Date();
  const day = now.getDay(); // 0=Sun
  const daysUntilMon = day === 0 ? 1 : day === 1 ? 7 : 8 - day;
  const next = new Date(now);
  next.setDate(now.getDate() + daysUntilMon);
  next.setHours(9, 0, 0, 0);
  el.textContent = next.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// Send weekly digest now (manual trigger)
document.getElementById('sendWeeklyDigestNow')?.addEventListener('click', () => {
  const btn = document.getElementById('sendWeeklyDigestNow');
  const status = document.getElementById('weeklyDigestStatus');
  btn.disabled = true;
  btn.textContent = '⏳ Sending...';
  if (status) { status.style.display = 'inline'; status.textContent = ''; }

  chrome.storage.local.get(['alertDigest', 'notificationEmail'], (result) => {
    const digest = result.alertDigest || [];
    const email = result.notificationEmail;
    if (!email) {
      btn.disabled = false;
      btn.textContent = '📨 Send Weekly Digest Now';
      if (status) { status.textContent = '❌ No email configured'; status.style.color = '#ef4444'; }
      return;
    }
    if (digest.length === 0) {
      btn.disabled = false;
      btn.textContent = '📨 Send Weekly Digest Now';
      if (status) { status.textContent = '⚠️ No alerts to send'; status.style.color = '#facc15'; }
      return;
    }

    const API_URL = 'https://budnnhrplhvimsrvdhuc.supabase.co/functions/v1';
    fetch(`${API_URL}/send-weekly-alert-digest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        displayName: 'TrustGuard User',
        alerts: digest.map(a => ({ channel: a.channel, message: a.message, timestamp: a.timestamp })),
      }),
    })
      .then(r => r.json())
      .then(data => {
        btn.disabled = false;
        btn.textContent = '📨 Send Weekly Digest Now';
        if (data.success) {
          if (status) { status.textContent = '✅ Sent!'; status.style.color = '#22c55e'; }
        } else {
          if (status) { status.textContent = '❌ ' + (data.error || 'Failed'); status.style.color = '#ef4444'; }
        }
      })
      .catch(err => {
        btn.disabled = false;
        btn.textContent = '📨 Send Weekly Digest Now';
        if (status) { status.textContent = '❌ Network error'; status.style.color = '#ef4444'; }
      });
  });
});

function loadCooldownSettings() {
  chrome.storage.local.get(['notificationCooldowns'], (result) => {
    const c = result.notificationCooldowns || { browser: 60, sound: 5, email: 60, watchlist: 360 };
    const setSelect = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.value = val.toString();
    };
    setSelect('cooldownBrowser', c.browser);
    setSelect('cooldownSound', c.sound);
    setSelect('cooldownEmail', c.email);
    setSelect('cooldownWatchlist', c.watchlist);
  });
}

// Play test sound
function playTestSound() {
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  const osc = audioContext.createOscillator();
  const gain = audioContext.createGain();
  osc.connect(gain);
  gain.connect(audioContext.destination);
  osc.frequency.setValueAtTime(880, audioContext.currentTime);
  osc.type = 'sine';
  gain.gain.setValueAtTime(0.3, audioContext.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.15);
  osc.start(audioContext.currentTime);
  osc.stop(audioContext.currentTime + 0.15);
  setTimeout(() => {
    const osc2 = audioContext.createOscillator();
    const gain2 = audioContext.createGain();
    osc2.connect(gain2);
    gain2.connect(audioContext.destination);
    osc2.frequency.setValueAtTime(660, audioContext.currentTime);
    gain2.gain.setValueAtTime(0.3, audioContext.currentTime);
    gain2.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
    osc2.start(audioContext.currentTime);
    osc2.stop(audioContext.currentTime + 0.2);
  }, 180);
}

// Import domains from file
function importDomains(listType) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.txt,.csv,.json';
  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      let domains = [];
      if (file.name.endsWith('.json')) {
        const json = JSON.parse(text);
        domains = Array.isArray(json) ? json : (json.domains || json[listType] || []);
      } else {
        domains = text.split(/[\n,;]/).map(d => d.trim().toLowerCase().replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0]).filter(d => d && !d.startsWith('#'));
      }
      if (domains.length === 0) { alert('No valid domains found'); return; }
      chrome.storage.local.get([listType], (result) => {
        const list = result[listType] || [];
        let added = 0;
        domains.forEach(d => { if (d && !list.includes(d)) { list.push(d); added++; } });
        chrome.storage.local.set({ [listType]: list }, () => { loadDomainLists(); showSaveStatus(`Imported ${added} domains`); });
      });
    } catch (err) { alert('Failed to import file'); }
  };
  input.click();
}

// Export domains to file
function exportDomains(listType) {
  chrome.storage.local.get([listType], (result) => {
    const domains = result[listType] || [];
    if (domains.length === 0) {
      showSaveStatus('No domains to export');
      return;
    }

    // Export as JSON with metadata
    const exportData = {
      exportedAt: new Date().toISOString(),
      listType: listType === 'whitelist' ? 'Trusted Sites' : 'Suspicious Sites',
      count: domains.length,
      domains: domains
    };

    const jsonBlob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const jsonUrl = URL.createObjectURL(jsonBlob);
    const a = document.createElement('a');
    a.href = jsonUrl;
    a.download = `trustguard-${listType}-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(jsonUrl);
    showSaveStatus(`Exported ${domains.length} domains`);
  });
}

// Show save status
function showSaveStatus(message = 'Settings saved!') {
  const status = document.getElementById('saveStatus');
  status.textContent = message;
  status.classList.remove('hidden');
  
  setTimeout(() => {
    status.classList.add('hidden');
  }, 2000);
}

// Export history as JSON
function exportHistory() {
  chrome.storage.local.get(['analysisHistory'], (result) => {
    const history = result.analysisHistory || [];
    
    if (history.length === 0) {
      alert('No history to export!');
      return;
    }
    
    const exportData = {
      exportedAt: new Date().toISOString(),
      totalAnalyses: history.length,
      history: history
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `trustguard-history-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showSaveStatus('History exported!');
  });
}

// Bulk Domain Scanner
let bulkScanResults = [];

function setupBulkScanner() {
  document.getElementById('startBulkScan')?.addEventListener('click', startBulkScan);
  document.getElementById('clearBulkResults')?.addEventListener('click', () => {
    document.getElementById('bulkResults').innerHTML = '';
    document.getElementById('bulkProgress').textContent = '';
    bulkScanResults = [];
    toggleExportButtons(false);
  });
  document.getElementById('exportBulkCSV')?.addEventListener('click', exportBulkCSV);
  document.getElementById('exportBulkJSON')?.addEventListener('click', exportBulkJSON);
}

function toggleExportButtons(show) {
  document.getElementById('exportBulkCSV').style.display = show ? '' : 'none';
  document.getElementById('exportBulkJSON').style.display = show ? '' : 'none';
}

async function startBulkScan() {
  const textarea = document.getElementById('bulkUrls');
  const raw = textarea.value.trim();
  if (!raw) return;

  const domains = raw.split(/[\n,;]/)
    .map(d => d.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, ''))
    .filter(d => d && d.includes('.'));

  if (domains.length === 0) {
    showSaveStatus('No valid domains found');
    return;
  }

  const unique = [...new Set(domains)];
  const resultsContainer = document.getElementById('bulkResults');
  const progress = document.getElementById('bulkProgress');
  const scanBtn = document.getElementById('startBulkScan');

  resultsContainer.innerHTML = '';
  bulkScanResults = [];
  scanBtn.disabled = true;
  scanBtn.textContent = '⏳ Scanning...';
  toggleExportButtons(false);

  for (let i = 0; i < unique.length; i++) {
    const domain = unique[i];
    progress.textContent = `${i + 1} / ${unique.length}`;

    const result = await scanSingleDomain(domain);
    const color = getScoreColor(result.score);
    const rating = getRating(result.score);
    const entry = { domain, score: result.score, rating, threats: result.threats, source: result.source, scannedAt: new Date().toISOString() };
    bulkScanResults.push(entry);

    const threatBadge = result.threats.length > 0 
      ? `<span class="bulk-threat-badge">⚠️ ${result.threats.length} threat${result.threats.length > 1 ? 's' : ''}</span>` 
      : '';

    const div = document.createElement('div');
    div.className = 'bulk-result-item';
    div.innerHTML = `
      <div class="bulk-result-score" style="background:${color}">${result.score}</div>
      <div class="bulk-result-domain">${domain}${threatBadge}</div>
      <span class="bulk-result-rating" style="background:${color}20;color:${color}">${rating}</span>
      <div class="bulk-result-actions">
        <button class="btn-small btn-secondary" onclick="addDomain('whitelist','${domain}')">✅</button>
        <button class="btn-small btn-secondary" onclick="addDomain('blacklist','${domain}')">🚫</button>
      </div>
    `;
    if (result.threats.length > 0) {
      const details = document.createElement('div');
      details.className = 'bulk-threat-details';
      details.innerHTML = result.threats.map(t => `<span class="threat-tag">${t}</span>`).join('');
      div.appendChild(details);
    }
    resultsContainer.appendChild(div);
  }

  scanBtn.disabled = false;
  scanBtn.textContent = '🚀 Scan All';
  progress.textContent = `Done! ${unique.length} domains scanned.`;
  toggleExportButtons(true);
  drawBulkSummaryCharts(bulkScanResults);
}

async function scanSingleDomain(domain) {
  return new Promise(async (resolve) => {
    chrome.storage.local.get(['whitelist', 'blacklist', 'useReputationAPI'], async (result) => {
      const whitelist = result.whitelist || [];
      const blacklist = result.blacklist || [];
      const useAPI = result.useReputationAPI ?? true;
      let threats = [];
      let source = 'heuristic';

      if (whitelist.includes(domain)) { resolve({ score: 95, threats: [], source: 'whitelist' }); return; }
      if (blacklist.includes(domain)) { resolve({ score: 10, threats: ['User blacklisted'], source: 'blacklist' }); return; }

      // URLhaus lookup
      if (useAPI) {
        try {
          const urlhausResult = await checkURLhaus(domain);
          if (urlhausResult.found) {
            threats.push(...urlhausResult.threats);
            source = 'urlhaus+heuristic';
          }
        } catch (e) {
          console.log('URLhaus check failed for', domain, e);
        }
      }

      // Heuristic scoring
      let score = 50;
      const tld = domain.split('.').pop();
      const trustedTLDs = ['gov', 'edu', 'org'];
      const riskyTLDs = ['xyz', 'top', 'buzz', 'click', 'loan', 'work', 'gq', 'ml', 'cf', 'tk'];

      if (trustedTLDs.includes(tld)) score += 25;
      if (riskyTLDs.includes(tld)) { score -= 20; threats.push('Risky TLD'); }
      if (domain.length > 30) { score -= 10; threats.push('Suspicious length'); }
      if (/\d{4,}/.test(domain)) { score -= 15; threats.push('Numeric pattern'); }
      if ((domain.match(/\./g) || []).length > 3) { score -= 10; threats.push('Excessive subdomains'); }
      if ((domain.match(/-/g) || []).length > 2) { score -= 10; threats.push('Excessive hyphens'); }

      const knownTrusted = ['google.com', 'github.com', 'wikipedia.org', 'bbc.com', 'nytimes.com', 'reuters.com', 'apnews.com'];
      if (knownTrusted.some(t => domain === t || domain.endsWith('.' + t))) { score = 90; threats = []; }

      // URLhaus penalty
      if (threats.some(t => t.startsWith('URLhaus:'))) score = Math.min(score, 15);

      resolve({ score: Math.max(0, Math.min(100, score)), threats, source });
    });
  });
}

async function checkURLhaus(domain) {
  try {
    const response = await fetch('https://urlhaus-api.abuse.ch/v1/host/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `host=${encodeURIComponent(domain)}`
    });
    const data = await response.json();
    if (data.query_status === 'no_results') return { found: false, threats: [] };
    const threats = [];
    if (data.urlhaus_reference) threats.push('URLhaus: Listed');
    if (data.urls && data.urls.length > 0) {
      const tags = new Set();
      data.urls.slice(0, 5).forEach(u => {
        if (u.threat) tags.add(u.threat);
        if (u.tags) u.tags.forEach(t => tags.add(t));
      });
      tags.forEach(t => threats.push(`URLhaus: ${t}`));
    }
    return { found: threats.length > 0, threats };
  } catch {
    return { found: false, threats: [] };
  }
}

function exportBulkCSV() {
  if (bulkScanResults.length === 0) return;
  const header = 'Domain,Score,Rating,Threats,Source,Scanned At';
  const rows = bulkScanResults.map(r =>
    `"${r.domain}",${r.score},"${r.rating}","${r.threats.join('; ')}","${r.source}","${r.scannedAt}"`
  );
  const csv = [header, ...rows].join('\n');
  downloadFile(csv, `trustguard-bulk-scan-${new Date().toISOString().split('T')[0]}.csv`, 'text/csv');
  showSaveStatus(`Exported ${bulkScanResults.length} results as CSV`);
}

function exportBulkJSON() {
  if (bulkScanResults.length === 0) return;
  const data = {
    exportedAt: new Date().toISOString(),
    totalDomains: bulkScanResults.length,
    results: bulkScanResults
  };
  downloadFile(JSON.stringify(data, null, 2), `trustguard-bulk-scan-${new Date().toISOString().split('T')[0]}.json`, 'application/json');
  showSaveStatus(`Exported ${bulkScanResults.length} results as JSON`);
}

function downloadFile(content, filename, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// Scheduled Scan Management
function setupScheduledScan() {
  document.getElementById('scheduledScanEnabled')?.addEventListener('change', (e) => {
    chrome.runtime.sendMessage({ type: 'TOGGLE_SCHEDULED_SCAN', enabled: e.target.checked });
    chrome.storage.local.set({ scheduledScanEnabled: e.target.checked });
    showSaveStatus(e.target.checked ? 'Daily scan enabled!' : 'Daily scan disabled');
  });
  
  document.getElementById('scheduledScanNotify')?.addEventListener('change', (e) => {
    chrome.storage.local.set({ scheduledScanNotify: e.target.checked });
    showSaveStatus('Notification setting saved');
  });
  
  document.getElementById('scoreChangeAlerts')?.addEventListener('change', (e) => {
    chrome.storage.local.set({ scoreChangeAlerts: e.target.checked });
    showSaveStatus(e.target.checked ? 'Score change alerts enabled' : 'Score change alerts disabled');
  });
  
  document.getElementById('scoreDropThreshold')?.addEventListener('input', (e) => {
    document.getElementById('scoreDropThresholdValue').textContent = e.target.value;
  });
  document.getElementById('scoreDropThreshold')?.addEventListener('change', (e) => {
    chrome.storage.local.set({ scoreDropThreshold: parseInt(e.target.value) });
    showSaveStatus('Drop threshold saved');
    loadScheduledScanSettings();
  });
  
  document.getElementById('exportTimelinePNG')?.addEventListener('click', exportTimelinePNG);
  document.getElementById('exportTimelinePDF')?.addEventListener('click', exportTimelinePDF);
  
  document.getElementById('scheduledScanEmailNotify')?.addEventListener('change', (e) => {
    chrome.storage.local.set({ scheduledScanEmailNotify: e.target.checked });
    document.getElementById('emailInputGroup').style.display = e.target.checked ? '' : 'none';
    showSaveStatus(e.target.checked ? 'Email notifications enabled' : 'Email notifications disabled');
  });
  
  document.getElementById('saveNotificationEmail')?.addEventListener('click', () => {
    const email = document.getElementById('notificationEmail').value.trim();
    if (!email || !email.includes('@')) { showSaveStatus('Please enter a valid email'); return; }
    chrome.storage.local.set({ notificationEmail: email }, () => showSaveStatus('Email saved!'));
  });
  
  document.getElementById('addMonitoredDomain')?.addEventListener('click', () => {
    const input = document.getElementById('monitoredDomainInput');
    addMonitoredDomain(input.value);
    input.value = '';
  });
  
  document.getElementById('monitoredDomainInput')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') { addMonitoredDomain(e.target.value); e.target.value = ''; }
  });
  
  document.getElementById('addAllWhitelistToMonitor')?.addEventListener('click', () => {
    chrome.storage.local.get(['whitelist'], (result) => {
      (result.whitelist || []).forEach(d => addMonitoredDomain(d));
    });
  });
  
  document.getElementById('addAllBlacklistToMonitor')?.addEventListener('click', () => {
    chrome.storage.local.get(['blacklist'], (result) => {
      (result.blacklist || []).forEach(d => addMonitoredDomain(d));
    });
  });
  
  document.getElementById('runScheduledNow')?.addEventListener('click', () => {
    const btn = document.getElementById('runScheduledNow');
    btn.disabled = true;
    btn.textContent = '⏳ Scanning...';
    chrome.runtime.sendMessage({ type: 'RUN_SCHEDULED_SCAN' }, () => {
      setTimeout(() => {
        btn.disabled = false;
        btn.textContent = '▶️ Run Now';
        loadScheduledScanSettings();
        showSaveStatus('Scheduled scan completed!');
      }, 2000);
    });
  });
  
  // Watchlist
  document.getElementById('addWatchlistDomain')?.addEventListener('click', () => {
    const domainInput = document.getElementById('watchlistDomainInput');
    const thresholdInput = document.getElementById('watchlistThresholdInput');
    addWatchlistDomain(domainInput.value, parseInt(thresholdInput.value) || 15);
    domainInput.value = '';
  });
  document.getElementById('watchlistDomainInput')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      const thresholdInput = document.getElementById('watchlistThresholdInput');
      addWatchlistDomain(e.target.value, parseInt(thresholdInput.value) || 15);
      e.target.value = '';
    }
  });
  
  // Watchlist email alerts toggle
  document.getElementById('watchlistEmailAlerts')?.addEventListener('change', (e) => {
    chrome.storage.local.set({ watchlistEmailAlerts: e.target.checked });
    showSaveStatus(e.target.checked ? 'Watchlist email alerts enabled' : 'Watchlist email alerts disabled');
  });
  
  // Comparison
  document.getElementById('runComparison')?.addEventListener('click', runDomainComparison);
  document.getElementById('exportComparisonPNG')?.addEventListener('click', exportComparisonPNG);
  document.getElementById('exportComparisonPDF')?.addEventListener('click', exportComparisonPDF);
  
  // Batch watchlist import/export
  document.getElementById('importWatchlistCSV')?.addEventListener('click', importWatchlistCSV);
  document.getElementById('exportWatchlistCSV')?.addEventListener('click', exportWatchlistCSV);
}

// ===== Domain Watchlist =====
function addWatchlistDomain(domain, threshold) {
  if (!domain) return;
  domain = domain.toLowerCase().trim().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '');
  if (!domain) return;
  
  chrome.storage.local.get(['domainWatchlist'], (result) => {
    const watchlist = result.domainWatchlist || [];
    const existing = watchlist.find(w => w.domain === domain);
    if (existing) {
      existing.threshold = threshold;
    } else {
      watchlist.push({ domain, threshold, lastScore: null, addedAt: Date.now() });
    }
    chrome.storage.local.set({ domainWatchlist: watchlist }, () => {
      renderWatchlist(watchlist);
      showSaveStatus(`${domain} watchlist updated (threshold: ${threshold})`);
    });
  });
}

function removeWatchlistDomain(domain) {
  chrome.storage.local.get(['domainWatchlist'], (result) => {
    const watchlist = (result.domainWatchlist || []).filter(w => w.domain !== domain);
    chrome.storage.local.set({ domainWatchlist: watchlist }, () => {
      renderWatchlist(watchlist);
      showSaveStatus(`${domain} removed from watchlist`);
    });
  });
}

function renderWatchlist(watchlist, scanHistory) {
  const container = document.getElementById('watchlistItems');
  if (!container) return;
  if (watchlist.length === 0) {
    container.innerHTML = '<span class="empty-list">No domains in watchlist yet. Add domains with custom thresholds.</span>';
    return;
  }
  
  // Build trend data from scan history
  const trendData = {};
  if (scanHistory && scanHistory.length > 0) {
    watchlist.forEach(w => {
      const scores = [];
      // Get last 5 scan scores for this domain
      const recentScans = scanHistory.slice(-5);
      recentScans.forEach(scan => {
        const entry = (scan.results || []).find(r => r.domain === w.domain);
        if (entry && entry.score >= 0) scores.push(entry.score);
      });
      trendData[w.domain] = scores;
    });
  }
  
  container.innerHTML = watchlist.map(w => {
    const scoreDisplay = w.lastScore !== null ? `Score: ${w.lastScore}` : 'Not scanned';
    const scoreColor = w.lastScore !== null ? getScoreColor(w.lastScore) : '#64748b';
    
    // Calculate trend
    const scores = trendData[w.domain] || [];
    let trendIcon = '', trendClass = '', trendLabel = '';
    if (scores.length >= 2) {
      const first = scores[0];
      const last = scores[scores.length - 1];
      const diff = last - first;
      if (diff > 3) {
        trendIcon = '📈'; trendClass = 'trend-up'; trendLabel = `+${diff} over ${scores.length} scans`;
      } else if (diff < -3) {
        trendIcon = '📉'; trendClass = 'trend-down'; trendLabel = `${diff} over ${scores.length} scans`;
      } else {
        trendIcon = '➡️'; trendClass = 'trend-stable'; trendLabel = `Stable over ${scores.length} scans`;
      }
    }
    
    const trendHtml = trendIcon ? `<span class="watchlist-trend ${trendClass}" title="${trendLabel}">${trendIcon}</span>` : '';
    const miniChartHtml = scores.length >= 2 ? `<span class="watchlist-sparkline" data-scores="${scores.join(',')}" data-domain="${w.domain}"></span>` : '';
    
    return `
      <div class="watchlist-item" data-domain="${w.domain}">
        <span class="watchlist-domain">${w.domain}</span>
        ${trendHtml}
        ${miniChartHtml}
        <span class="watchlist-threshold">↓${w.threshold}pts</span>
        <span class="watchlist-last-score" style="color:${scoreColor}">${scoreDisplay}</span>
        <button class="domain-remove" title="Remove">&times;</button>
      </div>
    `;
  }).join('');
  
  container.querySelectorAll('.domain-remove').forEach(btn => {
    btn.addEventListener('click', (e) => {
      removeWatchlistDomain(e.target.closest('.watchlist-item').dataset.domain);
    });
  });
  
  // Draw sparklines
  container.querySelectorAll('.watchlist-sparkline').forEach(el => {
    const scores = el.dataset.scores.split(',').map(Number);
    drawSparkline(el, scores);
  });
}

// ===== Domain Comparison =====
let lastComparisonData = null;

async function runDomainComparison() {
  const domainA = (document.getElementById('compareDomainA').value || '').toLowerCase().trim().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '');
  const domainB = (document.getElementById('compareDomainB').value || '').toLowerCase().trim().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '');
  
  if (!domainA || !domainB) {
    showSaveStatus('Please enter both domains');
    return;
  }
  if (domainA === domainB) {
    showSaveStatus('Please enter two different domains');
    return;
  }
  
  const btn = document.getElementById('runComparison');
  const progress = document.getElementById('comparisonProgress');
  btn.disabled = true;
  btn.textContent = '⏳ Analyzing...';
  progress.textContent = 'Scanning domain A...';
  
  let resultA, resultB;
  try {
    resultA = await scanSingleDomain(domainA);
    progress.textContent = 'Scanning domain B...';
    resultB = await scanSingleDomain(domainB);
  } catch (e) {
    showSaveStatus('Comparison failed');
    btn.disabled = false;
    btn.textContent = '⚔️ Compare Domains';
    progress.textContent = '';
    return;
  }
  
  btn.disabled = false;
  btn.textContent = '⚔️ Compare Domains';
  progress.textContent = '';
  
  lastComparisonData = { domainA, resultA, domainB, resultB, timestamp: Date.now() };
  renderComparison(domainA, resultA, domainB, resultB);
  drawHistoricalComparison(domainA, domainB);
}

function renderComparison(domainA, resultA, domainB, resultB) {
  const container = document.getElementById('comparisonResults');
  container.style.display = '';
  
  // Show export buttons
  document.getElementById('comparisonExportActions').style.display = '';
  
  // Update headers
  document.getElementById('compareHeaderA').textContent = domainA;
  document.getElementById('compareHeaderB').textContent = domainB;
  
  // Cards
  const cardA = document.getElementById('compareCardA');
  const cardB = document.getElementById('compareCardB');
  
  cardA.innerHTML = renderCompCard(domainA, resultA);
  cardB.innerHTML = renderCompCard(domainB, resultB);
  
  // Highlight winner
  if (resultA.score > resultB.score) {
    cardA.style.borderColor = '#22c55e';
    cardB.style.borderColor = 'var(--border-color)';
  } else if (resultB.score > resultA.score) {
    cardB.style.borderColor = '#22c55e';
    cardA.style.borderColor = 'var(--border-color)';
  } else {
    cardA.style.borderColor = '#facc15';
    cardB.style.borderColor = '#facc15';
  }
  
  // Table
  const tbody = document.getElementById('comparisonTableBody');
  const ratingA = getRating(resultA.score);
  const ratingB = getRating(resultB.score);
  
  tbody.innerHTML = `
    <tr><td>Trust Score</td><td style="color:${getScoreColor(resultA.score)};font-weight:700;font-size:16px">${resultA.score}</td><td style="color:${getScoreColor(resultB.score)};font-weight:700;font-size:16px">${resultB.score}</td></tr>
    <tr><td>Rating</td><td>${ratingA}</td><td>${ratingB}</td></tr>
    <tr><td>Threats Found</td><td style="color:${resultA.threats.length > 0 ? '#ef4444' : '#22c55e'}">${resultA.threats.length}</td><td style="color:${resultB.threats.length > 0 ? '#ef4444' : '#22c55e'}">${resultB.threats.length}</td></tr>
    <tr><td>Threat Details</td><td style="font-size:11px">${resultA.threats.length > 0 ? resultA.threats.join(', ') : 'None'}</td><td style="font-size:11px">${resultB.threats.length > 0 ? resultB.threats.join(', ') : 'None'}</td></tr>
    <tr><td>Analysis Source</td><td style="font-size:11px">${resultA.source}</td><td style="font-size:11px">${resultB.source}</td></tr>
  `;
  
  // Verdict
  const verdict = document.getElementById('comparisonVerdict');
  if (resultA.score > resultB.score) {
    verdict.className = 'comparison-verdict winner-a';
    verdict.innerHTML = `🏆 <strong>${domainA}</strong> is more trustworthy (score: ${resultA.score} vs ${resultB.score})`;
  } else if (resultB.score > resultA.score) {
    verdict.className = 'comparison-verdict winner-b';
    verdict.innerHTML = `🏆 <strong>${domainB}</strong> is more trustworthy (score: ${resultB.score} vs ${resultA.score})`;
  } else {
    verdict.className = 'comparison-verdict tie';
    verdict.innerHTML = `🤝 Both domains have the same trust score (${resultA.score})`;
  }
}

function renderCompCard(domain, result) {
  const color = getScoreColor(result.score);
  const rating = getRating(result.score);
  return `
    <div class="comp-domain">${domain}</div>
    <div class="comp-score" style="color:${color}">${result.score}</div>
    <div class="comp-risk" style="color:${color}">${rating}</div>
    <div class="comp-threats">${result.threats.length > 0 ? `⚠️ ${result.threats.length} threat${result.threats.length > 1 ? 's' : ''} detected` : '✅ No threats detected'}</div>
  `;
}

// ===== Comparison Export Functions =====
function exportComparisonPNG() {
  if (!lastComparisonData) { showSaveStatus('No comparison data to export'); return; }
  
  const { domainA, resultA, domainB, resultB, timestamp } = lastComparisonData;
  const canvas = document.createElement('canvas');
  const w = 800, h = 500;
  canvas.width = w * 2;
  canvas.height = h * 2;
  const ctx = canvas.getContext('2d');
  ctx.scale(2, 2);
  
  // Background
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, w, h);
  
  // Title
  ctx.fillStyle = '#f1f5f9';
  ctx.font = 'bold 22px system-ui';
  ctx.textAlign = 'center';
  ctx.fillText('⚔️ TrustGuard Domain Comparison', w / 2, 35);
  
  ctx.font = '12px system-ui';
  ctx.fillStyle = '#94a3b8';
  ctx.fillText(`Generated: ${new Date(timestamp).toLocaleString()}`, w / 2, 55);
  
  // Domain A Card
  const cardY = 80;
  drawCompCardOnCanvas(ctx, 40, cardY, 340, 160, domainA, resultA);
  
  // VS
  ctx.fillStyle = '#2dd4bf';
  ctx.font = 'bold 24px system-ui';
  ctx.textAlign = 'center';
  ctx.fillText('VS', w / 2, cardY + 85);
  
  // Domain B Card
  drawCompCardOnCanvas(ctx, 420, cardY, 340, 160, domainB, resultB);
  
  // Comparison Table
  const tableY = 260;
  const rows = [
    ['Metric', domainA, domainB],
    ['Trust Score', resultA.score.toString(), resultB.score.toString()],
    ['Rating', getRating(resultA.score), getRating(resultB.score)],
    ['Threats', resultA.threats.length.toString(), resultB.threats.length.toString()],
    ['Source', resultA.source, resultB.source],
  ];
  
  const colWidths = [180, 270, 270];
  const rowH = 28;
  let tx = 40;
  
  rows.forEach((row, ri) => {
    const y = tableY + ri * rowH;
    let cx = tx;
    
    row.forEach((cell, ci) => {
      // Background
      ctx.fillStyle = ri === 0 ? '#1e293b' : (ri % 2 === 0 ? 'rgba(30,41,59,0.5)' : 'rgba(15,23,42,0.5)');
      ctx.fillRect(cx, y, colWidths[ci], rowH);
      
      // Border
      ctx.strokeStyle = 'rgba(148,163,184,0.15)';
      ctx.strokeRect(cx, y, colWidths[ci], rowH);
      
      // Text
      ctx.fillStyle = ri === 0 ? '#f1f5f9' : (ci === 0 ? '#94a3b8' : '#e2e8f0');
      ctx.font = ri === 0 ? 'bold 11px system-ui' : '12px system-ui';
      ctx.textAlign = ci === 0 ? 'left' : 'center';
      const textX = ci === 0 ? cx + 10 : cx + colWidths[ci] / 2;
      
      // Color scores
      if (ri === 1 && ci > 0) {
        const score = ci === 1 ? resultA.score : resultB.score;
        ctx.fillStyle = getScoreColor(score);
        ctx.font = 'bold 14px system-ui';
      }
      
      ctx.fillText(cell, textX, y + 18);
      cx += colWidths[ci];
    });
  });
  
  // Verdict
  const verdictY = tableY + rows.length * rowH + 20;
  let verdictText, verdictColor;
  if (resultA.score > resultB.score) {
    verdictText = `🏆 ${domainA} is more trustworthy (${resultA.score} vs ${resultB.score})`;
    verdictColor = '#22c55e';
  } else if (resultB.score > resultA.score) {
    verdictText = `🏆 ${domainB} is more trustworthy (${resultB.score} vs ${resultA.score})`;
    verdictColor = '#22c55e';
  } else {
    verdictText = `🤝 Both domains scored ${resultA.score}`;
    verdictColor = '#facc15';
  }
  
  ctx.fillStyle = verdictColor + '15';
  ctx.beginPath();
  ctx.roundRect(40, verdictY, w - 80, 36, 8);
  ctx.fill();
  ctx.strokeStyle = verdictColor + '40';
  ctx.stroke();
  
  ctx.fillStyle = verdictColor;
  ctx.font = 'bold 13px system-ui';
  ctx.textAlign = 'center';
  ctx.fillText(verdictText, w / 2, verdictY + 22);
  
  // Footer
  ctx.fillStyle = '#475569';
  ctx.font = '10px system-ui';
  ctx.fillText('TrustGuard Security Extension — Domain Comparison Report', w / 2, h - 12);
  
  // Download
  const link = document.createElement('a');
  link.download = `trustguard-comparison-${domainA}-vs-${domainB}-${new Date().toISOString().split('T')[0]}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
  showSaveStatus('Comparison exported as PNG!');
}

function drawCompCardOnCanvas(ctx, x, y, w, h, domain, result) {
  const color = getScoreColor(result.score);
  const isWinner = lastComparisonData && (
    (result === lastComparisonData.resultA && result.score > lastComparisonData.resultB.score) ||
    (result === lastComparisonData.resultB && result.score > lastComparisonData.resultA.score)
  );
  
  // Card background
  ctx.fillStyle = 'rgba(30, 41, 59, 0.8)';
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 12);
  ctx.fill();
  
  ctx.strokeStyle = isWinner ? '#22c55e' : 'rgba(148,163,184,0.2)';
  ctx.lineWidth = isWinner ? 2 : 1;
  ctx.stroke();
  ctx.lineWidth = 1;
  
  // Domain name
  ctx.fillStyle = '#f1f5f9';
  ctx.font = 'bold 14px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(domain, x + w / 2, y + 30);
  
  // Score
  ctx.fillStyle = color;
  ctx.font = 'bold 48px system-ui';
  ctx.fillText(result.score.toString(), x + w / 2, y + 85);
  
  // Rating
  ctx.font = 'bold 12px system-ui';
  ctx.fillText(getRating(result.score).toUpperCase(), x + w / 2, y + 105);
  
  // Threats
  ctx.fillStyle = result.threats.length > 0 ? '#ef4444' : '#22c55e';
  ctx.font = '11px system-ui';
  ctx.fillText(
    result.threats.length > 0 ? `⚠️ ${result.threats.length} threat${result.threats.length > 1 ? 's' : ''}` : '✅ No threats',
    x + w / 2, y + 130
  );
  
  // Threat list
  if (result.threats.length > 0) {
    ctx.fillStyle = '#94a3b8';
    ctx.font = '9px system-ui';
    ctx.fillText(result.threats.slice(0, 3).join(' · '), x + w / 2, y + 148);
  }
}

function exportComparisonPDF() {
  if (!lastComparisonData) { showSaveStatus('No comparison data to export'); return; }
  
  const { domainA, resultA, domainB, resultB, timestamp } = lastComparisonData;
  const ratingA = getRating(resultA.score);
  const ratingB = getRating(resultB.score);
  const colorA = getScoreColor(resultA.score);
  const colorB = getScoreColor(resultB.score);
  
  let verdictHtml;
  if (resultA.score > resultB.score) {
    verdictHtml = `<div style="background:rgba(34,197,94,0.1);border:1px solid rgba(34,197,94,0.3);color:#22c55e;padding:16px;border-radius:10px;text-align:center;font-weight:700">🏆 ${domainA} is more trustworthy (score: ${resultA.score} vs ${resultB.score})</div>`;
  } else if (resultB.score > resultA.score) {
    verdictHtml = `<div style="background:rgba(34,197,94,0.1);border:1px solid rgba(34,197,94,0.3);color:#22c55e;padding:16px;border-radius:10px;text-align:center;font-weight:700">🏆 ${domainB} is more trustworthy (score: ${resultB.score} vs ${resultA.score})</div>`;
  } else {
    verdictHtml = `<div style="background:rgba(250,204,21,0.1);border:1px solid rgba(250,204,21,0.3);color:#facc15;padding:16px;border-radius:10px;text-align:center;font-weight:700">🤝 Both domains scored ${resultA.score}</div>`;
  }
  
  const html = `<!DOCTYPE html><html><head><title>TrustGuard Comparison: ${domainA} vs ${domainB}</title>
<style>
body{font-family:system-ui,sans-serif;background:#0f172a;color:#e2e8f0;padding:40px;max-width:900px;margin:auto}
h1{color:#2dd4bf;text-align:center}
.subtitle{text-align:center;color:#94a3b8;font-size:13px;margin-bottom:32px}
.cards{display:grid;grid-template-columns:1fr auto 1fr;gap:16px;align-items:center;margin-bottom:28px}
.card{background:rgba(30,41,59,0.8);border:1px solid rgba(148,163,184,0.2);border-radius:12px;padding:24px;text-align:center}
.card.winner{border-color:#22c55e;border-width:2px}
.domain{font-family:monospace;font-weight:700;font-size:15px;color:#f1f5f9;margin-bottom:8px}
.score{font-size:56px;font-weight:800;line-height:1}
.rating{font-size:12px;text-transform:uppercase;letter-spacing:1px;font-weight:600;margin-top:6px}
.threats-info{margin-top:12px;font-size:12px}
.vs{font-size:28px;font-weight:800;color:#2dd4bf;text-align:center}
table{width:100%;border-collapse:collapse;margin:24px 0}
th,td{padding:10px 14px;border:1px solid #334155;text-align:center;font-size:13px}
th{background:#1e293b;color:#f1f5f9;font-weight:600}
td:first-child{text-align:left;color:#94a3b8}
.footer{margin-top:36px;text-align:center;color:#475569;font-size:11px}
@media print{body{background:#fff;color:#1e293b}th{background:#f1f5f9;color:#0f172a}.card{background:#f8fafc;border-color:#e2e8f0}h1{color:#0d9488}}
</style></head><body>
<h1>⚔️ Domain Comparison Report</h1>
<p class="subtitle">Generated: ${new Date(timestamp).toLocaleString()}</p>

<div class="cards">
  <div class="card ${resultA.score > resultB.score ? 'winner' : ''}">
    <div class="domain">${domainA}</div>
    <div class="score" style="color:${colorA}">${resultA.score}</div>
    <div class="rating" style="color:${colorA}">${ratingA}</div>
    <div class="threats-info" style="color:${resultA.threats.length > 0 ? '#ef4444' : '#22c55e'}">${resultA.threats.length > 0 ? `⚠️ ${resultA.threats.length} threat${resultA.threats.length > 1 ? 's' : ''}: ${resultA.threats.join(', ')}` : '✅ No threats detected'}</div>
  </div>
  <div class="vs">VS</div>
  <div class="card ${resultB.score > resultA.score ? 'winner' : ''}">
    <div class="domain">${domainB}</div>
    <div class="score" style="color:${colorB}">${resultB.score}</div>
    <div class="rating" style="color:${colorB}">${ratingB}</div>
    <div class="threats-info" style="color:${resultB.threats.length > 0 ? '#ef4444' : '#22c55e'}">${resultB.threats.length > 0 ? `⚠️ ${resultB.threats.length} threat${resultB.threats.length > 1 ? 's' : ''}: ${resultB.threats.join(', ')}` : '✅ No threats detected'}</div>
  </div>
</div>

<table>
  <tr><th>Metric</th><th>${domainA}</th><th>${domainB}</th></tr>
  <tr><td>Trust Score</td><td style="color:${colorA};font-weight:700;font-size:18px">${resultA.score}</td><td style="color:${colorB};font-weight:700;font-size:18px">${resultB.score}</td></tr>
  <tr><td>Rating</td><td>${ratingA}</td><td>${ratingB}</td></tr>
  <tr><td>Threats Found</td><td style="color:${resultA.threats.length > 0 ? '#ef4444' : '#22c55e'}">${resultA.threats.length}</td><td style="color:${resultB.threats.length > 0 ? '#ef4444' : '#22c55e'}">${resultB.threats.length}</td></tr>
  <tr><td>Threat Details</td><td style="font-size:11px">${resultA.threats.length > 0 ? resultA.threats.join(', ') : 'None'}</td><td style="font-size:11px">${resultB.threats.length > 0 ? resultB.threats.join(', ') : 'None'}</td></tr>
  <tr><td>Analysis Source</td><td>${resultA.source}</td><td>${resultB.source}</td></tr>
</table>

${verdictHtml}

<div class="footer">
  <p>TrustGuard Security Extension — Automated Domain Comparison Report</p>
  <p>This report is generated from automated analysis and publicly available threat intelligence.</p>
</div>
</body></html>`;
  
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `trustguard-comparison-${domainA}-vs-${domainB}-${new Date().toISOString().split('T')[0]}.html`;
  a.click();
  URL.revokeObjectURL(url);
  showSaveStatus('Comparison report exported!');
}

function loadScheduledScanSettings() {
  chrome.storage.local.get(['scheduledScanEnabled', 'scheduledScanNotify', 'scheduledScanEmailNotify', 'notificationEmail', 'monitoredDomains', 'lastScheduledScan', 'scheduledScanHistory', 'scoreChangeAlerts', 'scoreDropThreshold', 'domainWatchlist', 'watchlistEmailAlerts'], (result) => {
    document.getElementById('scheduledScanEnabled').checked = result.scheduledScanEnabled ?? false;
    document.getElementById('scheduledScanNotify').checked = result.scheduledScanNotify ?? true;
    document.getElementById('scheduledScanEmailNotify').checked = result.scheduledScanEmailNotify ?? false;
    document.getElementById('emailInputGroup').style.display = result.scheduledScanEmailNotify ? '' : 'none';
    if (result.notificationEmail) document.getElementById('notificationEmail').value = result.notificationEmail;
    document.getElementById('scoreChangeAlerts').checked = result.scoreChangeAlerts ?? true;
    document.getElementById('watchlistEmailAlerts').checked = result.watchlistEmailAlerts ?? false;
    const dropThreshold = result.scoreDropThreshold ?? 15;
    document.getElementById('scoreDropThreshold').value = dropThreshold;
    document.getElementById('scoreDropThresholdValue').textContent = dropThreshold;
    renderMonitoredDomains(result.monitoredDomains || []);
    
    const scanHistory = result.scheduledScanHistory || [];
    renderWatchlist(result.domainWatchlist || [], scanHistory);
    
    // Sync unified notification panel
    const unifiedEmail = document.getElementById('unifiedEmailNotify');
    if (unifiedEmail) unifiedEmail.checked = result.scheduledScanEmailNotify ?? false;
    const unifiedEmailDetail = document.getElementById('unifiedEmailDetail');
    if (unifiedEmailDetail) unifiedEmailDetail.style.display = result.scheduledScanEmailNotify ? '' : 'none';
    const unifiedEmailInput = document.getElementById('unifiedNotificationEmail');
    if (unifiedEmailInput && result.notificationEmail) unifiedEmailInput.value = result.notificationEmail;
    const unifiedWatchlist = document.getElementById('unifiedWatchlistEmail');
    if (unifiedWatchlist) unifiedWatchlist.checked = result.watchlistEmailAlerts ?? false;
    const unifiedScoreChange = document.getElementById('unifiedScoreChangeAlerts');
    if (unifiedScoreChange) unifiedScoreChange.checked = result.scoreChangeAlerts ?? true;
    
    // Weekly alert digest
    const weeklyDigestToggle = document.getElementById('unifiedWeeklyAlertDigest');
    if (weeklyDigestToggle) weeklyDigestToggle.checked = result.weeklyAlertDigestEnabled ?? false;
    const weeklyDetail = document.getElementById('weeklyDigestDetail');
    if (weeklyDetail) weeklyDetail.style.display = result.weeklyAlertDigestEnabled ? '' : 'none';
    updateNextDigestDate();
    
    const last = result.lastScheduledScan;
    if (last) {
      document.getElementById('lastScheduledScan').textContent = new Date(last.timestamp).toLocaleString();
      document.getElementById('lastScheduledCount').textContent = last.domainsScanned || 0;
      document.getElementById('lastScheduledThreats').textContent = last.threatsFound || 0;
    }
    
    // Draw timeline chart and score changes
    drawScanHistoryTimeline(scanHistory);
    renderScoreChanges(scanHistory);
  });
}

function addMonitoredDomain(domain) {
  if (!domain) return;
  domain = domain.toLowerCase().trim().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '');
  if (!domain) return;
  
  chrome.storage.local.get(['monitoredDomains'], (result) => {
    const list = result.monitoredDomains || [];
    if (list.includes(domain)) { showSaveStatus(`${domain} already monitored`); return; }
    list.push(domain);
    chrome.storage.local.set({ monitoredDomains: list }, () => {
      renderMonitoredDomains(list);
      showSaveStatus(`${domain} added to monitoring`);
    });
  });
}

function removeMonitoredDomain(domain) {
  chrome.storage.local.get(['monitoredDomains'], (result) => {
    const list = (result.monitoredDomains || []).filter(d => d !== domain);
    chrome.storage.local.set({ monitoredDomains: list }, () => {
      renderMonitoredDomains(list);
      showSaveStatus(`${domain} removed`);
    });
  });
}

function renderMonitoredDomains(domains) {
  const container = document.getElementById('monitoredDomainItems');
  if (domains.length === 0) {
    container.innerHTML = '<span class="empty-list">No monitored domains yet</span>';
    return;
  }
  container.innerHTML = domains.map(d => `
    <div class="domain-item trusted" data-domain="${d}">
      <span>${d}</span>
      <button class="domain-remove" title="Remove">&times;</button>
    </div>
  `).join('');
  container.querySelectorAll('.domain-remove').forEach(btn => {
    btn.addEventListener('click', (e) => {
      removeMonitoredDomain(e.target.closest('.domain-item').dataset.domain);
    });
  });
}

// Bulk Scan Summary Charts
function drawBulkSummaryCharts(results) {
  if (results.length === 0) {
    document.getElementById('bulkSummaryChart').style.display = 'none';
    return;
  }
  document.getElementById('bulkSummaryChart').style.display = '';
  drawBulkScoreDistribution(results);
  drawBulkThreatTypes(results);
}

function drawBulkScoreDistribution(results) {
  const canvas = document.getElementById('bulkScoreChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  const buckets = [
    { label: '80-100', color: '#22c55e', count: results.filter(r => r.score >= 80).length },
    { label: '60-79', color: '#2dd4bf', count: results.filter(r => r.score >= 60 && r.score < 80).length },
    { label: '40-59', color: '#facc15', count: results.filter(r => r.score >= 40 && r.score < 60).length },
    { label: '20-39', color: '#fb923c', count: results.filter(r => r.score >= 20 && r.score < 40).length },
    { label: '0-19', color: '#ef4444', count: results.filter(r => r.score < 20).length },
  ];

  const maxCount = Math.max(...buckets.map(b => b.count), 1);
  const barW = 40, gap = 12, startX = 30;

  buckets.forEach((b, i) => {
    const x = startX + i * (barW + gap);
    const barH = Math.max((b.count / maxCount) * (h - 50), 3);
    const y = h - 30 - barH;
    
    ctx.fillStyle = b.color;
    ctx.beginPath();
    ctx.roundRect(x, y, barW, barH, 4);
    ctx.fill();
    
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '10px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText(b.label, x + barW / 2, h - 10);
    if (b.count > 0) ctx.fillText(b.count.toString(), x + barW / 2, y - 6);
  });
}

function drawBulkThreatTypes(results) {
  const canvas = document.getElementById('bulkThreatChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  const threatCounts = {};
  results.forEach(r => {
    (r.threats || []).forEach(t => {
      const key = t.startsWith('URLhaus:') ? 'URLhaus' : t;
      threatCounts[key] = (threatCounts[key] || 0) + 1;
    });
  });

  const entries = Object.entries(threatCounts).sort((a, b) => b[1] - a[1]).slice(0, 6);
  
  if (entries.length === 0) {
    ctx.fillStyle = '#64748b';
    ctx.font = '13px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText('No threats detected ✓', w / 2, h / 2);
    return;
  }

  const colors = ['#ef4444', '#fb923c', '#facc15', '#2dd4bf', '#22d3ee', '#a78bfa'];
  const total = entries.reduce((s, e) => s + e[1], 0);
  let startAngle = -Math.PI / 2;
  const cx = w / 2 - 40, cy = h / 2, radius = 60;

  entries.forEach(([name, count], i) => {
    const sliceAngle = (count / total) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, radius, startAngle, startAngle + sliceAngle);
    ctx.fillStyle = colors[i % colors.length];
    ctx.fill();
    startAngle += sliceAngle;
  });

  // Legend
  ctx.font = '10px system-ui';
  ctx.textAlign = 'left';
  entries.forEach(([name, count], i) => {
    const ly = 20 + i * 16;
    const lx = w - 100;
    ctx.fillStyle = colors[i % colors.length];
    ctx.fillRect(lx, ly - 6, 8, 8);
    ctx.fillStyle = '#e2e8f0';
    ctx.fillText(`${name} (${count})`, lx + 12, ly + 1);
  });
}

// Load analytics data
function loadAnalytics() {
  chrome.storage.local.get(['analysisHistory'], (result) => {
    const history = result.analysisHistory || [];
    
    // Calculate stats
    const totalAnalyses = history.length;
    const avgScore = history.length > 0 
      ? Math.round(history.reduce((sum, h) => sum + (h.score || 0), 0) / history.length)
      : 0;
    const reliableCount = history.filter(h => h.score >= 70).length;
    const suspiciousCount = history.filter(h => h.score < 40).length;
    
    // Update stat cards
    document.getElementById('totalAnalyses').textContent = totalAnalyses;
    document.getElementById('avgScore').textContent = totalAnalyses > 0 ? avgScore : '--';
    document.getElementById('reliableCount').textContent = reliableCount;
    document.getElementById('suspiciousCount').textContent = suspiciousCount;
    
    // Update distribution bars
    updateDistributionBars(history);
    
    // Draw trend chart
    drawTrendChart(history);
  });
}

// Update distribution bars
function updateDistributionBars(history) {
  if (history.length === 0) return;
  
  const distribution = {
    reliable: history.filter(h => h.score >= 80).length,
    good: history.filter(h => h.score >= 60 && h.score < 80).length,
    questionable: history.filter(h => h.score >= 40 && h.score < 60).length,
    unreliable: history.filter(h => h.score >= 20 && h.score < 40).length,
    suspicious: history.filter(h => h.score < 20).length
  };
  
  const maxCount = Math.max(...Object.values(distribution), 1);
  const bars = document.querySelectorAll('.dist-bar');
  const types = ['reliable', 'good', 'questionable', 'unreliable', 'suspicious'];
  
  bars.forEach((bar, i) => {
    const count = distribution[types[i]] || 0;
    const height = Math.max((count / maxCount) * 100, 4);
    bar.style.height = `${height}px`;
    bar.title = `${count} analyses`;
  });
}

// Draw trend chart using canvas
function drawTrendChart(history) {
  const canvas = document.getElementById('trendChart');
  if (!canvas) return;
  
  const ctx = canvas.getContext('2d');
  const width = canvas.width;
  const height = canvas.height;
  
  // Clear canvas
  ctx.clearRect(0, 0, width, height);
  
  if (history.length === 0) {
    ctx.fillStyle = '#64748b';
    ctx.font = '14px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText('No data yet. Start analyzing pages!', width / 2, height / 2);
    return;
  }
  
  // Get last 30 days of data
  const now = Date.now();
  const thirtyDaysAgo = now - (30 * 24 * 60 * 60 * 1000);
  const recentHistory = history.filter(h => h.timestamp >= thirtyDaysAgo);
  
  // Group by day
  const dailyData = {};
  for (let i = 29; i >= 0; i--) {
    const date = new Date(now - (i * 24 * 60 * 60 * 1000));
    const key = date.toISOString().split('T')[0];
    dailyData[key] = { scores: [], date };
  }
  
  recentHistory.forEach(h => {
    const key = new Date(h.timestamp).toISOString().split('T')[0];
    if (dailyData[key]) {
      dailyData[key].scores.push(h.score);
    }
  });
  
  const days = Object.keys(dailyData).sort();
  const avgScores = days.map(day => {
    const scores = dailyData[day].scores;
    return scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
  });
  
  // Draw grid
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.1)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = (height / 4) * i;
    ctx.beginPath();
    ctx.moveTo(40, y);
    ctx.lineTo(width - 10, y);
    ctx.stroke();
  }
  
  // Draw y-axis labels
  ctx.fillStyle = '#64748b';
  ctx.font = '10px system-ui';
  ctx.textAlign = 'right';
  [100, 75, 50, 25, 0].forEach((val, i) => {
    ctx.fillText(val.toString(), 35, (height / 4) * i + 4);
  });
  
  // Draw line chart
  const padding = 50;
  const chartWidth = width - padding - 10;
  const stepX = chartWidth / (days.length - 1 || 1);
  
  // Draw data points and line
  ctx.beginPath();
  let firstPoint = true;
  
  avgScores.forEach((score, i) => {
    if (score !== null) {
      const x = padding + (i * stepX);
      const y = height - (score / 100) * height;
      
      if (firstPoint) {
        ctx.moveTo(x, y);
        firstPoint = false;
      } else {
        ctx.lineTo(x, y);
      }
    }
  });
  
  ctx.strokeStyle = '#2dd4bf';
  ctx.lineWidth = 2;
  ctx.stroke();
  
  // Draw points
  avgScores.forEach((score, i) => {
    if (score !== null) {
      const x = padding + (i * stepX);
      const y = height - (score / 100) * height;
      
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fillStyle = getScoreColor(score);
      ctx.fill();
    }
  });
  
  // Draw x-axis labels (every 5 days)
  ctx.fillStyle = '#64748b';
  ctx.font = '9px system-ui';
  ctx.textAlign = 'center';
  days.forEach((day, i) => {
    if (i % 5 === 0 || i === days.length - 1) {
      const x = padding + (i * stepX);
      const label = new Date(day).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      ctx.fillText(label, x, height - 5);
    }
  });
}

// Score Change Detection
function detectScoreChanges(history) {
  const changes = [];
  if (history.length < 2) return changes;
  
  const latest = history[history.length - 1];
  const previous = history[history.length - 2];
  
  if (!latest.results || !previous.results) return changes;
  
  latest.results.forEach(current => {
    const prev = previous.results.find(r => r.domain === current.domain);
    if (prev && prev.score >= 0 && current.score >= 0) {
      const drop = prev.score - current.score;
      if (drop !== 0) {
        changes.push({
          domain: current.domain,
          previousScore: prev.score,
          currentScore: current.score,
          change: -drop,
          timestamp: latest.timestamp
        });
      }
    }
  });
  
  return changes.sort((a, b) => a.change - b.change); // Most negative first
}

function renderScoreChanges(history) {
  const container = document.getElementById('scoreChangeList');
  if (!container) return;
  
  const changes = detectScoreChanges(history);
  
  chrome.storage.local.get(['scoreDropThreshold'], (result) => {
    const threshold = result.scoreDropThreshold ?? 15;
    const significant = changes.filter(c => Math.abs(c.change) >= threshold);
    
    if (changes.length === 0) {
      container.innerHTML = '<span class="empty-list">No score changes detected yet. Run at least 2 scans.</span>';
      return;
    }
    
    container.innerHTML = changes.map(c => {
      const isSignificant = Math.abs(c.change) >= threshold;
      const isDropping = c.change < 0;
      const arrow = c.change > 0 ? '↑' : c.change < 0 ? '↓' : '→';
      const changeClass = isDropping ? (isSignificant ? 'score-drop-critical' : 'score-drop') : 'score-rise';
      
      return `
        <div class="score-change-item ${changeClass} ${isSignificant ? 'significant' : ''}">
          <span class="score-change-domain">${c.domain}</span>
          <span class="score-change-arrow ${changeClass}">${arrow} ${Math.abs(c.change)} pts</span>
          <span class="score-change-scores">${c.previousScore} → ${c.currentScore}</span>
        </div>
      `;
    }).join('');
  });
}

// Timeline Export Functions
function exportTimelinePNG() {
  const canvas = document.getElementById('timelineChart');
  if (!canvas) return;
  
  // Create a temporary canvas with white background for export
  const exportCanvas = document.createElement('canvas');
  exportCanvas.width = canvas.width * 2;
  exportCanvas.height = canvas.height * 2;
  const ctx = exportCanvas.getContext('2d');
  
  // Background
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
  
  // Title
  ctx.fillStyle = '#f1f5f9';
  ctx.font = 'bold 24px system-ui';
  ctx.textAlign = 'center';
  ctx.fillText('TrustGuard - Score History Timeline', exportCanvas.width / 2, 30);
  
  // Date
  ctx.font = '14px system-ui';
  ctx.fillStyle = '#94a3b8';
  ctx.fillText(`Generated: ${new Date().toLocaleString()}`, exportCanvas.width / 2, 52);
  
  // Scale and draw the original chart
  ctx.save();
  ctx.translate(0, 60);
  ctx.scale(2, 2);
  ctx.drawImage(canvas, 0, 0);
  ctx.restore();
  
  // Download
  const link = document.createElement('a');
  link.download = `trustguard-timeline-${new Date().toISOString().split('T')[0]}.png`;
  link.href = exportCanvas.toDataURL('image/png');
  link.click();
  showSaveStatus('Timeline exported as PNG!');
}

function exportTimelinePDF() {
  chrome.storage.local.get(['scheduledScanHistory', 'scoreDropThreshold'], (result) => {
    const history = result.scheduledScanHistory || [];
    const threshold = result.scoreDropThreshold ?? 15;
    
    if (history.length === 0) {
      showSaveStatus('No scan history to export');
      return;
    }
    
    const changes = detectScoreChanges(history);
    const significantDrops = changes.filter(c => c.change < -threshold);
    
    // Build HTML-based report
    const latest = history[history.length - 1];
    const allDomains = new Set();
    history.forEach(s => (s.results || []).forEach(r => allDomains.add(r.domain)));
    
    let tableRows = '';
    allDomains.forEach(domain => {
      const scores = history.map(s => {
        const r = (s.results || []).find(x => x.domain === domain);
        return r ? r.score : '-';
      });
      const latestScore = scores[scores.length - 1];
      const color = latestScore === '-' ? '#64748b' : getScoreColor(typeof latestScore === 'number' ? latestScore : 50);
      tableRows += `<tr><td style="font-weight:bold">${domain}</td>${scores.map(s => `<td style="color:${typeof s === 'number' ? getScoreColor(s) : '#64748b'}">${s}</td>`).join('')}</tr>`;
    });
    
    const scanDates = history.map(s => new Date(s.timestamp).toLocaleDateString());
    
    let alertsHtml = '';
    if (significantDrops.length > 0) {
      alertsHtml = `<h2 style="color:#ef4444;margin-top:24px">⚠️ Significant Score Drops</h2><table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse;width:100%;margin-top:8px"><tr style="background:#1e293b;color:#f1f5f9"><th>Domain</th><th>Previous</th><th>Current</th><th>Change</th></tr>${significantDrops.map(c => `<tr><td>${c.domain}</td><td>${c.previousScore}</td><td style="color:#ef4444;font-weight:bold">${c.currentScore}</td><td style="color:#ef4444">↓ ${Math.abs(c.change)} pts</td></tr>`).join('')}</table>`;
    }
    
    const html = `<!DOCTYPE html><html><head><title>TrustGuard Timeline Report</title><style>body{font-family:system-ui,sans-serif;background:#0f172a;color:#e2e8f0;padding:40px;max-width:900px;margin:auto}h1{color:#2dd4bf}table{border-collapse:collapse;width:100%;margin:12px 0}th,td{padding:8px 12px;border:1px solid #334155;text-align:center}th{background:#1e293b;color:#f1f5f9}.footer{margin-top:32px;color:#64748b;font-size:12px;text-align:center}</style></head><body><h1>📈 TrustGuard Score History Report</h1><p>Generated: ${new Date().toLocaleString()}</p><p>Total scans: ${history.length} | Domains monitored: ${allDomains.size}</p><h2 style="margin-top:24px">Score Timeline</h2><table><tr style="background:#1e293b;color:#f1f5f9"><th>Domain</th>${scanDates.map(d => `<th>${d}</th>`).join('')}</tr>${tableRows}</table>${alertsHtml}<div class="footer"><p>TrustGuard Security Extension — Automated Threat Monitoring Report</p></div></body></html>`;
    
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `trustguard-timeline-report-${new Date().toISOString().split('T')[0]}.html`;
    a.click();
    URL.revokeObjectURL(url);
    showSaveStatus('Timeline report exported!');
  });
}

// Scan History Timeline
function drawScanHistoryTimeline(history) {
  const canvas = document.getElementById('timelineChart');
  const legend = document.getElementById('timelineLegend');
  if (!canvas || !legend) return;
  
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  legend.innerHTML = '';
  
  if (history.length === 0) {
    ctx.fillStyle = '#64748b';
    ctx.font = '13px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText('No scan history yet. Run a scheduled scan to see trends.', w / 2, h / 2);
    return;
  }
  
  // Collect all unique domains across scans
  const domainSet = new Set();
  history.forEach(scan => {
    (scan.results || []).forEach(r => domainSet.add(r.domain));
  });
  const domains = Array.from(domainSet).slice(0, 8); // Max 8 domains
  
  const colors = ['#2dd4bf', '#22d3ee', '#a78bfa', '#f472b6', '#fb923c', '#facc15', '#22c55e', '#ef4444'];
  const padding = { top: 20, right: 20, bottom: 35, left: 45 };
  const chartW = w - padding.left - padding.right;
  const chartH = h - padding.top - padding.bottom;
  
  // Build data: for each scan, get score per domain
  const scanCount = history.length;
  const stepX = scanCount > 1 ? chartW / (scanCount - 1) : chartW / 2;
  
  // Draw grid
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.1)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = padding.top + (chartH / 4) * i;
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(w - padding.right, y);
    ctx.stroke();
  }
  
  // Y-axis labels
  ctx.fillStyle = '#64748b';
  ctx.font = '10px system-ui';
  ctx.textAlign = 'right';
  [100, 75, 50, 25, 0].forEach((val, i) => {
    ctx.fillText(val.toString(), padding.left - 6, padding.top + (chartH / 4) * i + 4);
  });
  
  // X-axis labels
  ctx.textAlign = 'center';
  history.forEach((scan, i) => {
    const x = padding.left + (scanCount > 1 ? i * stepX : chartW / 2);
    const label = new Date(scan.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    // Show every label if few scans, otherwise every other
    if (scanCount <= 10 || i % Math.ceil(scanCount / 10) === 0 || i === scanCount - 1) {
      ctx.fillText(label, x, h - 8);
    }
  });
  
  // Draw lines per domain
  domains.forEach((domain, di) => {
    const color = colors[di % colors.length];
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    
    let started = false;
    history.forEach((scan, si) => {
      const entry = (scan.results || []).find(r => r.domain === domain);
      if (!entry || entry.score < 0) return;
      
      const x = padding.left + (scanCount > 1 ? si * stepX : chartW / 2);
      const y = padding.top + chartH - (entry.score / 100) * chartH;
      
      if (!started) { ctx.moveTo(x, y); started = true; }
      else { ctx.lineTo(x, y); }
    });
    ctx.stroke();
    
    // Draw dots
    history.forEach((scan, si) => {
      const entry = (scan.results || []).find(r => r.domain === domain);
      if (!entry || entry.score < 0) return;
      
      const x = padding.left + (scanCount > 1 ? si * stepX : chartW / 2);
      const y = padding.top + chartH - (entry.score / 100) * chartH;
      
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
    });
    
    // Legend
    legend.innerHTML += `<div class="timeline-legend-item"><span class="timeline-legend-dot" style="background:${color}"></span>${domain}</div>`;
  });
}

// ===== Historical Comparison =====
function drawHistoricalComparison(domainA, domainB) {
  chrome.storage.local.get(['scheduledScanHistory'], (result) => {
    const history = result.scheduledScanHistory || [];
    const container = document.getElementById('historicalComparison');
    const canvas = document.getElementById('historicalCompChart');
    const legend = document.getElementById('historicalCompLegend');
    if (!container || !canvas || !legend) return;
    
    // Extract scores for both domains across scans
    const scansWithData = history.filter(scan => {
      const results = scan.results || [];
      return results.some(r => r.domain === domainA) || results.some(r => r.domain === domainB);
    });
    
    if (scansWithData.length === 0) {
      container.style.display = 'none';
      return;
    }
    
    container.style.display = '';
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    const isLight = document.body.classList.contains('light-theme');
    ctx.clearRect(0, 0, w, h);
    
    const padding = { top: 20, right: 20, bottom: 35, left: 45 };
    const chartW = w - padding.left - padding.right;
    const chartH = h - padding.top - padding.bottom;
    const scanCount = scansWithData.length;
    const stepX = scanCount > 1 ? chartW / (scanCount - 1) : chartW / 2;
    
    // Grid
    ctx.strokeStyle = isLight ? 'rgba(100, 116, 139, 0.15)' : 'rgba(148, 163, 184, 0.1)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = padding.top + (chartH / 4) * i;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(w - padding.right, y);
      ctx.stroke();
    }
    
    // Y-axis labels
    ctx.fillStyle = isLight ? '#475569' : '#64748b';
    ctx.font = '10px system-ui';
    ctx.textAlign = 'right';
    [100, 75, 50, 25, 0].forEach((val, i) => {
      ctx.fillText(val.toString(), padding.left - 6, padding.top + (chartH / 4) * i + 4);
    });
    
    // X-axis labels
    ctx.textAlign = 'center';
    scansWithData.forEach((scan, i) => {
      const x = padding.left + (scanCount > 1 ? i * stepX : chartW / 2);
      const label = new Date(scan.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      if (scanCount <= 10 || i % Math.ceil(scanCount / 10) === 0 || i === scanCount - 1) {
        ctx.fillText(label, x, h - 8);
      }
    });
    
    // Draw lines for each domain
    const domains = [
      { name: domainA, color: '#2dd4bf' },
      { name: domainB, color: '#f472b6' }
    ];
    
    domains.forEach(({ name, color }) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      let started = false;
      
      scansWithData.forEach((scan, si) => {
        const entry = (scan.results || []).find(r => r.domain === name);
        if (!entry) return;
        const x = padding.left + (scanCount > 1 ? si * stepX : chartW / 2);
        const y = padding.top + chartH - (entry.score / 100) * chartH;
        if (!started) { ctx.moveTo(x, y); started = true; }
        else { ctx.lineTo(x, y); }
      });
      ctx.stroke();
      
      // Dots
      scansWithData.forEach((scan, si) => {
        const entry = (scan.results || []).find(r => r.domain === name);
        if (!entry) return;
        const x = padding.left + (scanCount > 1 ? si * stepX : chartW / 2);
        const y = padding.top + chartH - (entry.score / 100) * chartH;
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      });
    });
    
    // Legend
    legend.innerHTML = domains.map(d => 
      `<div class="timeline-legend-item"><span class="timeline-legend-dot" style="background:${d.color}"></span>${d.name}</div>`
    ).join('');
  });
}

// ===== Batch Watchlist Import/Export =====
function importWatchlistCSV() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.csv,.txt';
  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l && !l.startsWith('#'));
      
      // Detect and skip header row
      const firstLine = lines[0].toLowerCase();
      const startIdx = (firstLine.includes('domain') || firstLine.includes('threshold')) ? 1 : 0;
      
      const entries = [];
      for (let i = startIdx; i < lines.length; i++) {
        const parts = lines[i].split(/[,;\t]/).map(p => p.trim().replace(/^["']|["']$/g, ''));
        let domain = (parts[0] || '').toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '');
        if (!domain || !domain.includes('.')) continue;
        const threshold = parseInt(parts[1]) || 15;
        entries.push({ domain, threshold: Math.max(5, Math.min(50, threshold)) });
      }
      
      if (entries.length === 0) {
        showSaveStatus('No valid domains found in file');
        return;
      }
      
      chrome.storage.local.get(['domainWatchlist'], (result) => {
        const watchlist = result.domainWatchlist || [];
        let added = 0, updated = 0;
        entries.forEach(entry => {
          const existing = watchlist.find(w => w.domain === entry.domain);
          if (existing) {
            existing.threshold = entry.threshold;
            updated++;
          } else {
            watchlist.push({ domain: entry.domain, threshold: entry.threshold, lastScore: null, addedAt: Date.now() });
            added++;
          }
        });
        chrome.storage.local.set({ domainWatchlist: watchlist }, () => {
          renderWatchlist(watchlist);
          showSaveStatus(`Imported: ${added} added, ${updated} updated`);
          document.getElementById('batchImportStatus').textContent = `${added} added, ${updated} updated`;
        });
      });
    } catch (err) {
      showSaveStatus('Failed to parse CSV file');
    }
  };
  input.click();
}

function exportWatchlistCSV() {
  chrome.storage.local.get(['domainWatchlist'], (result) => {
    const watchlist = result.domainWatchlist || [];
    if (watchlist.length === 0) {
      showSaveStatus('No watchlist domains to export');
      return;
    }
    const header = 'domain,threshold,last_score,added_at';
    const rows = watchlist.map(w => 
      `"${w.domain}",${w.threshold},${w.lastScore ?? ''},${w.addedAt ? new Date(w.addedAt).toISOString() : ''}`
    );
    const csv = [header, ...rows].join('\n');
    downloadFile(csv, `trustguard-watchlist-${new Date().toISOString().split('T')[0]}.csv`, 'text/csv');
    showSaveStatus(`Exported ${watchlist.length} watchlist domains`);
  });
}

// ===== Sparkline for Watchlist Trend =====
function drawSparkline(container, scores) {
  const canvas = document.createElement('canvas');
  canvas.width = 60;
  canvas.height = 20;
  canvas.className = 'sparkline-canvas';
  container.appendChild(canvas);
  
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  const min = Math.min(...scores) - 5;
  const max = Math.max(...scores) + 5;
  const range = max - min || 1;
  const stepX = w / (scores.length - 1);
  
  // Determine color based on trend
  const diff = scores[scores.length - 1] - scores[0];
  let color = '#facc15'; // stable
  if (diff > 3) color = '#22c55e'; // up
  else if (diff < -3) color = '#ef4444'; // down
  
  ctx.beginPath();
  scores.forEach((s, i) => {
    const x = i * stepX;
    const y = h - ((s - min) / range) * (h - 4) - 2;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  
  // Draw last point
  const lastX = (scores.length - 1) * stepX;
  const lastY = h - ((scores[scores.length - 1] - min) / range) * (h - 4) - 2;
  ctx.beginPath();
  ctx.arc(lastX, lastY, 2, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
}
