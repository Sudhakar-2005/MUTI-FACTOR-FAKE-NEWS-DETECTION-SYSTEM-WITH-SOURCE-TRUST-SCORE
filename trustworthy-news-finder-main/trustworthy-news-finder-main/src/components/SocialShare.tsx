import { Twitter, Facebook, Linkedin, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';

interface SocialShareProps {
  score: number;
  rating: 'reliable' | 'verify' | 'suspicious';
  title?: string;
  url?: string;
}

export function SocialShare({ score, rating, title, url }: SocialShareProps) {
  const { toast } = useToast();

  const getRatingEmoji = () => {
    if (rating === 'reliable') return '✅';
    if (rating === 'verify') return '⚠️';
    return '🚨';
  };

  const getRatingText = () => {
    if (rating === 'reliable') return 'Reliable';
    if (rating === 'verify') return 'Needs Verification';
    return 'Suspicious';
  };

  const shareText = `${getRatingEmoji()} TrustGuard Analysis: ${score}% Trust Score (${getRatingText()})${title ? ` - "${title}"` : ''}\n\nVerify news before sharing! Try TrustGuard:`;
  
  const currentUrl = url || window.location.href;
  const trustGuardUrl = window.location.origin;

  const shareToTwitter = () => {
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(trustGuardUrl)}`;
    window.open(twitterUrl, '_blank', 'width=550,height=420');
  };

  const shareToFacebook = () => {
    const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(trustGuardUrl)}&quote=${encodeURIComponent(shareText)}`;
    window.open(facebookUrl, '_blank', 'width=550,height=420');
  };

  const shareToLinkedIn = () => {
    const linkedInUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(trustGuardUrl)}`;
    window.open(linkedInUrl, '_blank', 'width=550,height=420');
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(`${shareText} ${trustGuardUrl}`);
      toast({ title: 'Copied!', description: 'Share text copied to clipboard' });
    } catch {
      toast({ title: 'Error', description: 'Failed to copy', variant: 'destructive' });
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Share2 className="w-4 h-4" />
          Share Results
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={shareToTwitter} className="gap-2 cursor-pointer">
          <Twitter className="w-4 h-4" />
          Share on X
        </DropdownMenuItem>
        <DropdownMenuItem onClick={shareToFacebook} className="gap-2 cursor-pointer">
          <Facebook className="w-4 h-4" />
          Share on Facebook
        </DropdownMenuItem>
        <DropdownMenuItem onClick={shareToLinkedIn} className="gap-2 cursor-pointer">
          <Linkedin className="w-4 h-4" />
          Share on LinkedIn
        </DropdownMenuItem>
        <DropdownMenuItem onClick={copyToClipboard} className="gap-2 cursor-pointer">
          <Share2 className="w-4 h-4" />
          Copy to Clipboard
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
