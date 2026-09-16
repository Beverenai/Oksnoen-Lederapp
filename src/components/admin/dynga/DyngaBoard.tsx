import { useMemo, useState } from 'react';
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, PointerSensor, TouchSensor, useSensor, useSensors, closestCenter } from '@dnd-kit/core';
import { SortableContext, horizontalListSortingStrategy, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useDyngaCards, useDyngaColumns, useMoveCard, useMoveColumn, type DyngaCardWithParticipant } from '@/hooks/useDynga';
import { SortableDyngaColumn } from './DyngaColumn';
import { DyngaCard } from './DyngaCard';
import { DyngaCardSheet } from './DyngaCardSheet';
import { Skeleton } from '@/components/ui/skeleton';

interface DyngaBoardProps {
  periodId?: string | null;
  readOnly?: boolean;
}

export function DyngaBoard({ periodId, readOnly }: DyngaBoardProps = {}) {
  const { data: columns = [], isLoading: cLoading } = useDyngaColumns(periodId);
  const { data: cards = [], isLoading: kLoading } = useDyngaCards(periodId);
  const moveCard = useMoveCard();
  const moveColumn = useMoveColumn();
  const [activeCard, setActiveCard] = useState<DyngaCardWithParticipant | null>(null);
  const [openCardId, setOpenCardId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
  );

  const allMode = periodId === DYNGA_ALL_PERIODS;

  // I «Alle perioder» slås kolonner med samme navn sammen på tvers av perioder.
  const displayColumns = useMemo(() => {
    if (!allMode) return columns;
    const byTitle = new Map<string, DyngaColumn>();
    columns.forEach((c) => {
      const key = (c.title || '').trim().toLowerCase();
      if (!byTitle.has(key)) byTitle.set(key, c);
    });
    return [...byTitle.values()].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  }, [allMode, columns]);

  const columnKeyById = useMemo(() => {
    const map = new Map<string, string>();
    if (!allMode) return map;
    const titleToId = new Map(displayColumns.map((c) => [(c.title || '').trim().toLowerCase(), c.id]));
    columns.forEach((c) => {
      const target = titleToId.get((c.title || '').trim().toLowerCase());
      if (target) map.set(c.id, target);
    });
    return map;
  }, [allMode, columns, displayColumns]);

  const cardsByColumn = useMemo(() => {
    const map = new Map<string, DyngaCardWithParticipant[]>();
    displayColumns.forEach(c => map.set(c.id, []));
    cards.forEach(card => {
      const colId = allMode ? (columnKeyById.get(card.column_id) ?? card.column_id) : card.column_id;
      const arr = map.get(colId) || [];
      arr.push(card);
      map.set(colId, arr);
    });
    return map;
  }, [displayColumns, cards, allMode, columnKeyById]);


  const findCard = (id: string) => cards.find(c => c.id === id) || null;

  const handleDragStart = (e: DragStartEvent) => {
    const c = findCard(String(e.active.id));
    if (c) setActiveCard(c);
  };

  const handleDragEnd = (e: DragEndEvent) => {
    setActiveCard(null);
    if (readOnly) return;
    const { active, over } = e;
    if (!over) return;

    const activeId = String(active.id);
    const overId = String(over.id);

    const activeCard = findCard(activeId);

    // Column reordering
    if (!activeCard) {
      const activeCol = columns.find(c => c.id === activeId);
      const overCol = columns.find(c => c.id === overId);
      if (!activeCol || !overCol || activeCol.id === overCol.id) return;

      const sorted = [...columns].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
      const currentIndex = sorted.findIndex(c => c.id === activeCol.id);
      const targetIndex = sorted.findIndex(c => c.id === overCol.id);
      if (currentIndex === targetIndex) return;

      const list = sorted.filter(c => c.id !== activeCol.id);
      const before = list[targetIndex - 1]?.sort_order;
      const after = list[targetIndex]?.sort_order;
      let newOrder: number;
      if (before == null && after == null) newOrder = 0;
      else if (before == null) newOrder = (after as number) - 1;
      else if (after == null) newOrder = (before as number) + 1;
      else newOrder = Math.floor(((before as number) + (after as number)) / 2);
      if (before != null && after != null && newOrder === before) newOrder = before + 1;

      moveColumn.mutate({ columnId: activeCol.id, sortOrder: newOrder });
      return;
    }

    // Card dropping
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

    if (activeCard.column_id === targetColumnId) {
      const list = cardsByColumn.get(targetColumnId) || [];
      const currentIndex = list.findIndex(c => c.id === activeCard.id);
      if (currentIndex === targetIndex) return;
    }

    const list = (cardsByColumn.get(targetColumnId) || []).filter(c => c.id !== activeCard.id);
    const before = list[targetIndex - 1]?.sort_order;
    const after = list[targetIndex]?.sort_order;
    let newOrder: number;
    if (before == null && after == null) newOrder = 0;
    else if (before == null) newOrder = (after as number) - 1;
    else if (after == null) newOrder = (before as number) + 1;
    else newOrder = Math.floor(((before as number) + (after as number)) / 2);
    if (before != null && after != null && newOrder === before) newOrder = before + 1;

    moveCard.mutate({ cardId: activeCard.id, columnId: targetColumnId, sortOrder: newOrder });
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
        <SortableContext items={columns.map(c => c.id)} strategy={horizontalListSortingStrategy}>
          <div className="flex gap-3 overflow-x-auto overflow-y-hidden pb-3 -mx-2 px-2 snap-x items-stretch h-full">
            {columns.map(col => {
              const colCards = cardsByColumn.get(col.id) || [];
              return (
                <SortableDyngaColumn key={col.id} column={col} count={colCards.length}>
                  <SortableContext items={colCards.map(c => c.id)} strategy={verticalListSortingStrategy} id={col.id}>
                    {colCards.map(card => (
                      <DyngaCard key={card.id} card={card} onClick={() => setOpenCardId(card.id)} />
                    ))}
                  </SortableContext>
                </SortableDyngaColumn>
              );
            })}
          </div>
        </SortableContext>
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
