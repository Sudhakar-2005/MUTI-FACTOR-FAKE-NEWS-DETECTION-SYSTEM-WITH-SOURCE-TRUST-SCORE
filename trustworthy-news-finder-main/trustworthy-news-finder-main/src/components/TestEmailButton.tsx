import { useState } from 'react';
import { Send, Loader2, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';

export function TestEmailButton() {
  const { user } = useAuth();
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const sendTestEmail = async () => {
    if (!user) return;

    setSending(true);
    try {
      const { error } = await supabase.functions.invoke('send-low-score-alert', {
        body: {
          user_id: user.id,
          score: 25,
          title: 'Test Article - Verify Your Email Settings',
          url: 'https://example.com/test-article',
          rating: 'Unreliable',
          is_test: true,
        },
      });

      if (error) throw error;

      setSent(true);
      toast({
        title: 'Test email sent!',
        description: 'Check your inbox for the test notification.',
      });

      // Reset after 5 seconds
      setTimeout(() => setSent(false), 5000);
    } catch (error) {
      console.error('Error sending test email:', error);
      toast({
        title: 'Failed to send test email',
        description: 'Please try again later.',
        variant: 'destructive',
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={sendTestEmail}
      disabled={sending || sent}
      className="gap-2"
    >
      {sending ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin" />
          Sending...
        </>
      ) : sent ? (
        <>
          <CheckCircle className="w-4 h-4 text-success" />
          Sent!
        </>
      ) : (
        <>
          <Send className="w-4 h-4" />
          Send Test Email
        </>
      )}
    </Button>
  );
}
