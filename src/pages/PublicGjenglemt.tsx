import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { usePublicItems, usePublicPeriod } from '@/hooks/useGjenglemt';
import { GjenglemtFilters } from '@/components/admin/gjenglemt/GjenglemtFilters';
import { SignedImage } from '@/components/admin/gjenglemt/SignedImage';
import { colorMeta, garmentLabel } from '@/lib/gjenglemtConstants';
import { Loader2, Search, X } from 'lucide-react';

export default function PublicGjenglemt() {
  const { slug } = useParams<{ slug: string }>();
  const { data: period, isLoading: pLoading } = usePublicPeriod(slug);
  const { data: items = [], isLoading: iLoading } = usePublicItems(period?.id);

  const [color, setColor] = useState<string | null>(null);
  const [garment, setGarment] = useState<string | null>(null);
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);

  const filtered = useMemo(() => items.filter(i =>
    (!color || i.color === color) &&
    (!garment || i.garment_type === garment),
  ), [items, color, garment]);

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
      <div className="min-h-[100dvh] flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!period) {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-background p-6 text-center gap-2">
        <h1 className="text-2xl font-bold">Fant ikke perioden</h1>
        <p className="text-muted-foreground">Lenken er feil, eller perioden er ikke offentlig tilgjengelig.</p>
        <a href="https://oksnoen.com" className="mt-4 text-primary underline">Tilbake til oksnoen.com</a>
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
            Kjenner du igjen noe? Ta kontakt med leiren på{' '}
            <a className="text-primary underline" href="mailto:post@oksnoen.com">post@oksnoen.com</a> og oppgi bilde-ID eller beskrivelse.
          </p>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-5">
        {/* Filters */}
        <section className="rounded-2xl border bg-card p-4">
          <div className="flex items-center gap-2 mb-3">
            <Search className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Søk etter farge og plagg</span>
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
                const c = colorMeta(item.color);
                return (
                  <button
                    key={item.id}
                    onClick={() => setLightboxIdx(idx)}
                    className="rounded-xl border overflow-hidden bg-card text-left hover:shadow-md transition-shadow"
                  >
                    <div className="aspect-square bg-muted">
                      <SignedImage imageUrl={item.image_url} alt={garmentLabel(item.garment_type)} className="w-full h-full object-cover" />
                    </div>
                    <div className="p-2.5 flex items-center gap-1.5 min-w-0">
                      <span
                        className="h-4 w-4 rounded-full border shrink-0"
                        style={c.hex.startsWith('#') ? { backgroundColor: c.hex } : { background: c.hex }}
                        aria-label={c.label}
                      />
                      <span className="text-sm font-medium truncate">{garmentLabel(item.garment_type)}</span>
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
          className="fixed inset-0 z-50 bg-background/95 backdrop-blur flex items-center justify-center p-4"
          onClick={() => setLightboxIdx(null)}
        >
          <button className="absolute top-4 right-4 bg-background border rounded-full p-2" aria-label="Lukk" onClick={() => setLightboxIdx(null)}>
            <X className="h-5 w-5" />
          </button>
          <div className="max-w-3xl w-full" onClick={e => e.stopPropagation()}>
            <SignedImage imageUrl={filtered[lightboxIdx].image_url} alt={garmentLabel(filtered[lightboxIdx].garment_type)} className="w-full max-h-[80dvh] object-contain rounded-xl" />
            <div className="mt-3 text-center">
              <div className="font-medium">{garmentLabel(filtered[lightboxIdx].garment_type)} – {colorMeta(filtered[lightboxIdx].color).label}</div>
              <div className="text-xs text-muted-foreground mt-1">Bilde-ID: {filtered[lightboxIdx].id.slice(0, 8)}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}