export const ADMIN_NOTES_OPEN_EVENT = 'open-admin-notes';

/** Åpner notat-panelet (valgfritt på et bestemt notat) fra hvor som helst i appen */
export function openAdminNotes(noteId?: string) {
  window.dispatchEvent(new CustomEvent(ADMIN_NOTES_OPEN_EVENT, { detail: { noteId } }));
}
