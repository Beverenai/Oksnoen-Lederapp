import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { useSeedLeirskoleSpecialDays } from '@/hooks/useSeedLeirskoleSpecialDays';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Grid3X3, Plus, X, PlaneTakeoff, PlaneLanding, Trash2, Clock } from 'lucide-react';
import {
  useLeirskoleActivityTypes,
  useLeirskoleWeekPlan,
  useSaveLeirskoleWeekPlanCell,
  useLeirskoleWeekDays,
  useSetLeirskoleDayType,
  useLeirskoleSchedule,
  useAddLeirskolePost,
  useDeleteLeirskolePost,
  useLeirskoleWeeks,
  type LeirskoleWeek,
} from '@/hooks/useLeirskole';

const WEEKDAYS = ['Søn', 'Man', 'Tir', 'Ons', 'Tor', 'Fre', 'Lør'];
const ROWS = [
  { index: 1, label: '1. økt' },
  { index: 2, label: '2. økt' },
  { index: 3, label: '3. økt' },
];

const COLORS: { key: string; label: string; cell: string; dot: string }[] = [
  { key: 'neutral', label: 'Nøytral', cell: 'bg-muted/40 border-border', dot: 'bg-muted-foreground/40' },
  { key: 'red', label: 'Rød', cell: 'bg-destructive/15 border-destructive/50', dot: 'bg-destructive' },
  { key: 'orange', label: 'Oransje', cell: 'bg-amber-500/15 border-amber-500/50', dot: 'bg-amber-500' },
  { key: 'green', label: 'Grønn', cell: 'bg-emerald-500/15 border-emerald-500/50', dot: 'bg-emerald-500' },
];

function parse(d: string) {
  const [y, m, day] = d.split('-').map(Number);
  return new Date(y, m - 1, day);
}
function datesBetween(start: string, end: string) {
  const out: string[] = [];
  const a = parse(start);
  const b = parse(end);
  for (const d = new Date(a); d <= b; d.setDate(d.getDate() + 1)) {
    out.push(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
    );
  }
  return out;
}
const cellKey = (date: string, row: number) => `${date}|${row}`;
const postKey = (postId: string) => `post|${postId}`;
const splitLines = (content: string) =>
  content
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

/**
 * Ukeplanleggeren: rutenett med dagene som kolonner og økt 1–3 som rader.
 * Innholdet velges fra aktivitetslista (ingen manuell skriving) + farge per rute.
 */
