import { useMemo, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Plus, Check, X, Trash2, HeartHandshake, UserRound, Map as MapIcon, List } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useKlinelisteLeaders } from '@/hooks/useLeaders';
import {
  useHookupsEnabled,
  useSetHookupsEnabled,
  useMyHookups,
  useRespondToHookup,
  useDeleteHookup,
  useDeleteExternalLeader,
  type Hookup,
} from '@/hooks/useHookups';
import { HookupGraph } from '@/components/klineliste/HookupGraph';
import { HookupList } from '@/components/klineliste/HookupList';
import { AddHookupSheet } from '@/components/klineliste/AddHookupSheet';
import { AddExternalLeaderSheet } from '@/components/klineliste/AddExternalLeaderSheet';
import { useStatusPopup } from '@/hooks/useStatusPopup';
import { cn } from '@/lib/utils';

function initials(name: string) {
  return name.split(' ').map((p) => p[0]).slice(0, 2).join('');
}

type GenderFilter = 'all' | 'male' | 'female';

export default function Klineliste() {
  const { leader, isAdmin, isLimitedAccess } = useAuth();
  const enabled = useHookupsEnabled();
  const setEnabled = useSetHookupsEnabled();
  const { data: leaders = [] } = useKlinelisteLeaders();
  const { confirmed, myConfirmed, incoming, outgoing, isLoading } = useMyHookups();
  const respond = useRespondToHookup();
  const remove = useDeleteHookup();
  const removeExternal = useDeleteExternalLeader();
  const { showError } = useStatusPopup();
  const [addOpen, setAddOpen] = useState(false);
  const [addExternalOpen, setAddExternalOpen] = useState(false);
  const [gender, setGender] = useState<GenderFilter>('all');
  const [mapView, setMapView] = useState<'map' | 'list'>('map');

  const leaderById = useMemo(() => new Map(leaders.map((l) => [l.id, l])), [leaders]);
  const nameOf = (id: string) => leaderById.get(id)?.name ?? 'Ukjent leder';
  const otherOf = (h: Hookup) => (h.leader_a_id === leader?.id ? h.leader_b_id : h.leader_a_id);

  // Gender filter keeps only connections where both parties match, so the map
  // never shows half a link.
  const matchesGender = (id: string) =>
    gender === 'all' ? true : leaderById.get(id)?.gender === gender;

  const filteredConfirmed = useMemo(
    () => confirmed.filter((h) => matchesGender(h.leader_a_id) && matchesGender(h.leader_b_id)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [confirmed, gender, leaderById],
  );

  const externalLeaders = useMemo(() => leaders.filter((l) => l.is_external), [leaders]);

  const leaderboard = useMemo(() => {
    const counts = new Map<string, number>();
    filteredConfirmed.forEach((h) => {
      counts.set(h.leader_a_id, (counts.get(h.leader_a_id) ?? 0) + 1);
      counts.set(h.leader_b_id, (counts.get(h.leader_b_id) ?? 0) + 1);
    });
    return [...counts.entries()]
      .map(([id, count]) => ({ id, count, name: nameOf(id), leader: leaderById.get(id) }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'nb'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredConfirmed, leaderById]);

  const act = async (fn: () => Promise<unknown>, ok: string) => {
    try {
      await fn();
      toast.success(ok);
    } catch (e) {
      showError('Noe gikk galt', e instanceof Error ? e.message : 'Ukjent feil');
    }
  };

  // Off-season / inaktive ledere har alltid tilgang – bryteren styrer bare sesongen.
  if (!enabled && !isAdmin && !isLimitedAccess) {
    return (
      <div className="mx-auto w-full max-w-2xl py-16 text-center">
        <HeartHandshake className="mx-auto h-10 w-10 text-muted-foreground" strokeWidth={1.5} />
        <p className="mt-3 text-sm text-muted-foreground">Klinelista er ikke aktiv nå.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl space-y-5 pb-6">
      <header className="pt-1">
        <h1 className="text-2xl font-heading font-bold text-foreground">Klineliste</h1>
        <p className="text-sm text-muted-foreground">
          Kun ledere. En kobling vises for andre først når begge har bekreftet den.
        </p>
      </header>

      {isAdmin && (
        <div className="flex items-center justify-between rounded-2xl border border-border/60 bg-card/70 px-4 py-3">
          <div>
            <p className="text-sm font-medium text-foreground">Aktiv for alle ledere</p>
            <p className="text-xs text-muted-foreground">Skjuler funksjonen helt når den er av</p>
          </div>
          <Switch
            checked={enabled}
            disabled={setEnabled.isPending}
            onCheckedChange={(v) =>
              act(() => setEnabled.mutateAsync(v), v ? 'Klineliste aktivert' : 'Klineliste deaktivert')
            }
          />
        </div>
      )}

      <Tabs defaultValue="map">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="map">Kartet</TabsTrigger>
          <TabsTrigger value="mine" className="relative">
            Mine
            {incoming.length > 0 && (
              <span className="ml-1.5 rounded-full bg-destructive px-1.5 py-0.5 text-[10px] font-bold leading-none text-destructive-foreground">
                {incoming.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="top">Toppliste</TabsTrigger>
        </TabsList>

        <TabsContent value="map" className="mt-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="flex gap-1.5">
              {([
                { key: 'all', label: 'Alle' },
                { key: 'male', label: 'Gutter' },
                { key: 'female', label: 'Jenter' },
              ] as const).map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setGender(opt.key)}
                  className={cn(
                    'rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
                    gender === opt.key
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground',
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <div className="flex overflow-hidden rounded-full bg-muted p-0.5">
              {([
                { key: 'map', icon: MapIcon, label: 'Kart' },
                { key: 'list', icon: List, label: 'Liste' },
              ] as const).map(({ key, icon: Icon, label }) => (
                <button
                  key={key}
                  type="button"
                  aria-label={label}
                  onClick={() => setMapView(key)}
                  className={cn(
                    'rounded-full p-1.5 transition-colors',
                    mapView === key ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground',
                  )}
                >
                  <Icon className="h-4 w-4" />
                </button>
              ))}
            </div>
          </div>

          {isLoading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Laster...</p>
          ) : mapView === 'map' ? (
            <HookupGraph leaders={leaders} hookups={filteredConfirmed} myLeaderId={leader?.id} />
          ) : (
            <HookupList leaders={leaders} hookups={filteredConfirmed} myLeaderId={leader?.id} />
          )}
        </TabsContent>

        <TabsContent value="mine" className="mt-4 space-y-5">
          <div className="space-y-2">
            <Button onClick={() => setAddOpen(true)} className="w-full">
              <Plus className="mr-2 h-4 w-4" /> Ny kobling
            </Button>
            <Button variant="outline" onClick={() => setAddExternalOpen(true)} className="w-full">
              <UserRound className="mr-2 h-4 w-4" /> Legg til leder manuelt
            </Button>
          </div>

          {incoming.length > 0 && (
            <section className="space-y-2">
              <h2 className="px-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Venter på deg
              </h2>
              {incoming.map((h) => (
                <div
                  key={h.id}
                  className="flex items-center gap-3 rounded-xl border border-border/60 bg-card/70 px-3 py-2.5"
                >
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={leaderById.get(otherOf(h))?.profile_image_url ?? undefined} />
                    <AvatarFallback className="text-[11px]">{initials(nameOf(otherOf(h)))}</AvatarFallback>
                  </Avatar>
                  <span className="flex-1 text-sm font-medium text-foreground">{nameOf(otherOf(h))}</span>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => act(() => respond.mutateAsync({ id: h.id, accept: true }), 'Bekreftet')}
                  >
                    <Check className="h-4 w-4 text-primary" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => act(() => respond.mutateAsync({ id: h.id, accept: false }), 'Avslått')}
                  >
                    <X className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </div>
              ))}
            </section>
          )}

          {outgoing.length > 0 && (
            <section className="space-y-2">
              <h2 className="px-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Venter på svar
              </h2>
              {outgoing.map((h) => (
                <div
                  key={h.id}
                  className="flex items-center gap-3 rounded-xl border border-border/60 bg-card/70 px-3 py-2.5"
                >
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={leaderById.get(otherOf(h))?.profile_image_url ?? undefined} />
                    <AvatarFallback className="text-[11px]">{initials(nameOf(otherOf(h)))}</AvatarFallback>
                  </Avatar>
                  <span className="flex-1 text-sm text-foreground">{nameOf(otherOf(h))}</span>
                  <span className="text-[11px] text-muted-foreground">Ubekreftet</span>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => act(() => remove.mutateAsync(h.id), 'Trukket tilbake')}
                  >
                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </div>
              ))}
            </section>
          )}

          <section className="space-y-2">
            <h2 className="px-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Bekreftede koblinger
            </h2>
            {myConfirmed.length === 0 ? (
              <p className="px-1 text-sm text-muted-foreground">Ingen bekreftede koblinger ennå.</p>
            ) : (
              myConfirmed.map((h) => (
                <div
                  key={h.id}
                  className="flex items-center gap-3 rounded-xl border border-border/60 bg-card/70 px-3 py-2.5"
                >
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={leaderById.get(otherOf(h))?.profile_image_url ?? undefined} />
                    <AvatarFallback className="text-[11px]">{initials(nameOf(otherOf(h)))}</AvatarFallback>
                  </Avatar>
                  <span className="flex-1 text-sm font-medium text-foreground">{nameOf(otherOf(h))}</span>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => act(() => remove.mutateAsync(h.id), 'Fjernet')}
                  >
                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </div>
              ))
            )}
          </section>
        </TabsContent>

        <TabsContent value="top" className="mt-4 space-y-2">
          <div className="flex gap-1.5 pb-1">
            {([
              { key: 'all', label: 'Alle' },
              { key: 'male', label: 'Gutter' },
              { key: 'female', label: 'Jenter' },
            ] as const).map((opt) => (
              <button
                key={opt.key}
                type="button"
                onClick={() => setGender(opt.key)}
                className={cn(
                  'rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
                  gender === opt.key
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground',
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
          {leaderboard.length === 0 ? (
            <p className="px-1 text-sm text-muted-foreground">Ingen bekreftede koblinger ennå.</p>
          ) : (
            leaderboard.map((row, i) => (
              <div
                key={row.id}
                className="flex items-center gap-3 rounded-xl border border-border/60 bg-card/70 px-3 py-2.5"
              >
                <span className="w-5 text-center text-sm font-semibold text-muted-foreground">{i + 1}</span>
                <Avatar className="h-9 w-9">
                  <AvatarImage src={row.leader?.profile_image_url ?? undefined} />
                  <AvatarFallback className="text-[11px]">{initials(row.name)}</AvatarFallback>
                </Avatar>
                <span className="flex flex-1 items-center gap-1.5 text-sm font-medium text-foreground">
                  {row.name}
                  {row.leader?.is_external && <UserRound className="h-3 w-3 text-muted-foreground" />}
                </span>
                <span className="text-sm font-semibold text-primary">{row.count}</span>
              </div>
            ))
          )}
        </TabsContent>
      </Tabs>

      {isAdmin && externalLeaders.length > 0 && (
        <section className="space-y-2">
          <h2 className="px-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Manuelt lagt inn ({externalLeaders.length})
          </h2>
          {externalLeaders.map((l) => (
            <div
              key={l.id}
              className="flex items-center gap-3 rounded-xl border border-border/60 bg-card/70 px-3 py-2.5"
            >
              <UserRound className="h-4 w-4 text-muted-foreground" />
              <span className="flex-1 text-sm text-foreground">{l.name}</span>
              <Button
                size="icon"
                variant="ghost"
                disabled={removeExternal.isPending}
                onClick={() =>
                  act(() => removeExternal.mutateAsync(l.id), `${l.name} slettet`)
                }
              >
                <Trash2 className="h-4 w-4 text-muted-foreground" />
              </Button>
            </div>
          ))}
        </section>
      )}

      <AddHookupSheet open={addOpen} onOpenChange={setAddOpen} />
      <AddExternalLeaderSheet open={addExternalOpen} onOpenChange={setAddExternalOpen} />
    </div>
  );
}