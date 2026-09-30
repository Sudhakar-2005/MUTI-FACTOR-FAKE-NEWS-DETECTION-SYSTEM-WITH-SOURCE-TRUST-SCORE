import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useNotificationSound } from '@/hooks/useNotificationSound';
import { useToast } from '@/hooks/use-toast';

interface NotificationPayload {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export function useRealtimeNotifications() {
  const { user } = useAuth();
  const { triggerLowScoreAlert } = useNotificationSound();
  const { toast } = useToast();

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('realtime-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const notification = payload.new as NotificationPayload;
          
          // Show toast notification
          toast({
            title: notification.title,
            description: notification.message,
          });

          // Trigger sound/push for low score alerts
          if (notification.type === 'low_score_alert') {
            const score = (notification.metadata as { score?: number })?.score || 0;
            const articleTitle = (notification.metadata as { title?: string })?.title || 'Article';
            triggerLowScoreAlert(score, articleTitle);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, toast, triggerLowScoreAlert]);
}
