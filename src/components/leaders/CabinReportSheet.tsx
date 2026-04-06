import { useStatusPopup } from '@/hooks/useStatusPopup';
import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { Home, Save, Loader2 } from "lucide-react";
import { hapticSuccess, hapticError } from "@/lib/capacitorHaptics";

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
  const [reports, setReports] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    if (open && cabins.length > 0) {
      loadReports();
    }
  }, [open, cabins]);

  const loadReports = async () => {
    setLoading(true);
    try {
      const cabinIds = cabins.map(c => c.id);
      const { data, error } = await supabase
        .from("cabin_reports")
        .select("cabin_id, content, updated_at")
        .in("cabin_id", cabinIds);

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
      
      const { error } = await supabase
        .from("cabin_reports")
        .upsert({
          cabin_id: cabinId,
          content,
          updated_at: new Date().toISOString(),
          updated_by: leaderId || null,
        }, {
          onConflict: "cabin_id"
        });

      if (error) throw error;
      hapticSuccess();
      showSuccess("Hytterapport lagret");
    } catch (error) {
      console.error("Error saving cabin report:", error);
      hapticError();
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
