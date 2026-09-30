const API_URL = 'https://budnnhrplhvimsrvdhuc.supabase.co/functions/v1';

let currentDomain = null;

document.addEventListener('DOMContentLoaded', () => {
  const analyzeBtn = document.getElementById('analyze-btn');
  const retryBtn = document.getElementById('retry-btn');
  const loadingDiv = document.getElementById('loading');
  const resultDiv = document.getElementById('result');
  const initialDiv = document.getElementById('initial');
  const errorDiv = document.getElementById('error');
  const shortcutsPanel = document.getElementById('shortcuts-panel');
  const showShortcutsBtn = document.getElementById('show-shortcuts');
  const closeShortcutsBtn = document.getElementById('close-shortcuts');
  const themeToggle = document.getElementById('theme-toggle');
  const refreshReportBtn = document.getElementById('refresh-report');
  const viewFullReportBtn = document.getElementById('view-full-report');
  const exportPdfBtn = document.getElementById('export-pdf');
  const updateFeedsBtn = document.getElementById('update-feeds-btn');
  const instantScoreDiv = document.getElementById('instant-score');

  analyzeBtn.addEventListener('click', analyzeCurrentPage);
  retryBtn.addEventListener('click', analyzeCurrentPage);
  refreshReportBtn?.addEventListener('click', refreshThreatReport);
  viewFullReportBtn?.addEventListener('click', openFullReport);
  exportPdfBtn?.addEventListener('click', exportPDFReport);
  updateFeedsBtn?.addEventListener('click', updateThreatFeeds);
  
  // Load threat feed status on popup open
  loadThreatFeedStatus();

  // Load saved theme
  chrome.storage.local.get(['theme'], (result) => {
    if (result.theme === 'light') {
      document.body.classList.add('light-theme');
    }
  });

  // Theme toggle
  themeToggle?.addEventListener('click', () => {
    document.body.classList.toggle('light-theme');
    const isLight = document.body.classList.contains('light-theme');
    chrome.storage.local.set({ theme: isLight ? 'light' : 'dark' });
  });

  // Shortcuts panel toggle
  showShortcutsBtn?.addEventListener('click', () => {
    shortcutsPanel?.classList.toggle('hidden');
  });
  
  closeShortcutsBtn?.addEventListener('click', () => {
    shortcutsPanel?.classList.add('hidden');
  });

  // Digest panel
  const digestPanel = document.getElementById('digest-panel');
  const showDigestBtn = document.getElementById('show-digest');
  const closeDigestBtn = document.getElementById('close-digest');
  const clearDigestBtn = document.getElementById('clear-digest');

  const severityFilter = document.getElementById('digest-severity-filter');

  showDigestBtn?.addEventListener('click', () => {
    digestPanel?.classList.toggle('hidden');
    if (!digestPanel?.classList.contains('hidden')) {
      loadDigest();
    }
  });
  closeDigestBtn?.addEventListener('click', () => digestPanel?.classList.add('hidden'));
  clearDigestBtn?.addEventListener('click', () => {
    chrome.storage.local.set({ alertDigest: [] }, () => loadDigest());
  });
  severityFilter?.addEventListener('change', () => loadDigest());

  // Export digest as CSV
  const exportDigestBtn = document.getElementById('export-digest-csv');
  exportDigestBtn?.addEventListener('click', () => {
    chrome.storage.local.get(['alertDigest'], (result) => {
      const digest = result.alertDigest || [];
      if (digest.length === 0) return;

      const csvHeader = 'Timestamp,Channel,Message,Domain\n';
      const csvRows = digest.map(a => {
        const time = new Date(a.timestamp).toISOString();
        const domainMatch = a.message.match(/([a-z0-9-]+\.[a-z]{2,})/i);
        const domain = domainMatch ? domainMatch[1] : '';
        const msg = a.message.replace(/"/g, '""');
        return `"${time}","${a.channel}","${msg}","${domain}"`;
      }).join('\n');

      const blob = new Blob([csvHeader + csvRows], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `trustguard-alerts-${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    });
  });

  function getAlertSeverity(message) {
    const scoreMatch = message.match(/(\d+)\/100/);
    if (scoreMatch) {
      const score = parseInt(scoreMatch[1]);
      if (score < 20) return 'critical';
      if (score < 40) return 'high';
      if (score < 60) return 'medium';
      return 'low';
    }
    if (message.toLowerCase().includes('critical') || (message.includes('dropped') && message.match(/\d{2,}pts/))) return 'critical';
    if (message.toLowerCase().includes('threat')) return 'high';
    return 'low';
  }

  function loadDigest() {
    const filterValue = severityFilter?.value || 'all';

    chrome.storage.local.get(['alertDigest', 'snoozedDomains'], (result) => {
      const digest = result.alertDigest || [];
      const snoozed = result.snoozedDomains || {};
      const now = Date.now();
      const today = new Date().toDateString();
      const todayAlerts = digest.filter(a => new Date(a.timestamp).toDateString() === today);
      
      // Stats
      const browserCount = todayAlerts.filter(a => a.channel === 'browser').length;
      const emailCount = todayAlerts.filter(a => a.channel === 'email').length;
      const soundCount = todayAlerts.filter(a => a.channel === 'sound').length;
      
      document.getElementById('digest-total').textContent = todayAlerts.length;
      document.getElementById('digest-browser').textContent = browserCount;
      document.getElementById('digest-email').textContent = emailCount;
      document.getElementById('digest-sound').textContent = soundCount;
      
      // Apply severity filter
      const filtered = filterValue === 'all'
        ? todayAlerts
        : todayAlerts.filter(a => getAlertSeverity(a.message) === filterValue);

      const listEl = document.getElementById('digest-list');
      if (filtered.length === 0) {
        listEl.innerHTML = `<p class="digest-empty">${filterValue === 'all' ? 'No alerts today' : 'No ' + filterValue + ' alerts today'}</p>`;
        renderSeverityChart(digest);
        return;
      }
      
      const severityIcons = { critical: '🔴', high: '🟠', medium: '🟡', low: '🟢' };
      const channelIcons = { browser: '🌐', email: '📧', sound: '🔊', watchlist: '👁️' };

      listEl.innerHTML = filtered.slice(0, 20).map(a => {
        const time = new Date(a.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const severity = getAlertSeverity(a.message);
        const domainMatch = a.message.match(/([a-z0-9-]+\.[a-z]{2,})/i);
        const domain = domainMatch ? domainMatch[1] : '';
        const isSnoozed = domain && snoozed[domain] && snoozed[domain] > now;
        return `
          <div class="digest-item digest-severity-${severity} ${isSnoozed ? 'digest-snoozed' : ''}">
            <span class="digest-item-severity" title="${severity}">${severityIcons[severity]}</span>
            <span class="digest-item-icon">${channelIcons[a.channel] || '🔔'}</span>
            <span class="digest-item-text">${a.message}</span>
            <span class="digest-item-time">${time}</span>
            ${domain ? `<button class="digest-snooze-btn" data-domain="${domain}" title="${isSnoozed ? 'Unsnooze ' + domain : 'Snooze ' + domain + ' for 1h'}">${isSnoozed ? '🔔' : '🔇'}</button>` : ''}
          </div>
        `;
      }).join('');

      // Snooze button handlers
      listEl.querySelectorAll('.digest-snooze-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const dom = e.target.dataset.domain;
          chrome.storage.local.get(['snoozedDomains'], (r) => {
            const s = r.snoozedDomains || {};
            if (s[dom] && s[dom] > Date.now()) {
              delete s[dom];
            } else {
              s[dom] = Date.now() + 3600000; // 1 hour snooze
            }
            chrome.storage.local.set({ snoozedDomains: s }, () => loadDigest());
          });
        });
      });

      renderSeverityChart(digest);
    });
  }

  // Render 7-day severity chart
  function renderSeverityChart(digest) {
    const canvas = document.getElementById('digest-severity-chart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    const now = new Date();
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      days.push(d.toDateString());
    }

    const severities = ['critical', 'high', 'medium', 'low'];
    const colors = { critical: '#ef4444', high: '#fb923c', medium: '#facc15', low: '#22c55e' };

    // Count per day per severity
    const counts = days.map(day => {
      const dayAlerts = digest.filter(a => new Date(a.timestamp).toDateString() === day);
      const c = {};
      severities.forEach(s => { c[s] = dayAlerts.filter(a => getAlertSeverity(a.message) === s).length; });
      return c;
    });

    const maxTotal = Math.max(1, ...counts.map(c => severities.reduce((s, k) => s + c[k], 0)));
    const barW = (W - 50) / 7;
    const chartH = H - 30;

    // Labels
    ctx.fillStyle = '#64748b';
    ctx.font = '9px sans-serif';
    ctx.textAlign = 'center';
    days.forEach((day, i) => {
      const label = new Date(day).toLocaleDateString('en', { weekday: 'short' });
      ctx.fillText(label, 40 + i * barW + barW / 2, H - 4);
    });

    // Y axis
    ctx.textAlign = 'right';
    ctx.fillText('0', 32, chartH);
    ctx.fillText(maxTotal.toString(), 32, 14);

    // Stacked bars
    counts.forEach((c, i) => {
      let y = chartH;
      severities.forEach(s => {
        const h = (c[s] / maxTotal) * (chartH - 14);
        if (h > 0) {
          ctx.fillStyle = colors[s];
          ctx.beginPath();
          const x = 40 + i * barW + 4;
          const bw = barW - 8;
          ctx.roundRect(x, y - h, bw, h, 2);
          ctx.fill();
          y -= h;
        }
      });
    });
  }


  // Deep Analysis Panel
  const deepAnalysisPanel = document.getElementById('deep-analysis-panel');
  const showDeepAnalysisBtn = document.getElementById('show-deep-analysis');
  const closeDeepAnalysisBtn = document.getElementById('close-deep-analysis');

  showDeepAnalysisBtn?.addEventListener('click', () => {
    deepAnalysisPanel?.classList.toggle('hidden');
    if (!deepAnalysisPanel?.classList.contains('hidden') && currentDomain) {
      runDeepAnalysis();
    }
  });
  closeDeepAnalysisBtn?.addEventListener('click', () => deepAnalysisPanel?.classList.add('hidden'));

  async function runDeepAnalysis() {
    const loadingEl = document.getElementById('deep-analysis-loading');
    const resultEl = document.getElementById('deep-analysis-result');
    const emptyEl = document.getElementById('deep-analysis-empty');

    loadingEl?.classList.remove('hidden');
    resultEl.innerHTML = '';
    emptyEl?.classList.add('hidden');

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.url) throw new Error('No active tab');

      // Extract page content
      const [{ result: pageData }] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: extractPageContent
      });

      const response = await fetch(`${API_URL}/ai-fact-check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: pageData.content,
          title: pageData.title || tab.title,
          url: tab.url,
        })
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || 'Analysis failed');
      }

      const data = await response.json();
      renderDeepAnalysis(data);
    } catch (error) {
      resultEl.innerHTML = `<div class="deep-error">❌ ${error.message}</div>`;
    } finally {
      loadingEl?.classList.add('hidden');
    }
  }

  function renderDeepAnalysis(data) {
    const a = data.analysis;
    const resultEl = document.getElementById('deep-analysis-result');
    const assessColors = {
      reliable: '#22c55e', mostly_accurate: '#2dd4bf', needs_verification: '#facc15',
      misleading: '#fb923c', false: '#ef4444'
    };
    const claimColors = {
      verified: '#22c55e', likely_true: '#2dd4bf', unverified: '#facc15',
      likely_false: '#fb923c', false: '#ef4444'
    };

    const claimsHtml = (a.factualClaims || []).slice(0, 5).map(c => `
      <div class="deep-claim">
        <div class="deep-claim-badge" style="background:${claimColors[c.assessment] || '#94a3b8'}20;color:${claimColors[c.assessment] || '#94a3b8'}">${c.assessment?.replace('_', ' ')}</div>
        <div class="deep-claim-text">${c.claim}</div>
        <div class="deep-claim-explain">${c.explanation}</div>
      </div>
    `).join('');

    const redFlagsHtml = (a.redFlags || []).map(f => `<li>🚩 ${f}</li>`).join('');
    const missingCtxHtml = (a.missingContext || []).map(m => `<li>❓ ${m}</li>`).join('');

    resultEl.innerHTML = `
      <div class="deep-overview">
        <div class="deep-badge" style="background:${assessColors[a.overallAssessment] || '#94a3b8'}20;color:${assessColors[a.overallAssessment] || '#94a3b8'}">
          ${(a.overallAssessment || 'unknown').replace('_', ' ')}
        </div>
        <div class="deep-confidence">
          <span>Confidence</span>
          <strong>${a.confidenceScore || '?'}%</strong>
        </div>
      </div>
      ${a.sourceAnalysis ? `
        <div class="deep-section">
          <h4>📰 Source Credibility: <span style="color:${assessColors[a.sourceAnalysis.credibility] || '#94a3b8'}">${a.sourceAnalysis.credibility}</span></h4>
          <p>${a.sourceAnalysis.reasoning}</p>
        </div>
      ` : ''}
      ${claimsHtml ? `<div class="deep-section"><h4>📋 Factual Claims</h4>${claimsHtml}</div>` : ''}
      ${redFlagsHtml ? `<div class="deep-section"><h4>🚩 Red Flags</h4><ul>${redFlagsHtml}</ul></div>` : ''}
      ${missingCtxHtml ? `<div class="deep-section"><h4>❓ Missing Context</h4><ul>${missingCtxHtml}</ul></div>` : ''}
      <div class="deep-section deep-recommendation">
        <h4>💡 Recommendation</h4>
        <p>${a.recommendation || 'No specific recommendation.'}</p>
      </div>
      ${data.relatedFactChecks?.length ? `
        <div class="deep-section">
          <h4>✅ Related Verified Facts (${data.relatedFactChecks.length})</h4>
          ${data.relatedFactChecks.map(fc => `<div class="deep-factcheck"><strong>${fc.verdict}</strong>: ${fc.claim}</div>`).join('')}
        </div>
      ` : ''}
    `;
  }

  analyzeCurrentPage();

  async function analyzeCurrentPage() {
    showState('loading');

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
        throw new Error('Cannot analyze browser internal pages');
      }

      // Extract domain for threat report
      try {
        currentDomain = new URL(tab.url).hostname.replace(/^www\./, '');
      } catch (e) {
        currentDomain = null;
      }

      // Show instant domain preview
      showInstantPreview(currentDomain, tab.url);

      // Try to use the API first for consistent results
      const apiResponse = await fetch(`${API_URL}/analyze-api`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: tab.url })
      });

      if (apiResponse.ok) {
        const apiResult = await apiResponse.json();
        if (apiResult.success && apiResult.data) {
          displayApiResult(apiResult.data);
          showState('result');
          // Load threat report
          if (currentDomain) {
            loadThreatReport(currentDomain);
          }
          // Update badge
          updateExtensionBadge(apiResult.data.finalScore);
          return;
        }
      }

      // Fallback to local analysis
      const [{ result: pageData }] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: extractPageContent
      });

      const result = analyzeContent(pageData.content, tab.url);
      displayResult(result);
      showState('result');
      
      // Load threat report
      if (currentDomain) {
        loadThreatReport(currentDomain);
      }
      
      // Update badge
      updateExtensionBadge(result.finalScore);

    } catch (error) {
      console.error('Analysis error:', error);
      document.getElementById('error-message').textContent = error.message || 'Failed to analyze page';
      showState('error');
    }
  }

  function showInstantPreview(domain, url) {
    if (instantScoreDiv) {
      const trustedDomains = ['reuters.com', 'apnews.com', 'bbc.com', 'npr.org', 'nytimes.com', 'washingtonpost.com', 'theguardian.com', 'wsj.com', 'ft.com', 'bloomberg.com'];
      const suspiciousTlds = ['.xyz', '.top', '.click', '.work', '.tk', '.ml', '.ga', '.cf', '.gq', '.buzz', '.loan'];
      
      let quickStatus = 'analyzing';
      let quickIcon = '🔍';
      
      if (trustedDomains.some(d => domain.includes(d))) {
        quickStatus = 'trusted';
        quickIcon = '✅';
      } else if (domain.endsWith('.gov') || domain.endsWith('.edu')) {
        quickStatus = 'trusted';
        quickIcon = '✅';
      } else if (suspiciousTlds.some(tld => domain.endsWith(tld))) {
        quickStatus = 'suspicious';
        quickIcon = '⚠️';
      }
      
      instantScoreDiv.className = `instant-score ${quickStatus}`;
      instantScoreDiv.innerHTML = `
        <span class="instant-icon">${quickIcon}</span>
        <span class="instant-domain">${domain}</span>
        <span class="instant-status">${quickStatus === 'analyzing' ? 'Analyzing...' : quickStatus.charAt(0).toUpperCase() + quickStatus.slice(1)}</span>
      `;
      instantScoreDiv.classList.remove('hidden');
    }
  }

  function updateExtensionBadge(score) {
    const color = score >= 80 ? '#22c55e' : score >= 60 ? '#2dd4bf' : score >= 40 ? '#facc15' : score >= 20 ? '#fb923c' : '#ef4444';
    
    chrome.action.setBadgeText({ text: score.toString() });
    chrome.action.setBadgeBackgroundColor({ color });
  }

  async function loadThreatReport(domain) {
    const threatReport = document.getElementById('threat-report');
    const threatsList = document.getElementById('threats-list');
    const riskLevel = document.getElementById('risk-level');
    const sourcesCount = document.getElementById('sources-count');
    const recommendationsList = document.getElementById('recommendations-list');

    // Show the threat report section
    threatReport?.classList.remove('hidden');

    // First check cache
    chrome.runtime.sendMessage({ type: 'GET_CACHED_THREAT_REPORT', domain }, async (cached) => {
      if (cached?.found) {
        displayThreatReport(cached.report);
      } else {
        // Fetch new report
        threatsList.innerHTML = '<div class="no-threats"><span class="check-icon">⏳</span>Checking threat databases...</div>';
        
        chrome.runtime.sendMessage({ type: 'GET_FULL_THREAT_REPORT', domain }, (response) => {
          if (response?.success && response.data) {
            displayThreatReport(response.data);
          } else {
            threatsList.innerHTML = '<div class="no-threats"><span class="check-icon">⚠️</span>Could not fetch threat report</div>';
          }
        });
      }
    });
  }

  function displayThreatReport(report) {
    const threatsList = document.getElementById('threats-list');
    const riskLevel = document.getElementById('risk-level');
    const sourcesCount = document.getElementById('sources-count');
    const recommendationsList = document.getElementById('recommendations-list');

    // Update risk level
    riskLevel.textContent = report.riskLevel.charAt(0).toUpperCase() + report.riskLevel.slice(1);
    riskLevel.className = 'risk-badge ' + report.riskLevel;

    // Update sources count
    const sourceCount = Object.values(report.sources || {}).filter(s => s !== 'pending').length;
    sourcesCount.textContent = sourceCount;

    // Display threats
    if (report.threats && report.threats.length > 0) {
      threatsList.innerHTML = report.threats.map(threat => `
        <div class="threat-item ${threat.severity}">
          <span class="threat-icon">${getThreatIcon(threat.severity)}</span>
          <div class="threat-details">
            <div class="threat-source">${threat.source}</div>
            <div class="threat-type">${formatThreatType(threat.type)}</div>
            <div class="threat-description">${threat.description}</div>
          </div>
          <span class="threat-severity ${threat.severity}">${threat.severity}</span>
        </div>
      `).join('');
    } else {
      threatsList.innerHTML = `
        <div class="no-threats">
          <span class="check-icon">✅</span>
          No threats detected from ${sourceCount} sources
        </div>
      `;
    }

    // Display recommendations
    if (report.recommendations && report.recommendations.length > 0) {
      recommendationsList.innerHTML = report.recommendations.map(rec => `
        <li class="${rec.priority === 'high' ? 'high-priority' : ''}">${rec.action}</li>
      `).join('');
    }
  }

  function getThreatIcon(severity) {
    switch (severity) {
      case 'critical': return '🚨';
      case 'high': return '⚠️';
      case 'medium': return '⚡';
      case 'low': return 'ℹ️';
      default: return '❓';
    }
  }

  function formatThreatType(type) {
    return type.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  }

  function refreshThreatReport() {
    if (currentDomain) {
      const threatsList = document.getElementById('threats-list');
      threatsList.innerHTML = '<div class="no-threats"><span class="check-icon">🔄</span>Refreshing threat data...</div>';
      
      chrome.runtime.sendMessage({ type: 'GET_FULL_THREAT_REPORT', domain: currentDomain }, (response) => {
        if (response?.success && response.data) {
          displayThreatReport(response.data);
        }
      });
    }
  }

  function openFullReport() {
    if (currentDomain) {
      chrome.tabs.create({ url: chrome.runtime.getURL(`options.html?report=${encodeURIComponent(currentDomain)}`) });
    }
  }

  // Load threat feed status
  function loadThreatFeedStatus() {
    chrome.runtime.sendMessage({ type: 'GET_THREAT_FEED_STATUS' }, (response) => {
      if (response) {
        const feedUpdateTime = document.getElementById('feed-update-time');
        const feedDbSize = document.getElementById('feed-db-size');
        
        if (feedUpdateTime) {
          feedUpdateTime.textContent = response.lastUpdateRelative || 'Never';
        }
        if (feedDbSize) {
          const totalThreats = (response.dbStats?.maliciousDomains || 0) + 
                               (response.dbStats?.maliciousIPs || 0);
          feedDbSize.textContent = totalThreats.toLocaleString();
        }
      }
    });
  }

  // Update threat feeds manually
  function updateThreatFeeds() {
    const btn = document.getElementById('update-feeds-btn');
    if (btn) {
      btn.classList.add('updating');
      btn.disabled = true;
    }
    
    chrome.runtime.sendMessage({ type: 'UPDATE_THREAT_FEEDS' }, (response) => {
      if (btn) {
        btn.classList.remove('updating');
        btn.disabled = false;
      }
      
      if (response?.success) {
        loadThreatFeedStatus();
        // Show success feedback
        if (btn) {
          const originalText = btn.textContent;
          btn.textContent = '✓';
          setTimeout(() => { btn.textContent = originalText; }, 2000);
        }
      }
    });
  }

  // Export PDF Report
  async function exportPDFReport() {
    if (!currentDomain) return;
    
    const btn = document.getElementById('export-pdf');
    if (btn) {
      btn.disabled = true;
      btn.textContent = '⏳ Generating...';
    }
    
    chrome.runtime.sendMessage({ type: 'GENERATE_PDF_REPORT', domain: currentDomain }, (response) => {
      if (btn) {
        btn.disabled = false;
        btn.textContent = '📄 Export PDF';
      }
      
      if (response?.success && response.data) {
        generateAndDownloadPDF(response.data);
      } else {
        console.error('PDF generation failed:', response?.error);
        if (btn) {
          btn.textContent = '❌ Error';
          setTimeout(() => { btn.textContent = '📄 Export PDF'; }, 2000);
        }
      }
    });
  }

  // Generate and download PDF using browser print
  function generateAndDownloadPDF(data) {
    // Create a new window with the report content
    const reportHTML = generateReportHTML(data);
    
    // Open print dialog
    const printWindow = window.open('', '_blank', 'width=800,height=600');
    printWindow.document.write(reportHTML);
    printWindow.document.close();
    
    // Trigger print after content loads
    printWindow.onload = function() {
      setTimeout(() => {
        printWindow.print();
      }, 500);
    };
  }

  // Generate HTML for PDF report
  function generateReportHTML(data) {
    const getSeverityColor = (severity) => {
      switch (severity) {
        case 'critical': return '#ef4444';
        case 'high': return '#fb923c';
        case 'medium': return '#facc15';
        case 'low': return '#2dd4bf';
        default: return '#94a3b8';
      }
    };

    const getRiskColor = (level) => {
      switch (level) {
        case 'safe': return '#22c55e';
        case 'low': return '#2dd4bf';
        case 'medium': return '#facc15';
        case 'high': return '#fb923c';
        case 'critical': return '#ef4444';
        default: return '#94a3b8';
      }
    };

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${data.metadata.title}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      color: #1e293b;
      line-height: 1.6;
      padding: 40px;
      max-width: 800px;
      margin: 0 auto;
    }
    .header {
      border-bottom: 3px solid #2dd4bf;
      padding-bottom: 20px;
      margin-bottom: 30px;
    }
    .header h1 {
      font-size: 24px;
      color: #0f172a;
      margin-bottom: 8px;
    }
    .header .meta {
      color: #64748b;
      font-size: 12px;
    }
    .summary-box {
      background: #f8fafc;
      border-radius: 12px;
      padding: 24px;
      margin-bottom: 24px;
      display: flex;
      align-items: center;
      gap: 24px;
    }
    .score-circle {
      width: 100px;
      height: 100px;
      border-radius: 50%;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      color: white;
      font-weight: bold;
    }
    .score-circle .number { font-size: 32px; }
    .score-circle .label { font-size: 10px; text-transform: uppercase; }
    .summary-details h2 { font-size: 18px; margin-bottom: 8px; }
    .summary-details p { color: #64748b; font-size: 14px; }
    .risk-badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 16px;
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      margin-top: 8px;
    }
    .section { margin-bottom: 24px; }
    .section h3 {
      font-size: 16px;
      color: #0f172a;
      margin-bottom: 12px;
      padding-bottom: 8px;
      border-bottom: 1px solid #e2e8f0;
    }
    .threat-item {
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 12px;
      margin-bottom: 8px;
      border-left: 4px solid;
    }
    .threat-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 4px;
    }
    .threat-source { font-size: 10px; color: #64748b; text-transform: uppercase; }
    .threat-severity {
      font-size: 10px;
      padding: 2px 8px;
      border-radius: 4px;
      font-weight: 600;
      text-transform: uppercase;
    }
    .threat-type { font-weight: 600; margin-bottom: 4px; }
    .threat-desc { font-size: 13px; color: #64748b; }
    .recommendation-item {
      padding: 8px 0;
      border-bottom: 1px solid #e2e8f0;
      font-size: 14px;
    }
    .recommendation-item:last-child { border-bottom: none; }
    .recommendation-item.high { color: #ef4444; font-weight: 500; }
    .checks-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
    }
    .checks-table th, .checks-table td {
      padding: 8px 12px;
      text-align: left;
      border-bottom: 1px solid #e2e8f0;
    }
    .checks-table th { background: #f8fafc; font-weight: 600; }
    .status-clean { color: #22c55e; }
    .status-threat { color: #ef4444; }
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #e2e8f0;
      font-size: 11px;
      color: #64748b;
    }
    .footer p { margin-bottom: 4px; }
    @media print {
      body { padding: 20px; }
      .threat-item { break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>🛡️ TrustGuard Security Report</h1>
    <div class="meta">
      <strong>Domain:</strong> ${data.metadata.domain} &nbsp;|&nbsp;
      <strong>Generated:</strong> ${data.metadata.generatedAtFormatted} &nbsp;|&nbsp;
      <strong>Report Version:</strong> ${data.metadata.reportVersion}
    </div>
  </div>
  
  <div class="summary-box">
    <div class="score-circle" style="background: ${getRiskColor(data.summary.riskLevel)}">
      <span class="number">${data.summary.overallScore}</span>
      <span class="label">Score</span>
    </div>
    <div class="summary-details">
      <h2>Executive Summary</h2>
      <p>${data.summary.recommendation}</p>
      <span class="risk-badge" style="background: ${getRiskColor(data.summary.riskLevel)}20; color: ${getRiskColor(data.summary.riskLevel)}">
        ${data.summary.riskLevel.toUpperCase()} RISK
      </span>
      <span style="margin-left: 12px; font-size: 13px; color: #64748b;">
        ${data.summary.threatCount} threat(s) detected
      </span>
    </div>
  </div>
  
  ${data.threats.length > 0 ? `
  <div class="section">
    <h3>🚨 Detected Threats</h3>
    ${data.threats.map(t => `
      <div class="threat-item" style="border-left-color: ${getSeverityColor(t.severity)}">
        <div class="threat-header">
          <span class="threat-source">${t.source}</span>
          <span class="threat-severity" style="background: ${getSeverityColor(t.severity)}20; color: ${getSeverityColor(t.severity)}">${t.severity}</span>
        </div>
        <div class="threat-type">${t.type}</div>
        <div class="threat-desc">${t.description}</div>
        ${t.reference ? `<div style="margin-top: 4px; font-size: 11px;"><a href="${t.reference}" style="color: #3b82f6;">Reference →</a></div>` : ''}
      </div>
    `).join('')}
  </div>
  ` : `
  <div class="section">
    <h3>✅ No Threats Detected</h3>
    <p style="color: #64748b;">No known threats were found for this domain across all security sources.</p>
  </div>
  `}
  
  <div class="section">
    <h3>📋 Recommendations</h3>
    ${data.recommendations.map(r => `
      <div class="recommendation-item ${r.priority === 'high' ? 'high' : ''}">
        ${r.priority === 'high' ? '⚠️' : '→'} ${r.action}
        <div style="font-size: 12px; color: #94a3b8; margin-top: 2px;">${r.reason}</div>
      </div>
    `).join('')}
  </div>
  
  <div class="section">
    <h3>🔍 Security Checks Performed</h3>
    <table class="checks-table">
      <thead>
        <tr>
          <th>Check</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        ${data.technicalDetails.checksPerformed.map(c => `
          <tr>
            <td>${c.name}</td>
            <td class="${c.status === 'clean' || c.status === 'completed' || c.status === 'active' ? 'status-clean' : c.status === 'threat_found' || c.status === 'malicious' ? 'status-threat' : ''}">
              ${c.status === 'clean' || c.status === 'completed' ? '✓ Clean' : 
                c.status === 'threat_found' || c.status === 'malicious' ? '⚠ Threat Found' : 
                c.status === 'active' ? '✓ Active' :
                c.status === 'disabled' ? '○ Disabled' :
                c.status || 'Unknown'}
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  </div>
  
  <div class="section">
    <h3>📊 Data Sources</h3>
    <p style="font-size: 13px; color: #64748b; margin-bottom: 12px;">
      This report was compiled using data from the following security intelligence sources:
    </p>
    <ul style="font-size: 13px; color: #64748b; padding-left: 20px;">
      ${data.footer.dataSources.map(s => `<li>${s}</li>`).join('')}
    </ul>
    ${data.sources.liveFeedStatus.enabled ? `
      <p style="font-size: 12px; color: #2dd4bf; margin-top: 12px;">
        ✓ Live threat feeds active with ${(data.sources.liveFeedStatus.stats?.maliciousDomains || 0).toLocaleString()} known threats
      </p>
    ` : ''}
  </div>
  
  <div class="footer">
    <p><strong>${data.footer.poweredBy}</strong></p>
    <p>${data.footer.disclaimer}</p>
  </div>
</body>
</html>`;
  }

  // Listen for threat feed updates
  chrome.runtime.onMessage?.addListener((message) => {
    if (message.type === 'THREAT_FEEDS_UPDATED') {
      loadThreatFeedStatus();
    }
  });

  function showState(state) {
    loadingDiv.classList.add('hidden');
    resultDiv.classList.add('hidden');
    initialDiv.classList.add('hidden');
    errorDiv.classList.add('hidden');

    switch (state) {
      case 'loading':
        loadingDiv.classList.remove('hidden');
        break;
      case 'result':
        resultDiv.classList.remove('hidden');
        break;
      case 'error':
        errorDiv.classList.remove('hidden');
        break;
      default:
        initialDiv.classList.remove('hidden');
    }
  }

  function displayApiResult(data) {
    const scoreNumber = document.getElementById('score-number');
    const scoreProgress = document.getElementById('score-progress');
    const circumference = 2 * Math.PI * 45;
    
    animateValue(scoreNumber, 0, data.finalScore, 800);
    
    setTimeout(() => {
      const offset = circumference - (data.finalScore / 100) * circumference;
      scoreProgress.style.strokeDashoffset = offset;
      scoreProgress.style.stroke = getScoreColor(data.finalScore);
    }, 100);

    const ratingBadge = document.getElementById('rating-badge');
    const ratingText = document.getElementById('rating-text');
    ratingText.textContent = getRatingLabel(data.rating);
    ratingBadge.className = 'rating-badge ' + getRatingClass(data.rating);

    setScoreBar('text', data.scores.text);
    setScoreBar('domain', data.scores.domain);
    setScoreBar('evidence', data.scores.evidence);
    setScoreBar('sentiment', data.scores.sentiment);

    const explanations = [];
    if (data.details.clickbaitWords?.length > 0) {
      explanations.push(`Found ${data.details.clickbaitWords.length} clickbait patterns.`);
    }
    if (data.scores.domain >= 80) {
      explanations.push('Source appears reputable.');
    } else if (data.scores.domain < 40) {
      explanations.push('Domain trust is low.');
    }
    document.getElementById('explanation').textContent = explanations[0] || `Trust score: ${data.finalScore}/100`;
    
    // Hide instant preview after result is shown
    const instantScoreDiv = document.getElementById('instant-score');
    if (instantScoreDiv) {
      instantScoreDiv.classList.add('hidden');
    }
  }

  function getRatingLabel(rating) {
    switch (rating) {
      case 'reliable': return 'Reliable';
      case 'verify': return 'Verify';
      case 'suspicious': return 'Suspicious';
      default: return rating;
    }
  }

  function getRatingClass(rating) {
    switch (rating) {
      case 'reliable': return 'trustworthy';
      case 'verify': return 'questionable';
      case 'suspicious': return 'likely-false';
      default: return rating.toLowerCase().replace(/\s+/g, '-');
    }
  }

  function displayResult(result) {
    const scoreNumber = document.getElementById('score-number');
    const scoreProgress = document.getElementById('score-progress');
    const circumference = 2 * Math.PI * 45;
    
    animateValue(scoreNumber, 0, result.finalScore, 800);
    
    setTimeout(() => {
      const offset = circumference - (result.finalScore / 100) * circumference;
      scoreProgress.style.strokeDashoffset = offset;
      scoreProgress.style.stroke = getScoreColor(result.finalScore);
    }, 100);

    const ratingBadge = document.getElementById('rating-badge');
    const ratingText = document.getElementById('rating-text');
    ratingText.textContent = getRatingLabel(result.rating);
    ratingBadge.className = 'rating-badge ' + getRatingClass(result.rating);

    setScoreBar('text', result.textScore);
    setScoreBar('domain', result.domainScore);
    setScoreBar('evidence', result.evidenceScore);
    setScoreBar('sentiment', result.sentimentScore);

    document.getElementById('explanation').textContent = result.explanation[0] || '';
    
    // Hide instant preview after result is shown
    const instantScoreDiv = document.getElementById('instant-score');
    if (instantScoreDiv) {
      instantScoreDiv.classList.add('hidden');
    }
  }

  function setScoreBar(id, score) {
    document.getElementById(`${id}-score`).textContent = score;
    setTimeout(() => {
      document.getElementById(`${id}-bar`).style.width = `${score}%`;
    }, 200);
  }

  function animateValue(element, start, end, duration) {
    const range = end - start;
    const startTime = performance.now();
    
    function update(currentTime) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const value = Math.round(start + range * easeOutQuart(progress));
      element.textContent = value;
      
      if (progress < 1) {
        requestAnimationFrame(update);
      }
    }
    
    requestAnimationFrame(update);
  }

  function easeOutQuart(x) {
    return 1 - Math.pow(1 - x, 4);
  }

  function getScoreColor(score) {
    if (score >= 80) return '#22c55e';
    if (score >= 60) return '#2dd4bf';
    if (score >= 40) return '#facc15';
    if (score >= 20) return '#fb923c';
    return '#ef4444';
  }
});

function extractPageContent() {
  const title = document.title;
  
  const selectors = [
    'article',
    '[role="article"]',
    '.article-content',
    '.post-content',
    '.entry-content',
    'main',
    '.content'
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

  return { title, content: content.slice(0, 5000) };
}

function analyzeContent(content, url) {
  const clickbaitWords = [
    'shocking', 'unbelievable', 'won\'t believe', 'doctors hate', 'secret',
    'one weird trick', 'breaking', 'urgent', 'exclusive', 'bombshell',
    'miracle', 'revolutionary', 'banned', 'censored', 'exposed'
  ];

  const text = content.toLowerCase();
  let textScore = 70;
  let domainScore = 60;
  let evidenceScore = 50;
  let sentimentScore = 65;

  const foundClickbait = clickbaitWords.filter(w => text.includes(w));
  textScore -= foundClickbait.length * 8;

  const capsRatio = (content.match(/[A-Z]{4,}/g) || []).length / (content.length / 100);
  textScore -= Math.min(capsRatio * 5, 20);

  const exclamationRatio = (content.match(/!/g) || []).length / (content.length / 100);
  textScore -= Math.min(exclamationRatio * 3, 15);

  try {
    const domain = new URL(url).hostname;
    const trustedDomains = ['reuters.com', 'apnews.com', 'bbc.com', 'npr.org', 'nytimes.com'];
    const suspiciousDomains = ['infowars', 'naturalnews', 'beforeitsnews'];
    
    if (trustedDomains.some(d => domain.includes(d))) {
      domainScore = 90;
    } else if (suspiciousDomains.some(d => domain.includes(d))) {
      domainScore = 20;
    } else if (domain.endsWith('.gov') || domain.endsWith('.edu')) {
      domainScore = 85;
    }
  } catch (e) {}

  if (content.length > 1000) evidenceScore += 10;
  if (content.length > 2000) evidenceScore += 10;

  const quotes = (content.match(/[""][^""]+[""]/g) || []).length;
  if (quotes > 2) evidenceScore += 15;

  textScore = Math.max(0, Math.min(100, textScore));
  domainScore = Math.max(0, Math.min(100, domainScore));
  evidenceScore = Math.max(0, Math.min(100, evidenceScore));
  sentimentScore = Math.max(0, Math.min(100, sentimentScore));

  const finalScore = Math.round(
    textScore * 0.35 +
    domainScore * 0.25 +
    evidenceScore * 0.25 +
    sentimentScore * 0.15
  );

  let rating;
  if (finalScore >= 80) rating = 'reliable';
  else if (finalScore >= 50) rating = 'verify';
  else rating = 'suspicious';

  const explanation = [];
  if (foundClickbait.length > 0) {
    explanation.push(`Found ${foundClickbait.length} clickbait patterns in the text.`);
  }
  if (domainScore >= 80) {
    explanation.push('This appears to be from a reputable source.');
  } else if (domainScore < 40) {
    explanation.push('This domain has low trust indicators.');
  }

  return {
    textScore,
    domainScore,
    evidenceScore,
    sentimentScore,
    finalScore,
    rating,
    explanation
  };
}
