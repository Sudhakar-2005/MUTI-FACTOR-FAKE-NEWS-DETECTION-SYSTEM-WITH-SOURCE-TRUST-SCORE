// TrustGuard Service Worker for Manifest V3

const API_URL = 'https://budnnhrplhvimsrvdhuc.supabase.co/functions/v1';

// Domain Reputation APIs
const REPUTATION_APIS = {
  urlhaus: 'https://urlhaus-api.abuse.ch/v1/url/',
  urlhausHost: 'https://urlhaus-api.abuse.ch/v1/host/',
  threatFox: 'https://threatfox-api.abuse.ch/api/v1/',
  openPhish: 'https://openphish.com/feed.txt',
  spamhaus: 'https://check.spamhaus.org/'
};

// Live threat feeds for real-time updates
const THREAT_FEEDS = {
  urlhausRecent: 'https://urlhaus-api.abuse.ch/v1/urls/recent/',
  threatFoxRecent: 'https://threatfox-api.abuse.ch/api/v1/',
  phishTank: 'https://data.phishtank.com/data/online-valid.json',
  emergingThreats: 'https://rules.emergingthreats.net/blockrules/compromised-ips.txt'
};

// Threat feed update interval (1 hour)
const THREAT_FEED_UPDATE_INTERVAL = 3600000;

// Local threat database
let localThreatDB = {
  maliciousDomains: new Set(),
  maliciousIPs: new Set(),
  phishingUrls: new Set(),
  lastUpdated: null,
  feedSources: {}
};

// Known malicious TLDs and suspicious patterns
const SUSPICIOUS_TLDS = ['.xyz', '.top', '.click', '.work', '.tk', '.ml', '.ga', '.cf', '.gq', '.buzz', '.loan'];
const SUSPICIOUS_PATTERNS = [
  /free.*gift/i, /win.*prize/i, /claim.*reward/i, /urgent.*action/i,
  /verify.*account/i, /suspended/i, /limited.*time/i, /act.*now/i
];

// Handle extension installation
chrome.runtime.onInstalled.addListener((details) => {
  const defaultSettings = {
    autoAnalyze: false,
    notificationsEnabled: true,
    soundEnabled: true,
    analysisHistory: [],
    alertThreshold: 40,
    whitelist: [],
    blacklist: [],
    syncEnabled: false,
    useReputationAPI: true
  };

  if (details.reason === 'install') {
    chrome.storage.local.set(defaultSettings);
    console.log('TrustGuard extension installed');
  } else if (details.reason === 'update') {
    chrome.storage.local.get(Object.keys(defaultSettings), (result) => {
      const updates = {};
      Object.keys(defaultSettings).forEach(key => {
        if (result[key] === undefined) updates[key] = defaultSettings[key];
      });
      if (Object.keys(updates).length > 0) {
        chrome.storage.local.set(updates);
      }
    });
    console.log('TrustGuard extension updated to version', chrome.runtime.getManifest().version);
  }
  
  // Initialize sync listener
  initSyncListener();
  
  // Initialize threat feeds
  initThreatFeeds();
  
  // Set up weekly alert digest alarm (every Monday ~9AM)
  chrome.alarms?.create('weeklyAlertDigest', { periodInMinutes: 10080 }); // 7 days
});

// Handle keyboard shortcuts
chrome.commands.onCommand.addListener(async (command) => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;
  
  switch (command) {
    case 'analyze-page':
      chrome.tabs.sendMessage(tab.id, { type: 'TRIGGER_ANALYSIS' });
      break;
    case 'toggle-overlay':
      chrome.tabs.sendMessage(tab.id, { type: 'TOGGLE_OVERLAY' });
      break;
  }
});

