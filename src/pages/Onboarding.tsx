import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Camera, User, Car, Check, Upload, Bell } from 'lucide-react';
import { toast } from 'sonner';
import { PushNotificationStatus } from '@/components/PushNotificationStatus';

export default function Onboarding() {
  const navigate = useNavigate();
  const { leader, refreshLeader } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [step, setStep] = useState<'profile' | 'notifications'>('profile');
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [imageUrl, setImageUrl] = useState(leader?.profile_image_url || '');
  const [age, setAge] = useState(leader?.age?.toString() || '');
  const [hasCar, setHasCar] = useState(leader?.has_car || false);
  const [hasDriversLicense, setHasDriversLicense] = useState(leader?.has_drivers_license || false);

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !leader) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Vennligst velg en bildefil');
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
      const fileName = `${leader.id}-${Date.now()}.${fileExt}`;
      const filePath = `profile-images/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('leaders')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('leaders')
        .getPublicUrl(filePath);

      setImageUrl(publicUrl);
      toast.success('Bilde lastet opp!');
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Kunne ikke laste opp bilde');
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmit = async () => {
    if (!leader) return;

    if (!imageUrl) {
      toast.error('Vennligst last opp et profilbilde');
      return;
    }

    if (!age || parseInt(age) < 15 || parseInt(age) > 100) {
      toast.error('Vennligst oppgi gyldig alder');
      return;
    }

    setIsSaving(true);

    try {
      const { error } = await supabase
        .from('leaders')
        .update({
          profile_image_url: imageUrl,
          age: parseInt(age),
          has_car: hasCar,
          has_drivers_license: hasDriversLicense,
        })
        .eq('id', leader.id);

      if (error) throw error;

      await refreshLeader();
      toast.success('Profil fullført!');
      setStep('notifications');
    } catch (error) {
      console.error('Save error:', error);
      toast.error('Kunne ikke lagre profil');
    } finally {
      setIsSaving(false);
    }
  };

  const isFormValid = imageUrl && age && parseInt(age) >= 15;

  const handleFinish = () => {
    navigate('/');
  };

  if (step === 'notifications') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-green-50 to-white">
        <div className="min-h-screen flex flex-col items-center justify-center p-4 pt-safe">
        <div className="w-full max-w-md space-y-6">
          <Card>
            <CardContent className="pt-8 pb-6 space-y-6 text-center">
              <div className="mx-auto w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center">
                <Bell className="w-10 h-10 text-primary" />
              </div>
              <div className="space-y-2">
                <CardTitle className="text-xl">Slå på varsler</CardTitle>
                <CardDescription className="text-base">
                  Få varslinger om ny økt plan - endringer og viktig info
                </CardDescription>
              </div>
              <div className="space-y-3 pt-2">
                <PushNotificationStatus 
                  variant="button" 
                  onSuccess={handleFinish}
                />
                <Button variant="ghost" onClick={handleFinish} className="w-full text-muted-foreground">
                  Hopp over
                </Button>
              </div>
            </CardContent>
          </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-white">
      <div className="min-h-screen flex flex-col items-center justify-center p-4 pt-safe">
      <div className="w-full max-w-md space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold text-foreground">Velkommen, {leader?.name?.split(' ')[0]}!</h1>
          <p className="text-muted-foreground">Fullfør profilen din for å komme i gang</p>
        </div>

        {/* Profile Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Din profil</CardTitle>
            <CardDescription>Denne informasjonen brukes av andre ledere</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Profile Image */}
            <div className="flex flex-col items-center space-y-4">
              <div className="relative">
                <Avatar className="w-28 h-28 border-4 border-primary/20">
                  <AvatarImage src={imageUrl} alt="Profilbilde" />
                  <AvatarFallback className="bg-muted">
                    <User className="w-12 h-12 text-muted-foreground" />
                  </AvatarFallback>
                </Avatar>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="absolute bottom-0 right-0 p-2 bg-primary text-primary-foreground rounded-full shadow-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  {isUploading ? (
                    <Upload className="w-4 h-4 animate-pulse" />
                  ) : (
                    <Camera className="w-4 h-4" />
                  )}
                </button>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />
              <p className="text-sm text-muted-foreground">
                {imageUrl ? 'Trykk for å endre bilde' : 'Last opp et profilbilde *'}
              </p>
            </div>

            {/* Age */}
            <div className="space-y-2">
              <Label htmlFor="age">Alder *</Label>
              <Input
                id="age"
                type="number"
                min="15"
                max="100"
                value={age}
                onChange={(e) => setAge(e.target.value)}
                placeholder="Din alder"
              />
            </div>

            {/* Checkboxes */}
            <div className="space-y-4">
              <div className="flex items-center space-x-3">
                <Checkbox
                  id="driversLicense"
                  checked={hasDriversLicense}
                  onCheckedChange={(checked) => setHasDriversLicense(checked as boolean)}
                />
                <Label htmlFor="driversLicense" className="flex items-center gap-2 cursor-pointer">
                  <Car className="w-4 h-4 text-muted-foreground" />
                  Jeg har førerkort
                </Label>
              </div>

              <div className="flex items-center space-x-3">
                <Checkbox
                  id="hasCar"
                  checked={hasCar}
                  onCheckedChange={(checked) => setHasCar(checked as boolean)}
                />
                <Label htmlFor="hasCar" className="flex items-center gap-2 cursor-pointer">
                  <Car className="w-4 h-4 text-muted-foreground" />
                  Jeg har med bil på leiren
                </Label>
              </div>
            </div>

            {/* Submit Button */}
            <Button
              onClick={handleSubmit}
              disabled={!isFormValid || isSaving}
              className="w-full gap-2"
              size="lg"
            >
              {isSaving ? (
                'Lagrer...'
              ) : (
                <>
                  <Check className="w-5 h-5" />
                  Fullfør profil
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          * Obligatoriske felt
        </p>
        </div>
      </div>
    </div>
  );
}
