import { useState, useEffect, useRef } from 'react';
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
  ArrowUpDown
} from 'lucide-react';
import { toast } from 'sonner';
import type { Tables } from '@/integrations/supabase/types';

type Leader = Tables<'leaders'>;

export default function Profile() {
  const { leader: authLeader } = useAuth();
  const [leader, setLeader] = useState<Leader | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
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

  useEffect(() => {
    if (authLeader?.id) {
      loadProfile();
    }
  }, [authLeader?.id]);

  const loadProfile = async () => {
    if (!authLeader?.id) return;
    
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('leaders')
        .select('*')
        .eq('id', authLeader.id)
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
    } catch (error) {
      console.error('Error loading profile:', error);
      toast.error('Kunne ikke laste profil');
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
        })
        .eq('id', authLeader.id);

      if (error) throw error;
      toast.success('Profil lagret!');
    } catch (error) {
      console.error('Error saving profile:', error);
      toast.error('Kunne ikke lagre profil');
    } finally {
      setIsSaving(false);
    }
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !authLeader?.id) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Vennligst velg et bilde');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Bildet må være mindre enn 5MB');
      return;
    }

    setIsUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${authLeader.id}-${Date.now()}.${fileExt}`;
      const filePath = `leader-profiles/${fileName}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('participant-images')
        .upload(filePath, file, { upsert: true });

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
      toast.success('Profilbilde oppdatert!');
    } catch (error) {
      console.error('Error uploading image:', error);
      toast.error('Kunne ikke laste opp bilde');
    } finally {
      setIsUploading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!leader) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <User className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-heading font-semibold">Profil ikke funnet</h2>
            <p className="text-muted-foreground mt-2">
              Kunne ikke laste din profil.
            </p>
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
                <Mountain className="w-4 h-4" />
                Taubane (oppe)
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="ropeSetup"
                checked={canRopeSetup}
                onCheckedChange={(checked) => setCanRopeSetup(checked === true)}
              />
              <Label htmlFor="ropeSetup" className="flex items-center gap-2">
                <Mountain className="w-4 h-4" />
                Taubane (oppsett)
              </Label>
            </div>
          </div>
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
    </div>
  );
}
