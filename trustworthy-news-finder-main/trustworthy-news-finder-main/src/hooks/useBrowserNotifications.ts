import { useCallback, useEffect, useState } from 'react';

interface NotificationPreferences {
  enabled: boolean;
  soundEnabled: boolean;
  threatAlertsEnabled: boolean;
  lowScoreAlertsEnabled: boolean;
  scheduledScanAlertsEnabled: boolean;
}

const DEFAULT_PREFERENCES: NotificationPreferences = {
  enabled: false,
  soundEnabled: true,
  threatAlertsEnabled: true,
  lowScoreAlertsEnabled: true,
  scheduledScanAlertsEnabled: true,
};

// Play alert sound using Web Audio API
const playAlertSound = (type: 'warning' | 'critical' | 'info' = 'warning') => {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    // Different frequencies for different alert types
    const frequencies = {
      info: 523.25, // C5
      warning: 659.25, // E5
      critical: 880, // A5
    };

    oscillator.frequency.setValueAtTime(frequencies[type], audioContext.currentTime);
    oscillator.type = type === 'critical' ? 'square' : 'sine';
    
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.5);

    // For critical alerts, play a second beep
    if (type === 'critical') {
      setTimeout(() => {
        const osc2 = audioContext.createOscillator();
        const gain2 = audioContext.createGain();
        osc2.connect(gain2);
        gain2.connect(audioContext.destination);
        osc2.frequency.setValueAtTime(frequencies.critical, audioContext.currentTime);
        osc2.type = 'square';
        gain2.gain.setValueAtTime(0.3, audioContext.currentTime);
        gain2.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
        osc2.start(audioContext.currentTime);
        osc2.stop(audioContext.currentTime + 0.3);
      }, 200);
    }
  } catch (error) {
    console.error('Failed to play alert sound:', error);
  }
};

export function useBrowserNotifications() {
  const [preferences, setPreferences] = useState<NotificationPreferences>(DEFAULT_PREFERENCES);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isSupported, setIsSupported] = useState(false);

  // Check browser support and load preferences
  useEffect(() => {
    const supported = 'Notification' in window;
    setIsSupported(supported);
    
    if (supported) {
      setPermission(Notification.permission);
    }

    // Load preferences from localStorage
    const stored = localStorage.getItem('browser_notification_preferences');
    if (stored) {
      try {
        setPreferences({ ...DEFAULT_PREFERENCES, ...JSON.parse(stored) });
      } catch (e) {
        console.error('Failed to parse notification preferences');
      }
    }
  }, []);

  // Request permission
  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!isSupported) return false;
    
    if (Notification.permission === 'granted') {
      setPermission('granted');
      return true;
    }
    
    if (Notification.permission !== 'denied') {
      const result = await Notification.requestPermission();
      setPermission(result);
      return result === 'granted';
    }
    
    return false;
  }, [isSupported]);

  // Update preferences
  const updatePreferences = useCallback((updates: Partial<NotificationPreferences>) => {
    setPreferences(prev => {
      const updated = { ...prev, ...updates };
      localStorage.setItem('browser_notification_preferences', JSON.stringify(updated));
      return updated;
    });
  }, []);

  // Enable notifications
  const enableNotifications = useCallback(async (): Promise<boolean> => {
    const granted = await requestPermission();
    if (granted) {
      updatePreferences({ enabled: true });
    }
    return granted;
  }, [requestPermission, updatePreferences]);

  // Show browser notification
  const showNotification = useCallback((
    title: string,
    body: string,
    options?: {
      type?: 'info' | 'warning' | 'critical';
      icon?: string;
      tag?: string;
      data?: Record<string, unknown>;
      requireInteraction?: boolean;
      onClick?: () => void;
    }
  ) => {
    if (!isSupported || permission !== 'granted' || !preferences.enabled) {
      console.log('Notifications not available or disabled');
      return null;
    }

    const type = options?.type || 'info';
    
    // Play sound if enabled
    if (preferences.soundEnabled) {
      playAlertSound(type);
    }

    // Create notification
    const notification = new Notification(title, {
      body,
      icon: options?.icon || '/favicon.ico',
      badge: '/favicon.ico',
      tag: options?.tag || `trustguard-${Date.now()}`,
      data: options?.data,
      requireInteraction: options?.requireInteraction ?? (type === 'critical'),
    });

    if (options?.onClick) {
      notification.onclick = () => {
        options.onClick?.();
        notification.close();
      };
    }

    return notification;
  }, [isSupported, permission, preferences]);

  // Specific alert functions
  const showThreatAlert = useCallback((domain: string, score: number, threats: string[]) => {
    if (!preferences.threatAlertsEnabled) return;
    
    const severity = score < 20 ? 'critical' : score < 40 ? 'warning' : 'info';
    
    return showNotification(
      `🚨 Threat Detected: ${domain}`,
      `Score: ${score}/100. ${threats[0] || 'Suspicious activity detected'}`,
      {
        type: severity === 'critical' ? 'critical' : 'warning',
        tag: `threat-${domain}`,
        requireInteraction: severity === 'critical',
        data: { domain, score, threats }
      }
    );
  }, [showNotification, preferences.threatAlertsEnabled]);

  const showLowScoreAlert = useCallback((url: string, score: number) => {
    if (!preferences.lowScoreAlertsEnabled) return;
    
    try {
      const domain = new URL(url).hostname;
      return showNotification(
        `⚠️ Low Trust Score`,
        `${domain} scored ${score}/100. Proceed with caution.`,
        {
          type: score < 30 ? 'critical' : 'warning',
          tag: `lowscore-${domain}`,
          data: { url, score }
        }
      );
    } catch (e) {
      return null;
    }
  }, [showNotification, preferences.lowScoreAlertsEnabled]);

  const showScheduledScanAlert = useCallback((threatCount: number, domains: string[]) => {
    if (!preferences.scheduledScanAlertsEnabled) return;
    
    return showNotification(
      `🛡️ Scheduled Scan Complete`,
      `${threatCount} site${threatCount !== 1 ? 's' : ''} flagged: ${domains.slice(0, 3).join(', ')}${domains.length > 3 ? '...' : ''}`,
      {
        type: threatCount > 0 ? 'warning' : 'info',
        tag: 'scheduled-scan',
        requireInteraction: threatCount > 0,
        data: { threatCount, domains }
      }
    );
  }, [showNotification, preferences.scheduledScanAlertsEnabled]);

  return {
    isSupported,
    permission,
    preferences,
    updatePreferences,
    requestPermission,
    enableNotifications,
    showNotification,
    showThreatAlert,
    showLowScoreAlert,
    showScheduledScanAlert,
    playAlertSound
  };
}
