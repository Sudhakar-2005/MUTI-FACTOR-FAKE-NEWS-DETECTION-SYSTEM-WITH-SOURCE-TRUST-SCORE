import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface NotificationPreferences {
  sound_enabled: boolean;
  push_enabled: boolean;
}

// Simple alert sound using Web Audio API
const playAlertSound = () => {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.setValueAtTime(880, audioContext.currentTime); // A5 note
    oscillator.type = 'sine';
    
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.5);
  } catch (error) {
    console.error('Failed to play alert sound:', error);
  }
};

// Request browser push notification permission
const requestPushPermission = async (): Promise<boolean> => {
  if (!('Notification' in window)) {
    console.log('Browser does not support notifications');
    return false;
  }

  if (Notification.permission === 'granted') {
    return true;
  }

  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }

  return false;
};

// Show browser push notification
const showPushNotification = (title: string, body: string, icon?: string) => {
  if (Notification.permission === 'granted') {
    new Notification(title, {
      body,
      icon: icon || '/favicon.ico',
      badge: '/favicon.ico',
      tag: 'trustguard-alert',
      requireInteraction: true,
    });
  }
};

export function useNotificationSound() {
  const { user } = useAuth();
  const [preferences, setPreferences] = useState<NotificationPreferences>({
    sound_enabled: true,
    push_enabled: false,
  });
  const [pushSupported, setPushSupported] = useState(false);
  const [pushPermission, setPushPermission] = useState<NotificationPermission>('default');

  useEffect(() => {
    setPushSupported('Notification' in window);
    if ('Notification' in window) {
      setPushPermission(Notification.permission);
    }
  }, []);

  // Load preferences from localStorage (simpler than adding more DB columns)
  useEffect(() => {
    const stored = localStorage.getItem('notification_preferences');
    if (stored) {
      try {
        setPreferences(JSON.parse(stored));
      } catch {}
    }
  }, []);

  const updatePreferences = useCallback((newPrefs: Partial<NotificationPreferences>) => {
    setPreferences(prev => {
      const updated = { ...prev, ...newPrefs };
      localStorage.setItem('notification_preferences', JSON.stringify(updated));
      return updated;
    });
  }, []);

  const enablePush = useCallback(async () => {
    const granted = await requestPushPermission();
    setPushPermission(Notification.permission);
    if (granted) {
      updatePreferences({ push_enabled: true });
    }
    return granted;
  }, [updatePreferences]);

  const triggerLowScoreAlert = useCallback((score: number, title: string) => {
    if (preferences.sound_enabled) {
      playAlertSound();
    }

    if (preferences.push_enabled && Notification.permission === 'granted') {
      showPushNotification(
        '⚠️ Low Trust Score Detected',
        `"${title.slice(0, 50)}..." scored ${score}/100`,
      );
    }
  }, [preferences]);

  return {
    preferences,
    updatePreferences,
    enablePush,
    pushSupported,
    pushPermission,
    triggerLowScoreAlert,
    playAlertSound,
  };
}
