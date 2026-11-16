import { describe, test, expect } from 'bun:test';
import { arrivalChangeIds, arrivalTime, saveSessionWithHistory } from './participantHistory';
import type { SessionsPayload } from '@/components/admin/SessionActivitiesSheet';

describe('arrival registration', () => {
  const children = [{ id: 'arrived', has_arrived: true }, { id: 'waiting', has_arrived: false }, { id: 'unset', has_arrived: null }];
  test('whole-cabin arrival includes only children who have not arrived', () => {
    expect(arrivalChangeIds(children, true)).toEqual(['waiting', 'unset']);
  });
  test('removing arrival includes only arrived selected children', () => {
    expect(arrivalChangeIds(children.slice(0, 2), false)).toEqual(['arrived']);
  });
  test('arrival time uses Oslo local time', () => {
    expect(arrivalTime('2026-11-16T13:32:00Z')).toBe('14.32');
  });
});

describe('session history', () => {
  test('saving only a changed active session still appends the entire payload', async () => {
    const payload: SessionsPayload = { active: 2, sessions: { '1': { reminder: 'Husk bilder', items: ['Kano'] }, '2': { reminder: '', items: ['Hest'] }, '3': { reminder: '', items: [] } } };
    const writes: { table: string; row: any }[] = [];
    const client = { from: (table: string) => ({
      upsert: async (row: any) => { writes.push({ table, row }); return { error: null }; },
      insert: async (row: any) => { writes.push({ table, row }); return { error: null }; },
    }) } as unknown as Parameters<typeof saveSessionWithHistory>[4];
    await saveSessionWithHistory('session_activities_data:period', payload, 'period', 'leader', client);
    expect(JSON.parse(writes[0].row.value)).toEqual(payload);
    expect(writes[1]).toEqual({ table: 'session_log', row: { period_id: 'period', active_session: 2, sessions: payload, saved_by: 'leader' } });
  });
  test('failed history insert is not reported as a successful save', async () => {
    const client = { from: () => ({ upsert: async () => ({ error: null }), insert: async () => ({ error: { message: 'denied' } }) }) } as unknown as Parameters<typeof saveSessionWithHistory>[4];
    const payload: SessionsPayload = { active: 1, sessions: { '1': { reminder: '', items: [] }, '2': { reminder: '', items: [] }, '3': { reminder: '', items: [] } } };
    await expect(saveSessionWithHistory('key', payload, null, 'leader', client)).rejects.toThrow('historikken kunne ikke lagres');
  });
});