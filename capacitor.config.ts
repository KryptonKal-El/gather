import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.gather.app',
  appName: 'Gather',
  webDir: 'dist',
  plugins: {
    SplashScreen: {
      launchAutoHide: false,
      backgroundColor: '#4caf50',
    },
    StatusBar: {
      overlaysWebView: true,
      style: 'DEFAULT',
    },
  },
};

export default config;
