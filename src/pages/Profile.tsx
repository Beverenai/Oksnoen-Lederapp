import { useStatusPopup } from '@/hooks/useStatusPopup';
import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  User, 
  Save, 
  Loader2, 
  Camera,
  Car,
  Anchor,
  Mountain,
  ArrowUpDown,
  Cable,
  Wrench,
  Bell,
  Palette,
  RefreshCw,
  Circle
} from 'lucide-react';
import { ThemeSwitcher } from '@/components/ThemeSwitcher';
import { PushNotificationStatus } from '@/components/PushNotificationStatus';
import { SnusCan3D } from '@/components/snus/SnusCan3D';
import { SnusPicker } from '@/components/snus/SnusPicker';
import { getSnusProduct, customSnusProduct, snusLabel } from '@/lib/snusCatalog';
import { Switch } from '@/components/ui/switch';
import type { Tables } from '@/integrations/supabase/types';
import { compressImage } from '@/lib/imageUtils';
import { hapticSuccess, hapticError } from '@/lib/capacitorHaptics';

type Leader = Tables<'leaders'>;

export default function Profile() {
  const { showSuccess, showError, showInfo } = useStatusPopup();
  const { leader: authLeader, viewAsLeader, effectiveLeader } = useAuth();
  const isViewingAs = !!viewAsLeader;
  const [leader, setLeader] = useState<Leader | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form fields
  const [age, setAge] = useState<number | ''>('');
  const [hasCar, setHasCar] = useState(false);
  const [hasDriversLicense, setHasDriversLicense] = useState(false);
  const [hasBoatLicense, setHasBoatLicense] = useState(false);
  const [canRappelling, setCanRappelling] = useState(false);
  const [canClimbing, setCanClimbing] = useState(false);
  const [canZipline, setCanZipline] = useState(false);
  const [canRopeSetup, setCanRopeSetup] = useState(false);
  const [snusUser, setSnusUser] = useState(false);
  const [snusProductId, setSnusProductId] = useState<string | null>(null);
  const [snusProductIds, setSnusProductIds] = useState<string[]>([]);
  const [snusCustomLabel, setSnusCustomLabel] = useState<string | null>(null);
  const [isSnusPickerOpen, setIsSnusPickerOpen] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();

  // Åpne snusvelgeren direkte via ?snus=1 (brukes av push-varsler)
  useEffect(() => {
    if (searchParams.get('snus')) {
      setIsSnusPickerOpen(true);
      const next = new URLSearchParams(searchParams);
      next.delete('snus');
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const snusCans = snusProductsFrom(
    snusProductIds.length ? snusProductIds : [snusProductId],
    snusCustomLabel
  );
  const snusCan = snusCans[0] ?? null;

  const saveSnus = async (patch: {
    snus_user?: boolean;
    snus_product_id?: string | null;
    snus_product_ids?: string[];
    snus_custom_label?: string | null;
  }) => {
    if (!authLeader?.id) return;
    const { error } = await supabase.from('leaders').update(patch as never).eq('id', authLeader.id);
    if (error) {
      console.error('Error saving snus:', error);
      showError('Kunne ikke lagre snus-valg');
    }
  };

  useEffect(() => {
    if (!effectiveLeader?.id) return;
    const timeout = setTimeout(() => {
      setIsLoading(prev => {
        if (prev) setLoadFailed(true);
        return false;
      });
    }, 8000);
    loadProfile();
    return () => clearTimeout(timeout);
  }, [effectiveLeader?.id]);

  const loadProfile = async () => {
    if (!effectiveLeader?.id) return;
    
    setIsLoading(true);
    setLoadFailed(false);
    try {
      const { data, error } = await supabase
        .from('leaders')
        .select('*')
        .eq('id', effectiveLeader.id)
        .single();

      if (error) throw error;

      setLeader(data);
      setAge(data.age || '');
      setHasCar(data.has_car || false);
      setHasDriversLicense(data.has_drivers_license || false);
      setHasBoatLicense(data.has_boat_license || false);
      setCanRappelling(data.can_rappelling || false);
      setCanClimbing(data.can_climbing || false);
      setCanZipline(data.can_zipline || false);
      setCanRopeSetup(data.can_rope_setup || false);
      setSnusUser(data.snus_user || false);
      setSnusProductId(data.snus_product_id || null);
      setSnusProductIds(((data as any).snus_product_ids as string[] | null) || []);
      setSnusCustomLabel(data.snus_custom_label || null);
    } catch (error) {
      console.error('Error loading profile:', error);
      setLoadFailed(true);
    } finally {
      setIsLoading(false);
    }
  };

  const saveProfile = async () => {
    if (!authLeader?.id) return;

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('leaders')
        .update({
          age: age === '' ? null : age,
          has_car: hasCar,
          has_drivers_license: hasDriversLicense,
          has_boat_license: hasBoatLicense,
          can_rappelling: canRappelling,
          can_climbing: canClimbing,
          can_zipline: canZipline,
          can_rope_setup: canRopeSetup,
          snus_user: snusUser,
          snus_product_id: snusUser ? snusProductId : null,
          snus_product_ids: snusUser ? snusProductIds : [],
          snus_custom_label: snusUser ? snusCustomLabel : null,
        } as never)
        .eq('id', authLeader.id);

      if (error) throw error;
      showSuccess('Profil lagret!');
    } catch (error) {
      console.error('Error saving profile:', error);
      showError('Kunne ikke lagre profil');
    } finally {
      setIsSaving(false);
    }
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !authLeader?.id) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      showError('Vennligst velg et bilde');
      return;
    }

    // Validate file size (max 10MB before compression)
    if (file.size > 10 * 1024 * 1024) {
      showError('Bildet må være mindre enn 10MB');
      return;
    }

    setIsUploading(true);
    try {
      // Compress image before upload
      const compressedFile = await compressImage(file);
      const fileName = `${authLeader.id}-${Date.now()}.jpg`;
      const filePath = `leader-profiles/${fileName}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('participant-images')
        .upload(filePath, compressedFile, { upsert: true, contentType: 'image/jpeg' });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('participant-images')
        .getPublicUrl(filePath);

      // Update leader profile
      const { error: updateError } = await supabase
        .from('leaders')
        .update({ profile_image_url: publicUrl })
        .eq('id', authLeader.id);

      if (updateError) throw updateError;

      // Update local state
      setLeader(prev => prev ? { ...prev, profile_image_url: publicUrl } : null);
      showSuccess('Profilbilde oppdatert!');
    } catch (error) {
      console.error('Error uploading image:', error);
      showError('Kunne ikke laste opp bilde');
    } finally {
      setIsUploading(false);
    }
  };

  if (isLoading && !loadFailed) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (loadFailed || !leader) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <User className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-heading font-semibold">
              {loadFailed ? 'Kunne ikke laste profil' : 'Profil ikke funnet'}
            </h2>
            <p className="text-muted-foreground mt-2">
              {loadFailed ? 'Noe gikk galt. Prøv igjen.' : 'Kunne ikke laste din profil.'}
            </p>
            {loadFailed && (
              <Button onClick={loadProfile} variant="outline" size="sm" className="mt-4">
                <RefreshCw className="w-4 h-4 mr-2" />
                Prøv igjen
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-2xl mx-auto">
      <div>
        <h1 className="text-2xl lg:text-3xl font-heading font-bold text-foreground">
          Min Profil
        </h1>
        <p className="text-muted-foreground mt-1">
          Oppdater din informasjon og sertifiseringer
        </p>
      </div>

      {/* Profile Picture */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Camera className="w-5 h-5" />
            Profilbilde
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center gap-6">
          <Avatar className="w-24 h-24">
            {leader.profile_image_url && (
              <AvatarImage src={leader.profile_image_url} alt={leader.name} />
            )}
            <AvatarFallback className="bg-primary/10 text-primary text-2xl">
              {leader.name.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="font-medium text-lg">{leader.name}</p>
            <p className="text-sm text-muted-foreground">{leader.phone}</p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImageUpload}
            />
            <Button 
              variant="outline" 
              className="mt-3"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
            >
              {isUploading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Camera className="w-4 h-4 mr-2" />
              )}
              {isUploading ? 'Laster opp...' : 'Last opp bilde'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Basic Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="w-5 h-5" />
            Grunnleggende info
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="age">Alder</Label>
              <Input
                id="age"
                type="number"
                placeholder="F.eks. 25"
                value={age}
                onChange={(e) => setAge(e.target.value ? parseInt(e.target.value) : '')}
              />
            </div>
            <div className="flex items-center space-x-2 pt-6">
              <Checkbox
                id="hasCar"
                checked={hasCar}
                onCheckedChange={(checked) => setHasCar(checked === true)}
              />
              <Label htmlFor="hasCar" className="flex items-center gap-2">
                <Car className="w-4 h-4" />
                Har med bil
              </Label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Certifications */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mountain className="w-5 h-5" />
            Sertifiseringer
          </CardTitle>
          <CardDescription>
            Huk av for kompetanse du har
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="driversLicense"
                checked={hasDriversLicense}
                onCheckedChange={(checked) => setHasDriversLicense(checked === true)}
              />
              <Label htmlFor="driversLicense" className="flex items-center gap-2">
                <Car className="w-4 h-4" />
                Bil-lappen
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="boatLicense"
                checked={hasBoatLicense}
                onCheckedChange={(checked) => setHasBoatLicense(checked === true)}
              />
              <Label htmlFor="boatLicense" className="flex items-center gap-2">
                <Anchor className="w-4 h-4" />
                Båt-lappen
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="rappelling"
                checked={canRappelling}
                onCheckedChange={(checked) => setCanRappelling(checked === true)}
              />
              <Label htmlFor="rappelling" className="flex items-center gap-2">
                <ArrowUpDown className="w-4 h-4" />
                Rappellering
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="climbing"
                checked={canClimbing}
                onCheckedChange={(checked) => setCanClimbing(checked === true)}
              />
              <Label htmlFor="climbing" className="flex items-center gap-2">
                <Mountain className="w-4 h-4" />
                Klatring
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="zipline"
                checked={canZipline}
                onCheckedChange={(checked) => setCanZipline(checked === true)}
              />
              <Label htmlFor="zipline" className="flex items-center gap-2">
                <Cable className="w-4 h-4" />
                Taubane
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="ropeSetup"
                checked={canRopeSetup}
                onCheckedChange={(checked) => setCanRopeSetup(checked === true)}
              />
              <Label htmlFor="ropeSetup" className="flex items-center gap-2">
                <Wrench className="w-4 h-4" />
                Taubane-Oppsett
              </Label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Notifications */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Circle className="w-5 h-5" />
            Snus
          </CardTitle>
          <CardDescription>
            Si om du snuser – velg gjerne flere bokser, de roterer i profilen din
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="snusUser" className="text-base">Snuser du?</Label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">{snusUser ? 'Ja' : 'Nei'}</span>
              <Switch
                id="snusUser"
                checked={snusUser}
                onCheckedChange={(checked) => {
                  setSnusUser(checked);
                  if (!checked) {
                    setSnusProductId(null);
                    setSnusProductIds([]);
                    setSnusCustomLabel(null);
                    saveSnus({ snus_user: false, snus_product_id: null, snus_product_ids: [], snus_custom_label: null });
                  } else {
                    saveSnus({ snus_user: true });
                  }
                }}
              />
            </div>
          </div>

          {snusUser && (
            <div className="space-y-3">
              {snusCan ? (
                <>
                  <div className="flex justify-center rounded-2xl bg-muted/40 py-4">
                    {snusCans.length > 1 ? (
                      <SnusCanRotator productIds={snusProductIds} size={220} />
                    ) : (
                      <SnusCan3D product={snusCan} size={220} />
                    )}
                  </div>
                  <p className="text-center text-sm font-semibold">
                    {snusCans.length > 1
                      ? snusCans.map(snusFullName).join(' • ')
                      : snusLabel(snusProductId, snusCustomLabel)}
                  </p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Velg hvilken boks du snuser.
                </p>
              )}
              <Button variant="outline" className="w-full" onClick={() => setIsSnusPickerOpen(true)}>
                {snusCan ? 'Endre snusbokser' : 'Velg snusboks'}
              </Button>
            </div>
          )}

          <SnusPicker
            open={isSnusPickerOpen}
            onOpenChange={setIsSnusPickerOpen}
            multi
            selectedId={snusProductId}
            selectedIds={snusProductIds.length ? snusProductIds : snusProductId ? [snusProductId] : []}
            customLabel={snusCustomLabel}
            onSelectMany={(ids, custom) => {
              setSnusProductIds(ids);
              setSnusProductId(ids[0] ?? null);
              setSnusCustomLabel(custom);
              saveSnus({
                snus_user: true,
                snus_product_id: ids[0] ?? null,
                snus_product_ids: ids,
                snus_custom_label: custom,
              });
            }}
            onSelect={(productId, custom) => {
              setSnusProductId(productId);
              setSnusProductIds(productId ? [productId] : []);
              setSnusCustomLabel(custom);
              saveSnus({
                snus_user: true,
                snus_product_id: productId,
                snus_product_ids: productId ? [productId] : [],
                snus_custom_label: custom,
              });
            }}
          />
        </CardContent>
      </Card>

      {/* Notifications */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="w-5 h-5" />
            Varsler
          </CardTitle>
          <CardDescription>
            Motta push-varsler om viktig informasjon
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PushNotificationStatus />
        </CardContent>
      </Card>

      {/* Appearance */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="w-5 h-5" />
            Utseende
          </CardTitle>
          <CardDescription>
            Tilpass appens utseende
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ThemeSwitcher />
        </CardContent>
      </Card>

      {/* Save Button */}
      <Button 
        onClick={saveProfile} 
        disabled={isSaving} 
        className="w-full sm:w-auto"
        size="lg"
      >
        {isSaving ? (
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
        ) : (
          <Save className="w-4 h-4 mr-2" />
        )}
        {isSaving ? 'Lagrer...' : 'Lagre profil'}
      </Button>

      {/* Version label */}
      <div className="text-center pt-4 pb-8 text-xs text-muted-foreground/60">
        v{import.meta.env.VITE_APP_VERSION || '1.0.0'} • {import.meta.env.MODE}
      </div>
    </div>
  );
}
