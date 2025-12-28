import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { Loader2, Save, Upload, Shield, Users, Heart } from 'lucide-react';
import type { Tables } from '@/integrations/supabase/types';

type Leader = Tables<'leaders'>;
type AppRole = 'admin' | 'nurse' | 'leader';

interface LeaderDetailDialogProps {
  leader: Leader | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
  currentRole?: AppRole;
}

export function LeaderDetailDialog({ 
  leader, 
  open, 
  onOpenChange, 
  onSaved,
  currentRole = 'leader'
}: LeaderDetailDialogProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  
  // Form state
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [age, setAge] = useState<number | null>(null);
  const [team, setTeam] = useState('');
  const [cabin, setCabin] = useState('');
  const [cabinInfo, setCabinInfo] = useState('');
  const [ministerpost, setMinisterpost] = useState('');
  const [profileImageUrl, setProfileImageUrl] = useState('');
  
  // Certifications
  const [hasCar, setHasCar] = useState(false);
  const [hasDriversLicense, setHasDriversLicense] = useState(false);
  const [hasBoatLicense, setHasBoatLicense] = useState(false);
  const [canRappelling, setCanRappelling] = useState(false);
  const [canClimbing, setCanClimbing] = useState(false);
  const [canZipline, setCanZipline] = useState(false);
  const [canRopeSetup, setCanRopeSetup] = useState(false);
  
  // Role
  const [role, setRole] = useState<AppRole>('leader');

  // Populate form when leader changes
  useEffect(() => {
    if (leader) {
      setName(leader.name || '');
      setPhone(leader.phone || '');
      setEmail(leader.email || '');
      setAge(leader.age);
      setTeam(leader.team || '');
      setCabin(leader.cabin || '');
      setCabinInfo(leader.cabin_info || '');
      setMinisterpost(leader.ministerpost || '');
      setProfileImageUrl(leader.profile_image_url || '');
      setHasCar(leader.has_car || false);
      setHasDriversLicense(leader.has_drivers_license || false);
      setHasBoatLicense(leader.has_boat_license || false);
      setCanRappelling(leader.can_rappelling || false);
      setCanClimbing(leader.can_climbing || false);
      setCanZipline(leader.can_zipline || false);
      setCanRopeSetup(leader.can_rope_setup || false);
      setRole(currentRole);
    }
  }, [leader, currentRole]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !leader) return;

    setIsUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `leader-${leader.id}-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('participant-images')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('participant-images')
        .getPublicUrl(fileName);

      setProfileImageUrl(publicUrl);
      toast.success('Bilde lastet opp!');
    } catch (error) {
      console.error('Error uploading image:', error);
      toast.error('Kunne ikke laste opp bilde');
    } finally {
      setIsUploading(false);
    }
  };

  const handleSave = async () => {
    if (!leader) return;

    setIsSaving(true);
    try {
      // Update leader profile
      const { error: leaderError } = await supabase
        .from('leaders')
        .update({
          name,
          phone: phone.replace(/\s/g, ''),
          email: email || null,
          age: age || null,
          team: team || null,
          cabin: cabin || null,
          cabin_info: cabinInfo || null,
          ministerpost: ministerpost || null,
          profile_image_url: profileImageUrl || null,
          has_car: hasCar,
          has_drivers_license: hasDriversLicense,
          has_boat_license: hasBoatLicense,
          can_rappelling: canRappelling,
          can_climbing: canClimbing,
          can_zipline: canZipline,
          can_rope_setup: canRopeSetup,
        })
        .eq('id', leader.id);

      if (leaderError) throw leaderError;

      // Update role
      // First, remove existing roles for this leader
      await supabase
        .from('user_roles')
        .delete()
        .eq('leader_id', leader.id);

      // If role is admin or nurse, insert into user_roles
      if (role === 'admin' || role === 'nurse') {
        const { error: roleError } = await supabase
          .from('user_roles')
          .insert({ leader_id: leader.id, role: role });

        if (roleError) throw roleError;
      }

      toast.success('Leder oppdatert!');
      onSaved();
      onOpenChange(false);
    } catch (error) {
      console.error('Error saving leader:', error);
      toast.error('Kunne ikke lagre endringer');
    } finally {
      setIsSaving(false);
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  if (!leader) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Rediger leder</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Profile Image */}
          <div className="flex items-center gap-4">
            <Avatar className="w-20 h-20">
              <AvatarImage src={profileImageUrl} alt={name} />
              <AvatarFallback className="text-lg">{getInitials(name)}</AvatarFallback>
            </Avatar>
            <div>
              <Label htmlFor="profile-image" className="cursor-pointer">
                <Button variant="outline" size="sm" asChild disabled={isUploading}>
                  <span>
                    {isUploading ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Upload className="w-4 h-4 mr-2" />
                    )}
                    Last opp bilde
                  </span>
                </Button>
              </Label>
              <input
                id="profile-image"
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />
            </div>
          </div>

          <Separator />

          {/* Basic Info */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">Navn</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Telefon</Label>
              <Input
                id="phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">E-post</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="age">Alder</Label>
              <Input
                id="age"
                type="number"
                value={age || ''}
                onChange={(e) => setAge(e.target.value ? parseInt(e.target.value) : null)}
              />
            </div>
          </div>

          {/* Team/Cabin Info */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="team">Team</Label>
              <Input
                id="team"
                value={team}
                onChange={(e) => setTeam(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cabin">Hytte</Label>
              <Input
                id="cabin"
                value={cabin}
                onChange={(e) => setCabin(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cabinInfo">Hytte-ansvar</Label>
              <Input
                id="cabinInfo"
                value={cabinInfo}
                onChange={(e) => setCabinInfo(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ministerpost">Ministerpost</Label>
              <Input
                id="ministerpost"
                value={ministerpost}
                onChange={(e) => setMinisterpost(e.target.value)}
              />
            </div>
          </div>

          <Separator />

          {/* Role Selection */}
          <div className="space-y-3">
            <Label className="text-base font-semibold">Rolle</Label>
            <RadioGroup value={role} onValueChange={(value) => setRole(value as AppRole)}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="leader" id="role-leader" />
                <Label htmlFor="role-leader" className="flex items-center gap-2 cursor-pointer">
                  <Users className="w-4 h-4 text-muted-foreground" />
                  Leder
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="admin" id="role-admin" />
                <Label htmlFor="role-admin" className="flex items-center gap-2 cursor-pointer">
                  <Shield className="w-4 h-4 text-blue-500" />
                  Admin
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="nurse" id="role-nurse" />
                <Label htmlFor="role-nurse" className="flex items-center gap-2 cursor-pointer">
                  <Heart className="w-4 h-4 text-green-500" />
                  Sykepleier
                </Label>
              </div>
            </RadioGroup>
          </div>

          <Separator />

          {/* Certifications */}
          <div className="space-y-3">
            <Label className="text-base font-semibold">Sertifiseringer og utstyr</Label>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="hasCar"
                  checked={hasCar}
                  onCheckedChange={(checked) => setHasCar(checked === true)}
                />
                <Label htmlFor="hasCar" className="cursor-pointer">Har med bil</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="hasDriversLicense"
                  checked={hasDriversLicense}
                  onCheckedChange={(checked) => setHasDriversLicense(checked === true)}
                />
                <Label htmlFor="hasDriversLicense" className="cursor-pointer">Bil-lappen</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="hasBoatLicense"
                  checked={hasBoatLicense}
                  onCheckedChange={(checked) => setHasBoatLicense(checked === true)}
                />
                <Label htmlFor="hasBoatLicense" className="cursor-pointer">Båt-lappen</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="canRappelling"
                  checked={canRappelling}
                  onCheckedChange={(checked) => setCanRappelling(checked === true)}
                />
                <Label htmlFor="canRappelling" className="cursor-pointer">Rappis</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="canClimbing"
                  checked={canClimbing}
                  onCheckedChange={(checked) => setCanClimbing(checked === true)}
                />
                <Label htmlFor="canClimbing" className="cursor-pointer">Klatring</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="canZipline"
                  checked={canZipline}
                  onCheckedChange={(checked) => setCanZipline(checked === true)}
                />
                <Label htmlFor="canZipline" className="cursor-pointer">Taubane oppe</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="canRopeSetup"
                  checked={canRopeSetup}
                  onCheckedChange={(checked) => setCanRopeSetup(checked === true)}
                />
                <Label htmlFor="canRopeSetup" className="cursor-pointer">Taubane oppsett</Label>
              </div>
            </div>
          </div>

          <Separator />

          {/* Save Button */}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Avbryt
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              Lagre
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
