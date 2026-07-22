// Shared helpers for enriching pass generation with team/insj/bonus context.
// Used by generate-pass and generate-all-passes.

export interface TeamCtx {
  name: string;
  rank: number;
  total: number;
  teamsCount: number;
}

export interface PassContext {
  teamsEnabled: boolean;
  teamByParticipant: Map<string, TeamCtx | null>;
  insjByParticipant: Map<string, number>;
  extrasByParticipant: Map<string, string[]>;
}

export async function loadPassContext(supabase: any, periodId: string): Promise<PassContext> {
  const empty: PassContext = {
    teamsEnabled: false,
    teamByParticipant: new Map(),
    insjByParticipant: new Map(),
    extrasByParticipant: new Map(),
  };

  const { data: cfg } = await supabase
    .from('app_config')
    .select('value')
    .eq('key', 'teams_enabled')
    .maybeSingle();
  const teamsEnabled = cfg?.value === 'true';

  const [partsRes, teamsRes, bonusesRes] = await Promise.all([
    supabase.from('participants').select('id, team_id, insj_points').eq('period_id', periodId),
    supabase.from('participant_teams').select('id, name, bonus_points').eq('period_id', periodId),
    supabase.from('participant_bonus_points').select('participant_id, points, team_id, variant, activity_label').eq('period_id', periodId),
  ]);
  const parts = partsRes.data || [];
  const teams = teamsRes.data || [];
  const bonuses = bonusesRes.data || [];

  const teamById = new Map<string, any>();
  teams.forEach((t: any) => teamById.set(t.id, t));

  const insjByParticipant = new Map<string, number>();
  const teamOfParticipant = new Map<string, string | null>();
  parts.forEach((p: any) => {
    insjByParticipant.set(p.id, p.insj_points ?? 0);
    teamOfParticipant.set(p.id, p.team_id ?? null);
  });

  // Extras (variant='extra') per participant — used as prose bragder.
  const extrasByParticipant = new Map<string, string[]>();
  bonuses.forEach((b: any) => {
    if (b.variant !== 'extra' || !b.activity_label) return;
    const list = extrasByParticipant.get(b.participant_id) || [];
    list.push(b.activity_label);
    extrasByParticipant.set(b.participant_id, list);
  });

  // Compute team totals: activities + insj (from participants.insj_points) + bonuses + team.bonus_points.
  const totals = new Map<string, number>();
  const bump = (t: string, n: number) => totals.set(t, (totals.get(t) || 0) + n);
  teams.forEach((t: any) => totals.set(t.id, t.bonus_points ?? 0));
  parts.forEach((p: any) => {
    if (p.team_id) bump(p.team_id, p.insj_points ?? 0);
  });
  bonuses.forEach((b: any) => {
    const t = b.team_id ?? teamOfParticipant.get(b.participant_id);
    if (t) bump(t, b.points ?? 0);
  });
  const participantIds = parts.map((p: any) => p.id);
  if (participantIds.length > 0) {
    const { data: acts } = await supabase
      .from('participant_activities')
      .select('participant_id')
      .in('participant_id', participantIds);
    (acts || []).forEach((a: any) => {
      const t = teamOfParticipant.get(a.participant_id);
      if (t) bump(t, 1);
    });
  }

  const ranking = teams
    .map((t: any) => ({ id: t.id, name: t.name, total: totals.get(t.id) || 0 }))
    .sort((a: any, b: any) => b.total - a.total);
  const rankById = new Map<string, number>();
  ranking.forEach((r: any, i: number) => rankById.set(r.id, i + 1));

  const teamByParticipant = new Map<string, TeamCtx | null>();
  parts.forEach((p: any) => {
    if (!p.team_id) { teamByParticipant.set(p.id, null); return; }
    const t = teamById.get(p.team_id);
    if (!t) { teamByParticipant.set(p.id, null); return; }
    teamByParticipant.set(p.id, {
      name: t.name,
      rank: rankById.get(p.team_id) || 0,
      total: totals.get(p.team_id) || 0,
      teamsCount: teams.length,
    });
  });

  return { teamsEnabled, teamByParticipant, insjByParticipant, extrasByParticipant };
}

/**
 * Build the extra prompt lines to append to the user prompt.
 * Only emits content if teams are enabled AND the participant is on a team.
 * - Insjpoeng only surfaced if > 8.
 * - Extras always listed if any.
 * - Team name always mentioned; rank only if top 3.
 */
export function buildTeamPromptLines(ctx: PassContext, participantId: string): string {
  if (!ctx.teamsEnabled) return '';
  const team = ctx.teamByParticipant.get(participantId);
  if (!team) return '';
  const lines: string[] = [];
  lines.push(`Stamme (lag): ${team.name}`);
  if (team.rank === 1) lines.push(`Stammen ${team.name} ligger på FØRSTEPLASS i lag-konkurransen — gratuler kort.`);
  else if (team.rank === 2) lines.push(`Stammen ${team.name} ligger på 2. plass i lag-konkurransen.`);
  else if (team.rank === 3) lines.push(`Stammen ${team.name} ligger på 3. plass i lag-konkurransen.`);

  const insj = ctx.insjByParticipant.get(participantId) ?? 0;
  if (insj > 8) lines.push(`Insjpoeng: ${insj} — deltakeren har knakt mange hemmelige ord, nevn dette som en prestasjon.`);

  const extras = ctx.extrasByParticipant.get(participantId) || [];
  if (extras.length > 0) {
    const unique = Array.from(new Set(extras));
    lines.push(`Ekstra bragder (+2 poeng-varianter, fremhev gjerne 1–2 av disse naturlig): ${unique.join(', ')}`);
  }
  return lines.join('\n');
}