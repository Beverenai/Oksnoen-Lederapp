import { useMemo, useState } from 'react';
import * as Icons from 'lucide-react';
import { ChefHat, Plus, Loader2, Pencil, Check, X, AlertTriangle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { hapticImpact } from '@/lib/capacitorHaptics';
import { KitchenChecklist } from '@/components/kitchen/KitchenChecklist';
import { KitchenGuide } from '@/components/kitchen/KitchenGuide';
import { KitchenAllergies } from '@/components/kitchen/KitchenAllergies';
import {
  useKitchenAdmin,
  useKitchenChecks,
  useKitchenItems,
  useKitchenRealtime,
  useKitchenSections,
} from '@/hooks/useKitchen';
import { useAllLeaders } from '@/hooks/useLeaders';

function SectionIcon({ name, className }: { name: string | null; className?: string }) {
  const Comp = (name && (Icons as unknown as Record<string, typeof ChefHat>)[name]) || ChefHat;
  return <Comp className={className} strokeWidth={1.8} />;
}

export default function Kjokken() {
  const { isAdmin, isKitchen } = useAuth();
  useKitchenRealtime();
  const { data: sections, isLoading } = useKitchenSections();
  const { data: items } = useKitchenItems();
  const { data: checks } = useKitchenChecks();
  const { data: leaders } = useAllLeaders();
  const { addSection, updateSection } = useKitchenAdmin();

  const [activeSlug, setActiveSlug] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editingHeader, setEditingHeader] = useState(false);
  const [headerTitle, setHeaderTitle] = useState('');
  const [headerBody, setHeaderBody] = useState('');

  const leaderNames = useMemo(() => {
    const map: Record<string, string> = {};
    (leaders || []).forEach((l) => { map[l.id] = l.name; });
    return map;
  }, [leaders]);

  const checkMap = useMemo(() => {
    const map: Record<string, NonNullable<typeof checks>[number]> = {};
    (checks || []).forEach((c) => { map[c.item_id] = c; });
    return map;
  }, [checks]);

  const itemsBySection = useMemo(() => {
    const map: Record<string, NonNullable<typeof items>> = {};
    (items || []).forEach((i) => {
      (map[i.section_id] ||= []).push(i);
    });
    return map;
  }, [items]);

  const active = useMemo(() => {
    if (activeSlug === 'allergier') return null;
    if (!sections?.length) return null;
    return sections.find((s) => s.slug === activeSlug) ?? sections[0];
  }, [sections, activeSlug]);

  const allergiesActive = activeSlug === 'allergier';

  if (!isAdmin && !isKitchen) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <ChefHat className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h1 className="text-xl font-heading font-semibold">Ingen tilgang</h1>
            <p className="text-muted-foreground mt-2">
              Kjøkken-siden er kun for kjøkkenteamet og admin.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-24" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  const activeItems = active ? itemsBySection[active.id] ?? [] : [];
  const doneCount = activeItems.filter((i) => checkMap[i.id]).length;

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 pb-8 animate-fade-in">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-heading font-bold text-foreground flex items-center gap-2">
            <ChefHat className="w-6 h-6 text-primary" strokeWidth={1.8} />
            Kjøkken
          </h1>
          <p className="text-sm text-muted-foreground">
            Rutiner, sjekklister og oppskrifter. Avkrysninger gjelder denne perioden.
          </p>
        </div>
        {isAdmin && (
          <Button
            variant={editMode ? 'default' : 'outline'}
            size="sm"
            onClick={() => setEditMode((v) => !v)}
            className="shrink-0"
          >
            <Pencil className="w-4 h-4 sm:mr-2" />
            <span className="hidden sm:inline">{editMode ? 'Ferdig' : 'Rediger'}</span>
          </Button>
        )}
      </header>

      {/* Section chips */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
        <button
          type="button"
          onClick={() => { hapticImpact('light'); setActiveSlug('allergier'); setEditingHeader(false); }}
          className={cn(
            'shrink-0 flex items-center gap-2 rounded-full border px-3.5 py-2 text-xs font-medium transition-colors',
            allergiesActive
              ? 'border-primary bg-primary text-primary-foreground'
              : 'border-border/60 bg-card/70 text-foreground hover:bg-card',
          )}
        >
          <AlertTriangle className="w-4 h-4" />
          <span>Allergier</span>
        </button>
        {(sections || []).map((s) => {
          const secItems = itemsBySection[s.id] ?? [];
          const done = secItems.filter((i) => checkMap[i.id]).length;
          const isActive = active?.id === s.id;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => { hapticImpact('light'); setActiveSlug(s.slug); setEditingHeader(false); }}
              className={cn(
                'shrink-0 flex items-center gap-2 rounded-full border px-3.5 py-2 text-xs font-medium transition-colors',
                isActive
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border/60 bg-card/70 text-foreground hover:bg-card',
              )}
            >
              <SectionIcon name={s.icon} className="w-4 h-4" />
              <span>{s.title}</span>
              {s.kind === 'checklist' && secItems.length > 0 && (
                <span className={cn('text-[10px]', isActive ? 'opacity-80' : 'text-muted-foreground')}>
                  {done}/{secItems.length}
                </span>
              )}
            </button>
          );
        })}
        {isAdmin && editMode && (
          <Button
            variant="outline"
            size="sm"
            className="shrink-0 rounded-full"
            disabled={creating}
            onClick={async () => {
              setCreating(true);
              try {
                const list = sections || [];
                const created = await addSection(
                  'Ny seksjon',
                  'checklist',
                  (list.length ? list[list.length - 1].sort_order : 0) + 1,
                );
                setActiveSlug(created.slug);
              } finally {
                setCreating(false);
              }
            }}
          >
            {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          </Button>
        )}
      </div>

      {allergiesActive && (
        <Card className="border-border/60">
          <CardContent className="p-4 space-y-4">
            <div>
              <h2 className="text-lg font-heading font-bold text-foreground">Allergier</h2>
              <p className="text-xs text-muted-foreground">
                Matallergier og spesialkost for deltagerne denne perioden
              </p>
            </div>
            <KitchenAllergies />
          </CardContent>
        </Card>
      )}

      {!allergiesActive && active && (
        <Card className="border-border/60">
          <CardContent className="p-4 space-y-4">
            {/* Section header */}
            {editingHeader ? (
              <div className="space-y-2">
                <Input value={headerTitle} onChange={(e) => setHeaderTitle(e.target.value)} placeholder="Tittel" />
                <Textarea
                  value={headerBody}
                  onChange={(e) => setHeaderBody(e.target.value)}
                  placeholder="Innledning / guide-tekst"
                  rows={8}
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={async () => {
                      await updateSection(active.id, {
                        title: headerTitle.trim() || active.title,
                        body: headerBody.trim() || null,
                      });
                      setEditingHeader(false);
                    }}
                  >
                    <Check className="w-4 h-4 mr-1" />Lagre
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditingHeader(false)}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-lg font-heading font-bold text-foreground">{active.title}</h2>
                  {active.subtitle && (
                    <p className="text-xs text-muted-foreground">{active.subtitle}</p>
                  )}
                </div>
                {isAdmin && editMode && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 shrink-0"
                    onClick={() => {
                      setHeaderTitle(active.title);
                      setHeaderBody(active.body ?? '');
                      setEditingHeader(true);
                    }}
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                )}
              </div>
            )}

            {!editingHeader && active.body && <KitchenGuide body={active.body} />}

            {active.kind === 'checklist' && (
              <>
                {activeItems.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Fremdrift denne perioden</span>
                      <span>{doneCount}/{activeItems.length} gjort</span>
                    </div>
                    <Progress value={activeItems.length ? (doneCount / activeItems.length) * 100 : 0} className="h-1.5" />
                  </div>
                )}
                <KitchenChecklist
                  sectionId={active.id}
                  items={activeItems}
                  checks={checkMap}
                  leaderNames={leaderNames}
                  canEdit={isAdmin && editMode}
                />
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}