import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useStatusPopup } from '@/hooks/useStatusPopup';
import {
  useParticipantIncidents,
  CATEGORY_LABELS,
  CATEGORY_COLORS,
  SEVERITY_LABELS,
  SEVERITY_COLORS,
  type Incident,
} from '@/hooks/useParticipantIncidents';
import { getOrCreateActiveNurseReportId } from '@/lib/nurseReport';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Bell, Check, Loader2, Undo2, X, Inbox } from 'lucide-react';
import { format } from 'date-fns';
import { nb } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { hapticSuccess } from '@/lib/capacitorHaptics';

type ReviewStatus = 'pending' | 'approved' | 'dismissed';

interface Review {
  id: string;
  incident_id: string;
  status: ReviewStatus;
  mention_ids: string[];
  reviewed_at: string | null;
}

function incidentText(i: Incident, nurseComment?: string, nurseName?: string) {
  const parts = [`[Hendelse] ${i.title}`];
  if (i.description) parts.push(i.description);
  parts.push(`Meldt av: ${i.leader?.name ?? 'ukjent leder'}`);
  parts.push(`${CATEGORY_LABELS[i.category]} · ${SEVERITY_LABELS[i.severity]}`);
  if (nurseComment?.trim()) {
    parts.push(`Kommentar (${nurseName || 'nurse'}): ${nurseComment.trim()}`);
  }
  return parts.join('\n');
}

interface Props {
  onDataChange?: () => void;
}