// Handle messages from popup or content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'ANALYZE_URL') {
    analyzeUrl(message.url, sender.tab?.id)
      .then(result => sendResponse({ success: true, data: result }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
  
  if (message.type === 'GET_ANALYSIS_HISTORY') {
    chrome.storage.local.get(['analysisHistory'], (result) => {
      sendResponse({ history: result.analysisHistory || [] });
    });
    return true;
  }
  
  if (message.type === 'SAVE_ANALYSIS') {
    saveAnalysis(message.analysis)
      .then(() => sendResponse({ success: true }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (message.type === 'CHECK_DOMAIN_LIST') {
    checkDomainList(message.domain).then(result => sendResponse(result));
    return true;
  }

  if (message.type === 'UPDATE_BADGE') {
    updateBadge(message.score, message.tabId);
    sendResponse({ success: true });
    return true;
  }

  if (message.type === 'CHECK_DOMAIN_REPUTATION') {
    checkDomainReputation(message.domain)
      .then(result => sendResponse({ success: true, data: result }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (message.type === 'SYNC_SETTINGS') {
    syncSettingsToCloud()
      .then(() => sendResponse({ success: true }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (message.type === 'LOAD_SYNC_SETTINGS') {
    loadSettingsFromCloud()
      .then(settings => sendResponse({ success: true, data: settings }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (message.type === 'TOGGLE_SYNC') {
    toggleSync(message.enabled)
      .then(() => sendResponse({ success: true }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (message.type === 'GET_FULL_THREAT_REPORT') {
    generateFullThreatReport(message.domain)
      .then(report => sendResponse({ success: true, data: report }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (message.type === 'GET_CACHED_THREAT_REPORT') {
    getCachedThreatReport(message.domain).then(report => sendResponse(report));
    return true;
  }

  if (message.type === 'UPDATE_THREAT_FEEDS') {
    updateThreatFeeds(true)
      .then(result => sendResponse({ success: true, data: result }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (message.type === 'GET_THREAT_FEED_STATUS') {
    getThreatFeedStatus().then(status => sendResponse(status));
    return true;
  }

  if (message.type === 'TOGGLE_SCHEDULED_SCAN') {
    chrome.storage.local.set({ scheduledScanEnabled: message.enabled });
    if (message.enabled) {
      chrome.alarms?.create('dailyBulkScan', { periodInMinutes: 1440 }); // 24 hours
    } else {
      chrome.alarms?.clear('dailyBulkScan');
    }
    sendResponse({ success: true });
    return true;
  }

  if (message.type === 'RUN_SCHEDULED_SCAN') {
    runScheduledBulkScan()
      .then(() => sendResponse({ success: true }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
    generatePDFReportData(message.domain)
      .then(data => sendResponse({ success: true, data }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (message.type === 'CHECK_LOCAL_THREAT_DB') {
    const result = checkLocalThreatDB(message.domain);
    sendResponse({ success: true, data: result });
    return true;
  }
});

// Check if domain is in whitelist or blacklist
async function checkDomainList(domain) {
  return new Promise((resolve) => {
    chrome.storage.local.get(['whitelist', 'blacklist'], (result) => {
      const whitelist = result.whitelist || [];
      const blacklist = result.blacklist || [];
      
      const normalizedDomain = domain.replace(/^www\./, '').toLowerCase();
      
      const isWhitelisted = whitelist.some(d => 
        normalizedDomain === d.toLowerCase() || normalizedDomain.endsWith('.' + d.toLowerCase())
      );
      const isBlacklisted = blacklist.some(d => 
        normalizedDomain === d.toLowerCase() || normalizedDomain.endsWith('.' + d.toLowerCase())
      );
      
      resolve({ isWhitelisted, isBlacklisted });
    });
  });
}

// Check domain reputation using multiple external APIs
async function checkDomainReputation(domain) {
  const reputation = {
    urlhaus: { status: 'pending', data: null },
    threatFox: { status: 'pending', data: null },
    heuristics: { status: 'pending', data: null },
    score: null,
    threats: [],
    riskLevel: 'unknown',
    checkTime: Date.now()
  };

  const checks = [];

  // Check 1: URLhaus (abuse.ch) - URL check
  checks.push(
    fetch(REPUTATION_APIS.urlhaus, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `url=https://${domain}/`
    })
    .then(async (res) => {
      if (res.ok) {
        const data = await res.json();
        if (data.query_status === 'ok') {
          reputation.urlhaus = { status: 'malicious', data };
          reputation.threats.push({
            source: 'URLhaus',
            type: data.threat || 'malware',
            severity: 'critical',
            confidence: 'high',
            description: `Known malware distribution URL (${data.threat || 'malware'})`,
            reference: data.urlhaus_reference || null,
            firstSeen: data.date_added || null
          });
        } else {
          reputation.urlhaus = { status: 'clean', data: null };
        }
      }
    })
    .catch(() => { reputation.urlhaus = { status: 'error', data: null }; })
  );

  // Check 2: URLhaus Host check
  checks.push(
    fetch(REPUTATION_APIS.urlhausHost, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `host=${domain}`
    })
    .then(async (res) => {
      if (res.ok) {
        const data = await res.json();
        if (data.query_status === 'ok' && data.url_count > 0) {
          reputation.threats.push({
            source: 'URLhaus Host',
            type: 'hosting_malware',
            severity: 'high',
            confidence: 'high',
            description: `Host has ${data.url_count} known malicious URLs`,
            urlCount: data.url_count,
            blacklists: data.blacklists || {}
          });
        }
      }
    })
    .catch(() => {})
  );

  // Check 3: ThreatFox IOC check
  checks.push(
    fetch(REPUTATION_APIS.threatFox, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: 'search_ioc', search_term: domain })
    })
    .then(async (res) => {
      if (res.ok) {
        const data = await res.json();
        if (data.query_status === 'ok' && data.data && data.data.length > 0) {
          reputation.threatFox = { status: 'malicious', data: data.data };
          data.data.forEach(ioc => {
            reputation.threats.push({
              source: 'ThreatFox',
              type: ioc.threat_type || 'ioc',
              severity: 'critical',
              confidence: 'high',
              description: `IOC: ${ioc.ioc_type} - ${ioc.malware_printable || 'Unknown malware'}`,
              malwareFamily: ioc.malware || null,
              reference: ioc.reference || null
            });
          });
        } else {
          reputation.threatFox = { status: 'clean', data: null };
        }
      }
    })
    .catch(() => { reputation.threatFox = { status: 'error', data: null }; })
  );

  // Check 4: Heuristic analysis (local, instant)
  const heuristicThreats = performHeuristicAnalysis(domain);
  if (heuristicThreats.length > 0) {
    reputation.heuristics = { status: 'suspicious', data: heuristicThreats };
    reputation.threats.push(...heuristicThreats);
  } else {
    reputation.heuristics = { status: 'clean', data: null };
  }

  // Wait for all API checks with timeout
  await Promise.race([
    Promise.allSettled(checks),
    new Promise(resolve => setTimeout(resolve, 5000)) // 5 second timeout
  ]);

  // Calculate final score and risk level
  const { score, riskLevel } = calculateThreatScore(reputation);
  reputation.score = score;
  reputation.riskLevel = riskLevel;

  // Cache the report
  await cacheThreatReport(domain, reputation);

  return reputation;
}

// Perform heuristic analysis on domain
function performHeuristicAnalysis(domain) {
  const threats = [];
  const lowerDomain = domain.toLowerCase();

  // Check suspicious TLDs
  const hasSuspiciousTLD = SUSPICIOUS_TLDS.some(tld => lowerDomain.endsWith(tld));
  if (hasSuspiciousTLD) {
    threats.push({
      source: 'Heuristic Analysis',
      type: 'suspicious_tld',
      severity: 'medium',
      confidence: 'medium',
      description: 'Domain uses a TLD commonly associated with malicious sites'
    });
  }

  // Check for typosquatting patterns
  const popularDomains = ['google', 'facebook', 'amazon', 'paypal', 'microsoft', 'apple', 'netflix', 'bank'];
  const typosquatPatterns = popularDomains.filter(brand => {
    const pattern = new RegExp(`${brand}[a-z0-9-]*\\.|[a-z0-9-]*${brand}[a-z0-9-]*\\.`, 'i');
    return pattern.test(lowerDomain) && !lowerDomain.includes(`${brand}.com`) && !lowerDomain.includes(`${brand}.`);
  });

  if (typosquatPatterns.length > 0) {
    threats.push({
      source: 'Heuristic Analysis',
      type: 'typosquatting',
      severity: 'high',
      confidence: 'medium',
      description: `Possible typosquatting of: ${typosquatPatterns.join(', ')}`
    });
  }

  // Check domain age indicators (excessive subdomains)
  const subdomainCount = domain.split('.').length - 2;
  if (subdomainCount >= 3) {
    threats.push({
      source: 'Heuristic Analysis',
      type: 'excessive_subdomains',
      severity: 'low',
      confidence: 'low',
      description: 'Excessive subdomain depth, often used to evade detection'
    });
  }

  // Check for IP address as domain
  const ipPattern = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/;
  if (ipPattern.test(domain)) {
    threats.push({
      source: 'Heuristic Analysis',
      type: 'ip_address_url',
      severity: 'medium',
      confidence: 'high',
      description: 'Direct IP address access instead of domain name'
    });
  }

  // Check for suspicious keywords in domain
  const suspiciousKeywords = ['login', 'signin', 'verify', 'secure', 'account', 'update', 'confirm', 'banking'];
  const hasKeyword = suspiciousKeywords.some(kw => lowerDomain.includes(kw));
  if (hasKeyword && !popularDomains.some(brand => lowerDomain.includes(brand + '.'))) {
    threats.push({
      source: 'Heuristic Analysis',
      type: 'phishing_keywords',
      severity: 'medium',
      confidence: 'low',
      description: 'Domain contains keywords commonly used in phishing attempts'
    });
  }

  return threats;
}

// Calculate threat score based on all findings
function calculateThreatScore(reputation) {
  let score = 100;
  let riskLevel = 'safe';

  reputation.threats.forEach(threat => {
    switch (threat.severity) {
      case 'critical':
        score -= 40;
        break;
      case 'high':
        score -= 25;
        break;
      case 'medium':
        score -= 15;
        break;
      case 'low':
        score -= 5;
        break;
    }

    // Adjust based on confidence
    if (threat.confidence === 'low') {
      score += 5; // Less penalty for low confidence
    }
  });

  score = Math.max(0, Math.min(100, score));

  if (score >= 80) riskLevel = 'safe';
  else if (score >= 60) riskLevel = 'low';
  else if (score >= 40) riskLevel = 'medium';
  else if (score >= 20) riskLevel = 'high';
  else riskLevel = 'critical';

  return { score, riskLevel };
}

// Generate full threat report
async function generateFullThreatReport(domain) {
  const reputation = await checkDomainReputation(domain);
  
  return {
    domain,
    generatedAt: new Date().toISOString(),
    overallScore: reputation.score,
    riskLevel: reputation.riskLevel,
    threatCount: reputation.threats.length,
    threats: reputation.threats,
    sources: {
      urlhaus: reputation.urlhaus.status,
      threatFox: reputation.threatFox.status,
      heuristics: reputation.heuristics.status
    },
    recommendations: generateRecommendations(reputation)
  };
}

// Generate recommendations based on threat report
function generateRecommendations(reputation) {
  const recommendations = [];

  if (reputation.riskLevel === 'critical' || reputation.riskLevel === 'high') {
    recommendations.push({
      priority: 'high',
      action: 'Avoid this site completely',
      reason: 'Multiple threat indicators detected from trusted security sources'
    });
    recommendations.push({
      priority: 'high',
      action: 'Do not enter any personal information',
      reason: 'High risk of data theft or malware infection'
    });
  }

  if (reputation.threats.some(t => t.type === 'typosquatting')) {
    recommendations.push({
      priority: 'medium',
      action: 'Verify you are on the correct website',
      reason: 'This domain may be impersonating a legitimate website'
    });
  }

  if (reputation.threats.some(t => t.type === 'malware' || t.type === 'hosting_malware')) {
    recommendations.push({
      priority: 'high',
      action: 'Run a malware scan on your device',
      reason: 'This site is known to distribute malware'
    });
  }

  if (reputation.riskLevel === 'medium') {
    recommendations.push({
      priority: 'medium',
      action: 'Proceed with caution',
      reason: 'Some suspicious indicators detected'
    });
  }

  if (recommendations.length === 0) {
    recommendations.push({
      priority: 'low',
      action: 'Site appears safe',
      reason: 'No significant threats detected'
    });
  }

  return recommendations;
}

// Cache threat report
async function cacheThreatReport(domain, report) {
  return new Promise((resolve) => {
    chrome.storage.local.get(['threatReportCache'], (result) => {
      const cache = result.threatReportCache || {};
      cache[domain] = {
        report,
        cachedAt: Date.now()
      };
      
      // Keep only last 50 cached reports
      const domains = Object.keys(cache);
      if (domains.length > 50) {
        const oldest = domains.sort((a, b) => cache[a].cachedAt - cache[b].cachedAt)[0];
        delete cache[oldest];
      }
      
      chrome.storage.local.set({ threatReportCache: cache }, resolve);
    });
  });
}

// Get cached threat report
async function getCachedThreatReport(domain) {
  return new Promise((resolve) => {
    chrome.storage.local.get(['threatReportCache'], (result) => {
      const cache = result.threatReportCache || {};
      const cached = cache[domain];
      
      // Cache valid for 1 hour
      if (cached && (Date.now() - cached.cachedAt) < 3600000) {
        resolve({ found: true, report: cached.report });
      } else {
        resolve({ found: false });
      }
    });
  });
}

// Analyze URL using the API
async function analyzeUrl(url, tabId) {
  try {
    // Check whitelist/blacklist first
    const domain = new URL(url).hostname.replace(/^www\./, '');
    const { isWhitelisted, isBlacklisted } = await checkDomainList(domain);
    
    if (isWhitelisted) {
      const result = {
        finalScore: 95,
        rating: 'reliable',
        scores: { text: 95, domain: 100, evidence: 90, sentiment: 95 },
        details: { whitelisted: true },
        whitelisted: true
      };
      await saveAnalysis({ url, score: 95, rating: 'reliable', timestamp: Date.now() });
      if (tabId) updateBadge(95, tabId);
      return result;
    }
    
    if (isBlacklisted) {
      const result = {
        finalScore: 15,
        rating: 'suspicious',
        scores: { text: 20, domain: 10, evidence: 15, sentiment: 15 },
        details: { blacklisted: true },
        blacklisted: true
      };
      await saveAnalysis({ url, score: 15, rating: 'suspicious', timestamp: Date.now() });
      if (tabId) updateBadge(15, tabId);
      return result;
    }

    // Check domain reputation if enabled
    let reputationData = null;
    const settings = await chrome.storage.local.get(['useReputationAPI']);
    if (settings.useReputationAPI !== false) {
      try {
        reputationData = await checkDomainReputation(domain);
        
        // If known threat detected, return immediately
        if (reputationData.threats.length > 0) {
          const result = {
            finalScore: 10,
            rating: 'suspicious',
            scores: { text: 20, domain: 5, evidence: 10, sentiment: 15 },
            details: { 
              threats: reputationData.threats,
              reputationScore: reputationData.score
            },
            threatDetected: true
          };
          await saveAnalysis({ url, score: 10, rating: 'suspicious', timestamp: Date.now(), threats: reputationData.threats });
          if (tabId) updateBadge(10, tabId);
          return result;
        }
      } catch (e) {
        console.log('Reputation check failed, continuing with standard analysis');
      }
    }

    const response = await fetch(`${API_URL}/analyze-api`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url })
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }

    const result = await response.json();
    
    if (result.success && result.data) {
      // Adjust score based on reputation data
      let adjustedScore = result.data.finalScore;
      if (reputationData && reputationData.score !== null) {
        adjustedScore = Math.round((result.data.finalScore * 0.7) + (reputationData.score * 0.3));
      }

      const finalResult = {
        ...result.data,
        finalScore: adjustedScore,
        reputationData
      };

      // Save to history
      await saveAnalysis({
        url,
        score: adjustedScore,
        rating: finalResult.rating,
        timestamp: Date.now()
      });
      
      // Update badge with threshold check
      if (tabId) {
        updateBadge(adjustedScore, tabId);
      }
      
      return finalResult;
    }
    
    throw new Error('Invalid API response');
  } catch (error) {
    console.error('Analysis error:', error);
    throw error;
  }
}

// Save analysis to local storage
async function saveAnalysis(analysis) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(['analysisHistory'], (result) => {
      const history = result.analysisHistory || [];
      
      // Add new analysis at the beginning
      history.unshift(analysis);
      
      // Keep only last 100 analyses
      const trimmedHistory = history.slice(0, 100);
      
      chrome.storage.local.set({ analysisHistory: trimmedHistory }, () => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve();
        }
      });
    });
  });
}

// Handle context menu
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus?.create({
    id: 'trustguard-analyze',
    title: 'Analyze with TrustGuard',
    contexts: ['page', 'link']
  });
  
  chrome.contextMenus?.create({
    id: 'trustguard-whitelist',
    title: 'Add to Trusted Sites',
    contexts: ['page']
  });
  
  chrome.contextMenus?.create({
    id: 'trustguard-blacklist',
    title: 'Add to Suspicious Sites',
    contexts: ['page']
  });
});

chrome.contextMenus?.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'trustguard-analyze') {
    const urlToAnalyze = info.linkUrl || info.pageUrl;
    chrome.action.openPopup?.().catch(() => {
      chrome.storage.local.set({ pendingAnalysisUrl: urlToAnalyze });
    });
  } else if (info.menuItemId === 'trustguard-whitelist') {
    addToList('whitelist', info.pageUrl);
  } else if (info.menuItemId === 'trustguard-blacklist') {
    addToList('blacklist', info.pageUrl);
  }
});

// Add domain to whitelist or blacklist
async function addToList(listType, url) {
  const domain = new URL(url).hostname.replace(/^www\./, '');
  
  chrome.storage.local.get([listType], (result) => {
    const list = result[listType] || [];
    if (!list.includes(domain)) {
      list.push(domain);
      chrome.storage.local.set({ [listType]: list }, () => {
        // Show notification
        if (chrome.notifications) {
          chrome.notifications.create({
            type: 'basic',
            iconUrl: 'icons/icon48.png',
            title: 'TrustGuard',
            message: `${domain} added to ${listType === 'whitelist' ? 'trusted' : 'suspicious'} sites`
          });
        }
      });
    }
  });
}

// Badge update based on score and threshold
function updateBadge(score, tabId) {
  chrome.storage.local.get(['alertThreshold', 'notificationsEnabled'], (result) => {
    const threshold = result.alertThreshold || 40;
    const notificationsEnabled = result.notificationsEnabled !== false;
    
    let color, text;
    
    if (score >= 80) {
      color = '#22c55e'; // Green - reliable
      text = '✓';
    } else if (score >= 60) {
      color = '#2dd4bf'; // Teal - generally ok
      text = score.toString();
    } else if (score >= threshold) {
      color = '#facc15'; // Yellow - questionable
      text = score.toString();
    } else if (score >= 20) {
      color = '#fb923c'; // Orange - below threshold
      text = '!';
    } else {
      color = '#ef4444'; // Red - very suspicious
      text = '!!';
    }
    
    const badgeOptions = { color };
    const textOptions = { text };
    
    if (tabId) {
      badgeOptions.tabId = tabId;
      textOptions.tabId = tabId;
    }
    
    chrome.action.setBadgeBackgroundColor(badgeOptions);
    chrome.action.setBadgeText(textOptions);
    
    // Show notification and play sound for low scores (with cooldown)
    if (score < threshold) {
      checkCooldown('browser').then(canFire => {
        if (canFire && notificationsEnabled && chrome.notifications) {
          chrome.notifications.create({
            type: 'basic',
            iconUrl: 'icons/icon48.png',
            title: 'TrustGuard Warning',
            message: `This page has a low trust score (${score}/100). Proceed with caution.`,
            priority: 2
          });
          recordCooldown('browser');
          logAlertDigest('browser', `Low score alert: ${score}/100`);
        }
      });
      // Trigger sound in content script (with cooldown)
      checkCooldown('sound').then(canFire => {
        chrome.storage.local.get(['soundEnabled'], (soundResult) => {
          if (canFire && soundResult.soundEnabled !== false && tabId) {
            chrome.tabs.sendMessage(tabId, { type: 'PLAY_ALERT_SOUND' }).catch(() => {});
            recordCooldown('sound');
            logAlertDigest('sound', `Sound alert for score ${score}/100`);
          }
        });
      });
    }
  });
}

// Clear badge when navigating to a new page
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'loading') {
    chrome.action.setBadgeText({ text: '', tabId });
  }
  
  // Auto-check on page load for blacklisted domains
  if (changeInfo.status === 'complete' && tab.url && !tab.url.startsWith('chrome')) {
    chrome.storage.local.get(['autoAnalyze'], async (result) => {
      if (result.autoAnalyze) {
        try {
          const domain = new URL(tab.url).hostname;
          const { isBlacklisted } = await checkDomainList(domain);
          if (isBlacklisted) {
            updateBadge(15, tabId);
          }
        } catch (e) {}
      }
    });
  }
});

// ============= Notification Cooldown & Digest Functions =============

// Check if a notification channel can fire based on cooldown
async function checkCooldown(channel) {
  return new Promise(resolve => {
    chrome.storage.local.get(['notificationCooldowns', 'notificationLastFired'], (result) => {
      const cooldowns = result.notificationCooldowns || { browser: 60, sound: 5, email: 60, watchlist: 360 };
      const lastFired = result.notificationLastFired || {};
      const cooldownMinutes = cooldowns[channel] || 0;
      
      if (cooldownMinutes === 0) { resolve(true); return; }
      
      const lastTime = lastFired[channel] || 0;
      const elapsed = (Date.now() - lastTime) / 60000; // minutes
      resolve(elapsed >= cooldownMinutes);
    });
  });
}

// Record that a notification channel just fired
function recordCooldown(channel) {
  chrome.storage.local.get(['notificationLastFired'], (result) => {
    const lastFired = result.notificationLastFired || {};
    lastFired[channel] = Date.now();
    chrome.storage.local.set({ notificationLastFired: lastFired });
  });
}

// Log an alert to the daily digest
function logAlertDigest(channel, message) {
  chrome.storage.local.get(['alertDigest'], (result) => {
    const digest = result.alertDigest || [];
    digest.unshift({ channel, message, timestamp: Date.now() });
    // Keep last 100 entries
    chrome.storage.local.set({ alertDigest: digest.slice(0, 100) });
  });
}

// ============= Chrome Sync Storage Functions =============

// Keys to sync across devices
const SYNC_KEYS = ['whitelist', 'blacklist', 'alertThreshold', 'autoAnalyze', 'notificationsEnabled', 'soundEnabled', 'showFloatingButton', 'useReputationAPI', 'theme'];

// Initialize sync listener
function initSyncListener() {
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'sync') {
      // Sync storage changed (from another device)
      chrome.storage.local.get(['syncEnabled'], (result) => {
        if (result.syncEnabled) {
          const updates = {};
          SYNC_KEYS.forEach(key => {
            if (changes[key]) {
              updates[key] = changes[key].newValue;
            }
          });
          if (Object.keys(updates).length > 0) {
            chrome.storage.local.set(updates, () => {
              console.log('Settings synced from another device:', Object.keys(updates));
              // Notify all tabs
              chrome.tabs.query({}, (tabs) => {
                tabs.forEach(tab => {
                  chrome.tabs.sendMessage(tab.id, { type: 'SETTINGS_SYNCED', settings: updates }).catch(() => {});
                });
              });
            });
          }
        }
      });
    }
  });
}

// Toggle sync on/off
async function toggleSync(enabled) {
  await chrome.storage.local.set({ syncEnabled: enabled });
  
  if (enabled) {
    // Push current settings to sync storage
    await syncSettingsToCloud();
    console.log('Sync enabled - settings pushed to cloud');
  } else {
    console.log('Sync disabled');
  }
}

// Sync settings to Chrome Sync storage
async function syncSettingsToCloud() {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(SYNC_KEYS, (result) => {
      const syncData = {};
      SYNC_KEYS.forEach(key => {
        if (result[key] !== undefined) {
          syncData[key] = result[key];
        }
      });
      
      // Add sync metadata
      syncData._lastSynced = Date.now();
      syncData._deviceId = getDeviceId();
      
      chrome.storage.sync.set(syncData, () => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          console.log('Settings synced to cloud');
          resolve();
        }
      });
    });
  });
}

