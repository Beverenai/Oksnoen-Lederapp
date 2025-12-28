import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Download, FileText, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { nb } from "date-fns/locale";

interface ExportDataSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const ExportDataSheet = ({ open, onOpenChange }: ExportDataSheetProps) => {
  const [includeRoomSwaps, setIncludeRoomSwaps] = useState(true);
  const [includeHealthData, setIncludeHealthData] = useState(true);
  const [includeCabinReports, setIncludeCabinReports] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

  // Fetch room swaps
  const { data: roomSwaps } = useQuery({
    queryKey: ["export-room-swaps"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("room_swaps")
        .select(`
          *,
          participant:participants(name, first_name, last_name),
          from_cabin:cabins!room_swaps_from_cabin_id_fkey(name),
          to_cabin:cabins!room_swaps_to_cabin_id_fkey(name)
        `)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  // Fetch health notes
  const { data: healthNotes } = useQuery({
    queryKey: ["export-health-notes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("participant_health_notes")
        .select(`
          *,
          participant:participants(name, first_name, last_name, cabin_id, cabins(name))
        `)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  // Fetch health events
  const { data: healthEvents } = useQuery({
    queryKey: ["export-health-events"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("participant_health_events")
        .select(`
          *,
          participant:participants(name, first_name, last_name, cabin_id, cabins(name))
        `)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  // Fetch health info
  const { data: healthInfo } = useQuery({
    queryKey: ["export-health-info"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("participant_health_info")
        .select(`
          *,
          participant:participants(name, first_name, last_name, cabin_id, cabins(name))
        `);
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  // Fetch participants with notes
  const { data: participantsWithNotes } = useQuery({
    queryKey: ["export-participant-notes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("participants")
        .select(`*, cabins(name)`)
        .not("notes", "is", null)
        .neq("notes", "");
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  // Fetch cabin reports with participants
  const { data: cabinReports } = useQuery({
    queryKey: ["export-cabin-reports"],
    queryFn: async () => {
      const { data: reports, error: reportsError } = await supabase
        .from("cabin_reports")
        .select(`
          *,
          cabin:cabins(id, name, sort_order)
        `)
        .not("content", "is", null)
        .neq("content", "");
      if (reportsError) throw reportsError;

      // Get leader cabins
      const { data: leaderCabins, error: lcError } = await supabase
        .from("leader_cabins")
        .select(`cabin_id, leader:leaders(id, name, is_active)`)
        .eq("leader.is_active", true);
      if (lcError) throw lcError;

      // Get participants per cabin
      const { data: participants, error: pError } = await supabase
        .from("participants")
        .select("id, name, first_name, last_name, cabin_id");
      if (pError) throw pError;

      return reports?.map(report => ({
        ...report,
        leaders: leaderCabins
          ?.filter(lc => lc.cabin_id === report.cabin?.id && lc.leader?.is_active)
          .map(lc => lc.leader?.name) || [],
        participants: participants
          ?.filter(p => p.cabin_id === report.cabin?.id)
          .map(p => p.first_name || p.name) || [],
      })).sort((a, b) => (a.cabin?.sort_order || 0) - (b.cabin?.sort_order || 0));
    },
    enabled: open,
  });

  const getStatusText = (status: string) => {
    switch (status) {
      case "approved": return "Godkjent";
      case "rejected": return "Avvist";
      case "pending": return "Venter";
      default: return status;
    }
  };

  const getSeverityText = (severity: string | null) => {
    switch (severity) {
      case "low": return "Lav";
      case "medium": return "Middels";
      case "high": return "Høy";
      default: return severity || "Ukjent";
    }
  };

  const generateHTMLReport = () => {
    const now = new Date();
    const dateStr = format(now, "d. MMMM yyyy", { locale: nb });
    
    let html = `
<!DOCTYPE html>
<html lang="no">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Uke-rapport - Oksnøen ${now.getFullYear()}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 24px; max-width: 1200px; margin: 0 auto; color: #1a1a1a; }
    h1 { font-size: 28px; margin-bottom: 8px; color: #0f172a; }
    .subtitle { color: #64748b; margin-bottom: 32px; font-size: 14px; }
    .section { margin-bottom: 40px; page-break-inside: avoid; }
    .section-header { display: flex; align-items: center; gap: 8px; margin-bottom: 16px; padding-bottom: 8px; border-bottom: 2px solid #e2e8f0; }
    .section-header h2 { font-size: 20px; color: #0f172a; }
    .section-header .count { background: #f1f5f9; padding: 2px 8px; border-radius: 12px; font-size: 12px; color: #64748b; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th { background: #f8fafc; text-align: left; padding: 10px 12px; font-weight: 600; color: #475569; border-bottom: 2px solid #e2e8f0; }
    td { padding: 10px 12px; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
    tr:hover { background: #f8fafc; }
    .status-approved { color: #16a34a; font-weight: 500; }
    .status-rejected { color: #dc2626; font-weight: 500; }
    .status-pending { color: #ca8a04; font-weight: 500; }
    .severity-low { color: #16a34a; }
    .severity-medium { color: #ca8a04; }
    .severity-high { color: #dc2626; font-weight: 600; }
    .cabin-card { background: #f8fafc; border-radius: 8px; padding: 16px; margin-bottom: 12px; border: 1px solid #e2e8f0; }
    .cabin-name { font-weight: 600; font-size: 16px; color: #0f172a; margin-bottom: 8px; }
    .cabin-meta { font-size: 12px; color: #64748b; margin-bottom: 8px; }
    .cabin-participants { font-size: 13px; color: #475569; margin-bottom: 8px; }
    .cabin-report { background: white; padding: 12px; border-radius: 6px; font-size: 13px; line-height: 1.5; white-space: pre-wrap; border: 1px solid #e2e8f0; }
    .empty { color: #94a3b8; font-style: italic; padding: 20px; text-align: center; }
    @media print {
      body { padding: 0; }
      .section { page-break-inside: avoid; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <h1>📋 Uke-rapport - Oksnøen ${now.getFullYear()}</h1>
  <p class="subtitle">Eksportert: ${dateStr}</p>
`;

    // Room Swaps Section
    if (includeRoomSwaps) {
      html += `
  <div class="section">
    <div class="section-header">
      <h2>🔄 Rombytter</h2>
      <span class="count">${roomSwaps?.length || 0} stk</span>
    </div>
`;
      if (roomSwaps && roomSwaps.length > 0) {
        html += `
    <table>
      <thead>
        <tr>
          <th>Deltaker</th>
          <th>Fra</th>
          <th>Til</th>
          <th>Status</th>
          <th>Grunn</th>
          <th>Dato</th>
        </tr>
      </thead>
      <tbody>
`;
        roomSwaps.forEach(swap => {
          const participant = swap.participant as any;
          const name = participant?.first_name || participant?.name || "Ukjent";
          const fromCabin = (swap.from_cabin as any)?.name || "-";
          const fromRoom = swap.from_room ? ` (${swap.from_room})` : "";
          const toCabin = (swap.to_cabin as any)?.name || "-";
          const toRoom = swap.to_room ? ` (${swap.to_room})` : "";
          const statusClass = `status-${swap.status}`;
          const date = swap.created_at ? format(new Date(swap.created_at), "d. MMM", { locale: nb }) : "-";
          
          html += `
        <tr>
          <td>${name}</td>
          <td>${fromCabin}${fromRoom}</td>
          <td>${toCabin}${toRoom}</td>
          <td class="${statusClass}">${getStatusText(swap.status)}</td>
          <td>${swap.reason || "-"}</td>
          <td>${date}</td>
        </tr>
`;
        });
        html += `
      </tbody>
    </table>
`;
      } else {
        html += `<p class="empty">Ingen rombytter registrert</p>`;
      }
      html += `</div>`;
    }

    // Health Data Section
    if (includeHealthData) {
      // Health Info
      html += `
  <div class="section">
    <div class="section-header">
      <h2>📋 Info fra Nurse</h2>
      <span class="count">${healthInfo?.length || 0} stk</span>
    </div>
`;
      if (healthInfo && healthInfo.length > 0) {
        html += `
    <table>
      <thead>
        <tr>
          <th>Deltaker</th>
          <th>Hytte</th>
          <th>Helseinformasjon</th>
        </tr>
      </thead>
      <tbody>
`;
        healthInfo.forEach(info => {
          const participant = info.participant as any;
          const name = participant?.first_name || participant?.name || "Ukjent";
          const cabin = participant?.cabins?.name || "-";
          
          html += `
        <tr>
          <td>${name}</td>
          <td>${cabin}</td>
          <td>${info.info}</td>
        </tr>
`;
        });
        html += `
      </tbody>
    </table>
`;
      } else {
        html += `<p class="empty">Ingen info fra nurse registrert</p>`;
      }
      html += `</div>`;

      // Health Notes
      html += `
  <div class="section">
    <div class="section-header">
      <h2>📝 Nurse Notater</h2>
      <span class="count">${healthNotes?.length || 0} stk</span>
    </div>
`;
      if (healthNotes && healthNotes.length > 0) {
        html += `
    <table>
      <thead>
        <tr>
          <th>Deltaker</th>
          <th>Hytte</th>
          <th>Dato</th>
          <th>Notat</th>
        </tr>
      </thead>
      <tbody>
`;
        healthNotes.forEach(note => {
          const participant = note.participant as any;
          const name = participant?.first_name || participant?.name || "Ukjent";
          const cabin = participant?.cabins?.name || "-";
          const date = format(new Date(note.created_at), "d. MMM HH:mm", { locale: nb });
          
          html += `
        <tr>
          <td>${name}</td>
          <td>${cabin}</td>
          <td>${date}</td>
          <td>${note.content}</td>
        </tr>
`;
        });
        html += `
      </tbody>
    </table>
`;
      } else {
        html += `<p class="empty">Ingen nurse notater registrert</p>`;
      }
      html += `</div>`;

      // Health Events
      html += `
  <div class="section">
    <div class="section-header">
      <h2>🏥 Helsehendelser</h2>
      <span class="count">${healthEvents?.length || 0} stk</span>
    </div>
`;
      if (healthEvents && healthEvents.length > 0) {
        html += `
    <table>
      <thead>
        <tr>
          <th>Deltaker</th>
          <th>Hytte</th>
          <th>Dato</th>
          <th>Type</th>
          <th>Beskrivelse</th>
          <th>Alvorlighet</th>
        </tr>
      </thead>
      <tbody>
`;
        healthEvents.forEach(event => {
          const participant = event.participant as any;
          const name = participant?.first_name || participant?.name || "Ukjent";
          const cabin = participant?.cabins?.name || "-";
          const date = format(new Date(event.created_at), "d. MMM HH:mm", { locale: nb });
          const severityClass = `severity-${event.severity || "low"}`;
          
          html += `
        <tr>
          <td>${name}</td>
          <td>${cabin}</td>
          <td>${date}</td>
          <td>${event.event_type}</td>
          <td>${event.description}</td>
          <td class="${severityClass}">${getSeverityText(event.severity)}</td>
        </tr>
`;
        });
        html += `
      </tbody>
    </table>
`;
      } else {
        html += `<p class="empty">Ingen helsehendelser registrert</p>`;
      }
      html += `</div>`;

      // Participant Notes (from leaders)
      html += `
  <div class="section">
    <div class="section-header">
      <h2>💬 Leder-kommentarer på deltakere</h2>
      <span class="count">${participantsWithNotes?.length || 0} stk</span>
    </div>
`;
      if (participantsWithNotes && participantsWithNotes.length > 0) {
        html += `
    <table>
      <thead>
        <tr>
          <th>Deltaker</th>
          <th>Hytte</th>
          <th>Kommentar</th>
        </tr>
      </thead>
      <tbody>
`;
        participantsWithNotes.forEach(p => {
          const name = p.first_name || p.name;
          const cabin = (p.cabins as any)?.name || "-";
          
          html += `
        <tr>
          <td>${name}</td>
          <td>${cabin}</td>
          <td>${p.notes}</td>
        </tr>
`;
        });
        html += `
      </tbody>
    </table>
`;
      } else {
        html += `<p class="empty">Ingen leder-kommentarer registrert</p>`;
      }
      html += `</div>`;
    }

    // Cabin Reports Section
    if (includeCabinReports) {
      html += `
  <div class="section">
    <div class="section-header">
      <h2>🏠 Hytterapporter</h2>
      <span class="count">${cabinReports?.length || 0} hytter</span>
    </div>
`;
      if (cabinReports && cabinReports.length > 0) {
        cabinReports.forEach(report => {
          const cabinName = report.cabin?.name || "Ukjent hytte";
          const leaders = report.leaders?.join(", ") || "Ingen ledere";
          const participants = report.participants?.join(", ") || "Ingen deltakere";
          
          html += `
    <div class="cabin-card">
      <div class="cabin-name">${cabinName}</div>
      <div class="cabin-meta">👤 Ledere: ${leaders}</div>
      <div class="cabin-participants">👥 Deltakere: ${participants}</div>
      <div class="cabin-report">${report.content}</div>
    </div>
`;
        });
      } else {
        html += `<p class="empty">Ingen hytterapporter registrert</p>`;
      }
      html += `</div>`;
    }

    html += `
</body>
</html>
`;

    return html;
  };

  const handleExport = () => {
    setIsExporting(true);
    
    try {
      const html = generateHTMLReport();
      const newWindow = window.open("", "_blank");
      if (newWindow) {
        newWindow.document.write(html);
        newWindow.document.close();
      }
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Eksporter uke-rapport</SheetTitle>
          <SheetDescription>
            Velg hva som skal inkluderes i rapporten. Rapporten åpnes i et nytt
            vindu og kan skrives ut eller lagres som PDF.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6 py-6">
          <div className="space-y-4">
            <div className="flex items-center space-x-3">
              <Checkbox
                id="room-swaps"
                checked={includeRoomSwaps}
                onCheckedChange={(checked) => setIncludeRoomSwaps(checked === true)}
              />
              <Label htmlFor="room-swaps" className="flex flex-col">
                <span className="font-medium">Rombytter</span>
                <span className="text-sm text-muted-foreground">
                  {roomSwaps?.length || 0} registrerte bytter
                </span>
              </Label>
            </div>

            <div className="flex items-center space-x-3">
              <Checkbox
                id="health-data"
                checked={includeHealthData}
                onCheckedChange={(checked) => setIncludeHealthData(checked === true)}
              />
              <Label htmlFor="health-data" className="flex flex-col">
                <span className="font-medium">Helsedata og leder-kommentarer</span>
                <span className="text-sm text-muted-foreground">
                  Helseinformasjon, notater, hendelser og kommentarer
                </span>
              </Label>
            </div>

            <div className="flex items-center space-x-3">
              <Checkbox
                id="cabin-reports"
                checked={includeCabinReports}
                onCheckedChange={(checked) => setIncludeCabinReports(checked === true)}
              />
              <Label htmlFor="cabin-reports" className="flex flex-col">
                <span className="font-medium">Hytterapporter</span>
                <span className="text-sm text-muted-foreground">
                  {cabinReports?.length || 0} hytter med rapporter
                </span>
              </Label>
            </div>
          </div>

          <div className="border-t pt-4">
            <Button
              onClick={handleExport}
              disabled={isExporting || (!includeRoomSwaps && !includeHealthData && !includeCabinReports)}
              className="w-full"
            >
              {isExporting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <FileText className="h-4 w-4 mr-2" />
              )}
              Generer rapport
            </Button>
            <p className="text-xs text-muted-foreground mt-2 text-center">
              Rapporten åpnes i et nytt vindu. Bruk Ctrl+P for å skrive ut eller lagre som PDF.
            </p>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};
