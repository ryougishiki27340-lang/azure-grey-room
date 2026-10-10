/* ==========================================================================
   Service Worker：缓存音频与画廊缩略图，加速二次访问
   --------------------------------------------------------------------------
   策略：
   - /audio/ 与 /gallery/thumbs/ 使用 stale-while-revalidate：
     命中缓存立即返回，同时后台更新，BGM 与画廊几乎秒开；
   - 其余同源资源（HTML/CSS/JS/大图）用 network-first，断网时回退缓存；
   - 更新站点后修改下方 VERSION 即可让旧缓存自动失效。
   ========================================================================== */
var VERSION = 'azg-cache-v1';

var CORE = [
  './',
  './index.html',
  './gallery.html',
  './music.html',
  './favicon.svg',
  './assets/css/style.css',
  './assets/js/main.js',
  './assets/js/player.js',
  './assets/js/bgm-data.js',
  './assets/js/bgm-panel.js',
  './assets/js/gallery-data.js'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(VERSION).then(function (cache) {
      return cache.addAll(CORE).catch(function () {
        // 个别资源缺失不阻塞安装
      });
    }).then(function () {
      return self.skipWaiting();
    })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.filter(function (key) {
          return key !== VERSION;
        }).map(function (key) {
          return caches.delete(key);
        })
      );
    }).then(function () {
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', function (event) {
  var req = event.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  var isMedia = /\/audio\//.test(url.pathname) || /\/gallery\/thumbs\//.test(url.pathname);

  if (isMedia) {
    // 音频与缩略图：缓存优先 + 后台更新
    event.respondWith(
      caches.open(VERSION).then(function (cache) {
        return cache.match(req).then(function (cached) {
          var network = fetch(req).then(function (res) {
            if (res && res.ok) cache.put(req, res.clone());
            return res;
          });
          return cached || network;
        });
      })
    );
    return;
  }

  // 其他资源：网络优先，失败回退缓存
  event.respondWith(
    fetch(req).then(function (res) {
      var copy = res.clone();
      caches.open(VERSION).then(function (cache) {
        if (res.ok) cache.put(req, copy);
      });
      return res;
    }).catch(function () {
      return caches.match(req);
    })
  );
});