// Load settings from Chrome Sync storage
async function loadSettingsFromCloud() {
  return new Promise((resolve, reject) => {
    chrome.storage.sync.get(null, (result) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      
      if (Object.keys(result).length === 0) {
        resolve(null);
        return;
      }
      
      // Apply synced settings to local storage
      const localUpdates = {};
      SYNC_KEYS.forEach(key => {
        if (result[key] !== undefined) {
          localUpdates[key] = result[key];
        }
      });
      
      chrome.storage.local.set(localUpdates, () => {
        console.log('Settings loaded from cloud');
        resolve({
          ...localUpdates,
          _lastSynced: result._lastSynced,
          _deviceId: result._deviceId
        });
      });
    });
  });
}

// Generate/get a unique device ID
function getDeviceId() {
  const stored = localStorage.getItem('trustguard_device_id');
  if (stored) return stored;
  
  const id = 'device_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
  localStorage.setItem('trustguard_device_id', id);
  return id;
}

// Get sync status info
async function getSyncStatus() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(['_lastSynced', '_deviceId'], (syncResult) => {
      chrome.storage.sync.getBytesInUse(null, (bytesInUse) => {
        resolve({
          lastSynced: syncResult._lastSynced ? new Date(syncResult._lastSynced).toLocaleString() : 'Never',
          lastDevice: syncResult._deviceId || 'Unknown',
          bytesUsed: bytesInUse,
          bytesLimit: chrome.storage.sync.QUOTA_BYTES
        });
      });
    });
  });
}

