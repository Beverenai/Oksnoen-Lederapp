import imageCompression from 'browser-image-compression';

interface CompressImageOptions {
  maxSizeMB?: number;
  maxWidthOrHeight?: number;
  initialQuality?: number;
}

/**
 * Compresses an image file for optimal upload and display
 * - Converts to JPEG format
 */
export const compressImage = async (file: File, overrides: CompressImageOptions = {}): Promise<File> => {
  const options = {
    maxSizeMB: overrides.maxSizeMB ?? 0.1,
    maxWidthOrHeight: overrides.maxWidthOrHeight ?? 800,
    useWebWorker: true,
    fileType: 'image/jpeg' as const,
    initialQuality: overrides.initialQuality ?? 0.8,
  };
  
  try {
    const compressedFile = await imageCompression(file, options);
    console.log(`Image compressed: ${(file.size / 1024).toFixed(1)}KB → ${(compressedFile.size / 1024).toFixed(1)}KB`);
    return compressedFile;
  } catch (error) {
    console.error('Image compression failed, using original:', error);
    return file;
  }
};
