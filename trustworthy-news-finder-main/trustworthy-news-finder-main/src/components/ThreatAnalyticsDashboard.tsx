import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  BarChart3, 
  Shield, 
  AlertTriangle, 
  TrendingUp, 
  Globe, 
  Clock,
  Target,
  Activity
} from 'lucide-react';

interface ThreatStats {
  totalScans: number;
  totalDomains: number;
  totalThreats: number;
  avgScore: number;
  threatsByType: Record<string, number>;
  topMaliciousDomains: { domain: string; count: number }[];
  scansByType: Record<string, number>;
  recentScans: { date: string; count: number; threats: number }[];
}

export function ThreatAnalyticsDashboard() {
  const [stats, setStats] = useState<ThreatStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchThreatStats();
  }, []);

  const fetchThreatStats = async () => {
    try {
      const { data: scans, error } = await supabase
        .from('threat_scans')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1000);

      if (error) throw error;

      if (!scans || scans.length === 0) {
        setStats({
          totalScans: 0,
          totalDomains: 0,
          totalThreats: 0,
          avgScore: 0,
          threatsByType: {},
          topMaliciousDomains: [],
          scansByType: {},
          recentScans: []
        });
        setLoading(false);
        return;
      }

      // Calculate aggregate stats
      const totalScans = scans.length;
      const totalDomains = scans.reduce((sum, s) => sum + (s.domains_scanned || 0), 0);
      const totalThreats = scans.reduce((sum, s) => sum + (s.threats_found || 0), 0);
      const avgScore = scans.reduce((sum, s) => sum + (Number(s.avg_score) || 0), 0) / totalScans;

      // Aggregate threat types
      const threatsByType: Record<string, number> = {};
      scans.forEach(scan => {
        const types = scan.threat_types as Record<string, number> | null;
        if (types) {
          Object.entries(types).forEach(([type, count]) => {
            threatsByType[type] = (threatsByType[type] || 0) + count;
          });
        }
      });

      // Aggregate malicious domains
      const domainCounts: Record<string, number> = {};
      scans.forEach(scan => {
        if (scan.malicious_domains) {
          (scan.malicious_domains as string[]).forEach(domain => {
            domainCounts[domain] = (domainCounts[domain] || 0) + 1;
          });
        }
      });
      const topMaliciousDomains = Object.entries(domainCounts)
        .map(([domain, count]) => ({ domain, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      // Scans by type
      const scansByType: Record<string, number> = {};
      scans.forEach(scan => {
        scansByType[scan.scan_type] = (scansByType[scan.scan_type] || 0) + 1;
      });

      // Recent scans (last 7 days)
      const now = new Date();
      const dayMap: Record<string, { count: number; threats: number }> = {};
      for (let i = 6; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        const key = date.toISOString().split('T')[0];
        dayMap[key] = { count: 0, threats: 0 };
      }

      scans.forEach(scan => {
        const date = scan.created_at.split('T')[0];
        if (dayMap[date]) {
          dayMap[date].count++;
          dayMap[date].threats += scan.threats_found || 0;
        }
      });

      const recentScans = Object.entries(dayMap).map(([date, data]) => ({
        date: new Date(date).toLocaleDateString('en-US', { weekday: 'short' }),
        count: data.count,
        threats: data.threats
      }));

      setStats({
        totalScans,
        totalDomains,
        totalThreats,
        avgScore: Math.round(avgScore),
        threatsByType,
        topMaliciousDomains,
        scansByType,
        recentScans
      });
    } catch (error) {
      console.error('Failed to fetch threat stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const getThreatTypeLabel = (type: string): string => {
    const labels: Record<string, string> = {
      'known_malicious': 'Known Malicious',
      'pattern_match': 'Pattern Match',
      'typosquatting': 'Typosquatting',
      'phishing': 'Phishing',
      'suspicious_tld': 'Suspicious TLD'
    };
    return labels[type] || type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  };

  const getScoreColor = (score: number) => {
    if (score >= 70) return 'text-success';
    if (score >= 40) return 'text-warning';
    return 'text-destructive';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!stats) {
    return (
      <Card className="bg-card/50 border-border/50">
        <CardContent className="py-8 text-center">
          <p className="text-muted-foreground">No threat scan data available yet.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overview Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-card/50 border-border/50">
          <CardContent className="p-6 text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Target className="w-5 h-5 text-primary" />
            </div>
            <div className="text-3xl font-bold text-foreground">{stats.totalScans.toLocaleString()}</div>
            <div className="text-sm text-muted-foreground">Total Scans</div>
          </CardContent>
        </Card>
        <Card className="bg-card/50 border-border/50">
          <CardContent className="p-6 text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Globe className="w-5 h-5 text-primary" />
            </div>
            <div className="text-3xl font-bold text-foreground">{stats.totalDomains.toLocaleString()}</div>
            <div className="text-sm text-muted-foreground">Domains Scanned</div>
          </CardContent>
        </Card>
        <Card className="bg-card/50 border-border/50">
          <CardContent className="p-6 text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
            </div>
            <div className="text-3xl font-bold text-destructive">{stats.totalThreats.toLocaleString()}</div>
            <div className="text-sm text-muted-foreground">Threats Found</div>
          </CardContent>
        </Card>
        <Card className="bg-card/50 border-border/50">
          <CardContent className="p-6 text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Shield className="w-5 h-5 text-primary" />
            </div>
            <div className={`text-3xl font-bold ${getScoreColor(stats.avgScore)}`}>{stats.avgScore}</div>
            <div className="text-sm text-muted-foreground">Avg Trust Score</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Threat Types */}
        <Card className="bg-card/50 border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <BarChart3 className="w-5 h-5 text-primary" />
              Threat Types Detected
            </CardTitle>
          </CardHeader>
          <CardContent>
            {Object.keys(stats.threatsByType).length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No threats detected yet</p>
            ) : (
              <div className="space-y-4">
                {Object.entries(stats.threatsByType)
                  .sort(([, a], [, b]) => b - a)
                  .slice(0, 6)
                  .map(([type, count]) => {
                    const total = Object.values(stats.threatsByType).reduce((a, b) => a + b, 0);
                    const percentage = (count / total) * 100;
                    return (
                      <div key={type} className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span className="text-foreground">{getThreatTypeLabel(type)}</span>
                          <span className="text-muted-foreground">{count}</span>
                        </div>
                        <Progress value={percentage} className="h-2" />
                      </div>
                    );
                  })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top Malicious Domains */}
        <Card className="bg-card/50 border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              Top Malicious Domains
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats.topMaliciousDomains.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No malicious domains detected</p>
            ) : (
              <div className="space-y-3">
                {stats.topMaliciousDomains.slice(0, 6).map(({ domain, count }, index) => (
                  <div
                    key={domain}
                    className="flex items-center justify-between p-3 rounded-lg bg-destructive/10"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground font-mono">#{index + 1}</span>
                      <span className="text-sm text-foreground font-medium truncate max-w-[180px]">
                        {domain}
                      </span>
                    </div>
                    <Badge variant="destructive" className="text-xs">
                      {count}×
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card className="bg-card/50 border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Activity className="w-5 h-5 text-primary" />
            7-Day Scan Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {stats.recentScans.map((day) => (
              <div key={day.date} className="flex items-center gap-4">
                <div className="w-12 text-sm text-muted-foreground">{day.date}</div>
                <div className="flex-1 flex gap-2">
                  <div className="flex-1">
                    <Progress value={day.count * 10} className="h-2" />
                  </div>
                  {day.threats > 0 && (
                    <div className="w-20">
                      <Progress value={day.threats * 20} className="h-2 bg-destructive/20 [&>div]:bg-destructive" />
                    </div>
                  )}
                </div>
                <div className="w-24 text-right flex items-center justify-end gap-2">
                  <span className="text-sm text-foreground">{day.count}</span>
                  {day.threats > 0 && (
                    <Badge variant="destructive" className="text-xs">
                      {day.threats} threats
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Scan Type Distribution */}
      <Card className="bg-card/50 border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Clock className="w-5 h-5 text-primary" />
            Scans by Type
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            {Object.entries(stats.scansByType).map(([type, count]) => (
              <div key={type} className="flex items-center gap-2 p-3 rounded-lg bg-secondary/30">
                <Badge variant="outline" className="capitalize">{type}</Badge>
                <span className="font-bold text-foreground">{count}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}