import ExcelJS from 'exceljs';
import type { Tables } from '@/integrations/supabase/types';
import { leaderTeamKey } from '@/lib/teamUtils';

type Schedule = Tables<'shift_schedules'>;
type Assignment = Tables<'shift_assignments'>;
type ShiftType = Tables<'shift_types'>;
type Leader = Tables<'leaders'>;

type Team = 'team1' | 'team2' | 'team1f' | 'team2f';

const TEAM_FILL: Record<Team, string> = {
  team1: 'FFFF0300',  // red    #ff0300
  team2: 'FFFFC001',  // orange #ffc001
  team1f: 'FFFFFE01', // yellow #fffe01
  team2f: 'FF0070C0', // blue   #0070c0
};
const TEAM_LABEL: Record<Team, string> = {
  team1: 'Team 1', team2: 'Team 2', team1f: 'Team 1F', team2f: 'Team 2F',
};

const NORMAL_SLUGS = [
  'morgenvakt', 'vekking', 'frokost', 'bings_morgen', 'personalmoete', 'okt1',
  'middag', 'bings_ettermiddag', 'personalmoete2', 'okt2', 'kveldsmat',
  'bings_kveld', 'okt3', 'legging', 'nattevakt', 'sanitas', 'seilern_box', 'kjokkenvakt',
];
const ARRIVAL_SLUGS = [
  'forberedelser', 'lunsj_mote', 'ankomst', 'middag_ankomst', 'informasjon',
  'intro_moter', 'kiosk', 'legging_ankomst', 'nattevakt_ankomst',
];
const DEPARTURE_SLUGS = [
  'vekking_avreise', 'rydding', 'frokost_avreise', 'utdeling_pass',
  'avreise', 'lunsj_mote_avreise', 'opprydning1', 'opprydning2',
];

const DAY_NAMES = ['Lørdag', 'Søndag', 'Mandag', 'Tirsdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lørdag'];

function timeRange(st: ShiftType): string {
  return `${(st.start_time || '').slice(0, 5)}–${(st.end_time || '').slice(0, 5)}`;
}

/** "Caroline Røthe Skjaker" → "Caroline R.S." */
function shortName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  const firstName = parts[0];
  const lastInitials = parts.slice(1).map((p) => p[0] + '.').join('');
  return `${firstName} ${lastInitials}`;
}

/**
 * Compute what to show in a (day × shift × team) cell.
 * - If the whole team is assigned → "Team X" + note.
 * - Else if individual leaders from that team are assigned → their names stacked.
 * - Else empty (not filled).
 */
function teamCellForShift(
  dayAssignments: Assignment[],
  st: ShiftType,
  team: Team,
  leaderById: Map<string, Leader>,
): { text: string; filled: boolean } {
  const teamAss = dayAssignments.find(
    (x) => x.shift_type_id === st.id && x.assignment_type === 'team' && x.team_name === team,
  );
  if (teamAss) {
    return { text: `${TEAM_LABEL[team]}${teamAss.note ?? ''}`, filled: true };
  }
  const names = dayAssignments
    .filter((a) => a.shift_type_id === st.id && a.assignment_type === 'leader' && a.leader_id)
    .filter((a) => {
      const ldr = leaderById.get(a.leader_id!);
      return leaderTeamKey(ldr?.team ?? null) === team;
    })
    .map((a) => {
      const ldr = leaderById.get(a.leader_id!);
      const name = ldr?.name ? shortName(ldr.name) : 'Ukjent';
      return a.note ? `${name} (${a.note})` : name;
    });
  if (names.length === 0) return { text: '', filled: false };
  return { text: names.join('\n'), filled: true };
}

/**
 * Skriv en team-rad og slå sammen sammenhengende kolonner som har identisk
 * `text` og er `filled`. Tomme/ulike celler skrives individuelt.
 */
