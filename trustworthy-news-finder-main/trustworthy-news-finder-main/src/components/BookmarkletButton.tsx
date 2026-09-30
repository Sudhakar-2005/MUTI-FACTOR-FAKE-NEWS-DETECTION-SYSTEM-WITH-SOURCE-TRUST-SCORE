import { Bookmark, Copy, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

export function BookmarkletButton() {
  const { toast } = useToast();
  
  // Get the current origin for the bookmarklet
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  
  const bookmarkletCode = `javascript:(function(){var url=encodeURIComponent(window.location.href);window.open('${origin}?analyze='+url,'_blank');})();`;

  const copyBookmarklet = () => {
    navigator.clipboard.writeText(bookmarkletCode);
    toast({
      title: 'Copied!',
      description: 'Bookmarklet code copied to clipboard',
    });
  };

  const shareCurrentPage = () => {
    const url = encodeURIComponent(window.location.href);
    window.open(`${origin}?analyze=${url}`, '_blank');
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Bookmark className="w-4 h-4" />
          <span className="hidden sm:inline">Quick Analyze</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Quick Analyze Any Article</DialogTitle>
          <DialogDescription>
            Use the bookmarklet or share button to analyze articles from any website.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          {/* Bookmarklet Instructions */}
          <div className="p-4 bg-secondary/30 rounded-lg border border-border/50">
            <h4 className="font-medium text-foreground mb-2 flex items-center gap-2">
              <Bookmark className="w-4 h-4 text-primary" />
              Bookmarklet
            </h4>
            <p className="text-sm text-muted-foreground mb-3">
              Drag this button to your bookmarks bar, then click it on any article to analyze:
            </p>
            <a
              href={bookmarkletCode}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
              onClick={(e) => e.preventDefault()}
              draggable="true"
            >
              🛡️ TrustGuard Check
            </a>
            <p className="text-xs text-muted-foreground mt-2">
              (Drag this to your bookmarks bar)
            </p>
          </div>

          {/* Copy Button */}
          <Button
            variant="outline"
            className="w-full gap-2"
            onClick={copyBookmarklet}
          >
            <Copy className="w-4 h-4" />
            Copy Bookmarklet Code
          </Button>

          {/* Share URL Method */}
          <div className="p-4 bg-secondary/30 rounded-lg border border-border/50">
            <h4 className="font-medium text-foreground mb-2 flex items-center gap-2">
              <ExternalLink className="w-4 h-4 text-primary" />
              Share URL
            </h4>
            <p className="text-sm text-muted-foreground mb-2">
              You can also analyze any URL by adding it to our link:
            </p>
            <code className="block text-xs bg-background p-2 rounded border border-border overflow-x-auto">
              {origin}?analyze=YOUR_URL_HERE
            </code>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
