import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2, Search, Award } from "lucide-react";
import { useActivePeriodId } from "@/hooks/useActivePeriodId";

interface Row {
  id: string;
  name: string;
  image_url: string | null;
  times_attended: number | null;
  cabin: { name: string } | null;
  room: string | null;
  sweater_size: string | null;
  sweater_source: 'bought' | 'picked_up' | 'preordered' | null;
}

const SIZE_ORDER = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];

function sourceLabel(src: Row['sweater_source']): string {
  if (src === 'bought') return 'Kjøpt';
  if (src === 'picked_up') return 'Hentet';
  if (src === 'preordered') return 'Forhåndsbest.';
  return '';
}

export function AmbassadorsTab() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const { data: activePeriodId } = useActivePeriodId();

  useEffect(() => {
    if (!activePeriodId) return;
    setLoading(true);
    (async () => {
      const { data } = await supabase
        .from("participants")
        .select("id, name, image_url, times_attended, room, cabin:cabins(name), participant_sweaters(preordered_size, picked_up, picked_up_size, bought_on_camp, bought_size, period_id)")
        .eq("period_id", activePeriodId)
        .gte("times_attended", 4)
        .order("times_attended", { ascending: false })
        .order("name");
      const mapped: Row[] = ((data as any[]) || []).map((p) => {
        const sw = (p.participant_sweaters || []).find((s: any) => s.period_id === activePeriodId) || (p.participant_sweaters || [])[0];
        let size: string | null = null;
        let source: Row['sweater_source'] = null;
        if (sw?.bought_on_camp && sw?.bought_size) { size = sw.bought_size; source = 'bought'; }
        else if (sw?.picked_up && sw?.picked_up_size) { size = sw.picked_up_size; source = 'picked_up'; }
        else if (sw?.preordered_size) { size = sw.preordered_size; source = 'preordered'; }
        return {
          id: p.id, name: p.name, image_url: p.image_url,
          times_attended: p.times_attended, room: p.room, cabin: p.cabin,
          sweater_size: size ? size.toUpperCase() : null,
          sweater_source: source,
        };
      });
      setRows(mapped);
      setLoading(false);
    })();
  }, [activePeriodId]);

  const filtered = rows.filter((r) => r.name.toLowerCase().includes(search.toLowerCase()));
  const newOnes = filtered.filter((r) => (r.times_attended ?? 0) === 4);
  const veterans = filtered.filter((r) => (r.times_attended ?? 0) > 4);

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const renderList = (list: Row[]) => {
    if (list.length === 0) {
      return <p className="text-sm text-muted-foreground text-center py-8">Ingen deltakere</p>;
    }
    return (
      <div className="space-y-2">
        {list.map((p) => {
          const initials = p.name.split(" ").map((n) => n[0]).slice(0, 2).join("");
          const years = p.times_attended ?? 0;
          return (
            <Card key={p.id} className="p-3 flex items-center gap-3">
              <Avatar className="w-10 h-10">
                {p.image_url && <AvatarImage src={p.image_url} alt={p.name} />}
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{p.name}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {p.cabin?.name}{p.room ? ` • ${p.room}` : ""}
                </p>
              </div>
              {p.sweater_size ? (
                <Badge
                  variant="outline"
                  className="whitespace-nowrap"
                  title={sourceLabel(p.sweater_source)}
                >
                  Str. {p.sweater_size}
                </Badge>
              ) : (
                <Badge variant="secondary" className="whitespace-nowrap opacity-70">Ukjent str.</Badge>
              )}
              <Badge variant="secondary" className="gap-1">
                <Award className="w-3 h-3" />
                {years} år
              </Badge>
            </Card>
          );
        })}
      </div>
    );
  };

  const renderSizeSummary = (list: Row[]) => {
    const counts = new Map<string, number>();
    for (const r of list) {
      const key = r.sweater_size || 'Ukjent';
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    const entries = Array.from(counts.entries()).sort((a, b) => {
      const ai = SIZE_ORDER.indexOf(a[0]);
      const bi = SIZE_ORDER.indexOf(b[0]);
      if (ai === -1 && bi === -1) return a[0].localeCompare(b[0]);
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    });
    if (entries.length === 0) return null;
    return (
      <div className="flex flex-wrap gap-1.5 mb-3">
        {entries.map(([size, count]) => (
          <Badge key={size} variant="outline" className="text-xs">
            {size}: {count}
          </Badge>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Søk navn..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <div>
        <h3 className="text-sm font-semibold mb-2">Nye ambassadører i år ({newOnes.length})</h3>
        <p className="text-xs text-muted-foreground mb-3">
          Deltakere som har vært her 4 år – de blir ambassadører i år.
        </p>
        {renderSizeSummary(newOnes)}
        {renderList(newOnes)}
      </div>

      {veterans.length > 0 && (
        <div className="pt-4 border-t">
          <h3 className="text-sm font-semibold mb-2">Eksisterende ambassadører ({veterans.length})</h3>
          {renderSizeSummary(veterans)}
          {renderList(veterans)}
        </div>
      )}
    </div>
  );
}