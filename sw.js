/* 词忆 PWA Service Worker */
const CACHE_NAME = 'ciyi-vocab-v1';
const APP_SHELL = ['/', '/index.html', '/manifest.json', '/icon-192.png', '/icon-512.png'];

// 安装：缓存应用外壳
self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(APP_SHELL).catch(function () {
        // 部分文件可能不存在，忽略错误
        return cache.add('/index.html');
      });
    }).then(function () {
      return self.skipWaiting();
    })
  );
});

// 激活：清理旧缓存
self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.filter(function (key) { return key !== CACHE_NAME; })
          .map(function (key) { return caches.delete(key); })
      );
    }).then(function () {
      return self.clients.claim();
    })
  );
});

// 拦截请求
self.addEventListener('fetch', function (event) {
  const url = new URL(event.request.url);

  // 不缓存 Supabase API 请求和外部 CDN
  if (url.hostname.indexOf('supabase.co') >= 0 ||
      url.hostname.indexOf('jsdelivr.net') >= 0 ||
      url.protocol === 'chrome-extension:') {
    return; // 不拦截，走网络
  }

  // 导航请求（页面加载）：网络优先，失败回退缓存
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).then(function (response) {
        // 网络成功，更新缓存
        const clone = response.clone();
        caches.open(CACHE_NAME).then(function (cache) {
          cache.put('/index.html', clone);
        });
        return response;
      }).catch(function () {
        // 网络失败，返回缓存
        return caches.match('/index.html').then(function (cached) {
          return cached || caches.match('/');
        });
      })
    );
    return;
  }

  // 其他请求（图标、manifest 等）：缓存优先，失败回退网络
  event.respondWith(
    caches.match(event.request).then(function (cached) {
      if (cached) return cached;
      return fetch(event.request).then(function (response) {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(function (cache) {
            cache.put(event.request, clone);
          });
        }
        return response;
      }).catch(function () {
        return cached;
      });
    })
  );
});
