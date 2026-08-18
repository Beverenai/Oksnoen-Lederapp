import { useState } from 'react';
import { AlertTriangle, CheckCircle2, ChevronDown } from 'lucide-react';
import {
  ISSUE_LABEL,
  groupIssues,
  type LeirskoleIssue,
  type LeirskoleIssueType,
} from '@/lib/leirskoleValidate';
import { dayLabel } from '@/lib/leirskoleDates';

const TONE: Record<LeirskoleIssueType, string> = {
  missing_leader: 'border-amber-500/50 text-amber-700 dark:text-amber-200',
  over_hours: 'border-destructive/50 text-destructive',
  short_rest: 'border-destructive/50 text-destructive',
  double_booked: 'border-destructive/50 text-destructive',
  unstaffed: 'border-sky-500/50 text-sky-700 dark:text-sky-300',
};

/** Statuslinje over ukebordet: alle brudd gruppert, hver linje hopper til ruten. */
export function LeirskoleBoardIssues({
  issues,
  onJump,
}: {
  issues: LeirskoleIssue[];
  onJump: (issue: LeirskoleIssue) => void;
}) {
  const [open, setOpen] = useState<LeirskoleIssueType | null>(null);
  const groups = groupIssues(issues);

  if (issues.length === 0) {
    return (
      <div className="rounded-2xl border border-emerald-500/50 bg-emerald-500/10 px-3 py-2">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-emerald-700 dark:text-emerald-300">
          <CheckCircle2 className="h-4 w-4" /> Uken er komplett — ingen brudd funnet
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-1.5 rounded-2xl border border-amber-500/50 bg-amber-500/10 p-2">
      <p className="flex items-center gap-1.5 px-1 text-sm font-semibold text-amber-800 dark:text-amber-200">
        <AlertTriangle className="h-4 w-4" /> {issues.length} ting å se på
      </p>
      {groups.map(([type, list]) => (
        <div key={type} className={`rounded-xl border bg-background/70 ${TONE[type]}`}>
          <button
            type="button"
            onClick={() => setOpen(open === type ? null : type)}
            className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm font-semibold"
          >
            <span>
              {ISSUE_LABEL[type]} <span className="opacity-70">· {list.length}</span>
            </span>
            <ChevronDown className={`h-4 w-4 transition-transform ${open === type ? 'rotate-180' : ''}`} />
          </button>
          {open === type && (
            <div className="space-y-1 px-2 pb-2">
              {list.map((issue, i) => (
                <button
                  key={`${issue.date}-${issue.label}-${i}`}
                  type="button"
                  onClick={() => onJump(issue)}
                  className="flex w-full items-center gap-2 rounded-lg bg-muted/50 px-2 py-1.5 text-left text-sm text-foreground hover:bg-muted"
                >
                  <span className="w-20 shrink-0 text-xs font-bold uppercase text-muted-foreground">
                    {dayLabel(issue.date)}
                  </span>
                  <span className="w-16 shrink-0 text-xs font-semibold">{issue.label}</span>
                  <span className="min-w-0 flex-1 truncate">{issue.message}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
