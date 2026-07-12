import { useState, useCallback } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface ShareCodePanelProps {
  shareCode: string;
  shareUrl: string;
}

export function ShareCodePanel({ shareCode, shareUrl }: ShareCodePanelProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for browsers without clipboard API
      const textArea = document.createElement('textarea');
      textArea.value = shareUrl;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [shareUrl]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Share this code with your opponent</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-center justify-center">
          <span
            className="select-all rounded-lg bg-muted px-6 py-4 font-mono text-4xl sm:text-5xl font-bold tracking-widest"
            aria-label="Share code"
          >
            {shareCode}
          </span>
        </div>

        <div className="flex flex-col gap-2">
          <p className="text-center text-sm text-muted-foreground break-all">
            {shareUrl}
          </p>
          <Button
            variant="outline"
            onClick={handleCopy}
            aria-label={copied ? 'Copied' : 'Copy share URL'}
          >
            {copied ? 'Copied!' : 'Copy Link'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