export function IncidentInboxTab({ onDataChange }: Props) {
  const { leader } = useAuth();
  const { showSuccess, showError } = useStatusPopup();
  const qc = useQueryClient();
  const { data: incidents = [], isLoading } = useParticipantIncidents({ adminAll: true });
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showHandled, setShowHandled] = useState(false);
  const [openCommentFor, setOpenCommentFor] = useState<string | null>(null);
  const [commentText, setCommentText] = useState('');

  const { data: reviews = [], refetch: refetchReviews } = useQuery({
    queryKey: ['nurse-incident-reviews'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('nurse_incident_reviews')
        .select('id, incident_id, status, mention_ids, reviewed_at');
      if (error) throw error;
      return (data || []) as Review[];
    },
    staleTime: 15_000,
  });

  const reviewMap = useMemo(() => {
    const m = new Map<string, Review>();
    reviews.forEach((r) => m.set(r.incident_id, r));
    return m;
  }, [reviews]);

  const pending = incidents.filter((i) => !reviewMap.get(i.id));
  const handled = incidents.filter((i) => !!reviewMap.get(i.id));

  const approve = async (incident: Incident, comment?: string) => {
    setBusyId(incident.id);
    try {
      const rid = await getOrCreateActiveNurseReportId(leader?.id);
      if (!rid) throw new Error('Ingen aktiv rapport');
      const text = incidentText(incident, comment, leader?.name);
      const targets = incident.participants.length > 0 ? incident.participants : [];
      let mentionIds: string[] = [];
      if (targets.length > 0) {
        const { data, error } = await supabase
          .from('nurse_report_mentions')
          .insert(
            targets.map((p) => ({
              report_id: rid,
              participant_id: p.id,
              mention_text: text,
            }))
          )
          .select('id');
        if (error) throw error;
        mentionIds = (data || []).map((r: any) => r.id);
      }
      const { error: revErr } = await (supabase as any)
        .from('nurse_incident_reviews')
        .upsert(
          {
            incident_id: incident.id,
            status: 'approved',
            reviewed_by: leader?.id ?? null,
            reviewed_at: new Date().toISOString(),
            mention_ids: mentionIds,
          },
          { onConflict: 'incident_id' }
        );
      if (revErr) throw revErr;
      hapticSuccess();
      showSuccess(
        targets.length > 0 ? 'Lagt inn i rapporten' : 'Godkjent (ingen deltakere knyttet til hendelsen)'
      );
      await refetchReviews();
      qc.invalidateQueries({ queryKey: ['nurse-report'] });
      onDataChange?.();
      setOpenCommentFor(null);
      setCommentText('');
    } catch (e) {
      console.error(e);
      showError('Kunne ikke legge inn i rapporten');
    } finally {
      setBusyId(null);
    }
  };

  const dismiss = async (incident: Incident) => {
    setBusyId(incident.id);
    try {
      const { error } = await (supabase as any)
        .from('nurse_incident_reviews')
        .upsert(
          {
            incident_id: incident.id,
            status: 'dismissed',
            reviewed_by: leader?.id ?? null,
            reviewed_at: new Date().toISOString(),
            mention_ids: [],
          },
          { onConflict: 'incident_id' }
        );
      if (error) throw error;
      showSuccess('Hendelsen ble ikke lagt i rapporten');
      await refetchReviews();
    } catch (e) {
      console.error(e);
      showError('Kunne ikke lagre valget');
    } finally {
      setBusyId(null);
    }
  };

  const undo = async (incident: Incident) => {
    const review = reviewMap.get(incident.id);
    if (!review) return;
    setBusyId(incident.id);
    try {
      if (review.mention_ids?.length) {
        await supabase.from('nurse_report_mentions').delete().in('id', review.mention_ids);
      }
      const { error } = await (supabase as any)
        .from('nurse_incident_reviews')
        .delete()
        .eq('id', review.id);
      if (error) throw error;
      showSuccess('Tilbakestilt til ubehandlet');
      await refetchReviews();
      onDataChange?.();
    } catch (e) {
      console.error(e);
      showError('Kunne ikke angre');
    } finally {
      setBusyId(null);
    }
  };

  const renderCard = (i: Incident) => {
    const review = reviewMap.get(i.id);
    const busy = busyId === i.id;
    return (
      <Card
        key={i.id}
        className={cn(
          'overflow-hidden',
          !review && 'border-primary/40 bg-primary/[0.03]',
          review?.status === 'approved' && 'border-emerald-500/30',
          review?.status === 'dismissed' && 'opacity-70'
        )}
      >
        <CardContent className="py-3 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <p className="font-medium text-sm">{i.title}</p>
            <span className="text-[10px] text-muted-foreground shrink-0">
              {format(new Date(i.created_at), 'd. MMM HH:mm', { locale: nb })}
            </span>
          </div>

          <div className="flex flex-wrap gap-1">
            <Badge variant="outline" className={cn('text-[10px]', CATEGORY_COLORS[i.category])}>
              {CATEGORY_LABELS[i.category]}
            </Badge>
            <Badge variant="outline" className={cn('text-[10px]', SEVERITY_COLORS[i.severity])}>
              {SEVERITY_LABELS[i.severity]}
            </Badge>
            {i.participants.map((p) => (
              <Badge key={p.id} variant="secondary" className="text-[10px]">
                {p.name}
              </Badge>
            ))}
          </div>

          {i.description && (
            <p className="text-xs text-muted-foreground whitespace-pre-wrap">{i.description}</p>
          )}
          <p className="text-[10px] text-muted-foreground">
            Meldt av <span className="font-medium">{i.leader?.name ?? 'Ukjent'}</span>
          </p>

          {!review ? (
            <div className="flex gap-2 pt-1">
              <Button size="sm" className="flex-1" disabled={busy} onClick={() => approve(i)}>
                {busy ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Check className="w-4 h-4 mr-1" />}
                Godkjenn til rapport
              </Button>
              <Button size="sm" variant="outline" disabled={busy} onClick={() => dismiss(i)}>
                <X className="w-4 h-4 mr-1" />
                Ikke relevant
              </Button>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-2 pt-1">
              <span
                className={cn(
                  'text-[11px] font-medium',
                  review.status === 'approved' ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'
                )}
              >
                {review.status === 'approved' ? '✓ Lagt i rapporten' : 'Ikke lagt i rapporten'}
                {review.reviewed_at ? ` · ${format(new Date(review.reviewed_at), 'd. MMM HH:mm', { locale: nb })}` : ''}
              </span>
              <Button size="sm" variant="ghost" disabled={busy} onClick={() => undo(i)}>
                {busy ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Undo2 className="w-4 h-4 mr-1" />}
                Angre
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-heading font-semibold flex items-center gap-2">
          <Bell className="w-5 h-5" />
          Hendelser fra ledere
          {pending.length > 0 && (
            <Badge className="ml-1">{pending.length} nye</Badge>
          )}
        </h2>
        <Button variant="ghost" size="sm" onClick={() => setShowHandled((v) => !v)}>
          {showHandled ? 'Skjul behandlede' : `Vis behandlede (${handled.length})`}
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Laster…</p>
      ) : pending.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            <Inbox className="w-8 h-8 mx-auto mb-2 opacity-40" />
            Ingen nye hendelser å behandle
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">{pending.map(renderCard)}</div>
      )}

      {showHandled && handled.length > 0 && (
        <div className="space-y-2 pt-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Behandlede
          </p>
          {handled.map(renderCard)}
        </div>
      )}
    </div>
  );
}
