import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue 
} from '@/components/ui/select';
import { 
  RefreshCw, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Zap,
  AlertTriangle,
  Download,
  FileJson,
  FileSpreadsheet
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

interface DeliveryLog {
  id: string;
  webhook_id: string;
  event: string;
  status_code: number | null;
  success: boolean;
  error_message: string | null;
  attempt_number: number;
  response_time_ms: number | null;
  created_at: string;
}

interface Webhook {
  id: string;
  name: string;
}

export function WebhookDeliveryLogs() {
  const { user } = useAuth();
  const [logs, setLogs] = useState<DeliveryLog[]>([]);
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [selectedWebhook, setSelectedWebhook] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchWebhooks();
      fetchLogs();
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchLogs();
    }
  }, [selectedWebhook]);

  const fetchWebhooks = async () => {
    const { data } = await supabase
      .from('webhooks')
      .select('id, name')
      .eq('user_id', user?.id);
    
    if (data) setWebhooks(data);
  };

  const fetchLogs = async () => {
    setLoading(true);
    
    let query = supabase
      .from('webhook_delivery_logs')
      .select('*')
      .eq('user_id', user?.id)
      .order('created_at', { ascending: false })
      .limit(100);

    if (selectedWebhook !== 'all') {
      query = query.eq('webhook_id', selectedWebhook);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Failed to fetch delivery logs:', error);
    } else {
      setLogs(data || []);
    }
    
    setLoading(false);
  };

  const getWebhookName = (webhookId: string) => {
    return webhooks.find(w => w.id === webhookId)?.name || 'Unknown';
  };

  const getStatusBadge = (log: DeliveryLog) => {
    if (log.success) {
      return (
        <Badge className="bg-success/20 text-success border-success/30 gap-1">
          <CheckCircle2 className="w-3 h-3" />
          {log.status_code || 'OK'}
        </Badge>
      );
    }
    
    if (log.status_code) {
      return (
        <Badge variant="destructive" className="gap-1">
          <XCircle className="w-3 h-3" />
          {log.status_code}
        </Badge>
      );
    }
    
    return (
      <Badge variant="destructive" className="gap-1">
        <AlertTriangle className="w-3 h-3" />
        Error
      </Badge>
    );
  };

  const successCount = logs.filter(l => l.success).length;
  const failureCount = logs.filter(l => !l.success).length;
  const avgResponseTime = logs.length > 0
    ? Math.round(logs.filter(l => l.response_time_ms).reduce((sum, l) => sum + (l.response_time_ms || 0), 0) / logs.filter(l => l.response_time_ms).length)
    : 0;

  const exportLogsAsCSV = () => {
    if (logs.length === 0) {
      toast.error('No logs to export');
      return;
    }
    
    const headers = ['Timestamp', 'Webhook', 'Event', 'Status Code', 'Success', 'Response Time (ms)', 'Attempt #', 'Error Message'];
    const rows = logs.map(log => [
      format(new Date(log.created_at), 'yyyy-MM-dd HH:mm:ss'),
      getWebhookName(log.webhook_id),
      log.event,
      log.status_code || 'N/A',
      log.success ? 'Yes' : 'No',
      log.response_time_ms || 'N/A',
      log.attempt_number,
      log.error_message || ''
    ]);
    
    const csvContent = [headers.join(','), ...rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `webhook-delivery-logs-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Webhook delivery logs exported as CSV');
  };

  const exportLogsAsJSON = () => {
    if (logs.length === 0) {
      toast.error('No logs to export');
      return;
    }
    
    const exportData = {
      exportedAt: new Date().toISOString(),
      filter: selectedWebhook === 'all' ? 'All Webhooks' : getWebhookName(selectedWebhook),
      summary: {
        totalDeliveries: logs.length,
        successCount,
        failureCount,
        successRate: logs.length > 0 ? ((successCount / logs.length) * 100).toFixed(1) + '%' : '0%',
        avgResponseTimeMs: avgResponseTime
      },
      logs: logs.map(log => ({
        timestamp: log.created_at,
        webhookName: getWebhookName(log.webhook_id),
        webhookId: log.webhook_id,
        event: log.event,
        statusCode: log.status_code,
        success: log.success,
        responseTimeMs: log.response_time_ms,
        attemptNumber: log.attempt_number,
        errorMessage: log.error_message
      }))
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `webhook-delivery-logs-${format(new Date(), 'yyyy-MM-dd')}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Webhook delivery logs exported as JSON');
  };

  return (
    <Card className="bg-card/50 border-border/50">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">Delivery Logs</CardTitle>
            <CardDescription>Recent webhook delivery attempts and their status</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={exportLogsAsCSV} disabled={loading || logs.length === 0}>
              <FileSpreadsheet className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={exportLogsAsJSON} disabled={loading || logs.length === 0}>
              <FileJson className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={fetchLogs} disabled={loading}>
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters and Stats */}
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <Select value={selectedWebhook} onValueChange={setSelectedWebhook}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Filter by webhook" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Webhooks</SelectItem>
              {webhooks.map(webhook => (
                <SelectItem key={webhook.id} value={webhook.id}>
                  {webhook.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <div className="flex gap-4 text-sm">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-success" />
              <span className="text-muted-foreground">{successCount} successful</span>
            </div>
            <div className="flex items-center gap-2">
              <XCircle className="w-4 h-4 text-destructive" />
              <span className="text-muted-foreground">{failureCount} failed</span>
            </div>
            {avgResponseTime > 0 && (
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-warning" />
                <span className="text-muted-foreground">{avgResponseTime}ms avg</span>
              </div>
            )}
          </div>
        </div>

        {/* Logs List */}
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No delivery logs yet. Logs will appear here when webhooks are triggered.
          </div>
        ) : (
          <ScrollArea className="h-[400px]">
            <div className="space-y-2">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className={`p-4 rounded-lg border ${
                    log.success 
                      ? 'bg-secondary/20 border-border/50' 
                      : 'bg-destructive/5 border-destructive/20'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {getStatusBadge(log)}
                        <Badge variant="outline" className="text-xs">
                          {log.event}
                        </Badge>
                        {log.attempt_number > 1 && (
                          <Badge variant="secondary" className="text-xs">
                            Attempt #{log.attempt_number}
                          </Badge>
                        )}
                      </div>
                      
                      <div className="mt-2 text-sm text-muted-foreground">
                        {getWebhookName(log.webhook_id)}
                      </div>
                      
                      {log.error_message && (
                        <div className="mt-2 text-sm text-destructive bg-destructive/10 p-2 rounded">
                          {log.error_message}
                        </div>
                      )}
                    </div>
                    
                    <div className="text-right text-xs text-muted-foreground whitespace-nowrap">
                      <div className="flex items-center gap-1 justify-end">
                        <Clock className="w-3 h-3" />
                        {format(new Date(log.created_at), 'MMM d, HH:mm:ss')}
                      </div>
                      {log.response_time_ms && (
                        <div className="mt-1 flex items-center gap-1 justify-end">
                          <Zap className="w-3 h-3" />
                          {log.response_time_ms}ms
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
