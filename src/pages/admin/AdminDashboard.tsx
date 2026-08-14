import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useAdminDashboard } from '@/hooks/useAdminDashboard';
import { useKitchenDutyToday } from '@/hooks/useKitchenDutyToday';
import { useTeamsEnabled } from '@/hooks/useTeamsEnabled';
import { CATEGORY_COLORS, CATEGORY_LABELS, SEVERITY_COLORS, SEVERITY_LABELS, useParticipantIncidents, type Incident } from '@/hooks/useParticipantIncidents';
import { IncidentSheet } from '@/components/incidents/IncidentSheet';
import { ParticipantDetailDialog } from '@/components/passport/ParticipantDetailDialog';
import { AdminNotesPanel } from '@/components/admin/notes/AdminNotesPanel';
import { StatTile } from '@/components/admin/dashboard/StatTile';
import { DashCard, EmptyLine } from '@/components/admin/dashboard/DashCard';
import { ParticipantChip } from '@/components/admin/dashboard/ParticipantChip';
import { StyrkeproveNearlyCard } from '@/components/admin/dashboard/StyrkeproveNearlyCard';
import { SessionActivitiesCard } from '@/components/admin/dashboard/SessionActivitiesCard';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { LeaderDeviationsSheet } from '@/components/admin/LeaderDeviationsSheet';
import { openAdminNotes } from '@/lib/adminNotesBus';
import { markDashReturn } from '@/lib/dashboardReturn';
import { format } from 'date-fns';
import { nb } from 'date-fns/locale';
import {
  Cake, MessageSquareWarning, StickyNote, Heart, Wrench, Mail, ClipboardList,
  ChefHat, RefreshCw, Settings, AlertTriangle, ChevronRight,
} from 'lucide-react';

function timeAgo(iso: string) {
  return format(new Date(iso), 'd. MMM HH:mm', { locale: nb });
}

