import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Brain, CheckCircle, XCircle, AlertTriangle, HelpCircle, Loader2, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface FactualClaim {
  claim: string;
  assessment: 'verified' | 'likely_true' | 'unverified' | 'likely_false' | 'false';
  explanation: string;
}

interface SourceAnalysis {
  credibility: 'high' | 'medium' | 'low' | 'unknown';
  reasoning: string;
}

interface AIAnalysis {
  overallAssessment: 'reliable' | 'mostly_accurate' | 'needs_verification' | 'misleading' | 'false';
  confidenceScore: number;
  factualClaims: FactualClaim[];
  redFlags: string[];
  missingContext: string[];
  sourceAnalysis: SourceAnalysis;
  recommendation: string;
}

interface RelatedFactCheck {
  id: string;
  claim: string;
  verdict: string;
  explanation: string;
  source_url: string;
}

interface AIFactCheckProps {
  content: string;
  title?: string;
  url?: string;
}

export function AIFactCheck({ content, title, url }: AIFactCheckProps) {
  const [analysis, setAnalysis] = useState<AIAnalysis | null>(null);
  const [relatedFactChecks, setRelatedFactChecks] = useState<RelatedFactCheck[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [claimsExpanded, setClaimsExpanded] = useState(false);

  const runAnalysis = async () => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('ai-fact-check', {
        body: { content, title, url }
      });

      if (fnError) throw fnError;

      setAnalysis(data.analysis);
      setRelatedFactChecks(data.relatedFactChecks || []);
      setExpanded(true);
    } catch (err) {
      console.error('AI fact-check error:', err);
      setError(err instanceof Error ? err.message : 'Analysis failed');
    } finally {
      setLoading(false);
    }
  };

  const getAssessmentIcon = (assessment: string) => {
    switch (assessment) {
      case 'reliable':
      case 'verified':
      case 'likely_true':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'mostly_accurate':
        return <CheckCircle className="w-5 h-5 text-green-400" />;
      case 'needs_verification':
      case 'unverified':
        return <HelpCircle className="w-5 h-5 text-yellow-500" />;
      case 'misleading':
      case 'likely_false':
        return <AlertTriangle className="w-5 h-5 text-orange-500" />;
      case 'false':
        return <XCircle className="w-5 h-5 text-red-500" />;
      default:
        return <HelpCircle className="w-5 h-5 text-muted-foreground" />;
    }
  };

  const getAssessmentColor = (assessment: string) => {
    switch (assessment) {
      case 'reliable':
      case 'verified':
      case 'likely_true':
        return 'bg-green-500/10 text-green-500 border-green-500/20';
      case 'mostly_accurate':
        return 'bg-green-400/10 text-green-400 border-green-400/20';
      case 'needs_verification':
      case 'unverified':
        return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
      case 'misleading':
      case 'likely_false':
        return 'bg-orange-500/10 text-orange-500 border-orange-500/20';
      case 'false':
        return 'bg-red-500/10 text-red-500 border-red-500/20';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const getCredibilityColor = (credibility: string) => {
    switch (credibility) {
      case 'high': return 'text-green-500';
      case 'medium': return 'text-yellow-500';
      case 'low': return 'text-red-500';
      default: return 'text-muted-foreground';
    }
  };

  if (!analysis && !loading) {
    return (
      <Card className="border-dashed">
        <CardContent className="pt-6">
          <div className="text-center">
            <Brain className="w-10 h-10 mx-auto mb-3 text-primary" />
            <h3 className="font-semibold mb-2">AI-Powered Fact Check</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Use AI to analyze claims, detect misinformation, and verify sources
            </p>
            <Button onClick={runAnalysis} disabled={loading}>
              <Brain className="w-4 h-4 mr-2" />
              Run AI Analysis
            </Button>
            {error && (
              <p className="text-sm text-destructive mt-3">{error}</p>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center gap-3 py-8">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
            <span className="text-muted-foreground">Analyzing content with AI...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Collapsible open={expanded} onOpenChange={setExpanded}>
      <Card>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Brain className="w-5 h-5 text-primary" />
                AI Fact-Check Results
              </CardTitle>
              <div className="flex items-center gap-3">
                <Badge className={getAssessmentColor(analysis!.overallAssessment)}>
                  {getAssessmentIcon(analysis!.overallAssessment)}
                  <span className="ml-1 capitalize">
                    {analysis!.overallAssessment.replace('_', ' ')}
                  </span>
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {analysis!.confidenceScore}% confidence
                </span>
                {expanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="space-y-6">
            {/* Recommendation */}
            <div className="p-4 rounded-lg bg-muted/50">
              <p className="text-sm font-medium">{analysis!.recommendation}</p>
            </div>

            {/* Source Analysis */}
            <div>
              <h4 className="font-semibold mb-2 flex items-center gap-2">
                <ExternalLink className="w-4 h-4" />
                Source Credibility
              </h4>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className={getCredibilityColor(analysis!.sourceAnalysis.credibility)}>
                  {analysis!.sourceAnalysis.credibility.toUpperCase()}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {analysis!.sourceAnalysis.reasoning}
                </span>
              </div>
            </div>

            {/* Red Flags */}
            {analysis!.redFlags.length > 0 && (
              <div>
                <h4 className="font-semibold mb-2 flex items-center gap-2 text-orange-500">
                  <AlertTriangle className="w-4 h-4" />
                  Red Flags Detected
                </h4>
                <ul className="space-y-1">
                  {analysis!.redFlags.map((flag, i) => (
                    <li key={i} className="text-sm flex items-start gap-2">
                      <span className="text-orange-500">•</span>
                      {flag}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Missing Context */}
            {analysis!.missingContext.length > 0 && (
              <div>
                <h4 className="font-semibold mb-2 flex items-center gap-2 text-yellow-500">
                  <HelpCircle className="w-4 h-4" />
                  Missing Context
                </h4>
                <ul className="space-y-1">
                  {analysis!.missingContext.map((ctx, i) => (
                    <li key={i} className="text-sm flex items-start gap-2">
                      <span className="text-yellow-500">•</span>
                      {ctx}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Factual Claims */}
            {analysis!.factualClaims.length > 0 && (
              <Collapsible open={claimsExpanded} onOpenChange={setClaimsExpanded}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" className="w-full justify-between">
                    <span className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4" />
                      Factual Claims Analyzed ({analysis!.factualClaims.length})
                    </span>
                    {claimsExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-3 space-y-3">
                  {analysis!.factualClaims.map((claim, i) => (
                    <div key={i} className={`p-3 rounded-lg border ${getAssessmentColor(claim.assessment)}`}>
                      <div className="flex items-start gap-2">
                        {getAssessmentIcon(claim.assessment)}
                        <div>
                          <p className="font-medium text-sm">{claim.claim}</p>
                          <p className="text-xs mt-1 opacity-80">{claim.explanation}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </CollapsibleContent>
              </Collapsible>
            )}

            {/* Related Fact Checks from Database */}
            {relatedFactChecks.length > 0 && (
              <div>
                <h4 className="font-semibold mb-2">Related Verified Fact-Checks</h4>
                <div className="space-y-2">
                  {relatedFactChecks.map((fc) => (
                    <div key={fc.id} className="p-3 rounded-lg border bg-card">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium">{fc.claim}</p>
                        <Badge variant="outline" className="capitalize shrink-0">
                          {fc.verdict}
                        </Badge>
                      </div>
                      {fc.explanation && (
                        <p className="text-xs text-muted-foreground mt-1">{fc.explanation}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <Button variant="outline" onClick={runAnalysis} className="w-full">
              <Brain className="w-4 h-4 mr-2" />
              Re-run Analysis
            </Button>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
