import { useMemo, useState } from 'react';
import { Check, Plus, Search, X } from 'lucide-react';
import { useActivities } from '@/hooks/useActivities';
import { hapticImpact } from '@/lib/capacitorHaptics';
import { activityColor, activitySymbol } from '@/lib/activityStyle';
import { cn } from '@/lib/utils';

const RECENT_KEY = 'oksnoen_qr_recent_activities';

export function readRecentActivities(): string[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed.slice(0, 4) : [];
  } catch {
    return [];
  }
}

function saveRecent(name: string) {
  try {
    const next = [name, ...readRecentActivities().filter((n) => n.toLowerCase() !== name.toLowerCase())].slice(0, 4);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    /* ikke kritisk */
  }
}

interface Props {
  open: boolean;
  current: string;
  /** Antall deltakere som venter på at en aktivitet velges. */
  pendingCount?: number;
  onPick: (activity: string) => void;
  onClose: () => void;
}

function Tile({ title, selected, onClick }: { title: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'relative flex aspect-[5/4] flex-col items-center justify-center gap-2 rounded-3xl p-3 text-center transition-transform active:scale-95',
        activityColor(title),
        selected && 'ring-[3px] ring-primary',
      )}
    >
      <span className="text-4xl leading-none" aria-hidden>
        {activitySymbol(title)}
      </span>
      <span className="line-clamp-2 text-sm font-semibold leading-tight text-foreground">{title}</span>
      {selected && (
        <span className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <Check className="h-4 w-4" />
        </span>
      )}
    </button>
  );
}

/** Velger for aktivitet: store fliser, sist brukte øverst, søk og egendefinert. */
export function ActivityPicker({ open, current, pendingCount = 0, onPick, onClose }: Props) {
  const { activities } = useActivities(true);
  const [search, setSearch] = useState('');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const recent = useMemo(() => readRecentActivities(), [open]);

  const q = search.trim().toLowerCase();
  const all = useMemo(
    () => activities.map((a) => a.title).filter((t) => !q || t.toLowerCase().includes(q)),
    [activities, q],
  );
  const known = new Set(activities.map((a) => a.title.toLowerCase()));
  const recentShown = q ? [] : recent;
  const rest = all.filter((t) => !recentShown.some((r) => r.toLowerCase() === t.toLowerCase()));
  const canCreate = q.length > 1 && !known.has(q);

  const pick = (title: string) => {
    const clean = title.trim().slice(0, 60);
    if (!clean) return;
    hapticImpact('medium');
    saveRecent(clean);
    setSearch('');
    onPick(clean);
  };

  if (!open) return null;

  return (
    <div className="absolute inset-0 z-20 flex flex-col justify-end">
      <button type="button" aria-label="Lukk" className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative flex max-h-[88%] flex-col rounded-t-[2rem] bg-background pb-[env(safe-area-inset-bottom,0px)] shadow-2xl animate-in slide-in-from-bottom duration-200">
        <div className="mx-auto mt-2.5 h-1.5 w-10 rounded-full bg-muted-foreground/30" />
        <div className="flex items-start justify-between gap-3 px-5 pb-3 pt-4">
          <div>
            <h2 className="text-2xl font-heading font-bold text-foreground">Velg aktivitet</h2>
            {pendingCount > 0 && (
              <p className="text-sm text-muted-foreground">
                {pendingCount} skannet {pendingCount === 1 ? 'deltaker' : 'deltakere'} legges til
              </p>
            )}
          </div>
          <button type="button" onClick={onClose} aria-label="Lukk" className="rounded-full bg-muted p-2">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="relative mx-5 mb-3">
          <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
          <input
            id="qr-activity-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Søk, eller skriv en ny"
            className="h-12 w-full rounded-2xl bg-muted/60 pl-12 pr-4 text-base outline-none placeholder:text-muted-foreground"
          />
        </div>

        <div className="space-y-4 overflow-y-auto overscroll-contain px-5 pb-6">
          {canCreate && (
            <button
              type="button"
              onClick={() => pick(search)}
              className="flex w-full items-center gap-3 rounded-2xl bg-primary px-4 py-3.5 text-left text-primary-foreground active:scale-[0.99]"
            >
              <Plus className="h-5 w-5 shrink-0" />
              <span className="min-w-0 truncate font-semibold">Bruk «{search.trim()}»</span>
            </button>
          )}

          {recentShown.length > 0 && (
            <section className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Sist brukt</h3>
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                {recentShown.map((t) => (
                  <Tile key={t} title={t} selected={t.toLowerCase() === current.toLowerCase()} onClick={() => pick(t)} />
                ))}
              </div>
            </section>
          )}

          {rest.length > 0 && (
            <section className="space-y-2">
              {recentShown.length > 0 && (
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Alle</h3>
              )}
              <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4">
                {rest.map((t) => (
                  <Tile key={t} title={t} selected={t.toLowerCase() === current.toLowerCase()} onClick={() => pick(t)} />
                ))}
              </div>
            </section>
          )}

          {rest.length === 0 && recentShown.length === 0 && !canCreate && (
            <p className="py-8 text-center text-sm text-muted-foreground">Ingen aktiviteter funnet</p>
          )}
        </div>
      </div>
    </div>
  );
}
