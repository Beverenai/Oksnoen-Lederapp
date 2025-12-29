import { Phone, Activity, Car, Anchor, Mountain, Cable, AlertTriangle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import * as icons from "lucide-react";

interface CabinInfo {
  id: string;
  name: string;
}

interface LeaderWithContent {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  age: number | null;
  team: string | null;
  cabin: string | null;
  ministerpost: string | null;
  profile_image_url: string | null;
  has_car: boolean | null;
  has_drivers_license: boolean | null;
  has_boat_license: boolean | null;
  can_rappelling: boolean | null;
  can_climbing: boolean | null;
  can_zipline: boolean | null;
  can_rope_setup: boolean | null;
  cabins?: CabinInfo[];
  content?: {
    current_activity: string | null;
    extra_activity: string | null;
    obs_message: string | null;
    has_read: boolean | null;
    extra_1: string | null;
    extra_2: string | null;
    extra_3: string | null;
    extra_4: string | null;
    extra_5: string | null;
  } | null;
  isAdmin?: boolean;
  isNurse?: boolean;
  extraFields?: Array<{
    field_key: string;
    title: string;
    icon: string;
    is_visible: boolean | null;
  }>;
}

interface LeaderDetailDialogProps {
  leader: LeaderWithContent | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const getTeamStyles = (team: string | null) => {
  if (!team) return 'bg-muted text-muted-foreground';
  const t = team.toLowerCase();
  if (t === 'kjøkken') return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300';
  if (t === '1') return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300';
  if (t === '2') return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300';
  if (t === '3') return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300';
  if (t === '4') return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300';
  return 'bg-muted text-muted-foreground';
};

const formatTeamDisplay = (team: string | null) => {
  if (!team) return null;
  const t = team.toLowerCase();
  if (t === 'kjøkken') return 'Kjøkken';
  if (['1', '2', '3', '4'].includes(t)) return `Team ${t}`;
  return team;
};

const getFirstName = (fullName: string) => {
  return fullName.split(' ')[0];
};

const getAvatarBorderClass = (leader: LeaderWithContent) => {
  const isFri = leader.content?.current_activity?.toLowerCase().includes('fri');
  const isKitchen = leader.team?.toLowerCase() === 'kjøkken';
  
  if (isKitchen) return 'ring-4 ring-purple-500';
  if (isFri) return 'ring-4 ring-blue-500';
  if (leader.isAdmin || leader.isNurse || leader.content?.has_read) return 'ring-4 ring-green-500';
  return 'ring-4 ring-red-500';
};

export function LeaderDetailDialog({ leader, open, onOpenChange }: LeaderDetailDialogProps) {
  const [linkedCabins, setLinkedCabins] = useState<CabinInfo[]>([]);

  useEffect(() => {
    if (leader && open) {
      loadLinkedCabins();
    }
  }, [leader, open]);

  const loadLinkedCabins = async () => {
    if (!leader) return;
    
    const { data } = await supabase
      .from('leader_cabins')
      .select('cabin_id, cabins(id, name)')
      .eq('leader_id', leader.id);
    
    if (data) {
      const cabins = data
        .map(lc => lc.cabins)
        .filter((c): c is CabinInfo => c !== null);
      setLinkedCabins(cabins);
    }
  };

  const formatCabinsDisplay = () => {
    if (linkedCabins.length === 0) return null;
    return linkedCabins.map(c => c.name).join(', ');
  };

  const getIcon = (iconName: string) => {
    const iconsMap = icons as unknown as Record<string, React.ComponentType<{ className?: string }>>;
    const IconComponent = iconsMap[iconName];
    return IconComponent ? <IconComponent className="h-4 w-4" /> : null;
  };

  if (!leader) return null;

  const certifications = [
    { key: 'has_car', label: 'Bil', icon: Car, value: leader.has_car },
    { key: 'has_drivers_license', label: 'Førerkort', icon: Car, value: leader.has_drivers_license },
    { key: 'has_boat_license', label: 'Båtførerbevis', icon: Anchor, value: leader.has_boat_license },
    { key: 'can_rappelling', label: 'Rappellering', icon: Mountain, value: leader.can_rappelling },
    { key: 'can_climbing', label: 'Klatring', icon: Mountain, value: leader.can_climbing },
    { key: 'can_zipline', label: 'Zipline', icon: Cable, value: leader.can_zipline },
    { key: 'can_rope_setup', label: 'Tau-oppsett', icon: Cable, value: leader.can_rope_setup },
  ].filter(c => c.value);

  const cabinsDisplay = formatCabinsDisplay();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm sm:max-w-md rounded-2xl p-0 gap-0 border-0 overflow-hidden">
        <div className="p-6 pb-4">
          <DialogHeader className="mb-4">
            <div className="flex flex-col items-center gap-3">
              <Avatar className={`w-24 h-24 ${getAvatarBorderClass(leader)}`}>
                <AvatarImage src={leader.profile_image_url || undefined} alt={leader.name} />
                <AvatarFallback className="text-2xl font-semibold bg-muted">
                  {getFirstName(leader.name).charAt(0)}
                </AvatarFallback>
              </Avatar>
              <div className="text-center">
                <DialogTitle className="text-xl font-bold">{leader.name}</DialogTitle>
                {leader.ministerpost && (
                  <p className="text-sm text-muted-foreground mt-1">{leader.ministerpost}</p>
                )}
              </div>
              <div className="flex flex-wrap gap-2 justify-center">
                {leader.team && (
                  <Badge className={getTeamStyles(leader.team)}>
                    {formatTeamDisplay(leader.team)}
                  </Badge>
                )}
                {cabinsDisplay && (
                  <Badge variant="outline">{cabinsDisplay}</Badge>
                )}
                {leader.isAdmin && (
                  <Badge variant="secondary">Admin</Badge>
                )}
                {leader.isNurse && (
                  <Badge variant="secondary">Sykepleier</Badge>
                )}
              </div>
            </div>
          </DialogHeader>

          {/* Activity Section */}
          {(leader.content?.current_activity || leader.content?.extra_activity) && (
            <div className="bg-muted/50 rounded-xl p-4 mb-4 space-y-2">
              {leader.content?.current_activity && (
                <div className="flex items-center gap-3">
                  <Activity className="h-5 w-5 text-primary shrink-0" />
                  <span className="font-medium">{leader.content.current_activity}</span>
                </div>
              )}
              {leader.content?.extra_activity && (
                <div className="flex items-center gap-3 text-muted-foreground">
                  <div className="w-5" />
                  <span className="text-sm">{leader.content.extra_activity}</span>
                </div>
              )}
            </div>
          )}

          {/* OBS Message */}
          {leader.content?.obs_message && (
            <Alert variant="destructive" className="mb-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{leader.content.obs_message}</AlertDescription>
            </Alert>
          )}

          {/* Certifications */}
          {certifications.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {certifications.map(cert => (
                <Badge key={cert.key} variant="outline" className="gap-1">
                  <cert.icon className="h-3 w-3" />
                  {cert.label}
                </Badge>
              ))}
            </div>
          )}

          {/* Extra Fields */}
          {leader.extraFields && leader.extraFields.length > 0 && (
            <div className="space-y-2 mb-4">
              {leader.extraFields.map(field => {
                if (!field.is_visible) return null;
                const value = leader.content?.[field.field_key as keyof typeof leader.content];
                if (!value) return null;
                return (
                  <div key={field.field_key} className="flex items-center gap-2 text-sm">
                    {getIcon(field.icon)}
                    <span className="text-muted-foreground">{field.title}:</span>
                    <span>{String(value)}</span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Call Button */}
          <Button 
            className="w-full gap-2" 
            onClick={() => window.location.href = `tel:${leader.phone}`}
          >
            <Phone className="h-4 w-4" />
            Ring {getFirstName(leader.name)}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
