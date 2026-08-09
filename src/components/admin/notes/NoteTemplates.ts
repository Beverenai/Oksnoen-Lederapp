export interface NoteTemplate {
  key: string;
  label: string;
  title: string;
  content: string;
}

export const NOTE_TEMPLATES: NoteTemplate[] = [
  {
    key: 'meeting',
    label: 'Møtenotat',
    title: 'Møtenotat',
    content:
      '<h2>Møtenotat</h2><div>Dato: </div><div>Til stede: </div><h3>Saker</h3><ul><li></li></ul><h3>Beslutninger</h3><ul><li></li></ul><h3>Oppgaver</h3><div>☐&nbsp;</div>',
  },
  {
    key: 'checklist',
    label: 'Sjekkliste',
    title: 'Sjekkliste',
    content: '<h2>Sjekkliste</h2><div>☐&nbsp;</div><div>☐&nbsp;</div><div>☐&nbsp;</div>',
  },
  {
    key: 'week',
    label: 'Ukeplan',
    title: 'Ukeplan',
    content:
      '<h2>Ukeplan</h2><h3>Mandag</h3><div>☐&nbsp;</div><h3>Tirsdag</h3><div>☐&nbsp;</div><h3>Onsdag</h3><div>☐&nbsp;</div><h3>Torsdag</h3><div>☐&nbsp;</div><h3>Fredag</h3><div>☐&nbsp;</div>',
  },
];