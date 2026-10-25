// 계정 검사 — node test/account.js
// 하네스의 localStorage는 아무것도 저장하지 않는 껍데기라, 실제로 저장되는 메모리 저장소로 바꿔 끼운다
const H = require("./harness.js");
H.evalIn(`(() => {
  const m = new Map();
  const ls = { getItem:(k) => m.has(k) ? m.get(k) : null, setItem:(k, v) => m.set(k, String(v)), removeItem:(k) => m.delete(k), _m:m, clear:() => m.clear(),
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

  // 저장 코드 — 한 계정의 진행 상황을 코드로 만들어 다른 기기(여기선 다른 계정·비운 저장소)에 그대로 옮긴다
  r = await ac().login("상디", "cook1234");
  ok("(준비) 상디로 로그인", ac().cur === "상디", r.msg);
  sh().setBank(4321); sh().pickSkin(0);
  H.evalIn("window.__test").setBest(987);
  let mk = await ac().makeCode();
  ok("저장 코드는 G2- 로 시작하는 한 줄", mk.ok && /^G2-[A-Za-z0-9_-]+$/.test(mk.code), mk.code.slice(0, 30));
  ok("코드 안에 비밀번호·해시는 없다", mk.code.indexOf("cook1234") < 0 && !!ac().readCode(mk.code) && !("swing:accounts" in ac().readCode(mk.code).d));
  ok("일일 유령 기록은 코드에서 뺀다", !/"ghost":\[[0-9]/.test(ac().readCode(mk.code).d["swing:daily"] || ""));
  const code = mk.code;
  // 다른 기기 흉내: 저장소를 통째로 비우고 게스트로 시작
  LS().clear();
  await ac().logout();
  ok("빈 기기에서는 창고가 비어 있다", sh().bank !== 4321 && String(el("best").textContent) !== "987", "창고=" + sh().bank);
  r = await ac().applyCode(code.slice(0, -3) + "xyz");
  ok("한 글자라도 바뀐 코드는 거절", !r.ok && sh().bank !== 4321);
  r = await ac().applyCode("  " + code.slice(0, 20) + "\n" + code.slice(20) + "\n");
  ok("줄바꿈·공백이 끼어도 불러온다", r.ok && sh().bank === 4321, r.msg + " / 창고=" + sh().bank);
  ok("최고 거리도 따라온다", String(el("best").textContent) === "987", "최고=" + el("best").textContent);
  ok("불러온 값은 게스트 저장분에 남는다", /"bank":4321/.test(LS().get("swing:shop") || ""));
  // 로그인한 계정 위로 불러오면 그 계정 이름 칸에 저장, 코드에 없는 값은 처음 상태로
  r = await ac().signup("조로", "sword1234", false);
  sh().setBank(99); sh().pickSkin(0);
  r = await ac().applyCode(code);
  ok("로그인한 계정에 덮어쓴다", r.ok && sh().bank === 4321 && /"bank":4321/.test(LS().get("acct:조로:swing:shop") || ""), r.msg);
  // 화면 버튼: 불러오기는 두 번 눌러야 덮어쓴다
  sh().setBank(1); sh().pickSkin(0);
  el("acctCode").value = code;
  await ac().uiLoad();
  ok("[코드로 불러오기] 첫 번째는 확인만 묻는다", sh().bank === 1 && /한 번 더/.test(el("acctMsg").textContent), el("acctMsg").textContent);
  await ac().uiLoad();
  ok("두 번째에 불러온다", sh().bank === 4321, el("acctMsg").textContent);
  el("acctCode").value = "";
  await ac().uiMake();
  ok("[코드 만들기]가 칸에 코드를 채운다", !!ac().readCode(el("acctCode").value), el("acctMsg").textContent);

  // 짧은 저장 코드(G2) — 묶기는 무엇이든 그대로 되돌린다
  const L = ac().pack;
  const rnd = (n) => Math.floor(Math.random() * n);
  const rstr = () => { let t = ""; const n = rnd(12); for(let j = 0; j < n; j++) t += String.fromCharCode(rnd(5) ? 32 + rnd(90) : 0xac00 + rnd(500)); return t; };
  const rval = (d) => {
    const k = rnd(d > 3 ? 6 : 9);
    if(k === 0) return null; if(k === 1) return rnd(2) === 0;
    if(k === 2) return [0, 1, 199, 200, 201, 127, 128, 16383, 16384, 401234, 2 ** 40, -1, -300, 0.5, -2.25][rnd(15)];
    if(k === 3) return rnd(1e9); if(k === 4) return ["red", "boss11", "2026-10-22", "2020-01-01", "2019-12-31", "2026-02-30", "", rstr()][rnd(8)];
    if(k === 5) return rstr();
    if(k === 6){ const a = []; for(let j = rnd(6); j > 0; j--) a.push(rval(d + 1)); return a; }
    const o = {}; for(let j = rnd(6); j > 0; j--) o[["bank", "dex", "fish", "새키", rstr(), "x" + rnd(99)][rnd(6)]] = rval(d + 1); return o;
  };
  const vals = [{}, [], "", 0, { a: "2026-10-22" }];
  for(let i = 0; i < 200; i++) vals.push(rval(0));
  const bad = vals.filter(v => JSON.stringify(L.unpack(L.pack(v))) !== JSON.stringify(v));
  ok("묶기 → 풀기가 무작위 값 205개 모두 그대로", bad.length === 0, bad.length ? JSON.stringify(bad[0]) : "");
  let threw = 0;
  for(const t of ["", "A", "AAAA", "____", "zzzzzzzz"]){ try{ L.unpack(t); }catch(e){ threw++; } }
  ok("엉터리 코드는 풀다가 오류로 멈춘다(게임이 망가지지 않게)", threw === 5, threw + "/5");

  // 오래 플레이한 계정 — 모든 저장분이 한 글자도 안 틀리고 옮겨진다
  r = await ac().signup("부자", "rich1234", false);
  const DEXIDS = ["fish","king","gull","jelly","gold","rot","port","barrel","meat","map","floe","geyser","biome0","biome1","biome2","biome3","wind","storm","fog","bonus","barrage","navy","rival","skyroute","searoute"].concat([...Array(16).keys()].map(i => "boss" + i));
  const dex = {}; DEXIDS.forEach((id, i) => { dex[id] = 3 + i * 7; });
  const rich = {
    "swing:best": "12345", "swing:bestChain": "37",
    "swing:titles": JSON.stringify({ boss: 88, kraken: 12, ghost: 4, admiral: 2, unlocked: ["novice","gull20","hunter","perfect50","kraken1","ghost1","admiral1","veteran","dist10k","kraken3","ghost3","mapper","kraken10"], sel: "kraken10" }),
    "swing:shop": JSON.stringify({ bank: 987654, up: { reach:3, pistol:3, magnet:2, fusen:1 }, bounty: 2345678, skins: ["red","navy","gold","black","anchor"], skin: "anchor", parrot: false,
                                   mapPieces: 3, mapsDone: 5, blitz: 4567, blitzD: "2026-10-20", rush9: 61234, grade: "A", gearU: 4, gearS: 3,
                                   tech: { pistol:3, whip:2, rifle:5, bazooka:1, gcharge:4, gtime:2 }, mats: { melee:7, ranged:0, gear:11 }, eqR: "rifle", eqM: "bazooka",
                                   crew: ["cook","nav","sword","helm","jack"], crewS: "sword", crewXp: { cook: 2200, nav: 900, sword: 16000, helm: 40, jack: 300 },
                                   story: { st: "737577137711371113111713",       // 스테이지 순서대로 별 비트(P-1 … F-2)
                                            seen: ["P-1","P-1+","P-2","1-1","1-4","1-4+","F-2"], end: 0 }, art: "spin",
                                   mini: { b: { jelly:312, cannon:1650, hop:151 }, m: { jelly:3, cannon:3, hop:3 }, n: 44 }, diff: "hard", bestDiff: { easy: 3000, hard: 9000 } }),
    "swing:log": JSON.stringify({ runs: 912, dist: 401234, perfects: 3456, missions: 678, gulls: 999, barrels: 345, skims: 2345, gears: 456, golds: 789, xp: 123456,
                                  recent: [1200, 900, 1500, 2100, 800, 1300, 1700, 950, 1100, 2500], dex }),
    "swing:daily": JSON.stringify({ date: "2026-10-22", best: 1876, ghost: [1, 2, 3, 4], streakDate: "2026-10-22", streak: 9 })
  };
  for(const k in rich) LS().set("acct:부자:" + k, rich[k]);
  await ac().logout(); await ac().login("부자", "rich1234");
  const snap = (who) => { const o = {}; for(const k in rich) o[k] = LS().get("acct:" + who + ":" + k); return o; };
  const norm = (v) => JSON.stringify(JSON.parse(v), (k, x) => x && typeof x === "object" && !Array.isArray(x) ? Object.keys(x).sort().reduce((o, q) => (o[q] = x[q], o), {}) : x);
  mk = await ac().makeCode();
  const richBefore = snap("부자");
  r = await ac().signup("빈손", "none1234", false);
  r = await ac().applyCode(mk.code);
  const richAfter = snap("빈손");
  const same = Object.keys(rich).filter(k => {
    if(k !== "swing:daily") return norm(richBefore[k]) === norm(richAfter[k]);
    const x = JSON.parse(richBefore[k]), y = JSON.parse(richAfter[k]); x.ghost = []; return norm(JSON.stringify(x)) === norm(JSON.stringify(y));
  });
  ok("오래 플레이한 계정도 저장분 6가지가 그대로 옮겨진다(유령 기록만 빼고)", same.length === 6, same.join(","));
  // v49부터 스토리 진행이 더해져 내용이 늘었다 — 같은 내용을 예전(GOMU1) 방식으로 묶었을 때와 비교한다
  const legacyLen = Buffer.from(JSON.stringify({ v:1, ver:"v49", at:"2026-10-25", from:"부자", d: rich }), "utf8").toString("base64").length + 15;
  ok("오래 플레이한 계정 코드도 짧다(같은 내용을 예전 형식으로 묶은 것의 1/3 미만)", mk.code.length * 3 < legacyLen, mk.code.length + "자 / 예전 형식 " + legacyLen + "자");
  console.log("     (참고: 오래 플레이한 계정 코드 " + mk.code.length + "자, 예전 형식이면 " + legacyLen + "자)");
  ok("불러온 값이 게임에 반영된다", sh().bank === 987654 && a.crew().sel === "sword" && a.tech().eqR === "rifle", "창고=" + sh().bank);
  ok("스토리 진행·비기도 옮겨진다", a.story().stars["5-4"] === 7 && a.story().stars["F-2"] === 3 && a.story().seen.indexOf("1-4+") >= 0 && a.art().sel === "spin", JSON.stringify(a.story().stars["5-4"]) + " " + a.art().sel);

  // 예전 형식(GOMU1)도 계속 읽는다
  const oldCode = { v:1, ver:"v46", at:"2026-10-21", from:"옛날", d:{ "swing:best": "555", "swing:shop": JSON.stringify({ bank: 31337 }) } };
  const ob = Buffer.from(JSON.stringify(oldCode), "utf8").toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  r = await ac().applyCode("GOMU1-" + ob + "." + ac().hash(ob).slice(0, 8));
  ok("예전 GOMU1 코드도 불러온다", r.ok && sh().bank === 31337, r.msg);

  console.log(failed === 0 ? "\n전부 통과" : "\n실패 " + failed + "건");
  process.exit(failed ? 1 : 0);
})();
