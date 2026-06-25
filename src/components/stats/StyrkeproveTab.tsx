import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Trophy, Medal, AlertCircle, Info, ChevronDown } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useState } from "react";
import { ParticipantDetailDialog } from "@/components/passport/ParticipantDetailDialog";
import {
  hasStoreStyrkprove,
  hasLilleStyrkprove,
  getStoreStyrkproveProgress,
  getLilleStyrkproveProgress,
  matchesRequirement,
  STORE_STYRKEPROVE_REQUIREMENTS,
  LILLE_STYRKEPROVE_REQUIREMENTS,
  LILLE_STYRKEPROVE_FIXED_REQUIREMENTS,
  LILLE_STYRKEPROVE_HEIGHT_ALTERNATIVES,
  LILLE_STYRKEPROVE_SWIMMING_ALTERNATIVES,
} from "@/lib/activityUtils";

interface ParticipantRow {
  id: string;
  name: string;
  cabinName: string | null;
  imageUrl: string | null;
  activities: string[];
}

function getMissingStore(activities: string[]): string[] {
  return STORE_STYRKEPROVE_REQUIREMENTS.filter(
    (req) => !matchesRequirement(activities, req)
  );
}

function getMissingLille(activities: string[]): string[] {
  const missing: string[] = [];
  LILLE_STYRKEPROVE_FIXED_REQUIREMENTS.forEach((req) => {
    if (!matchesRequirement(activities, req)) missing.push(req);
  });
  if (!LILLE_STYRKEPROVE_HEIGHT_ALTERNATIVES.some((a) => matchesRequirement(activities, a))) {
    missing.push("Åtte/Ti/Tretten meter");
  }
  if (!LILLE_STYRKEPROVE_SWIMMING_ALTERNATIVES.some((a) => matchesRequirement(activities, a))) {
    missing.push("Skrikeren en vei / Triatlon");
  }
  return missing;
}

