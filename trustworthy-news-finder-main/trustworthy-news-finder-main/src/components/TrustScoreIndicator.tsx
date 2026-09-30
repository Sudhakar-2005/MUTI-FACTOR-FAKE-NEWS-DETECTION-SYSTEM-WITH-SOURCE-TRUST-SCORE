import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Shield, ShieldAlert, ShieldCheck, ShieldQuestion } from 'lucide-react';

interface TrustScoreIndicatorProps {
  score: number;
  rating: 'reliable' | 'verify' | 'suspicious';
}

export function TrustScoreIndicator({ score, rating }: TrustScoreIndicatorProps) {
  const [displayScore, setDisplayScore] = useState(0);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(true);
      // Animate count up
      const duration = 1500;
      const steps = 50;
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
    }, 800);

    return () => clearTimeout(timer);
  }, [score]);

  const config = {
    reliable: {
      icon: ShieldCheck,
      label: 'Likely Reliable',
      gradient: 'from-success to-emerald-400',
      bg: 'bg-success/10',
      border: 'border-success/30',
      text: 'text-success',
      glow: 'shadow-success/20'
    },
    verify: {
      icon: ShieldQuestion,
      label: 'Needs Verification',
      gradient: 'from-warning to-amber-400',
      bg: 'bg-warning/10',
      border: 'border-warning/30',
      text: 'text-warning',
      glow: 'shadow-warning/20'
    },
    suspicious: {
      icon: ShieldAlert,
      label: 'High Risk / Suspicious',
      gradient: 'from-destructive to-red-400',
      bg: 'bg-destructive/10',
      border: 'border-destructive/30',
      text: 'text-destructive',
      glow: 'shadow-destructive/20'
    }
  };

  const { icon: Icon, label, gradient, bg, border, text, glow } = config[rating];

  return (
    <div
      className={cn(
        'relative p-8 rounded-2xl border-2 transition-all duration-700',
        bg,
        border,
        isVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
      )}
    >
      {/* Glow effect */}
      <div
        className={cn(
          'absolute inset-0 rounded-2xl blur-xl opacity-50 -z-10 transition-opacity duration-1000',
          isVisible ? 'opacity-50' : 'opacity-0'
        )}
        style={{
          background: rating === 'reliable' 
            ? 'radial-gradient(circle, hsl(var(--success) / 0.3) 0%, transparent 70%)'
            : rating === 'verify'
            ? 'radial-gradient(circle, hsl(var(--warning) / 0.3) 0%, transparent 70%)'
            : 'radial-gradient(circle, hsl(var(--destructive) / 0.3) 0%, transparent 70%)'
        }}
      />
      
      <div className="flex flex-col items-center text-center">
        <Icon className={cn('w-16 h-16 mb-4', text)} strokeWidth={1.5} />
        
        <div className="relative mb-2">
          <span
            className={cn(
              'text-7xl font-bold font-mono bg-gradient-to-r bg-clip-text text-transparent',
              gradient
            )}
          >
            {displayScore}
          </span>
          <span className={cn('absolute -right-8 top-2 text-2xl font-light', text)}>/100</span>
        </div>
        
        <h3 className={cn('text-xl font-semibold', text)}>{label}</h3>
        
        <div className="mt-4 text-sm text-muted-foreground">
          Trust Score Range: {rating === 'reliable' ? '80-100' : rating === 'verify' ? '50-79' : '0-49'}
        </div>
      </div>
    </div>
  );
}
