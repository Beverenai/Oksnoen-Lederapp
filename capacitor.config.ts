import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.oksnoen.ledere',
  appName: 'Oksnøen LederApp',
  webDir: 'dist',
  bundledWebRuntime: false,
  ios: {
    contentInset: 'never',
    scrollEnabled: true,
    backgroundColor: '#0a0f1c',
  },
  plugins: {
    // Vis varsler også når appen er åpen.
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
};

export default config;
