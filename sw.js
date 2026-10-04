// 보관 처리: 설치된 앱의 오프라인 캐시를 모두 지우고 서비스 워커를 스스로 해제한다.
// 게임 본체는 git 기록(보관 직전 커밋)에 남아 있다.
self.addEventListener("install", ()=> self.skipWaiting());
self.addEventListener("activate", (e)=>{
  e.waitUntil(
    caches.keys().then(ks => Promise.all(ks.map(k => caches.delete(k))))
      .then(()=> self.registration.unregister())
      .then(()=> self.clients.matchAll({ type: "window" }))
      .then(cs => cs.forEach(c => c.navigate(c.url)))
  );
});
