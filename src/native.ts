import { App as CapApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar, Style } from '@capacitor/status-bar';

export const isNative = Capacitor.isNativePlatform();

/** Wires up native behaviour. Does nothing in a normal browser. */
export function initNative(): void {
  if (!isNative) return;

  document.documentElement.classList.add('is-native');

  // Brand-coloured status bar with light icons
  StatusBar.setOverlaysWebView({ overlay: false }).catch(() => {});
  StatusBar.setBackgroundColor({ color: '#0f4c5c' }).catch(() => {});
  StatusBar.setStyle({ style: Style.Dark }).catch(() => {});

  // Android back button: go back through the app's pages, exit only from Home
  CapApp.addListener('backButton', () => {
    const route = window.location.pathname.replace(/\/+$/, '') || '/';
    if (route === '/') {
      void CapApp.exitApp();
    } else if (window.history.length > 1) {
      window.history.back();
    } else {
      window.history.pushState({}, '', '/');
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
  });

  SplashScreen.hide().catch(() => {});
}
