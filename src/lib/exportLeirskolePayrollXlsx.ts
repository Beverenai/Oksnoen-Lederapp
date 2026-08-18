/**
 * Eksport av leirskoletimer for regnskap og lønn.
 *
 * Én uke  → arkene «Sammendrag» (per leder) og «Detaljer» (per vakt).
 * Sesong  → arket «Totalt» (per leder på tvers av uker) + ett ark per uke.
 *
 * Egne økter (badevakt mellom øktene osv.) er med i alle tall, og kjøkkenvakt
 * teller som en full dag.
 */
import ExcelJS from 'exceljs';
import { supabase } from '@/integrations/supabase/client';
import { KITCHEN_DAY_HOURS } from '@/lib/leirskoleDayHours';

export interface PayrollWeekInput {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
}

interface Row {
  leaderId: string;
  name: string;
  days: Set<string>;
  sessions: number;
  hours: number;
  kitchenHours: number;
  nightHours: number;
  customHours: number;
}

interface DetailRow {
  weekName: string;
  date: string;
  name: string;
  time: string;
  hours: number;
  leader: string;
  activity: string;
  note: string;
}

const hhmm = (t?: string | null) => String(t ?? '').slice(0, 5);

/** Samler timer per leder for én uke. */
async function collectWeek(week: PayrollWeekInput) {
  const [{ data: staff }, { data: posts }, { data: kitchen }, { data: activities }, { data: types }] =
    await Promise.all([
      supabase
        .from('leirskole_staff')
        .select('id, leader:leaders(id, name)')
        .eq('week_id', week.id),
      supabase
        .from('leirskole_posts')
        .select(
          'id, date, name, start_time, end_time, duration_hours, is_night, is_custom, assignments:leirskole_assignments(staff_id, note)',
        )
        .eq('week_id', week.id)
        .order('date')
        .order('start_time'),
      supabase.from('leirskole_kitchen_days').select('staff_id, date').eq('week_id', week.id),
      supabase
        .from('leirskole_activity_assignments')
        .select('date, session, leader_id, activity')
        .eq('week_id', week.id),
      supabase.from('leirskole_activity_types').select('key, label'),
    ]);

  const leaderByStaff = new Map<string, { id: string; name: string }>();
  (staff ?? []).forEach((s) => {
    const l = s.leader as { id: string; name: string } | null;
    if (l) leaderByStaff.set(s.id, l);
  });

  const activityLabel = new Map((types ?? []).map((t) => [t.key, t.label]));
  /** `${date}|${leaderId}` → aktiviteter lederen har den dagen. */
  const actByLeaderDay = new Map<string, string[]>();
  (activities ?? []).forEach((a) => {
    const key = `${a.date}|${a.leader_id}`;
    actByLeaderDay.set(key, [...(actByLeaderDay.get(key) ?? []), activityLabel.get(a.activity) ?? a.activity]);
  });

  const rows = new Map<string, Row>();
  const row = (leaderId: string, name: string) => {
    const found = rows.get(leaderId);
    if (found) return found;
    const created: Row = {
      leaderId,
      name,
      days: new Set(),
      sessions: 0,
      hours: 0,
      kitchenHours: 0,
      nightHours: 0,
      customHours: 0,
    };
    rows.set(leaderId, created);
    return created;
  };

  const details: DetailRow[] = [];

  (posts ?? []).forEach((p) => {
    const hours = Number(p.duration_hours ?? 0);
    ((p.assignments ?? []) as { staff_id: string; note: string | null }[]).forEach((a) => {
      const leader = leaderByStaff.get(a.staff_id);
      if (!leader) return;
      const r = row(leader.id, leader.name);
      r.days.add(String(p.date));
      r.sessions += 1;
      r.hours += hours;
      if (p.is_night) r.nightHours += hours;
      if (p.is_custom) r.customHours += hours;
      details.push({
        weekName: week.name,
        date: String(p.date),
        name: p.name ?? 'Vakt',
        time: `${hhmm(p.start_time)}–${hhmm(p.end_time)}`,
        hours,
        leader: leader.name,
        activity: (actByLeaderDay.get(`${p.date}|${leader.id}`) ?? []).join(', '),
        note: a.note ?? '',
      });
    });
  });

  (kitchen ?? []).forEach((k) => {
    const leader = leaderByStaff.get(k.staff_id);
    if (!leader) return;
    const r = row(leader.id, leader.name);
    r.days.add(String(k.date));
    r.sessions += 1;
    r.hours += KITCHEN_DAY_HOURS;
    r.kitchenHours += KITCHEN_DAY_HOURS;
    details.push({
      weekName: week.name,
      date: String(k.date),
      name: 'Kjøkken (hele dagen)',
      time: '—',
      hours: KITCHEN_DAY_HOURS,
      leader: leader.name,
      activity: 'Kjøkken',
      note: '',
    });
  });

  const list = [...rows.values()].sort((a, b) => a.name.localeCompare(b.name, 'nb'));
  details.sort((a, b) => (a.date === b.date ? a.time.localeCompare(b.time) : a.date.localeCompare(b.date)));
  return { week, rows: list, details };
}

const SUMMARY_HEADERS = [
  'Leder',
  'Dager',
  'Økter',
  'Timer',
  'Herav kjøkken',
  'Herav natt',
  'Herav egne økter',
];

