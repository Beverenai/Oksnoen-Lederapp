import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Home, Save, Loader2, Search, Users } from "lucide-react";
import { hapticSuccess, hapticError } from "@/lib/capacitorHaptics";

interface Cabin {
  id: string;
  name: string;
}

interface Leader {
  id: string;
  name: string;
}

interface CabinWithLeaders extends Cabin {
  leaders: Leader[];
  report: string;
  updated_at: string | null;
}

export const CabinReportsTab = () => {
  const [cabinsWithLeaders, setCabinsWithLeaders] = useState<CabinWithLeaders[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [savingCabin, setSavingCabin] = useState<string | null>(null);
  const [editedReports, setEditedReports] = useState<Record<string, string>>({});

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // Fetch cabins
      const { data: cabins, error: cabinsError } = await supabase
        .from("cabins")
        .select("id, name")
        .order("sort_order");

      if (cabinsError) throw cabinsError;

      // Fetch leader_cabins with leader info
      const { data: leaderCabins, error: lcError } = await supabase
        .from("leader_cabins")
        .select(`
          cabin_id,
          leaders!leader_cabins_leader_id_fkey (
            id,
            name,
            is_active
          )
        `);

      if (lcError) throw lcError;

      // Fetch cabin reports
      const { data: reports, error: reportsError } = await supabase
        .from("cabin_reports")
        .select("cabin_id, content, updated_at");

      if (reportsError) throw reportsError;

      // Build cabin -> leaders map
      const cabinLeadersMap = new Map<string, Leader[]>();
      leaderCabins?.forEach((lc: any) => {
        if (lc.leaders?.is_active) {
          const existing = cabinLeadersMap.get(lc.cabin_id) || [];
          existing.push({ id: lc.leaders.id, name: lc.leaders.name });
          cabinLeadersMap.set(lc.cabin_id, existing);
        }
      });

      // Build reports map
      const reportsMap = new Map<string, { content: string; updated_at: string | null }>();
      reports?.forEach((r) => {
        reportsMap.set(r.cabin_id, { content: r.content || "", updated_at: r.updated_at });
      });

      // Only include cabins that have at least one leader
      const result: CabinWithLeaders[] = cabins
        ?.filter(cabin => cabinLeadersMap.has(cabin.id))
        .map(cabin => ({
          ...cabin,
          leaders: cabinLeadersMap.get(cabin.id) || [],
          report: reportsMap.get(cabin.id)?.content || "",
          updated_at: reportsMap.get(cabin.id)?.updated_at || null,
        })) || [];

      setCabinsWithLeaders(result);
      
      // Initialize edited reports
      const initialReports: Record<string, string> = {};
      result.forEach(c => {
        initialReports[c.id] = c.report;
      });
      setEditedReports(initialReports);
    } catch (error) {
      console.error("Error loading cabin data:", error);
      toast.error("Kunne ikke laste hyttedata");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (cabinId: string) => {
    setSavingCabin(cabinId);
    try {
      const content = editedReports[cabinId] || "";
      
      const { error } = await supabase
        .from("cabin_reports")
        .upsert({
          cabin_id: cabinId,
          content,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: "cabin_id"
        });

      if (error) throw error;
      
      // Update local state
      setCabinsWithLeaders(prev => 
        prev.map(c => c.id === cabinId ? { ...c, report: content, updated_at: new Date().toISOString() } : c)
      );
      
      hapticSuccess();
      toast.success("Hytterapport lagret");
    } catch (error) {
      console.error("Error saving cabin report:", error);
      hapticError();
      toast.error("Kunne ikke lagre hytterapport");
    } finally {
      setSavingCabin(null);
    }
  };

  const handleReportChange = (cabinId: string, content: string) => {
    setEditedReports(prev => ({ ...prev, [cabinId]: content }));
  };

  const filteredCabins = cabinsWithLeaders.filter(cabin =>
    cabin.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    cabin.leaders.some(l => l.name.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Søk etter hytte eller leder..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      <p className="text-sm text-muted-foreground">
        Viser {filteredCabins.length} hytter med ledere
      </p>

      <div className="space-y-4">
        {filteredCabins.map((cabin) => (
          <Card key={cabin.id}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Home className="h-4 w-4 text-muted-foreground" />
                  {cabin.name}
                </CardTitle>
                <Button
                  size="sm"
                  onClick={() => handleSave(cabin.id)}
                  disabled={savingCabin === cabin.id}
                >
                  {savingCabin === cabin.id ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-1" />
                  ) : (
                    <Save className="h-4 w-4 mr-1" />
                  )}
                  Lagre
                </Button>
              </div>
              <div className="flex items-center gap-2 flex-wrap mt-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                {cabin.leaders.map((leader) => (
                  <Badge key={leader.id} variant="secondary" className="text-xs">
                    {leader.name.split(" ")[0]}
                  </Badge>
                ))}
              </div>
            </CardHeader>
            <CardContent>
              <Textarea
                placeholder="Skriv hytterapport her..."
                value={editedReports[cabin.id] || ""}
                onChange={(e) => handleReportChange(cabin.id, e.target.value)}
                className="min-h-[100px] resize-none"
              />
              {cabin.updated_at && (
                <p className="text-xs text-muted-foreground mt-2">
                  Sist oppdatert: {new Date(cabin.updated_at).toLocaleString("nb-NO")}
                </p>
              )}
            </CardContent>
          </Card>
        ))}

        {filteredCabins.length === 0 && (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              Ingen hytter funnet
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};
