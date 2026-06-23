import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Send, Trash2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { nb } from 'date-fns/locale';
import { useAddComment, useDeleteComment, useDyngaComments, useRemoveCard, type DyngaCardWithParticipant } from '@/hooks/useDynga';
import { useAuth } from '@/contexts/AuthContext';
import { useStatusPopup } from '@/hooks/useStatusPopup';

interface Props {
  cardId: string | null;
  card: DyngaCardWithParticipant | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DyngaCardSheet({ cardId, card, open, onOpenChange }: Props) {
  const { effectiveLeader, isSuperAdmin } = useAuth();
  const { showSuccess, showError } = useStatusPopup();
  const { data: comments = [], isLoading } = useDyngaComments(cardId);
  const addComment = useAddComment();
  const deleteComment = useDeleteComment();
  const removeCard = useRemoveCard();
  const [body, setBody] = useState('');

  const p = card?.participant;
  const name = p?.name || 'Ukjent';
  const initials = name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

  const submit = async () => {
    if (!cardId || !effectiveLeader?.id || !body.trim()) return;
    try {
      await addComment.mutateAsync({ cardId, leaderId: effectiveLeader.id, body: body.trim() });
      setBody('');
    } catch (e: any) {
      showError('Kunne ikke lagre', e?.message || 'Ukjent feil');
    }
  };

  const remove = async () => {
    if (!cardId) return;
    if (!confirm(`Fjerne ${name} fra Dynga? Alle kommentarer slettes.`)) return;
    try {
      await removeCard.mutateAsync(cardId);
      showSuccess('Fjernet', `${name} er fjernet fra Dynga`);
      onOpenChange(false);
    } catch (e: any) {
      showError('Kunne ikke fjerne', e?.message || 'Ukjent feil');
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!cardId) return;
    try {
      await deleteComment.mutateAsync({ commentId, cardId });
    } catch (e: any) {
      showError('Kunne ikke slette', e?.message || 'Ukjent feil');
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md flex flex-col p-0">
        <SheetHeader className="px-4 pt-6 pb-3 border-b">
          <SheetTitle className="flex items-center gap-3">
            <Avatar className="h-12 w-12">
              {p?.image_url ? <AvatarImage src={p.image_url} alt={name} /> : null}
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
            <div className="text-left min-w-0">
              <div className="font-semibold truncate">{name}</div>
              <div className="text-xs text-muted-foreground font-normal">
                {p?.cabins?.name || 'Uten hytte'}
              </div>
            </div>
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : comments.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Ingen kommentarer enda</p>
          ) : (
            comments.map(c => {
              const canDelete = isSuperAdmin || c.leader_id === effectiveLeader?.id;
              return (
                <div key={c.id} className="rounded-lg border border-border bg-muted/30 p-3 space-y-1.5">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-medium truncate">{c.leader?.name || 'Ukjent'}</span>
                      <span className="text-muted-foreground">
                        {c.created_at ? formatDistanceToNow(new Date(c.created_at), { addSuffix: true, locale: nb }) : ''}
                      </span>
                    </div>
                    {canDelete && (
                      <button
                        onClick={() => handleDeleteComment(c.id)}
                        className="text-muted-foreground hover:text-destructive p-1"
                        aria-label="Slett"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                  <p className="text-sm whitespace-pre-wrap break-words">{c.body}</p>
                </div>
              );
            })
          )}
        </div>

        <div className="border-t p-3 space-y-2">
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Skriv en kommentar..."
            className="min-h-[70px] resize-none"
          />
          <div className="flex justify-between gap-2">
            <Button variant="ghost" size="sm" onClick={remove} className="text-destructive hover:text-destructive">
              <Trash2 className="h-4 w-4 mr-1.5" /> Fjern fra Dynga
            </Button>
            <Button size="sm" onClick={submit} disabled={!body.trim() || addComment.isPending}>
              {addComment.isPending ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Send className="h-4 w-4 mr-1.5" />}
              Legg til
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
