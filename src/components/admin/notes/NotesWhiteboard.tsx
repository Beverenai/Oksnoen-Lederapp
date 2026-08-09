import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Eraser, Undo2, Trash2, Pen } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface Stroke {
  color: string;
  width: number;
  erase?: boolean;
  points: [number, number][];
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

  const redraw = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, W, H);
    const all = [...strokesRef.current, ...(drawingRef.current ? [drawingRef.current] : [])];
    for (const s of all) {
      if (s.points.length === 0) continue;
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

  useEffect(() => {
    strokesRef.current = Array.isArray(initialStrokes) ? initialStrokes : [];
    redraw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noteId]);

  const toBoard = (e: React.PointerEvent<HTMLCanvasElement>): [number, number] => {
    const rect = e.currentTarget.getBoundingClientRect();
    return [((e.clientX - rect.left) / rect.width) * W, ((e.clientY - rect.top) / rect.height) * H];
  };

  const commit = () => {
    onChange(strokesRef.current);
  };

  return (
    <div className="flex flex-col h-full min-h-0 gap-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <Button
          type="button"
          variant={erasing ? 'ghost' : 'secondary'}
          size="sm"
          className="h-8"
          onClick={() => setErasing(false)}
        >
          <Pen className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant={erasing ? 'secondary' : 'ghost'}
          size="sm"
          className="h-8"
          onClick={() => setErasing(true)}
        >
          <Eraser className="h-4 w-4" />
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
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8"
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
          className="w-full h-full touch-none"
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            drawingRef.current = {
              color: erasing ? '#000' : color,
              width: erasing ? width * 3 : width,
              erase: erasing,
              points: [toBoard(e)],
            };
            redraw();
          }}
          onPointerMove={(e) => {
            if (!drawingRef.current) return;
            drawingRef.current.points.push(toBoard(e));
            redraw();
          }}
          onPointerUp={() => {
            if (!drawingRef.current) return;
            strokesRef.current = [...strokesRef.current, drawingRef.current];
            drawingRef.current = null;
            redraw();
            commit();
          }}
          onPointerLeave={() => {
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