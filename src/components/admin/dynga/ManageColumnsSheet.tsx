import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { useDeleteColumn, useDyngaColumns, useUpsertColumn } from '@/hooks/useDynga';
import { useStatusPopup } from '@/hooks/useStatusPopup';
import { cn } from '@/lib/utils';

interface Props { open: boolean; onOpenChange: (o: boolean) => void; }

const COLORS = [
  { key: 'muted', cls: 'bg-muted-foreground' },
  { key: 'green', cls: 'bg-emerald-500' },
  { key: 'amber', cls: 'bg-amber-500' },
  { key: 'blue', cls: 'bg-blue-500' },
  { key: 'red', cls: 'bg-red-500' },
  { key: 'purple', cls: 'bg-purple-500' },
];

export function ManageColumnsSheet({ open, onOpenChange }: Props) {
  const { showSuccess, showError } = useStatusPopup();
  const { data: columns = [] } = useDyngaColumns();
  const upsert = useUpsertColumn();
  const del = useDeleteColumn();
  const [newTitle, setNewTitle] = useState('');
  const [newColor, setNewColor] = useState('muted');

  const handleAdd = async () => {
    if (!newTitle.trim()) return;
    try {
      await upsert.mutateAsync({
        title: newTitle.trim(),
        color: newColor,
        sort_order: (columns[columns.length - 1]?.sort_order ?? -1) + 1,
      });
      setNewTitle('');
      setNewColor('muted');
    } catch (e: any) {
      showError('Kunne ikke lagre', e?.message || 'Ukjent feil');
    }
  };

  const handleUpdate = async (id: string, patch: { title?: string; color?: string; sort_order?: number }) => {
    const col = columns.find(c => c.id === id);
    if (!col) return;
    try {
      await upsert.mutateAsync({
        id,
        title: patch.title ?? col.title,
        color: patch.color ?? col.color,
        sort_order: patch.sort_order ?? col.sort_order,
      });
    } catch (e: any) {
      showError('Kunne ikke lagre', e?.message || 'Ukjent feil');
    }
  };

  const handleDelete = async (id: string) => {
    if (columns.length <= 1) {
      showError('Kan ikke slette', 'Du må ha minst én kolonne');
      return;
    }
    if (!confirm('Slette kolonnen? Eventuelle kort flyttes til første gjenværende kolonne.')) return;
    const fallback = columns.find(c => c.id !== id)?.id || null;
    try {
      await del.mutateAsync({ columnId: id, fallbackColumnId: fallback });
      showSuccess('Slettet', 'Kolonne fjernet');
    } catch (e: any) {
      showError('Kunne ikke slette', e?.message || 'Ukjent feil');
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md flex flex-col p-0">
        <SheetHeader className="px-4 pt-6 pb-3 border-b">
          <SheetTitle>Kolonner</SheetTitle>
          <SheetDescription>Tilpass kolonnene på Dynga-tavla</SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {columns.map(col => (
            <div key={col.id} className="border rounded-lg p-3 space-y-2 bg-card">
              <Input
                defaultValue={col.title}
                onBlur={(e) => {
                  const v = e.target.value.trim();
                  if (v && v !== col.title) handleUpdate(col.id, { title: v });
                }}
              />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  {COLORS.map(c => (
                    <button
                      key={c.key}
                      onClick={() => handleUpdate(col.id, { color: c.key })}
                      className={cn(
                        'w-6 h-6 rounded-full border-2 transition-all',
                        c.cls,
                        col.color === c.key ? 'border-foreground scale-110' : 'border-transparent',
                      )}
                      aria-label={c.key}
                    />
                  ))}
                </div>
                <Button variant="ghost" size="sm" onClick={() => handleDelete(col.id)} className="text-destructive hover:text-destructive">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
        <div className="border-t p-4 space-y-2">
          <Input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Ny kolonnetittel..."
          />
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              {COLORS.map(c => (
                <button
                  key={c.key}
                  onClick={() => setNewColor(c.key)}
                  className={cn(
                    'w-6 h-6 rounded-full border-2 transition-all',
                    c.cls,
                    newColor === c.key ? 'border-foreground scale-110' : 'border-transparent',
                  )}
                  aria-label={c.key}
                />
              ))}
            </div>
            <Button size="sm" onClick={handleAdd} disabled={!newTitle.trim() || upsert.isPending}>
              {upsert.isPending ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Plus className="h-4 w-4 mr-1.5" />}
              Legg til
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