export function LeirskoleWeekPlanCard({ week, readOnly = false }: { week: LeirskoleWeek; readOnly?: boolean }) {
  const { data: cells } = useLeirskoleWeekPlan(week.id);
  const { data: activityTypes } = useLeirskoleActivityTypes(true);
  const { data: weekDays } = useLeirskoleWeekDays(week.id);
  const { data: posts } = useLeirskoleSchedule(week.id);
  const { data: allWeeks } = useLeirskoleWeeks();
  const save = useSaveLeirskoleWeekPlanCell();
  const setDayType = useSetLeirskoleDayType();
  const addPost = useAddLeirskolePost();
  const deletePost = useDeleteLeirskolePost();
  const [newPostDate, setNewPostDate] = useState<string | null>(null);
  const [freeText, setFreeText] = useState<Record<string, string>>({});
  const [form, setForm] = useState({ name: '', start: '09:00', end: '10:00' });
  const dates = useMemo(() => datesBetween(week.start_date, week.end_date), [week.start_date, week.end_date]);

  const stored = useMemo(() => {
    const map = new Map<string, { content: string; color: string }>();
    (cells ?? []).forEach((c) => {
      const key = c.post_id ? postKey(c.post_id) : c.row_index != null ? cellKey(c.date, c.row_index) : null;
      if (key) map.set(key, { content: c.content, color: c.color });
    });
    return map;
  }, [cells]);

  /** Ankomst-, avreise- og kombinerte dager har egne økter i stedet for økt 1–3. */
  const specialDays = useMemo(() => {
    const map = new Map<string, 'arrival' | 'departure' | 'both'>();
    (weekDays ?? []).forEach((d) => {
      if (d.day_type === 'departure' || d.day_type === 'arrival' || d.day_type === 'both') {
        map.set(d.date, d.day_type as 'arrival' | 'departure' | 'both');
      }
    });
    return map;
  }, [weekDays]);

  /**
   * Første dag er ankomstdag — men i alle uker som har en tidligere uke før seg,
   * reiser forrige gruppe hjem samme dag, så dagen blir «avreise + ankomst».
   */
  const first = dates[0];
  const last = dates[dates.length - 1];
  const { firstDayType } = useSeedLeirskoleSpecialDays(week, !readOnly);

  const postsByDate = useMemo(() => {
    const map = new Map<string, { id: string; name: string; start_time: string; end_time: string }[]>();
    (posts ?? [])
      .filter((p) => (p as { is_custom?: boolean }).is_custom)
      .forEach((p) => {
        const list = map.get(p.date) ?? [];
        list.push({ id: p.id, name: p.name, start_time: p.start_time, end_time: p.end_time });
        map.set(p.date, list);
      });
    map.forEach((list) => list.sort((a, b) => a.start_time.localeCompare(b.start_time)));
    return map;
  }, [posts]);

  /** Radene for en dag: faste økter 1–3, eller dagens egne økter på avreisedager. */
  const rowsFor = (date: string): { key: string; label: string; sub?: string; postId?: string }[] => {
    if (specialDays.has(date)) {
      return (postsByDate.get(date) ?? []).map((p) => ({
        key: postKey(p.id),
        label: p.name,
        sub: `${p.start_time.slice(0, 5)}–${p.end_time.slice(0, 5)}`,
        postId: p.id,
      }));
    }
    return ROWS.map((r) => ({ key: cellKey(date, r.index), label: r.label }));
  };

  const totalCells = useMemo(
    () => dates.reduce((sum, date) => sum + rowsFor(date).length, 0),
    [dates, specialDays, postsByDate],
  );
  const filledCount = useMemo(
    () =>
      dates.reduce(
        (sum, date) =>
          sum + rowsFor(date).filter((r) => (stored.get(r.key)?.content ?? '').trim().length > 0).length,
        0,
      ),
    [dates, stored, specialDays, postsByDate],
  );

  const persist = (
    date: string,
    row: number | null,
    content: string,
    color: string,
    postId?: string,
  ) => {
    save.mutate(
      { weekId: week.id, date, rowIndex: row, content, color, postId },
      { onError: () => toast.error('Kunne ikke lagre ruten') },
    );
  };

  const LABELS: Record<'arrival' | 'departure' | 'both', string> = {
    arrival: 'Ankomstdag',
    departure: 'Avreisedag',
    both: 'Avreise + ankomst',
  };

  const toggleDayType = (date: string, type: 'arrival' | 'departure') => {
    if (date === first || date === last) {
      toast.info(
        date === first
          ? firstDayType === 'both'
            ? 'Første dag er alltid avreise + ankomst'
            : 'Første dag er alltid ankomstdag'
          : 'Siste dag er alltid avreisedag',
      );
      return;
    }
    const next = specialDays.get(date) === type ? 'normal' : type;
    setDayType.mutate(
      { weekId: week.id, date, dayType: next },
      {
        onSuccess: () =>
          toast.success(next === 'normal' ? 'Satt til vanlig dag' : `Markert som ${LABELS[type].toLowerCase()}`),
        onError: () => toast.error('Kunne ikke endre dagen'),
      },
    );
  };

  const submitPost = () => {
    if (!newPostDate || !form.name.trim()) return;
    addPost.mutate(
      {
        weekId: week.id,
        date: newPostDate,
        name: form.name.trim(),
        postType: 'other',
        startTime: form.start,
        endTime: form.end,
        requiredLeaders: 1,
      },
      {
        onSuccess: () => {
          toast.success('Økt lagt til');
          setNewPostDate(null);
          setForm({ name: '', start: '09:00', end: '10:00' });
        },
        onError: () => toast.error('Kunne ikke legge til økten'),
      },
    );
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Grid3X3 className="h-4 w-4 text-primary" /> Ukeplanlegger
        </CardTitle>
        <CardDescription>
          Velg aktiviteter fra lista i hver rute (økt 1–3). Trykk på fargeprikkene for å markere ruten. Marker
          ankomst- eller avreisedager med fly-ikonene — der lager du egne økter med navn og tid. Lagres
          automatisk.
        </CardDescription>
        <p className="mt-1 text-xs font-semibold text-primary">
          {filledCount} av {totalCells} ruter fylt ut · {dates.length} dager
        </p>
      </CardHeader>
      <CardContent>
        <div className="-mx-2 overflow-x-auto px-2 pb-2">
          <div className="flex min-w-max gap-2">
            {dates.map((date) => {
              const d = parse(date);
              const special = specialDays.get(date);
              const isSpecial = !!special;
              const dayRows = rowsFor(date);
              return (
                <div key={date} className="w-44 shrink-0">
                  <div
                    className={`mb-2 rounded-xl px-2 py-1.5 ${
                      isSpecial
                        ? 'border border-dashed border-amber-500/70 bg-amber-500/15'
                        : 'oks-ls-gradient'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <p
                        className={`text-xs font-bold ${
                          isSpecial ? 'text-amber-700 dark:text-amber-200' : 'text-white'
                        }`}
                      >
                        {WEEKDAYS[d.getDay()]} {d.getDate()}.
                      </p>
                      {!readOnly && (
                        <div className="flex items-center gap-1">
                          {([
                            { type: 'arrival' as const, Icon: PlaneLanding },
                            { type: 'departure' as const, Icon: PlaneTakeoff },
                          ]).map(({ type, Icon }) => {
                            const active = special === type || special === 'both';
                            return (
                              <button
                                key={type}
                                type="button"
                                aria-label={active ? 'Gjør til vanlig dag' : `Marker som ${LABELS[type].toLowerCase()}`}
                                title={active ? 'Gjør til vanlig dag' : LABELS[type]}
                                onClick={() => toggleDayType(date, type)}
                                className={`rounded-md p-1 ${
                                  active
                                    ? 'bg-amber-500/30 text-amber-700 dark:text-amber-100'
                                    : isSpecial
                                      ? 'bg-amber-500/10 text-amber-700/70 dark:text-amber-100/70 hover:bg-amber-500/20'
                                      : 'bg-white/20 text-white hover:bg-white/30'
                                }`}
                              >
                                <Icon className="h-3 w-3" />
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                    {special && (
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-700/80 dark:text-amber-200/80">
                        {LABELS[special]}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    {isSpecial && !readOnly && (
                      <button
                        type="button"
                        onClick={() => setNewPostDate(date)}
                        className="flex w-full items-center justify-center gap-1 rounded-xl bg-amber-500/20 py-2 text-[11px] font-bold text-amber-700 dark:text-amber-100 hover:bg-amber-500/30"
                      >
                        <Clock className="h-3 w-3" /> Ny økt (navn + tid)
                      </button>
                    )}
                    {isSpecial && dayRows.length === 0 && (
                      <p className="rounded-xl border border-dashed border-amber-500/40 p-2 text-[11px] text-muted-foreground">
                        Ingen økter denne dagen — legg inn egne økter med navn og tid.
                      </p>
                    )}
                    {dayRows.map((row) => {
                      const key = row.key;
                      const current = stored.get(key);
                      const color = current?.color ?? 'neutral';
                      const style = COLORS.find((c) => c.key === color) ?? COLORS[0];
                      const value = current?.content ?? '';
                      const lines = splitLines(value);
                      const rowIndex = row.postId
                        ? null
                        : ROWS.find((r) => cellKey(date, r.index) === key)?.index ?? null;
                      const setLines = (next: string[]) =>
                        persist(date, rowIndex, next.join('\n'), color, row.postId);
                      return (
                        <div key={key} className={`rounded-xl border p-1.5 ${style.cell}`}>
                          <div className="mb-1 flex items-center justify-between gap-1">
                            <span className="min-w-0 flex-1 truncate text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                              {row.label}
                              {row.sub && (
                                <span className="ml-1 normal-case text-muted-foreground/70">{row.sub}</span>
                              )}
                            </span>
                            {!readOnly && isSpecial && (
                              <form
                                onSubmit={(e) => {
                                  e.preventDefault();
                                  const text = (freeText[key] ?? '').trim();
                                  if (!text) return;
                                  setLines([...lines, text]);
                                  setFreeText((s) => ({ ...s, [key]: '' }));
                                }}
                              >
                                <input
                                  value={freeText[key] ?? ''}
                                  onChange={(e) => setFreeText((s) => ({ ...s, [key]: e.target.value }))}
                                  placeholder="Skriv aktivitet + Enter"
                                  className="w-full rounded-lg border border-dashed border-border bg-background/60 px-2 py-1 text-[11px] outline-none focus:border-primary"
                                />
                              </form>
                            )}
                            {!readOnly && !isSpecial && (
                              <div className="flex items-center gap-1">
                                {COLORS.map((c) => (
                                  <button
                                    key={c.key}
                                    type="button"
                                    aria-label={c.label}
                                    onClick={() => persist(date, rowIndex, value, c.key, row.postId)}
                                    className={`h-3 w-3 rounded-full ${c.dot} ${
                                      color === c.key ? 'ring-2 ring-foreground/50' : 'opacity-60'
                                    }`}
                                  />
                                ))}
                                {row.postId && (
                                  <button
                                    type="button"
                                    aria-label={`Slett ${row.label}`}
                                    onClick={() => deletePost.mutate(row.postId!)}
                                    className="text-muted-foreground hover:text-destructive"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                          <div className="min-h-[3rem] space-y-1">
                            {lines.length === 0 && (
                              <p className="px-1 text-xs text-muted-foreground">—</p>
                            )}
                            {lines.map((line, i) => (
                              <div
                                key={`${line}-${i}`}
                                className="flex items-center gap-1 rounded-lg bg-background/70 px-1.5 py-1 text-xs font-medium"
                              >
                                <span className="flex-1 truncate">{line}</span>
                                {!readOnly && (
                                  <button
                                    type="button"
                                    aria-label={`Fjern ${line}`}
                                    onClick={() => setLines(lines.filter((_, idx) => idx !== i))}
                                    className="text-muted-foreground hover:text-destructive"
                                  >
                                    <X className="h-3 w-3" />
                                  </button>
                                )}
                              </div>
                            ))}
                            {!readOnly && (
                              <Popover>
                                <PopoverTrigger asChild>
                                  <button
                                    type="button"
                                    className="flex w-full items-center justify-center gap-1 rounded-lg border border-dashed border-border py-1 text-[11px] font-semibold text-muted-foreground hover:bg-background/60"
                                  >
                                    <Plus className="h-3 w-3" /> Aktivitet
                                  </button>
                                </PopoverTrigger>
                                <PopoverContent align="start" className="w-56 p-1">
                                  <div className="max-h-64 space-y-0.5 overflow-y-auto">
                                    {(activityTypes ?? []).length === 0 && (
                                      <p className="p-2 text-xs text-muted-foreground">
                                        Ingen aktiviteter — legg dem inn i «Aktiviteter».
                                      </p>
                                    )}
                                    {(activityTypes ?? []).map((a) => {
                                      const text = `${a.emoji ?? ''} ${a.label}`.trim();
                                      const active = lines.includes(text);
                                      return (
                                        <button
                                          key={a.id}
                                          type="button"
                                          onClick={() =>
                                            setLines(active ? lines.filter((l) => l !== text) : [...lines, text])
                                          }
                                          className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm ${
                                            active ? 'bg-primary/15 font-semibold' : 'hover:bg-muted'
                                          }`}
                                        >
                                          <span>{a.emoji ?? '•'}</span>
                                          <span className="flex-1 truncate">{a.label}</span>
                                        </button>
                                      );
                                    })}
                                  </div>
                                </PopoverContent>
                              </Popover>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <Dialog open={!!newPostDate} onOpenChange={(o) => !o && setNewPostDate(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Ny økt på avreisedagen</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="ls-post-name">Navn</Label>
                <Input
                  id="ls-post-name"
                  value={form.name}
                  placeholder="F.eks. Rydding, Bagasje ut, Avreise buss"
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label htmlFor="ls-post-start">Fra</Label>
                  <Input
                    id="ls-post-start"
                    type="time"
                    value={form.start}
                    onChange={(e) => setForm((f) => ({ ...f, start: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="ls-post-end">Til</Label>
                  <Input
                    id="ls-post-end"
                    type="time"
                    value={form.end}
                    onChange={(e) => setForm((f) => ({ ...f, end: e.target.value }))}
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setNewPostDate(null)}>
                Avbryt
              </Button>
              <Button onClick={submitPost} disabled={!form.name.trim() || addPost.isPending}>
                Legg til
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
