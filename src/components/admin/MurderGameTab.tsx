import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { Skull, Play, Eye, EyeOff, Loader2, Crown, ArrowRight, Check, Bell, Sparkles, Archive } from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useLeaders } from '@/hooks/useLeaders';
import {
  useMurderGame, useMurderOverview, useMurderMutations, usePendingMurderClaims,
  useMurderRounds, useArchiveMurderRound,
  type MurderOverviewRow,
} from '@/hooks/useMurderGame';
import { useStatusPopup } from '@/hooks/useStatusPopup';

export function MurderGameTab() {
  const { showSuccess, showError } = useStatusPopup();
  const { data: leaders = [], isLoading: leadersLoading } = useLeaders();
  const { data: game, isLoading: gameLoading } = useMurderGame();
  const { startGame, setActive, confirmDeath, announceStart, reviveAndReshuffle } = useMurderMutations();
  const [revealed, setRevealed] = useState(false);
  const [reviveOpen, setReviveOpen] = useState(false);
  const [revivedNames, setRevivedNames] = useState<string[]>([]);
  const { data: overview = [], isLoading: overviewLoading } = useMurderOverview(revealed);
  const { data: pending = [] } = usePendingMurderClaims(true);
  const { data: rounds = [] } = useMurderRounds(true);
  const archiveRound = useArchiveMurderRound();
  const [excluded, setExcluded] = useState<Set<string>>(new Set());

  // Everyone is in by default; admin can opt leaders out before starting.
  useEffect(() => { setExcluded(new Set()); }, [game?.id]);

  const participants = useMemo(
    () => leaders.filter((l) => !excluded.has(l.id)),
    [leaders, excluded],
  );

  const nameById = useMemo(() => {
    const m = new Map<string, string>();
    overview.forEach((r) => m.set(r.leader_id, r.leader_name));
    leaders.forEach((l) => { if (!m.has(l.id)) m.set(l.id, l.name); });
    return m;
  }, [overview, leaders]);

  const stats = useMemo(() => {
    const alive = overview.filter((r) => r.is_alive).length;
    const dead = overview.length - alive;
    const top = [...overview].sort((a, b) => b.kills - a.kills)[0];
    return { alive, dead, top };
  }, [overview]);

  const handleStart = async () => {
    try {
      await startGame.mutateAsync(participants.map((p) => p.id));
      showSuccess(`Morder-leken startet med ${participants.length} ledere`);
    } catch (e) {
      showError(e instanceof Error ? e.message : 'Kunne ikke starte spillet');
    }
  };

  const handleAnnounceStart = async () => {
    try {
      const res = await announceStart.mutateAsync();
      showSuccess(`Startvarsling sendt til ${res?.sent ?? 0} enheter`);
    } catch (e) {
      showError(e instanceof Error ? e.message : 'Kunne ikke sende varsling');
    }
  };

  const handleToggle = async (v: boolean) => {
    try {
      await setActive.mutateAsync(v);
    } catch (e) {
      showError(e instanceof Error ? e.message : 'Kunne ikke endre status');
    }
  };

  const handleConfirm = async (claimId: string) => {
    try {
      await confirmDeath.mutateAsync(claimId);
      showSuccess('Drapet er bekreftet');
    } catch (e) {
      showError(e instanceof Error ? e.message : 'Kunne ikke bekrefte');
    }
  };

  const handleRevive = async () => {
    try {
      const rows = await reviveAndReshuffle.mutateAsync(4);
      const names = rows.filter((r) => r.was_revived).map((r) => r.leader_name);
      setRevivedNames(names);
      showSuccess(`Gjenopplivet ${names.length} – ringen er mikset og alle er varslet`);
    } catch (e) {
      showError(e instanceof Error ? e.message : 'Kunne ikke gjenopplive');
    } finally {
      setReviveOpen(false);
    }
  };

  const handleArchive = async () => {
    try {
      await archiveRound.mutateAsync();
      showSuccess('Runden er lagret i arkivet');
    } catch (e) {
      showError(e instanceof Error ? e.message : 'Kunne ikke lagre runden');
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Skull className="w-5 h-5 text-destructive" /> Morder-leken
          </CardTitle>
          <CardDescription>
            Alle aktive ledere er med som standard. Hver leder får én leder å «drepe» – når offeret
            bekrefter, arver morderen offerets mål.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {gameLoading ? (
            <Skeleton className="h-10 w-full" />
          ) : (
            <div className="flex items-center justify-between gap-3 rounded-xl border border-border/60 p-3">
              <div className="min-w-0">
                <p className="text-sm font-medium">Spillet er aktivt</p>
                <p className="text-xs text-muted-foreground">
                  {game?.periodName ? `Periode: ${game.periodName}` : 'Aktiv periode'}
                  {game?.started_at
                    ? ` · startet ${new Date(game.started_at).toLocaleDateString('nb-NO')}`
                    : ' · ikke startet'}
                </p>
              </div>
              <Switch checked={!!game?.is_active} onCheckedChange={handleToggle} />
            </div>
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">
                Deltakere <Badge variant="secondary">{participants.length}</Badge>
              </p>
              <Button size="sm" onClick={handleStart} disabled={startGame.isPending || participants.length < 3}>
                {startGame.isPending
                  ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  : <Play className="w-4 h-4 mr-2" />}
                {game?.started_at ? 'Nullstill og start på nytt' : 'Start spill'}
              </Button>
            </div>
            <Button
              variant="outline"
              className="w-full border-destructive/40 text-destructive hover:bg-destructive/10"
              onClick={handleAnnounceStart}
              disabled={announceStart.isPending || !game?.started_at}
            >
              {announceStart.isPending
                ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                : <Bell className="w-4 h-4 mr-2" />}
              Send «Morder-leken har startet»-varsling
            </Button>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setReviveOpen(true)}
              disabled={reviveAndReshuffle.isPending || !game?.started_at}
            >
              {reviveAndReshuffle.isPending
                ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                : <Sparkles className="w-4 h-4 mr-2" />}
              Gjenoppliv 4 tilfeldige og miks ringen
            </Button>
            <Button
              variant="outline"
              className="w-full"
              onClick={handleArchive}
              disabled={archiveRound.isPending || !game?.started_at}
            >
              {archiveRound.isPending
                ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                : <Archive className="w-4 h-4 mr-2" />}
              Lagre runden i arkivet
            </Button>
            {revivedNames.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Sist gjenopplivet: {revivedNames.join(', ')}
              </p>
            )}
            {leadersLoading ? (
              <Skeleton className="h-24 w-full" />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-72 overflow-y-auto pr-1">
                {leaders.map((l) => {
                  const isIn = !excluded.has(l.id);
                  return (
                    <label
                      key={l.id}
                      className="flex items-center gap-2 rounded-lg border border-border/50 px-2.5 py-2 text-sm cursor-pointer"
                    >
                      <Checkbox
                        checked={isIn}
                        onCheckedChange={(v) => {
                          setExcluded((prev) => {
                            const next = new Set(prev);
                            if (v) next.delete(l.id); else next.add(l.id);
                            return next;
                          });
                        }}
                      />
                      <span className={isIn ? '' : 'text-muted-foreground line-through'}>{l.name}</span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {pending.length > 0 && (
        <Card className="border-amber-500/40">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Venter på bekreftelse ({pending.length})</CardTitle>
            <CardDescription>Bekreft manuelt hvis offeret glemmer å trykke.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {pending.map((c) => (
              <div key={c.id} className="flex items-center justify-between gap-2 rounded-lg border border-border/50 p-2.5">
                <p className="text-sm min-w-0">
                  <span className="font-medium">{c.killer?.name}</span>
                  <ArrowRight className="inline w-3.5 h-3.5 mx-1 text-muted-foreground" />
                  <span className="font-medium">{c.victim?.name}</span>
                </p>
                <Button size="sm" variant="outline" onClick={() => handleConfirm(c.id)} disabled={confirmDeath.isPending}>
                  <Check className="w-4 h-4 mr-1" /> Bekreft
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3 flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Full oversikt</CardTitle>
          <Button variant="outline" size="sm" onClick={() => setRevealed((v) => !v)}>
            {revealed ? <EyeOff className="w-4 h-4 mr-2" /> : <Eye className="w-4 h-4 mr-2" />}
            {revealed ? 'Skjul' : 'Reveal'}
          </Button>
        </CardHeader>
        <CardContent>
          {!revealed ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Skjult – du er selv med i leken. Trykk «Reveal» for å se hele kjeden.
            </p>
          ) : overviewLoading ? (
            <Skeleton className="h-48 w-full" />
          ) : overview.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Ingen spill startet ennå.</p>
          ) : (
            <div className="space-y-5">
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">{stats.alive} i live</Badge>
                <Badge variant="destructive">{stats.dead} drept</Badge>
                {stats.top && stats.top.kills > 0 && (
                  <Badge variant="secondary">
                    <Crown className="w-3 h-3 mr-1" /> {stats.top.leader_name} · {stats.top.kills} drap
                  </Badge>
                )}
              </div>

              <MurderWeb rows={overview} nameById={nameById} />

              <MurderKillLog rows={overview} nameById={nameById} />

              <MurderKillerBoard rows={overview} nameById={nameById} />

              <div className="space-y-1.5">
                {overview.map((r) => (
                  <div
                    key={r.leader_id}
                    className={`flex items-center justify-between gap-2 rounded-lg border p-2.5 text-sm ${
                      r.is_alive ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-border/50 bg-muted/40'
                    }`}
                  >
                    <div className="min-w-0">
                      <p className={r.is_alive ? 'font-medium' : 'font-medium line-through text-muted-foreground'}>
                        {r.leader_name}
                        {r.kills > 0 && <span className="ml-2 text-xs text-muted-foreground">{r.kills} drap</span>}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {r.is_alive
                          ? r.target_leader_id
                            ? `Jakter på ${nameById.get(r.target_leader_id) ?? '—'}`
                            : 'Ingen mål'
                          : `Tatt av ${r.killed_by ? nameById.get(r.killed_by) ?? '—' : '—'}${
                              r.killed_at ? ` · ${new Date(r.killed_at).toLocaleString('nb-NO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}` : ''
                            }`}
                      </p>
                    </div>
                    <Badge variant={r.is_alive ? 'outline' : 'secondary'} className="shrink-0">
                      {r.is_alive ? 'I live' : 'Død'}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {rounds.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Archive className="w-4 h-4" /> Lagrede runder ({rounds.length})
            </CardTitle>
            <CardDescription>Hele historikken for hver ferdigspilte runde.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {rounds.map((r) => {
              const top = [...(r.data ?? [])].sort((a, b) => b.kills - a.kills)[0];
              return (
                <div key={r.id} className="rounded-xl border border-border/60 p-3 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold">Runde {r.round_number}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {new Date(r.archived_at).toLocaleDateString('nb-NO')}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <Badge variant="outline">{r.player_count} spillere</Badge>
                    <Badge variant="destructive">{r.kill_count} drap</Badge>
                    {top && top.kills > 0 && (
                      <Badge variant="secondary">
                        <Crown className="w-3 h-3 mr-1" /> {top.leader_name} · {top.kills} drap
                      </Badge>
                    )}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      <AlertDialog open={reviveOpen} onOpenChange={setReviveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Gjenoppliv 4 tilfeldige?</AlertDialogTitle>
            <AlertDialogDescription>
              4 tilfeldige drepte spillere hentes tilbake i leken. Alle gjenlevende mikses i en ny
              ring og får nye mål – drapstall beholdes. Ventende drapsmeldinger forkastes, og alle
              spillere får varsling.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Avbryt</AlertDialogCancel>
            <AlertDialogAction onClick={handleRevive}>Gjenoppliv og miks</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/** Spider-web / ring view of the whole chain. */
/** Chronological kill feed: who took out whom, newest first. */
function MurderKillLog({ rows, nameById }: { rows: MurderOverviewRow[]; nameById: Map<string, string> }) {
  const kills = rows
    .filter((r) => r.killed_by && r.killed_at)
    .sort((a, b) => new Date(b.killed_at!).getTime() - new Date(a.killed_at!).getTime());

  if (kills.length === 0) return null;

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Drapslogg ({kills.length})
      </p>
      <ol className="relative space-y-2 border-l border-destructive/30 pl-4">
        {kills.map((r) => (
          <li key={`log-${r.leader_id}`} className="relative">
            <span className="absolute -left-[21px] top-2 flex h-3 w-3 items-center justify-center rounded-full bg-destructive/80 ring-2 ring-background" />
            <div className="rounded-lg border border-destructive/25 bg-destructive/5 p-2.5">
              <p className="text-sm">
                <span className="font-semibold">
                  {r.killed_by ? nameById.get(r.killed_by) ?? '—' : '—'}
                </span>
                <Skull className="inline w-3.5 h-3.5 mx-1.5 text-destructive" />
                <span className="font-medium line-through text-muted-foreground">
                  {nameById.get(r.leader_id) ?? '—'}
                </span>
              </p>
              <p className="text-[11px] text-muted-foreground">
                {new Date(r.killed_at!).toLocaleString('nb-NO', {
                  weekday: 'short', day: '2-digit', month: 'short',
                  hour: '2-digit', minute: '2-digit',
                })}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** Per-killer scoreboard with the victims each leader has taken out. */
function MurderKillerBoard({ rows, nameById }: { rows: MurderOverviewRow[]; nameById: Map<string, string> }) {
  const byKiller = new Map<string, MurderOverviewRow[]>();
  rows.forEach((r) => {
    if (!r.killed_by) return;
    const list = byKiller.get(r.killed_by) ?? [];
    list.push(r);
    byKiller.set(r.killed_by, list);
  });

  const killers = [...byKiller.entries()].sort((a, b) => b[1].length - a[1].length);
  if (killers.length === 0) return null;

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Drapsliste per morder
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {killers.map(([killerId, victims]) => {
          const killer = rows.find((r) => r.leader_id === killerId);
          return (
            <div key={killerId} className="rounded-xl border border-border/60 p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className={`text-sm font-semibold truncate ${killer && !killer.is_alive ? 'line-through text-muted-foreground' : ''}`}>
                  {nameById.get(killerId) ?? '—'}
                </p>
                <Badge variant="destructive" className="shrink-0">
                  {victims.length} drap
                </Badge>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {victims
                  .sort((a, b) => new Date(a.killed_at ?? 0).getTime() - new Date(b.killed_at ?? 0).getTime())
                  .map((v) => (
                    <span
                      key={`v-${v.leader_id}`}
                      className="inline-flex items-center gap-1 rounded-full border border-destructive/30 bg-destructive/10 px-2 py-0.5 text-[11px] text-muted-foreground"
                    >
                      <Skull className="w-3 h-3 text-destructive" />
                      {nameById.get(v.leader_id) ?? '—'}
                    </span>
                  ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MurderWeb({ rows, nameById }: { rows: MurderOverviewRow[]; nameById: Map<string, string> }) {
  const size = 320;
  const r = 130;
  const cx = size / 2;
  const cy = size / 2;

  const pos = new Map<string, { x: number; y: number }>();
  rows.forEach((row, i) => {
    const a = (i / rows.length) * Math.PI * 2 - Math.PI / 2;
    pos.set(row.leader_id, { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
  });

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${size} ${size}`} className="w-full max-w-sm mx-auto">
        <defs>
          <marker id="mw-arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
            <path d="M0,0 L6,3 L0,6 Z" fill="currentColor" className="text-primary" />
          </marker>
        </defs>
        {/* kill edges */}
        {rows.filter((row) => row.killed_by).map((row) => {
          const from = pos.get(row.killed_by!);
          const to = pos.get(row.leader_id);
          if (!from || !to) return null;
          return (
            <line key={`k-${row.leader_id}`} x1={from.x} y1={from.y} x2={to.x} y2={to.y}
              className="stroke-destructive/50" strokeWidth={1.5} strokeDasharray="3 3" />
          );
        })}
        {/* current target edges */}
        {rows.filter((row) => row.is_alive && row.target_leader_id).map((row) => {
          const from = pos.get(row.leader_id);
          const to = pos.get(row.target_leader_id!);
          if (!from || !to) return null;
          return (
            <line key={`t-${row.leader_id}`} x1={from.x} y1={from.y} x2={to.x} y2={to.y}
              className="stroke-primary/60 text-primary" strokeWidth={1.5} markerEnd="url(#mw-arrow)" />
          );
        })}
        {rows.map((row) => {
          const p = pos.get(row.leader_id)!;
          const first = (nameById.get(row.leader_id) || '?').split(' ')[0];
          return (
            <g key={row.leader_id}>
              <circle cx={p.x} cy={p.y} r={9}
                className={row.is_alive ? 'fill-emerald-500' : 'fill-muted-foreground/50'} />
              <text x={p.x} y={p.y - 13} textAnchor="middle"
                className="fill-foreground text-[8px]">{first}</text>
            </g>
          );
        })}
      </svg>
      <div className="flex flex-wrap justify-center gap-3 pt-1 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-0 w-5 border-t border-dashed border-destructive/70" /> drept av
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-0 w-5 border-t border-primary" /> jakter på
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-emerald-500" /> i live
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-muted-foreground/50" /> død
        </span>
      </div>
    </div>
  );
}