// ============= Real-time Threat Feed Functions =============

// Initialize threat feeds on startup
async function initThreatFeeds() {
  // Load cached threat data
  await loadCachedThreatDB();
  
  // Check if update is needed
  const settings = await chrome.storage.local.get(['liveThreatFeedsEnabled', 'lastThreatFeedUpdate']);
  
  if (settings.liveThreatFeedsEnabled !== false) {
    const lastUpdate = settings.lastThreatFeedUpdate || 0;
    const timeSinceUpdate = Date.now() - lastUpdate;
    
    if (timeSinceUpdate > THREAT_FEED_UPDATE_INTERVAL) {
      // Update feeds in background
      updateThreatFeeds(false).catch(err => console.log('Threat feed update failed:', err));
    }
    
    // Set up periodic updates using alarms
    chrome.alarms?.create('threatFeedUpdate', {
      periodInMinutes: 60 // Update every hour
    });
  }
}

// Listen for alarm to update threat feeds
chrome.alarms?.onAlarm.addListener((alarm) => {
  if (alarm.name === 'threatFeedUpdate') {
    chrome.storage.local.get(['liveThreatFeedsEnabled'], (result) => {
      if (result.liveThreatFeedsEnabled !== false) {
        updateThreatFeeds(false).catch(err => console.log('Scheduled threat feed update failed:', err));
      }
    });
  }
  if (alarm.name === 'dailyBulkScan') {
    runScheduledBulkScan();
  }
  if (alarm.name === 'weeklyAlertDigest') {
    sendWeeklyAlertDigest();
  }
});

