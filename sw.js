const CACHE = "gomupal-v40";
const FILES = ["./", "./index.html", "./manifest.json", "./icon-192.png", "./icon-512.png"];

self.addEventListener("install", (e)=>{
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(()=> self.skipWaiting()));
});
self.addEventListener("activate", (e)=>{
  e.waitUntil(caches.keys().then(ks =>
    Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ).then(()=> self.clients.claim()));
});
self.addEventListener("fetch", (e)=>{
  // 게임 본체(페이지·manifest)는 네트워크 우선 — 캐시 우선이면 업데이트가 한 번 더 껐다 켜야 보였다.
  // 오프라인일 때만 캐시로 대신한다. 아이콘 같은 나머지는 캐시 우선.
  const url = new URL(e.request.url);
  const page = e.request.mode === "navigate" || /\/(index\.html)?$/.test(url.pathname) || url.pathname.endsWith("manifest.json");
  if(page){
    e.respondWith(
      fetch(e.request, { cache: "no-cache" }).then(res => {
        if(res.ok){ const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); }
        return res;
      }).catch(()=> caches.match(e.request).then(hit => hit || caches.match("./index.html")))
    );
    return;
  }
  e.respondWith(
    caches.match(e.request).then(hit => hit || fetch(e.request).catch(()=> caches.match("./index.html")))
  );
});
