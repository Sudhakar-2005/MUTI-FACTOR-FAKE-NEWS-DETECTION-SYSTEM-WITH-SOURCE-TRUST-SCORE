import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Key, Copy, Trash2, Plus, Eye, EyeOff, Calendar, Activity, Download, FileJson, FileSpreadsheet } from 'lucide-react';
import { format } from 'date-fns';
interface ApiKey {
  id: string;
  name: string;
  key_prefix: string;
  permissions: string[];
  rate_limit: number;
  requests_today: number;
  last_used_at: string | null;
  expires_at: string | null;
  created_at: string;
  revoked_at: string | null;
}

export function ApiKeyManagement() {
  const { user } = useAuth();
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [newKeyName, setNewKeyName] = useState('');
  const [creating, setCreating] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [showKey, setShowKey] = useState(false);

  useEffect(() => {
    if (user) {
      fetchApiKeys();
    }
  }, [user]);

  const fetchApiKeys = async () => {
    try {
      const { data, error } = await supabase
        .from('api_keys')
        .select('*')
        .eq('user_id', user?.id)
        .is('revoked_at', null)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setApiKeys((data as ApiKey[]) || []);
    } catch (error) {
      console.error('Failed to fetch API keys:', error);
      toast.error('Failed to load API keys');
    } finally {
      setLoading(false);
    }
  };

  const generateApiKey = async () => {
    if (!newKeyName.trim()) {
      toast.error('Please enter a name for the API key');
      return;
    }

    setCreating(true);
    try {
      // Generate a random API key
      const keyBytes = new Uint8Array(32);
      crypto.getRandomValues(keyBytes);
      const rawKey = Array.from(keyBytes).map(b => b.toString(16).padStart(2, '0')).join('');
      const fullKey = `tg_${rawKey}`;
      const keyPrefix = fullKey.substring(0, 8);

      // Hash the key for storage
      const encoder = new TextEncoder();
      const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(fullKey));
      const keyHash = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');

      const { error } = await supabase.from('api_keys').insert({
        user_id: user?.id,
        name: newKeyName.trim(),
        key_hash: keyHash,
        key_prefix: keyPrefix,
        permissions: ['read'],
        rate_limit: 1000
      });

      if (error) throw error;

      setNewKey(fullKey);
      setNewKeyName('');
      fetchApiKeys();
      toast.success('API key created successfully');
    } catch (error) {
      console.error('Failed to create API key:', error);
      toast.error('Failed to create API key');
    } finally {
      setCreating(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  const revokeKey = async (keyId: string) => {
    try {
      const { error } = await supabase
        .from('api_keys')
        .update({ revoked_at: new Date().toISOString() })
        .eq('id', keyId);

      if (error) throw error;

      setApiKeys(prev => prev.filter(k => k.id !== keyId));
      toast.success('API key revoked');
    } catch (error) {
      console.error('Failed to revoke API key:', error);
      toast.error('Failed to revoke API key');
    }
  };

  const exportApiUsageAsCSV = () => {
    if (apiKeys.length === 0) {
      toast.error('No API keys to export');
      return;
    }
    
    const headers = ['Name', 'Key Prefix', 'Permissions', 'Rate Limit', 'Requests Today', 'Last Used', 'Created At', 'Expires At'];
    const rows = apiKeys.map(key => [
      key.name,
      key.key_prefix,
      (key.permissions || []).join(';'),
      key.rate_limit,
      key.requests_today || 0,
      key.last_used_at ? format(new Date(key.last_used_at), 'yyyy-MM-dd HH:mm:ss') : 'Never',
      format(new Date(key.created_at), 'yyyy-MM-dd HH:mm:ss'),
      key.expires_at ? format(new Date(key.expires_at), 'yyyy-MM-dd HH:mm:ss') : 'Never'
    ]);
    
    const csvContent = [headers.join(','), ...rows.map(r => r.map(v => `"${v}"`).join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `api-usage-report-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('API usage report exported as CSV');
  };

  const exportApiUsageAsJSON = () => {
    if (apiKeys.length === 0) {
      toast.error('No API keys to export');
      return;
    }
    
    const exportData = {
      exportedAt: new Date().toISOString(),
      totalKeys: apiKeys.length,
      totalRequestsToday: apiKeys.reduce((sum, k) => sum + (k.requests_today || 0), 0),
      keys: apiKeys.map(key => ({
        name: key.name,
        keyPrefix: key.key_prefix,
        permissions: key.permissions,
        rateLimit: key.rate_limit,
        requestsToday: key.requests_today || 0,
        lastUsedAt: key.last_used_at,
        createdAt: key.created_at,
        expiresAt: key.expires_at
      }))
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `api-usage-report-${format(new Date(), 'yyyy-MM-dd')}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('API usage report exported as JSON');
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
          <Key className="w-5 h-5 text-primary" />
          API Key Management
        </CardTitle>
        <CardDescription>
          Create and manage API keys for accessing the Threat Intelligence API
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Create new key */}
        <div className="p-4 rounded-lg border border-border/50 bg-secondary/20 space-y-4">
          <h4 className="font-medium text-foreground">Create New API Key</h4>
          <div className="flex gap-3">
            <div className="flex-1">
              <Label htmlFor="key-name" className="sr-only">API Key Name</Label>
              <Input
                id="key-name"
                placeholder="Enter a name for this key (e.g., Production, Testing)"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
              />
            </div>
            <Button onClick={generateApiKey} disabled={creating}>
              <Plus className="w-4 h-4 mr-2" />
              {creating ? 'Creating...' : 'Create Key'}
            </Button>
          </div>

          {newKey && (
            <div className="p-4 rounded-lg bg-primary/10 border border-primary/30 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-primary">Your new API key (copy it now!):</p>
                <Button variant="ghost" size="sm" onClick={() => setShowKey(!showKey)}>
                  {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <code className="flex-1 p-2 rounded bg-background font-mono text-sm break-all">
                  {showKey ? newKey : '••••••••••••••••••••••••••••••••'}
                </code>
                <Button variant="outline" size="sm" onClick={() => copyToClipboard(newKey)}>
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                ⚠️ This key will only be shown once. Store it securely.
              </p>
            </div>
          )}
        </div>

        {/* API Usage Info */}
        <div className="p-4 rounded-lg bg-secondary/30 space-y-2">
          <h4 className="font-medium text-foreground">API Usage</h4>
          <p className="text-sm text-muted-foreground">
            Use your API key in the <code className="px-1 py-0.5 rounded bg-secondary">X-API-Key</code> header:
          </p>
          <code className="block p-3 rounded bg-background text-xs font-mono overflow-x-auto">
            curl -H "X-API-Key: your_api_key" \<br />
            &nbsp;&nbsp;"{window.location.origin}/functions/v1/threat-intelligence?domain=example.com"
          </code>
        </div>

        {/* Export Options */}
        <div className="p-4 rounded-lg border border-border/50 bg-secondary/20 space-y-3">
          <h4 className="font-medium text-foreground flex items-center gap-2">
            <Download className="w-4 h-4" />
            Export API Usage Report
          </h4>
          <p className="text-sm text-muted-foreground">
            Download a report of your API keys and usage statistics.
          </p>
          <div className="flex gap-3">
            <Button variant="outline" size="sm" onClick={exportApiUsageAsCSV} className="gap-2">
              <FileSpreadsheet className="w-4 h-4" />
              Export CSV
            </Button>
            <Button variant="outline" size="sm" onClick={exportApiUsageAsJSON} className="gap-2">
              <FileJson className="w-4 h-4" />
              Export JSON
            </Button>
          </div>
        </div>

        {/* Existing keys */}
        <div className="space-y-3">
          <h4 className="font-medium text-foreground">Your API Keys</h4>
          {apiKeys.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No API keys created yet
            </p>
          ) : (
            <div className="space-y-3">
              {apiKeys.map((key) => (
                <div
                  key={key.id}
                  className="flex items-center justify-between p-4 rounded-lg border border-border/50 bg-secondary/10"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground">{key.name}</span>
                      <Badge variant="outline" className="text-xs">
                        {key.key_prefix}...
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Activity className="w-3 h-3" />
                        {key.requests_today}/{key.rate_limit} requests today
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        Created {new Date(key.created_at).toLocaleDateString()}
                      </span>
                      {key.last_used_at && (
                        <span>Last used {new Date(key.last_used_at).toLocaleString()}</span>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => revokeKey(key.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
