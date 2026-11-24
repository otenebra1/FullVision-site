// Service worker do app Full Vision (PWA).
// Estratégia simples e segura: páginas sempre da rede (dados mudam o tempo todo);
// só os arquivos estáticos do Next e os ícones ficam em cache. Sem rede, mostra /offline.html.
const VERSAO = 'fv-v1';
const ESTATICOS = ['/offline.html', '/icons/icon-192.png', '/icons/icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(VERSAO).then((c) => c.addAll(ESTATICOS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((chaves) => Promise.all(chaves.filter((k) => k !== VERSAO).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // Supabase, fontes etc.: direto na rede
  if (url.pathname.startsWith('/api/')) return;

  // Navegação: rede primeiro; sem conexão, página offline
  if (req.mode === 'navigate') {
    event.respondWith(fetch(req).catch(() => caches.match('/offline.html')));
    return;
  }

  // Arquivos do build (nome com hash, nunca mudam) e ícones: cache primeiro
  if (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icons/')) {
    event.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        if (res.ok) { const copia = res.clone(); caches.open(VERSAO).then((c) => c.put(req, copia)); }
        return res;
      })),
    );
  }
});
