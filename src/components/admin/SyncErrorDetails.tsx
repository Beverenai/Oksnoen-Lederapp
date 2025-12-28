import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronUp, Copy, Check, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

interface SyncErrorDetailsProps {
  error: string;
  webhookStatus?: number;
  webhookUrl?: string;
  correlationId?: string;
  rawResponse?: string;
  n8nError?: string | null;
  n8nStackTrace?: string[] | null;
}

export function SyncErrorDetails({
  error,
  webhookStatus,
  webhookUrl,
  correlationId,
  rawResponse,
  n8nError,
  n8nStackTrace,
}: SyncErrorDetailsProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const copyToClipboard = () => {
    const details = {
      error,
      webhookStatus,
      webhookUrl,
      correlationId,
      n8nError,
      n8nStackTrace,
      rawResponse,
    };
    navigator.clipboard.writeText(JSON.stringify(details, null, 2));
    setCopied(true);
    toast.success('Kopiert til utklippstavlen');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="mt-4 p-4 rounded-lg bg-destructive/10 border border-destructive/20">
      <div className="flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="font-medium text-destructive">Synkronisering feilet</p>
          <p className="text-sm text-muted-foreground mt-1">
            {n8nError || error}
          </p>
          
          {webhookStatus && (
            <p className="text-xs text-muted-foreground mt-1">
              HTTP Status: {webhookStatus}
            </p>
          )}
        </div>
      </div>

      <div className="mt-3 flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-xs"
        >
          {isExpanded ? (
            <>
              <ChevronUp className="w-3 h-3 mr-1" />
              Skjul detaljer
            </>
          ) : (
            <>
              <ChevronDown className="w-3 h-3 mr-1" />
              Vis detaljer
            </>
          )}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={copyToClipboard}
          className="text-xs"
        >
          {copied ? (
            <>
              <Check className="w-3 h-3 mr-1" />
              Kopiert
            </>
          ) : (
            <>
              <Copy className="w-3 h-3 mr-1" />
              Kopier
            </>
          )}
        </Button>
      </div>

      {isExpanded && (
        <div className="mt-3 space-y-3 text-xs">
          {webhookUrl && (
            <div>
              <p className="font-medium text-muted-foreground">Webhook URL:</p>
              <code className="block mt-1 p-2 rounded bg-muted overflow-x-auto">
                {webhookUrl}
              </code>
            </div>
          )}

          {correlationId && (
            <div>
              <p className="font-medium text-muted-foreground">Correlation ID:</p>
              <code className="block mt-1 p-2 rounded bg-muted">{correlationId}</code>
            </div>
          )}

          {n8nStackTrace && n8nStackTrace.length > 0 && (
            <div>
              <p className="font-medium text-muted-foreground">n8n Stack Trace:</p>
              <pre className="mt-1 p-2 rounded bg-muted overflow-x-auto whitespace-pre-wrap text-[10px]">
                {n8nStackTrace.join('\n')}
              </pre>
            </div>
          )}

          {rawResponse && (
            <div>
              <p className="font-medium text-muted-foreground">Raw Response:</p>
              <pre className="mt-1 p-2 rounded bg-muted overflow-x-auto whitespace-pre-wrap text-[10px] max-h-32">
                {rawResponse}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
