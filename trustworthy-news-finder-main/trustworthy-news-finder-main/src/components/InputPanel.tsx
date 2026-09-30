import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Globe, FileText, Search, Zap } from 'lucide-react';

interface InputPanelProps {
  onAnalyze: (input: string, isUrl: boolean) => void;
  isLoading: boolean;
}

export function InputPanel({ onAnalyze, isLoading }: InputPanelProps) {
  const [input, setInput] = useState('');
  const [inputType, setInputType] = useState<'url' | 'text'>('url');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim()) {
      onAnalyze(input.trim(), inputType === 'url');
    }
  };

  const sampleUrl = 'https://example-news-site.com/shocking-discovery-revealed';
  const sampleText = `BREAKING: Scientists Make SHOCKING Discovery That Changes Everything!

You won't believe what researchers have uncovered in this mind-blowing study. This secret has been hidden for years, and they don't want you to know about it. Experts are calling it the most explosive revelation of the decade.

Click here to see what happens next - your life will never be the same!`;

  const handleUseSample = () => {
    if (inputType === 'url') {
      setInput(sampleUrl);
    } else {
      setInput(sampleText);
    }
  };

  return (
    <div className="p-6 rounded-2xl bg-card border border-border">
      {/* Input type tabs */}
      <div className="flex gap-2 mb-6">
        <button
          type="button"
          onClick={() => setInputType('url')}
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all',
            inputType === 'url'
              ? 'bg-primary text-primary-foreground'
              : 'bg-secondary text-muted-foreground hover:text-foreground'
          )}
        >
          <Globe className="w-4 h-4" />
          URL
        </button>
        <button
          type="button"
          onClick={() => setInputType('text')}
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all',
            inputType === 'text'
              ? 'bg-primary text-primary-foreground'
              : 'bg-secondary text-muted-foreground hover:text-foreground'
          )}
        >
          <FileText className="w-4 h-4" />
          Raw Text
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {inputType === 'url' ? (
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Enter article URL to analyze..."
              className="w-full pl-12 pr-4 py-4 rounded-xl bg-secondary border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
              disabled={isLoading}
            />
          </div>
        ) : (
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Paste article text here to analyze..."
            rows={6}
            className="w-full px-4 py-4 rounded-xl bg-secondary border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all resize-none"
            disabled={isLoading}
          />
        )}

        <div className="flex items-center gap-3">
          <Button
            type="submit"
            variant="scan"
            size="lg"
            disabled={!input.trim() || isLoading}
            className="flex-1"
          >
            <Zap className="w-5 h-5" />
            {isLoading ? 'Analyzing...' : 'Analyze Content'}
          </Button>
          
          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={handleUseSample}
            disabled={isLoading}
          >
            Use Sample
          </Button>
        </div>
      </form>

      {/* Info text */}
      <p className="mt-4 text-xs text-muted-foreground text-center">
        This tool uses multiple factors to assess content trustworthiness. Results are indicative, not definitive.
      </p>
    </div>
  );
}
