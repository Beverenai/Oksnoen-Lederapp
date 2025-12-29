import { useState } from "react";
import { ParticipantStatsCard } from "@/components/admin/ParticipantStatsCard";
import { RoomSwapTab } from "@/components/stats/RoomSwapTab";
import { CabinReportsTab } from "@/components/stats/CabinReportsTab";
import { CheckoutTab } from "@/components/stats/CheckoutTab";
import { LeaderActivityStatsTab } from "@/components/stats/LeaderActivityStatsTab";
import { ExportDataSheet } from "@/components/stats/ExportDataSheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { BarChart2, ArrowLeftRight, Home, Download, Sparkles, UserCheck } from "lucide-react";

const ParticipantStats = () => {
  const [exportOpen, setExportOpen] = useState(false);

  return (
    <div className="container mx-auto py-6 px-4 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Deltakerstatistikk</h1>
        <Button variant="outline" onClick={() => setExportOpen(true)}>
          <Download className="h-4 w-4 mr-2" />
          Eksporter rapport
        </Button>
      </div>
      
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-5 mb-6">
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <BarChart2 className="h-4 w-4" />
            <span className="hidden sm:inline">Oversikt</span>
          </TabsTrigger>
          <TabsTrigger value="room-swap" className="flex items-center gap-2">
            <ArrowLeftRight className="h-4 w-4" />
            <span className="hidden sm:inline">Rombytter</span>
          </TabsTrigger>
          <TabsTrigger value="cabin-reports" className="flex items-center gap-2">
            <Home className="h-4 w-4" />
            <span className="hidden sm:inline">Hytterapport</span>
          </TabsTrigger>
          <TabsTrigger value="checkout" className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            <span className="hidden sm:inline">Utsjekk</span>
          </TabsTrigger>
          <TabsTrigger value="leader-activity" className="flex items-center gap-2">
            <UserCheck className="h-4 w-4" />
            <span className="hidden sm:inline">Lederaktivitet</span>
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="overview">
          <ParticipantStatsCard />
        </TabsContent>
        
        <TabsContent value="room-swap">
          <RoomSwapTab />
        </TabsContent>
        
        <TabsContent value="cabin-reports">
          <CabinReportsTab />
        </TabsContent>
        
        <TabsContent value="checkout">
          <CheckoutTab />
        </TabsContent>
        
        <TabsContent value="leader-activity">
          <LeaderActivityStatsTab />
        </TabsContent>
      </Tabs>

      <ExportDataSheet open={exportOpen} onOpenChange={setExportOpen} />
    </div>
  );
};

export default ParticipantStats;
