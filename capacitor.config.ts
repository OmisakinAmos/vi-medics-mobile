import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.vimedics.app',
  appName: 'Vi-Medics',
  webDir: 'dist',
  backgroundColor: '#f8fbfc',
  android: { allowMixedContent: false },
  plugins: {
    SplashScreen: { launchShowDuration: 1200, launchAutoHide: true, backgroundColor: '#0f4c5c', showSpinner: false },
    StatusBar: { style: 'DARK', backgroundColor: '#0f4c5c', overlaysWebView: false },
  },
};

export default config;
