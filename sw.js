/* Service worker del Directorio IA.
   Estrategia:
   - El "cascarón" (HTML, CSS, JS, iconos) se sirve desde caché y se refresca en segundo plano.
   - data/tools.json va primero a la red, para que una actualización del catálogo se vea al momento,
     con la copia en caché como respaldo si no hay conexión.
   Sube VERSION cuando cambies archivos del cascarón. */

const VERSION = 'dir-ia-v1';
const CASCARON = [
  './',
  'index.html',
  'assets/styles.css',
  'assets/app.js',
  'assets/icono.svg',
  'assets/icono-maskable.svg',
  'manifest.webmanifest',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(VERSION)
      .then((c) => c.addAll(CASCARON))
      .then(() => self.skipWaiting())
      .catch(() => { /* si algo falla, seguimos sin precache */ }),
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  // Catálogo: red primero.
  if (url.pathname.endsWith('/data/tools.json')) {
    e.respondWith(
      fetch(req)
        .then((res) => {
          caches.open(VERSION).then((c) => c.put(req, res.clone()));
          return res;
        })
        .catch(() => caches.match(req)),
    );
    return;
  }

  // Resto: caché primero, revalidando por detrás.
  e.respondWith(
    caches.match(req).then((cacheada) => {
      const red = fetch(req)
        .then((res) => {
          if (res && res.ok) caches.open(VERSION).then((c) => c.put(req, res.clone()));
          return res;
        })
        .catch(() => cacheada);
      return cacheada || red;
    }),
  );
});
