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
        .select("id, name, image_url, times_attended, room, cabin:cabins(name)")
        .eq("period_id", activePeriodId)
        .gte("times_attended", 4)
        .order("times_attended", { ascending: false })
        .order("name");
      setRows((data as any) || []);
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
        {renderList(newOnes)}
      </div>

      {veterans.length > 0 && (
        <div className="pt-4 border-t">
          <h3 className="text-sm font-semibold mb-2">Eksisterende ambassadører ({veterans.length})</h3>
          {renderList(veterans)}
        </div>
      )}
    </div>
  );
}