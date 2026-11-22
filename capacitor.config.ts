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
};

export default config;
