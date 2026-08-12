import { useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { ParticipantStatsCard } from "@/components/admin/ParticipantStatsCard";
import { RoomSwapTab } from "@/components/stats/RoomSwapTab";
import { CabinReportsTab } from "@/components/stats/CabinReportsTab";
import { CabinsInUseTab } from "@/components/stats/CabinsInUseTab";
import { CheckoutTab } from "@/components/stats/CheckoutTab";
import { LeaderActivityStatsTab } from "@/components/stats/LeaderActivityStatsTab";
import { ActivityStatsTab } from "@/components/stats/ActivityStatsTab";
import { StyrkeproveTab } from "@/components/stats/StyrkeproveTab";
import { AmbassadorsTab } from "@/components/stats/AmbassadorsTab";
import { TeamsTab } from "@/components/stats/TeamsTab";
import { SecretWordsTab } from "@/components/stats/SecretWordsTab";
import { KioskTab } from "@/components/stats/KioskTab";
import { ExportDataSheet } from "@/components/stats/ExportDataSheet";
import { IncidentsTab } from "@/components/admin/IncidentsTab";
import { ParticipantTasksTab } from "@/components/admin/ParticipantTasksTab";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeftRight, Home, Download, Sparkles, UserCheck, Activity, ArrowLeft, LayoutDashboard, Trophy, Award, Users2, KeyRound, MessageSquareWarning, Building2, ShoppingBasket, ClipboardList } from "lucide-react";


type NavItem = {
  key: string;
  label: string;
  desc: string;
  icon: typeof Home;
  color: string;
  path?: string;
  action?: "export";
};

