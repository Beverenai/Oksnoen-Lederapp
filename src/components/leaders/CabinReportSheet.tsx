import { useStatusPopup } from '@/hooks/useStatusPopup';
import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { Home, Save, Loader2 } from "lucide-react";
import { hapticSuccess, hapticError } from "@/lib/capacitorHaptics";
import { useActivePeriod } from "@/hooks/useGjenglemt";

interface CabinInfo {
  id: string;
  name: string;
}

interface CabinReport {
  cabin_id: string;
  content: string | null;
  updated_at: string | null;
}

interface CabinReportSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cabins: CabinInfo[];
  leaderId?: string;
}

export const CabinReportSheet = ({
  open,
  onOpenChange,
  cabins,
  leaderId,
}: CabinReportSheetProps) => {
  const { showSuccess, showError, showInfo } = useStatusPopup();
  const { data: activePeriod } = useActivePeriod();
  const [reports, setReports] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    if (open && cabins.length > 0 && activePeriod?.id) {
      loadReports();
    }
  }, [open, cabins, activePeriod?.id]);

  const loadReports = async () => {
    setLoading(true);
    try {
      const cabinIds = cabins.map(c => c.id);
      const { data, error } = await supabase
        .from("cabin_reports")
        .select("cabin_id, content, updated_at")
        .in("cabin_id", cabinIds)
        .eq("period_id", activePeriod!.id);

      if (error) throw error;

      const reportsMap: Record<string, string> = {};
      cabins.forEach(cabin => {
        const report = data?.find(r => r.cabin_id === cabin.id);
        reportsMap[cabin.id] = report?.content || "";
      });
      setReports(reportsMap);
    } catch (error) {
      console.error("Error loading cabin reports:", error);
      showError("Kunne ikke laste hytterapporter");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (cabinId: string) => {
    setSaving(cabinId);
    try {
      const content = reports[cabinId] || "";
      if (!activePeriod?.id) throw new Error("Ingen aktiv periode");

      // Manual upsert (avoids dependency on a specific unique constraint name
      // — older cached clients sent on_conflict=cabin_id which no longer exists).
      const { data: existing, error: selErr } = await supabase
        .from("cabin_reports")
        .select("id")
        .eq("cabin_id", cabinId)
        .eq("period_id", activePeriod.id)
        .maybeSingle();
      if (selErr) throw selErr;

      if (existing?.id) {
        const { error } = await supabase
          .from("cabin_reports")
          .update({
            content,
            updated_at: new Date().toISOString(),
            updated_by: leaderId || null,
          })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("cabin_reports")
          .insert({
            cabin_id: cabinId,
            period_id: activePeriod.id,
            content,
            updated_at: new Date().toISOString(),
            updated_by: leaderId || null,
          });
        if (error) throw error;
      }
      showSuccess("Hytterapport lagret");
    } catch (error) {
      console.error("Error saving cabin report:", error);
      showError("Kunne ikke lagre hytterapport");
    } finally {
      setSaving(null);
    }
  };

  const handleContentChange = (cabinId: string, content: string) => {
    setReports(prev => ({ ...prev, [cabinId]: content }));
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[85vh] overflow-y-auto">
        <SheetHeader className="mb-6">
          <SheetTitle className="flex items-center gap-2">
            <Home className="h-5 w-5" />
            Hytterapporter
          </SheetTitle>
        </SheetHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-6">
            {cabins.map((cabin) => (
              <div key={cabin.id} className="rounded-lg border bg-card p-4">
                <div className="flex items-center justify-between mb-3">
                  <Label className="text-base font-semibold flex items-center gap-2">
                    <Home className="h-4 w-4 text-muted-foreground" />
                    {cabin.name}
                  </Label>
                  <Button
                    size="sm"
                    onClick={() => handleSave(cabin.id)}
                    disabled={saving === cabin.id}
                  >
                    {saving === cabin.id ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-1" />
                    ) : (
                      <Save className="h-4 w-4 mr-1" />
                    )}
                    Lagre
                  </Button>
                </div>
                <Textarea
                  placeholder="Skriv hytterapport her..."
                  value={reports[cabin.id] || ""}
                  onChange={(e) => handleContentChange(cabin.id, e.target.value)}
                  className="min-h-[120px] resize-none"
                />
              </div>
            ))}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
};
