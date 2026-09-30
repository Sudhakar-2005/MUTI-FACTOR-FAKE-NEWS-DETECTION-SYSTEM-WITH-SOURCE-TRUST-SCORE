import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertTriangle, Mail, Loader2, Save, Bell, Shield } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';

interface ThreatAlertSettings {
  enabled: boolean;
  email: string;
  minRiskLevel: 'low' | 'medium' | 'high' | 'critical';
  instantAlerts: boolean;
}

export function ThreatAlertSettings() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<ThreatAlertSettings>({
    enabled: false,
    email: '',
    minRiskLevel: 'high',
    instantAlerts: true,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingSending, setTestSending] = useState(false);

  useEffect(() => {
    if (user) {
      loadSettings();
    }
  }, [user]);

  const loadSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('email')
        .eq('user_id', user?.id)
        .maybeSingle();

      if (error) throw error;
      
      // Load from localStorage for now (could be extended to profiles table)
      const savedSettings = localStorage.getItem(`threat_alert_settings_${user?.id}`);
      if (savedSettings) {
        setSettings(JSON.parse(savedSettings));
      } else if (data?.email || user?.email) {
        setSettings(prev => ({
          ...prev,
          email: data?.email || user?.email || '',
        }));
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!settings.email && settings.enabled) {
      toast({
        title: 'Email required',
        description: 'Please enter an email address for threat alerts',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    try {
      // Save to localStorage (could be extended to Supabase)
      localStorage.setItem(`threat_alert_settings_${user?.id}`, JSON.stringify(settings));
      
      toast({
        title: 'Settings saved',
        description: 'Your threat alert preferences have been updated',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to save settings',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const sendTestAlert = async () => {
    if (!settings.email) {
      toast({
        title: 'Email required',
        description: 'Please enter an email address first',
        variant: 'destructive',
      });
      return;
    }

    setTestSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-threat-alert', {
        body: {
          email: settings.email,
          domain: 'test-domain.example.com',
          riskLevel: 'high',
          threatCount: 3,
          overallScore: 25,
          threats: [
            {
              source: 'URLhaus',
              type: 'Malware Distribution',
              severity: 'high',
              description: 'This is a test threat alert. No actual threat detected.'
            },
            {
              source: 'Heuristic Analysis',
              type: 'Suspicious Pattern',
              severity: 'medium',
              description: 'Domain uses patterns commonly associated with phishing.'
            },
            {
              source: 'ThreatFox',
              type: 'IOC Match',
              severity: 'high',
              description: 'Known indicator of compromise detected.'
            }
          ],
          recommendations: [
            {
              action: 'Avoid this site completely',
              reason: 'Multiple threat indicators detected from trusted security sources',
              priority: 'high'
            },
            {
              action: 'Run a malware scan',
              reason: 'If you visited this site, scan your device for potential infections',
              priority: 'medium'
            }
          ]
        }
      });

      if (error) throw error;

      toast({
        title: 'Test alert sent!',
        description: `Check your inbox at ${settings.email}`,
      });
    } catch (error: any) {
      console.error('Test alert error:', error);
      toast({
        title: 'Failed to send test',
        description: error.message || 'Could not send test alert',
        variant: 'destructive',
      });
    } finally {
      setTestSending(false);
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
        <CardTitle className="flex items-center gap-2 text-lg">
          <AlertTriangle className="h-5 w-5 text-orange-500" />
          Threat Alert Emails
        </CardTitle>
        <CardDescription>
          Get notified when you visit potentially dangerous sites
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Enable/Disable */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label className="text-base">Enable Email Alerts</Label>
            <p className="text-sm text-muted-foreground">
              Receive emails when threats are detected
            </p>
          </div>
          <Switch
            checked={settings.enabled}
            onCheckedChange={(enabled) => setSettings({ ...settings, enabled })}
          />
        </div>

        {settings.enabled && (
          <>
            {/* Email Address */}
            <div className="space-y-2">
              <Label htmlFor="alertEmail">Alert Email Address</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="alertEmail"
                    type="email"
                    value={settings.email}
                    onChange={(e) => setSettings({ ...settings, email: e.target.value })}
                    placeholder="your@email.com"
                    className="pl-10"
                  />
                </div>
              </div>
            </div>

            {/* Minimum Risk Level */}
            <div className="space-y-2">
              <Label>Minimum Risk Level for Alerts</Label>
              <Select
                value={settings.minRiskLevel}
                onValueChange={(value: 'low' | 'medium' | 'high' | 'critical') => 
                  setSettings({ ...settings, minRiskLevel: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low and above</SelectItem>
                  <SelectItem value="medium">Medium and above</SelectItem>
                  <SelectItem value="high">High and above</SelectItem>
                  <SelectItem value="critical">Critical only</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                You'll only receive alerts for threats at or above this level
              </p>
            </div>

            {/* Instant Alerts */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Instant Alerts</Label>
                <p className="text-sm text-muted-foreground">
                  Send email immediately when threat is detected
                </p>
              </div>
              <Switch
                checked={settings.instantAlerts}
                onCheckedChange={(instantAlerts) => setSettings({ ...settings, instantAlerts })}
              />
            </div>

            {/* Test Alert */}
            <div className="pt-4 border-t border-border/50">
              <Button
                variant="outline"
                onClick={sendTestAlert}
                disabled={testingSending || !settings.email}
                className="w-full gap-2"
              >
                {testingSending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Bell className="h-4 w-4" />
                    Send Test Alert
                  </>
                )}
              </Button>
              <p className="text-xs text-muted-foreground text-center mt-2">
                Send a sample threat alert to verify your email
              </p>
            </div>
          </>
        )}

        {/* Save Button */}
        <Button
          onClick={handleSave}
          disabled={saving}
          className="w-full gap-2"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Save Alert Settings
        </Button>
      </CardContent>
    </Card>
  );
}
