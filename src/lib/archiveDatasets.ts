import { supabase } from '@/integrations/supabase/client';

const sb = supabase as any;

export type ArchiveRow = Record<string, string | number | null>;

export interface ArchiveDataset {
  key: string;
  label: string;
  group: string;
  description?: string;
  fetch: (periodId: string) => Promise<ArchiveRow[]>;
}

export const archiveGroups = [
  { key: 'participants', label: 'Deltakere' },
  { key: 'cabin-reports', label: 'Hytterapporter' },
  { key: 'nurse', label: 'Nurse' },
  { key: 'dynga', label: 'Dynga' },
  { key: 'activities', label: 'Aktiviteter & poeng' },
  { key: 'teams', label: 'Lag' },
  { key: 'leaders', label: 'Ledere' },
  { key: 'secret-words', label: 'Hemmelige ord' },
  { key: 'bookings', label: 'Booking' },
  { key: 'sweaters', label: 'Gensere' },
  { key: 'other', label: 'Øvrig' },
] as const;

/** Generic period-scoped read. */
async function rows(table: string, select: string, periodId: string | null, order?: string): Promise<any[]> {
  let q = sb.from(table).select(select);
  if (periodId) q = q.eq('period_id', periodId);
  if (order) q = q.order(order, { ascending: true });
  const { data, error } = await q;
  if (error) throw error;
  return (data || []) as any[];
}

async function nameMap(table: string, field = 'name'): Promise<Record<string, string>> {
  const { data, error } = await sb.from(table).select(`id,${field}`);
  if (error) throw error;
  const map: Record<string, string> = {};
  (data || []).forEach((r: any) => { map[r.id] = r[field]; });
  return map;
}

/**
 * Participants are RLS-restricted to the active period, so archived periods must
 * be read through the admin/nurse-only security-definer function.
 */
async function archiveParticipants(periodId: string): Promise<any[]> {
  const { data, error } = await sb.rpc('get_archive_participants', { _period_id: periodId });
  if (error) throw error;
  return (data || []) as any[];
}

async function participantMap(periodId: string): Promise<Record<string, string>> {
  const map: Record<string, string> = {};
  (await archiveParticipants(periodId)).forEach((r: any) => { map[r.id] = r.name; });
  return map;
}

const dt = (v: string | null | undefined) =>
  v ? new Date(v).toLocaleString('nb-NO', { dateStyle: 'short', timeStyle: 'short' }) : '';
const d = (v: string | null | undefined) => (v ? new Date(v).toLocaleDateString('nb-NO') : '');
const bool = (v: boolean | null | undefined) => (v ? 'Ja' : 'Nei');

