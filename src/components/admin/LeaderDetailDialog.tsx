import { useStatusPopup } from '@/hooks/useStatusPopup';
import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Loader2, Shield, Users, Heart, Camera, Bell, Check } from 'lucide-react';
import type { Tables } from '@/integrations/supabase/types';
import { compressImage } from '@/lib/imageUtils';
import { hapticSuccess } from '@/lib/capacitorHaptics';
import { useAuth } from '@/contexts/AuthContext';

type Leader = Tables<'leaders'>;
type AppRole = 'superadmin' | 'admin' | 'nurse' | 'leader';

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
  const { showSuccess, showError, showInfo } = useStatusPopup();
  const { leader: currentLeader } = useAuth();
  const [isUploading, setIsUploading] = useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  
  // Change notification state
  const [showNotifyDialog, setShowNotifyDialog] = useState(false);
  const [detectedChanges, setDetectedChanges] = useState<string[]>([]);
  const [isSendingNotification, setIsSendingNotification] = useState(false);
  
  // Store original values for change detection
  const originalValuesRef = useRef<Record<string, any>>({});
  // Track if initial load is done (skip auto-save on mount)
  const isInitializedRef = useRef(false);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const roleSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // Form state
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [age, setAge] = useState<number | null>(null);
  const [team, setTeam] = useState('');
  const [cabin, setCabin] = useState('');
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
      isInitializedRef.current = false;
      setName(leader.name || '');
      setPhone(leader.phone || '');
      setEmail(leader.email || '');
      setAge(leader.age);
      setTeam(leader.team || '');
      setCabin(leader.cabin || leader.cabin_info || '');
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
      setAutoSaveStatus('idle');
      
      originalValuesRef.current = {
        name: leader.name || '',
        phone: leader.phone || '',
        email: leader.email || '',
        age: leader.age,
        team: leader.team || '',
        cabin: leader.cabin || leader.cabin_info || '',
        ministerpost: leader.ministerpost || '',
        hasCar: leader.has_car || false,
        hasDriversLicense: leader.has_drivers_license || false,
        hasBoatLicense: leader.has_boat_license || false,
        canRappelling: leader.can_rappelling || false,
        canClimbing: leader.can_climbing || false,
        canZipline: leader.can_zipline || false,
        canRopeSetup: leader.can_rope_setup || false,
        role: currentRole,
      };
      
      // Mark as initialized after a tick so the first useEffect cycle doesn't trigger save
      setTimeout(() => { isInitializedRef.current = true; }, 100);
    }
  }, [leader, currentRole]);

  // Cleanup timers
  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
      if (roleSaveTimerRef.current) clearTimeout(roleSaveTimerRef.current);
    };
  }, []);

  const saveLeaderFields = useCallback(async () => {
    if (!leader) return;
    setAutoSaveStatus('saving');
    try {
      const { error } = await supabase
        .from('leaders')
        .update({
          name,
          phone: phone.replace(/\s/g, ''),
          email: email || null,
          age: age || null,
          team: team || null,
          cabin: cabin || null,
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

      if (error) throw error;
      
      setAutoSaveStatus('saved');
      hapticSuccess();
      onSaved();
      
      // Reset status after 2s
      setTimeout(() => setAutoSaveStatus('idle'), 2000);
    } catch (error) {
      console.error('Auto-save error:', error);
      setAutoSaveStatus('idle');
      showError('Kunne ikke lagre');
    }
  }, [leader, name, phone, email, age, team, cabin, ministerpost, profileImageUrl, hasCar, hasDriversLicense, hasBoatLicense, canRappelling, canClimbing, canZipline, canRopeSetup, onSaved, showError]);

  // Debounced auto-save for all fields (1s debounce)
  useEffect(() => {
    if (!isInitializedRef.current || !leader) return;
    
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => {
      saveLeaderFields();
    }, 1000);
  }, [name, phone, email, age, team, cabin, ministerpost, hasCar, hasDriversLicense, hasBoatLicense, canRappelling, canClimbing, canZipline, canRopeSetup, saveLeaderFields, leader]);

  // Auto-save role changes (separate because it uses edge function)
  useEffect(() => {
    if (!isInitializedRef.current || !leader) return;
    
    if (roleSaveTimerRef.current) clearTimeout(roleSaveTimerRef.current);
    roleSaveTimerRef.current = setTimeout(async () => {
      setAutoSaveStatus('saving');
      try {
        const { error } = await supabase.functions.invoke('manage-roles', {
          body: { action: 'set', leader_id: leader.id, role }
        });
        if (error) throw error;
        setAutoSaveStatus('saved');
        hapticSuccess();
        onSaved();
        setTimeout(() => setAutoSaveStatus('idle'), 2000);
      } catch (err) {
        console.error('Role save error:', err);
        setAutoSaveStatus('idle');
        showError('Kunne ikke lagre rolle');
      }
    }, 500);
  }, [role, leader, onSaved, showError]);

  const getFirstName = (fullName: string) => fullName.split(' ')[0];

  // Get changes for notification
  const getChanges = (): string[] => {
    const changes: string[] = [];
    const orig = originalValuesRef.current;
    
    if (team !== orig.team && team) changes.push(`Nytt team: ${team}`);
    if (cabin !== orig.cabin && cabin) changes.push(`Ny hytte: ${cabin}`);
    if (ministerpost !== orig.ministerpost && ministerpost) changes.push(`Ny ministerpost: "${ministerpost}"`);
    
    if (hasCar && !orig.hasCar) changes.push(`Lagt til: Har med bil`);
    if (hasDriversLicense && !orig.hasDriversLicense) changes.push(`Lagt til: Førerkort`);
    if (hasBoatLicense && !orig.hasBoatLicense) changes.push(`Lagt til: Båtførerbevis`);
    if (canRappelling && !orig.canRappelling) changes.push(`Lagt til sertifisering: Rappellering`);
    if (canClimbing && !orig.canClimbing) changes.push(`Lagt til sertifisering: Klatring`);
    if (canZipline && !orig.canZipline) changes.push(`Lagt til sertifisering: Taubane`);
    if (canRopeSetup && !orig.canRopeSetup) changes.push(`Lagt til sertifisering: Taubane-oppsett`);
    
    if (role !== orig.role) {
      const roleNames: Record<AppRole, string> = {
        superadmin: 'Superadmin', admin: 'Admin', nurse: 'Sykepleier', leader: 'Leder'
      };
      changes.push(`Din rolle er endret til: ${roleNames[role]}`);
    }
    
    return changes;
  };

  // When dialog closes, check for changes and offer notification
  const handleClose = (isOpen: boolean) => {
    if (!isOpen && leader) {
      const changes = getChanges();
      if (changes.length > 0) {
        setDetectedChanges(changes);
        setShowNotifyDialog(true);
        return; // Don't close yet — wait for notification decision
      }
    }
    onOpenChange(isOpen);
  };

  const handleSendChangeNotification = async () => {
    if (!leader || !currentLeader) return;
    
    setIsSendingNotification(true);
    try {
      const firstName = getFirstName(leader.name);
      const changesText = detectedChanges.map(c => `• ${c}`).join('\n');
      
      const { data, error } = await supabase.functions.invoke('push-send', {
        body: {
          title: `Hei ${firstName}! Du har fått oppdateringer`,
          message: changesText,
          single_leader_id: leader.id,
          sender_leader_id: currentLeader.id,
          url: '/profile'
        }
      });
      
      if (error) throw error;
      
      if (data?.sent > 0) {
        showSuccess('Varsling sendt!');
      } else {
        showInfo(`${firstName} har ikke aktivert push-varslinger`);
      }
    } catch (error) {
      console.error('Error sending change notification:', error);
      showError('Kunne ikke sende varsling');
    } finally {
      setIsSendingNotification(false);
      setShowNotifyDialog(false);
      onOpenChange(false);
    }
  };

  const handleSkipNotification = () => {
    setShowNotifyDialog(false);
    onOpenChange(false);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !leader) return;

    setIsUploading(true);
    try {
      const compressedFile = await compressImage(file);
      const fileName = `leader-${leader.id}-${Date.now()}.jpg`;

      const { error: uploadError } = await supabase.storage
        .from('participant-images')
        .upload(fileName, compressedFile, { upsert: true, contentType: 'image/jpeg' });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('participant-images')
        .getPublicUrl(fileName);

      setProfileImageUrl(publicUrl);
      
      const { error: updateError } = await supabase
        .from('leaders')
        .update({ profile_image_url: publicUrl })
        .eq('id', leader.id);
      
      if (updateError) throw updateError;
      
      showSuccess('Bilde lagret!');
    } catch (error) {
      console.error('Error uploading image:', error);
      showError('Kunne ikke laste opp bilde');
    } finally {
      setIsUploading(false);
    }
  };

  const getInitials = (nameStr: string) => {
    return nameStr
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  if (!leader) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-[95vw] sm:max-w-2xl max-h-[90vh] p-0 flex flex-col">
          <DialogHeader className="p-4 sm:p-6 pb-0">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-lg sm:text-xl">Rediger leder</DialogTitle>
              {autoSaveStatus === 'saving' && (
                <Badge variant="secondary" className="text-xs gap-1">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Lagrer...
                </Badge>
              )}
              {autoSaveStatus === 'saved' && (
                <Badge variant="secondary" className="text-xs gap-1 text-primary">
                  <Check className="w-3 h-3" />
                  Lagret
                </Badge>
              )}
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-4 sm:px-6 pb-4" style={{ WebkitOverflowScrolling: 'touch' }}>
            <div className="space-y-4 sm:space-y-6">
              {/* Profile Image */}
              <div className="flex flex-col items-center gap-2 sm:gap-3 pt-4">
                <Label htmlFor="profile-image" className="cursor-pointer group relative">
                  <Avatar className="w-16 h-16 sm:w-24 sm:h-24 ring-2 ring-border group-hover:ring-primary transition-all">
                    <AvatarImage src={profileImageUrl} alt={name} />
                    <AvatarFallback className="text-xl">{getInitials(name)}</AvatarFallback>
                  </Avatar>
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                    {isUploading ? (
                      <Loader2 className="w-6 h-6 text-white animate-spin" />
                    ) : (
                      <Camera className="w-6 h-6 text-white" />
                    )}
                  </div>
                </Label>
                <p className="text-xs text-muted-foreground">Klikk for å endre bilde</p>
                <input
                  id="profile-image"
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                  disabled={isUploading}
                />
              </div>

              <Separator />

              {/* Basic Info */}
              <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">Navn</Label>
                  <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Telefon</Label>
                  <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">E-post</Label>
                  <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="age">Alder</Label>
                  <Input id="age" type="number" value={age || ''} onChange={(e) => setAge(e.target.value ? parseInt(e.target.value) : null)} />
                </div>
              </div>

              {/* Team/Cabin Info */}
              <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="team">Team</Label>
                  <Input id="team" value={team} onChange={(e) => setTeam(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cabin">Hytte</Label>
                  <Input id="cabin" value={cabin} onChange={(e) => setCabin(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ministerpost">Ministerpost</Label>
                  <Input id="ministerpost" value={ministerpost} onChange={(e) => setMinisterpost(e.target.value)} />
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
              <div className="space-y-2 sm:space-y-3">
                <Label className="text-sm sm:text-base font-semibold">Sertifiseringer og utstyr</Label>
                <div className="grid gap-2 sm:gap-3 grid-cols-1 sm:grid-cols-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox id="hasCar" checked={hasCar} onCheckedChange={(c) => setHasCar(c === true)} />
                    <Label htmlFor="hasCar" className="cursor-pointer">Har med bil</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox id="hasDriversLicense" checked={hasDriversLicense} onCheckedChange={(c) => setHasDriversLicense(c === true)} />
                    <Label htmlFor="hasDriversLicense" className="cursor-pointer">Bil-lappen</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox id="hasBoatLicense" checked={hasBoatLicense} onCheckedChange={(c) => setHasBoatLicense(c === true)} />
                    <Label htmlFor="hasBoatLicense" className="cursor-pointer">Båt-lappen</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox id="canRappelling" checked={canRappelling} onCheckedChange={(c) => setCanRappelling(c === true)} />
                    <Label htmlFor="canRappelling" className="cursor-pointer">Rappis</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox id="canClimbing" checked={canClimbing} onCheckedChange={(c) => setCanClimbing(c === true)} />
                    <Label htmlFor="canClimbing" className="cursor-pointer">Klatring</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox id="canZipline" checked={canZipline} onCheckedChange={(c) => setCanZipline(c === true)} />
                    <Label htmlFor="canZipline" className="cursor-pointer">Taubane oppe</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox id="canRopeSetup" checked={canRopeSetup} onCheckedChange={(c) => setCanRopeSetup(c === true)} />
                    <Label htmlFor="canRopeSetup" className="cursor-pointer">Taubane oppsett</Label>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom bar - just close button now */}
          <div className="bottom-bar flex justify-end">
            <Button variant="outline" onClick={() => handleClose(false)}>
              Lukk
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Change Notification Dialog */}
      <AlertDialog open={showNotifyDialog} onOpenChange={setShowNotifyDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sende varsling om endringer?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>Vil du varsle {getFirstName(leader.name)} om disse endringene?</p>
                <ul className="text-sm bg-muted p-3 rounded-md space-y-1">
                  {detectedChanges.map((change, i) => (
                    <li key={i} className="text-foreground">{change}</li>
                  ))}
                </ul>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleSkipNotification}>
              Nei, hopp over
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleSendChangeNotification}
              disabled={isSendingNotification}
            >
              {isSendingNotification ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Bell className="w-4 h-4 mr-2" />
              )}
              Ja, send varsling
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
