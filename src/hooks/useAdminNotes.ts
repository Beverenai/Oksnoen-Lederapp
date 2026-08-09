import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';

export type AdminNote = Tables<'admin_notes'>;
export type NoteKind = 'doc' | 'board';

export function useAdminNotes(enabled: boolean) {
  const [notes, setNotes] = useState<AdminNote[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [leaderNames, setLeaderNames] = useState<Record<string, string>>({});
  const activeIdRef = useRef<string | null>(null);
  activeIdRef.current = activeId;
  // Local edits that are not confirmed saved yet. Used so realtime/refetch
  // never overwrites text the user just typed.
  const pendingRef = useRef<Record<string, Partial<AdminNote>>>({});

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('admin_notes')
      .select('*')
      .order('is_pinned', { ascending: false })
      .order('updated_at', { ascending: false });
    const rows = (data || []).map((n) =>
      pendingRef.current[n.id] ? ({ ...n, ...pendingRef.current[n.id] } as AdminNote) : n,
    );
    setNotes(rows);
    setIsLoading(false);
    return rows;
  }, []);

  useEffect(() => {
    if (!enabled) return;
    load().then((rows) => {
      if (!activeIdRef.current && rows.length) setActiveId(rows[0].id);
    });
  }, [enabled, load]);

  useEffect(() => {
    if (!enabled) return;
    supabase
      .from('leaders')
      .select('id, name')
      .then(({ data }) => {
        const map: Record<string, string> = {};
        (data || []).forEach((l) => { map[l.id] = l.name; });
        setLeaderNames(map);
      });
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    const channel = supabase
      .channel('admin-notes-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'admin_notes' }, () => {
        load();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [enabled, load]);

  const createNote = useCallback(async (
    kind: NoteKind,
    opts?: { title?: string; content?: string },
  ) => {
    const { data: leaderId } = await supabase.rpc('current_leader_id');
    const { data, error } = await supabase
      .from('admin_notes')
      .insert({
        kind,
        title: opts?.title ?? (kind === 'board' ? 'Nytt whiteboard' : 'Nytt notat'),
        content: opts?.content ?? '',
        created_by: (leaderId as string) ?? null,
        updated_by: (leaderId as string) ?? null,
      })
      .select()
      .single();
    if (error) throw error;
    setNotes((prev) => [data, ...prev]);
    setActiveId(data.id);
    return data;
  }, []);

  const patchNote = useCallback(async (id: string, patch: Partial<AdminNote>) => {
    setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, ...patch } as AdminNote : n)));
    pendingRef.current[id] = { ...(pendingRef.current[id] || {}), ...patch };
    const { data: leaderId } = await supabase.rpc('current_leader_id');
    const { error } = await supabase
      .from('admin_notes')
      .update({ ...patch, updated_by: (leaderId as string) ?? null })
      .eq('id', id);
    if (error) throw error;
    // Drop only the fields we just persisted (newer edits may have queued since)
    const still = pendingRef.current[id];
    if (still) {
      Object.keys(patch).forEach((k) => {
        if (still[k as keyof AdminNote] === patch[k as keyof AdminNote]) {
          delete still[k as keyof AdminNote];
        }
      });
      if (Object.keys(still).length === 0) delete pendingRef.current[id];
    }
  }, []);

  const duplicateNote = useCallback(async (note: AdminNote) => {
    const { data: leaderId } = await supabase.rpc('current_leader_id');
    const { data, error } = await supabase
      .from('admin_notes')
      .insert({
        kind: note.kind,
        title: `${note.title} (kopi)`,
        content: note.content,
        strokes: note.strokes,
        created_by: (leaderId as string) ?? null,
        updated_by: (leaderId as string) ?? null,
      })
      .select()
      .single();
    if (error) throw error;
    setNotes((prev) => [data, ...prev]);
    setActiveId(data.id);
    return data;
  }, []);

  const deleteNote = useCallback(async (id: string) => {
    const { error } = await supabase.from('admin_notes').delete().eq('id', id);
    if (error) throw error;
    delete pendingRef.current[id];
    setNotes((prev) => {
      const next = prev.filter((n) => n.id !== id);
      if (activeIdRef.current === id) setActiveId(next[0]?.id ?? null);
      return next;
    });
  }, []);

  return {
    notes, isLoading, activeId, setActiveId, createNote, patchNote, deleteNote,
    duplicateNote, leaderNames, reload: load,
  };
}