import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ParticipantStatsCard } from "@/components/admin/ParticipantStatsCard";
import { RoomSwapTab } from "@/components/stats/RoomSwapTab";
import { CabinReportsTab } from "@/components/stats/CabinReportsTab";
import { CheckoutTab } from "@/components/stats/CheckoutTab";
import { LeaderActivityStatsTab } from "@/components/stats/LeaderActivityStatsTab";
import { ActivityStatsTab } from "@/components/stats/ActivityStatsTab";
import { ExportDataSheet } from "@/components/stats/ExportDataSheet";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeftRight, Home, Download, Sparkles, UserCheck, Activity, ArrowLeft } from "lucide-react";

const navItems = [
  { key: "room-swap", label: "Rombytter", desc: "Bytt rom mellom deltakere", icon: ArrowLeftRight, color: "bg-blue-500/15 text-blue-600 dark:text-blue-400" },
  { key: "cabin-reports", label: "Hytterapporter", desc: "Se rapporter per hytte", icon: Home, color: "bg-green-500/15 text-green-600 dark:text-green-400" },
  { key: "checkout", label: "Utsjekk", desc: "Håndter utsjekk av deltakere", icon: Sparkles, color: "bg-purple-500/15 text-purple-600 dark:text-purple-400" },
  { key: "leader-activity", label: "Lederaktivitet", desc: "Se ledernes aktivitetsregistrering", icon: UserCheck, color: "bg-orange-500/15 text-orange-600 dark:text-orange-400" },
  { key: "activity-stats", label: "Aktiviteter", desc: "Statistikk over alle aktiviteter", icon: Activity, color: "bg-pink-500/15 text-pink-600 dark:text-pink-400" },
];

const tabComponents: Record<string, React.FC> = {
  "room-swap": RoomSwapTab,
  "cabin-reports": CabinReportsTab,
  "checkout": CheckoutTab,
  "leader-activity": LeaderActivityStatsTab,
  "activity-stats": ActivityStatsTab,
};

const tabLabels: Record<string, string> = {
  "room-swap": "Rombytter",
  "cabin-reports": "Hytterapporter",
  "checkout": "Utsjekk",
  "leader-activity": "Lederaktivitet",
  "activity-stats": "Aktiviteter",
};

const ParticipantStats = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [exportOpen, setExportOpen] = useState(false);
  const currentTab = searchParams.get("tab");

  const ActiveComponent = currentTab ? tabComponents[currentTab] : null;

  if (currentTab && ActiveComponent) {
    return (
      <div className="container mx-auto py-6 px-4 max-w-4xl">
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="icon" onClick={() => setSearchParams({})}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-bold">{tabLabels[currentTab] || "Deltakere"}</h1>
        </div>
        <ActiveComponent />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 px-4 max-w-4xl">
      <h1 className="text-2xl font-bold mb-6">Deltakerstatistikk</h1>

      <ParticipantStatsCard />

      <div className="grid grid-cols-2 gap-3 mt-6">
        {navItems.map(({ key, label, desc, icon: Icon, color }) => (
          <Card
            key={key}
            className={`p-4 cursor-pointer hover:scale-[1.02] active:scale-[0.98] transition-transform ${color}`}
            onClick={() => setSearchParams({ tab: key })}
          >
            <Icon className="h-7 w-7 mb-2" />
            <p className="font-semibold text-sm">{label}</p>
            <p className="text-xs opacity-70 mt-0.5">{desc}</p>
          </Card>
        ))}
        <Card
          className="p-4 cursor-pointer hover:scale-[1.02] active:scale-[0.98] transition-transform bg-muted/50 text-muted-foreground"
          onClick={() => setExportOpen(true)}
        >
          <Download className="h-7 w-7 mb-2" />
          <p className="font-semibold text-sm">Eksporter</p>
          <p className="text-xs opacity-70 mt-0.5">Last ned rapport</p>
        </Card>
      </div>

      <ExportDataSheet open={exportOpen} onOpenChange={setExportOpen} />
    </div>
  );
};

export default ParticipantStats;
