

## Fix: OK-knappen i StatusPopup fungerer ikke

### Problem
StatusPopup renderes inne i React-treet, men Sheet-komponenten (Radix) bruker en portal som legger seg over. Selv om z-index er 9999, kan Radix-portalen fange klikk-hendelser.

### Løsning
Render StatusPopup via `createPortal` til `document.body` slik at den alltid er øverst i DOM-treet og ikke blokkeres av andre portaler.

### Endring

| Fil | Endring |
|-----|--------|
| `src/hooks/useStatusPopup.tsx` | Wrap `<StatusPopup>` i `createPortal(…, document.body)` |

