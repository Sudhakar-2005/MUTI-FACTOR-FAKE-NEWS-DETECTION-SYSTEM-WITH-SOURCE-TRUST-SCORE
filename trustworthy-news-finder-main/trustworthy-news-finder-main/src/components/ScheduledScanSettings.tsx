import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Clock, Shield, RefreshCw, AlertTriangle, CheckCircle, Plus, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface ScheduledScanConfig {
  enabled: boolean;
  bookmarkedDomains: string[];
  emailAlerts: boolean;
  browserAlerts: boolean;
  lastScan: string | null;
  lastScanResults: {
    total: number;
    safe: number;
    threats: number;
  } | null;
}

export function ScheduledScanSettings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [config, setConfig] = useState<ScheduledScanConfig>({
    enabled: false,
    bookmarkedDomains: [],
    emailAlerts: true,
    browserAlerts: true,
    lastScan: null,
    lastScanResults: null,
  });
  const [newDomain, setNewDomain] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [userEmail, setUserEmail] = useState('');

  // Load settings from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('scheduled_scan_config');
    if (stored) {
      try {
        setConfig(prev => ({ ...prev, ...JSON.parse(stored) }));
      } catch (e) {
        console.error('Failed to parse scheduled scan config');
      }
    }
    
    // Get user email
    if (user?.email) {
      setUserEmail(user.email);
    }
  }, [user]);

  // Save config to localStorage
  const saveConfig = (updates: Partial<ScheduledScanConfig>) => {
    setConfig(prev => {
      const updated = { ...prev, ...updates };
      localStorage.setItem('scheduled_scan_config', JSON.stringify(updated));
      return updated;
    });
  };

  // Add domain to scan list
  const addDomain = () => {
    if (!newDomain.trim()) return;
    
    let domain = newDomain.trim().toLowerCase();
    // Clean up URL if provided
    try {
      const url = new URL(domain.startsWith('http') ? domain : `https://${domain}`);
      domain = url.hostname.replace(/^www\./, '');
    } catch (e) {
      // Use as-is if not a valid URL
    }

    if (config.bookmarkedDomains.includes(domain)) {
      toast({
        title: 'Domain already added',
        variant: 'destructive',
      });
      return;
    }

    saveConfig({
      bookmarkedDomains: [...config.bookmarkedDomains, domain]
    });
    setNewDomain('');
    toast({
      title: 'Domain added',
      description: `${domain} will be included in scheduled scans`,
    });
  };

  // Remove domain
  const removeDomain = (domain: string) => {
    saveConfig({
      bookmarkedDomains: config.bookmarkedDomains.filter(d => d !== domain)
    });
  };

  // Run manual scan
  const runScanNow = async () => {
    if (config.bookmarkedDomains.length === 0) {
      toast({
        title: 'No domains to scan',
        description: 'Add some domains first',
        variant: 'destructive',
      });
      return;
    }

    setIsScanning(true);

    try {
      const { data, error } = await supabase.functions.invoke('scheduled-scan', {
        body: {
          userId: user?.id,
          bookmarkedDomains: config.bookmarkedDomains,
          email: config.emailAlerts ? userEmail : null,
          sendNotification: config.emailAlerts,
        },
      });

      if (error) throw error;

      saveConfig({
        lastScan: new Date().toISOString(),
        lastScanResults: {
          total: data.summary?.total || config.bookmarkedDomains.length,
          safe: data.summary?.safe || 0,
          threats: data.threatCount || 0,
        },
      });

      // Show browser notification if enabled and there are threats
      if (config.browserAlerts && data.threatCount > 0 && 'Notification' in window && Notification.permission === 'granted') {
        new Notification('🛡️ Scheduled Scan Complete', {
          body: `${data.threatCount} threat(s) detected in your bookmarked sites`,
          icon: '/favicon.ico',
          tag: 'scheduled-scan-result',
        });
      }

      toast({
        title: 'Scan complete',
        description: `Scanned ${data.summary?.total || config.bookmarkedDomains.length} domains. ${data.threatCount || 0} threats found.`,
        variant: data.threatCount > 0 ? 'destructive' : 'default',
      });
    } catch (error: any) {
      console.error('Scan failed:', error);
      toast({
        title: 'Scan failed',
        description: error.message || 'Could not complete the scan',
        variant: 'destructive',
      });
    } finally {
      setIsScanning(false);
    }
  };

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Clock className="h-5 w-5" />
          Scheduled Threat Scanning
        </CardTitle>
        <CardDescription>
          Automatically scan your bookmarked sites daily and get alerts for new threats
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Enable Toggle */}
        <div className="flex items-center justify-between">
          <div className="flex items-start gap-3">
            <Shield className={`h-5 w-5 mt-0.5 ${config.enabled ? 'text-primary' : 'text-muted-foreground'}`} />
            <div className="space-y-0.5">
              <Label htmlFor="scheduled-scan" className="text-base font-medium">
                Enable Daily Scans
              </Label>
              <p className="text-sm text-muted-foreground">
                Automatically check bookmarked sites every 24 hours
              </p>
            </div>
          </div>
          <Switch
            id="scheduled-scan"
            checked={config.enabled}
            onCheckedChange={(checked) => saveConfig({ enabled: checked })}
          />
        </div>

        {/* Alert preferences */}
        <div className="space-y-3 pl-8">
          <div className="flex items-center justify-between">
            <Label className="text-sm">Email alerts for threats</Label>
            <Switch
              checked={config.emailAlerts}
              onCheckedChange={(checked) => saveConfig({ emailAlerts: checked })}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label className="text-sm">Browser notifications</Label>
            <Switch
              checked={config.browserAlerts}
              onCheckedChange={(checked) => saveConfig({ browserAlerts: checked })}
            />
          </div>
        </div>

        {/* Domain list */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">Sites to Monitor ({config.bookmarkedDomains.length})</Label>
          
          <div className="flex gap-2">
            <Input
              placeholder="Enter domain (e.g., example.com)"
              value={newDomain}
              onChange={(e) => setNewDomain(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addDomain()}
              className="flex-1"
            />
            <Button onClick={addDomain} size="icon" variant="outline">
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          {config.bookmarkedDomains.length > 0 && (
            <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-2 bg-secondary/20 rounded-lg">
              {config.bookmarkedDomains.map((domain) => (
                <Badge key={domain} variant="secondary" className="gap-1">
                  {domain}
                  <button
                    onClick={() => removeDomain(domain)}
                    className="ml-1 hover:text-destructive"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </div>

        {/* Last scan results */}
        {config.lastScan && config.lastScanResults && (
          <div className="p-3 bg-secondary/30 rounded-lg space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Last scan:</span>
              <span>{new Date(config.lastScan).toLocaleString()}</span>
            </div>
            <div className="flex gap-3">
              <div className="flex items-center gap-1 text-sm">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span>{config.lastScanResults.safe} safe</span>
              </div>
              {config.lastScanResults.threats > 0 && (
                <div className="flex items-center gap-1 text-sm text-destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <span>{config.lastScanResults.threats} threats</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Manual scan button */}
        <Button
          onClick={runScanNow}
          disabled={isScanning || config.bookmarkedDomains.length === 0}
          className="w-full"
          variant="outline"
        >
          {isScanning ? (
            <>
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              Scanning...
            </>
          ) : (
            <>
              <RefreshCw className="h-4 w-4 mr-2" />
              Run Scan Now
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
