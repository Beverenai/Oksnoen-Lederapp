import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { usePublicItems, usePublicPeriod } from '@/hooks/useGjenglemt';
import { GjenglemtFilters } from '@/components/admin/gjenglemt/GjenglemtFilters';
import { SignedImage } from '@/components/admin/gjenglemt/SignedImage';
import { colorMeta, garmentLabel } from '@/lib/gjenglemtConstants';
import { Loader2, Search, X, Lock } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { toast } from 'sonner';
import backgroundAsset from '@/assets/oksnoen-header.png.asset.json';

const PUBLIC_PASSWORD = '2026';
const SS_KEY = 'gjenglemt-public-auth';
const CONTACT_EMAIL = 'bengt@oksnoen.no';

function buildClaimEmail(item: { item_number: number | null; garment_type: string | null; color: string | null; owner_name: string | null; bag_label: string | null; ai_description: string | null }, periodName: string, publicUrl: string) {
  const garment = item.garment_type ? garmentLabel(item.garment_type) : 'gjenglemt artikkel';
  const color = item.color ? colorMeta(item.color).label : null;
  const nr = item.item_number ? `#${item.item_number}` : '';
  const titleParts = [nr, [color, garment].filter(Boolean).join(' ')].filter(Boolean).join(' – ');
  const subject = `Gjenglemt ${nr ? nr + ' ' : ''}– ${periodName}`.trim();
  const body = [
    'Hei,',
    '',
    `Jeg har hatt en deltager på ${periodName} som har glemt igjen "${titleParts || garment}".`,
    '',
    'Jeg ønsker (sett kryss):',
    '  [ ] Å hente det selv på Øksnøen',
    '  [ ] Få det tilsendt på egen regning',
    '',
    'Vennlig hilsen,',
  ].filter(Boolean).join('\n');
  return { subject, body };
}