function writeSummary(ws: ExcelJS.Worksheet, title: string, rows: Row[]) {
  ws.properties.defaultColWidth = 16;
  ws.getColumn(1).width = 26;
  ws.mergeCells(1, 1, 1, SUMMARY_HEADERS.length);
  const t = ws.getCell(1, 1);
  t.value = title;
  t.font = { name: 'Arial', bold: true, size: 14 };

  const head = ws.getRow(3);
  SUMMARY_HEADERS.forEach((h, i) => {
    const c = head.getCell(i + 1);
    c.value = h;
    c.font = { name: 'Arial', bold: true };
    c.border = { bottom: { style: 'thin' } };
  });

  rows.forEach((r, i) => {
    const row = ws.getRow(4 + i);
    row.getCell(1).value = r.name;
    row.getCell(2).value = r.days.size;
    row.getCell(3).value = r.sessions;
    row.getCell(4).value = Number(r.hours.toFixed(2));
    row.getCell(5).value = Number(r.kitchenHours.toFixed(2));
    row.getCell(6).value = Number(r.nightHours.toFixed(2));
    row.getCell(7).value = Number(r.customHours.toFixed(2));
    for (let c = 2; c <= SUMMARY_HEADERS.length; c++) row.getCell(c).numFmt = '0.00;(0.00);-';
    row.getCell(2).numFmt = '0;(0);-';
    row.getCell(3).numFmt = '0;(0);-';
  });

  const sumRow = ws.getRow(4 + rows.length + 1);
  sumRow.getCell(1).value = 'Sum';
  sumRow.getCell(1).font = { name: 'Arial', bold: true };
  const first = 4;
  const last = 4 + rows.length - 1;
  if (rows.length) {
    for (let c = 2; c <= SUMMARY_HEADERS.length; c++) {
      const cell = sumRow.getCell(c);
      const col = ws.getColumn(c).letter;
      cell.value = { formula: `SUM(${col}${first}:${col}${last})` };
      cell.font = { name: 'Arial', bold: true };
      cell.numFmt = c <= 3 ? '0;(0);-' : '0.00;(0.00);-';
    }
  }
}

const DETAIL_HEADERS = ['Uke', 'Dato', 'Økt', 'Klokkeslett', 'Timer', 'Leder', 'Aktivitet', 'Beskjed'];

function writeDetails(ws: ExcelJS.Worksheet, rows: DetailRow[]) {
  ws.properties.defaultColWidth = 16;
  ws.getColumn(8).width = 34;
  const head = ws.getRow(1);
  DETAIL_HEADERS.forEach((h, i) => {
    const c = head.getCell(i + 1);
    c.value = h;
    c.font = { name: 'Arial', bold: true };
    c.border = { bottom: { style: 'thin' } };
  });
  rows.forEach((r, i) => {
    const row = ws.getRow(2 + i);
    row.getCell(1).value = r.weekName;
    row.getCell(2).value = r.date;
    row.getCell(3).value = r.name;
    row.getCell(4).value = r.time;
    row.getCell(5).value = Number(r.hours.toFixed(2));
    row.getCell(5).numFmt = '0.00;(0.00);-';
    row.getCell(6).value = r.leader;
    row.getCell(7).value = r.activity;
    row.getCell(8).value = r.note;
  });
}

/** Slår sammen flere uker til én rad per leder. */
function mergeRows(all: Row[][]): Row[] {
  const map = new Map<string, Row>();
  all.flat().forEach((r) => {
    const found = map.get(r.leaderId);
    if (!found) {
      map.set(r.leaderId, { ...r, days: new Set(r.days) });
      return;
    }
    r.days.forEach((d) => found.days.add(d));
    found.sessions += r.sessions;
    found.hours += r.hours;
    found.kitchenHours += r.kitchenHours;
    found.nightHours += r.nightHours;
    found.customHours += r.customHours;
  });
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, 'nb'));
}

const safeSheetName = (name: string) => name.replace(/[\\/*?:[\]]/g, ' ').slice(0, 28) || 'Uke';

async function download(wb: ExcelJS.Workbook, filename: string) {
  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Eksporter timer for én uke (regnskap/lønn). */
export async function exportLeirskoleWeekPayroll(week: PayrollWeekInput) {
  const { rows, details } = await collectWeek(week);
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Øksnøen LederApp';
  wb.created = new Date();
  writeSummary(
    wb.addWorksheet('Sammendrag'),
    `Leirskole — ${week.name} (${week.start_date} – ${week.end_date})`,
    rows,
  );
  writeDetails(wb.addWorksheet('Detaljer'), details);
  await download(wb, `leirskole-timer-${safeSheetName(week.name).trim().replace(/\s+/g, '-').toLowerCase()}.xlsx`);
  return { leaders: rows.length, shifts: details.length };
}

/** Eksporter timer for alle uker (hele sesongen). */
export async function exportLeirskoleSeasonPayroll(weeks: PayrollWeekInput[]) {
  const collected = [];
  for (const w of weeks) collected.push(await collectWeek(w));

  const wb = new ExcelJS.Workbook();
  wb.creator = 'Øksnøen LederApp';
  wb.created = new Date();
  writeSummary(
    wb.addWorksheet('Totalt'),
    `Leirskole — alle uker (${weeks.length} uker)`,
    mergeRows(collected.map((c) => c.rows)),
  );
  collected.forEach((c) => {
    writeSummary(
      wb.addWorksheet(safeSheetName(c.week.name)),
      `${c.week.name} (${c.week.start_date} – ${c.week.end_date})`,
      c.rows,
    );
  });
  writeDetails(wb.addWorksheet('Detaljer'), collected.flatMap((c) => c.details));
  await download(wb, `leirskole-timer-sesong.xlsx`);
  return { weeks: weeks.length, leaders: mergeRows(collected.map((c) => c.rows)).length };
}
