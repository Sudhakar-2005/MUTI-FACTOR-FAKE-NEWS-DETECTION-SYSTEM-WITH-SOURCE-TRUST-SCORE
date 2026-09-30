import { useState, useEffect } from 'react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Mail, Loader2, Bell, Calendar, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { TestEmailButton } from './TestEmailButton';

interface Preferences {
  weekly_digest_enabled: boolean;
  daily_summary_enabled: boolean;
  low_score_alerts_enabled: boolean;
  low_score_threshold: number;
}

export function EmailPreferences() {
  const { user } = useAuth();
  const [preferences, setPreferences] = useState<Preferences>({
    weekly_digest_enabled: true,
    daily_summary_enabled: false,
    low_score_alerts_enabled: true,
    low_score_threshold: 40,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      fetchPreferences();
    }
  }, [user]);

  const fetchPreferences = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('weekly_digest_enabled, daily_summary_enabled, low_score_alerts_enabled, low_score_threshold')
        .eq('user_id', user?.id)
        .maybeSingle();

      if (error) throw error;
      if (data) {
        setPreferences({
          weekly_digest_enabled: data.weekly_digest_enabled ?? true,
          daily_summary_enabled: data.daily_summary_enabled ?? false,
          low_score_alerts_enabled: data.low_score_alerts_enabled ?? true,
          low_score_threshold: data.low_score_threshold ?? 40,
        });
      }
    } catch (error) {
      console.error('Error fetching preferences:', error);
    } finally {
      setLoading(false);
    }
  };

  const updatePreference = async (key: keyof Preferences, value: boolean | number) => {
    setSaving(key);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ [key]: value })
        .eq('user_id', user?.id);

      if (error) throw error;
      
      setPreferences(prev => ({ ...prev, [key]: value }));
      
      const messages: Record<string, { on: string; off: string }> = {
        weekly_digest_enabled: {
          on: 'Weekly digest enabled - summaries every Monday',
          off: 'Weekly digest disabled',
        },
        daily_summary_enabled: {
          on: 'Daily summary enabled - expect emails at 9 AM',
          off: 'Daily summary disabled',
        },
        low_score_alerts_enabled: {
          on: 'Low score alerts enabled',
          off: 'Low score alerts disabled',
        },
      };

      if (typeof value === 'boolean' && messages[key]) {
        toast({
          title: value ? 'Preference enabled' : 'Preference disabled',
          description: value ? messages[key].on : messages[key].off,
        });
      } else if (key === 'low_score_threshold') {
        toast({
          title: 'Threshold updated',
          description: `You'll be alerted for scores below ${value}`,
        });
      }
    } catch (error) {
      console.error('Error updating preference:', error);
      toast({
        title: 'Error',
        description: 'Failed to update preference.',
        variant: 'destructive',
      });
    } finally {
      setSaving(null);
    }
  };

  if (loading) {
    return (
      <Card className="border-border/50">
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Mail className="h-5 w-5" />
              Email Preferences
            </CardTitle>
            <CardDescription>
              Manage your email notification settings
            </CardDescription>
          </div>
          <TestEmailButton />
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Weekly Digest */}
        <div className="flex items-center justify-between">
          <div className="flex items-start gap-3">
            <Calendar className="h-5 w-5 text-primary mt-0.5" />
            <div className="space-y-0.5">
              <Label htmlFor="weekly-digest" className="text-base font-medium">
                Weekly Digest
              </Label>
              <p className="text-sm text-muted-foreground">
                Summary of your activity every Monday at 9 AM
              </p>
            </div>
          </div>
          <Switch
            id="weekly-digest"
            checked={preferences.weekly_digest_enabled}
            onCheckedChange={(checked) => updatePreference('weekly_digest_enabled', checked)}
            disabled={saving === 'weekly_digest_enabled'}
          />
        </div>

        {/* Daily Summary */}
        <div className="flex items-center justify-between">
          <div className="flex items-start gap-3">
            <Bell className="h-5 w-5 text-primary mt-0.5" />
            <div className="space-y-0.5">
              <Label htmlFor="daily-summary" className="text-base font-medium">
                Daily Summary
              </Label>
              <p className="text-sm text-muted-foreground">
                Get a brief recap of yesterday's analyses each morning
              </p>
            </div>
          </div>
          <Switch
            id="daily-summary"
            checked={preferences.daily_summary_enabled}
            onCheckedChange={(checked) => updatePreference('daily_summary_enabled', checked)}
            disabled={saving === 'daily_summary_enabled'}
          />
        </div>

        {/* Low Score Alerts */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-destructive mt-0.5" />
              <div className="space-y-0.5">
                <Label htmlFor="low-score-alerts" className="text-base font-medium">
                  Low Score Alerts
                </Label>
                <p className="text-sm text-muted-foreground">
                  Get notified when content scores below your threshold
                </p>
              </div>
            </div>
            <Switch
              id="low-score-alerts"
              checked={preferences.low_score_alerts_enabled}
              onCheckedChange={(checked) => updatePreference('low_score_alerts_enabled', checked)}
              disabled={saving === 'low_score_alerts_enabled'}
            />
          </div>

          {preferences.low_score_alerts_enabled && (
            <div className="ml-8 space-y-3 animate-fade-in">
              <div className="flex items-center justify-between">
                <Label className="text-sm text-muted-foreground">
                  Alert threshold
                </Label>
                <span className="text-sm font-medium text-destructive">
                  Below {preferences.low_score_threshold}
                </span>
              </div>
              <Slider
                value={[preferences.low_score_threshold]}
                onValueCommit={(value) => updatePreference('low_score_threshold', value[0])}
                min={10}
                max={70}
                step={5}
                className="w-full"
                disabled={saving === 'low_score_threshold'}
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Very strict (10)</span>
                <span>Lenient (70)</span>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
