import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

interface ScoreGaugeProps {
  score: number;
  label: string;
  icon: React.ReactNode;
  delay?: number;
}

export function ScoreGauge({ score, label, icon, delay = 0 }: ScoreGaugeProps) {
  const [displayScore, setDisplayScore] = useState(0);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(true);
      // Animate count up
      const duration = 1000;
      const steps = 30;
      const increment = score / steps;
      let current = 0;
      
      const interval = setInterval(() => {
        current += increment;
        if (current >= score) {
          setDisplayScore(score);
          clearInterval(interval);
        } else {
          setDisplayScore(Math.round(current));
        }
      }, duration / steps);

      return () => clearInterval(interval);
    }, delay);

    return () => clearTimeout(timer);
  }, [score, delay]);

  const getScoreColor = (s: number) => {
    if (s >= 80) return 'text-success';
    if (s >= 50) return 'text-warning';
    return 'text-destructive';
  };

  const getBarColor = (s: number) => {
    if (s >= 80) return 'bg-success';
    if (s >= 50) return 'bg-warning';
    return 'bg-destructive';
  };

  return (
    <div
      className={cn(
        'p-4 rounded-xl bg-secondary/50 border border-border/50 transition-all duration-500',
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
      )}
    >
      <div className="flex items-center gap-3 mb-3">
        <div className="text-muted-foreground">{icon}</div>
        <span className="text-sm font-medium text-muted-foreground">{label}</span>
      </div>
      
      <div className="flex items-end justify-between mb-2">
        <span className={cn('text-3xl font-bold font-mono', getScoreColor(displayScore))}>
          {displayScore}
        </span>
        <span className="text-xs text-muted-foreground">/100</span>
      </div>
      
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-1000 ease-out', getBarColor(score))}
          style={{ width: isVisible ? `${score}%` : '0%', transitionDelay: `${delay + 200}ms` }}
        />
      </div>
    </div>
  );
}
