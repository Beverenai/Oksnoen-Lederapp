import type { ArchiveRow } from '@/lib/archiveDatasets';

const escapeCell = (v: unknown) => {
  const s = v === null || v === undefined ? '' : String(v);
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function rowsToCsv(rows: ArchiveRow[]): string {
  if (!rows.length) return '';
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(';')];
  rows.forEach((r) => lines.push(headers.map((h) => escapeCell(r[h])).join(';')));
  return lines.join('\n');
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadCsv(rows: ArchiveRow[], filename: string) {
  // BOM so Excel reads æøå correctly
  const blob = new Blob(['\uFEFF' + rowsToCsv(rows)], { type: 'text/csv;charset=utf-8;' });
  triggerDownload(blob, filename);
}

/** One workbook with a sheet per dataset. */
export async function downloadWorkbook(
  sheets: { name: string; rows: ArchiveRow[] }[],
  filename: string,
) {
  const ExcelJS = await import('exceljs');
  const wb = new ExcelJS.Workbook();
  sheets.forEach(({ name, rows }) => {
    const safe = name.replace(/[*?:/\\[\]]/g, '').slice(0, 31) || 'Ark';
    const ws = wb.addWorksheet(safe);
    if (!rows.length) {
      ws.addRow(['Ingen data']);
      return;
    }
    const headers = Object.keys(rows[0]);
    ws.addRow(headers).font = { bold: true };
    rows.forEach((r) => ws.addRow(headers.map((h) => r[h] ?? '')));
    ws.columns.forEach((col) => {
      let max = 10;
      col.eachCell?.({ includeEmpty: false }, (cell) => {
        max = Math.min(60, Math.max(max, String(cell.value ?? '').length + 2));
      });
      col.width = max;
    });
  });
  const buf = await wb.xlsx.writeBuffer();
  triggerDownload(
    new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    filename,
  );
}