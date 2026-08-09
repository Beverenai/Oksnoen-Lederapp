import { useEffect, useMemo, useState } from 'react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Loader2, Save, Trash2, X, Search, Check } from 'lucide-react';
import { useParticipants } from '@/hooks/useParticipants';
import { useAuth } from '@/contexts/AuthContext';
import { useStatusPopup } from '@/hooks/useStatusPopup';
import {
  CATEGORY_LABELS,
  SEVERITY_LABELS,
  useParticipantIncidents,
  type Incident,
  type IncidentCategory,
  type IncidentSeverity,
} from '@/hooks/useParticipantIncidents';
import { cn } from '@/lib/utils';
import { getParticipantThumb } from '@/lib/participantImage';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface IncidentSheetProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  incident?: Incident | null;
  prefillParticipantId?: string | null;
}

export function IncidentSheet({ open, onOpenChange, incident, prefillParticipantId }: IncidentSheetProps) {
  const { effectiveLeader } = useAuth();
  const { showSuccess, showError } = useStatusPopup();
  const { createIncident, updateIncident, deleteIncident } = useParticipantIncidents();
  const { data: participants = [] } = useParticipants();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<IncidentCategory>('annet');
  const [severity, setSeverity] = useState<IncidentSeverity>('low');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!open) return;
    if (incident) {
      setTitle(incident.title);
      setDescription(incident.description ?? '');
      setCategory(incident.category);
      setSeverity(incident.severity);
      setSelectedIds(new Set(incident.participants.map((p) => p.id)));
    } else {
      setTitle('');
      setDescription('');
      setCategory('annet');
      setSeverity('low');
      setSelectedIds(prefillParticipantId ? new Set([prefillParticipantId]) : new Set());
    }
    setSearch('');
  }, [open, incident, prefillParticipantId]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return participants.slice(0, 30);
    return participants
      .filter((p) => p.name.toLowerCase().includes(q))
      .slice(0, 50);
  }, [participants, search]);

  const selectedList = useMemo(
    () => participants.filter((p) => selectedIds.has(p.id)),
    [participants, selectedIds]
  );

  const toggle = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const canSave = title.trim().length > 0 && !!effectiveLeader;

  const save = async () => {
    if (!canSave || !effectiveLeader) return;
    try {
      if (incident) {
        await updateIncident.mutateAsync({
          id: incident.id,
          title: title.trim(),
          description: description.trim(),
          category,
          severity,
          participantIds: Array.from(selectedIds),
        });
      } else {
        await createIncident.mutateAsync({
          title: title.trim(),
          description: description.trim(),
          category,
          severity,
          leaderId: effectiveLeader.id,
          participantIds: Array.from(selectedIds),
        });
      }
      showSuccess(incident ? 'Hendelse oppdatert' : 'Hendelse lagret');
      onOpenChange(false);
    } catch (e: any) {
      showError('Kunne ikke lagre', e?.message);
    }
  };

  const remove = async () => {
    if (!incident) return;
    if (!confirm('Slette denne hendelsen?')) return;
    try {
      await deleteIncident.mutateAsync(incident.id);
      showSuccess('Slettet');
      onOpenChange(false);
    } catch (e: any) {
      showError('Kunne ikke slette', e?.message);
    }
  };

  const isSaving = createIncident.isPending || updateIncident.isPending;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md w-full flex flex-col p-0 gap-0 h-[100dvh]">
        <SheetHeader className="px-6 pt-6 pb-3 shrink-0">
          <SheetTitle>{incident ? 'Rediger hendelse' : 'Ny hendelse'}</SheetTitle>
          <SheetDescription>
            Logg en hendelse knyttet til én eller flere deltagere. Kun du og admin ser den.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-6 pb-6 space-y-5">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Tittel</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="F.eks. Konflikt ved lunsj"
              className="mt-1.5"
            />
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Beskrivelse</label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Hva skjedde?"
              rows={4}
              className="mt-1.5"
            />
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Kategori</label>
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {(Object.keys(CATEGORY_LABELS) as IncidentCategory[]).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCategory(c)}
                  className={cn(
                    'px-3 py-1.5 rounded-full text-xs font-medium border transition',
                    category === c
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background border-border hover:bg-muted'
                  )}
                >
                  {CATEGORY_LABELS[c]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Alvorlighet</label>
            <div className="flex gap-1.5 mt-1.5">
              {(Object.keys(SEVERITY_LABELS) as IncidentSeverity[]).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSeverity(s)}
                  className={cn(
                    'flex-1 py-2 rounded-lg text-sm font-medium border transition',
                    severity === s
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background border-border hover:bg-muted'
                  )}
                >
                  {SEVERITY_LABELS[s]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Deltagere ({selectedIds.size})
            </label>
            {selectedList.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {selectedList.map((p) => (
                  <Badge key={p.id} variant="secondary" className="gap-1 pr-1">
                    <Avatar className="h-5 w-5 -ml-1 mr-1">
                      <AvatarImage src={getParticipantThumb(p as any)} alt="" />
                      <AvatarFallback className="text-[9px]">{p.name.charAt(0)}</AvatarFallback>
                    </Avatar>
                    {p.name}
                    <button
                      type="button"
                      onClick={() => toggle(p.id)}
                      className="ml-1 rounded-full hover:bg-background/60 p-0.5"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
            <div className="relative mt-2">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Søk deltager…"
                className="pl-8"
              />
            </div>
            <div className="mt-2 max-h-52 overflow-y-auto rounded-lg border divide-y">
              {filtered.map((p) => {
                const selected = selectedIds.has(p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => toggle(p.id)}
                    className={cn(
                      'w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted transition',
                      selected && 'bg-primary/5'
                    )}
                  >
                    <Avatar className="h-8 w-8 shrink-0">
                      <AvatarImage src={getParticipantThumb(p as any)} alt="" loading="lazy" decoding="async" />
                      <AvatarFallback className="text-xs">{p.name.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <span className="flex-1 truncate">{p.name}</span>
                    {selected && <Check className="h-4 w-4 text-primary shrink-0" />}
                  </button>
                );
              })}
              {filtered.length === 0 && (
                <div className="px-3 py-4 text-sm text-muted-foreground text-center">Ingen treff</div>
              )}
            </div>
          </div>

        </div>

        <div
          className="shrink-0 border-t bg-background px-6 py-3"
          style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}
        >
          <div className="flex gap-2">
            <Button onClick={save} disabled={!canSave || isSaving} className="flex-1">
              {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Lagre
            </Button>
            {incident && (
              <Button variant="destructive" size="icon" onClick={remove} disabled={deleteIncident.isPending}>
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}