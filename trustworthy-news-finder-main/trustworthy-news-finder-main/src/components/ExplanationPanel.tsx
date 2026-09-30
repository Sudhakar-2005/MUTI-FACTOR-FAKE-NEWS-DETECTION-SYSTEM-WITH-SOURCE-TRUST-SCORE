import { AnalysisResult } from '@/lib/analysis';
import { cn } from '@/lib/utils';
import { AlertCircle, CheckCircle, Clock, Globe, Info, MessageSquare, Search, Shield } from 'lucide-react';

interface ExplanationPanelProps {
  result: AnalysisResult;
}

export function ExplanationPanel({ result }: ExplanationPanelProps) {
  return (
    <div className="space-y-6 animate-fade-in-up" style={{ animationDelay: '1.2s' }}>
      {/* Details Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <DetailCard
          icon={<Globe className="w-4 h-4" />}
          label="Domain Age"
          value={result.details.domainAge}
        />
        <DetailCard
          icon={<Shield className="w-4 h-4" />}
          label="SSL Secure"
          value={result.details.sslValid ? 'Yes' : 'No'}
          status={result.details.sslValid ? 'good' : 'bad'}
        />
        <DetailCard
          icon={<Search className="w-4 h-4" />}
          label="Similar Sources"
          value={`${result.details.similarSources} found`}
          status={result.details.similarSources >= 3 ? 'good' : result.details.similarSources >= 2 ? 'neutral' : 'bad'}
        />
        <DetailCard
          icon={<MessageSquare className="w-4 h-4" />}
          label="Sentiment"
          value={result.details.sentimentBias}
          status={result.details.sentimentBias === 'Balanced' || result.details.sentimentBias === 'Neutral' ? 'good' : 'neutral'}
        />
      </div>

      {/* Clickbait Words */}
      {result.details.clickbaitWords.length > 0 && (
        <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20">
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle className="w-4 h-4 text-destructive" />
            <span className="text-sm font-medium text-destructive">Detected Clickbait Patterns</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {result.details.clickbaitWords.map((word) => (
              <span
                key={word}
                className="px-2 py-1 text-xs rounded-md bg-destructive/20 text-destructive font-mono"
              >
                "{word}"
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Explanation List */}
      <div className="p-4 rounded-xl bg-secondary/50 border border-border/50">
        <div className="flex items-center gap-2 mb-4">
          <Info className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium text-foreground">Analysis Summary</span>
        </div>
        <ul className="space-y-2">
          {result.explanation.map((item, index) => (
            <li key={index} className="flex items-start gap-2 text-sm text-muted-foreground">
              <span className="text-primary mt-1">•</span>
              {item}
            </li>
          ))}
        </ul>
      </div>

      {/* Formula explanation */}
      <div className="p-4 rounded-xl bg-muted/30 border border-border/30">
        <div className="flex items-center gap-2 mb-3">
          <Clock className="w-4 h-4 text-muted-foreground" />
          <span className="text-xs font-mono text-muted-foreground">Score Calculation</span>
        </div>
        <code className="block text-xs font-mono text-muted-foreground leading-relaxed">
          final_score = (0.35 × text) + (0.25 × domain) + (0.25 × evidence) + (0.15 × sentiment)
          <br />
          final_score = (0.35 × {result.textScore}) + (0.25 × {result.domainScore}) + (0.25 × {result.evidenceScore}) + (0.15 × {result.sentimentScore}) = <span className="text-primary font-semibold">{result.finalScore}</span>
        </code>
      </div>
    </div>
  );
}

function DetailCard({
  icon,
  label,
  value,
  status
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  status?: 'good' | 'neutral' | 'bad';
}) {
  return (
    <div className="p-3 rounded-lg bg-secondary/30 border border-border/30">
      <div className="flex items-center gap-2 mb-1 text-muted-foreground">
        {icon}
        <span className="text-xs">{label}</span>
      </div>
      <span
        className={cn(
          'text-sm font-medium',
          status === 'good' && 'text-success',
          status === 'bad' && 'text-destructive',
          status === 'neutral' && 'text-warning',
          !status && 'text-foreground'
        )}
      >
        {value}
      </span>
    </div>
  );
}
