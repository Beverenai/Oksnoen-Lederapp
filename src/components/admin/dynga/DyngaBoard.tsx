import { useMemo, useState } from 'react';
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, PointerSensor, TouchSensor, useSensor, useSensors, closestCenter } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useDyngaCards, useDyngaColumns, useMoveCard, type DyngaCardWithParticipant } from '@/hooks/useDynga';
import { DyngaColumn } from './DyngaColumn';
import { DyngaCard } from './DyngaCard';
import { DyngaCardSheet } from './DyngaCardSheet';
import { Skeleton } from '@/components/ui/skeleton';

export function DyngaBoard() {
  const { data: columns = [], isLoading: cLoading } = useDyngaColumns();
  const { data: cards = [], isLoading: kLoading } = useDyngaCards();
  const moveCard = useMoveCard();
  const [activeCard, setActiveCard] = useState<DyngaCardWithParticipant | null>(null);
  const [openCardId, setOpenCardId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
  );

  const cardsByColumn = useMemo(() => {
    const map = new Map<string, DyngaCardWithParticipant[]>();
    columns.forEach(c => map.set(c.id, []));
    cards.forEach(card => {
      const arr = map.get(card.column_id) || [];
      arr.push(card);
      map.set(card.column_id, arr);
    });
    return map;
  }, [columns, cards]);

  const findCard = (id: string) => cards.find(c => c.id === id) || null;

  const handleDragStart = (e: DragStartEvent) => {
    const c = findCard(String(e.active.id));
    if (c) setActiveCard(c);
  };

  const handleDragEnd = (e: DragEndEvent) => {
    setActiveCard(null);
    const { active, over } = e;
    if (!over) return;
    const card = findCard(String(active.id));
    if (!card) return;

    // over.id can be a column id (empty column drop) or another card id
    const overId = String(over.id);
    const overCol = columns.find(c => c.id === overId);
    let targetColumnId: string;
    let targetIndex: number;

    if (overCol) {
      targetColumnId = overCol.id;
      targetIndex = (cardsByColumn.get(overCol.id) || []).length;
    } else {
      const overCard = findCard(overId);
      if (!overCard) return;
      targetColumnId = overCard.column_id;
      const list = cardsByColumn.get(targetColumnId) || [];
      targetIndex = list.findIndex(c => c.id === overCard.id);
    }

    if (card.column_id === targetColumnId) {
      const list = cardsByColumn.get(targetColumnId) || [];
      const currentIndex = list.findIndex(c => c.id === card.id);
      if (currentIndex === targetIndex) return;
    }

    // simple integer sort: insert at targetIndex by averaging neighbours' sort_order
    const list = (cardsByColumn.get(targetColumnId) || []).filter(c => c.id !== card.id);
    const before = list[targetIndex - 1]?.sort_order;
    const after = list[targetIndex]?.sort_order;
    let newOrder: number;
    if (before == null && after == null) newOrder = 0;
    else if (before == null) newOrder = (after as number) - 1;
    else if (after == null) newOrder = (before as number) + 1;
    else newOrder = Math.floor(((before as number) + (after as number)) / 2);
    if (before != null && after != null && newOrder === before) newOrder = before + 1;

    moveCard.mutate({ cardId: card.id, columnId: targetColumnId, sortOrder: newOrder });
  };

  if (cLoading || kLoading) {
    return (
      <div className="flex gap-3 overflow-x-auto pb-2">
        {[1, 2, 3, 4].map(i => (
          <Skeleton key={i} className="h-[500px] w-[280px] shrink-0 rounded-lg" />
        ))}
      </div>
    );
  }

  if (columns.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Ingen kolonner enda. Klikk "Kolonner" for å legge til.
      </div>
    );
  }

  return (
    <>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="flex gap-3 overflow-x-auto pb-3 -mx-2 px-2 snap-x">
          {columns.map(col => {
            const colCards = cardsByColumn.get(col.id) || [];
            return (
              <DyngaColumn key={col.id} column={col} count={colCards.length}>
                <SortableContext items={colCards.map(c => c.id)} strategy={verticalListSortingStrategy} id={col.id}>
                  {colCards.map(card => (
                    <DyngaCard key={card.id} card={card} onClick={() => setOpenCardId(card.id)} />
                  ))}
                </SortableContext>
              </DyngaColumn>
            );
          })}
        </div>
        <DragOverlay>
          {activeCard ? <DyngaCard card={activeCard} isOverlay /> : null}
        </DragOverlay>
      </DndContext>

      <DyngaCardSheet
        cardId={openCardId}
        card={openCardId ? cards.find(c => c.id === openCardId) ?? null : null}
        open={!!openCardId}
        onOpenChange={(o) => !o && setOpenCardId(null)}
      />
    </>
  );
}