function writeTeamRowMerged(
  ws: ExcelJS.Worksheet,
  row: number,
  firstCol: number,
  cells: { text: string; filled: boolean }[],
  team: Team,
  borderTop: ExcelJS.Border,
  borderOther: ExcelJS.Border,
) {
  const fillColor = TEAM_FILL[team];
  const fontColor = team === 'team1f' ? 'FF000000' : 'FFFFFFFF';
  let i = 0;
  while (i < cells.length) {
    const cur = cells[i];
    let j = i;
    if (cur.filled && cur.text) {
      while (j + 1 < cells.length && cells[j + 1].filled && cells[j + 1].text === cur.text) j++;
    }
    const startCol = firstCol + i;
    const endCol = firstCol + j;
    if (endCol > startCol) {
      ws.mergeCells(row, startCol, row, endCol);
    }
    const cell = ws.getCell(row, startCol);
    cell.value = cur.text;
    if (cur.filled) {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fillColor } };
      cell.font = { color: { argb: fontColor }, bold: true, size: 9 };
    }
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = {
      top: borderTop,
      bottom: borderOther,
      left: borderOther,
      right: borderOther,
    };
    i = j + 1;
  }
}

export async function exportShiftScheduleXlsx(opts: {
  schedule: Schedule;
  assignments: Assignment[];
  shiftTypes: ShiftType[];
  leaders: Leader[];
}) {
  const { schedule, assignments, shiftTypes, leaders } = opts;
  const leaderById = new Map(leaders.map((l) => [l.id, l]));

  const wb = new ExcelJS.Workbook();
  wb.creator = 'Øksnøen LederApp';
  wb.created = new Date();

  const ws = wb.addWorksheet(`Periode ${schedule.period_number}`);
  ws.properties.defaultColWidth = 16;

  // ===== TITLE =====
  ws.mergeCells(1, 1, 1, NORMAL_SLUGS.length + 1);
  const titleCell = ws.getCell(1, 1);
  titleCell.value = `Vakter og skift — Periode ${schedule.period_number} / ${schedule.year}`;
  titleCell.font = { bold: true, size: 14 };
  titleCell.alignment = { horizontal: 'center' };

  // ===== NORMAL DAYS HEADER =====
  const normalTypes = NORMAL_SLUGS.map((slug) =>
    shiftTypes.find((s) => s.day_type === 'normal' && s.slug === slug)!
  ).filter(Boolean);

  // Row 3: shift names
  ws.getCell(3, 1).value = 'Vakt';
  normalTypes.forEach((st, i) => {
    const c = ws.getCell(3, i + 2);
    c.value = st.name;
    c.font = { bold: true };
    c.alignment = { horizontal: 'center' };
    c.border = { bottom: { style: 'thin' } };
  });

  // Row 4: time
  ws.getCell(4, 1).value = 'Tid';
  normalTypes.forEach((st, i) => {
    const c = ws.getCell(4, i + 2);
    c.value = timeRange(st);
    c.font = { italic: true, size: 10 };
    c.alignment = { horizontal: 'center' };
  });
  // Row 5: duration
  ws.getCell(5, 1).value = 'Timer';
  normalTypes.forEach((st, i) => {
    ws.getCell(5, i + 2).value = Number(st.duration_hours);
  });
  // Row 6: min leaders
  ws.getCell(6, 1).value = 'Min. ledere';
  normalTypes.forEach((st, i) => {
    ws.getCell(6, i + 2).value = st.min_leaders ?? 0;
  });

  // ===== NORMAL DAY ROWS =====
  // 4 rows per day: Team 1 + Team 1F + Team 2 + Team 2F
  const ROW_TEAMS: Team[] = ['team1', 'team1f', 'team2', 'team2f'];
  const thinBorder = { style: 'thin' as const, color: { argb: 'FFCCCCCC' } };
  const topDivider = { style: 'medium' as const, color: { argb: 'FF666666' } };

  let currentRow = 7;
  for (let d = 1; d < schedule.period_length - 1; d++) {
    const dayAss = assignments.filter((a) => a.day_index === d);
    const dayLabel = DAY_NAMES[d] || `Dag ${d + 1}`;
    const dayStartRow = currentRow;

    ROW_TEAMS.forEach((team, ri) => {
      const r = currentRow + ri;
      const cells = normalTypes.map((st) => teamCellForShift(dayAss, st, team, leaderById));
      writeTeamRowMerged(ws, r, 2, cells, team, ri === 0 ? topDivider : thinBorder, thinBorder);
    });

    // Merged day-name cell in column A
    ws.mergeCells(dayStartRow, 1, dayStartRow + ROW_TEAMS.length - 1, 1);
    const dayCell = ws.getCell(dayStartRow, 1);
    dayCell.value = dayLabel;
    dayCell.font = { bold: true, size: 12 };
    dayCell.alignment = { vertical: 'middle', horizontal: 'center' };
    dayCell.border = {
      top: topDivider, bottom: thinBorder, left: thinBorder, right: thinBorder,
    };

    currentRow += ROW_TEAMS.length;
  }

  // ===== ASTERISK FOOTNOTES =====
  currentRow += 1;
  const notes = [
    '* Teamet jobber uten frokostvakt og nattevakt',
    '** Teamet jobber uten de som har bingsvakt',
    '*** Teamet jobber uten de som er morgenvakt',
    '**** Teamet jobber uten nattevakt; de med Økt 1 neste dag avslutter 23:45',
    '***** Den som jobbet første økt jobber IKKE legging',
  ];
  notes.forEach((n) => {
    ws.getCell(currentRow, 1).value = n;
    ws.getCell(currentRow, 1).font = { size: 10, italic: true };
    currentRow += 1;
  });

  // ===== ARRIVAL BLOCK =====
  currentRow += 2;
  ws.mergeCells(currentRow, 1, currentRow, ARRIVAL_SLUGS.length + 1);
  const arrTitle = ws.getCell(currentRow, 1);
  arrTitle.value = 'Ankomst (Lørdag)';
  arrTitle.font = { bold: true, size: 12 };
  currentRow += 1;
  await writeSpecialBlock(ws, currentRow, schedule, assignments, shiftTypes, leaderById, ARRIVAL_SLUGS, 'arrival', 0);
  currentRow += 6 + 4; // header rows + 4 team rows

  // ===== DEPARTURE BLOCK =====
  currentRow += 2;
  ws.mergeCells(currentRow, 1, currentRow, DEPARTURE_SLUGS.length + 1);
  const depTitle = ws.getCell(currentRow, 1);
  depTitle.value = 'Avreise (Lørdag)';
  depTitle.font = { bold: true, size: 12 };
  currentRow += 1;
  await writeSpecialBlock(ws, currentRow, schedule, assignments, shiftTypes, leaderById, DEPARTURE_SLUGS, 'departure', schedule.period_length - 1);

  // Column widths
  ws.getColumn(1).width = 16;
  for (let i = 2; i <= NORMAL_SLUGS.length + 1; i++) ws.getColumn(i).width = 16;

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `vaktplan-periode-${schedule.period_number}-${schedule.year}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

async function writeSpecialBlock(
  ws: ExcelJS.Worksheet,
  startRow: number,
  _schedule: Schedule,
  assignments: Assignment[],
  shiftTypes: ShiftType[],
  leaderById: Map<string, Leader>,
  slugs: string[],
  dayType: 'arrival' | 'departure',
  dayIndex: number,
) {
  const types = slugs.map((slug) =>
    shiftTypes.find((s) => s.day_type === dayType && s.slug === slug)!
  ).filter(Boolean);

  // Header
  ws.getCell(startRow, 1).value = 'Vakt';
  types.forEach((st, i) => {
    const c = ws.getCell(startRow, i + 2);
    c.value = st.name;
    c.font = { bold: true };
    c.alignment = { horizontal: 'center' };
  });
  ws.getCell(startRow + 1, 1).value = 'Tid';
  types.forEach((st, i) => {
    ws.getCell(startRow + 1, i + 2).value = timeRange(st);
  });
  ws.getCell(startRow + 2, 1).value = 'Timer';
  types.forEach((st, i) => {
    ws.getCell(startRow + 2, i + 2).value = Number(st.duration_hours);
  });

  // Rows: 4 teams (one per row) for clarity
  const dayAss = assignments.filter((a) => a.day_index === dayIndex);
  const TEAMS: Team[] = ['team1', 'team2', 'team1f', 'team2f'];
  const thinBorder = { style: 'thin' as const, color: { argb: 'FFCCCCCC' } };
  TEAMS.forEach((t, ti) => {
    const r = startRow + 3 + ti;
    ws.getCell(r, 1).value = TEAM_LABEL[t];
    ws.getCell(r, 1).font = { bold: true };
    const cells = types.map((st) => teamCellForShift(dayAss, st, t, leaderById));
    writeTeamRowMerged(ws, r, 2, cells, t, thinBorder, thinBorder);
  });
}