import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { ActivityRegistration, activityTimeline, checkInDefault, manualActivityRows, periodBounds, registrationKey } from './activityRegistration';
import { getUniqueCompletedCount, getStoreStyrkproveProgress } from './activityUtils';

describe('activity registrations', () => {
  test('Tube can repeat in a new registration but not twice in the same one', () => {
    const registration = new ActivityRegistration();
    const key = registrationKey('child', '0412', 'Tube');
    assert.equal(registration.add(key), true);
    assert.equal(registration.add(key), false);
    const oldSession = registration.sessionId;
    registration.start();
    assert.notEqual(registration.sessionId, oldSession);
    assert.equal(registration.add(key), true);
  });
  test('undo permits rescanning within the registration', () => {
    const registration = new ActivityRegistration();
    registration.add('child|tube'); registration.undo('child|tube');
    assert.equal(registration.add('child|tube'), true);
  });
  test('manual bulk save shares one session and a later save gets a new one', () => {
    const first = manualActivityRows(['one', 'two', 'one'], 'Tube', 'leader');
    assert.equal(first.length, 2);
    assert.equal(first[0].scan_session_id, first[1].scan_session_id);
    assert.notEqual(first[0].scan_session_id, manualActivityRows(['one'], 'Tube', 'leader')[0].scan_session_id);
    assert.equal(first[0].registered_by, 'leader');
  });
  test('timeline preserves all Tube occurrences newest first, grouped by Oslo day', () => {
    const rows = [{ id: 'a', activity: 'Tube', completed_at: '2027-07-01T10:00:00Z' }, { id: 'b', activity: 'Tube', completed_at: '2027-07-02T09:00:00Z' }, { id: 'c', activity: 'Tube', completed_at: '2027-07-01T22:30:00Z' }];
    assert.deepEqual(activityTimeline(rows).map(([day, entries]) => [day, entries.map(row => row.id)]), [['2027-07-02', ['b', 'c']], ['2027-07-01', ['a']]]);
  });
  test('check-in defaults on only on the period start date in Oslo', () => {
    assert.equal(checkInDefault('2027-07-02', new Date('2027-07-01T22:30:00Z')), true);
    assert.equal(checkInDefault('2027-07-02', new Date('2027-07-02T22:30:00Z')), false);
  });
  test('checklists and strength challenge count unique activities once', () => {
    assert.equal(getUniqueCompletedCount(['Tube', 'Tube', 'Tube']), 1);
    assert.equal(getStoreStyrkproveProgress(['Klatring', 'Klatring']).completed, 1);
  });
  test('leader overview covers all period dates in Oslo, excluding the next day', () => {
    assert.deepEqual(periodBounds('2027-07-01', '2027-07-07'), { start: '2027-06-30T22:00:00.000Z', end: '2027-07-07T22:00:00.000Z' });
  });
});