export const archiveDatasets: ArchiveDataset[] = [
  {
    key: 'participants',
    label: 'Deltakere',
    group: 'participants',
    fetch: async (periodId) => {
      const [list, cabins, teams] = await Promise.all([
        archiveParticipants(periodId),
        nameMap('cabins'),
        (async () => {
          const { data } = await sb.from('participant_teams').select('id,name').eq('period_id', periodId);
          const m: Record<string, string> = {};
          (data || []).forEach((t: any) => { m[t.id] = t.name; });
          return m;
        })(),
      ]);
      return list.map((p) => ({
        Bilde: p.image_thumb_url || p.image_url || '',
        Navn: p.name,
        Fødselsdato: d(p.birth_date),
        Hytte: cabins[p.cabin_id] ?? '',
        Rom: p.room ?? '',
        Lag: p.team_id ? teams[p.team_id] ?? '' : '',
        Ankommet: bool(p.has_arrived),
        'Antall år': p.times_attended ?? '',
        'Insj-poeng': p.insj_points ?? 0,
        'Pass skrevet': bool(p.pass_written),
        Notat: p.notes ?? '',
      }));
    },
  },
  {
    key: 'cabin-reports',
    label: 'Hytterapporter',
    group: 'cabin-reports',
    fetch: async (periodId) => {
      const [list, cabins, leaders] = await Promise.all([
        rows('cabin_reports', 'cabin_id,content,updated_at,updated_by', periodId),
        nameMap('cabins'),
        nameMap('leaders'),
      ]);
      return list.map((r) => ({
        Hytte: cabins[r.cabin_id] ?? '',
        Rapport: r.content ?? '',
        Oppdatert: dt(r.updated_at),
        Av: r.updated_by ? leaders[r.updated_by] ?? '' : '',
      }));
    },
  },
  {
    key: 'nurse-reports',
    label: 'Nurse-rapport',
    group: 'nurse',
    description: 'Alle rapportoppføringer: nurse-tekst, nurse-notater og hendelser samlet, som i Nurse-rapporten',
    fetch: async (periodId) => {
      const [reports, parts, cabins, leaders, notes, events] = await Promise.all([
        rows('nurse_reports', 'id,content,created_at,created_by', periodId, 'created_at'),
        archiveParticipants(periodId),
        nameMap('cabins'),
        nameMap('leaders'),
        rows('participant_health_notes', 'participant_id,content,created_at,created_by', periodId, 'created_at'),
        rows(
          'participant_health_events',
          'participant_id,event_type,description,created_at,created_by',
          periodId,
          'created_at',
        ),
      ]);

      const pById: Record<string, any> = {};
      parts.forEach((p: any) => { pById[p.id] = p; });
      const reportIds = reports.map((r: any) => r.id);

      let mentions: any[] = [];
      if (reportIds.length) {
        const { data, error } = await sb
          .from('nurse_report_mentions')
          .select('participant_id,mention_text,created_at')
          .in('report_id', reportIds)
          .order('created_at', { ascending: true });
        if (error) throw error;
        mentions = data || [];
      }

      const entries: { pid: string; kilde: string; tekst: string; when: string; by?: string | null }[] = [
        ...mentions
          .filter((m) => (m.mention_text || '').trim())
          .map((m) => ({ pid: m.participant_id, kilde: 'Nurse', tekst: m.mention_text, when: m.created_at, by: null })),
        ...notes
          .filter((n: any) => (n.content || '').trim())
          .map((n: any) => ({ pid: n.participant_id, kilde: 'Nurse-notat', tekst: n.content, when: n.created_at, by: n.created_by })),
        ...events.map((e: any) => ({
          pid: e.participant_id,
          kilde: 'Hendelse',
          tekst: [e.event_type, e.description].filter(Boolean).join(': '),
          when: e.created_at,
          by: e.created_by,
        })),
      ].sort((a, b) => (a.when < b.when ? 1 : -1));

      // Free-text report body (rarely used) kept as its own row at the end.
      const body = reports
        .filter((r: any) => (r.content || '').trim())
        .map((r: any) => ({
          Dato: dt(r.created_at),
          Bilde: '',
          Deltaker: '(hele rapporten)',
          Hytte: '',
          Kilde: 'Rapporttekst',
          Tekst: r.content,
          Av: r.created_by ? leaders[r.created_by] ?? '' : '',
        }));

      return [
        ...entries.map((e) => {
          const p = pById[e.pid];
          return {
            Dato: dt(e.when),
            Bilde: p ? p.image_thumb_url || p.image_url || '' : '',
            Deltaker: p?.name ?? '',
            Hytte: p?.cabin_id ? cabins[p.cabin_id] ?? '' : '',
            Kilde: e.kilde,
            Tekst: e.tekst ?? '',
            Av: e.by ? leaders[e.by] ?? '' : '',
          };
        }),
        ...body,
      ];
    },
  },
  {
    key: 'health-notes',
    label: 'Helsenotater',
    group: 'nurse',
    fetch: async (periodId) => {
      const [list, parts, leaders] = await Promise.all([
        rows('participant_health_notes', 'participant_id,content,created_at,created_by', periodId, 'created_at'),
        participantMap(periodId),
        nameMap('leaders'),
      ]);
      return list.map((r) => ({
        Deltaker: parts[r.participant_id] ?? '',
        Notat: r.content ?? '',
        Dato: dt(r.created_at),
        Av: r.created_by ? leaders[r.created_by] ?? '' : '',
      }));
    },
  },
  {
    key: 'health-info',
    label: 'Viktig helseinfo',
    group: 'nurse',
    fetch: async (periodId) => {
      const [list, parts] = await Promise.all([
        rows('participant_health_info', 'participant_id,info,updated_at', periodId),
        participantMap(periodId),
      ]);
      return list.map((r) => ({
        Deltaker: parts[r.participant_id] ?? '',
        Info: r.info ?? '',
        Oppdatert: dt(r.updated_at),
      }));
    },
  },
  {
    key: 'health-events',
    label: 'Helsehendelser',
    group: 'nurse',
    fetch: async (periodId) => {
      const [list, parts, leaders] = await Promise.all([
        rows('participant_health_events', 'participant_id,event_type,description,severity,created_at,created_by', periodId, 'created_at'),
        participantMap(periodId),
        nameMap('leaders'),
      ]);
      return list.map((r) => ({
        Deltaker: parts[r.participant_id] ?? '',
        Type: r.event_type ?? '',
        Beskrivelse: r.description ?? '',
        Alvorlighet: r.severity ?? '',
        Dato: dt(r.created_at),
        Av: r.created_by ? leaders[r.created_by] ?? '' : '',
      }));
    },
  },
  {
    key: 'dynga-cards',
    label: 'Dynga-kort',
    group: 'dynga',
    fetch: async (periodId) => {
      const [cards, cols, parts] = await Promise.all([
        rows('dynga_cards', 'id,participant_id,column_id,created_at', periodId, 'created_at'),
        (async () => {
          const { data } = await sb.from('dynga_columns').select('id,title').eq('period_id', periodId);
          const m: Record<string, string> = {};
          (data || []).forEach((c: any) => { m[c.id] = c.title; });
          return m;
        })(),
        participantMap(periodId),
      ]);
      const ids = cards.map((c) => c.id);
      let counts: Record<string, number> = {};
      if (ids.length) {
        const { data } = await sb.from('dynga_comments').select('card_id').in('card_id', ids);
        (data || []).forEach((c: any) => { counts[c.card_id] = (counts[c.card_id] || 0) + 1; });
      }
      return cards.map((c) => ({
        Deltaker: parts[c.participant_id] ?? '',
        Kolonne: cols[c.column_id] ?? '',
        Kommentarer: counts[c.id] || 0,
        Opprettet: dt(c.created_at),
      }));
    },
  },
  {
    key: 'dynga-comments',
    label: 'Dynga-kommentarer',
    group: 'dynga',
    fetch: async (periodId) => {
      const [cards, cols, parts, leaders] = await Promise.all([
        rows('dynga_cards', 'id,participant_id,column_id', periodId),
        (async () => {
          const { data } = await sb.from('dynga_columns').select('id,title').eq('period_id', periodId);
          const m: Record<string, string> = {};
          (data || []).forEach((c: any) => { m[c.id] = c.title; });
          return m;
        })(),
        participantMap(periodId),
        nameMap('leaders'),
      ]);
      const byId: Record<string, any> = {};
      cards.forEach((c) => { byId[c.id] = c; });
      const ids = cards.map((c) => c.id);
      if (!ids.length) return [];
      const { data, error } = await sb
        .from('dynga_comments')
        .select('card_id,leader_id,body,created_at')
        .in('card_id', ids)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data || []).map((c: any) => {
        const card = byId[c.card_id];
        return {
          Deltaker: card ? parts[card.participant_id] ?? '' : '',
          Kolonne: card ? cols[card.column_id] ?? '' : '',
          Kommentar: c.body ?? '',
          Leder: c.leader_id ? leaders[c.leader_id] ?? '' : '',
          Dato: dt(c.created_at),
        };
      });
    },
  },
  {
    key: 'activities',
    label: 'Aktiviteter',
    group: 'activities',
    fetch: async (periodId) => {
      const [list, parts, leaders] = await Promise.all([
        rows('participant_activities', 'participant_id,activity,completed_at,registered_by', periodId, 'completed_at'),
        participantMap(periodId),
        nameMap('leaders'),
      ]);
      return list.map((r) => ({
        Deltaker: parts[r.participant_id] ?? '',
        Aktivitet: r.activity ?? '',
        Registrert: dt(r.completed_at),
        Av: r.registered_by ? leaders[r.registered_by] ?? '' : '',
      }));
    },
  },
  {
    key: 'bonus-points',
    label: 'Ekstra poeng',
    group: 'activities',
    fetch: async (periodId) => {
      const [list, parts, leaders] = await Promise.all([
        rows('participant_bonus_points', 'participant_id,activity_label,variant,points,awarded_by,created_at', periodId, 'created_at'),
        participantMap(periodId),
        nameMap('leaders'),
      ]);
      return list.map((r) => ({
        Deltaker: parts[r.participant_id] ?? '',
        Aktivitet: r.activity_label ?? '',
        Variant: r.variant ?? '',
        Poeng: r.points ?? 0,
        Gitt_av: r.awarded_by ? leaders[r.awarded_by] ?? '' : '',
        Dato: dt(r.created_at),
      }));
    },
  },
  {
    key: 'teams',
    label: 'Lag',
    group: 'teams',
    fetch: async (periodId) => {
      const [teams, parts, bonus] = await Promise.all([
        rows('participant_teams', 'id,slot,name,color,bonus_points', periodId, 'slot'),
        archiveParticipants(periodId),
        rows('participant_bonus_points', 'team_id,points', periodId),
      ]);
      return teams.map((t) => {
        const members = parts.filter((p) => p.team_id === t.id);
        const bonusSum = bonus.filter((b) => b.team_id === t.id).reduce((a, b) => a + (b.points || 0), 0);
        const insjSum = members.reduce((a, m) => a + (m.insj_points || 0), 0);
        return {
          Lag: t.name,
          Nr: t.slot,
          Farge: t.color,
          Deltakere: members.length,
          'Insj-poeng': insjSum,
          'Ekstra poeng': bonusSum,
          'Manuelle poeng': t.bonus_points ?? 0,
          Totalt: insjSum + bonusSum + (t.bonus_points ?? 0),
        };
      });
    },
  },
  {
    key: 'team-members',
    label: 'Lagmedlemmer',
    group: 'teams',
    fetch: async (periodId) => {
      const [teams, parts] = await Promise.all([
        rows('participant_teams', 'id,slot,name', periodId, 'slot'),
        archiveParticipants(periodId),
      ]);
      const m: Record<string, string> = {};
      teams.forEach((t) => { m[t.id] = t.name; });
      return parts.map((p) => ({
        Deltaker: p.name,
        Lag: p.team_id ? m[p.team_id] ?? '' : 'Ingen',
        'Insj-poeng': p.insj_points ?? 0,
      }));
    },
  },
  {
    key: 'secret-words',
    label: 'Tildelte ord',
    group: 'secret-words',
    fetch: async (periodId) => {
      const [list, parts] = await Promise.all([
        rows('secret_word_assignments', 'participant_id,word,slot,pair_id', periodId),
        participantMap(periodId),
      ]);
      return list.map((r) => ({
        Deltaker: parts[r.participant_id] ?? '',
        Ord: r.word,
        Slot: r.slot,
        Par: r.pair_id,
      }));
    },
  },
  {
    key: 'period-leaders',
    label: 'Ledere i perioden',
    group: 'leaders',
    description: 'Låst kopi av hvilke ledere som var med, med hytte, lag og roller',
    fetch: async (periodId) => {
      const list = await rows(
        'period_leader_snapshots',
        'leader_name,gender,is_active,is_external,cabins,teams,roles,snapshot_at',
        periodId,
        'leader_name',
      );
      return list.map((l) => ({
        Leder: l.leader_name,
        Hytte: l.cabins ?? '',
        Lag: l.teams ?? '',
        Roller: l.roles ?? '',
        Kjønn: l.gender === 'male' ? 'Mann' : l.gender === 'female' ? 'Kvinne' : '',
        Aktiv: bool(l.is_active),
        Ekstern: bool(l.is_external),
        Lagret: dt(l.snapshot_at),
      }));
    },
  },
  {
    key: 'period-cabin-leaders',
    label: 'Hytteledere',
    group: 'leaders',
    description: 'Hvem som var ledere på hvilken hytte i perioden',
    fetch: async (periodId) => {
      const list = await rows('period_leader_snapshots', 'leader_name,cabins', periodId, 'leader_name');
      const byCabin: Record<string, string[]> = {};
      list.forEach((l) => {
        (l.cabins || '')
          .split(',')
          .map((c: string) => c.trim())
          .filter(Boolean)
          .forEach((c: string) => {
            byCabin[c] = [...(byCabin[c] || []), l.leader_name];
          });
      });
      return Object.keys(byCabin)
        .sort((a, b) => a.localeCompare(b, 'nb'))
        .map((cabin) => ({
          Hytte: cabin,
          Ledere: byCabin[cabin].join(', '),
          Antall: byCabin[cabin].length,
        }));
    },
  },
  {
    key: 'secret-words-list',
    label: 'Tildelte ord (liste)',
    group: 'secret-words',
    fetch: async (periodId) => {
      const [list, parts] = await Promise.all([
        rows('secret_word_assignments', 'participant_id,word,slot,pair_id', periodId),
        participantMap(periodId),
      ]);
      return list.map((r) => ({
        Deltaker: parts[r.participant_id] ?? '',
        Ord: r.word,
        Slot: r.slot,
        Par: r.pair_id,
      }));
    },
  },
  {
    key: 'secret-word-matches',
    label: 'Matcher',
    group: 'secret-words',
    fetch: async (periodId) => {
      const [list, parts, leaders] = await Promise.all([
        rows('secret_word_matches', 'participant_a_id,participant_b_id,matched_by,matched_at', periodId, 'matched_at'),
        participantMap(periodId),
        nameMap('leaders'),
      ]);
      return list.map((r) => ({
        'Deltaker A': parts[r.participant_a_id] ?? '',
        'Deltaker B': parts[r.participant_b_id] ?? '',
        Godkjent_av: r.matched_by ? leaders[r.matched_by] ?? '' : '',
        Dato: dt(r.matched_at),
      }));
    },
  },
  {
    key: 'bookings',
    label: 'Booking-info',
    group: 'bookings',
    fetch: async (periodId) => {
      const list = await rows(
        'participant_bookings',
        'first_name,last_name,birth_date,gender,guardian_first_name,guardian_last_name,guardian_phone,guardian_email,address,postal_code,postal_city,sweater_size,kiosk_money,times_attended,friends,notes_info,payment_status,price,paid_date,status',
        periodId,
        'last_name',
      );
      return list.map((b) => ({
        Fornavn: b.first_name ?? '',
        Etternavn: b.last_name ?? '',
        Fødselsdato: d(b.birth_date),
        Kjønn: b.gender ?? '',
        Foresatt: `${b.guardian_first_name ?? ''} ${b.guardian_last_name ?? ''}`.trim(),
        Mobil: b.guardian_phone ?? '',
        'E-post': b.guardian_email ?? '',
        Adresse: `${b.address ?? ''} ${b.postal_code ?? ''} ${b.postal_city ?? ''}`.trim(),
        Genser: b.sweater_size ?? '',
        Kioskpenger: b.kiosk_money ?? '',
        'Antall år': b.times_attended ?? '',
        Venner: b.friends ?? '',
        Info: b.notes_info ?? '',
        Betaling: b.payment_status ?? '',
        Pris: b.price ?? '',
        Betalt: d(b.paid_date),
        Status: b.status ?? '',
      }));
    },
  },
  {
    key: 'sweaters',
    label: 'Gensere',
    group: 'sweaters',
    fetch: async (periodId) => {
      const [list, parts] = await Promise.all([
        rows('participant_sweaters', 'participant_id,preordered_size,picked_up,picked_up_size,picked_up_at,bought_on_camp,bought_size', periodId),
        participantMap(periodId),
      ]);
      return list.map((s) => ({
        Deltaker: parts[s.participant_id] ?? '',
        Forhåndsbestilt: s.preordered_size ?? '',
        Hentet: bool(s.picked_up),
        'Hentet str.': s.picked_up_size ?? '',
        'Hentet dato': dt(s.picked_up_at),
        'Kjøpt på leir': bool(s.bought_on_camp),
        'Kjøpt str.': s.bought_size ?? '',
      }));
    },
  },
  {
    key: 'incidents',
    label: 'Hendelser',
    group: 'other',
    fetch: async (periodId) => {
      const [list, leaders, parts] = await Promise.all([
        rows('participant_incidents', 'id,leader_id,title,description,category,severity,created_at', periodId, 'created_at'),
        nameMap('leaders'),
        participantMap(periodId),
      ]);
      const ids = list.map((i) => i.id);
      const involved: Record<string, string[]> = {};
      if (ids.length) {
        const { data } = await sb
          .from('participant_incident_participants')
          .select('incident_id,participant_id')
          .in('incident_id', ids);
        (data || []).forEach((r: any) => {
          involved[r.incident_id] = [...(involved[r.incident_id] || []), parts[r.participant_id] ?? ''];
        });
      }
      return list.map((i) => ({
        Tittel: i.title,
        Deltakere: (involved[i.id] || []).join(', '),
        Kategori: i.category ?? '',
        Alvorlighet: i.severity ?? '',
        Beskrivelse: i.description ?? '',
        Leder: leaders[i.leader_id] ?? '',
        Dato: dt(i.created_at),
      }));
    },
  },
  {
    key: 'fix-tasks',
    label: 'Fix-oppgaver',
    group: 'other',
    fetch: async (periodId) => {
      const [list, leaders] = await Promise.all([
        rows('fix_tasks', 'title,description,location,what_to_fix,status,created_by,created_at,fixed_at,fixed_by', periodId, 'created_at'),
        nameMap('leaders'),
      ]);
      return list.map((t) => ({
        Tittel: t.title,
        Sted: t.location ?? '',
        'Hva skal fikses': t.what_to_fix ?? '',
        Beskrivelse: t.description ?? '',
        Status: t.status,
        Meldt_av: t.created_by ? leaders[t.created_by] ?? '' : '',
        Meldt: dt(t.created_at),
        Fikset: dt(t.fixed_at),
        Fikset_av: t.fixed_by ? leaders[t.fixed_by] ?? '' : '',
      }));
    },
  },
  {
    key: 'room-swaps',
    label: 'Rombytter',
    group: 'other',
    fetch: async (periodId) => {
      const [list, parts, cabins, leaders] = await Promise.all([
        rows('room_swaps', 'participant_id,from_cabin_id,from_room,to_cabin_id,to_room,status,reason,created_at,approved_by', periodId, 'created_at'),
        participantMap(periodId),
        nameMap('cabins'),
        nameMap('leaders'),
      ]);
      return list.map((s) => ({
        Deltaker: parts[s.participant_id] ?? '',
        Fra: `${s.from_cabin_id ? cabins[s.from_cabin_id] ?? '' : ''} ${s.from_room ?? ''}`.trim(),
        Til: `${cabins[s.to_cabin_id] ?? ''} ${s.to_room ?? ''}`.trim(),
        Status: s.status,
        Årsak: s.reason ?? '',
        Dato: dt(s.created_at),
        Godkjent_av: s.approved_by ? leaders[s.approved_by] ?? '' : '',
      }));
    },
  },
  {
    key: 'rope-controls',
    label: 'Tau-kontroller',
    group: 'other',
    fetch: async (periodId) => {
      const [list, leaders] = await Promise.all([
        rows('rope_controls', 'leader_id,activity,rope_status,harness_status,carabiner_status,helmet_status,rope_comment,harness_comment,carabiner_comment,helmet_comment,created_at', periodId, 'created_at'),
        nameMap('leaders'),
      ]);
      return list.map((r) => ({
        Aktivitet: r.activity,
        Leder: leaders[r.leader_id] ?? '',
        Tau: r.rope_status ?? '',
        Sele: r.harness_status ?? '',
        Karabin: r.carabiner_status ?? '',
        Hjelm: r.helmet_status ?? '',
        Kommentarer: [r.rope_comment, r.harness_comment, r.carabiner_comment, r.helmet_comment].filter(Boolean).join(' | '),
        Dato: dt(r.created_at),
      }));
    },
  },
  {
    key: 'gjenglemt',
    label: 'Gjenglemt',
    group: 'other',
    fetch: async (periodId) => {
      const list = await rows('gjenglemt_items', 'item_number,garment_type,color,owner_name,comment,status,bag_label,created_at', periodId, 'item_number');
      return list.map((g) => ({
        Nr: g.item_number ?? '',
        Type: g.garment_type ?? '',
        Farge: g.color ?? '',
        Eier: g.owner_name ?? '',
        Kommentar: g.comment ?? '',
        Status: g.status,
        Sekk: g.bag_label ?? '',
        Lagt_inn: dt(g.created_at),
      }));
    },
  },
  {
    key: 'announcements',
    label: 'Kunngjøringer',
    group: 'other',
    fetch: async (periodId) => {
      const list = await rows('announcements', 'title,content,target_group,is_active,created_at', periodId, 'created_at');
      return list.map((a) => ({
        Tittel: a.title,
        Innhold: a.content ?? '',
        Målgruppe: a.target_group ?? '',
        Aktiv: bool(a.is_active),
        Dato: dt(a.created_at),
      }));
    },
  },
  {
    key: 'stories',
    label: 'Historier',
    group: 'other',
    fetch: async (periodId) => {
      const list = await rows('stories', 'title,content,is_active,created_at', periodId, 'created_at');
      return list.map((s) => ({
        Tittel: s.title,
        Innhold: s.content ?? '',
        Aktiv: bool(s.is_active),
        Dato: dt(s.created_at),
      }));
    },
  },
];

export const datasetsForGroup = (group: string) => archiveDatasets.filter((d) => d.group === group);
