import type { KioskBalance, KioskDeposit, KioskSale } from '@/hooks/useKiosk';

function csvEscape(value: unknown) {
  const s = value === null || value === undefined ? '' : String(value);
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Semicolon-separated CSV with BOM — opens correctly in Norwegian Excel. */
export function toCsv(headers: string[], rows: (string | number | null | undefined)[][]) {
  const body = [headers, ...rows].map((r) => r.map(csvEscape).join(';')).join('\r\n');
  return '\uFEFF' + body;
}

export function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

const dt = (iso: string) => new Date(iso).toLocaleString('nb-NO');

/** One row per sale line — the full audit trail. */
export function salesCsv(sales: KioskSale[], nameOf: (id: string) => string) {
  const rows = sales.flatMap((s) =>
    s.items.map((i) => [
      s.sale_number ?? '',
      dt(s.created_at),
      nameOf(s.participant_id),
      i.product_name,
      i.quantity,
      i.unit_price,
      i.quantity * i.unit_price,
      s.total,
      s.sold_by_name ?? '',
      s.voided_at ? 'Annullert' : 'Gyldig',
    ])
  );
  return toCsv(
    ['Kvittering', 'Tidspunkt', 'Deltager', 'Vare', 'Antall', 'Pris', 'Sum linje', 'Sum kvittering', 'Selger', 'Status'],
    rows
  );
}

/** Aggregated per product. */
export function productsCsv(sales: KioskSale[]) {
  const map = new Map<string, { quantity: number; revenue: number }>();
  sales
    .filter((s) => !s.voided_at)
    .forEach((s) =>
      s.items.forEach((i) => {
        const cur = map.get(i.product_name) || { quantity: 0, revenue: 0 };
        cur.quantity += i.quantity;
        cur.revenue += i.quantity * i.unit_price;
        map.set(i.product_name, cur);
      })
    );
  const rows = [...map.entries()]
    .sort((a, b) => b[1].revenue - a[1].revenue)
    .map(([name, v]) => [name, v.quantity, v.revenue]);
  return toCsv(['Vare', 'Antall solgt', 'Omsetning'], rows);
}

/** Balance sheet per participant. */
export function balancesCsv(
  participants: { id: string; name: string }[],
  balances?: Map<string, KioskBalance>
) {
  const rows = participants.map((p) => {
    const b = balances?.get(p.id);
    return [p.name, b?.deposited ?? 0, b?.spent ?? 0, b?.balance ?? 0];
  });
  return toCsv(['Deltager', 'Innbetalt', 'Brukt', 'Saldo'], rows);
}

/** Deposits and manual corrections. */
export function depositsCsv(deposits: KioskDeposit[], nameOf: (id: string) => string) {
  const rows = deposits.map((d) => [
    dt(d.created_at),
    nameOf(d.participant_id),
    d.amount,
    d.kind,
    d.note ?? '',
    d.created_by_name ?? '',
  ]);
  return toCsv(['Tidspunkt', 'Deltager', 'Beløp', 'Type', 'Notat', 'Registrert av'], rows);
}

/** Daily summary (Z-report style). */
/** Purchasing/stock planning: sold per product with per-day rate and suggested restock. */
export function purchasingCsv(sales: KioskSale[], days: number) {
  const map = new Map<string, { quantity: number; revenue: number; price: number }>();
  sales
    .filter((s) => !s.voided_at)
    .forEach((s) =>
      s.items.forEach((i) => {
        const cur = map.get(i.product_name) || { quantity: 0, revenue: 0, price: i.unit_price };
        cur.quantity += i.quantity;
        cur.revenue += i.quantity * i.unit_price;
        cur.price = i.unit_price;
        map.set(i.product_name, cur);
      })
    );
  const safeDays = Math.max(days, 1);
  const rows = [...map.entries()]
    .sort((a, b) => b[1].quantity - a[1].quantity)
    .map(([name, v]) => [
      name,
      v.price,
      v.quantity,
      v.revenue,
      (v.quantity / safeDays).toFixed(1).replace('.', ','),
      Math.ceil((v.quantity / safeDays) * 7 * 1.2),
    ]);
  return toCsv(
    ['Vare', 'Pris', 'Antall solgt', 'Omsetning', 'Snitt per dag', 'Anbefalt innkjøp neste uke (+20%)'],
    rows
  );
}

export function dailyCsv(sales: KioskSale[]) {
  const map = new Map<string, { sales: number; revenue: number; voided: number }>();
  sales.forEach((s) => {
    const day = new Date(s.created_at).toLocaleDateString('nb-NO');
    const cur = map.get(day) || { sales: 0, revenue: 0, voided: 0 };
    if (s.voided_at) cur.voided += 1;
    else {
      cur.sales += 1;
      cur.revenue += s.total;
    }
    map.set(day, cur);
  });
  const rows = [...map.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([day, v]) => [day, v.sales, v.revenue, v.voided]);
  return toCsv(['Dato', 'Antall kjøp', 'Omsetning', 'Annullerte'], rows);
}