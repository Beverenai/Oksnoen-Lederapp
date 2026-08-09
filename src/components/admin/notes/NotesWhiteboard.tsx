import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Eraser, Undo2, Trash2, Pen, Type, Hand, ZoomIn, ZoomOut, Download, Maximize } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface Stroke {
  color: string;
  width: number;
  erase?: boolean;
  points: [number, number][];
  text?: string;
}

const COLORS = ['#0f172a', '#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#a855f7'];
const WIDTHS = [2, 5, 12];
const W = 1600;
const H = 1000;

interface NotesWhiteboardProps {
  noteId: string;
  initialStrokes: Stroke[];
  onChange: (strokes: Stroke[]) => void;
}

export function NotesWhiteboard({ noteId, initialStrokes, onChange }: NotesWhiteboardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const strokesRef = useRef<Stroke[]>(initialStrokes);
  const drawingRef = useRef<Stroke | null>(null);
  const [color, setColor] = useState(COLORS[0]);
  const [width, setWidth] = useState(WIDTHS[1]);
  const [erasing, setErasing] = useState(false);
  const [tool, setTool] = useState<'pen' | 'text' | 'pan'>('pen');
  const [view, setView] = useState({ zoom: 1, x: 0, y: 0 });
  const viewRef = useRef(view);
  viewRef.current = view;
  const panRef = useRef<{ x: number; y: number } | null>(null);

  const redraw = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const v = viewRef.current;
    ctx.setTransform(v.zoom, 0, 0, v.zoom, v.x, v.y);
    const all = [...strokesRef.current, ...(drawingRef.current ? [drawingRef.current] : [])];
    for (const s of all) {
      if (s.points.length === 0) continue;
      if (s.text) {
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = s.color;
        ctx.font = `${Math.max(18, s.width * 6)}px system-ui, sans-serif`;
        ctx.textBaseline = 'top';
        ctx.fillText(s.text, s.points[0][0], s.points[0][1]);
        continue;
      }
      ctx.globalCompositeOperation = s.erase ? 'destination-out' : 'source-over';
      ctx.strokeStyle = s.color;
      ctx.lineWidth = s.width;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(s.points[0][0], s.points[0][1]);
      for (const [x, y] of s.points.slice(1)) ctx.lineTo(x, y);
      if (s.points.length === 1) ctx.lineTo(s.points[0][0] + 0.1, s.points[0][1]);
      ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-over';
  };

  useEffect(() => { redraw(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [view]);

  useEffect(() => {
    strokesRef.current = Array.isArray(initialStrokes) ? initialStrokes : [];
    redraw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noteId]);

  const toBoard = (e: React.PointerEvent<HTMLCanvasElement>): [number, number] => {
    const rect = e.currentTarget.getBoundingClientRect();
    const { zoom, x, y } = viewRef.current;
    const px = ((e.clientX - rect.left) / rect.width) * W;
    const py = ((e.clientY - rect.top) / rect.height) * H;
    return [(px - x) / zoom, (py - y) / zoom];
  };

  const commit = () => {
    onChange(strokesRef.current);
  };

  const downloadPng = () => {
    const src = canvasRef.current;
    if (!src) return;
    const out = document.createElement('canvas');
    out.width = W;
    out.height = H;
    const ctx = out.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);
    ctx.drawImage(src, 0, 0);
    const a = document.createElement('a');
    a.href = out.toDataURL('image/png');
    a.download = 'whiteboard.png';
    a.click();
  };

  return (
    <div className="flex flex-col h-full min-h-0 gap-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <Button
          type="button"
          variant={tool === 'pen' && !erasing ? 'secondary' : 'ghost'}
          size="sm"
          className="h-8"
          title="Penn"
          onClick={() => { setErasing(false); setTool('pen'); }}
        >
          <Pen className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant={erasing ? 'secondary' : 'ghost'}
          size="sm"
          className="h-8"
          title="Viskelær"
          onClick={() => { setErasing(true); setTool('pen'); }}
        >
          <Eraser className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant={tool === 'text' ? 'secondary' : 'ghost'}
          size="sm"
          className="h-8"
          title="Tekstboks"
          onClick={() => { setErasing(false); setTool('text'); }}
        >
          <Type className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant={tool === 'pan' ? 'secondary' : 'ghost'}
          size="sm"
          className="h-8"
          title="Flytt (pan)"
          onClick={() => { setErasing(false); setTool('pan'); }}
        >
          <Hand className="h-4 w-4" />
        </Button>
        <div className="flex items-center gap-1 pl-1">
          {COLORS.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={`Farge ${c}`}
              onClick={() => { setColor(c); setErasing(false); }}
              className={cn(
                'h-6 w-6 rounded-full border-2 transition-transform',
                color === c && !erasing ? 'border-foreground scale-110' : 'border-transparent',
              )}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
        <div className="flex items-center gap-1 pl-1">
          {WIDTHS.map((w) => (
            <button
              key={w}
              type="button"
              aria-label={`Tykkelse ${w}`}
              onClick={() => setWidth(w)}
              className={cn(
                'h-7 w-7 rounded-lg border flex items-center justify-center',
                width === w ? 'border-foreground bg-muted' : 'border-border/60',
              )}
            >
              <span className="rounded-full bg-foreground" style={{ width: w + 2, height: w + 2 }} />
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1 ml-auto">
          <Button type="button" variant="ghost" size="sm" className="h-8" title="Zoom ut"
            onClick={() => setView((v) => ({ ...v, zoom: Math.max(0.5, +(v.zoom - 0.25).toFixed(2)) }))}>
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="text-xs text-muted-foreground w-10 text-center">{Math.round(view.zoom * 100)}%</span>
          <Button type="button" variant="ghost" size="sm" className="h-8" title="Zoom inn"
            onClick={() => setView((v) => ({ ...v, zoom: Math.min(4, +(v.zoom + 0.25).toFixed(2)) }))}>
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button type="button" variant="ghost" size="sm" className="h-8" title="Tilbakestill visning"
            onClick={() => setView({ zoom: 1, x: 0, y: 0 })}>
            <Maximize className="h-4 w-4" />
          </Button>
          <Button type="button" variant="ghost" size="sm" className="h-8" title="Last ned som PNG" onClick={downloadPng}>
            <Download className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8"
            title="Angre"
            onClick={() => {
              strokesRef.current = strokesRef.current.slice(0, -1);
              redraw();
              commit();
            }}
          >
            <Undo2 className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 text-destructive"
            title="Tøm"
            onClick={() => {
              strokesRef.current = [];
              redraw();
              commit();
            }}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-hidden rounded-2xl border border-border/60 bg-background">
        <canvas
          ref={canvasRef}
          width={W}
          height={H}
          className={cn('w-full h-full touch-none', tool === 'pan' && 'cursor-grab', tool === 'text' && 'cursor-text')}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            if (tool === 'pan') {
              panRef.current = { x: e.clientX, y: e.clientY };
              return;
            }
            if (tool === 'text') {
              const at = toBoard(e);
              const text = window.prompt('Tekst:');
              if (text && text.trim()) {
                strokesRef.current = [...strokesRef.current, { color, width, points: [at], text: text.trim() }];
                redraw();
                commit();
              }
              return;
            }
            drawingRef.current = {
              color: erasing ? '#000' : color,
              width: erasing ? width * 3 : width,
              erase: erasing,
              points: [toBoard(e)],
            };
            redraw();
          }}
          onPointerMove={(e) => {
            if (panRef.current) {
              const dx = e.clientX - panRef.current.x;
              const dy = e.clientY - panRef.current.y;
              panRef.current = { x: e.clientX, y: e.clientY };
              setView((v) => ({ ...v, x: v.x + dx * 1.5, y: v.y + dy * 1.5 }));
              return;
            }
            if (!drawingRef.current) return;
            drawingRef.current.points.push(toBoard(e));
            redraw();
          }}
          onPointerUp={() => {
            panRef.current = null;
            if (!drawingRef.current) return;
            strokesRef.current = [...strokesRef.current, drawingRef.current];
            drawingRef.current = null;
            redraw();
            commit();
          }}
          onPointerLeave={() => {
            panRef.current = null;
            if (!drawingRef.current) return;
            strokesRef.current = [...strokesRef.current, drawingRef.current];
            drawingRef.current = null;
            redraw();
            commit();
          }}
        />
      </div>
    </div>
  );
}