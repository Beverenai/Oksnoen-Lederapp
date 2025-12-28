import { ParticipantStatsCard } from "@/components/admin/ParticipantStatsCard";
import { RoomSwapTab } from "@/components/stats/RoomSwapTab";
import { CabinReportsTab } from "@/components/stats/CabinReportsTab";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart2, ArrowLeftRight, Home } from "lucide-react";

const ParticipantStats = () => {
  return (
    <div className="container mx-auto py-6 px-4 max-w-4xl">
      <h1 className="text-2xl font-bold mb-6">Deltakerstatistikk</h1>
      
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-6">
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <BarChart2 className="h-4 w-4" />
            Oversikt
          </TabsTrigger>
          <TabsTrigger value="room-swap" className="flex items-center gap-2">
            <ArrowLeftRight className="h-4 w-4" />
            Rombytter
          </TabsTrigger>
          <TabsTrigger value="cabin-reports" className="flex items-center gap-2">
            <Home className="h-4 w-4" />
            Hytterapport
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
      </Tabs>
    </div>
  );
};

export default ParticipantStats;
