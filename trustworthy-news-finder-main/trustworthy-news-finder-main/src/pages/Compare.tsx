import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Shield, ArrowLeft, Plus, X, Loader2, Scale } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { analyzeContent, AnalysisResult, isValidUrl } from '@/lib/analysis';
import { scrapeArticle } from '@/hooks/useAnalysis';

interface ComparisonItem {
  id: string;
  url: string;
  title: string;
  result: AnalysisResult | null;
  loading: boolean;
  error: string | null;
}

const Compare = () => {
  const [items, setItems] = useState<ComparisonItem[]>([
    { id: '1', url: '', title: '', result: null, loading: false, error: null },
    { id: '2', url: '', title: '', result: null, loading: false, error: null },
  ]);
  const [analyzing, setAnalyzing] = useState(false);

  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const updateItem = (id: string, updates: Partial<ComparisonItem>) => {
    setItems(prev => prev.map(item => 
      item.id === id ? { ...item, ...updates } : item
    ));
  };

  const addItem = () => {
    if (items.length >= 4) {
      toast({ title: 'Maximum 4 articles', description: 'You can compare up to 4 articles at once' });
      return;
    }
    setItems(prev => [...prev, {
      id: Date.now().toString(),
      url: '',
      title: '',
      result: null,
      loading: false,
      error: null,
    }]);
  };

  const removeItem = (id: string) => {
    if (items.length <= 2) {
      toast({ title: 'Minimum 2 articles', description: 'You need at least 2 articles to compare' });
      return;
    }
    setItems(prev => prev.filter(item => item.id !== id));
  };

  const analyzeAll = async () => {
    const validItems = items.filter(item => item.url.trim() && isValidUrl(item.url));
    
    if (validItems.length < 2) {
      toast({ title: 'Not enough URLs', description: 'Enter at least 2 valid URLs to compare', variant: 'destructive' });
      return;
    }

    setAnalyzing(true);

    await Promise.all(validItems.map(async (item) => {
      updateItem(item.id, { loading: true, error: null, result: null });

      try {
        let contentToAnalyze = item.url;
        let title = '';

        // Try to scrape content
        try {
          const scraped = await scrapeArticle(item.url);
          if (scraped.success && scraped.content) {
            contentToAnalyze = scraped.content;
            title = scraped.title;
          }
        } catch {
          console.log('Scraping failed for', item.url);
        }

        const result = await analyzeContent(contentToAnalyze, true);
        updateItem(item.id, { result, title, loading: false });
      } catch (error) {
        updateItem(item.id, { 
          loading: false, 
          error: 'Failed to analyze this URL'
        });
      }
    }));

    setAnalyzing(false);
  };

  const getRatingColor = (rating: string) => {
    switch (rating) {
      case 'reliable': return 'text-green-500 bg-green-500/10 border-green-500/30';
      case 'verify': return 'text-yellow-500 bg-yellow-500/10 border-yellow-500/30';
      case 'suspicious': return 'text-red-500 bg-red-500/10 border-red-500/30';
      default: return 'text-muted-foreground bg-muted border-border';
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 70) return 'text-green-500';
    if (score >= 40) return 'text-yellow-500';
    return 'text-red-500';
  };

  const hasResults = items.some(item => item.result);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => navigate('/')}
              className="p-2 rounded-lg hover:bg-secondary/50 transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-muted-foreground" />
            </button>
            <div className="p-2 rounded-lg bg-primary/10">
              <Scale className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-foreground">Compare Articles</h1>
              <p className="text-xs text-muted-foreground">Side-by-side trust analysis</p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-6xl">
        {/* URL Inputs */}
        <div className="space-y-4 mb-6">
          {items.map((item, index) => (
            <div key={item.id} className="flex gap-2">
              <div className="flex items-center justify-center w-8 h-10 rounded-lg bg-secondary/50 text-sm font-medium text-muted-foreground">
                {index + 1}
              </div>
              <Input
                value={item.url}
                onChange={(e) => updateItem(item.id, { url: e.target.value })}
                placeholder="Enter article URL..."
                className="flex-1"
                disabled={analyzing}
              />
              {items.length > 2 && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeItem(item.id)}
                  disabled={analyzing}
                >
                  <X className="w-4 h-4" />
                </Button>
              )}
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-3 mb-8">
          <Button
            variant="outline"
            onClick={addItem}
            disabled={analyzing || items.length >= 4}
            className="gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Article
          </Button>
          <Button
            onClick={analyzeAll}
            disabled={analyzing || items.filter(i => i.url.trim()).length < 2}
            className="gap-2"
          >
            {analyzing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Scale className="w-4 h-4" />
                Compare All
              </>
            )}
          </Button>
        </div>

        {/* Results Comparison */}
        {hasResults && (
          <div className="space-y-6">
            {/* Score Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {items.map((item, index) => (
                <div key={item.id} className="relative">
                  {item.loading ? (
                    <div className="bg-card border border-border rounded-xl p-6 flex items-center justify-center h-48">
                      <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                    </div>
                  ) : item.result ? (
                    <div className={`bg-card border rounded-xl p-4 h-full ${getRatingColor(item.result.rating)}`}>
                      <div className="text-xs text-muted-foreground mb-2">Article {index + 1}</div>
                      <h3 className="font-medium text-foreground text-sm mb-3 line-clamp-2">
                        {item.title || new URL(item.url).hostname}
                      </h3>
                      <div className="text-4xl font-bold mb-2">
                        <span className={getScoreColor(item.result.finalScore)}>
                          {item.result.finalScore}
                        </span>
                      </div>
                      <div className="text-xs uppercase tracking-wide font-medium capitalize">
                        {item.result.rating}
                      </div>
                    </div>
                  ) : item.error ? (
                    <div className="bg-card border border-destructive/30 rounded-xl p-4 h-full">
                      <div className="text-xs text-destructive">{item.error}</div>
                    </div>
                  ) : item.url ? (
                    <div className="bg-card border border-border rounded-xl p-4 h-full flex items-center justify-center">
                      <span className="text-xs text-muted-foreground">Ready to analyze</span>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>

            {/* Detailed Comparison Table */}
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="p-4 border-b border-border">
                <h3 className="font-medium text-foreground">Detailed Comparison</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left p-4 text-sm font-medium text-muted-foreground">Metric</th>
                      {items.map((item, index) => (
                        <th key={item.id} className="text-center p-4 text-sm font-medium text-muted-foreground">
                          Article {index + 1}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-border/50">
                      <td className="p-4 text-sm text-foreground">Text Analysis</td>
                      {items.map(item => (
                        <td key={item.id} className="text-center p-4">
                          {item.result ? (
                            <span className={`font-medium ${getScoreColor(item.result.textScore)}`}>
                              {item.result.textScore}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                      ))}
                    </tr>
                    <tr className="border-b border-border/50">
                      <td className="p-4 text-sm text-foreground">Domain Trust</td>
                      {items.map(item => (
                        <td key={item.id} className="text-center p-4">
                          {item.result ? (
                            <span className={`font-medium ${getScoreColor(item.result.domainScore)}`}>
                              {item.result.domainScore}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                      ))}
                    </tr>
                    <tr className="border-b border-border/50">
                      <td className="p-4 text-sm text-foreground">Evidence Match</td>
                      {items.map(item => (
                        <td key={item.id} className="text-center p-4">
                          {item.result ? (
                            <span className={`font-medium ${getScoreColor(item.result.evidenceScore)}`}>
                              {item.result.evidenceScore}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                      ))}
                    </tr>
                    <tr className="border-b border-border/50">
                      <td className="p-4 text-sm text-foreground">Sentiment Score</td>
                      {items.map(item => (
                        <td key={item.id} className="text-center p-4">
                          {item.result ? (
                            <span className={`font-medium ${getScoreColor(item.result.sentimentScore)}`}>
                              {item.result.sentimentScore}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                      ))}
                    </tr>
                    <tr className="border-b border-border/50">
                      <td className="p-4 text-sm text-foreground">Sentiment Bias</td>
                      {items.map(item => (
                        <td key={item.id} className="text-center p-4 text-sm text-muted-foreground">
                          {item.result?.details.sentimentBias || '—'}
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td className="p-4 text-sm text-foreground font-medium">Final Score</td>
                      {items.map(item => (
                        <td key={item.id} className="text-center p-4">
                          {item.result ? (
                            <span className={`text-lg font-bold ${getScoreColor(item.result.finalScore)}`}>
                              {item.result.finalScore}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Winner Banner */}
            {(() => {
              const validResults = items.filter(i => i.result);
              if (validResults.length < 2) return null;
              
              const sorted = [...validResults].sort((a, b) => 
                (b.result?.finalScore || 0) - (a.result?.finalScore || 0)
              );
              const winner = sorted[0];
              const winnerIndex = items.findIndex(i => i.id === winner.id);
              
              return (
                <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4 text-center">
                  <p className="text-sm text-green-500 font-medium">
                    🏆 Article {winnerIndex + 1} has the highest trust score ({winner.result?.finalScore}/100)
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {winner.title || new URL(winner.url).hostname}
                  </p>
                </div>
              );
            })()}
          </div>
        )}

        {/* Empty State */}
        {!hasResults && !analyzing && (
          <div className="text-center py-16 text-muted-foreground">
            <Scale className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <h3 className="text-lg font-medium text-foreground mb-2">Compare Multiple Sources</h3>
            <p className="text-sm max-w-md mx-auto">
              Enter 2-4 article URLs above to compare their trust scores side by side. 
              This helps you identify the most reliable source for a story.
            </p>
          </div>
        )}
      </main>
    </div>
  );
};

export default Compare;
