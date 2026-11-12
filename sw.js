/* 我的装备 · sw.js
 * 让页面离线也能打开。策略是「网络优先」：有网就拿最新的文件并顺手存一份，
 * 断网或 3.5 秒内没回应就用上次存的。所以更新代码后不用改这里的版本号。
 * 同一个 GitHub Pages 域名下可能还有别的网页应用，这里只动名字以 mygear- 开头的缓存。 */
'use strict';
const CACHE = 'mygear-v1';
const SCOPE = new URL('./', self.location.href).pathname;
const FILES = ['./', 'index.html', 'styles.css', 'core.js', 'charts.js', 'app.js', 'manifest.webmanifest',
  'num-500.woff2', 'num-600.woff2', 'icon-32.png', 'icon-180.png', 'icon-192.png', 'icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) =>
    Promise.all(FILES.map((f) => fetch(f, { cache: 'no-cache' }).then((res) => { if (res.ok) return cache.put(f, res); }).catch(() => {})))
  ).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) =>
    Promise.all(keys.filter((k) => k.indexOf('mygear-') === 0 && k !== CACHE).map((k) => caches.delete(k)))
  ).then(() => self.clients.claim()));
});

function timeout(ms) { return new Promise((resolve, reject) => setTimeout(() => reject(new Error('timeout')), ms)); }

async function cached(cache, req) {
  const hit = await cache.match(req, { ignoreSearch: true });
  if (hit) return hit;
  if (req.mode === 'navigate') return (await cache.match('index.html')) || (await cache.match('./'));
  return undefined;
}

async function networkFirst(req) {
  const cache = await caches.open(CACHE);
  const net = fetch(req.url, { cache: 'no-cache', credentials: 'same-origin' }).then((res) => {
    if (res && res.ok && res.type === 'basic') cache.put(req.url, res.clone()).catch(() => {});
    return res;
  });
  try {
    return await Promise.race([net, timeout(3500)]);
  } catch (err) {
    const hit = await cached(cache, req);
    if (hit) { net.catch(() => {}); return hit; }
    return net;
  }
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || url.pathname.indexOf(SCOPE) !== 0) return;
  event.respondWith(networkFirst(req));
});