export function StyrkeproveTab() {
  const [selectedParticipantId, setSelectedParticipantId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);

  const openParticipant = (id: string) => {
    setSelectedParticipantId(id);
    setDialogOpen(true);
  };

  const { data, isLoading } = useQuery({
    queryKey: ["styrkeprove-stats"],
    queryFn: async () => {
      const [participantsRes, activitiesRes, cabinsRes] = await Promise.all([
        supabase.from("participants").select("id, name, first_name, last_name, cabin_id, image_url"),
        supabase.from("participant_activities").select("participant_id, activity"),
        supabase.from("cabins").select("id, name"),
      ]);
      if (participantsRes.error) throw participantsRes.error;
      if (activitiesRes.error) throw activitiesRes.error;
      if (cabinsRes.error) throw cabinsRes.error;

      const cabinMap = new Map((cabinsRes.data || []).map((c) => [c.id, c.name]));
      const actsByParticipant = new Map<string, string[]>();
      (activitiesRes.data || []).forEach((a) => {
        const list = actsByParticipant.get(a.participant_id) || [];
        list.push(a.activity);
        actsByParticipant.set(a.participant_id, list);
      });

      const rows: ParticipantRow[] = (participantsRes.data || []).map((p) => ({
        id: p.id,
        name: p.first_name && p.last_name ? `${p.first_name} ${p.last_name}` : p.name,
        cabinName: p.cabin_id ? cabinMap.get(p.cabin_id) || null : null,
        imageUrl: (p as any).image_url ?? null,
        activities: actsByParticipant.get(p.id) || [],
      }));
      return rows;
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-32" />
        ))}
      </div>
    );
  }

  const rows = data || [];

  const storeDone: ParticipantRow[] = [];
  const lilleDone: ParticipantRow[] = [];
  const storeMissing1: { row: ParticipantRow; missing: string[] }[] = [];
  const storeMissing2: { row: ParticipantRow; missing: string[] }[] = [];
  const lilleMissing1: { row: ParticipantRow; missing: string[] }[] = [];
  const lilleMissing2: { row: ParticipantRow; missing: string[] }[] = [];

  rows.forEach((row) => {
    const storeOk = hasStoreStyrkprove(row.activities);
    const lilleOk = hasLilleStyrkprove(row.activities);
    if (storeOk) storeDone.push(row);
    // Hvis deltakeren har Store, skal de ikke vises som Lille (Store overskygger Lille)
    if (lilleOk && !storeOk) lilleDone.push(row);

    if (!storeOk) {
      const missing = getMissingStore(row.activities);
      if (missing.length === 1) storeMissing1.push({ row, missing });
      else if (missing.length === 2) storeMissing2.push({ row, missing });
    }
    // Skip Lille-mangler hvis Store allerede er fullført
    if (!lilleOk && !storeOk) {
      const missing = getMissingLille(row.activities);
      if (missing.length === 1) lilleMissing1.push({ row, missing });
      else if (missing.length === 2) lilleMissing2.push({ row, missing });
    }
  });

  const initials = (name: string) =>
    name
      .split(" ")
      .map((p) => p[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase();

  const renderDone = (list: ParticipantRow[]) =>
    list.length === 0 ? (
      <p className="text-sm text-muted-foreground text-center py-4">Ingen ennå</p>
    ) : (
      <div className="space-y-2">
        {list
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((p) => (
            <button
              key={p.id}
              onClick={() => openParticipant(p.id)}
              className="w-full flex items-center justify-between py-2 px-3 rounded-lg bg-muted/50 hover:bg-muted active:scale-[0.99] transition text-left"
            >
              <div className="flex items-center gap-3 min-w-0">
                <Avatar className="h-9 w-9 shrink-0">
                  {p.imageUrl && <AvatarImage src={p.imageUrl} alt={p.name} />}
                  <AvatarFallback className="text-xs">{initials(p.name)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <div className="font-medium truncate">{p.name}</div>
                  {p.cabinName && (
                    <div className="text-xs text-muted-foreground truncate">{p.cabinName}</div>
                  )}
                </div>
              </div>
              <Medal className="h-4 w-4 text-yellow-500 shrink-0" />
            </button>
          ))}
      </div>
    );

  const renderMissing = (list: { row: ParticipantRow; missing: string[] }[]) =>
    list.length === 0 ? (
      <p className="text-sm text-muted-foreground text-center py-4">Ingen</p>
    ) : (
      <div className="space-y-2">
        {list
          .sort((a, b) => a.row.name.localeCompare(b.row.name))
          .map(({ row, missing }) => (
            <button
              key={row.id}
              onClick={() => openParticipant(row.id)}
              className="w-full text-left py-2 px-3 rounded-lg bg-muted/50 hover:bg-muted active:scale-[0.99] transition"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-3 min-w-0">
                  <Avatar className="h-9 w-9 shrink-0">
                    {row.imageUrl && <AvatarImage src={row.imageUrl} alt={row.name} />}
                    <AvatarFallback className="text-xs">{initials(row.name)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <div className="font-medium truncate">{row.name}</div>
                    {row.cabinName && (
                      <div className="text-xs text-muted-foreground truncate">{row.cabinName}</div>
                    )}
                  </div>
                </div>
                <Badge variant="outline" className="shrink-0">
                  Mangler {missing.length}
                </Badge>
              </div>
              <div className="flex flex-wrap gap-1 mt-1.5">
                {missing.map((m) => (
                  <Badge key={m} variant="secondary" className="text-xs">
                    {m}
                  </Badge>
                ))}
              </div>
            </button>
          ))}
      </div>
  );

  function StyrkeproveInfoCard() {
    return (
      <Card>
        <Collapsible open={infoOpen} onOpenChange={setInfoOpen}>
          <CollapsibleTrigger asChild>
            <button className="w-full text-left">
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Info className="h-5 w-5 text-primary" />
                    Hva teller som Store/Lille Styrkeprøven?
                  </CardTitle>
                  <CardDescription>Trykk for å se aktiviteter og høyder.</CardDescription>
                </div>
                <ChevronDown
                  className={`h-5 w-5 text-muted-foreground transition-transform ${infoOpen ? "rotate-180" : ""}`}
                />
              </CardHeader>
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="space-y-4">
          <div>
            <p className="font-medium text-sm">Store Styrkeprøven</p>
            <ul className="mt-1.5 text-sm text-muted-foreground list-disc pl-4 space-y-1">
              {STORE_STYRKEPROVE_REQUIREMENTS.map((req) => (
                <li key={req}>
                  {req}
                  {req === "Skrikeren begge veier" && (
                    <span className="block text-xs text-muted-foreground/80 mt-0.5">
                      Triatlon teller som én vei til Skrikeren — «Skrikeren en vei» + «Triatlon» = begge veier.
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="font-medium text-sm">Lille Styrkeprøven</p>
            <ul className="mt-1.5 text-sm text-muted-foreground list-disc pl-4 space-y-1">
              {LILLE_STYRKEPROVE_REQUIREMENTS.map((req) => (
                <li key={req}>{req}</li>
              ))}
            </ul>
            <p className="text-xs text-muted-foreground/80 mt-2">
              Merk: Deltakere som har fullført Store Styrkeprøven vises ikke under Lille.
            </p>
          </div>
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <StyrkeproveInfoCard />
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Trophy className="h-5 w-5 text-yellow-500" />
              <div>
                <p className="text-2xl font-bold">{storeDone.length}</p>
                <p className="text-sm text-muted-foreground">Store Styrkeprøven</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Medal className="h-5 w-5 text-amber-600" />
              <div>
                <p className="text-2xl font-bold">{lilleDone.length}</p>
                <p className="text-sm text-muted-foreground">Lille Styrkeprøven</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-yellow-500" /> Fullført Store Styrkeprøven
          </CardTitle>
          <CardDescription>{storeDone.length} deltakere</CardDescription>
        </CardHeader>
        <CardContent>{renderDone(storeDone)}</CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-orange-500" /> Mangler 1 til Store
          </CardTitle>
          <CardDescription>{storeMissing1.length} deltakere</CardDescription>
        </CardHeader>
        <CardContent>{renderMissing(storeMissing1)}</CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-orange-400" /> Mangler 2 til Store
          </CardTitle>
          <CardDescription>{storeMissing2.length} deltakere</CardDescription>
        </CardHeader>
        <CardContent>{renderMissing(storeMissing2)}</CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Medal className="h-5 w-5 text-amber-600" /> Fullført Lille Styrkeprøven
          </CardTitle>
          <CardDescription>{lilleDone.length} deltakere</CardDescription>
        </CardHeader>
        <CardContent>{renderDone(lilleDone)}</CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-orange-500" /> Mangler 1 til Lille
          </CardTitle>
          <CardDescription>{lilleMissing1.length} deltakere</CardDescription>
        </CardHeader>
        <CardContent>{renderMissing(lilleMissing1)}</CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-orange-400" /> Mangler 2 til Lille
          </CardTitle>
          <CardDescription>{lilleMissing2.length} deltakere</CardDescription>
        </CardHeader>
        <CardContent>{renderMissing(lilleMissing2)}</CardContent>
      </Card>

      <ParticipantDetailDialog
        participantId={selectedParticipantId}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </div>
  );
}