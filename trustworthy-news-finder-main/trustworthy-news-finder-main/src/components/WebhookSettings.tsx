import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Webhook, Trash2, Plus, Send, AlertTriangle, CheckCircle, Slack } from 'lucide-react';

interface WebhookConfig {
  id: string;
  name: string;
  type: 'slack' | 'discord' | 'custom';
  url: string;
  secret?: string;
  events: string[];
  enabled: boolean;
  last_triggered_at: string | null;
  failure_count: number;
  created_at: string;
}

const EVENT_OPTIONS = [
  { value: 'threat_detected', label: 'Threat Detected' },
  { value: 'scan_completed', label: 'Scan Completed' },
  { value: 'score_degraded', label: 'Score Degraded' },
  { value: 'critical_alert', label: 'Critical Alert' },
];

export function WebhookSettings() {
  const { user } = useAuth();
  const [webhooks, setWebhooks] = useState<WebhookConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);

  // Form state
  const [newWebhook, setNewWebhook] = useState({
    name: '',
    type: 'slack' as 'slack' | 'discord' | 'custom',
    url: '',
    secret: '',
    events: ['threat_detected']
  });

  useEffect(() => {
    if (user) {
      fetchWebhooks();
    }
  }, [user]);

  const fetchWebhooks = async () => {
    try {
      const { data, error } = await supabase
        .from('webhooks')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setWebhooks((data as WebhookConfig[]) || []);
    } catch (error) {
      console.error('Failed to fetch webhooks:', error);
      toast.error('Failed to load webhooks');
    } finally {
      setLoading(false);
    }
  };

  const createWebhook = async () => {
    if (!newWebhook.name.trim() || !newWebhook.url.trim()) {
      toast.error('Please enter a name and URL');
      return;
    }

    try {
      const { error } = await supabase.from('webhooks').insert({
        user_id: user?.id,
        name: newWebhook.name.trim(),
        type: newWebhook.type,
        url: newWebhook.url.trim(),
        secret: newWebhook.secret.trim() || null,
        events: newWebhook.events
      });

      if (error) throw error;

      setNewWebhook({ name: '', type: 'slack', url: '', secret: '', events: ['threat_detected'] });
      setShowAddForm(false);
      fetchWebhooks();
      toast.success('Webhook created successfully');
    } catch (error) {
      console.error('Failed to create webhook:', error);
      toast.error('Failed to create webhook');
    }
  };

  const deleteWebhook = async (id: string) => {
    try {
      const { error } = await supabase.from('webhooks').delete().eq('id', id);
      if (error) throw error;
      setWebhooks(prev => prev.filter(w => w.id !== id));
      toast.success('Webhook deleted');
    } catch (error) {
      console.error('Failed to delete webhook:', error);
      toast.error('Failed to delete webhook');
    }
  };

  const toggleWebhook = async (id: string, enabled: boolean) => {
    try {
      const { error } = await supabase
        .from('webhooks')
        .update({ enabled })
        .eq('id', id);

      if (error) throw error;

      setWebhooks(prev => prev.map(w => w.id === id ? { ...w, enabled } : w));
      toast.success(enabled ? 'Webhook enabled' : 'Webhook disabled');
    } catch (error) {
      console.error('Failed to update webhook:', error);
      toast.error('Failed to update webhook');
    }
  };

  const testWebhook = async (webhook: WebhookConfig) => {
    setTesting(webhook.id);
    try {
      const { error } = await supabase.functions.invoke('send-webhook', {
        body: {
          userId: user?.id,
          event: 'test',
          webhookIds: [webhook.id],
          data: {
            domain: 'test-domain.com',
            score: 35,
            riskLevel: 'high',
            threats: ['Phishing keywords detected', 'Suspicious TLD'],
            message: 'This is a test alert from TrustGuard'
          }
        }
      });

      if (error) throw error;
      toast.success('Test webhook sent successfully');
    } catch (error) {
      console.error('Failed to test webhook:', error);
      toast.error('Failed to send test webhook');
    } finally {
      setTesting(null);
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'slack': return <Slack className="w-4 h-4" />;
      case 'discord': return <span className="text-sm">🎮</span>;
      default: return <Webhook className="w-4 h-4" />;
    }
  };

  if (loading) {
    return (
      <Card className="bg-card/50 border-border/50">
        <CardContent className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card/50 border-border/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Webhook className="w-5 h-5 text-primary" />
          Webhook Notifications
        </CardTitle>
        <CardDescription>
          Send threat alerts to Slack, Discord, or custom endpoints
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Add webhook button/form */}
        {!showAddForm ? (
          <Button onClick={() => setShowAddForm(true)} variant="outline">
            <Plus className="w-4 h-4 mr-2" />
            Add Webhook
          </Button>
        ) : (
          <div className="p-4 rounded-lg border border-border/50 bg-secondary/20 space-y-4">
            <h4 className="font-medium text-foreground">New Webhook</h4>
            
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="webhook-name">Name</Label>
                <Input
                  id="webhook-name"
                  placeholder="e.g., Security Alerts Channel"
                  value={newWebhook.name}
                  onChange={(e) => setNewWebhook(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="webhook-type">Type</Label>
                <Select
                  value={newWebhook.type}
                  onValueChange={(value: 'slack' | 'discord' | 'custom') => 
                    setNewWebhook(prev => ({ ...prev, type: value }))
                  }
                >
                  <SelectTrigger id="webhook-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="slack">Slack</SelectItem>
                    <SelectItem value="discord">Discord</SelectItem>
                    <SelectItem value="custom">Custom HTTP</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="webhook-url">
                {newWebhook.type === 'slack' ? 'Slack Webhook URL' : 
                 newWebhook.type === 'discord' ? 'Discord Webhook URL' : 
                 'Endpoint URL'}
              </Label>
              <Input
                id="webhook-url"
                type="url"
                placeholder={
                  newWebhook.type === 'slack' ? 'https://hooks.slack.com/services/...' :
                  newWebhook.type === 'discord' ? 'https://discord.com/api/webhooks/...' :
                  'https://your-api.com/webhook'
                }
                value={newWebhook.url}
                onChange={(e) => setNewWebhook(prev => ({ ...prev, url: e.target.value }))}
              />
            </div>

            {newWebhook.type === 'custom' && (
              <div className="space-y-2">
                <Label htmlFor="webhook-secret">Signing Secret (optional)</Label>
                <Input
                  id="webhook-secret"
                  type="password"
                  placeholder="Used to verify webhook authenticity"
                  value={newWebhook.secret}
                  onChange={(e) => setNewWebhook(prev => ({ ...prev, secret: e.target.value }))}
                />
              </div>
            )}

            <div className="space-y-2">
              <Label>Events</Label>
              <div className="flex flex-wrap gap-2">
                {EVENT_OPTIONS.map(event => (
                  <Badge
                    key={event.value}
                    variant={newWebhook.events.includes(event.value) ? 'default' : 'outline'}
                    className="cursor-pointer"
                    onClick={() => {
                      setNewWebhook(prev => ({
                        ...prev,
                        events: prev.events.includes(event.value)
                          ? prev.events.filter(e => e !== event.value)
                          : [...prev.events, event.value]
                      }));
                    }}
                  >
                    {event.label}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="flex gap-2">
              <Button onClick={createWebhook}>Create Webhook</Button>
              <Button variant="ghost" onClick={() => setShowAddForm(false)}>Cancel</Button>
            </div>
          </div>
        )}

        {/* Existing webhooks */}
        <div className="space-y-3">
          {webhooks.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No webhooks configured yet
            </p>
          ) : (
            webhooks.map((webhook) => (
              <div
                key={webhook.id}
                className="p-4 rounded-lg border border-border/50 bg-secondary/10 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-secondary/50">
                      {getTypeIcon(webhook.type)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-foreground">{webhook.name}</span>
                        <Badge variant="outline" className="text-xs capitalize">
                          {webhook.type}
                        </Badge>
                        {webhook.failure_count > 2 && (
                          <Badge variant="destructive" className="text-xs">
                            <AlertTriangle className="w-3 h-3 mr-1" />
                            Failing
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate max-w-xs">
                        {webhook.url}
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={webhook.enabled}
                    onCheckedChange={(checked) => toggleWebhook(webhook.id, checked)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex flex-wrap gap-1">
                    {webhook.events.map(event => (
                      <Badge key={event} variant="secondary" className="text-xs">
                        {EVENT_OPTIONS.find(e => e.value === event)?.label || event}
                      </Badge>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    {webhook.last_triggered_at && (
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <CheckCircle className="w-3 h-3 text-success" />
                        Last sent {new Date(webhook.last_triggered_at).toLocaleDateString()}
                      </span>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => testWebhook(webhook)}
                      disabled={testing === webhook.id}
                    >
                      <Send className="w-4 h-4 mr-1" />
                      {testing === webhook.id ? 'Sending...' : 'Test'}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => deleteWebhook(webhook.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
