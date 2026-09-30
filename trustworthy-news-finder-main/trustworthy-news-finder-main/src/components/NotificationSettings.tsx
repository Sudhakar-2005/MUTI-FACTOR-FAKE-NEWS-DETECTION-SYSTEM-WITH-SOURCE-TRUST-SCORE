import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Volume2, VolumeX, Bell, BellOff, AlertCircle } from 'lucide-react';
import { useNotificationSound } from '@/hooks/useNotificationSound';
import { toast } from '@/hooks/use-toast';

export function NotificationSettings() {
  const {
    preferences,
    updatePreferences,
    enablePush,
    pushSupported,
    pushPermission,
    playAlertSound,
  } = useNotificationSound();

  const handleEnablePush = async () => {
    const granted = await enablePush();
    if (granted) {
      toast({
        title: 'Push notifications enabled',
        description: "You'll receive alerts for low-trust content",
      });
    } else {
      toast({
        title: 'Permission denied',
        description: 'Enable notifications in your browser settings',
        variant: 'destructive',
      });
    }
  };

  const handleTestSound = () => {
    playAlertSound();
    toast({
      title: 'Sound test',
      description: 'Alert sound played',
    });
  };

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Bell className="h-5 w-5" />
          Alert Notifications
        </CardTitle>
        <CardDescription>
          Get instant alerts when analyzing suspicious content
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Sound Alerts */}
        <div className="flex items-center justify-between">
          <div className="flex items-start gap-3">
            {preferences.sound_enabled ? (
              <Volume2 className="h-5 w-5 text-primary mt-0.5" />
            ) : (
              <VolumeX className="h-5 w-5 text-muted-foreground mt-0.5" />
            )}
            <div className="space-y-0.5">
              <Label htmlFor="sound-alerts" className="text-base font-medium">
                Sound Alerts
              </Label>
              <p className="text-sm text-muted-foreground">
                Play an alert sound for low-trust content
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleTestSound}
              className="text-xs"
            >
              Test
            </Button>
            <Switch
              id="sound-alerts"
              checked={preferences.sound_enabled}
              onCheckedChange={(checked) => updatePreferences({ sound_enabled: checked })}
            />
          </div>
        </div>

        {/* Push Notifications */}
        <div className="flex items-center justify-between">
          <div className="flex items-start gap-3">
            {preferences.push_enabled && pushPermission === 'granted' ? (
              <Bell className="h-5 w-5 text-primary mt-0.5" />
            ) : (
              <BellOff className="h-5 w-5 text-muted-foreground mt-0.5" />
            )}
            <div className="space-y-0.5">
              <Label htmlFor="push-alerts" className="text-base font-medium">
                Browser Push Notifications
              </Label>
              <p className="text-sm text-muted-foreground">
                Receive alerts even when the tab is in background
              </p>
            </div>
          </div>
          {pushSupported ? (
            pushPermission === 'granted' ? (
              <Switch
                id="push-alerts"
                checked={preferences.push_enabled}
                onCheckedChange={(checked) => updatePreferences({ push_enabled: checked })}
              />
            ) : pushPermission === 'denied' ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <AlertCircle className="h-4 w-4" />
                Blocked
              </div>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={handleEnablePush}
              >
                Enable
              </Button>
            )
          ) : (
            <div className="text-xs text-muted-foreground">
              Not supported
            </div>
          )}
        </div>

        {/* Info */}
        <div className="p-3 bg-secondary/30 rounded-lg">
          <p className="text-xs text-muted-foreground">
            Alerts trigger when content scores below your threshold (set in Email Preferences).
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
