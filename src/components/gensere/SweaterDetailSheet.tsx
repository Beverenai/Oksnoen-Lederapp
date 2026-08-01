import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useStatusPopup } from '@/hooks/useStatusPopup';
import { useAuth } from '@/contexts/AuthContext';
import { useActivePeriodId } from '@/hooks/useActivePeriodId';
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from '@/components/ui/responsive-dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loader2, User, Home, CheckCircle2, ShoppingBag, Package } from 'lucide-react';
import { cn } from '@/lib/utils';

export type SizeOption = 'XXS' | 'XS' | 'S' | 'M' | 'L' | 'XL' | 'XXL';
const SIZES: SizeOption[] = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL'];

function normalizeSize(v: string | null | undefined): SizeOption | null {
  if (!v) return null;
  const u = v.trim().toUpperCase();
  return (SIZES as string[]).includes(u) ? (u as SizeOption) : null;
}

interface Props {
  participantId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

interface ParticipantRow {
  id: string;
  name: string;
  image_url: string | null;
  cabins?: { name: string } | null;
}

interface SweaterRow {
  id?: string;
  preordered_size: string | null;
  picked_up: boolean;
  picked_up_size: string | null;
  bought_on_camp: boolean;
  bought_size: string | null;
}

export function SweaterDetailSheet({ participantId, open, onOpenChange, onSaved }: Props) {
  const { showSuccess, showError } = useStatusPopup();
  const { data: periodId } = useActivePeriodId();
  const [participant, setParticipant] = useState<ParticipantRow | null>(null);
  const [row, setRow] = useState<SweaterRow | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !participantId || !periodId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [pRes, sRes] = await Promise.all([
          supabase.from('participants').select('id, name, image_url, cabins(name)').eq('id', participantId).maybeSingle(),
          supabase.from('participant_sweaters').select('*').eq('participant_id', participantId).eq('period_id', periodId).maybeSingle(),
        ]);
        if (cancelled) return;
        setParticipant((pRes.data || null) as any);
        setRow(
          sRes.data
            ? {
                id: sRes.data.id,
                preordered_size: sRes.data.preordered_size,
                picked_up: !!sRes.data.picked_up,
                picked_up_size: sRes.data.picked_up_size,
                bought_on_camp: !!sRes.data.bought_on_camp,
                bought_size: sRes.data.bought_size,
              }
            : {
                preordered_size: null,
                picked_up: false,
                picked_up_size: null,
                bought_on_camp: false,
                bought_size: null,
              },
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, participantId, periodId]);

  const persist = async (next: SweaterRow) => {
    if (!participantId || !periodId) return;
    setSaving(true);
    try {
      const payload: any = {
        participant_id: participantId,
        period_id: periodId,
        preordered_size: next.preordered_size,
        picked_up: next.picked_up,
        picked_up_size: next.picked_up_size,
        picked_up_at: next.picked_up ? new Date().toISOString() : null,
        bought_on_camp: next.bought_on_camp,
        bought_size: next.bought_size,
        bought_at: next.bought_on_camp ? new Date().toISOString() : null,
      };
      const { error } = await supabase
        .from('participant_sweaters')
        .upsert(payload, { onConflict: 'participant_id,period_id' });
      if (error) throw error;
      onSaved();
    } catch (e: any) {
      console.error(e);
      showError('Kunne ikke lagre', e?.message);
    } finally {
      setSaving(false);
    }
  };

  const togglePickedUp = async () => {
    if (!row) return;
    const nextPicked = !row.picked_up;
    const next: SweaterRow = {
      ...row,
      picked_up: nextPicked,
      picked_up_size: nextPicked ? (row.picked_up_size || normalizeSize(row.preordered_size) || null) : null,
    };
    setRow(next);
    await persist(next);
    if (nextPicked) showSuccess('Genser hentet');
  };

  const setPickedUpSize = async (size: SizeOption) => {
    if (!row) return;
    const next: SweaterRow = { ...row, picked_up: true, picked_up_size: size };
    setRow(next);
    await persist(next);
  };

  const toggleBought = async () => {
    if (!row) return;
    const nextBought = !row.bought_on_camp;
    const next: SweaterRow = {
      ...row,
      bought_on_camp: nextBought,
      bought_size: nextBought ? row.bought_size : null,
    };
    setRow(next);
    await persist(next);
    if (nextBought) showSuccess('Genser kjøpt på leir');
  };

  const setBoughtSize = async (size: SizeOption) => {
    if (!row) return;
    const next: SweaterRow = { ...row, bought_on_camp: true, bought_size: size };
    setRow(next);
    await persist(next);
  };

