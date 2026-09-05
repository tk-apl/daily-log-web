/*
 * オフラインで開けるようにするためのもの。
 *
 * 中身のファイル名はビルドのたびに変わるので、決め打ちで先読みはしない。
 * 一度取ったものを貯めて、次からはそれを出す（裏で新しいものに入れ替える）。
 *
 * VERSION を変えると、古い貯めぶんは捨てられる。
 */
var VERSION = 'v1';
var SHELL = 'shell-' + VERSION;
var ASSETS = 'assets-' + VERSION;

function rootUrl() {
  return new URL('./', self.registration.scope).toString();
}

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(SHELL).then(function (cache) {
      return cache.add(new Request(rootUrl(), { cache: 'reload' }));
    }).then(function () {
      return self.skipWaiting();
    })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.filter(function (k) { return k.indexOf(VERSION) === -1; })
            .map(function (k) { return caches.delete(k); })
      );
    }).then(function () {
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', function (event) {
  var req = event.request;
  if (req.method !== 'GET') return;
  if (new URL(req.url).origin !== self.location.origin) return;

  // 画面そのもの：まず取りに行き、繋がらなければ貯めぶんを出す
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).then(function (fresh) {
        caches.open(SHELL).then(function (c) { c.put(req, fresh.clone()); });
        return fresh;
      }).catch(function () {
        return caches.open(SHELL).then(function (c) {
          return c.match(req).then(function (hit) {
            return hit || c.match(rootUrl());
          });
        });
      })
    );
    return;
  }

  // 部品：貯めぶんを即出しして、裏で新しいものに入れ替える
  event.respondWith(
    caches.open(ASSETS).then(function (cache) {
      return cache.match(req).then(function (hit) {
        var network = fetch(req).then(function (fresh) {
          if (fresh && fresh.ok) cache.put(req, fresh.clone());
          return fresh;
        });
        if (hit) {
          network.catch(function () {});
          return hit;
        }
        return network;
      });
    })
  );
});
