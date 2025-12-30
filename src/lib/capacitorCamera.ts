/**
 * Capacitor Camera wrapper
 * Falls back to standard file input if not in native context
 */

import { isCapacitor } from './capacitor';

// Dynamic import to avoid errors when plugin is not installed
let Camera: any = null;
let CameraResultType: any = null;
let CameraSource: any = null;

export const initCapacitorCamera = async (): Promise<boolean> => {
  if (!isCapacitor()) return false;
  
  try {
    const module = await import('@capacitor/camera');
    Camera = module.Camera;
    CameraResultType = module.CameraResultType;
    CameraSource = module.CameraSource;
    console.log('[CapacitorCamera] Plugin initialized');
    return true;
  } catch (e) {
    console.log('[CapacitorCamera] Plugin not available:', e);
    return false;
  }
};

export const isNativeCameraAvailable = (): boolean => {
  return !!Camera;
};

export const takePhoto = async (): Promise<File | null> => {
  if (!Camera) {
    console.log('[CapacitorCamera] Camera not available, use standard file input');
    return null;
  }
  
  try {
    const photo = await Camera.getPhoto({
      quality: 80,
      allowEditing: false,
      resultType: CameraResultType.DataUrl,
      source: CameraSource.Prompt, // Let user choose camera or gallery
      width: 1200,
      height: 1200,
      correctOrientation: true,
    });
    
    if (!photo.dataUrl) {
      console.error('[CapacitorCamera] No dataUrl returned');
      return null;
    }
    
    // Convert DataUrl to File
    const response = await fetch(photo.dataUrl);
    const blob = await response.blob();
    const fileName = `photo-${Date.now()}.${photo.format || 'jpg'}`;
    
    console.log('[CapacitorCamera] Photo captured:', fileName);
    return new File([blob], fileName, { type: `image/${photo.format || 'jpeg'}` });
  } catch (e: any) {
    // User cancelled - not an error
    if (e?.message?.includes('cancelled') || e?.message?.includes('canceled')) {
      console.log('[CapacitorCamera] User cancelled photo capture');
      return null;
    }
    console.error('[CapacitorCamera] Error taking photo:', e);
    return null;
  }
};

export const pickFromGallery = async (): Promise<File | null> => {
  if (!Camera) {
    console.log('[CapacitorCamera] Camera not available, use standard file input');
    return null;
  }
  
  try {
    const photo = await Camera.getPhoto({
      quality: 80,
      allowEditing: false,
      resultType: CameraResultType.DataUrl,
      source: CameraSource.Photos,
      width: 1200,
      height: 1200,
      correctOrientation: true,
    });
    
    if (!photo.dataUrl) return null;
    
    const response = await fetch(photo.dataUrl);
    const blob = await response.blob();
    const fileName = `photo-${Date.now()}.${photo.format || 'jpg'}`;
    
    return new File([blob], fileName, { type: `image/${photo.format || 'jpeg'}` });
  } catch (e: any) {
    if (e?.message?.includes('cancelled') || e?.message?.includes('canceled')) {
      return null;
    }
    console.error('[CapacitorCamera] Error picking from gallery:', e);
    return null;
  }
};
