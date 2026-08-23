/* また買うノート — オフライン用 */
var VERSION = 'v3';
var SHELL   = 'kaimono-shell-' + VERSION;
var RUNTIME = 'kaimono-runtime-' + VERSION;
var ASSETS  = ['./', './index.html', './manifest.json',
               './icon-192.png', './icon-512.png', './icon-512-maskable.png'];

self.addEventListener('install', function(e){
  e.waitUntil(
    caches.open(SHELL)
      .then(function(c){ return c.addAll(ASSETS); })
      .then(function(){ return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function(e){
  e.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(keys.map(function(k){
        if (k !== SHELL && k !== RUNTIME) return caches.delete(k);
      }));
    }).then(function(){ return self.clients.claim(); })
  );
});

function offlineResponse(){
  return new Response('', { status: 504, statusText: 'offline' });
}

self.addEventListener('fetch', function(e){
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);

  // ページ本体：ネット優先（新しい版があれば取りに行く）→ ダメならキャッシュ
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then(function(res){
        var copy = res.clone();
        caches.open(SHELL).then(function(c){ c.put('./index.html', copy); });
        return res;
      }).catch(function(){
        return caches.match('./index.html').then(function(r){
          return r || caches.match('./').then(function(r2){ return r2 || offlineResponse(); });
        });
      })
    );
    return;
  }

  // 外部（Googleフォント）：キャッシュ優先
  if (url.origin !== location.origin) {
    e.respondWith(
      caches.match(req).then(function(hit){
        if (hit) return hit;
        return fetch(req).then(function(res){
          var copy = res.clone();
          caches.open(RUNTIME).then(function(c){ c.put(req, copy); });
          return res;
        }).catch(offlineResponse);
      })
    );
    return;
  }

  // 自分のファイル：キャッシュ優先＋裏で更新
  e.respondWith(
    caches.match(req).then(function(hit){
      var net = fetch(req).then(function(res){
        var copy = res.clone();
        caches.open(SHELL).then(function(c){ c.put(req, copy); });
        return res;
      }).catch(function(){ return hit || offlineResponse(); });
      return hit || net;
    })
  );
});