export default function AdminDashboard() {
  const { isAdmin } = useAuth();
  const rawNavigate = useNavigate();
  const { data, isLoading, refetch, isRefetching } = useAdminDashboard(!!isAdmin);
  const { teamA, teamB } = useKitchenDutyToday();
  const teamsEnabled = useTeamsEnabled();
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [deviationsOpen, setDeviationsOpen] = useState(false);
  const { data: allIncidents = [] } = useParticipantIncidents({ adminAll: true });
  const [openIncident, setOpenIncident] = useState<Incident | null>(null);
  const [incidentOpen, setIncidentOpen] = useState(false);

  const openIncidentById = (id: string) => {
    const found = allIncidents.find((i) => i.id === id);
    if (!found) return;
    setOpenIncident(found);
    setIncidentOpen(true);
  };

  // Alle hopp ut fra dashboardet husker at man kan gå tilbake hit
  const navigate = (to: string) => {
    markDashReturn();
    rawNavigate(to);
  };

  const openParticipant = (id: string) => {
    setDetailId(id);
    setDetailOpen(true);
  };

  if (!isAdmin) {
    return (
      <div className="container mx-auto max-w-2xl px-4 py-10 text-center text-sm text-muted-foreground">
        Kun for admin.
      </div>
    );
  }

  const today = format(new Date(), "EEEE d. MMMM", { locale: nb });

  return (
    <div className="container mx-auto max-w-6xl px-4 pt-2 pb-8 sm:py-6">
      <header className="mb-4 flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-bold sm:text-2xl">Dashboard</h1>
          <p className="truncate text-sm text-muted-foreground">
            <span className="capitalize">{today}</span>
            {data?.period?.name ? ` · ${data.period.name}` : ''}
          </p>
        </div>
        <Button variant="ghost" size="icon" onClick={() => refetch()} aria-label="Oppdater">
          <RefreshCw className={isRefetching ? 'h-5 w-5 animate-spin' : 'h-5 w-5'} />
        </Button>
        <Button variant="ghost" size="icon" onClick={() => navigate('/admin')} aria-label="Admin">
          <Settings className="h-5 w-5" />
        </Button>
      </header>

      {isLoading || !data ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-20 rounded-2xl" />)}
          </div>
          <Skeleton className="h-40 rounded-3xl" />
          <Skeleton className="h-40 rounded-3xl" />
        </div>
      ) : (
        <>
          {/* Nøkkeltall – deltagerstatus i én boks */}
          <div className="grid gap-2.5 sm:grid-cols-[2fr_1fr]">
            <section className="rounded-3xl border border-border/60 bg-card/70 p-4 shadow-sm backdrop-blur">
              <button
                type="button"
                onClick={() => navigate('/passport')}
                className="flex w-full items-end gap-2 text-left"
              >
                <span className="text-4xl font-bold leading-none">{data.inCamp}</span>
                <span className="pb-0.5 text-sm text-muted-foreground">i leir nå · av {data.totalParticipants} deltagere</span>
                <ChevronRight className="ml-auto h-4 w-4 shrink-0 text-muted-foreground" />
              </button>
              <div className="mt-3 grid grid-cols-3 divide-x divide-border/60 border-t border-border/60 pt-3">
                <button type="button" onClick={() => navigate('/passport')} className="px-1 text-left">
                  <p className="text-lg font-semibold leading-none">{data.arrived}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">Ankommet</p>
                </button>
                <button type="button" onClick={() => navigate('/passport')} className="px-3 text-left">
                  <p className="text-lg font-semibold leading-none">{data.notArrived}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">Ikke ankommet</p>
                </button>
                <button type="button" onClick={() => navigate('/passport?status=wenthome')} className="px-3 text-left">
                  <p className="text-lg font-semibold leading-none">{data.wentHome}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">Dratt hjem</p>
                </button>
              </div>
            </section>
            <StatTile label="Aktive ledere" value={data.activeLeaders} hint="denne perioden" onClick={() => navigate('/leaders')} />
          </div>

          {/* Aktiviteter denne økten — redigerbart rett fra dashboardet */}
          <div className="mt-3">
            <SessionActivitiesCard />
          </div>

          <div className="mt-3 grid gap-3 lg:grid-cols-3">
            {/* Venstre kolonne */}
            <div className="space-y-3 lg:col-span-2">
              {/* Bursdager */}
              <DashCard
                title="Bursdager i dag"
                icon={<Cake className="h-4 w-4 text-pink-500" />}
                badge={data.birthdaysToday.length > 0 ? <Badge variant="secondary">{data.birthdaysToday.length}</Badge> : undefined}
              >
                {data.birthdaysToday.length === 0 ? (
                  <EmptyLine text="Ingen bursdager i dag." />
                ) : (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {data.birthdaysToday.map((b) => (
                      <ParticipantChip
                        key={b.id}
                        name={b.name}
                        imageUrl={b.image_url}
                        thumbUrl={b.image_thumb_url}
                        subtitle={[b.turns ? `${b.turns} år i dag` : null, b.cabinName, b.room].filter(Boolean).join(' · ')}
                        onClick={() => openParticipant(b.id)}
                        right={<span className="text-lg" aria-hidden>🎂</span>}
                      />
                    ))}
                  </div>
                )}
                {data.birthdaysSoon.length > 0 && (
                  <div className="mt-3 border-t border-border/60 pt-2">
                    <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Kommer snart
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {data.birthdaysSoon.map((b) => (
                        <button
                          key={b.id}
                          type="button"
                          onClick={() => openParticipant(b.id)}
                          className="rounded-full bg-muted/60 px-2.5 py-1 text-[11px] font-medium active:scale-95 transition-transform"
                        >
                          {b.name} · om {b.inDays} d
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </DashCard>

              {/* Nyeste hendelser */}
              <DashCard
                title="Nyeste hendelser"
                icon={<MessageSquareWarning className="h-4 w-4 text-red-500" />}
                onAction={() => navigate('/participant-stats?tab=incidents')}
              >
                {data.incidents.length === 0 ? (
                  <EmptyLine text="Ingen hendelser registrert i denne perioden." />
                ) : (
                  <ul className="space-y-2">
                    {data.incidents.slice(0, 5).map((inc) => (
                      <li
                        key={inc.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => openIncidentById(inc.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            openIncidentById(inc.id);
                          }
                        }}
                        className="cursor-pointer rounded-2xl bg-muted/40 p-2.5 transition-all active:scale-[0.98] hover:bg-muted/70"
                      >
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Badge className={CATEGORY_COLORS[inc.category]} variant="secondary">
                            {CATEGORY_LABELS[inc.category]}
                          </Badge>
                          <Badge className={SEVERITY_COLORS[inc.severity]} variant="secondary">
                            {SEVERITY_LABELS[inc.severity]}
                          </Badge>
                          <span className="ml-auto text-[11px] text-muted-foreground">{timeAgo(inc.created_at)}</span>
                          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                        </div>
                        <p className="mt-1.5 text-sm font-medium leading-snug">{inc.title}</p>
                        {inc.participants.length > 0 && (
                          <div className="mt-1.5 flex flex-wrap gap-1.5">
                            {inc.participants.map((p) => (
                              <button
                                key={p.id}
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openParticipant(p.id);
                                }}
                                className="flex items-center gap-1.5 rounded-full bg-background/70 py-0.5 pl-0.5 pr-2.5 active:scale-95 transition-transform"
                              >
                                <img
                                  src={p.image_thumb_url || p.image_url || ''}
                                  alt={p.name}
                                  loading="lazy"
                                  className="h-7 w-7 rounded-full object-cover bg-muted"
                                />
                                <span className="text-[12px] font-medium">{p.name}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </DashCard>

              {/* Notater */}
              <DashCard
                title="Notater"
                icon={<StickyNote className="h-4 w-4 text-amber-500" />}
                actionLabel="Åpne"
                onAction={() => openAdminNotes()}
              >
                {data.notes.length === 0 ? (
                  <EmptyLine text="Ingen notater ennå." />
                ) : (
                  <ul className="space-y-1.5">
                    {data.notes.map((n) => (
                      <li key={n.id}>
                        <button
                          type="button"
                          onClick={() => openAdminNotes(n.id)}
                          className="flex w-full items-center gap-2 rounded-xl bg-muted/40 px-2.5 py-2 text-left transition-transform active:scale-[0.99]"
                        >
                          <span className="truncate text-sm font-medium">
                            {n.is_pinned ? '📌 ' : ''}{n.title || (n.kind === 'board' ? 'Whiteboard' : 'Uten tittel')}
                          </span>
                          <span className="ml-auto shrink-0 text-[11px] text-muted-foreground">{timeAgo(n.updated_at)}</span>
                          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <p className="mt-2 text-[11px] text-muted-foreground">Trykk på et notat for å åpne og redigere det.</p>
              </DashCard>
            </div>

            {/* Høyre kolonne */}
            <div className="space-y-3">
              {/* Denne økten / kjøkken */}
              {teamsEnabled && (teamA || teamB) && (
                <DashCard title="Kjøkkentjeneste i dag" icon={<ChefHat className="h-4 w-4 text-emerald-500" />}>
                  <div className="flex flex-wrap gap-2">
                    {[teamA, teamB].filter(Boolean).map((t) => (
                      <span
                        key={t!.id}
                        className="rounded-full px-3 py-1.5 text-sm font-semibold text-white"
                        style={{ backgroundColor: t!.color || undefined }}
                      >
                        {t!.name}
                      </span>
                    ))}
                  </div>
                </DashCard>
              )}

              {/* Nurse */}
              <DashCard title="Nurse" icon={<Heart className="h-4 w-4 text-rose-500" />} onAction={() => navigate('/nurse')}>
                <div className="grid grid-cols-2 gap-2.5">
                  <StatTile label="Rapporter" value={data.nurseReports} hint="denne perioden" />
                  <StatTile label="Helseinfo" value={data.importantHealthInfo} hint="deltagere med info" />
                </div>
              </DashCard>

              {/* Lederavvik */}
              <DashCard
                title="Lederavvik"
                icon={<AlertTriangle className="h-4 w-4 text-orange-500" />}
                actionLabel="Åpne"
                onAction={() => setDeviationsOpen(true)}
              >
                <p className="text-xs text-muted-foreground">
                  Registrer timer, overtid eller fravær og tagg lederen det gjelder.
                </p>
                <Button size="sm" className="mt-2 w-full" onClick={() => setDeviationsOpen(true)}>
                  Lederavvik
                </Button>
              </DashCard>

              {/* Fix */}
              <DashCard
                title="FIX"
                icon={<Wrench className="h-4 w-4 text-orange-500" />}
                badge={data.openFix > 0 ? <Badge variant="secondary">{data.openFix} åpne</Badge> : undefined}
                onAction={() => navigate('/fix')}
              >
                {data.fixTasks.length === 0 ? (
                  <EmptyLine text="Ingen åpne saker." />
                ) : (
                  <ul className="space-y-1.5">
                    {data.fixTasks.map((t) => (
                      <li key={t.id} className="rounded-xl bg-muted/40 px-2.5 py-2">
                        <p className="truncate text-sm font-medium">{t.title}</p>
                        <p className="truncate text-[11px] text-muted-foreground">
                          {[t.location, timeAgo(t.created_at)].filter(Boolean).join(' · ')}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </DashCard>

              {/* Postkasse */}
              <DashCard
                title="Postkasse"
                icon={<Mail className="h-4 w-4 text-blue-500" />}
                badge={data.unansweredMail > 0 ? <Badge variant="secondary">{data.unansweredMail} ubesvart</Badge> : undefined}
                onAction={() => navigate('/postkasse')}
              >
                {data.mailbox.length === 0 ? (
                  <EmptyLine text="Alt er besvart." />
                ) : (
                  <ul className="space-y-1.5">
                    {data.mailbox.map((m) => (
                      <li key={m.id} className="rounded-xl bg-muted/40 px-2.5 py-2">
                        <p className="line-clamp-2 text-sm leading-snug">{m.content}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {[m.category, m.is_anonymous ? 'Anonym' : null, timeAgo(m.created_at)].filter(Boolean).join(' · ')}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </DashCard>

              {/* Oppdrag */}
              <DashCard
                title="Deltakeroppdrag"
                icon={<ClipboardList className="h-4 w-4 text-indigo-500" />}
                badge={data.openTasks.length > 0 ? <Badge variant="secondary">{data.openTasks.length}</Badge> : undefined}
                onAction={() => navigate('/participant-stats?tab=participant-tasks')}
              >
                {data.openTasks.length === 0 ? (
                  <EmptyLine text="Ingen ventende oppdrag." />
                ) : (
                  <div className="space-y-2">
                    {data.openTasks.slice(0, 3).map((t) => (
                      <ParticipantChip
                        key={t.id}
                        size="sm"
                        name={t.participant?.name ?? 'Ukjent deltager'}
                        imageUrl={t.participant?.image_url}
                        thumbUrl={t.participant?.image_thumb_url}
                        subtitle={t.message}
                        onClick={t.participant ? () => openParticipant(t.participant!.id) : undefined}
                        right={
                          <Badge variant="secondary" className="shrink-0 text-[10px]">
                            {t.status === 'claimed' ? 'Tatt' : 'Åpen'}
                          </Badge>
                        }
                      />
                    ))}
                  </div>
                )}
              </DashCard>
            </div>
          </div>

          {/* Nær styrkeprøven */}
          <div className="mt-3">
            <StyrkeproveNearlyCard onParticipantClick={openParticipant} />
          </div>
        </>
      )}

      <ParticipantDetailDialog participantId={detailId} open={detailOpen} onOpenChange={setDetailOpen} />
      <LeaderDeviationsSheet open={deviationsOpen} onOpenChange={setDeviationsOpen} />
      <IncidentSheet open={incidentOpen} onOpenChange={setIncidentOpen} incident={openIncident} />
      <AdminNotesPanel />
    </div>
  );
}