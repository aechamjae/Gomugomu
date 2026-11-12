const CACHE = "gomupal-v2.1.1";
const FILES = ["./", "./index.html", "./manifest.json", "./icon-192.png?v=3", "./icon-512.png?v=3", "./icon-180.png?v=3", "./icon-maskable-512.png?v=3"];   // 아이콘은 주소에 ?v=를 붙인다 — 그림을 바꾸면 숫자를 올릴 것(사파리·홈 화면 캐시가 같은 주소면 옛 그림을 쓴다)

self.addEventListener("install", (e)=>{
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES.map(f => new Request(f, { cache: "reload" })))).then(()=> self.skipWaiting()));   // 브라우저 HTTP 캐시를 거치지 않고 새로 받는다
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
  // 글꼴(구글 폰트) — 한 번 받으면 캐시에 넣어 두고 오프라인에서도 같은 글꼴로
  if(/fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)){
    e.respondWith(
      caches.match(e.request).then(hit => hit || fetch(e.request).then(res => {
        const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return res;
      }))
    );
    return;
  }
  e.respondWith(
    caches.match(e.request).then(hit => hit || fetch(e.request).catch(()=> caches.match("./index.html")))
  );
});
