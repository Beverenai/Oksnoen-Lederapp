import { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Phone, AlertTriangle, Car, Anchor, Mountain, Cross, Home } from 'lucide-react';
import { icons } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';

type Leader = Tables<'leaders'>;
type LeaderContent = Tables<'leader_content'>;
type ExtraFieldConfig = Tables<'extra_fields_config'>;

interface CabinInfo {
  id: string;
  name: string;
}

interface LeaderWithContent extends Leader {
  content?: LeaderContent | null;
  isAdmin?: boolean;
  isNurse?: boolean;
  linkedCabins?: CabinInfo[];
}

interface LeaderDetailSheetProps {
  leader: LeaderWithContent | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  extraFieldsConfig: ExtraFieldConfig[];
  onCabinClick?: (cabins: CabinInfo[], leaderId: string) => void;
}

// Team color mapping - supports both short (1, 2f) and long (Team 1, Team 2F) formats
const getTeamStyles = (team: string | null): string => {
  const teamLower = team?.toLowerCase().trim();
  switch (teamLower) {
    case '1':
    case 'team 1':
      return 'bg-red-500 text-white border-red-500';
    case '2':
    case 'team 2':
      return 'bg-orange-500 text-white border-orange-500';
    case '1f':
    case 'team 1f':
      return 'bg-yellow-400 text-black border-yellow-400';
    case '2f':
    case 'team 2f':
      return 'bg-blue-500 text-white border-blue-500';
    case 'kjøkken':
      return 'bg-purple-500 text-white border-purple-500';
    case 'sjef':
      return 'bg-slate-600 text-white border-slate-600';
    case 'kordinator':
      return 'bg-pink-500 text-white border-pink-500';
    case 'nurse':
      return 'bg-rose-600 text-white border-rose-600';
    default:
      return 'bg-muted text-muted-foreground border-border';
  }
};

// Format team display: "1" -> "Team 1", "2f" -> "Team 2F", others unchanged
const formatTeamDisplay = (team: string | null): string => {
  if (!team) return '';
  const teamLower = team.toLowerCase().trim();
  if (['1', '2', '1f', '2f'].includes(teamLower)) {
    return `Team ${team.toUpperCase()}`;
  }
  return team;
};

// Get first name only
const getFirstName = (fullName: string) => fullName.split(' ')[0];

