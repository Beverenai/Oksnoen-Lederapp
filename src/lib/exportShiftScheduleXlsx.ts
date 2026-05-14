import ExcelJS from 'exceljs';
import type { Tables } from '@/integrations/supabase/types';

type Schedule = Tables<'shift_schedules'>;
type Assignment = Tables<'shift_assignments'>;
type ShiftType = Tables<'shift_types'>;
type Leader = Tables<'leaders'>;

type Team = 'team1' | 'team2' | 'team1f' | 'team2f';

const TEAM_FILL: Record<Team, string> = {
  team1: 'FFEF4444',  // red
  team2: 'FF3B82F6',  // blue
  team1f: 'FFF97316', // orange
  team2f: 'FFEAB308', // yellow
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

/** Single (leader) names for a shift cell, joined by line breaks. */
function singleNamesForShift(
  dayAssignments: Assignment[],
  st: ShiftType,
  leaderById: Map<string, Leader>,
): string {
  const names = dayAssignments
    .filter((a) => a.shift_type_id === st.id && a.assignment_type === 'leader' && a.leader_id)
    .map((a) => {
      const ldr = leaderById.get(a.leader_id!);
      const name = ldr?.name ? shortName(ldr.name) : 'Ukjent';
      return a.note ? `${name} (${a.note})` : name;
    });
  return names.join('\n');
}

/** Returns "Team 1*" if team is on this shift, else null. */
function teamLabelForShift(
  dayAssignments: Assignment[],
  st: ShiftType,
  team: Team,
): string | null {
  const a = dayAssignments.find(
    (x) => x.shift_type_id === st.id && x.assignment_type === 'team' && x.team_name === team,
  );
  if (!a) return null;
  return `${TEAM_LABEL[team]}${a.note ?? ''}`;
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
  // 5 rows per day: Single + Team 1 + Team 1F + Team 2 + Team 2F
  const ROW_TEAMS: (Team | 'single')[] = ['single', 'team1', 'team1f', 'team2', 'team2f'];
  const ROW_LABELS: Record<Team | 'single', string> = {
    single: 'Single navn', team1: 'Team 1', team1f: 'Team 1F', team2: 'Team 2', team2f: 'Team 2F',
  };
  const thinBorder = { style: 'thin' as const, color: { argb: 'FFCCCCCC' } };
  const topDivider = { style: 'medium' as const, color: { argb: 'FF666666' } };

  let currentRow = 7;
  for (let d = 1; d < schedule.period_length - 1; d++) {
    const dayAss = assignments.filter((a) => a.day_index === d);
    const dayLabel = DAY_NAMES[d] || `Dag ${d + 1}`;
    const dayStartRow = currentRow;

    ROW_TEAMS.forEach((rowKind, ri) => {
      const r = currentRow + ri;
      // Column A: row label (small, italic) — dayLabel itself goes via merge below
      const labelCell = ws.getCell(r, 1);
      labelCell.value = ROW_LABELS[rowKind];
      labelCell.font = { size: 9, italic: rowKind === 'single', color: { argb: 'FF555555' } };
      labelCell.alignment = { vertical: 'middle', horizontal: 'right' };

      normalTypes.forEach((st, i) => {
        const cell = ws.getCell(r, i + 2);
        if (rowKind === 'single') {
          const txt = singleNamesForShift(dayAss, st, leaderById);
          cell.value = txt;
          cell.font = { color: { argb: 'FF111111' }, size: 9 };
          cell.alignment = { wrapText: true, vertical: 'top', horizontal: 'left' };
        } else {
          const team = rowKind as Team;
          const label = teamLabelForShift(dayAss, st, team);
          if (label) {
            cell.value = label;
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TEAM_FILL[team] } };
            cell.font = {
              color: { argb: team === 'team2f' ? 'FF000000' : 'FFFFFFFF' },
              bold: true,
              size: 9,
            };
          } else {
            cell.value = '';
          }
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
        }
        cell.border = {
          top: ri === 0 ? topDivider : thinBorder,
          bottom: thinBorder,
          left: thinBorder,
          right: thinBorder,
        };
      });

      ws.getRow(r).height = rowKind === 'single' ? 32 : 16;
    });

    // Replace col A labels with merged day-name cell
    for (let ri = 0; ri < ROW_TEAMS.length; ri++) ws.getCell(dayStartRow + ri, 1).value = '';
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
    '***** De som jobbet Økt 1 jobber IKKE legging',
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
  TEAMS.forEach((t, ti) => {
    const r = startRow + 3 + ti;
    ws.getCell(r, 1).value = TEAM_LABEL[t];
    ws.getCell(r, 1).font = { bold: true };
    types.forEach((st, i) => {
      const cell = ws.getCell(r, i + 2);
      const has = dayAss.find((a) => a.shift_type_id === st.id && a.assignment_type === 'team' && a.team_name === t);
      if (has) {
        cell.value = '';
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TEAM_FILL[t] } };
      }
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFCCCCCC' } },
        bottom: { style: 'thin', color: { argb: 'FFCCCCCC' } },
        left: { style: 'thin', color: { argb: 'FFCCCCCC' } },
        right: { style: 'thin', color: { argb: 'FFCCCCCC' } },
      };
    });
  });
}