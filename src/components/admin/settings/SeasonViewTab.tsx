import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Archive, Eye, Lock } from 'lucide-react';
import { useSeasonView } from '@/contexts/SeasonViewContext';

/** Personal toggle that shows data from every period at once, read-only. */
export function SeasonViewTab() {
  const { seasonView, canUseSeasonView, setSeasonView } = useSeasonView();

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Archive className="h-4 w-4" />
            Hele sesongen
          </CardTitle>
          <CardDescription>
            Når sesongen er over kan du slå på sesongvisning for å se alle perioder samlet i
            passkontroll, statistikk, Gomla og nurse. Visningen gjelder bare deg.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-muted/40 p-4">
            <div className="min-w-0">
              <p className="flex items-center gap-2 text-sm font-medium">
                <Eye className="h-4 w-4 text-primary" />
                Vis alle perioder samlet
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Aktiv periode brukes fortsatt når denne er av.
              </p>
            </div>
            <Switch
              checked={seasonView}
              disabled={!canUseSeasonView}
              onCheckedChange={setSeasonView}
              aria-label="Vis alle perioder samlet"
            />
          </div>

          <div className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs">
            <Lock className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <p className="text-muted-foreground">
              Sesongvisning er <strong>kun lesing</strong>. Registrering av aktiviteter, salg i Gomla
              og notater er slått av så gammel data ikke endres ved uhell.
            </p>
          </div>

          {seasonView && (
            <Badge variant="outline" className="border-amber-500/40 text-amber-600 dark:text-amber-400">
              Arkivmodus er aktiv
            </Badge>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