const navGroups: { title: string; items: NavItem[] }[] = [
  {
    title: "Bo & rom",
    items: [
      { key: "cabins-in-use", label: "Hytter i bruk", desc: "Hytter og rom denne perioden", icon: Building2, color: "bg-teal-500/15 text-teal-700 dark:text-teal-400" },
      { key: "room-swap", label: "Rombytter", desc: "Bytt rom mellom deltakere", icon: ArrowLeftRight, color: "bg-blue-500/15 text-blue-600 dark:text-blue-400" },
      { key: "cabin-reports", label: "Hytterapporter", desc: "Se rapporter per hytte", icon: Home, color: "bg-green-500/15 text-green-600 dark:text-green-400" },
      { key: "checkout", label: "Utsjekk", desc: "Håndter utsjekk av deltakere", icon: Sparkles, color: "bg-purple-500/15 text-purple-600 dark:text-purple-400" },
    ],
  },
  {
    title: "Aktiviteter & lag",
    items: [
      { key: "activity-stats", label: "Aktiviteter", desc: "Statistikk over alle aktiviteter", icon: Activity, color: "bg-pink-500/15 text-pink-600 dark:text-pink-400" },
      { key: "leader-activity", label: "Lederaktivitet", desc: "Ledernes aktivitetsregistrering", icon: UserCheck, color: "bg-orange-500/15 text-orange-600 dark:text-orange-400" },
      { key: "styrkeprove", label: "Styrkeprøven", desc: "Fullført og mangler 1-2", icon: Trophy, color: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400" },
      { key: "teams", label: "Lag", desc: "Del deltakere i 10 lag", icon: Users2, color: "bg-cyan-500/15 text-cyan-700 dark:text-cyan-400" },
      { key: "ambassadors", label: "Ambassadører", desc: "Deltakere på sitt 4. år", icon: Award, color: "bg-amber-500/15 text-amber-700 dark:text-amber-400" },
    ],
  },
  {
    title: "Oppfølging",
    items: [
      { key: "incidents", label: "Hendelser", desc: "Logg fra ledere om deltagere", icon: MessageSquareWarning, color: "bg-red-500/15 text-red-700 dark:text-red-400" },
      { key: "participant-tasks", label: "Deltakeroppdrag", desc: "Beskjeder til ledere og lest-status", icon: ClipboardList, color: "bg-blue-500/15 text-blue-700 dark:text-blue-400" },
      { key: "dynga", label: "Dynga", desc: "Oversikt over deltakeroppførsel", icon: LayoutDashboard, color: "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400", path: "/admin/dynga" },
      { key: "secret-words", label: "Hemmelige Ord", desc: "Gi hver deltaker et hemmelig ord", icon: KeyRound, color: "bg-rose-500/15 text-rose-700 dark:text-rose-400" },
    ],
  },
  {
    title: "Penger & data",
    items: [
      { key: "kiosk", label: "Gomla", desc: "Saldo, omsetning og kjøp", icon: ShoppingBasket, color: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" },
      { key: "export", label: "Eksporter", desc: "Last ned rapport", icon: Download, color: "bg-muted/50 text-muted-foreground", action: "export" },
    ],
  },
];

const tabComponents: Record<string, React.FC> = {
  "cabins-in-use": CabinsInUseTab,
  "room-swap": RoomSwapTab,
  "cabin-reports": CabinReportsTab,
  "checkout": CheckoutTab,
  "leader-activity": LeaderActivityStatsTab,
  "activity-stats": ActivityStatsTab,
  "styrkeprove": StyrkeproveTab,
  "ambassadors": AmbassadorsTab,
  "teams": TeamsTab,
  "secret-words": SecretWordsTab,
  "incidents": IncidentsTab,
  "participant-tasks": ParticipantTasksTab,
  "kiosk": KioskTab,
};

const tabLabels: Record<string, string> = {
  "cabins-in-use": "Hytter i bruk",
  "room-swap": "Rombytter",
  "cabin-reports": "Hytterapporter",
  "checkout": "Utsjekk",
  "leader-activity": "Lederaktivitet",
  "activity-stats": "Aktiviteter",
  "styrkeprove": "Styrkeprøven",
  "ambassadors": "Ambassadører",
  "teams": "Lag",
  "secret-words": "Hemmelige Ord",
  "incidents": "Hendelser",
  "participant-tasks": "Deltakeroppdrag",
  "kiosk": "Gomla",
};

const ParticipantStats = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [exportOpen, setExportOpen] = useState(false);
  const currentTab = searchParams.get("tab");

  const ActiveComponent = currentTab ? tabComponents[currentTab] : null;

  if (currentTab && ActiveComponent) {
    return (
      <div className="container mx-auto pt-3 pb-6 px-4 max-w-4xl sm:py-6">
        <div className="flex items-center gap-3 mb-4 sm:mb-6">
          <Button variant="ghost" size="icon" className="hidden lg:inline-flex" onClick={() => setSearchParams({})}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl sm:text-2xl font-bold">{tabLabels[currentTab] || "Deltakere"}</h1>
        </div>
        <ActiveComponent />
      </div>
    );
  }

  return (
    <div className="container mx-auto pt-2 pb-6 px-4 max-w-4xl sm:py-6">
      <h1 className="text-xl sm:text-2xl font-bold mb-3">Deltakere</h1>

      <ParticipantStatsCard />

      <div className="mt-4 space-y-5">
        {navGroups.map((group) => (
          <section key={group.title}>
            <div className="flex items-center gap-3 mb-2">
              <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground shrink-0">
                {group.title}
              </h2>
              <div className="h-px flex-1 bg-border" />
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-2.5">
              {group.items.map(({ key, label, desc, icon: Icon, color, path, action }) => (
                <Card
                  key={key}
                  className={`p-3 sm:p-4 cursor-pointer hover:scale-[1.02] active:scale-[0.98] transition-transform ${color}`}
                  onClick={() => {
                    if (action === "export") setExportOpen(true);
                    else if (path) navigate(path);
                    else setSearchParams({ tab: key });
                  }}
                >
                  <Icon className="h-6 w-6 mb-1.5" />
                  <p className="font-semibold text-sm leading-tight">{label}</p>
                  <p className="text-[11px] opacity-70 mt-0.5 leading-snug">{desc}</p>
                </Card>
              ))}
            </div>
          </section>
        ))}
      </div>

      <ExportDataSheet open={exportOpen} onOpenChange={setExportOpen} />
    </div>
  );
};

export default ParticipantStats;
