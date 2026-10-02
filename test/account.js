// 계정 검사 — node test/account.js
// 하네스의 localStorage는 아무것도 저장하지 않는 껍데기라, 실제로 저장되는 메모리 저장소로 바꿔 끼운다
const H = require("./harness.js");
H.evalIn(`(() => {
  const m = new Map();
  const ls = { getItem:(k) => m.has(k) ? m.get(k) : null, setItem:(k, v) => m.set(k, String(v)), removeItem:(k) => m.delete(k), _m:m,
              key:(i) => [...m.keys()][i] ?? null, get length(){ return m.size; } };
  window.localStorage = ls; globalThis.localStorage = ls;
})()`);
const A = () => H.api();
const LS = () => H.evalIn("window.localStorage._m");

let failed = 0;
const ok = (name, cond, extra) => {
  if(!cond) failed++;
  console.log((cond ? "PASS" : "FAIL") + " · " + name + (extra ? "  (" + extra + ")" : ""));
};

(async () => {
  const a = A(), ac = a.acct, sh = a.shop;
  ok("SHA-256이 표준값과 같다", ac().hash("abc") === "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");

  sh().setBank(777);
  sh().pickSkin(0);                      // 저장을 한 번 일으켜 게스트 창고(777)를 기기에 남긴다
  let r = await ac().signup("x", "1234", true);
  ok("너무 짧은 아이디는 거절", !r.ok);
  r = await ac().signup("루피", "12", true);
  ok("너무 짧은 비밀번호는 거절", !r.ok);

  r = await ac().signup("루피", "gomu1234", true);
  ok("새 계정을 만들면 바로 로그인", r.ok && ac().cur === "루피", r.msg);
  ok("가져가기를 고르면 게스트 보물이 새 계정에 그대로", sh().bank === 777, "창고=" + sh().bank);
  const rec = ac().list()["루피"];
  ok("비밀번호 원문은 저장하지 않는다", rec && rec.hash && ![...LS().values()].some(v => v.indexOf("gomu1234") >= 0));
  ok("계정 보물은 계정 이름이 붙은 키에 저장된다", /"bank":777/.test(LS().get("acct:루피:swing:shop") || ""));

  r = await ac().signup("루피", "다른비번", true);
  ok("같은 아이디로 또 만들 수 없다", !r.ok);

  sh().setBank(5000); sh().buy(0);      // 루피 계정에서 업그레이드를 산다
  r = await ac().logout();
  ok("로그아웃하면 게스트로", r.ok && ac().cur === null);
  ok("게스트 보물은 계정과 따로", sh().bank === 777, "창고=" + sh().bank);

  r = await ac().signup("조로", "santoryu", false);
  ok("가져가지 않으면 빈 상태로 시작", r.ok && sh().bank === 0 && (sh().upgrades.reach || 0) === 0, "창고=" + sh().bank);

  r = await ac().login("루피", "틀린비번");
  ok("비밀번호가 틀리면 로그인 실패", !r.ok && ac().cur === "조로");
  r = await ac().login("없는사람", "1234");
  ok("없는 아이디는 로그인 실패", !r.ok);

  r = await ac().login("루피", "gomu1234");
  ok("로그인하면 그 계정 진행 상황을 불러온다", r.ok && ac().cur === "루피" && sh().bank === 4200 && sh().upgrades.reach === 1,
     "창고=" + sh().bank + " 팔길이=" + sh().upgrades.reach);
  ok("마지막 계정을 기억한다(다음에 열면 자동 로그인)", LS().get("swing:account") === "루피");

  // 판을 끝내면 지금 계정에 쌓인다
  a.reset(); H.step(); a.hold(true); H.step(); a.hold(false);
  H.evalIn("window.__test").setTreasure(300);
  const before = sh().bank;
  for(let i = 0; i < 4000 && a.peek().state !== 2; i++){ if(a.peek().state === 9) a.decline(); if(a.peek().state === 10) a.pickCard(0); if(a.peek().state === 11) a.port().leave(); a.hold(false); H.step(); }
  if(a.peek().state === 9) a.decline();
  ok("본게임 보물이 로그인한 계정 창고에 쌓인다", sh().bank >= before + 300 && /"bank":/.test(LS().get("acct:루피:swing:shop")),
     "창고 " + before + "→" + sh().bank);

  // 중복 확인 · 대소문자 무시
  ok("중복 확인: 이미 있는 아이디는 막고 새 아이디는 통과", !ac().checkId("루피").ok && ac().checkId("LUFFY_x").ok);
  r = await ac().signup("Nosetoad", "toad1234", false);
  ok("영문 아이디 계정 만들기", r.ok, r.msg);
  ok("소문자로 쳐도 중복으로 막힌다", !ac().checkId("nosetoad").ok && !(await ac().signup("nosetoad", "다른비번1", false)).ok);
  await ac().logout();
  r = await ac().login("nosetoad", "toad1234");
  ok("대소문자가 달라도 로그인되고 원래 아이디로 들어간다", r.ok && ac().cur === "Nosetoad", r.msg + " / " + ac().cur);

  // 화면 버튼: 중복 확인을 안 거치면 만들 수 없다
  const el = (id) => H.evalIn("document").getElementById(id);
  el("acctId").value = "상디"; el("acctPw").value = "cook1234";
  ac().uiSignup(); await new Promise(r => setTimeout(r, 0));
  ok("중복 확인 전엔 [새 계정 만들기]가 막힌다", !ac().list()["상디"] && /중복 확인/.test(el("acctMsg").textContent));
  ac().uiCheck(); ac().uiSignup(); await new Promise(r => setTimeout(r, 5));
  ok("중복 확인 후엔 만들어진다", !!ac().list()["상디"], el("acctMsg").textContent);

  // 이미 생긴 중복 정리 — 먼저 만든 것만 남긴다
  const list = ac().list();
  const old = Date.UTC(2026, 8, 1).toString(36), young = Date.UTC(2026, 9, 1).toString(36);
  list["nosetoad"] = { salt:"zzzz" + young, hash:"x", made:"2026-10-01" };   // 나중에 만든 쪽
  list["Nosetoad"].salt = "aaaa" + old;                                      // 먼저 만든 쪽
  list["NOSETOAD"] = { salt:"bbbb" + young, hash:"y", made:"2026-10-01" };
  H.evalIn("localStorage").setItem("swing:accounts", JSON.stringify(list));
  H.evalIn("localStorage").setItem("acct:nosetoad:swing:shop", "{}");
  H.evalIn("localStorage").setItem("swing:account", "NOSETOAD");
  ac().dedupe();
  const after = Object.keys(ac().list()).filter(n => n.toLowerCase() === "nosetoad");
  ok("중복 계정은 먼저 만든 하나만 남는다", after.length === 1 && after[0] === "Nosetoad", after.join(","));
  ok("지운 계정의 저장분도 지운다", LS().get("acct:nosetoad:swing:shop") === undefined);
  ok("지운 계정으로 자동 로그인하던 건 남은 계정으로", LS().get("swing:account") === "Nosetoad");

  console.log(failed === 0 ? "\n전부 통과" : "\n실패 " + failed + "건");
  process.exit(failed ? 1 : 0);
})();
