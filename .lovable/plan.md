

## Fix: @-mention nesting + flagg deltaker med helseinfo

### Problem
When typing `@` inside an existing participant section, the new section gets inserted INSIDE that section (nested). Also, participants with nurse notes are not flagged in `participant_health_info`.

### Solution

**1. Fix nesting — `insertParticipantSection` in `NurseReportEditor.tsx`**

Before inserting via `insertHTML`, check if the cursor is inside a `.participant-content` div. If so:
- Move cursor AFTER the parent `.participant-section` div
- Then insert the new section there

This ensures sections are always siblings, never nested.

```typescript
// Before inserting, escape from any existing participant section
const currentSection = range.startContainer.parentElement?.closest('.participant-section');
if (currentSection && editorRef.current) {
  const afterSection = document.createRange();
  afterSection.setStartAfter(currentSection);
  afterSection.collapse(true);
  sel.removeAllRanges();
  sel.addRange(afterSection);
}
```

**2. Flag participant with health info on save — `syncToParticipantNotes`**

After syncing notes to `participant_health_notes`, also upsert into `participant_health_info` for each mentioned participant. This makes them appear on the "Viktig Info" page and be flagged in participant lists.

```typescript
// Check if participant_health_info exists, if not create one
const { data: existingInfo } = await supabase
  .from('participant_health_info')
  .select('id')
  .eq('participant_id', pid)
  .limit(1);

if (!existingInfo || existingInfo.length === 0) {
  await supabase.from('participant_health_info').insert({
    participant_id: pid,
    info: `[Nurse] ${text}`,
  });
} else {
  // Update existing with nurse note appended
  await supabase.from('participant_health_info')
    .update({ info: `[Nurse] ${text}`, updated_at: new Date().toISOString() })
    .eq('id', existingInfo[0].id);
}
```

**3. Also fix @-detection inside participant-content**

The `handleInput` function needs to work correctly when the cursor is inside a `.participant-content` div — the mention popup position calculation should still use the editor's bounding rect.

### Files changed

| File | Change |
|------|--------|
| `src/components/nurse/NurseReportEditor.tsx` | Fix section nesting on insert, add `participant_health_info` upsert on save |

### What stays the same
- Database schema (no migrations needed — `participant_health_info` table already exists)
- RLS policies
- Editor look and feel (still feels like a doc)
- PDF export, search, paste handling

