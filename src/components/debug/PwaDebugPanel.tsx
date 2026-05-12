import { useEffect, useState } from 'react';

interface DebugValues {
  innerH: number;
  innerW: number;
  docClientH: number;
  bodyClientH: number;
  visualVH: number | string;
  displayModeStandalone: boolean;
  navStandalone: boolean | string;
  safeTop: string;
  safeBottom: string;
  envSupported: boolean;
  navTop: number | string;
  navBottom: number | string;
  navHeight: number | string;
  viewport: string;
}

interface Culprit {
  tag: string;
  cls: string;
  prop: string;
  value: string;
}

function findCulprits(): Culprit[] {
  const out: Culprit[] = [];
  let el: HTMLElement | null = document.querySelector('.bottom-nav');
  while (el && el !== document.documentElement) {
    const cs = getComputedStyle(el);
    const checks: Array<[string, string, string]> = [
      ['transform', cs.transform, 'none'],
      ['filter', cs.filter, 'none'],
      ['perspective', cs.perspective, 'none'],
      ['contain', cs.contain, 'none'],
      ['willChange', cs.willChange, 'auto'],
      ['backdropFilter', (cs as any).backdropFilter ?? (cs as any).webkitBackdropFilter ?? 'none', 'none'],
    ];
    for (const [name, value, base] of checks) {
      if (value && value !== base) {
        out.push({
          tag: el.tagName,
          cls: (el.className?.toString?.() ?? '').slice(0, 60),
          prop: name,
          value: value.slice(0, 80),
        });
      }
    }
    el = el.parentElement;
  }
  return out;
}

function read(): DebugValues {
  const nav = document.querySelector('.bottom-nav') as HTMLElement | null;
  const rect = nav?.getBoundingClientRect();
  const meta = document.querySelector('meta[name="viewport"]') as HTMLMetaElement | null;
  const cs = getComputedStyle(document.documentElement);
  return {
    innerH: window.innerHeight,
    innerW: window.innerWidth,
    docClientH: document.documentElement.clientHeight,
    bodyClientH: document.body.clientHeight,
    visualVH: window.visualViewport?.height ?? '—',
    displayModeStandalone: window.matchMedia('(display-mode: standalone)').matches,
    navStandalone: (navigator as any).standalone ?? '—',
    safeTop: cs.getPropertyValue('--safe-top').trim() || '(empty)',
    safeBottom: cs.getPropertyValue('--safe-bottom').trim() || '(empty)',
    envSupported: CSS.supports('padding: env(safe-area-inset-bottom)'),
    navTop: rect ? Math.round(rect.top) : '(no .bottom-nav)',
    navBottom: rect ? Math.round(rect.bottom) : '(no .bottom-nav)',
    navHeight: rect ? Math.round(rect.height) : '(no .bottom-nav)',
    viewport: meta?.content ?? '(no meta)',
  };
}

export function PwaDebugPanel() {
  const [v, setV] = useState<DebugValues>(() => read());

  useEffect(() => {
    const update = () => setV(read());
    update();
    const id = window.setInterval(update, 500);
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    window.visualViewport?.addEventListener('resize', update);
    window.visualViewport?.addEventListener('scroll', update);
    return () => {
      window.clearInterval(id);
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
      window.visualViewport?.removeEventListener('resize', update);
      window.visualViewport?.removeEventListener('scroll', update);
    };
  }, []);

  const row = (k: string, val: unknown) => (
    <div style={{ display: 'flex', gap: 6 }}>
      <span style={{ opacity: 0.7 }}>{k}:</span>
      <span>{String(val)}</span>
    </div>
  );

  return (
    <div
      style={{
        position: 'fixed',
        top: 4,
        left: 4,
        zIndex: 99999,
        background: 'rgba(0,0,0,0.75)',
        color: '#fff',
        font: '10px/1.3 ui-monospace, SFMono-Regular, Menlo, monospace',
        textTransform: 'lowercase',
        padding: '6px 8px',
        borderRadius: 6,
        maxWidth: '70vw',
        pointerEvents: 'none',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-all',
      }}
      aria-hidden="true"
    >
      {row('innerH', v.innerH)}
      {row('innerW', v.innerW)}
      {row('docClientH', v.docClientH)}
      {row('bodyClientH', v.bodyClientH)}
      {row('visualVH', v.visualVH)}
      {row('standalone(mm)', v.displayModeStandalone)}
      {row('nav.standalone', v.navStandalone)}
      {row('--safe-top', v.safeTop)}
      {row('--safe-bottom', v.safeBottom)}
      {row('env() ok', v.envSupported)}
      {row('nav.top', v.navTop)}
      {row('nav.bottom', v.navBottom)}
      {row('nav.height', v.navHeight)}
      {row('viewport', v.viewport)}
    </div>
  );
}

export default PwaDebugPanel;