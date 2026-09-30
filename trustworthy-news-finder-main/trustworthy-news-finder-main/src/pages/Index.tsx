import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { InputPanel } from '@/components/InputPanel';
import { ScanningAnimation } from '@/components/ScanningAnimation';
import { ScoreGauge } from '@/components/ScoreGauge';
import { TrustScoreIndicator } from '@/components/TrustScoreIndicator';
import { ExplanationPanel } from '@/components/ExplanationPanel';
import { AIFactCheck } from '@/components/AIFactCheck';
import { SocialShare } from '@/components/SocialShare';
import { analyzeContent, AnalysisResult, isValidUrl } from '@/lib/analysis';
import { scrapeArticle, saveAnalysis } from '@/hooks/useAnalysis';
import { useAuth } from '@/contexts/AuthContext';
import { useNotificationSound } from '@/hooks/useNotificationSound';
import { useRealtimeNotifications } from '@/hooks/useRealtimeNotifications';
import { Shield, FileSearch, Globe, Search, Brain, History, LogIn, LogOut, User, BarChart3, Settings, Scale, Trophy } from 'lucide-react';
import { NotificationCenter } from '@/components/NotificationCenter';
import { BookmarkletButton } from '@/components/BookmarkletButton';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

const Index = () => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [scanStage, setScanStage] = useState(0);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [articleTitle, setArticleTitle] = useState<string>('');
  const [scrapedContent, setScrapedContent] = useState<string>('');

  const { user, signOut, loading: authLoading } = useAuth();
  const { triggerLowScoreAlert } = useNotificationSound();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  // Enable realtime notifications
  useRealtimeNotifications();

  // Handle bookmarklet URL parameter
  useEffect(() => {
    const analyzeUrl = searchParams.get('analyze');
    if (analyzeUrl) {
      const decodedUrl = decodeURIComponent(analyzeUrl);
      if (isValidUrl(decodedUrl)) {
        handleAnalyze(decodedUrl, true);
        setSearchParams({});
      }
    }
  }, [searchParams]);

  useEffect(() => {
    if (isAnalyzing) {
      const interval = setInterval(() => {
        setScanStage((prev) => {
          if (prev >= 5) {
            clearInterval(interval);
            return prev;
          }
          return prev + 1;
        });
      }, 400);
      return () => clearInterval(interval);
    }
  }, [isAnalyzing]);

  const handleAnalyze = async (input: string, isUrl: boolean) => {
    setIsAnalyzing(true);
    setScanStage(0);
    setResult(null);
    setArticleTitle('');
    setScrapedContent('');

    try {
      let contentToAnalyze = input;
      let title = '';
      let content = '';

      // If URL, try to scrape content
      if (isUrl && isValidUrl(input)) {
        try {
          const scraped = await scrapeArticle(input);
          if (scraped.success && scraped.content) {
            contentToAnalyze = scraped.content;
            title = scraped.title;
            content = scraped.content;
            setArticleTitle(title);
            setScrapedContent(content);
          }
        } catch (err) {
          console.log('Scraping failed, analyzing URL directly');
        }
      }

      const analysisResult = await analyzeContent(contentToAnalyze, isUrl);
      setResult(analysisResult);

      // Trigger sound/push notification for low trust scores
      if (analysisResult.finalScore < 40) {
        triggerLowScoreAlert(analysisResult.finalScore, title || input.slice(0, 50));
      }

      // Save to history if user is logged in
      if (user) {
        try {
          await saveAnalysis(user.id, input, isUrl, analysisResult, title, content);
        } catch (err) {
          console.error('Failed to save analysis:', err);
        }
      }
    } catch (error) {
      console.error('Analysis error:', error);
      toast({
        title: 'Analysis Error',
        description: 'Failed to analyze content. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsAnalyzing(false);
      setScanStage(0);
    }
  };

  const handleReset = () => {
    setResult(null);
    setIsAnalyzing(false);
    setScanStage(0);
    setArticleTitle('');
    setScrapedContent('');
  };

  const handleSignOut = async () => {
    await signOut();
    toast({ title: 'Signed out', description: 'See you next time!' });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Shield className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-foreground">TrustGuard</h1>
                <p className="text-xs text-muted-foreground">Multi-Factor Fake News Detection</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <BookmarkletButton />
              {!authLoading && (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate('/compare')}
                    className="gap-2"
                  >
                    <Scale className="w-4 h-4" />
                    <span className="hidden sm:inline">Compare</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate('/dashboard')}
                    className="gap-2"
                  >
                    <BarChart3 className="w-4 h-4" />
                    <span className="hidden sm:inline">Dashboard</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate('/leaderboard')}
                    className="gap-2"
                  >
                    <Trophy className="w-4 h-4" />
                    <span className="hidden sm:inline">Leaderboard</span>
                  </Button>
                  {user ? (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate('/history')}
                        className="gap-2"
                      >
                        <History className="w-4 h-4" />
                        <span className="hidden sm:inline">History</span>
                      </Button>
                      <NotificationCenter />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate('/settings')}
                        className="gap-2"
                      >
                        <Settings className="w-4 h-4" />
                        <span className="hidden sm:inline">Settings</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleSignOut}
                        className="gap-2"
                      >
                        <LogOut className="w-4 h-4" />
                        <span className="hidden sm:inline">Sign Out</span>
                      </Button>
                    </>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate('/auth')}
                      className="gap-2"
                    >
                      <LogIn className="w-4 h-4" />
                      Sign In
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Hero Section */}
        {!result && !isAnalyzing && (
          <div className="text-center mb-10 animate-fade-in-up">
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              <span className="text-foreground">Verify Before You </span>
              <span className="text-gradient">Share</span>
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Our multi-factor analysis system evaluates content credibility using text patterns, 
              domain reputation, source comparison, and sentiment analysis.
            </p>
            
            {/* Feature badges */}
            <div className="flex flex-wrap justify-center gap-3 mt-6">
              {[
                { icon: FileSearch, label: 'Text Analysis' },
                { icon: Globe, label: 'Domain Check' },
                { icon: Search, label: 'Source Comparison' },
                { icon: Brain, label: 'Sentiment Detection' }
              ].map(({ icon: Icon, label }) => (
                <div
                  key={label}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-secondary/50 border border-border/50"
                >
                  <Icon className="w-3.5 h-3.5 text-primary" />
                  <span className="text-xs text-muted-foreground">{label}</span>
                </div>
              ))}
            </div>

            {!user && (
              <div className="mt-6 p-4 bg-secondary/30 rounded-lg border border-border/50 max-w-md mx-auto">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <User className="w-4 h-4" />
                  <span>
                    <button 
                      onClick={() => navigate('/auth')}
                      className="text-primary hover:underline"
                    >
                      Sign in
                    </button>
                    {' '}to save your analysis history
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Input Panel */}
        {!result && !isAnalyzing && (
          <div className="mb-8">
            <InputPanel onAnalyze={handleAnalyze} isLoading={isAnalyzing} />
          </div>
        )}

        {/* Scanning Animation */}
        {isAnalyzing && (
          <div className="mb-8">
            <ScanningAnimation currentStage={scanStage} />
          </div>
        )}

        {/* Results */}
        {result && (
          <div className="space-y-8">
            {/* Action buttons */}
            <div className="flex items-center justify-between">
              <button
                onClick={handleReset}
                className="text-sm text-primary hover:text-primary/80 transition-colors flex items-center gap-2"
              >
                ← Analyze Another
              </button>
              <SocialShare 
                score={result.finalScore} 
                rating={result.rating} 
                title={articleTitle}
              />
            </div>

            {/* Article Title */}
            {articleTitle && (
              <div className="p-4 bg-secondary/30 rounded-lg border border-border/50">
                <p className="text-xs text-muted-foreground mb-1">Analyzed Article</p>
                <h3 className="font-medium text-foreground">{articleTitle}</h3>
              </div>
            )}

            {/* Main Trust Score */}
            <TrustScoreIndicator score={result.finalScore} rating={result.rating} />

            {/* Component Scores */}
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-4 flex items-center gap-2">
                <span className="w-8 h-px bg-border" />
                Component Scores
                <span className="flex-1 h-px bg-border" />
              </h3>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <ScoreGauge
                  score={result.textScore}
                  label="Text Analysis"
                  icon={<FileSearch className="w-4 h-4" />}
                  delay={200}
                />
                <ScoreGauge
                  score={result.domainScore}
                  label="Domain Trust"
                  icon={<Globe className="w-4 h-4" />}
                  delay={400}
                />
                <ScoreGauge
                  score={result.evidenceScore}
                  label="Evidence Match"
                  icon={<Search className="w-4 h-4" />}
                  delay={600}
                />
                <ScoreGauge
                  score={result.sentimentScore}
                  label="Sentiment Score"
                  icon={<Brain className="w-4 h-4" />}
                  delay={800}
                />
              </div>
            </div>

            {/* Explanation */}
            <ExplanationPanel result={result} />

            {/* AI Fact-Check */}
            {scrapedContent && (
              <AIFactCheck 
                content={scrapedContent} 
                title={articleTitle}
                url={result ? undefined : undefined}
              />
            )}

            {/* Save prompt for non-logged in users */}
            {!user && (
              <div className="p-4 bg-primary/5 rounded-lg border border-primary/20 text-center">
                <p className="text-sm text-muted-foreground mb-3">
                  Want to save this analysis and track patterns over time?
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate('/auth')}
                  className="gap-2"
                >
                  <LogIn className="w-4 h-4" />
                  Create Free Account
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Footer info */}
        {!isAnalyzing && (
          <footer className="mt-16 pt-8 border-t border-border/30 text-center">
            <p className="text-xs text-muted-foreground">
              TrustGuard uses heuristic analysis. Always verify important news through multiple trusted sources.
            </p>
            <p className="text-xs text-muted-foreground/60 mt-2">
              Score weighting: Text (35%) • Domain (25%) • Evidence (25%) • Sentiment (15%)
            </p>
          </footer>
        )}
      </main>
    </div>
  );
};

export default Index;