  const setPreorderedSize = async (size: SizeOption | null) => {
    if (!row) return;
    const next: SweaterRow = { ...row, preordered_size: size };
    setRow(next);
    await persist(next);
  };

  const preNorm = normalizeSize(row?.preordered_size);

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent className="max-w-md">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>Genser</ResponsiveDialogTitle>
        </ResponsiveDialogHeader>

        {loading || !participant || !row ? (
          <div className="py-10 flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-5">
            {/* Participant header */}
            <div className="flex items-center gap-3">
              <Avatar className="w-12 h-12">
                <AvatarImage src={participant.image_url || undefined} />
                <AvatarFallback><User className="w-4 h-4" /></AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{participant.name}</p>
                {participant.cabins?.name && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Home className="w-3 h-3" /> {participant.cabins.name}
                  </p>
                )}
              </div>
              {row.preordered_size ? (
                <Badge variant="outline" className="uppercase">
                  Forhåndsbest.: {row.preordered_size}
                </Badge>
              ) : (
                <Badge variant="secondary">Ikke bestilt</Badge>
              )}
            </div>

            {/* Forhåndsbestilt størrelse */}
            <div className="rounded-xl border p-4 space-y-3 bg-card">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-sm">Forhåndsbestilt størrelse</span>
                {row.preordered_size && (
                  <Button size="sm" variant="ghost" onClick={() => setPreorderedSize(null)} disabled={saving} className="h-7 text-xs">
                    Fjern
                  </Button>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {SIZES.map((s) => {
                  const active = (row.preordered_size || '').toUpperCase() === s;
                  return (
                    <Button
                      key={s}
                      size="sm"
                      variant={active ? 'default' : 'outline'}
                      onClick={() => setPreorderedSize(s)}
                      disabled={saving}
                      className="h-8 px-3"
                    >
                      {s}
                    </Button>
                  );
                })}
              </div>
            </div>

            {/* Hentet */}
            <div className={cn(
              "rounded-xl border p-4 space-y-3 transition-colors",
              row.picked_up ? "bg-success/5 border-success/40" : "bg-card"
            )}>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Package className="w-4 h-4 text-muted-foreground" />
                  <span className="font-medium">Hentet forhåndsbestilt</span>
                </div>
                <Button
                  size="sm"
                  variant={row.picked_up ? 'default' : 'outline'}
                  onClick={togglePickedUp}
                  disabled={saving}
                >
                  {row.picked_up ? (
                    <><CheckCircle2 className="w-4 h-4 mr-1" /> Hentet</>
                  ) : (
                    'Marker hentet'
                  )}
                </Button>
              </div>
              {row.picked_up && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1.5">Størrelse utlevert</p>
                  <div className="flex flex-wrap gap-1.5">
                    {SIZES.map((s) => {
                      const active = (row.picked_up_size || '').toUpperCase() === s;
                      const isPre = preNorm === s;
                      return (
                        <Button
                          key={s}
                          size="sm"
                          variant={active ? 'default' : 'outline'}
                          onClick={() => setPickedUpSize(s)}
                          disabled={saving}
                          className={cn("h-8 px-3", isPre && !active && "ring-1 ring-primary/40")}
                        >
                          {s}
                        </Button>
                      );
                    })}
                  </div>
                  {preNorm && (
                    <p className="text-[11px] text-muted-foreground mt-1.5">
                      Ring rundt forhåndsbestilt størrelse ({preNorm})
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Kjøpt på leir */}
            <div className={cn(
              "rounded-xl border p-4 space-y-3 transition-colors",
              row.bought_on_camp ? "bg-primary/5 border-primary/40" : "bg-card"
            )}>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <ShoppingBag className="w-4 h-4 text-muted-foreground" />
                  <span className="font-medium">Kjøpt på leir</span>
                </div>
                <Button
                  size="sm"
                  variant={row.bought_on_camp ? 'default' : 'outline'}
                  onClick={toggleBought}
                  disabled={saving}
                >
                  {row.bought_on_camp ? (
                    <><CheckCircle2 className="w-4 h-4 mr-1" /> Kjøpt</>
                  ) : (
                    'Marker kjøpt'
                  )}
                </Button>
              </div>
              {row.bought_on_camp && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1.5">Størrelse</p>
                  <div className="flex flex-wrap gap-1.5">
                    {SIZES.map((s) => {
                      const active = (row.bought_size || '').toUpperCase() === s;
                      return (
                        <Button
                          key={s}
                          size="sm"
                          variant={active ? 'default' : 'outline'}
                          onClick={() => setBoughtSize(s)}
                          disabled={saving}
                          className="h-8 px-3"
                        >
                          {s}
                        </Button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}