// Scheduled bulk scan
async function runScheduledBulkScan() {
  const data = await new Promise(r => chrome.storage.local.get(['monitoredDomains', 'scheduledScanEnabled', 'scheduledScanNotify', 'useReputationAPI', 'domainWatchlist'], r));
  if (!data.scheduledScanEnabled) return;
  
  const domains = data.monitoredDomains || [];
  if (domains.length === 0) return;
  
  console.log(`Running scheduled scan for ${domains.length} domains`);
  const results = [];
  let threatsFound = 0;
  
  for (const domain of domains) {
    try {
      const result = await quickScanDomain(domain, data.useReputationAPI !== false);
      results.push({ domain, ...result });
      if (result.threats.length > 0) threatsFound++;
    } catch (e) {
      results.push({ domain, score: -1, threats: ['Scan failed'], source: 'error' });
    }
  }
  
  const scanResult = {
    timestamp: Date.now(),
    domainsScanned: domains.length,
    threatsFound,
    results
  };
  
  // Save scan history, detect score changes, and check watchlist
  chrome.storage.local.get(['scheduledScanHistory', 'scoreChangeAlerts', 'scoreDropThreshold', 'domainWatchlist'], (histResult) => {
    const history = histResult.scheduledScanHistory || [];
    const scoreChangeAlerts = histResult.scoreChangeAlerts ?? true;
    const dropThreshold = histResult.scoreDropThreshold ?? 15;
    const watchlist = histResult.domainWatchlist || [];
    
    // Detect score changes vs previous scan
    const scoreDrops = [];
    const watchlistAlerts = [];
    
    if (history.length > 0) {
      const prevScan = history[history.length - 1];
      results.forEach(current => {
        const prev = (prevScan.results || []).find(r => r.domain === current.domain);
        if (prev && prev.score >= 0 && current.score >= 0) {
          const drop = prev.score - current.score;
          
          // Global threshold check
          if (scoreChangeAlerts && drop >= dropThreshold) {
            scoreDrops.push({ domain: current.domain, previousScore: prev.score, currentScore: current.score, drop });
          }
          
          // Per-domain watchlist threshold check
          const watchEntry = watchlist.find(w => w.domain === current.domain);
          if (watchEntry && drop >= watchEntry.threshold) {
            watchlistAlerts.push({ domain: current.domain, previousScore: prev.score, currentScore: current.score, drop, threshold: watchEntry.threshold });
          }
        }
      });
    }
    
    // Update watchlist last scores
    const updatedWatchlist = watchlist.map(w => {
      const scanned = results.find(r => r.domain === w.domain);
      return scanned && scanned.score >= 0 ? { ...w, lastScore: scanned.score } : w;
    });
    
    history.push({
      timestamp: Date.now(),
      results: results.map(r => ({ domain: r.domain, score: r.score, threats: r.threats }))
    });
    // Keep last 30 scans
    chrome.storage.local.set({ 
      lastScheduledScan: scanResult,
      scheduledScanHistory: history.slice(-30),
      domainWatchlist: updatedWatchlist
    });
    
    // Notify about score drops (with cooldown)
    if (scoreDrops.length > 0) {
      checkCooldown('browser').then(canFire => {
        if (canFire) {
          const dropMessages = scoreDrops.map(d => `${d.domain}: ${d.previousScore}→${d.currentScore}`);
          chrome.notifications?.create('score-drop-alert-' + Date.now(), {
            type: 'basic',
            iconUrl: 'icons/icon128.png',
            title: `⚠️ ${scoreDrops.length} domain${scoreDrops.length > 1 ? 's' : ''} score dropped!`,
            message: dropMessages.slice(0, 3).join(', '),
            priority: 2
          });
          recordCooldown('browser');
          scoreDrops.forEach(d => logAlertDigest('browser', `Score drop: ${d.domain} ${d.previousScore}→${d.currentScore}`));
        }
      });
    }
    
    // Notify about watchlist-specific alerts (with cooldown)
    if (watchlistAlerts.length > 0) {
      checkCooldown('watchlist').then(canFire => {
        if (canFire) {
          watchlistAlerts.forEach(alert => {
            chrome.notifications?.create('watchlist-alert-' + alert.domain + '-' + Date.now(), {
              type: 'basic',
              iconUrl: 'icons/icon128.png',
              title: `👁️ Watchlist Alert: ${alert.domain}`,
              message: `Score dropped ${alert.drop} points (${alert.previousScore}→${alert.currentScore}). Your threshold: ${alert.threshold} pts.`,
              priority: 2
            });
            logAlertDigest('watchlist', `Watchlist: ${alert.domain} dropped ${alert.drop}pts`);
          });
          recordCooldown('watchlist');
        }
      });
      
      // Send email alerts for watchlist drops (with cooldown)
      checkCooldown('email').then(canFire => {
        if (canFire) {
          sendWatchlistEmailAlerts(watchlistAlerts)
            .then(() => {
              recordCooldown('email');
              watchlistAlerts.forEach(a => logAlertDigest('email', `Email: ${a.domain} score drop alert`));
            })
            .catch(e => console.log('Watchlist email alert failed:', e));
        }
      });
    }
    }
  });
  
  if (threatsFound > 0 && data.scheduledScanNotify !== false) {
    const threatDomains = results.filter(r => r.threats.length > 0).map(r => r.domain);
    checkCooldown('browser').then(canFire => {
      if (canFire) {
        chrome.notifications?.create('scheduled-scan-alert', {
          type: 'basic',
          iconUrl: 'icons/icon128.png',
          title: `TrustGuard: ${threatsFound} threat${threatsFound > 1 ? 's' : ''} detected`,
          message: `Daily scan found issues with: ${threatDomains.slice(0, 3).join(', ')}${threatDomains.length > 3 ? '...' : ''}`,
          priority: 2
        });
        recordCooldown('browser');
        logAlertDigest('browser', `Scan: ${threatsFound} threats in ${threatDomains.slice(0,3).join(', ')}`);
      }
    });
    
    // Send email notification (with cooldown)
    checkCooldown('email').then(canFire => {
      if (canFire) {
        sendScheduledScanEmail(scanResult, results)
          .then(() => {
            recordCooldown('email');
            logAlertDigest('email', `Email: scan report with ${threatsFound} threats`);
          })
          .catch(e => console.log('Email notification failed:', e));
      }
    });
  }
}

