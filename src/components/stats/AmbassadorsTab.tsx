import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2, Search, Award } from "lucide-react";

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

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("participants")
        .select("id, name, image_url, times_attended, room, cabin:cabins(name)")
        .gte("times_attended", 3)
        .order("times_attended", { ascending: false })
        .order("name");
      setRows((data as any) || []);
      setLoading(false);
    })();
  }, []);

  const filter = (list: Row[]) =>
    list.filter((r) => r.name.toLowerCase().includes(search.toLowerCase()));

  const becoming = filter(rows.filter((r) => (r.times_attended ?? 0) === 3));
  const existing = filter(rows.filter((r) => (r.times_attended ?? 0) >= 4));

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
                {years + 1}. år
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

      <Tabs defaultValue="becoming">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="becoming">Blir i år ({becoming.length})</TabsTrigger>
          <TabsTrigger value="existing">Eksisterende ({existing.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="becoming" className="mt-4">
          <p className="text-xs text-muted-foreground mb-3">
            Deltakere som har vært her 3 ganger før – dette er deres 4. år og de blir ambassadører.
          </p>
          {renderList(becoming)}
        </TabsContent>
        <TabsContent value="existing" className="mt-4">
          <p className="text-xs text-muted-foreground mb-3">
            Deltakere som allerede er ambassadører (4+ tidligere besøk).
          </p>
          {renderList(existing)}
        </TabsContent>
      </Tabs>
    </div>
  );
}