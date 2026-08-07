/** Receipt rendering + printing for Gomla (kiosk POS). */

export interface ReceiptData {
  saleNumber: number | null;
  saleId: string;
  createdAt: string;
  participantName: string;
  participantRoom?: string | null;
  soldByName?: string | null;
  items: { product_name: string; unit_price: number; quantity: number }[];
  total: number;
  balanceAfter?: number | null;
  voidedAt?: string | null;
}

export function receiptLabel(data: Pick<ReceiptData, 'saleNumber' | 'saleId'>) {
  return data.saleNumber ? `#${String(data.saleNumber).padStart(4, '0')}` : data.saleId.slice(0, 8);
}

export function formatReceiptDate(iso: string) {
  return new Date(iso).toLocaleString('nb-NO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Plain-text receipt — handy for sharing or copying. */
export function receiptToText(d: ReceiptData) {
  const lines = [
    'GOMLA — ØKSNØEN',
    `Kvittering ${receiptLabel(d)}`,
    formatReceiptDate(d.createdAt),
    '',
    d.participantName + (d.participantRoom ? ` (${d.participantRoom})` : ''),
    '',
    ...d.items.map(
      (i) => `${i.quantity} x ${i.product_name} — ${i.quantity * i.unit_price} kr`
    ),
    '',
    `Totalt: ${d.total} kr`,
  ];
  if (d.balanceAfter !== null && d.balanceAfter !== undefined) {
    lines.push(`Saldo etter kjøp: ${d.balanceAfter} kr`);
  }
  if (d.soldByName) lines.push(`Selger: ${d.soldByName}`);
  if (d.voidedAt) lines.push('ANNULLERT');
  return lines.join('\n');
}

function receiptHtml(d: ReceiptData) {
  const rows = d.items
    .map(
      (i) => `<tr>
        <td class="q">${i.quantity}×</td>
        <td class="n">${escapeHtml(i.product_name)}</td>
        <td class="p">${i.quantity * i.unit_price} kr</td>
      </tr>`
    )
    .join('');

  return `<!doctype html>
<html lang="nb"><head><meta charset="utf-8" />
<title>Gomla kvittering ${receiptLabel(d)}</title>
<style>
  @page { size: 80mm auto; margin: 6mm; }
  body { font-family: "SF Mono", ui-monospace, Menlo, monospace; font-size: 12px; color: #111; margin: 0 auto; max-width: 320px; }
  h1 { font-size: 16px; letter-spacing: .18em; text-align: center; margin: 0 0 2px; }
  .sub { text-align: center; font-size: 11px; color: #555; margin-bottom: 10px; }
  .rule { border-top: 1px dashed #999; margin: 8px 0; }
  table { width: 100%; border-collapse: collapse; }
  td { padding: 2px 0; vertical-align: top; }
  td.q { width: 34px; }
  td.p { text-align: right; white-space: nowrap; }
  .total { display: flex; justify-content: space-between; font-weight: 700; font-size: 14px; }
  .meta { font-size: 11px; color: #555; display: flex; justify-content: space-between; }
  .void { margin-top: 8px; text-align: center; font-weight: 700; color: #b00; letter-spacing: .12em; }
  .foot { margin-top: 12px; text-align: center; font-size: 10px; color: #777; }
</style></head>
<body>
  <h1>GOMLA</h1>
  <div class="sub">Øksnøen leirsted</div>
  <div class="meta"><span>Kvittering ${receiptLabel(d)}</span><span>${formatReceiptDate(d.createdAt)}</span></div>
  <div class="rule"></div>
  <div><strong>${escapeHtml(d.participantName)}</strong>${
    d.participantRoom ? `<br /><span class="sub" style="text-align:left">${escapeHtml(d.participantRoom)}</span>` : ''
  }</div>
  <div class="rule"></div>
  <table>${rows}</table>
  <div class="rule"></div>
  <div class="total"><span>Totalt</span><span>${d.total} kr</span></div>
  ${
    d.balanceAfter !== null && d.balanceAfter !== undefined
      ? `<div class="meta" style="margin-top:4px"><span>Saldo etter kjøp</span><span>${d.balanceAfter} kr</span></div>`
      : ''
  }
  ${d.soldByName ? `<div class="meta"><span>Selger</span><span>${escapeHtml(d.soldByName)}</span></div>` : ''}
  ${d.voidedAt ? '<div class="void">ANNULLERT</div>' : ''}
  <div class="foot">Kjøpet er trukket fra kiosk-kontoen</div>
</body></html>`;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string
  );
}

/** Opens the print dialog with a thermal-style receipt. */
export function printReceipt(d: ReceiptData) {
  const frame = document.createElement('iframe');
  frame.style.position = 'fixed';
  frame.style.right = '0';
  frame.style.bottom = '0';
  frame.style.width = '0';
  frame.style.height = '0';
  frame.style.border = '0';
  document.body.appendChild(frame);

  const doc = frame.contentDocument;
  if (!doc) {
    frame.remove();
    return;
  }
  doc.open();
  doc.write(receiptHtml(d));
  doc.close();

  const run = () => {
    frame.contentWindow?.focus();
    frame.contentWindow?.print();
    setTimeout(() => frame.remove(), 1000);
  };
  if (frame.contentWindow?.document.readyState === 'complete') run();
  else frame.onload = run;
}

/** Downloads the receipt as a standalone HTML file (print to PDF from there). */
export function downloadReceipt(d: ReceiptData) {
  const blob = new Blob([receiptHtml(d)], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `gomla-kvittering-${receiptLabel(d).replace('#', '')}.html`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}