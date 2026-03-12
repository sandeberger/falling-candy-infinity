interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;
let installCallback: (() => void) | null = null;

export function setupInstallPrompt(onAvailable: () => void): void {
  installCallback = onAvailable;

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
    installCallback?.();
  });
}

export function canInstall(): boolean {
  return deferredPrompt !== null;
}

export function triggerInstall(): void {
  deferredPrompt?.prompt();
  deferredPrompt = null;
}

export function registerSW(): void {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // SW registration failed — offline won't work but game still plays
    });
  }
}
