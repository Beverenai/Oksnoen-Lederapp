import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { Activity, Users, TrendingUp, Home, Trophy, Medal, ChevronRight } from "lucide-react";

const COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

export function ActivityStatsTab() {
  const [selectedCabin, setSelectedCabin] = useState<{
    id: string;
    name: string;
  } | null>(null);

  // Fetch all activity registrations
  const { data: activityData, isLoading: loadingActivities } = useQuery({
    queryKey: ["activity-stats"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("participant_activities")
        .select("activity, participant_id");
      if (error) throw error;
      return data;
    },
  });

  // Fetch participants with cabin info and name
  const { data: participants, isLoading: loadingParticipants } = useQuery({
    queryKey: ["participants-for-stats"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("participants")
        .select("id, cabin_id, name, first_name, last_name");
      if (error) throw error;
      return data;
    },
  });

  // Fetch cabins
  const { data: cabins, isLoading: loadingCabins } = useQuery({
    queryKey: ["cabins-for-stats"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cabins")
        .select("id, name, sort_order")
        .order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  const isLoading = loadingActivities || loadingParticipants || loadingCabins;

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  // Calculate activity counts per participant
  const participantActivityCounts: Record<string, number> = {};
  activityData?.forEach((a) => {
    participantActivityCounts[a.participant_id] = (participantActivityCounts[a.participant_id] || 0) + 1;
  });

  // Calculate activity popularity
  const activityCounts: Record<string, number> = {};
  activityData?.forEach((a) => {
    activityCounts[a.activity] = (activityCounts[a.activity] || 0) + 1;
  });

  const popularActivities = Object.entries(activityCounts)
    .map(([activity, count]) => ({ activity, count }))
    .sort((a, b) => b.count - a.count);

  // Calculate unique participants with activities
  const uniqueParticipants = new Set(activityData?.map((a) => a.participant_id)).size;
  const totalParticipants = participants?.length || 0;
  const totalActivities = activityData?.length || 0;
  const avgActivitiesPerParticipant = uniqueParticipants > 0 
    ? (totalActivities / uniqueParticipants).toFixed(1) 
    : "0";

  // Calculate top 10 most active participants
  const top10Participants = participants
    ?.map((p) => ({
      id: p.id,
      name: p.first_name && p.last_name 
        ? `${p.first_name} ${p.last_name}` 
        : p.name,
      count: participantActivityCounts[p.id] || 0,
      cabinId: p.cabin_id,
    }))
    .filter((p) => p.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 10) || [];

  // Calculate cabin rankings
  const cabinStats: Record<string, { total: number; participants: Set<string> }> = {};
  
  // Initialize all cabins
  cabins?.forEach((cabin) => {
    cabinStats[cabin.id] = { total: 0, participants: new Set() };
  });

  // Map participant to cabin
  const participantCabinMap: Record<string, string> = {};
  participants?.forEach((p) => {
    if (p.cabin_id) {
      participantCabinMap[p.id] = p.cabin_id;
    }
  });

  // Count activities per cabin
  activityData?.forEach((a) => {
    const cabinId = participantCabinMap[a.participant_id];
    if (cabinId && cabinStats[cabinId]) {
      cabinStats[cabinId].total += 1;
      cabinStats[cabinId].participants.add(a.participant_id);
    }
  });

  // Count all participants per cabin (including those without activities)
  const cabinParticipantCounts: Record<string, number> = {};
  participants?.forEach((p) => {
    if (p.cabin_id) {
      cabinParticipantCounts[p.cabin_id] = (cabinParticipantCounts[p.cabin_id] || 0) + 1;
    }
  });

  const cabinRankings = cabins
    ?.map((cabin) => {
      const stats = cabinStats[cabin.id];
      const participantCount = cabinParticipantCounts[cabin.id] || 0;
      const avgPerParticipant = participantCount > 0 
        ? stats.total / participantCount 
        : 0;
      return {
        cabinId: cabin.id,
        cabinName: cabin.name,
        totalActivities: stats.total,
        participantCount,
        activeParticipants: stats.participants.size,
        avgPerParticipant,
      };
    })
    .filter((c) => c.participantCount > 0)
    .sort((a, b) => b.avgPerParticipant - a.avgPerParticipant) || [];

  const maxAvg = Math.max(...cabinRankings.map((c) => c.avgPerParticipant), 1);

  // Get participants for selected cabin
  const selectedCabinParticipants = selectedCabin
    ? participants
        ?.filter((p) => p.cabin_id === selectedCabin.id)
        .map((p) => ({
          id: p.id,
          name: p.first_name && p.last_name 
            ? `${p.first_name} ${p.last_name}` 
            : p.name,
          count: participantActivityCounts[p.id] || 0,
        }))
        .sort((a, b) => b.count - a.count) || []
    : [];

  // Get cabin name for participant
  const getCabinName = (cabinId: string | null) => {
    if (!cabinId) return null;
    return cabins?.find((c) => c.id === cabinId)?.name;
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Activity className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalActivities}</p>
                <p className="text-sm text-muted-foreground">Registreringer totalt</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{uniqueParticipants} / {totalParticipants}</p>
                <p className="text-sm text-muted-foreground">Deltakere med aktiviteter</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <TrendingUp className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{avgActivitiesPerParticipant}</p>
                <p className="text-sm text-muted-foreground">Snitt per deltaker</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top 10 Most Active Participants */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5" />
            Topp 10 mest aktive
          </CardTitle>
          <CardDescription>
            Deltakere med flest registrerte aktiviteter
          </CardDescription>
        </CardHeader>
        <CardContent>
          {top10Participants.length > 0 ? (
            <div className="space-y-2">
              {top10Participants.map((participant, index) => (
                <div 
                  key={participant.id} 
                  className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/50"
                >
                  <div className="flex items-center gap-3">
                    {index === 0 && <Medal className="h-5 w-5 text-yellow-500" />}
                    {index === 1 && <Medal className="h-5 w-5 text-gray-400" />}
                    {index === 2 && <Medal className="h-5 w-5 text-amber-600" />}
                    {index > 2 && (
                      <span className="w-5 h-5 flex items-center justify-center text-sm font-medium text-muted-foreground">
                        {index + 1}
                      </span>
                    )}
                    <div>
                      <span className="font-medium">{participant.name}</span>
                      {participant.cabinId && (
                        <span className="text-sm text-muted-foreground ml-2">
                          ({getCabinName(participant.cabinId)})
                        </span>
                      )}
                    </div>
                  </div>
                  <Badge variant="secondary">{participant.count} aktiviteter</Badge>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-8">
              Ingen deltakere med aktiviteter ennå
            </p>
          )}
        </CardContent>
      </Card>

      {/* Popular Activities Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Populære aktiviteter
          </CardTitle>
          <CardDescription>
            Rangert etter antall registreringer
          </CardDescription>
        </CardHeader>
        <CardContent>
          {popularActivities.length > 0 ? (
            <ResponsiveContainer width="100%" height={Math.max(200, popularActivities.length * 40)}>
              <BarChart
                data={popularActivities}
                layout="vertical"
                margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
              >
                <XAxis 
                  type="number" 
                  tick={{ fill: "hsl(var(--foreground))" }}
                />
                <YAxis 
                  dataKey="activity" 
                  type="category" 
                  width={120}
                  tick={{ fontSize: 12, fill: "hsl(var(--foreground))" }}
                />
                <Tooltip 
                  formatter={(value: number) => [`${value} registreringer`, "Antall"]}
                  contentStyle={{ 
                    backgroundColor: "hsl(var(--card))",
                    color: "hsl(var(--card-foreground))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px"
                  }}
                  labelStyle={{ color: "hsl(var(--card-foreground))" }}
                />
                <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                  {popularActivities.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-muted-foreground text-center py-8">
              Ingen aktiviteter registrert ennå
            </p>
          )}
        </CardContent>
      </Card>

      {/* Cabin Rankings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Home className="h-5 w-5" />
            Hytte-rangering
          </CardTitle>
          <CardDescription>
            Trykk på en hytte for å se deltakernes aktiviteter
          </CardDescription>
        </CardHeader>
        <CardContent>
          {cabinRankings.length > 0 ? (
            <div className="space-y-4">
              {cabinRankings.map((cabin, index) => (
                <div 
                  key={cabin.cabinId} 
                  className="space-y-2 cursor-pointer hover:bg-accent/50 rounded-lg p-2 -mx-2 transition-colors"
                  onClick={() => setSelectedCabin({ id: cabin.cabinId, name: cabin.cabinName })}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant={index === 0 ? "default" : "secondary"} className="w-6 h-6 flex items-center justify-center p-0">
                        {index + 1}
                      </Badge>
                      <span className="font-medium">{cabin.cabinName}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span>{cabin.avgPerParticipant.toFixed(1)} snitt</span>
                      <span>•</span>
                      <span>{cabin.totalActivities} totalt</span>
                      <span>•</span>
                      <span>{cabin.participantCount} deltakere</span>
                      <ChevronRight className="h-4 w-4" />
                    </div>
                  </div>
                  <Progress 
                    value={(cabin.avgPerParticipant / maxAvg) * 100} 
                    className="h-2"
                  />
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-8">
              Ingen hytter med deltakere funnet
            </p>
          )}
        </CardContent>
      </Card>

      {/* Cabin Detail Sheet */}
      <Sheet open={!!selectedCabin} onOpenChange={(open) => !open && setSelectedCabin(null)}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Home className="h-5 w-5" />
              {selectedCabin?.name}
            </SheetTitle>
          </SheetHeader>
          <div className="mt-6 space-y-2">
            {selectedCabinParticipants.length > 0 ? (
              selectedCabinParticipants.map((participant, index) => (
                <div 
                  key={participant.id} 
                  className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/50"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-5 text-sm font-medium text-muted-foreground">
                      {index + 1}.
                    </span>
                    <span className="font-medium">{participant.name}</span>
                  </div>
                  <Badge variant={participant.count > 0 ? "secondary" : "outline"}>
                    {participant.count} aktiviteter
                  </Badge>
                </div>
              ))
            ) : (
              <p className="text-muted-foreground text-center py-8">
                Ingen deltakere i denne hytten
              </p>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