export function LeaderDetailSheet({ 
  leader, 
  open, 
  onOpenChange, 
  extraFieldsConfig,
  onCabinClick
}: LeaderDetailSheetProps) {
  const [linkedCabins, setLinkedCabins] = useState<CabinInfo[]>([]);
  
  // Load linked cabins when leader changes
  useEffect(() => {
    if (leader?.id && open) {
      // First check if linkedCabins is already provided
      if (leader.linkedCabins && leader.linkedCabins.length > 0) {
        setLinkedCabins(leader.linkedCabins);
      } else {
        // Fetch from database
        loadLinkedCabins(leader.id);
      }
    }
  }, [leader?.id, open, leader?.linkedCabins]);
  
  const loadLinkedCabins = async (leaderId: string) => {
    const { data, error } = await supabase
      .from('leader_cabins')
      .select(`
        cabins!leader_cabins_cabin_id_fkey (
          id,
          name
        )
      `)
      .eq('leader_id', leaderId);
    
    if (!error && data) {
      const cabins: CabinInfo[] = data
        .map((lc: any) => lc.cabins)
        .filter(Boolean);
      setLinkedCabins(cabins);
    }
  };
  
  if (!leader) return null;

  const content = leader.content;
  
  // Format linked cabins display with "+" between them
  const formatCabinsDisplay = (): string => {
    if (linkedCabins.length === 0) return leader.cabin || '';
    return linkedCabins.map(c => c.name).join(' + ');
  };
  
  // Handle cabin badge click
  const handleCabinBadgeClick = () => {
    if (linkedCabins.length > 0 && onCabinClick) {
      onCabinClick(linkedCabins, leader.id);
    }
  };
  
  // Get visible extra fields with their values
  const visibleExtraFields = extraFieldsConfig
    .filter(config => config.is_visible)
    .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
    .map(config => {
      const fieldKey = config.field_key as keyof LeaderContent;
      const value = content?.[fieldKey];
      return {
        ...config,
        value: typeof value === 'string' ? value : null
      };
    })
    .filter(field => field.value);

  // Dynamic icon component
  const getIcon = (iconName: string) => {
    const IconComponent = icons[iconName as keyof typeof icons];
    return IconComponent ? <IconComponent className="w-4 h-4" /> : null;
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[85vh] rounded-t-2xl pb-safe">
        <SheetHeader className="text-left pb-4">
          <div className="flex items-start gap-4">
            <Avatar className="w-20 h-20 border-2 border-primary/20">
              {leader.profile_image_url && (
                <AvatarImage src={leader.profile_image_url} alt={leader.name} />
              )}
              <AvatarFallback className="bg-primary/10 text-primary text-xl">
                {getFirstName(leader.name).slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <SheetTitle className="text-xl">{getFirstName(leader.name)}</SheetTitle>
                {leader.isAdmin && (
                  <Badge variant="secondary" className="text-xs bg-slate-500 text-white border-slate-500">
                    Admin
                  </Badge>
                )}
                {leader.isNurse && (
                  <span className="text-red-600 flex items-center" title="Sykepleier">
                    <Cross className="w-5 h-5" fill="currentColor" />
                  </span>
                )}
              </div>
              {leader.ministerpost && (
                <p className="text-sm text-muted-foreground mt-0.5">{leader.ministerpost}</p>
              )}
              <div className="flex flex-wrap gap-1.5 mt-2">
                {leader.team && (
                  <Badge className={getTeamStyles(leader.team)}>{formatTeamDisplay(leader.team)}</Badge>
                )}
                {linkedCabins.length > 0 ? (
                  <Badge 
                    variant="outline" 
                    className="cursor-pointer hover:bg-accent flex items-center gap-1"
                    onClick={handleCabinBadgeClick}
                  >
                    <Home className="w-3 h-3" />
                    {formatCabinsDisplay()}
                  </Badge>
                ) : leader.cabin && (
                  <Badge variant="outline">{leader.cabin}</Badge>
                )}
              </div>
            </div>
          </div>
        </SheetHeader>

        <div className="space-y-4 overflow-y-auto pb-6">
          {/* Call button */}
          <Button 
            asChild 
            className="w-full bg-green-600 hover:bg-green-700 text-white"
            size="lg"
          >
            <a href={`tel:${leader.phone}`}>
              <Phone className="w-5 h-5 mr-2" />
              Ring {leader.phone}
            </a>
          </Button>

          {/* Certifications */}
          {(leader.has_drivers_license || leader.has_boat_license || leader.can_rappelling || leader.can_climbing || leader.can_zipline) && (
            <div className="flex flex-wrap gap-2">
              {leader.has_drivers_license && (
                <Badge variant="outline" className="gap-1">
                  <Car className="w-3 h-3" /> Førerkort
                </Badge>
              )}
              {leader.has_boat_license && (
                <Badge variant="outline" className="gap-1">
                  <Anchor className="w-3 h-3" /> Båtførerbevis
                </Badge>
              )}
              {(leader.can_rappelling || leader.can_climbing || leader.can_zipline) && (
                <Badge variant="outline" className="gap-1">
                  <Mountain className="w-3 h-3" /> Høydeaktiviteter
                </Badge>
              )}
            </div>
          )}

          {/* OBS message */}
          {content?.obs_message && (
            <Alert variant="destructive" className="border-destructive/50 bg-destructive/10">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="font-medium">
                {content.obs_message}
              </AlertDescription>
            </Alert>
          )}

          {/* Extra fields */}
          {visibleExtraFields.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Ekstra info
              </h3>
              <div className="space-y-2">
                {visibleExtraFields.map((field) => (
                  <div 
                    key={field.id} 
                    className="p-3 rounded-lg bg-muted/50 border border-border"
                  >
                    <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-1">
                      {getIcon(field.icon)}
                      <span>{field.title}</span>
                    </div>
                    <p className="text-foreground">{field.value}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