export default function PublicGjenglemt() {
  const { slug } = useParams<{ slug: string }>();
  const { data: period, isLoading: pLoading } = usePublicPeriod(slug);
  const { data: items = [], isLoading: iLoading } = usePublicItems(period?.id);

  const [color, setColor] = useState<string | null>(null);
  const [garment, setGarment] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);
  const [unlocked, setUnlocked] = useState<boolean>(() => {
    try { return sessionStorage.getItem(SS_KEY) === '1'; } catch { return false; }
  });
  const [pwInput, setPwInput] = useState('');
  const [pwError, setPwError] = useState(false);
  const [mailOpen, setMailOpen] = useState(false);

  const tryUnlock = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (pwInput.trim() === PUBLIC_PASSWORD) {
      setUnlocked(true);
      setPwError(false);
      try { sessionStorage.setItem(SS_KEY, '1'); } catch {}
    } else {
      setPwError(true);
    }
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter(i =>
      (!color || i.color === color) &&
      (!garment || i.garment_type === garment) &&
      (!q || matchesQuery(i, q)),
    );
  }, [items, color, garment, query]);

  // SEO
  useEffect(() => {
    const title = period
      ? `Gjenglemt – ${period.name} | Øksnøen`
      : 'Gjenglemt | Øksnøen';
    document.title = title;
    let meta = document.querySelector('meta[name="description"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', 'description');
      document.head.appendChild(meta);
    }
    meta.setAttribute('content',
      period
        ? `Se gjenglemte ting fra ${period.name} på Øksnøen. Søk etter farge og plagg, og kontakt leiren for å hente.`
        : 'Gjenglemte ting fra Øksnøen leirsteder.');
    // noindex if no period found
    let robots = document.querySelector('meta[name="robots"]');
    if (!robots) {
      robots = document.createElement('meta');
      robots.setAttribute('name', 'robots');
      document.head.appendChild(robots);
    }
    robots.setAttribute('content', period ? 'index,follow' : 'noindex,nofollow');
    return () => { document.title = 'Øksnøen LederApp'; };
  }, [period]);

  if (pLoading) {
    return (
      <div className="min-h-[100dvh] relative bg-cover bg-center bg-no-repeat bg-fixed" style={{ backgroundImage: `url(${backgroundAsset.url})` }}>
        <div className="absolute inset-0 bg-background/85 dark:bg-background/80 backdrop-blur-[2px]" />
        <div className="relative z-10 min-h-[100dvh] flex items-center justify-center p-6">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (!period) {
    return (
      <div className="min-h-[100dvh] relative bg-cover bg-center bg-no-repeat bg-fixed" style={{ backgroundImage: `url(${backgroundAsset.url})` }}>
        <div className="absolute inset-0 bg-background/85 dark:bg-background/80 backdrop-blur-[2px]" />
        <div className="relative z-10 min-h-[100dvh] flex flex-col items-center justify-center p-6 text-center gap-2">
          <h1 className="text-2xl font-bold">Fant ikke perioden</h1>
          <p className="text-muted-foreground">Lenken er feil, eller perioden er ikke offentlig tilgjengelig.</p>
          <a href="https://oksnoen.com" className="mt-4 text-primary underline">Tilbake til oksnoen.com</a>
        </div>
      </div>
    );
  }

  if (!unlocked) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-background p-6">
        <form onSubmit={tryUnlock} className="w-full max-w-sm rounded-2xl border bg-card p-6 space-y-4 shadow-sm">
          <div className="flex flex-col items-center text-center gap-2">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Lock className="h-6 w-6 text-primary" />
            </div>
            <h1 className="text-xl font-bold">Gjenglemt – {period.name}</h1>
            <p className="text-sm text-muted-foreground">Skriv inn passordet for å se gjenglemte ting.</p>
          </div>
          <div className="space-y-2">
            <Input
              type="password"
              autoFocus
              inputMode="numeric"
              value={pwInput}
              onChange={e => { setPwInput(e.target.value); setPwError(false); }}
              placeholder="Passord"
              className={pwError ? 'border-destructive' : ''}
            />
            {pwError && <p className="text-xs text-destructive">Feil passord. Prøv igjen.</p>}
          </div>
          <Button type="submit" className="w-full">Lås opp</Button>
          <p className="text-[11px] text-muted-foreground text-center">Får du ikke tilgang? Kontakt leiren på post@oksnoen.com</p>
        </form>
      </div>
    );
  }

  const formatDate = (s: string | null) => s ? new Date(s).toLocaleDateString('nb-NO', { day: 'numeric', month: 'long' }) : '';

  return (
    <div className="min-h-[100dvh] bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="max-w-6xl mx-auto px-4 py-6 sm:py-8">
          <div className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Øksnøen · Gjenglemt</div>
          <h1 className="text-2xl sm:text-4xl font-heading font-bold">{period.name}</h1>
          {(period.start_date || period.end_date) && (
            <div className="text-sm text-muted-foreground mt-1">
              {formatDate(period.start_date)}
              {period.start_date && period.end_date && ' – '}
              {formatDate(period.end_date)}
            </div>
          )}
          <p className="text-sm text-muted-foreground mt-4 max-w-2xl">
            Ser du noe som er ditt? Du kan komme hit til Øksnøen og hente det.
            Hvis du ønsker å få det tilsendt, går det på egen regning.
            <br />
            Send oss en e-post på{' '}
            <a className="text-primary underline" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
            {' '}— oppgi <strong>artikkelnummer</strong> og <strong>deltagers navn</strong>.
          </p>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-5">
        {/* Filters */}
        <section className="rounded-2xl border bg-card p-4">
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Søk: navn, pose, blå genser, rød sokk…"
              className="pl-9"
            />
          </div>
          <GjenglemtFilters color={color} garment={garment} onColor={setColor} onGarment={setGarment} />
        </section>

        {/* Items */}
        <section>
          <div className="text-sm text-muted-foreground mb-3">
            {iLoading ? 'Laster...' : `${filtered.length} av ${items.length} gjenstander`}
          </div>
          {filtered.length === 0 && !iLoading ? (
            <div className="text-center text-muted-foreground py-16">
              {items.length === 0 ? 'Ingen gjenglemte ting registrert i denne perioden ennå.' : 'Ingen treff for valgte filtre.'}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {filtered.map((item, idx) => {
                const c = item.color ? colorMeta(item.color) : null;
                return (
                  <button
                    key={item.id}
                    onClick={() => setLightboxIdx(idx)}
                    className="rounded-xl border overflow-hidden bg-card text-left hover:shadow-md transition-shadow"
                  >
                    <div className="aspect-square bg-muted relative">
                      <SignedImage imageUrl={item.image_url} alt={item.garment_type ? garmentLabel(item.garment_type) : 'Gjenglemt'} className="w-full h-full object-cover" />
                      {item.item_number != null && (
                        <div className="absolute top-1.5 left-1.5">
                          <span className="inline-flex items-center rounded-md bg-foreground/85 text-background px-1.5 py-0.5 text-[10px] font-semibold tabular-nums shadow-sm">
                            #{item.item_number}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="p-2.5 space-y-1">
                      <div className="flex items-center gap-1.5 min-w-0">
                        {c && (
                          <span
                            className="h-4 w-4 rounded-full border shrink-0"
                            style={c.hex.startsWith('#') ? { backgroundColor: c.hex } : { background: c.hex }}
                            aria-label={c.label}
                          />
                        )}
                        <span className="text-sm font-medium truncate">
                          {item.garment_type ? garmentLabel(item.garment_type) : 'Analyseres…'}
                        </span>
                      </div>
                      {item.ai_description && (
                        <div className="text-[11px] text-muted-foreground line-clamp-2">{item.ai_description}</div>
                      )}
                      {item.owner_name && (
                        <div className="text-[11px] font-medium text-primary truncate">👤 {item.owner_name}</div>
                      )}
                      {item.bag_label && (
                        <div className="text-[11px] text-muted-foreground truncate">📦 Pose {item.bag_label}</div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        <footer className="text-center text-xs text-muted-foreground pt-8 pb-4">
          <a href="https://oksnoen.com" className="hover:text-foreground">oksnoen.com</a>
        </footer>
      </main>

      {lightboxIdx !== null && filtered[lightboxIdx] && (
        <div
          className="fixed inset-0 z-50 bg-background/95 backdrop-blur overflow-y-auto"
          onClick={() => setLightboxIdx(null)}
        >
          <div
            className="min-h-full flex flex-col items-center justify-start sm:justify-center p-4"
            style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))', paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
          >
          <div className="max-w-3xl w-full relative" onClick={e => e.stopPropagation()}>
            <button
              className="absolute top-2 right-2 z-10 bg-background/90 border rounded-full p-2 shadow-md"
              aria-label="Lukk"
              onClick={() => setLightboxIdx(null)}
            >
              <X className="h-5 w-5" />
            </button>
            <SignedImage imageUrl={filtered[lightboxIdx].image_url} alt={filtered[lightboxIdx].garment_type ? garmentLabel(filtered[lightboxIdx].garment_type!) : 'Gjenglemt'} className="w-full max-h-[70dvh] object-contain rounded-xl" />
            <div className="mt-3 text-center space-y-1">
              <div className="font-medium">
                {filtered[lightboxIdx].item_number != null && (
                  <span className="mr-2 inline-flex items-center rounded-md bg-foreground text-background px-2 py-0.5 text-xs font-semibold tabular-nums align-middle">
                    #{filtered[lightboxIdx].item_number}
                  </span>
                )}
                {filtered[lightboxIdx].garment_type ? garmentLabel(filtered[lightboxIdx].garment_type!) : 'Ukjent'}
                {filtered[lightboxIdx].color && ` – ${colorMeta(filtered[lightboxIdx].color!).label}`}
              </div>
              {filtered[lightboxIdx].ai_description && (
                <div className="text-sm text-muted-foreground">{filtered[lightboxIdx].ai_description}</div>
              )}
              {filtered[lightboxIdx].owner_name && (
                <div className="text-sm font-medium text-primary">Navn: {filtered[lightboxIdx].owner_name}</div>
              )}
              {filtered[lightboxIdx].bag_label && (
                <div className="text-sm text-muted-foreground">Pose {filtered[lightboxIdx].bag_label}</div>
              )}
              {filtered[lightboxIdx].notes && (
                <div className="text-sm text-muted-foreground italic">📝 {filtered[lightboxIdx].notes}</div>
              )}
              {filtered[lightboxIdx].ai_tags?.length > 0 && (
                <div className="flex flex-wrap gap-1 justify-center pt-1">
                  {filtered[lightboxIdx].ai_tags.map(t => <Badge key={t} variant="secondary" className="text-[10px]">{t}</Badge>)}
                </div>
              )}
              <div className="text-xs text-muted-foreground pt-1">Bilde-ID: {filtered[lightboxIdx].id.slice(0, 8)}</div>
            </div>
            <Button asChild className="w-full mt-4">
              <button type="button" onClick={() => setMailOpen(true)}>
                Send e-post om denne (#{filtered[lightboxIdx].item_number ?? '—'})
              </button>
            </Button>
            <Button className="w-full mt-2" variant="secondary" onClick={() => setLightboxIdx(null)}>
              Lukk
            </Button>
          </div>
          </div>
        </div>
      )}

      {lightboxIdx !== null && filtered[lightboxIdx] && period && (
        <MailDialog
          open={mailOpen}
          onOpenChange={setMailOpen}
          email={CONTACT_EMAIL}
          {...buildClaimEmail(
            filtered[lightboxIdx],
            period.name,
            typeof window !== 'undefined' ? window.location.origin + window.location.pathname : ''
          )}
        />
      )}
    </div>
  );
}

function MailDialog({ open, onOpenChange, email, subject, body }: { open: boolean; onOpenChange: (v: boolean) => void; email: string; subject: string; body: string }) {
  const enc = (s: string) => encodeURIComponent(s);
  const mailto = `mailto:${email}?subject=${enc(subject)}&body=${enc(body)}`;
  const gmail = `https://mail.google.com/mail/?view=cm&fs=1&to=${enc(email)}&su=${enc(subject)}&body=${enc(body)}`;
  const outlook = `https://outlook.office.com/mail/deeplink/compose?to=${enc(email)}&subject=${enc(subject)}&body=${enc(body)}`;
  const yahoo = `https://compose.mail.yahoo.com/?to=${enc(email)}&subject=${enc(subject)}&body=${enc(body)}`;

  const copyAll = async () => {
    try {
      await navigator.clipboard.writeText(`Til: ${email}\nEmne: ${subject}\n\n${body}`);
      toast.success('E-post kopiert til utklippstavlen');
    } catch {
      toast.error('Kunne ikke kopiere');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Send e-post</DialogTitle>
          <DialogDescription>Velg hvordan du vil sende e-posten til {email}</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Button asChild className="w-full justify-start" onClick={() => onOpenChange(false)}>
            <a href={mailto}>📧 Åpne i mail-appen min</a>
          </Button>
          <Button asChild variant="outline" className="w-full justify-start" onClick={() => onOpenChange(false)}>
            <a href={gmail} target="_blank" rel="noopener noreferrer">Gmail (nettleser)</a>
          </Button>
          <Button asChild variant="outline" className="w-full justify-start" onClick={() => onOpenChange(false)}>
            <a href={outlook} target="_blank" rel="noopener noreferrer">Outlook (nettleser)</a>
          </Button>
          <Button asChild variant="outline" className="w-full justify-start" onClick={() => onOpenChange(false)}>
            <a href={yahoo} target="_blank" rel="noopener noreferrer">Yahoo Mail (nettleser)</a>
          </Button>
          <Button variant="secondary" className="w-full justify-start" onClick={copyAll}>
            📋 Kopier e-posten
          </Button>
        </div>
        <div className="text-xs text-muted-foreground border-t pt-2">
          Eller send manuelt til: <a className="text-primary underline" href={`mailto:${email}`}>{email}</a>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function matchesQuery(i: { garment_type: string | null; color: string | null; notes: string | null; ai_description: string | null; ai_tags: string[]; owner_name?: string | null; bag_label?: string | null; item_number?: number | null }, q: string) {
  const fields: string[] = [];
  if (i.item_number != null) fields.push(String(i.item_number), `#${i.item_number}`, `nr ${i.item_number}`);
  if (i.garment_type) fields.push(i.garment_type, garmentLabel(i.garment_type).toLowerCase());
  if (i.color) fields.push(i.color, colorMeta(i.color).label.toLowerCase());
  if (i.notes) fields.push(i.notes.toLowerCase());
  if (i.owner_name) fields.push(i.owner_name.toLowerCase());
  if (i.bag_label) fields.push(i.bag_label.toLowerCase(), `pose ${i.bag_label.toLowerCase()}`);
  if (i.ai_description) fields.push(i.ai_description.toLowerCase());
  if (i.ai_tags?.length) fields.push(...i.ai_tags.map(t => t.toLowerCase()));
  return fields.some(f => f.includes(q));
}