// Send email notification for scheduled scan results
async function sendScheduledScanEmail(scanResult, results) {
  const API_BASE = 'https://budnnhrplhvimsrvdhuc.supabase.co/functions/v1';
  const threatResults = results.filter(r => r.threats.length > 0);
  
  // Get user email from storage (set in options page)
  const data = await new Promise(r => chrome.storage.local.get(['notificationEmail'], r));
  const email = data.notificationEmail;
  if (!email) return;
  
  const body = {
    email,
    scanSummary: {
      domainsScanned: scanResult.domainsScanned,
      threatsFound: scanResult.threatsFound,
      timestamp: new Date(scanResult.timestamp).toISOString(),
      threatResults: threatResults.map(r => ({
        domain: r.domain,
        score: r.score,
        threats: r.threats
      }))
    }
  };
  
  await fetch(`${API_BASE}/send-scheduled-scan-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
}

// Send email alerts for watchlist domain score drops
async function sendWatchlistEmailAlerts(watchlistAlerts) {
  const data = await new Promise(r => chrome.storage.local.get(['watchlistEmailAlerts', 'notificationEmail'], r));
  if (!data.watchlistEmailAlerts || !data.notificationEmail) return;
  
  const API_BASE = 'https://budnnhrplhvimsrvdhuc.supabase.co/functions/v1';
  
  for (const alert of watchlistAlerts) {
    try {
      await fetch(`${API_BASE}/send-threat-alert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: data.notificationEmail,
          domain: alert.domain,
          riskLevel: alert.currentScore < 20 ? 'critical' : alert.currentScore < 40 ? 'high' : 'medium',
          threatCount: 1,
          threats: [{
            source: 'Watchlist Monitor',
            type: 'score_drop',
            severity: alert.drop >= 30 ? 'critical' : alert.drop >= 20 ? 'high' : 'medium',
            description: `Score dropped ${alert.drop} points (${alert.previousScore} → ${alert.currentScore}). Your alert threshold: ${alert.threshold} points.`
          }],
          recommendations: [{
            action: 'Investigate this domain immediately',
            reason: `The trust score for ${alert.domain} has dropped significantly, which may indicate new threats or compromised content.`,
            priority: alert.drop >= 20 ? 'high' : 'medium'
          }],
          overallScore: alert.currentScore
        })
      });
    } catch (e) {
      console.log(`Failed to send watchlist email for ${alert.domain}:`, e);
    }
  }
}

