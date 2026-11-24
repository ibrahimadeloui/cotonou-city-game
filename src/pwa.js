import { registerSW } from 'virtual:pwa-register';

export function setupPwa(toast) {
  const hint = document.getElementById('install-hint');
  const label = document.getElementById('install-text');
  const go = document.getElementById('install-go');
  const ios = /iPhone|iPad|iPod/i.test(navigator.userAgent || '');
  if (hint && label && !localStorage.getItem('cotonou-install-hint')) {
    label.textContent = ios
      ? 'iPhone : Partager, puis « Ajouter à l\'écran d\'accueil ».'
      : 'Android : menu du navigateur, puis Installer.';
    hint.classList.remove('hidden');
    window.setTimeout(() => {
      hint.classList.add('hidden');
      localStorage.setItem('cotonou-install-hint', '1');
    }, 6000);
  }
  document.getElementById('install-dismiss')?.addEventListener('click', () => {
    hint?.classList.add('hidden');
    localStorage.setItem('cotonou-install-hint', '1');
  });

  let deferred = null;
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferred = event;
    if (go) go.hidden = false;
  });
  go?.addEventListener('click', async () => {
    if (!deferred) return;
    deferred.prompt();
    try { await deferred.userChoice; } catch { /* l'utilisateur a fermé */ }
    deferred = null;
    go.hidden = true;
  });

  window.addEventListener('offline', () => toast('Tu es hors ligne. La ville reste jouable.'));
  window.addEventListener('online', () => toast('Réseau retrouvé.'));

  const banner = document.getElementById('update-banner');
  const reload = document.getElementById('update-reload');
  let reloading = false;
  navigator.serviceWorker?.addEventListener('controllerchange', () => {
    if (reloading) return;
    reloading = true;
    window.location.reload();
  });
  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      updateSW(true);
      banner?.classList.remove('hidden');
    },
    onOfflineReady() {
      toast('Cotonou est prêt hors ligne.');
    },
  });
  reload?.addEventListener('click', () => {
    updateSW(true);
  });
}
