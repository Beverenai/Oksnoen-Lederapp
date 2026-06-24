import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { lazy, Suspense, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Users,
  Plus,
  Save,
  Loader2,
  Shield,
  Heart,
  UserCheck,
  Search,
  Upload,
} from 'lucide-react';
import { CabinsTab } from '@/components/admin/CabinsTab';
import { ParticipantImportTab } from '@/components/admin/ParticipantImportTab';
import { ScheduleTab } from '@/components/admin/ScheduleTab';
import { PushNotificationsTab } from '@/components/admin/PushNotificationsTab';
import { RopeControlTab } from '@/components/admin/RopeControlTab';
import { ActivitiesTab } from '@/components/admin/ActivitiesTab';
import { SkjaerTab } from '@/components/admin/SkjaerTab';
import { StoriesTab } from '@/components/admin/StoriesTab';
import { LeaderImportDialog } from '@/components/admin/LeaderImportDialog';
import { GoogleSheetSyncTab } from '@/components/admin/GoogleSheetSyncTab';
import { OvernattingTab } from '@/components/admin/OvernattingTab';
import { GjenglemtSettingsTab } from '@/components/admin/settings/GjenglemtSettingsTab';
const HomeConfigTab = lazy(() => import('@/components/admin/HomeConfigTab'));
import type { Tables } from '@/integrations/supabase/types';

type Leader = Tables<'leaders'>;
type AppRole = 'superadmin' | 'admin' | 'nurse' | 'leader';

interface LeaderWithRole extends Leader {
  role: AppRole;
}

interface AdminSettingsContentProps {
  activeSection: string;
  // Leaders props
  leaders: LeaderWithRole[];
  leaderSearch: string;
  setLeaderSearch: (value: string) => void;
  isDeactivating: boolean;
  deactivateAllLeaders: () => Promise<void>;
  activateAllLeaders: () => Promise<void>;
  toggleLeaderActive: (leader: Leader) => Promise<void>;
  onEditLeader: (leader: LeaderWithRole) => void;
  // New leader form
  newLeaderName: string;
  setNewLeaderName: (value: string) => void;
  newLeaderPhone: string;
  setNewLeaderPhone: (value: string) => void;
  newLeaderIsAdmin: boolean;
  setNewLeaderIsAdmin: (value: boolean) => void;
  addLeader: () => Promise<void>;
  // Activation + home config
  isSuperAdmin: boolean;
  homeConfig: any[];
  localHomeConfig: any[];
  setLocalHomeConfig: React.Dispatch<React.SetStateAction<any[]>>;
  setHomeConfig: React.Dispatch<React.SetStateAction<any[]>>;
  onLeaderUpdated: () => void | Promise<void>;
}

