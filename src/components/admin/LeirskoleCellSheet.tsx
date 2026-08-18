import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { AlertTriangle, Check, Clock, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { TimeRangeField } from '@/components/ui/time-range-field';
import { useSaveLeirskoleWeekPlanCell, type LeirskoleActivityType } from '@/hooks/useLeirskole';
import { dayLabel } from '@/lib/leirskoleDates';
import { activityLine } from '@/lib/leirskoleRandomPlan';
import { cellInstances, countActivity, setActivityCount } from '@/lib/leirskoleCellInstances';

export interface CellTarget {
  date: string;
  /** formiddag | ettermiddag | kveld | postId for egne økter på ankomst/avreise. */
  session: string | null;
  rowIndex: number | null;
  postId?: string | null;
  label: string;
  /** 'normal' | 'arrival' | 'departure' — ankomst krever ikke kompetanse. */
  dayType?: 'normal' | 'arrival' | 'departure' | 'both';
}

export interface CellLeader {
  id: string;
  name: string;
  competencies: string[];
}

/** Rediger én rute: hvilke aktiviteter, og hvilken leder som tar hver av dem. */
export function LeirskoleCellSheet({
  open,
  onOpenChange,
  weekId,
  target,
  content,
  types,
  onDuty,
  allStaff,
  assignments,
  post,
  staffOptions,
  leaderInfo,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  weekId: string;
  target: CellTarget | null;
  content: string;
  types: LeirskoleActivityType[];
  onDuty: CellLeader[];
  /** Alle ledere som jobber denne uken — kan velges selv om de ikke står på vakten. */
  allStaff?: CellLeader[];
  /** Aktivitetstildelinger for denne dagen + økten. */
  assignments: { leader_id: string; activity: string }[];
  /** Egen økt (ankomst/avreise) som redigeres, hvis den finnes. */
  post?: { id: string; name: string; start_time: string; end_time: string; assignments: { staff_id: string }[] } | null;
  /** Bemanningsvalg for egne økter: leirskole_staff-id + navn. */
  staffOptions?: { staffId: string; leaderId: string; name: string }[];
  /** Timer og konflikter per leder for denne dagen — vises i nedtrekkslistene. */
  leaderInfo?: Map<string, { day: number; week: number; note?: string }>;
}) {
  const qc = useQueryClient();
  const savePlan = useSaveLeirskoleWeekPlanCell();
  /** Kort tekst som viser dagstimer + evt. konflikt bak ledernavnet. */
  const infoSuffix = (id: string) => {
    const info = leaderInfo?.get(id);
    if (!info) return '';
    return ` · ${info.day.toFixed(1)}t i dag${info.note ? ' ⚠' : ''}`;
  };
  const isSpecial = target?.dayType != null && target.dayType !== 'normal';
  /** Navn og klokkeslett kan endres for alle økter — også Økt 1–3. */
  const canEditPost = !!post?.id || isSpecial;
  /** Bare egne økter (ankomst/avreise m.m.) kan slettes helt. */
  const canDeletePost = !!post?.id && isSpecial;
  const [name, setName] = useState('');
  const [start, setStart] = useState('09:00');
  const [end, setEnd] = useState('11:00');

  useEffect(() => {
    if (!open) return;
    setName(post?.name ?? '');
    setStart((post?.start_time ?? '09:00').slice(0, 5));
    setEnd((post?.end_time ?? '11:00').slice(0, 5));
  }, [open, post?.id, post?.name, post?.start_time, post?.end_time]);

  const invalidateAll = () =>
    ['leirskole-schedule', 'leirskole-my-shifts', 'leirskole-week-plan', 'leirskole-activities'].forEach((key) =>
      qc.invalidateQueries({ queryKey: [key] }),
    );

  /** Opprett eller oppdater den egne økten (navn + tid). */
  const savePost = useMutation({
    mutationFn: async () => {
      if (!target) throw new Error('Ingen rute valgt');
      const label = name.trim() || 'Økt';
      if (post?.id) {
        const { error } = await supabase
          .from('leirskole_posts')
          .update({ name: label, start_time: start, end_time: end })
          .eq('id', post.id);
        if (error) throw error;
        return post.id;
      }
      const { data, error } = await supabase
        .from('leirskole_posts')
        .insert({
          week_id: weekId,
          date: target.date,
          name: label,
          post_type: 'other',
          start_time: start,
          end_time: end,
          required_leaders: 1,
          is_custom: true,
          is_published: true,
          sort_order: Number(start.slice(0, 2)) * 60 + Number(start.slice(3, 5)),
        })
        .select('id')
        .single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: () => {
      invalidateAll();
      toast.success('Økten er lagret');
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : 'Kunne ikke lagre økten'),
  });

  /** Legg til / fjern leder på den egne økten. */
  const toggleStaff = useMutation({
    mutationFn: async ({ staffId, on }: { staffId: string; on: boolean }) => {
      if (!post?.id) throw new Error('Lagre økten først');
      if (on) {
        const { error } = await supabase.from('leirskole_assignments').insert({
          post_id: post.id,
          staff_id: staffId,
          assigned_manually: true,
          is_locked: true,
        });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('leirskole_assignments')
          .delete()
          .eq('post_id', post.id)
          .eq('staff_id', staffId);
        if (error) throw error;
      }
    },
    onSuccess: invalidateAll,
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : 'Kunne ikke oppdatere bemanning'),
  });

  const deletePost = useMutation({
    mutationFn: async () => {
      if (!post?.id) return;
      const { error } = await supabase.from('leirskole_posts').delete().eq('id', post.id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateAll();
      onOpenChange(false);
      toast.success('Økten er slettet');
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : 'Kunne ikke slette økten'),
  });

  const lines = useMemo(
    () => content.split('\n').map((l) => l.trim()).filter(Boolean),
    [content],
  );

  /** Én rad per forekomst — samme aktivitet kan stå flere ganger. */
  const instances = useMemo(() => cellInstances(lines, types, assignments), [lines, types, assignments]);

  const countOf = (label: string) => countActivity(lines, label);

  const setLines = (next: string[]) => {
    if (!target) return;
    savePlan.mutate(
      {
        weekId,
        date: target.date,
        rowIndex: target.rowIndex,
        content: next.join('\n'),
        color: 'neutral',
        // Faste økter lagres på radnummer; bare egne økter lagres på vakt-id.
        postId: target.rowIndex != null ? undefined : target.postId ?? undefined,
      },
      { onError: () => toast.error('Kunne ikke lagre ruten') },
    );
  };

  const setLeader = useMutation({
    mutationFn: async ({
      activity,
      leaderId,
      previousLeaderId,
    }: {
      activity: string;
      leaderId: string;
      previousLeaderId?: string | null;
    }) => {
      if (!target?.session) throw new Error('Denne økten kan ikke få aktivitetsansvar');
      // Bare den forekomsten som endres frigjøres — andre ledere på samme
      // aktivitet i økten beholdes (to kan f.eks. ha Klatring).
      if (previousLeaderId) {
        const { error: delError } = await supabase
          .from('leirskole_activity_assignments')
          .delete()
          .eq('week_id', weekId)
          .eq('date', target.date)
          .eq('session', target.session)
          .eq('activity', activity)
          .eq('leader_id', previousLeaderId);
        if (delError) throw delError;
      }
      if (!leaderId) return;
      const { error: delLeader } = await supabase
        .from('leirskole_activity_assignments')
        .delete()
        .eq('week_id', weekId)
        .eq('date', target.date)
        .eq('session', target.session)
        .eq('leader_id', leaderId);
      if (delLeader) throw delLeader;
      const { error } = await supabase.from('leirskole_activity_assignments').insert({
        week_id: weekId,
        date: target.date,
        session: target.session,
        leader_id: leaderId,
        activity,
        auto_generated: false,
      });
      if (error) throw error;

      // Sørg for at lederen faktisk står på vakten, slik at timene teller med.
      const staffId = (staffOptions ?? []).find((s) => s.leaderId === leaderId)?.staffId;
      if (!staffId) return;
      let postId = post?.id ?? null;
      if (!postId) {
        const { data: found } = await supabase
          .from('leirskole_posts')
          .select('id, name')
          .eq('week_id', weekId)
          .eq('date', target.date);
        postId =
          (found ?? []).find((p) => (p.name ?? '').trim().toLowerCase() === target.label.trim().toLowerCase())?.id ??
          null;
      }
      if (!postId) return;
      const { data: existing } = await supabase
        .from('leirskole_assignments')
        .select('id')
        .eq('post_id', postId)
        .eq('staff_id', staffId)
        .maybeSingle();
      if (existing) return;
      await supabase.from('leirskole_assignments').insert({
        post_id: postId,
        staff_id: staffId,
        assigned_manually: true,
        is_locked: true,
      });
    },
    onSuccess: () => {
      ['leirskole-activities', 'leirskole-activity-history', 'leirskole-schedule', 'leirskole-my-shifts'].forEach(
        (key) => qc.invalidateQueries({ queryKey: [key] }),
      );
      toast.success('Oppdatert');
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : 'Kunne ikke lagre'),
  });

  const leaderFor = (activity: string) =>
    assignments.find((a) => a.activity === activity)?.leader_id ?? '';

  /**
   * Fjern én forekomst av en aktivitet fra økten: både lederansvaret og
   * plassen i ukeplanen slettes, slik at dag-til-dag og ukeplan er like.
   */
  const removeInstance = useMutation({
    mutationFn: async ({
      activity,
      label,
      leaderId,
      count,
      text,
    }: {
      activity: string;
      label: string;
      leaderId: string | null;
      count: number;
      text: string;
    }) => {
      if (!target) throw new Error('Ingen rute valgt');
      if (leaderId && target.session) {
        const { error } = await supabase
          .from('leirskole_activity_assignments')
          .delete()
          .eq('week_id', weekId)
          .eq('date', target.date)
          .eq('session', target.session)
          .eq('activity', activity)
          .eq('leader_id', leaderId);
        if (error) throw error;
      }
      await savePlan.mutateAsync({
        weekId,
        date: target.date,
        rowIndex: target.rowIndex,
        content: setActivityCount(lines, label, text, count - 1).join('\n'),
        color: 'neutral',
        postId: target.rowIndex != null ? undefined : target.postId ?? undefined,
      });
    },
    onSuccess: () => {
      ['leirskole-activities', 'leirskole-activity-history', 'leirskole-week-plan'].forEach((key) =>
        qc.invalidateQueries({ queryKey: [key] }),
      );
      toast.success('Aktiviteten er fjernet fra økten');
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : 'Kunne ikke fjerne aktiviteten'),
  });

  const isArrival = target?.dayType != null && target.dayType !== 'normal';

  /** Ledere som ikke står på denne vakten, men som er med i uken. */
  const offDuty = useMemo(
    () => (allStaff ?? []).filter((l) => !onDuty.some((d) => d.id === l.id)),
    [allStaff, onDuty],
  );
  const pool = useMemo(() => [...onDuty, ...offDuty], [onDuty, offDuty]);

  /** Ledere på vakt som ikke har fått en aktivitet i denne økten. */
  const withoutActivity = useMemo(
    () => onDuty.filter((l) => !assignments.some((a) => a.leader_id === l.id)),
    [onDuty, assignments],
  );

  /** Aktiviteter som ikke er i økten ennå. */
  const unusedTypes = useMemo(
    () => types.filter((t) => countOf(t.label) === 0),
    [types, lines],
  );

  /** Gi en leder en aktivitet: bruk først en ledig aktivitet i økten, ellers legg til en ny. */
  const giveActivity = useMutation({
    mutationFn: async (leaders: CellLeader[]) => {
      if (!target?.session) throw new Error('Denne økten kan ikke få aktivitetsansvar');
      // Ledige forekomster i ruten (samme aktivitet kan ha flere plasser).
      const freeInSlot = instances
        .filter((i) => !i.leaderId)
        .map((i) => types.find((t) => t.key === i.key))
        .filter((t): t is LeirskoleActivityType => !!t);
      const spare = [...unusedTypes];
      const nextLines = [...lines];
      const picks: { leaderId: string; key: string }[] = [];

      for (const leader of leaders) {
        const pickFrom = (list: LeirskoleActivityType[]) => {
          const i = list.findIndex(
            (t) => leader.competencies.length === 0 || leader.competencies.includes(t.key),
          );
          return list.splice(i >= 0 ? i : 0, 1)[0];
        };
        let type: LeirskoleActivityType | undefined;
        if (freeInSlot.length) type = pickFrom(freeInSlot);
        else if (spare.length) {
          type = pickFrom(spare);
          if (type) nextLines.push(activityLine(type));
        }
        if (!type) break;
        picks.push({ leaderId: leader.id, key: type.key });
      }
      if (!picks.length) throw new Error('Ingen ledige aktiviteter å gi');

      if (nextLines.length !== lines.length) {
        await savePlan.mutateAsync({
          weekId,
          date: target.date,
          rowIndex: target.rowIndex,
          content: nextLines.join('\n'),
          color: 'neutral',
          postId: target.rowIndex != null ? undefined : target.postId ?? undefined,
        });
      }
      for (const p of picks) {
        await setLeader.mutateAsync({ activity: p.key, leaderId: p.leaderId, previousLeaderId: null });
      }
      return picks.length;
    },
    onSuccess: (n) => toast.success(`${n} leder(e) fikk aktivitet`),
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : 'Kunne ikke gi aktivitet'),
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[85dvh] overflow-y-auto rounded-t-3xl">
        <SheetHeader className="text-left">
          <SheetTitle>
            {target ? `${dayLabel(target.date)} · ${target.label}` : ''}
          </SheetTitle>
        </SheetHeader>

        <div className="mt-3 space-y-4 pb-6">
          {canEditPost && (
            <div
              className={`space-y-3 rounded-2xl border p-3 ${
                isSpecial ? 'border-amber-500/50 bg-amber-500/10' : 'border-border/60 bg-muted/30'
              }`}
            >
              <p
                className={`flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide ${
                  isSpecial ? 'text-amber-700 dark:text-amber-200' : 'text-muted-foreground'
                }`}
              >
                <Clock className="h-3.5 w-3.5" />
                {isSpecial
                  ? `${
                      target?.dayType === 'both'
                        ? 'Avreise + ankomst'
                        : target?.dayType === 'arrival'
                          ? 'Ankomstdag'
                          : 'Avreisedag'
                    } — navn og tid`
                  : 'Navn og tid på økten'}
              </p>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Navn på økten (f.eks. Innsjekk)" />
              <TimeRangeField start={start} end={end} onStartChange={setStart} onEndChange={setEnd} />
              <div className="flex gap-2">
                <Button size="sm" className="rounded-full" onClick={() => savePost.mutate()} disabled={savePost.isPending}>
                  {post?.id ? 'Lagre endringer' : 'Opprett økt'}
                </Button>
                {canDeletePost && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="rounded-full text-destructive"
                    onClick={() => deletePost.mutate()}
                    disabled={deletePost.isPending}
                  >
                    Slett
                  </Button>
                )}
              </div>
              <div>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Ledere på økten
                </p>
                {!post?.id ? (
                  <p className="text-sm text-muted-foreground">Opprett økten først, så kan du velge ledere.</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {(staffOptions ?? []).map((s) => {
                      const on = (post.assignments ?? []).some((a) => a.staff_id === s.staffId);
                      return (
                        <button
                          key={s.staffId}
                          type="button"
                          disabled={toggleStaff.isPending}
                          onClick={() => toggleStaff.mutate({ staffId: s.staffId, on: !on })}
                          className={`flex items-center gap-1 rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                            on ? 'bg-primary text-primary-foreground' : 'bg-muted/60 text-muted-foreground hover:bg-muted'
                          }`}
                        >
                          {s.name}
                          {on && <Check className="h-3.5 w-3.5" />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Aktiviteter i økten
            </p>
            <div className="flex flex-wrap gap-1.5">
              {types.length === 0 && (
                <p className="text-sm text-muted-foreground">Ingen aktiviteter lagt inn ennå.</p>
              )}
              {types.map((t) => {
                const text = activityLine(t);
                const count = countOf(t.label);
                const removeOne = () => {
                  setLines(setActivityCount(lines, t.label, text, count - 1));
                };
                return (
                  <div
                    key={t.id}
                    className={`flex items-center gap-1 rounded-full pl-3 pr-1 py-1 text-sm font-medium transition-colors ${
                      count > 0 ? 'bg-primary text-primary-foreground' : 'bg-muted/60 text-muted-foreground'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setLines(setActivityCount(lines, t.label, text, count + 1))}
                      className="flex items-center gap-1.5"
                      title="Legg til én gang"
                    >
                      <span>{t.emoji ?? '•'}</span>
                      <span>{t.label}</span>
                      {count > 1 && <span className="text-xs opacity-90">×{count}</span>}
                      {count === 1 && <Check className="h-3.5 w-3.5" />}
                    </button>
                    {count > 0 && (
                      <button
                        type="button"
                        onClick={removeOne}
                        title="Fjern én"
                        className="rounded-full bg-background/25 px-1.5 leading-none py-0.5 text-xs"
                      >
                        −
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setLines(setActivityCount(lines, t.label, text, count + 1))}
                      title="Legg til én"
                      className={`rounded-full px-1.5 py-0.5 text-xs leading-none ${
                        count > 0 ? 'bg-background/25' : 'bg-background/60'
                      }`}
                    >
                      +
                    </button>
                  </div>
                );
              })}
            </div>
            <p className="mt-1.5 text-[11px] text-muted-foreground">
              Trykk + for å legge til aktiviteten flere ganger — da kan to ledere ha f.eks. Klatring.
            </p>
          </div>

          {target?.session && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Hvem tar hva ({onDuty.length} på vakt)
              </p>
              {instances.length === 0 && (
                <p className="text-sm text-muted-foreground">Velg aktiviteter først.</p>
              )}
              <div className="space-y-2">
                {instances.map((inst) => {
                  const t = { key: inst.key, label: inst.label, emoji: inst.emoji };
                  const current = inst.leaderId ?? '';
                  const leader = pool.find((l) => l.id === current);
                  const lacks =
                    !isArrival &&
                    !!leader &&
                    leader.competencies.length > 0 &&
                    !leader.competencies.includes(t.key);
                  return (
                    <div key={inst.id} className="rounded-2xl bg-muted/40 px-3 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold">
                          {t.emoji} {t.label}
                          {inst.total > 1 && (
                            <span className="ml-1 text-xs font-normal text-muted-foreground">
                              ({inst.slot + 1}/{inst.total})
                            </span>
                          )}
                        </span>
                        {lacks && (
                          <span className="flex items-center gap-1 text-[11px] text-destructive">
                            <AlertTriangle className="h-3 w-3" /> mangler kompetanse
                          </span>
                        )}
                        {isArrival && (
                          <span className="text-[11px] text-emerald-600 dark:text-emerald-400">Ankomst — kompetanse fri</span>
                        )}
                        <button
                          type="button"
                          title="Fjern aktiviteten fra økten"
                          disabled={removeInstance.isPending}
                          onClick={() =>
                            removeInstance.mutate({
                              activity: t.key,
                              label: inst.label,
                              leaderId: inst.leaderId,
                              count: countOf(inst.label),
                              text: activityLine({ label: inst.label, emoji: inst.emoji } as LeirskoleActivityType),
                            })
                          }
                          className="ml-auto flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-background/70 text-muted-foreground transition-colors hover:bg-destructive hover:text-destructive-foreground"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <select
                        value={current}
                        disabled={setLeader.isPending}
                        onChange={(e) =>
                          setLeader.mutate({
                            activity: t.key,
                            leaderId: e.target.value,
                            previousLeaderId: inst.leaderId,
                          })
                        }
                        className="mt-1.5 w-full rounded-xl border border-border bg-background px-2 py-2 text-sm"
                      >
                        <option value="">Ingen valgt</option>
                        {onDuty.length > 0 && (
                          <optgroup label="På vakt">
                            {onDuty.map((l) => (
                              <option key={l.id} value={l.id}>
                                {l.name}
                                {!isArrival && l.competencies.length > 0 && !l.competencies.includes(t.key)
                                  ? ' (uten kompetanse)'
                                  : ''}
                                {infoSuffix(l.id)}
                              </option>
                            ))}
                          </optgroup>
                        )}
                        {offDuty.length > 0 && (
                          <optgroup label="Andre i uken">
                            {offDuty.map((l) => (
                              <option key={l.id} value={l.id}>
                                {l.name}
                                {!isArrival && l.competencies.length > 0 && !l.competencies.includes(t.key)
                                  ? ' (uten kompetanse)'
                                  : ''}
                                {infoSuffix(l.id)}
                              </option>
                            ))}
                          </optgroup>
                        )}
                        {current && !pool.some((l) => l.id === current) && (
                          <option value={current}>Leder utenfor uken</option>
                        )}
                      </select>
                    </div>
                  );
                })}
              </div>

              {withoutActivity.length > 0 && (
                <div className="mt-3 rounded-2xl border border-dashed border-muted-foreground/40 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs text-muted-foreground">
                      {withoutActivity.length} på vakt uten aktivitet (stiplet i oversikten)
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-full"
                      disabled={giveActivity.isPending}
                      onClick={() => giveActivity.mutate(withoutActivity)}
                    >
                      Gi alle en aktivitet
                    </Button>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {withoutActivity.map((l) => (
                      <button
                        key={l.id}
                        type="button"
                        disabled={giveActivity.isPending}
                        onClick={() => giveActivity.mutate([l])}
                        className="rounded-full border border-dashed border-muted-foreground/50 px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted"
                      >
                        {l.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
