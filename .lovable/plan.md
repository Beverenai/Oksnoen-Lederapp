Jeg vil gjøre en ren layout-fiks for iPhone/PWA slik at nederste grønne område faktisk blir brukt av menyen, ikke bare fylt visuelt.

## Plan
1. Justere `AppLayout` slik at mobilens bunnmeny får riktig høyde og intern plassering i stedet for å ha trykkflatene hengende for høyt over safe-area.
2. Oppdatere CSS for `.bottom-nav` og `.app-content` så safe-area nederst blir en del av selve menyens aktive område, samtidig som innholdet fortsatt får korrekt avstand over menyen.
3. Fjerne rester av tidligere workaround-logikk som kan skape konflikt mellom `100dvh`, fixed-nav og iOS standalone/PWA-visning.
4. Verifisere spesielt på admin-siden i mobiloppsett at menyen ligger helt ned mot bunnen og at det ikke står igjen et dødt felt nederst.

## Teknisk
- Fokusfiler: `src/components/layout/AppLayout.tsx` og `src/index.css`
- Sannsynlig rotårsak: safe-area er dekorativt dekket, men interaktiv nav-rad er fortsatt posisjonert over nederste inset
- Målet er å la hele nederste PWA-området eies av bunnnavigasjonen, uten ekstra blank/dead space