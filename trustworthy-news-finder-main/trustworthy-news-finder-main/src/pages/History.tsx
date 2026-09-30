import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Shield, ArrowLeft, Trash2, ExternalLink, Clock, ChevronDown, ChevronUp, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { HistoryFilters, HistoryFiltersState } from '@/components/HistoryFilters';
import { useExportHistory } from '@/hooks/useExportHistory';

interface HistoryItem {
  id: string;
  input_type: string;
  input_value: string;
  article_title: string | null;
  final_score: number;
  rating: string;
  text_score: number;
  domain_score: number;
  evidence_score: number;
  sentiment_score: number;
  created_at: string;
  clickbait_words_found: string[] | null;
}

const History = () => {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filters, setFilters] = useState<HistoryFiltersState>({
    search: '',
    rating: 'all',
    scoreRange: 'all',
    dateFrom: undefined,
    dateTo: undefined,
  });
  
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { exportToCSV, exportToPDF, isExporting } = useExportHistory();

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      fetchHistory();
    }
  }, [user]);

  const fetchHistory = async () => {
    try {
      const { data, error } = await supabase
        .from('analysis_history')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      setHistory(data || []);
    } catch (error) {
      console.error('Error fetching history:', error);
      toast({
        title: 'Error',
        description: 'Failed to load history',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // Apply filters to history
  const filteredHistory = useMemo(() => {
    return history.filter((item) => {
      // Search filter
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        const titleMatch = item.article_title?.toLowerCase().includes(searchLower);
        const urlMatch = item.input_value.toLowerCase().includes(searchLower);
        if (!titleMatch && !urlMatch) return false;
      }

      // Rating filter
      if (filters.rating !== 'all' && item.rating !== filters.rating) {
        return false;
      }

      // Score range filter
      if (filters.scoreRange !== 'all') {
        const score = item.final_score;
        if (filters.scoreRange === 'high' && (score < 70 || score > 100)) return false;
        if (filters.scoreRange === 'medium' && (score < 40 || score > 69)) return false;
        if (filters.scoreRange === 'low' && (score < 0 || score > 39)) return false;
      }

      // Date filters
      const itemDate = new Date(item.created_at);
      if (filters.dateFrom && itemDate < filters.dateFrom) return false;
      if (filters.dateTo) {
        const endOfDay = new Date(filters.dateTo);
        endOfDay.setHours(23, 59, 59, 999);
        if (itemDate > endOfDay) return false;
      }

      return true;
    });
  }, [history, filters]);

  const deleteItem = async (id: string) => {
    try {
      const { error } = await supabase
        .from('analysis_history')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      setHistory((prev) => prev.filter((item) => item.id !== id));
      toast({ title: 'Deleted', description: 'Analysis removed from history' });
    } catch (error) {
      console.error('Error deleting:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete item',
        variant: 'destructive',
      });
    }
  };

  const getRatingColor = (rating: string) => {
    switch (rating) {
      case 'reliable': return 'text-green-500 bg-green-500/10';
      case 'verify': return 'text-yellow-500 bg-yellow-500/10';
      case 'suspicious': return 'text-red-500 bg-red-500/10';
      default: return 'text-muted-foreground bg-muted';
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
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
              <button 
                onClick={() => navigate('/')}
                className="p-2 rounded-lg hover:bg-secondary/50 transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-muted-foreground" />
              </button>
              <div className="p-2 rounded-lg bg-primary/10">
                <Shield className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-foreground">Analysis History</h1>
                <p className="text-xs text-muted-foreground">Your past fact-checks</p>
              </div>
            </div>

            {/* Export Buttons */}
            {history.length > 0 && (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => exportToCSV(filteredHistory)}
                  disabled={isExporting || filteredHistory.length === 0}
                  className="gap-2"
                >
                  <Download className="w-4 h-4" />
                  <span className="hidden sm:inline">CSV</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => exportToPDF(filteredHistory)}
                  disabled={isExporting || filteredHistory.length === 0}
                  className="gap-2"
                >
                  <Download className="w-4 h-4" />
                  <span className="hidden sm:inline">PDF</span>
                </Button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Filters */}
        <HistoryFilters filters={filters} onFiltersChange={setFilters} />

        {/* Results count */}
        {history.length > 0 && (
          <p className="text-sm text-muted-foreground mb-4">
            Showing {filteredHistory.length} of {history.length} analyses
          </p>
        )}

        {history.length === 0 ? (
          <div className="text-center py-16">
            <Clock className="w-12 h-12 text-muted-foreground/50 mx-auto mb-4" />
            <h2 className="text-xl font-medium text-foreground mb-2">No history yet</h2>
            <p className="text-muted-foreground mb-6">
              Your analyzed articles will appear here
            </p>
            <Button onClick={() => navigate('/')}>
              Analyze Your First Article
            </Button>
          </div>
        ) : filteredHistory.length === 0 ? (
          <div className="text-center py-16">
            <Clock className="w-12 h-12 text-muted-foreground/50 mx-auto mb-4" />
            <h2 className="text-xl font-medium text-foreground mb-2">No matches found</h2>
            <p className="text-muted-foreground mb-6">
              Try adjusting your filters or search terms
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredHistory.map((item) => (
              <div
                key={item.id}
                className="bg-card border border-border rounded-xl overflow-hidden"
              >
                <div 
                  className="p-4 cursor-pointer hover:bg-secondary/30 transition-colors"
                  onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getRatingColor(item.rating)}`}>
                          {item.final_score}
                        </span>
                        <span className="text-xs text-muted-foreground capitalize">
                          {item.rating}
                        </span>
                      </div>
                      <h3 className="font-medium text-foreground truncate">
                        {item.article_title || (item.input_type === 'url' ? item.input_value : 'Text analysis')}
                      </h3>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatDate(item.created_at)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteItem(item.id);
                        }}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                      {expandedId === item.id ? (
                        <ChevronUp className="w-5 h-5 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-muted-foreground" />
                      )}
                    </div>
                  </div>
                </div>

                {expandedId === item.id && (
                  <div className="px-4 pb-4 border-t border-border/50 pt-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                      <div className="text-center p-3 bg-secondary/30 rounded-lg">
                        <div className="text-lg font-bold text-foreground">{item.text_score}</div>
                        <div className="text-xs text-muted-foreground">Text</div>
                      </div>
                      <div className="text-center p-3 bg-secondary/30 rounded-lg">
                        <div className="text-lg font-bold text-foreground">{item.domain_score}</div>
                        <div className="text-xs text-muted-foreground">Domain</div>
                      </div>
                      <div className="text-center p-3 bg-secondary/30 rounded-lg">
                        <div className="text-lg font-bold text-foreground">{item.evidence_score}</div>
                        <div className="text-xs text-muted-foreground">Evidence</div>
                      </div>
                      <div className="text-center p-3 bg-secondary/30 rounded-lg">
                        <div className="text-lg font-bold text-foreground">{item.sentiment_score}</div>
                        <div className="text-xs text-muted-foreground">Sentiment</div>
                      </div>
                    </div>

                    {item.clickbait_words_found && item.clickbait_words_found.length > 0 && (
                      <div className="text-sm">
                        <span className="text-muted-foreground">Clickbait words: </span>
                        <span className="text-foreground">
                          {item.clickbait_words_found.join(', ')}
                        </span>
                      </div>
                    )}

                    {item.input_type === 'url' && (
                      <a
                        href={item.input_value}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-sm text-primary hover:underline mt-2"
                      >
                        View original <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default History;
