import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Bell, BellOff, AlertCircle, Volume2, Shield, Clock, AlertTriangle } from 'lucide-react';
import { useBrowserNotifications } from '@/hooks/useBrowserNotifications';
import { toast } from '@/hooks/use-toast';

export function BrowserNotificationSettings() {
  const {
    isSupported,
    permission,
    preferences,
    updatePreferences,
    enableNotifications,
    showNotification,
    playAlertSound,
  } = useBrowserNotifications();

  const handleEnableNotifications = async () => {
    const granted = await enableNotifications();
    if (granted) {
      toast({
        title: 'Notifications enabled',
        description: "You'll receive real-time browser alerts for threats",
      });
      // Show a test notification
      showNotification('🛡️ Notifications Enabled', 'You will now receive real-time threat alerts', {
        type: 'info',
        tag: 'test-notification',
      });
    } else {
      toast({
        title: 'Permission denied',
        description: 'Enable notifications in your browser settings',
        variant: 'destructive',
      });
    }
  };

  const handleTestNotification = () => {
    if (permission !== 'granted') {
      toast({
        title: 'Notifications not enabled',
        description: 'Enable notifications first to test',
        variant: 'destructive',
      });
      return;
    }

    showNotification(
      '🚨 Test Alert',
      'This is a sample threat notification. Real alerts will show threat details.',
      {
        type: 'warning',
        tag: 'test-alert',
      }
    );
    
    toast({
      title: 'Test notification sent',
      description: 'Check your browser notifications',
    });
  };

  const handleTestSound = () => {
    playAlertSound('warning');
    toast({
      title: 'Sound played',
      description: 'Alert sound test complete',
    });
  };

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Bell className="h-5 w-5" />
          Browser Notifications
        </CardTitle>
        <CardDescription>
          Get real-time threat alerts directly in your browser without email
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Main enable toggle */}
        <div className="flex items-center justify-between">
          <div className="flex items-start gap-3">
            {preferences.enabled && permission === 'granted' ? (
              <Bell className="h-5 w-5 text-primary mt-0.5" />
            ) : (
              <BellOff className="h-5 w-5 text-muted-foreground mt-0.5" />
            )}
            <div className="space-y-0.5">
              <Label htmlFor="browser-notifications" className="text-base font-medium">
                Enable Browser Notifications
              </Label>
              <p className="text-sm text-muted-foreground">
                Receive instant alerts even when the tab is in background
              </p>
            </div>
          </div>
          {isSupported ? (
            permission === 'granted' ? (
              <Switch
                id="browser-notifications"
                checked={preferences.enabled}
                onCheckedChange={(checked) => updatePreferences({ enabled: checked })}
              />
            ) : permission === 'denied' ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <AlertCircle className="h-4 w-4" />
                Blocked
              </div>
            ) : (
              <Button variant="outline" size="sm" onClick={handleEnableNotifications}>
                Enable
              </Button>
            )
          ) : (
            <div className="text-xs text-muted-foreground">Not supported</div>
          )}
        </div>

        {/* Sub-settings (only show if enabled) */}
        {preferences.enabled && permission === 'granted' && (
          <div className="space-y-4 pl-8 border-l-2 border-primary/20">
            {/* Sound toggle */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Volume2 className="h-4 w-4 text-muted-foreground" />
                <Label className="text-sm">Play alert sounds</Label>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={handleTestSound}>
                  Test
                </Button>
                <Switch
                  checked={preferences.soundEnabled}
                  onCheckedChange={(checked) => updatePreferences({ soundEnabled: checked })}
                />
              </div>
            </div>

            {/* Threat alerts */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-muted-foreground" />
                <Label className="text-sm">Threat detection alerts</Label>
              </div>
              <Switch
                checked={preferences.threatAlertsEnabled}
                onCheckedChange={(checked) => updatePreferences({ threatAlertsEnabled: checked })}
              />
            </div>

            {/* Low score alerts */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                <Label className="text-sm">Low trust score alerts</Label>
              </div>
              <Switch
                checked={preferences.lowScoreAlertsEnabled}
                onCheckedChange={(checked) => updatePreferences({ lowScoreAlertsEnabled: checked })}
              />
            </div>

            {/* Scheduled scan alerts */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <Label className="text-sm">Scheduled scan results</Label>
              </div>
              <Switch
                checked={preferences.scheduledScanAlertsEnabled}
                onCheckedChange={(checked) => updatePreferences({ scheduledScanAlertsEnabled: checked })}
              />
            </div>
          </div>
        )}

        {/* Test button */}
        {preferences.enabled && permission === 'granted' && (
          <Button variant="outline" size="sm" className="w-full" onClick={handleTestNotification}>
            Send Test Notification
          </Button>
        )}

        {/* Info */}
        <div className="p-3 bg-secondary/30 rounded-lg">
          <p className="text-xs text-muted-foreground">
            Browser notifications work instantly without requiring email setup. 
            Critical threats will require you to dismiss the notification manually.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