export function AdminSettingsContent({
  activeSection,
  leaders,
  leaderSearch,
  setLeaderSearch,
  isDeactivating,
  deactivateAllLeaders,
  activateAllLeaders,
  toggleLeaderActive,
  onEditLeader,
  newLeaderName,
  setNewLeaderName,
  newLeaderPhone,
  setNewLeaderPhone,
  newLeaderIsAdmin,
  setNewLeaderIsAdmin,
  addLeader,
  isSuperAdmin,
  homeConfig,
  localHomeConfig,
  setLocalHomeConfig,
  setHomeConfig,
  onLeaderUpdated,
}: AdminSettingsContentProps) {
  const [isImportOpen, setIsImportOpen] = useState(false);
  switch (activeSection) {
    case 'leaders':
      return (
        <div className="space-y-4">
          <LeaderImportDialog
            open={isImportOpen}
            onOpenChange={setIsImportOpen}
            existingPhones={leaders.map(l => l.phone)}
            onImported={onLeaderUpdated}
          />
          {/* Leader Overview Stats and Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                Ledere ({leaders.filter(l => l.phone !== '12345678').length})
              </CardTitle>
              <CardDescription className="flex flex-wrap gap-2 items-center">
                <span>Aktive: {leaders.filter(l => l.is_active !== false && l.phone !== '12345678').length}</span>
                <span className="text-muted-foreground">•</span>
                <span>Inaktive: {leaders.filter(l => l.is_active === false && l.phone !== '12345678').length}</span>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => setIsImportOpen(true)}
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Importer ledere
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={deactivateAllLeaders}
                  disabled={isDeactivating}
                >
                  {isDeactivating ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Users className="w-4 h-4 mr-2" />
                  )}
                  Deaktiver alle
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={activateAllLeaders}
                  disabled={isDeactivating}
                >
                  {isDeactivating ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <UserCheck className="w-4 h-4 mr-2" />
                  )}
                  Aktiver alle
                </Button>
              </div>

              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Søk etter leder..."
                  value={leaderSearch}
                  onChange={(e) => setLeaderSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              
              {/* Leaders Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-3 font-medium">Status</th>
                      <th className="text-left py-2 px-3 font-medium">Bilde</th>
                      <th className="text-left py-2 px-3 font-medium">Navn</th>
                      <th className="text-left py-2 px-3 font-medium">Rolle</th>
                      <th className="text-left py-2 px-3 font-medium">Telefon</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {leaders
                      .filter((leader) =>
                        leader.phone !== '12345678' &&
                        (leader.name.toLowerCase().includes(leaderSearch.toLowerCase()) ||
                        leader.phone.includes(leaderSearch))
                      )
                      .map((leader) => (
                      <tr 
                        key={leader.id} 
                        className={`hover:bg-muted/50 cursor-pointer ${leader.is_active === false ? 'opacity-50' : ''}`}
                        onClick={() => onEditLeader(leader)}
                      >
                        <td className="py-2 px-3">
                          <Switch
                            checked={leader.is_active !== false}
                            onCheckedChange={() => toggleLeaderActive(leader)}
                            onClick={(e) => e.stopPropagation()}
                          />
                        </td>
                        <td className="py-2 px-3">
                          <Avatar className="h-8 w-8">
                            {leader.profile_image_url ? (
                              <AvatarImage src={leader.profile_image_url} alt={leader.name} />
                            ) : null}
                            <AvatarFallback className="text-xs">
                              {leader.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                        </td>
                        <td className="py-2 px-3 font-medium">{leader.name}</td>
                        <td className="py-2 px-3">
                          {leader.role === 'admin' && (
                            <Badge variant="default" className="bg-blue-500 hover:bg-blue-600">
                              <Shield className="w-3 h-3 mr-1" />
                              Admin
                            </Badge>
                          )}
                          {leader.role === 'nurse' && (
                            <Badge variant="default" className="bg-green-500 hover:bg-green-600">
                              <Heart className="w-3 h-3 mr-1" />
                              Sykepleier
                            </Badge>
                          )}
                          {leader.role === 'leader' && (
                            <span className="text-muted-foreground">Leder</span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-muted-foreground">{leader.phone}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {leaders.filter(l => l.phone !== '12345678').length === 0 && (
                  <p className="text-muted-foreground text-center py-8">
                    Ingen ledere registrert enda
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Add New Leader */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plus className="w-5 h-5" />
                Legg til ny leder
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">Navn</Label>
                  <Input
                    id="name"
                    placeholder="Ola Nordmann"
                    value={newLeaderName}
                    onChange={(e) => setNewLeaderName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Telefon</Label>
                  <Input
                    id="phone"
                    placeholder="12345678"
                    value={newLeaderPhone}
                    onChange={(e) => setNewLeaderPhone(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="isAdmin"
                  checked={newLeaderIsAdmin}
                  onCheckedChange={setNewLeaderIsAdmin}
                />
                <Label htmlFor="isAdmin">Administrator</Label>
              </div>
              <Button onClick={addLeader}>
                <Plus className="w-4 h-4 mr-2" />
                Legg til leder
              </Button>
            </CardContent>
          </Card>
        </div>
      );

    case 'cabins':
      return <CabinsTab />;

    case 'participants':
      return <ParticipantImportTab />;

    case 'schedule':
      return <ScheduleTab />;

    case 'push':
      return <PushNotificationsTab />;

    case 'rope-control':
      return <RopeControlTab />;

    case 'activities':
      return <ActivitiesTab />;

    case 'skjaer':
      return <SkjaerTab />;

    case 'stories':
      return <StoriesTab />;

    case 'google-sheet':
      return <GoogleSheetSyncTab />;

    case 'overnatting':
      return <OvernattingTab />;

    case 'gjenglemt':
      return <GjenglemtSettingsTab />;

    case 'home-config':
      return (
        <Suspense fallback={<div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>}>
          <HomeConfigTab
            homeConfig={homeConfig}
            localHomeConfig={localHomeConfig}
            setLocalHomeConfig={setLocalHomeConfig}
            onSaved={onLeaderUpdated}
            setHomeConfig={setHomeConfig}
          />
        </Suspense>
      );

    default:
      return (
        <Card>
          <CardContent className="pt-6 text-center text-muted-foreground">
            Velg en seksjon fra menyen
          </CardContent>
        </Card>
      );
  }
}
