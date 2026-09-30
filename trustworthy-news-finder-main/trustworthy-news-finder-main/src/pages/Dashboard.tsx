import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Shield, TrendingUp, AlertTriangle, Globe, BarChart3, ArrowLeft, Map, Activity } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ThreatMap } from '@/components/ThreatMap';
import { ThreatAnalyticsDashboard } from '@/components/ThreatAnalyticsDashboard';
interface AggregateStats {
  totalAnalyses: number;
  avgScore: number;
  trustworthyPercent: number;
  unreliablePercent: number;
}

interface DomainStat {
  domain: string;
  count: number;
  avgScore: number;
}

interface ClickbaitPattern {
  pattern: string;
  count: number;
}

const Dashboard = () => {
  const [stats, setStats] = useState<AggregateStats | null>(null);
  const [suspiciousDomains, setSuspiciousDomains] = useState<DomainStat[]>([]);
  const [clickbaitPatterns, setClickbaitPatterns] = useState<ClickbaitPattern[]>([]);
  const [recentTrends, setRecentTrends] = useState<{ date: string; count: number; avgScore: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      // Fetch all analyses for aggregate stats (public dashboard)
      const { data: analyses, error } = await supabase
        .from('analysis_history')
        .select('input_value, input_type, final_score, rating, clickbait_words_found, created_at')
        .order('created_at', { ascending: false })
        .limit(1000);

      if (error) throw error;

      if (!analyses || analyses.length === 0) {
        setLoading(false);
        return;
      }

      // Calculate aggregate stats
      const totalAnalyses = analyses.length;
      const avgScore = Math.round(analyses.reduce((sum, a) => sum + a.final_score, 0) / totalAnalyses);
      const trustworthy = analyses.filter(a => a.final_score >= 70).length;
      const unreliable = analyses.filter(a => a.final_score < 40).length;

      setStats({
        totalAnalyses,
        avgScore,
        trustworthyPercent: Math.round((trustworthy / totalAnalyses) * 100),
        unreliablePercent: Math.round((unreliable / totalAnalyses) * 100),
      });

      // Calculate domain stats
      const domainMap: Record<string, { count: number; totalScore: number }> = {};
      analyses.forEach(a => {
        if (a.input_type === 'url') {
          try {
            const url = new URL(a.input_value);
            const domain = url.hostname.replace('www.', '');
            if (!domainMap[domain]) {
              domainMap[domain] = { count: 0, totalScore: 0 };
            }
            domainMap[domain].count++;
            domainMap[domain].totalScore += a.final_score;
          } catch {}
        }
      });

      const domainStats = Object.entries(domainMap)
        .map(([domain, { count, totalScore }]) => ({
          domain,
          count,
          avgScore: Math.round(totalScore / count),
        }))
        .filter(d => d.avgScore < 50 && d.count >= 2)
        .sort((a, b) => a.avgScore - b.avgScore)
        .slice(0, 10);

      setSuspiciousDomains(domainStats);

      // Calculate clickbait patterns
      const patternMap: Record<string, number> = {};
      analyses.forEach(a => {
        if (a.clickbait_words_found) {
          a.clickbait_words_found.forEach((word: string) => {
            patternMap[word] = (patternMap[word] || 0) + 1;
          });
        }
      });

      const patterns = Object.entries(patternMap)
        .map(([pattern, count]) => ({ pattern, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 15);

      setClickbaitPatterns(patterns);

      // Calculate daily trends (last 7 days)
      const dayMap: Record<string, { count: number; totalScore: number }> = {};
      const now = new Date();
      for (let i = 6; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        const key = date.toISOString().split('T')[0];
        dayMap[key] = { count: 0, totalScore: 0 };
      }

      analyses.forEach(a => {
        const date = a.created_at.split('T')[0];
        if (dayMap[date]) {
          dayMap[date].count++;
          dayMap[date].totalScore += a.final_score;
        }
      });

      const trends = Object.entries(dayMap).map(([date, { count, totalScore }]) => ({
        date: new Date(date).toLocaleDateString('en-US', { weekday: 'short' }),
        count,
        avgScore: count > 0 ? Math.round(totalScore / count) : 0,
      }));

      setRecentTrends(trends);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 70) return 'text-success';
    if (score >= 40) return 'text-warning';
    return 'text-destructive';
  };

  const getScoreBg = (score: number) => {
    if (score >= 70) return 'bg-success/20';
    if (score >= 40) return 'bg-warning/20';
    return 'bg-destructive/20';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <BarChart3 className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-foreground">Public Dashboard</h1>
                <p className="text-xs text-muted-foreground">Aggregate Misinformation Trends</p>
              </div>
            </div>
            <Link
              to="/"
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Analyzer
            </Link>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Stats Overview */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <Card className="bg-card/50 border-border/50">
              <CardContent className="p-6 text-center">
                <div className="text-3xl font-bold text-foreground mb-1">{stats.totalAnalyses.toLocaleString()}</div>
                <div className="text-sm text-muted-foreground">Total Analyses</div>
              </CardContent>
            </Card>
            <Card className="bg-card/50 border-border/50">
              <CardContent className="p-6 text-center">
                <div className={`text-3xl font-bold ${getScoreColor(stats.avgScore)} mb-1`}>
                  {stats.avgScore}
                </div>
                <div className="text-sm text-muted-foreground">Avg Trust Score</div>
              </CardContent>
            </Card>
            <Card className="bg-card/50 border-border/50">
              <CardContent className="p-6 text-center">
                <div className="text-3xl font-bold text-success mb-1">{stats.trustworthyPercent}%</div>
                <div className="text-sm text-muted-foreground">Trustworthy</div>
              </CardContent>
            </Card>
            <Card className="bg-card/50 border-border/50">
              <CardContent className="p-6 text-center">
                <div className="text-3xl font-bold text-destructive mb-1">{stats.unreliablePercent}%</div>
                <div className="text-sm text-muted-foreground">Flagged</div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Tabbed Content */}
        <Tabs defaultValue="analytics" className="space-y-6">
          <TabsList className="grid w-full max-w-lg grid-cols-3">
            <TabsTrigger value="analytics" className="gap-2">
              <BarChart3 className="w-4 h-4" />
              Analytics
            </TabsTrigger>
            <TabsTrigger value="threat-analytics" className="gap-2">
              <Activity className="w-4 h-4" />
              Threat Analytics
            </TabsTrigger>
            <TabsTrigger value="threatmap" className="gap-2">
              <Map className="w-4 h-4" />
              Threat Map
            </TabsTrigger>
          </TabsList>

          <TabsContent value="analytics" className="space-y-8">
            <div className="grid md:grid-cols-2 gap-8">
          {/* Recent Trends */}
          <Card className="bg-card/50 border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-foreground">
                <TrendingUp className="w-5 h-5 text-primary" />
                7-Day Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recentTrends.map((day) => (
                  <div key={day.date} className="flex items-center gap-4">
                    <div className="w-12 text-sm text-muted-foreground">{day.date}</div>
                    <div className="flex-1">
                      <Progress value={day.count * 10} className="h-2" />
                    </div>
                    <div className="w-16 text-right">
                      <span className="text-sm text-foreground">{day.count}</span>
                      <span className="text-xs text-muted-foreground ml-1">scans</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Suspicious Domains */}
          <Card className="bg-card/50 border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-foreground">
                <AlertTriangle className="w-5 h-5 text-warning" />
                Trending Suspicious Domains
              </CardTitle>
            </CardHeader>
            <CardContent>
              {suspiciousDomains.length === 0 ? (
                <p className="text-muted-foreground text-sm">No suspicious domains detected yet.</p>
              ) : (
                <div className="space-y-3">
                  {suspiciousDomains.map((domain) => (
                    <div
                      key={domain.domain}
                      className="flex items-center justify-between p-3 rounded-lg bg-secondary/30"
                    >
                      <div className="flex items-center gap-3">
                        <Globe className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm text-foreground font-medium">{domain.domain}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground">{domain.count} checks</span>
                        <Badge variant="outline" className={`${getScoreBg(domain.avgScore)} ${getScoreColor(domain.avgScore)} border-0`}>
                          {domain.avgScore}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
            </div>

            {/* Clickbait Patterns */}
            <Card className="bg-card/50 border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-foreground">
                  <Shield className="w-5 h-5 text-destructive" />
                  Common Clickbait Patterns Detected
                </CardTitle>
              </CardHeader>
              <CardContent>
                {clickbaitPatterns.length === 0 ? (
                  <p className="text-muted-foreground text-sm">No patterns collected yet.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {clickbaitPatterns.map((pattern) => (
                      <Badge
                        key={pattern.pattern}
                        variant="outline"
                        className="bg-destructive/10 text-destructive border-destructive/30 px-3 py-1"
                      >
                        "{pattern.pattern}" 
                        <span className="ml-2 text-xs opacity-70">×{pattern.count}</span>
                      </Badge>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="threat-analytics">
            <ThreatAnalyticsDashboard />
          </TabsContent>

          <TabsContent value="threatmap">
            <ThreatMap />
          </TabsContent>
        </Tabs>

        {/* Info Footer */}
        <div className="mt-12 text-center">
          <p className="text-xs text-muted-foreground">
            Data aggregated from anonymous analyses. Individual user data is never shared.
          </p>
          <p className="text-xs text-muted-foreground/60 mt-1">
            Updated in real-time as users analyze content worldwide.
          </p>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