// Send weekly alert digest email summarizing all alerts grouped by domain and channel
async function sendWeeklyAlertDigest() {
  const data = await new Promise(r => chrome.storage.local.get(['alertDigest', 'notificationEmail', 'weeklyAlertDigestEnabled'], r));
  if (!data.weeklyAlertDigestEnabled || !data.notificationEmail) return;
  
  const digest = data.alertDigest || [];
  const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const weekAlerts = digest.filter(a => a.timestamp >= oneWeekAgo);
  
  if (weekAlerts.length === 0) {
    console.log('No alerts this week, skipping weekly digest email');
    return;
  }
  
  const API_BASE = 'https://budnnhrplhvimsrvdhuc.supabase.co/functions/v1';
  
  try {
    const resp = await fetch(`${API_BASE}/send-weekly-alert-digest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: data.notificationEmail,
        alerts: weekAlerts
      })
    });
    
    if (resp.ok) {
      console.log('Weekly alert digest email sent successfully');
      logAlertDigest('email', 'Weekly alert digest email sent');
    }
  } catch (e) {
    console.log('Failed to send weekly alert digest:', e);
  }
}

// Quick scan function (was missing proper declaration)
async function quickScanDomain(domain, useAPI) {
  
  if (useAPI) {
    try {
      const resp = await fetch('https://urlhaus-api.abuse.ch/v1/host/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `host=${encodeURIComponent(domain)}`
      });
      const data = await resp.json();
      if (data.query_status !== 'no_results' && data.urls?.length > 0) {
        threats.push('URLhaus: Listed');
        source = 'urlhaus+heuristic';
      }
    } catch (e) { /* skip */ }
  }
  
  const tld = domain.split('.').pop();
  const riskyTLDs = ['xyz', 'top', 'buzz', 'click', 'loan', 'work', 'gq', 'ml', 'cf', 'tk'];
  if (riskyTLDs.includes(tld)) { score -= 20; threats.push('Risky TLD'); }
  if (domain.length > 30) { score -= 10; }
  if (/\d{4,}/.test(domain)) { score -= 15; }
  if (threats.some(t => t.startsWith('URLhaus:'))) score = Math.min(score, 15);
  
  return { score: Math.max(0, Math.min(100, score)), threats, source };
}

// Load cached threat database from storage
async function loadCachedThreatDB() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['localThreatDB'], (result) => {
      if (result.localThreatDB) {
        localThreatDB = {
          maliciousDomains: new Set(result.localThreatDB.maliciousDomains || []),
          maliciousIPs: new Set(result.localThreatDB.maliciousIPs || []),
          phishingUrls: new Set(result.localThreatDB.phishingUrls || []),
          lastUpdated: result.localThreatDB.lastUpdated,
          feedSources: result.localThreatDB.feedSources || {}
        };
      }
      resolve();
    });
  });
}

// Save threat database to storage
async function saveThreatDB() {
  return new Promise((resolve) => {
    const toSave = {
      maliciousDomains: Array.from(localThreatDB.maliciousDomains).slice(0, 10000), // Limit to 10k entries
      maliciousIPs: Array.from(localThreatDB.maliciousIPs).slice(0, 5000),
      phishingUrls: Array.from(localThreatDB.phishingUrls).slice(0, 5000),
      lastUpdated: localThreatDB.lastUpdated,
      feedSources: localThreatDB.feedSources
    };
    
    chrome.storage.local.set({ localThreatDB: toSave }, resolve);
  });
}

// Update threat feeds from multiple sources
async function updateThreatFeeds(force = false) {
  const settings = await chrome.storage.local.get(['lastThreatFeedUpdate']);
  const timeSinceUpdate = Date.now() - (settings.lastThreatFeedUpdate || 0);
  
  // Don't update if recently updated (unless forced)
  if (!force && timeSinceUpdate < THREAT_FEED_UPDATE_INTERVAL) {
    return { status: 'skipped', reason: 'Recently updated' };
  }
  
  console.log('Updating threat feeds...');
  const results = {
    urlhaus: { status: 'pending', count: 0 },
    threatFox: { status: 'pending', count: 0 },
    startTime: Date.now(),
    endTime: null
  };
  
  const feedPromises = [];
  
  // Fetch URLhaus recent threats (last 24h)
  feedPromises.push(
    fetch(THREAT_FEEDS.urlhausRecent, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'limit=1000'
    })
    .then(async (res) => {
      if (res.ok) {
        const data = await res.json();
        if (data.urls && Array.isArray(data.urls)) {
          let count = 0;
          data.urls.forEach(entry => {
            if (entry.url_status === 'online') {
              try {
                const url = new URL(entry.url);
                localThreatDB.maliciousDomains.add(url.hostname);
                count++;
              } catch (e) {}
            }
          });
          results.urlhaus = { status: 'success', count };
        }
      }
    })
    .catch((err) => {
      results.urlhaus = { status: 'error', error: err.message };
    })
  );
  
  // Fetch ThreatFox recent IOCs
  feedPromises.push(
    fetch(THREAT_FEEDS.threatFoxRecent, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: 'get_iocs', days: 1 })
    })
    .then(async (res) => {
      if (res.ok) {
        const data = await res.json();
        if (data.data && Array.isArray(data.data)) {
          let count = 0;
          data.data.forEach(ioc => {
            if (ioc.ioc_type === 'domain') {
              localThreatDB.maliciousDomains.add(ioc.ioc);
              count++;
            } else if (ioc.ioc_type === 'ip:port' || ioc.ioc_type === 'ip') {
              const ip = ioc.ioc.split(':')[0];
              localThreatDB.maliciousIPs.add(ip);
              count++;
            } else if (ioc.ioc_type === 'url') {
              try {
                const url = new URL(ioc.ioc);
                localThreatDB.maliciousDomains.add(url.hostname);
                count++;
              } catch (e) {}
            }
          });
          results.threatFox = { status: 'success', count };
        }
      }
    })
    .catch((err) => {
      results.threatFox = { status: 'error', error: err.message };
    })
  );
  
  // Wait for all feeds with timeout
  await Promise.race([
    Promise.allSettled(feedPromises),
    new Promise(resolve => setTimeout(resolve, 30000)) // 30 second timeout
  ]);
  
  // Update metadata
  localThreatDB.lastUpdated = Date.now();
  localThreatDB.feedSources = {
    urlhaus: results.urlhaus,
    threatFox: results.threatFox
  };
  
  results.endTime = Date.now();
  results.duration = results.endTime - results.startTime;
  results.totalDomains = localThreatDB.maliciousDomains.size;
  results.totalIPs = localThreatDB.maliciousIPs.size;
  
  // Save to storage
  await saveThreatDB();
  await chrome.storage.local.set({ lastThreatFeedUpdate: Date.now() });
  
  console.log('Threat feeds updated:', results);
  
  // Notify any open popups
  chrome.runtime.sendMessage({ type: 'THREAT_FEEDS_UPDATED', data: results }).catch(() => {});
  
  return results;
}

// Check domain against local threat database
function checkLocalThreatDB(domain) {
  const normalizedDomain = domain.replace(/^www\./, '').toLowerCase();
  
  const inMaliciousDomains = localThreatDB.maliciousDomains.has(normalizedDomain);
  
  // Also check parent domains
  const parts = normalizedDomain.split('.');
  let parentMatch = false;
  for (let i = 1; i < parts.length - 1; i++) {
    const parentDomain = parts.slice(i).join('.');
    if (localThreatDB.maliciousDomains.has(parentDomain)) {
      parentMatch = true;
      break;
    }
  }
  
  return {
    found: inMaliciousDomains || parentMatch,
    inMaliciousDomains,
    parentMatch,
    source: 'local_threat_db',
    dbSize: localThreatDB.maliciousDomains.size,
    lastUpdated: localThreatDB.lastUpdated
  };
}

// Get threat feed status
async function getThreatFeedStatus() {
  const settings = await chrome.storage.local.get(['liveThreatFeedsEnabled', 'lastThreatFeedUpdate']);
  
  return {
    enabled: settings.liveThreatFeedsEnabled !== false,
    lastUpdate: settings.lastThreatFeedUpdate ? new Date(settings.lastThreatFeedUpdate).toISOString() : null,
    lastUpdateRelative: settings.lastThreatFeedUpdate ? getRelativeTime(settings.lastThreatFeedUpdate) : 'Never',
    dbStats: {
      maliciousDomains: localThreatDB.maliciousDomains.size,
      maliciousIPs: localThreatDB.maliciousIPs.size,
      phishingUrls: localThreatDB.phishingUrls.size
    },
    feedSources: localThreatDB.feedSources
  };
}

// Get relative time string
function getRelativeTime(timestamp) {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  
  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
  return `${Math.floor(seconds / 86400)} days ago`;
}

// ============= PDF Report Generation =============

// Generate comprehensive PDF report data
async function generatePDFReportData(domain) {
  // Get or generate threat report
  let threatReport = await getCachedThreatReport(domain);
  
  if (!threatReport.found) {
    threatReport = {
      found: true,
      report: await generateFullThreatReport(domain)
    };
  }
  
  const report = threatReport.report;
  
  // Get local threat DB check
  const localCheck = checkLocalThreatDB(domain);
  
  // Get feed status
  const feedStatus = await getThreatFeedStatus();
  
  // Build PDF data structure
  const pdfData = {
    metadata: {
      title: `TrustGuard Threat Report - ${domain}`,
      generatedAt: new Date().toISOString(),
      generatedAtFormatted: new Date().toLocaleString(),
      domain: domain,
      reportVersion: '2.0'
    },
    summary: {
      overallScore: report.overallScore || report.score,
      riskLevel: report.riskLevel,
      threatCount: report.threats?.length || 0,
      recommendation: report.riskLevel === 'safe' ? 'This domain appears safe to visit.' :
                      report.riskLevel === 'low' ? 'Proceed with normal caution.' :
                      report.riskLevel === 'medium' ? 'Exercise caution when visiting this site.' :
                      report.riskLevel === 'high' ? 'High risk detected. Avoid this site if possible.' :
                      'Critical threats detected. Do not visit this site.'
    },
    threats: (report.threats || []).map(t => ({
      source: t.source,
      type: formatThreatType(t.type),
      severity: t.severity,
      confidence: t.confidence,
      description: t.description,
      reference: t.reference || null
    })),
    sources: {
      apiSources: report.sources || {},
      localDatabase: {
        checked: true,
        found: localCheck.found,
        dbSize: localCheck.dbSize,
        lastUpdated: localCheck.lastUpdated ? new Date(localCheck.lastUpdated).toISOString() : null
      },
      liveFeedStatus: {
        enabled: feedStatus.enabled,
        lastUpdate: feedStatus.lastUpdate,
        stats: feedStatus.dbStats
      }
    },
    recommendations: report.recommendations || [],
    technicalDetails: {
      domainInfo: {
        domain: domain,
        analyzedAt: report.generatedAt || new Date().toISOString()
      },
      checksPerformed: [
        { name: 'URLhaus URL Check', status: report.sources?.urlhaus || 'unknown' },
        { name: 'URLhaus Host Check', status: 'completed' },
        { name: 'ThreatFox IOC Check', status: report.sources?.threatFox || 'unknown' },
        { name: 'Heuristic Analysis', status: report.sources?.heuristics || 'completed' },
        { name: 'Local Threat Database', status: localCheck.found ? 'threat_found' : 'clean' },
        { name: 'Live Threat Feeds', status: feedStatus.enabled ? 'active' : 'disabled' }
      ]
    },
    footer: {
      disclaimer: 'This report is generated based on automated analysis and publicly available threat intelligence. It should be used as one of many factors when assessing the safety of a website.',
      poweredBy: 'TrustGuard Security Extension',
      dataSources: ['URLhaus (abuse.ch)', 'ThreatFox (abuse.ch)', 'Heuristic Analysis', 'Live Threat Feeds']
    }
  };
  
  return pdfData;
}

// Format threat type for display
function formatThreatType(type) {
  if (!type) return 'Unknown';
  return type.split('_').map(word => 
    word.charAt(0).toUpperCase() + word.slice(1)
  ).join(' ');
}
