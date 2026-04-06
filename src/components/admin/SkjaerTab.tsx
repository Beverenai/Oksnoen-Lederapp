import { useStatusPopup } from '@/hooks/useStatusPopup';
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Map, Upload, Trash2, Loader2, Image, Link as LinkIcon } from 'lucide-react';
import { hapticSuccess, hapticError } from '@/lib/capacitorHaptics';

export function SkjaerTab() {
  const { showSuccess, showError, showInfo } = useStatusPopup();
  const [imageUrl, setImageUrl] = useState('');
  const [storedImageUrl, setStoredImageUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadSkjaerImage();
  }, []);

  const loadSkjaerImage = async () => {
    setIsLoading(true);
    try {
      const { data } = await supabase
        .from('app_config')
        .select('value')
        .eq('key', 'skjaer_image_url')
        .maybeSingle();
      
      if (data?.value) {
        setStoredImageUrl(data.value);
        setImageUrl(data.value);
      }
    } catch (error) {
      console.error('Error loading skjaer image:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      showError('Kun bilder er tillatt');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      showError('Bildet kan ikke være større enn 5MB');
      return;
    }

    setIsUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `skjaer-${Date.now()}.${fileExt}`;
      const filePath = `skjaer/${fileName}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('participant-images')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('participant-images')
        .getPublicUrl(filePath);

      // Save to app_config
      const { error: saveError } = await supabase
        .from('app_config')
        .upsert({
          key: 'skjaer_image_url',
          value: publicUrl,
          updated_at: new Date().toISOString()
        }, { onConflict: 'key' });

      if (saveError) throw saveError;

      setStoredImageUrl(publicUrl);
      setImageUrl(publicUrl);
      showSuccess('Skjærkart lastet opp!');
    } catch (error) {
      console.error('Error uploading skjaer map:', error);
      showError('Kunne ikke laste opp skjærkart');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const saveImageUrl = async () => {
    if (!imageUrl) {
      showError('Legg inn en URL');
      return;
    }

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('app_config')
        .upsert({
          key: 'skjaer_image_url',
          value: imageUrl,
          updated_at: new Date().toISOString()
        }, { onConflict: 'key' });

      if (error) throw error;

      setStoredImageUrl(imageUrl);
      showSuccess('Skjærkart-URL lagret!');
    } catch (error) {
      console.error('Error saving skjaer URL:', error);
      showError('Kunne ikke lagre URL');
    } finally {
      setIsSaving(false);
    }
  };

  const removeSkjaer = async () => {
    if (!confirm('Er du sikker på at du vil fjerne skjærkartet?')) return;

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('app_config')
        .delete()
        .eq('key', 'skjaer_image_url');

      if (error) throw error;

      setStoredImageUrl(null);
      setImageUrl('');
      showSuccess('Skjærkart fjernet!');
    } catch (error) {
      console.error('Error removing skjaer:', error);
      showError('Kunne ikke fjerne skjærkart');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Map className="w-5 h-5" />
            Skjærkart
          </CardTitle>
          <CardDescription>
            Last opp et kart over skjærene som ledere kan se.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Upload section */}
          <div className="space-y-4">
            <div>
              <Label className="text-sm font-medium">Last opp bilde</Label>
              <div className="mt-2 flex gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <Button
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="gap-2"
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Laster opp...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4" />
                      Velg bilde
                    </>
                  )}
                </Button>
              </div>
            </div>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">eller</span>
              </div>
            </div>

            {/* URL input */}
            <div className="space-y-2">
              <Label className="text-sm font-medium flex items-center gap-2">
                <LinkIcon className="w-4 h-4" />
                Bilde-URL
              </Label>
              <div className="flex gap-2">
                <Input
                  placeholder="https://example.com/skjaerkart.jpg"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                />
                <Button
                  onClick={saveImageUrl}
                  disabled={isSaving || !imageUrl || imageUrl === storedImageUrl}
                >
                  {isSaving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    'Lagre'
                  )}
                </Button>
              </div>
            </div>
          </div>

          {/* Preview */}
          {storedImageUrl && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium flex items-center gap-2">
                  <Image className="w-4 h-4" />
                  Forhåndsvisning
                </Label>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={removeSkjaer}
                  disabled={isSaving}
                  className="gap-1.5"
                >
                  <Trash2 className="w-4 h-4" />
                  Fjern
                </Button>
              </div>
              <div className="border rounded-lg overflow-hidden bg-muted/30">
                <img
                  src={storedImageUrl}
                  alt="Skjærkart forhåndsvisning"
                  className="w-full h-auto max-h-[400px] object-contain"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              </div>
            </div>
          )}

          {!storedImageUrl && (
            <div className="text-center py-8 border-2 border-dashed rounded-lg">
              <Map className="w-10 h-10 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">
                Ingen skjærkart lastet opp ennå
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}