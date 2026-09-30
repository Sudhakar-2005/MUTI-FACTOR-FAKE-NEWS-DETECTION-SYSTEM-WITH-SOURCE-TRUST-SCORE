import { useCallback, useState } from 'react';
import { useToast } from '@/hooks/use-toast';

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

export function useExportHistory() {
  const { toast } = useToast();
  const [isExporting, setIsExporting] = useState(false);

  const exportToCSV = useCallback(async (history: HistoryItem[]) => {
    setIsExporting(true);
    try {
      if (history.length === 0) {
        toast({
          title: 'No data',
          description: 'No analysis history to export',
          variant: 'destructive',
        });
        return;
      }

      const headers = [
        'Date',
        'Type',
        'Title/URL',
        'Final Score',
        'Rating',
        'Text Score',
        'Domain Score',
        'Evidence Score',
        'Sentiment Score',
        'Clickbait Words',
      ];

      const rows = history.map(item => [
        new Date(item.created_at).toLocaleString(),
        item.input_type,
        `"${(item.article_title || item.input_value).replace(/"/g, '""')}"`,
        item.final_score,
        item.rating,
        item.text_score,
        item.domain_score,
        item.evidence_score,
        item.sentiment_score,
        `"${(item.clickbait_words_found || []).join(', ')}"`,
      ]);

      const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
      
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `trustguard-history-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({
        title: 'Export complete',
        description: `Exported ${history.length} analyses to CSV`,
      });
    } catch (error) {
      toast({
        title: 'Export failed',
        description: 'Could not export history',
        variant: 'destructive',
      });
    } finally {
      setIsExporting(false);
    }
  }, [toast]);

  const exportToPDF = useCallback(async (history: HistoryItem[]) => {
    setIsExporting(true);
    try {
      if (history.length === 0) {
        toast({
          title: 'No data',
          description: 'No analysis history to export',
          variant: 'destructive',
        });
        return;
      }

      // Create a printable HTML document
      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        toast({
          title: 'Popup blocked',
          description: 'Please allow popups to export PDF',
          variant: 'destructive',
        });
        return;
      }

      const getRatingColor = (rating: string) => {
        switch (rating) {
          case 'reliable': return '#22c55e';
          case 'verify': return '#eab308';
          case 'suspicious': return '#ef4444';
          default: return '#6b7280';
        }
      };

      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>TrustGuard Analysis Report</title>
          <style>
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body { 
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              padding: 40px;
              max-width: 900px;
              margin: 0 auto;
              color: #1f2937;
            }
            h1 { 
              font-size: 24px; 
              margin-bottom: 8px;
              color: #0ea5e9;
            }
            .subtitle { color: #6b7280; margin-bottom: 24px; }
            .date { font-size: 12px; color: #9ca3af; margin-bottom: 32px; }
            .item {
              border: 1px solid #e5e7eb;
              border-radius: 8px;
              padding: 16px;
              margin-bottom: 16px;
              page-break-inside: avoid;
            }
            .item-header {
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
              margin-bottom: 12px;
            }
            .title { font-weight: 600; font-size: 14px; max-width: 70%; }
            .score-badge {
              padding: 4px 12px;
              border-radius: 20px;
              font-weight: 600;
              font-size: 14px;
            }
            .scores {
              display: grid;
              grid-template-columns: repeat(4, 1fr);
              gap: 8px;
              margin-top: 12px;
            }
            .score-item {
              text-align: center;
              padding: 8px;
              background: #f9fafb;
              border-radius: 6px;
            }
            .score-value { font-weight: 600; font-size: 16px; }
            .score-label { font-size: 10px; color: #6b7280; }
            .meta { font-size: 11px; color: #9ca3af; margin-top: 8px; }
            @media print {
              body { padding: 20px; }
              .item { break-inside: avoid; }
            }
          </style>
        </head>
        <body>
          <h1>🛡️ TrustGuard Analysis Report</h1>
          <p class="subtitle">Comprehensive analysis history export</p>
          <p class="date">Generated on ${new Date().toLocaleString()}</p>
          
          ${history.map(item => `
            <div class="item">
              <div class="item-header">
                <div class="title">${item.article_title || item.input_value.slice(0, 80)}${item.input_value.length > 80 ? '...' : ''}</div>
                <div class="score-badge" style="background: ${getRatingColor(item.rating)}20; color: ${getRatingColor(item.rating)}">
                  ${item.final_score}/100
                </div>
              </div>
              <div class="scores">
                <div class="score-item">
                  <div class="score-value">${item.text_score}</div>
                  <div class="score-label">Text</div>
                </div>
                <div class="score-item">
                  <div class="score-value">${item.domain_score}</div>
                  <div class="score-label">Domain</div>
                </div>
                <div class="score-item">
                  <div class="score-value">${item.evidence_score}</div>
                  <div class="score-label">Evidence</div>
                </div>
                <div class="score-item">
                  <div class="score-value">${item.sentiment_score}</div>
                  <div class="score-label">Sentiment</div>
                </div>
              </div>
              <div class="meta">
                ${item.input_type.toUpperCase()} • ${new Date(item.created_at).toLocaleString()} • ${item.rating.toUpperCase()}
              </div>
            </div>
          `).join('')}
          
          <script>window.onload = () => { window.print(); }</script>
        </body>
        </html>
      `;

      printWindow.document.write(htmlContent);
      printWindow.document.close();

      toast({
        title: 'PDF ready',
        description: 'Use the print dialog to save as PDF',
      });
    } catch (error) {
      toast({
        title: 'Export failed',
        description: 'Could not generate PDF',
        variant: 'destructive',
      });
    } finally {
      setIsExporting(false);
    }
  }, [toast]);

  return {
    exportToCSV,
    exportToPDF,
    isExporting,
  };
}
