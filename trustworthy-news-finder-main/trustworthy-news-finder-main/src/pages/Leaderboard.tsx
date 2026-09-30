import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Shield, ArrowLeft, TrendingUp, TrendingDown, Minus, Globe, BarChart3, Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface DomainStats {
  domain: string;
  count: number;
  avgScore: number;
  trend: 'up' | 'down' | 'stable';
}

interface GlobalStats {
  totalAnalyses: number;
  totalDomains: number;
  avgTrustScore: number;
  reliablePercentage: number;
}

export default function Leaderboard() {
  const [topDomains, setTopDomains] = useState<DomainStats[]>([]);
  const [worstDomains, setWorstDomains] = useState<DomainStats[]>([]);
  const [globalStats, setGlobalStats] = useState<GlobalStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLeaderboardData();
  }, []);

  const fetchLeaderboardData = async () => {
    try {
      // Fetch all analyses for aggregation
      const { data: analyses, error } = await supabase
        .from('analysis_history')
        .select('input_value, input_type, final_score, rating, created_at');

      if (error) throw error;

      // Extract domains from URLs
      const domainMap = new Map<string, { scores: number[]; count: number }>();
      
      analyses?.forEach(item => {
        if (item.input_type === 'url') {
          try {
            const url = new URL(item.input_value);
            const domain = url.hostname.replace('www.', '');
            const existing = domainMap.get(domain) || { scores: [], count: 0 };
            existing.scores.push(item.final_score);
            existing.count++;
            domainMap.set(domain, existing);
          } catch {
            // Invalid URL, skip
          }
        }
      });

      // Calculate averages and create sorted lists
      const domainStats: DomainStats[] = Array.from(domainMap.entries())
        .filter(([_, data]) => data.count >= 2) // Only show domains with 2+ analyses
        .map(([domain, data]) => ({
          domain,
          count: data.count,
          avgScore: Math.round(data.scores.reduce((a, b) => a + b, 0) / data.scores.length),
          trend: data.scores.length > 1 
            ? (data.scores[data.scores.length - 1] > data.scores[0] ? 'up' : 
               data.scores[data.scores.length - 1] < data.scores[0] ? 'down' : 'stable')
            : 'stable'
        }));

      // Sort for top and worst
      const sorted = [...domainStats].sort((a, b) => b.avgScore - a.avgScore);
      setTopDomains(sorted.slice(0, 10));
      setWorstDomains([...domainStats].sort((a, b) => a.avgScore - b.avgScore).slice(0, 10));

      // Calculate global stats
      const totalAnalyses = analyses?.length || 0;
      const totalDomains = domainMap.size;
      const avgTrustScore = totalAnalyses > 0 
        ? Math.round(analyses!.reduce((acc, a) => acc + a.final_score, 0) / totalAnalyses)
        : 0;
      const reliableCount = analyses?.filter(a => a.rating === 'reliable').length || 0;
      const reliablePercentage = totalAnalyses > 0 
        ? Math.round((reliableCount / totalAnalyses) * 100)
        : 0;

      setGlobalStats({
        totalAnalyses,
        totalDomains,
        avgTrustScore,
        reliablePercentage
      });

    } catch (error) {
      console.error('Error fetching leaderboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 70) return 'text-green-500';
    if (score >= 40) return 'text-yellow-500';
    return 'text-red-500';
  };

  const getScoreBg = (score: number) => {
    if (score >= 70) return 'bg-green-500/10 border-green-500/20';
    if (score >= 40) return 'bg-yellow-500/10 border-yellow-500/20';
    return 'bg-red-500/10 border-red-500/20';
  };

  const TrendIcon = ({ trend }: { trend: 'up' | 'down' | 'stable' }) => {
    if (trend === 'up') return <TrendingUp className="w-4 h-4 text-green-500" />;
    if (trend === 'down') return <TrendingDown className="w-4 h-4 text-red-500" />;
    return <Minus className="w-4 h-4 text-muted-foreground" />;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link to="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="w-5 h-5" />
              Back
            </Link>
            <div className="flex items-center gap-2">
              <Shield className="w-6 h-6 text-primary" />
              <h1 className="text-xl font-bold">Domain Leaderboard</h1>
            </div>
            <div className="w-16" />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Global Stats */}
        {globalStats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <BarChart3 className="w-4 h-4" />
                  <span className="text-sm">Total Analyses</span>
                </div>
                <p className="text-3xl font-bold">{globalStats.totalAnalyses.toLocaleString()}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Globe className="w-4 h-4" />
                  <span className="text-sm">Unique Domains</span>
                </div>
                <p className="text-3xl font-bold">{globalStats.totalDomains.toLocaleString()}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Shield className="w-4 h-4" />
                  <span className="text-sm">Avg Trust Score</span>
                </div>
                <p className={`text-3xl font-bold ${getScoreColor(globalStats.avgTrustScore)}`}>
                  {globalStats.avgTrustScore}%
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Users className="w-4 h-4" />
                  <span className="text-sm">Reliable Rate</span>
                </div>
                <p className="text-3xl font-bold text-green-500">{globalStats.reliablePercentage}%</p>
              </CardContent>
            </Card>
          </div>
        )}

        <Tabs defaultValue="trusted" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="trusted" className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Most Trusted
            </TabsTrigger>
            <TabsTrigger value="suspicious" className="flex items-center gap-2">
              <TrendingDown className="w-4 h-4" />
              Most Suspicious
            </TabsTrigger>
          </TabsList>

          <TabsContent value="trusted">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-green-500" />
                  Top Trusted Domains
                </CardTitle>
              </CardHeader>
              <CardContent>
                {topDomains.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">
                    Not enough data yet. Analyze more URLs to see rankings.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {topDomains.map((domain, index) => (
                      <div
                        key={domain.domain}
                        className={`flex items-center justify-between p-4 rounded-lg border ${getScoreBg(domain.avgScore)}`}
                      >
                        <div className="flex items-center gap-4">
                          <span className="text-2xl font-bold text-muted-foreground w-8">
                            #{index + 1}
                          </span>
                          <div>
                            <p className="font-semibold">{domain.domain}</p>
                            <p className="text-sm text-muted-foreground">
                              {domain.count} analyses
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <TrendIcon trend={domain.trend} />
                          <Badge variant="outline" className={getScoreColor(domain.avgScore)}>
                            {domain.avgScore}%
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="suspicious">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingDown className="w-5 h-5 text-red-500" />
                  Most Flagged Domains
                </CardTitle>
              </CardHeader>
              <CardContent>
                {worstDomains.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">
                    Not enough data yet. Analyze more URLs to see rankings.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {worstDomains.map((domain, index) => (
                      <div
                        key={domain.domain}
                        className={`flex items-center justify-between p-4 rounded-lg border ${getScoreBg(domain.avgScore)}`}
                      >
                        <div className="flex items-center gap-4">
                          <span className="text-2xl font-bold text-muted-foreground w-8">
                            #{index + 1}
                          </span>
                          <div>
                            <p className="font-semibold">{domain.domain}</p>
                            <p className="text-sm text-muted-foreground">
                              {domain.count} analyses
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <TrendIcon trend={domain.trend} />
                          <Badge variant="outline" className={getScoreColor(domain.avgScore)}>
                            {domain.avgScore}%
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <p className="text-center text-muted-foreground text-sm mt-8">
          Rankings based on aggregated analysis data. Domains require at least 2 analyses to appear.
        </p>
      </main>
    </div>
  );
}
