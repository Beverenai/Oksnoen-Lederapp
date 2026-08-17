import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Check } from 'lucide-react';
import { LEIRSKOLE_COMPETENCIES } from '@/lib/leirskoleCompetencies';
import { useSaveLeirskoleCompetencies } from '@/hooks/useLeirskole';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leaderId: string;
  leaderName?: string;
  current: string[];
  /** Første gang: må velge minst én før man kan lukke. */
  required?: boolean;
  /** Marker at lederen selv har bekreftet kompetansen. */
  confirm?: boolean;
}

export function LeirskoleCompetenceSheet({
  open,
  onOpenChange,
  leaderId,
  leaderName,
  current,
  required = false,
  confirm = false,
}: Props) {
  const [selected, setSelected] = useState<string[]>(current);
  const save = useSaveLeirskoleCompetencies();

  useEffect(() => {
    if (open) setSelected(current);
  }, [open, current]);

  const toggle = (key: string) =>
    setSelected((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));

  const submit = async () => {
    if (required && selected.length === 0) {
      toast.error('Velg minst én kompetanse');
      return;
    }
    try {
      await save.mutateAsync({ leaderId, competencies: selected, confirm });
      toast.success('Kompetanse lagret');
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message ?? 'Kunne ikke lagre');
    }
  };

  return (
    <Sheet
      open={open}
      onOpenChange={(v) => {
        if (!v && required && selected.length === 0) return;
        onOpenChange(v);
      }}
    >
      <SheetContent side="bottom" className="max-h-[92dvh] overflow-y-auto rounded-t-3xl">
        <SheetHeader className="text-left">
          <SheetTitle>Din kompetanse{leaderName ? ` · ${leaderName}` : ''}</SheetTitle>
          <SheetDescription>
            Hva kan du ha ansvar for på leirskolen? Dette brukes når vaktplanen settes opp.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 grid grid-cols-2 gap-2">
          {LEIRSKOLE_COMPETENCIES.map((c) => {
            const active = selected.includes(c.key);
            return (
              <button
                key={c.key}
                type="button"
                onClick={() => toggle(c.key)}
                className={`relative flex flex-col items-start gap-1 rounded-2xl border p-3 text-left transition-colors ${
                  active ? 'border-primary bg-primary/10' : 'border-border/60 bg-card/60'
                }`}
              >
                <span className="text-xl" aria-hidden>{c.emoji}</span>
                <span className="text-sm font-medium">{c.label}</span>
                {active && <Check className="absolute right-2 top-2 h-4 w-4 text-primary" />}
              </button>
            );
          })}
        </div>

        <div className="mt-5 flex gap-2 pb-2">
          {!required && (
            <Button variant="secondary" className="flex-1" onClick={() => onOpenChange(false)}>
              Avbryt
            </Button>
          )}
          <Button className="flex-1" onClick={submit} disabled={save.isPending}>
            {save.isPending ? 'Lagrer…' : 'Lagre'}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
