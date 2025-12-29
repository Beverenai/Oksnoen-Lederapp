import imageCompression from 'browser-image-compression';

/**
 * Compresses an image file for optimal upload and display
 * - Max 100KB file size
 * - Max 800px width/height
 * - Converts to JPEG format
 */
export const compressImage = async (file: File): Promise<File> => {
  const options = {
    maxSizeMB: 0.1,           // Max 100KB
    maxWidthOrHeight: 800,    // Max 800px
    useWebWorker: true,
    fileType: 'image/jpeg' as const,
    initialQuality: 0.8,
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
