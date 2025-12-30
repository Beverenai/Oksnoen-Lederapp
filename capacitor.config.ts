import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.5fbb2f6d0f084e4b8db1cf4c3cbc1881',
  appName: 'camp-hub-buddy',
  webDir: 'dist',
  server: {
    url: 'https://5fbb2f6d-0f08-4e4b-8db1-cf4c3cbc1881.lovableproject.com?forceHideBadge=true',
    cleartext: true
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert']
    },
    Camera: {
      permissionType: 'prompt'
    },
    SplashScreen: {
      launchShowDuration: 1500,
      launchAutoHide: false,
      backgroundColor: '#16a34a',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true
    }
  },
  ios: {
    contentInset: 'automatic',
    preferredContentMode: 'mobile'
  },
  android: {
    allowMixedContent: true
  }
};

export default config;
