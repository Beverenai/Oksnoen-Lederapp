import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useAdminDashboard } from '@/hooks/useAdminDashboard';
import { useKitchenDutyToday } from '@/hooks/useKitchenDutyToday';
import { useTeamsEnabled } from '@/hooks/useTeamsEnabled';
import { CATEGORY_COLORS, CATEGORY_LABELS, SEVERITY_COLORS, SEVERITY_LABELS } from '@/hooks/useParticipantIncidents';
import { ParticipantDetailDialog } from '@/components/passport/ParticipantDetailDialog';
import { AdminNotesPanel } from '@/components/admin/notes/AdminNotesPanel';
import { StatTile } from '@/components/admin/dashboard/StatTile';
import { DashCard, EmptyLine } from '@/components/admin/dashboard/DashCard';
import { ParticipantChip } from '@/components/admin/dashboard/ParticipantChip';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { nb } from 'date-fns/locale';
import {
  Cake, MessageSquareWarning, StickyNote, Heart, Wrench, Mail, ClipboardList,
  ChefHat, RefreshCw, Settings,
} from 'lucide-react';

function timeAgo(iso: string) {
  return format(new Date(iso), 'd. MMM HH:mm', { locale: nb });
}

export default function AdminDashboard() {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const { data, isLoading, refetch, isRefetching } = useAdminDashboard(!!isAdmin);
  const { teamA, teamB } = useKitchenDutyToday();
  const { data: teamsEnabled } = useTeamsEnabled();
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

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
          {/* Nøkkeltall */}
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            <StatTile
              label="I leir nå"
              value={data.inCamp}
              hint={`av ${data.totalParticipants} deltagere`}
              onClick={() => navigate('/passport')}
            />
            <StatTile label="Ankommet" value={data.arrived} hint={`${data.notArrived} ikke ankommet`} onClick={() => navigate('/passport')} />
            <StatTile label="Dratt hjem" value={data.wentHome} hint="registrert hendelse" onClick={() => navigate('/hendelser')} />
            <StatTile label="Aktive ledere" value={data.activeLeaders} hint="denne perioden" onClick={() => navigate('/leaders')} />
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
                      <li key={inc.id} className="rounded-2xl bg-muted/40 p-2.5">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Badge className={CATEGORY_COLORS[inc.category]} variant="secondary">
                            {CATEGORY_LABELS[inc.category]}
                          </Badge>
                          <Badge className={SEVERITY_COLORS[inc.severity]} variant="secondary">
                            {SEVERITY_LABELS[inc.severity]}
                          </Badge>
                          <span className="ml-auto text-[11px] text-muted-foreground">{timeAgo(inc.created_at)}</span>
                        </div>
                        <p className="mt-1.5 text-sm font-medium leading-snug">{inc.title}</p>
                        {inc.participants.length > 0 && (
                          <div className="mt-1.5 flex flex-wrap gap-1.5">
                            {inc.participants.map((p) => (
                              <button
                                key={p.id}
                                type="button"
                                onClick={() => openParticipant(p.id)}
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
              <DashCard title="Notater" icon={<StickyNote className="h-4 w-4 text-amber-500" />}>
                {data.notes.length === 0 ? (
                  <EmptyLine text="Ingen notater ennå." />
                ) : (
                  <ul className="space-y-1.5">
                    {data.notes.map((n) => (
                      <li key={n.id} className="flex items-center gap-2 rounded-xl bg-muted/40 px-2.5 py-2">
                        <span className="truncate text-sm font-medium">
                          {n.is_pinned ? '📌 ' : ''}{n.title || (n.kind === 'board' ? 'Whiteboard' : 'Uten tittel')}
                        </span>
                        <span className="ml-auto shrink-0 text-[11px] text-muted-foreground">{timeAgo(n.updated_at)}</span>
                      </li>
                    ))}
                  </ul>
                )}
                <p className="mt-2 text-[11px] text-muted-foreground">Åpne notat-panelet nede til høyre for å redigere.</p>
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
        </>
      )}

      <ParticipantDetailDialog participantId={detailId} open={detailOpen} onOpenChange={setDetailOpen} />
      <AdminNotesPanel />
    </div>
  );
}