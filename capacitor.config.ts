import type { CapacitorConfig } from '@capacitor/cli';
import { KeyboardResize } from '@capacitor/keyboard';

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
    // Appen krymper når tastaturet kommer opp, så skrivefeltet i chatten blir
    // liggende rett over tastaturet uten at siden hopper.
    Keyboard: {
      resize: KeyboardResize.Native,
      resizeOnFullScreen: true,
    },
  },
};

export default config;
