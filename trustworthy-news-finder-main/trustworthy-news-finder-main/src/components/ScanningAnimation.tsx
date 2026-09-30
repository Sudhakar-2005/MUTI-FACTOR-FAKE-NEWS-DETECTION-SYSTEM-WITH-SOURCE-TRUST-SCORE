import { cn } from '@/lib/utils';
import { Loader2, Shield } from 'lucide-react';

const stages = [
  'Extracting content...',
  'Analyzing text patterns...',
  'Checking domain reputation...',
  'Comparing with trusted sources...',
  'Evaluating sentiment...',
  'Calculating trust score...'
];

interface ScanningAnimationProps {
  currentStage: number;
}

export function ScanningAnimation({ currentStage }: ScanningAnimationProps) {
  return (
    <div className="relative p-8 rounded-2xl bg-card border border-border overflow-hidden">
      {/* Scan line effect */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute inset-x-0 h-1 scan-line animate-scan" />
      </div>
      
      {/* Central icon */}
      <div className="flex flex-col items-center mb-8">
        <div className="relative">
          <Shield className="w-20 h-20 text-primary animate-pulse-glow" strokeWidth={1} />
          <Loader2 className="absolute inset-0 w-20 h-20 text-primary/50 animate-spin" strokeWidth={1} />
        </div>
        <h3 className="mt-4 text-lg font-semibold text-foreground">Analyzing Content</h3>
        <p className="text-sm text-muted-foreground">Multi-factor verification in progress</p>
      </div>
      
      {/* Progress stages */}
      <div className="space-y-3">
        {stages.map((stage, index) => (
          <div
            key={stage}
            className={cn(
              'flex items-center gap-3 p-3 rounded-lg transition-all duration-300',
              index < currentStage && 'bg-success/10',
              index === currentStage && 'bg-primary/10',
              index > currentStage && 'opacity-40'
            )}
          >
            <div
              className={cn(
                'w-6 h-6 rounded-full flex items-center justify-center text-xs font-mono',
                index < currentStage && 'bg-success text-success-foreground',
                index === currentStage && 'bg-primary text-primary-foreground',
                index > currentStage && 'bg-muted text-muted-foreground'
              )}
            >
              {index < currentStage ? '✓' : index + 1}
            </div>
            <span
              className={cn(
                'text-sm',
                index < currentStage && 'text-success',
                index === currentStage && 'text-primary font-medium',
                index > currentStage && 'text-muted-foreground'
              )}
            >
              {stage}
            </span>
            {index === currentStage && (
              <Loader2 className="ml-auto w-4 h-4 text-primary animate-spin" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
