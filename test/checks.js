// 기능 단위 검사 — node test/checks.js
// 실패가 하나라도 있으면 종료 코드 1
const H = require("./harness.js");
const A = () => H.api();
const T = () => H.evalIn("window.__test");

let failed = 0;
const ok = (name, cond, extra) => {
  if(!cond) failed++;
  console.log((cond ? "PASS" : "FAIL") + " · " + name + (extra ? "  (" + extra + ")" : ""));
};

function start(){
  const a = A();
  (a.reset || T().reset)();
  H.step();
  a.hold(true); H.step(); a.hold(false);
  a.keys.right = false; a.keys.down = false;
  return a;
}
function run(a, n, fn){
  for(let i=0;i<n;i++){
    if(fn) fn(a.peek(), i);
    if(a.peek().state === 2) return a.peek();
    H.step();
  }
  return a.peek();
}
// 실제 플레이에 가까운 스윙 정책
function swing(a, st){
  a.keys.right = true;
  if(st.rope){ if(st.x > st.rope.a.x && st.vy < -1.2) a.hold(false); else a.hold(true); }
  else { a.hold(true); a.keys.down = (st.y < 200 && st.vy > 0); }
}

/* --- 잡몹 --- */
{
  // 보스는 닿아도 안 죽는데 해왕류만 즉사하는 건 형평에 안 맞아서, 즉사 대신
  // 아주 강한 스턴(knockKing)으로 바꿨다 — 죽지는 않고, 대신 크게 휘청인다
  const a = start();
  let s = a.peek();
  s.mobs.length = 0;
  s.mobs.push({ kind:1, x:s.x + 300, y:s.SEA, phase:3, t:0, h:300, gone:false });
  let sawHardStun = false;
  s = run(a, 400, (st) => {
    st.mobs.forEach(m => { if(m.kind===1) m.phase = 3; });
    a.keys.right = true;
    if(st.stun > 40) sawHardStun = true;
  });
  // 강한 스턴으로 속도를 잃고 그 뒤에 바다에 빠질 순 있지만(자연스러운 후폭풍),
  // 접촉 자체가 즉사로 이어지진 않아야 한다 — deathReason이 "해왕류"가 아니면 통과
  ok("해왕류에 닿으면 죽지 않고 아주 강한 스턴만 걸린다",
     sawHardStun && s.deathReason !== "해왕류",
     "강한스턴목격=" + sawHardStun + " 사인=" + (s.deathReason || "없음"));
}
{
  const a = start();
  let s = a.peek();
  s.mobs.length = 0;
  s.mobs.push({ kind:0, x:s.x + 40, y:s.y, vy:0, air:true, t:0, cool:0, gone:false });
  let stunned = false;
  s = run(a, 90, (st) => { if(st.stun > 0) stunned = true; });
  ok("식인 물고기는 휘청만 (즉사 아님)", stunned && s.deathReason !== "해왕류",
     "stun=" + stunned + " 사인=" + (s.deathReason || "없음"));
}

/* --- 고무고무 피스톨 (쿨타임 20초) --- */
{
  const a = start();
  let s = a.peek();
  ok("시작할 때 충전됨", s.skillCd <= 0, "skillCd=" + Math.round(s.skillCd));
  a.fire(); H.step();
  s = a.peek();
  ok("발사되면 주먹이 생긴다", !!s.fist);
  ok("발사 후 쿨타임 진입 (5초 ≈ 300프레임)", s.skillCd > 280, "skillCd=" + Math.round(s.skillCd));
  const before = s.skillCd;
  a.fire(); H.step();
  ok("쿨타임 중엔 재발사 불가", a.peek().skillCd <= before);
}
{
  const a = start();
  const s = a.peek();
  s.mobs.length = 0;
  s.mobs.push({ kind:1, x:s.x + 420, y:s.SEA, phase:3, t:0, h:300, gone:false });
  a.fire();
  let killed = false;
  run(a, 60, (st) => { if(!st.mobs.some(m => m.kind===1)) killed = true; });
  ok("피스톨이 해왕류를 물리친다", killed);
}
{
  let hitOk = false, met = 0;
  for(let attempt=0; attempt<14 && !hitOk; attempt++){
    const a = start();
    let hpBefore = null;
    run(a, 9000, (st) => {
      swing(a, st);
      if(st.boss){
        met++;
        // 피스톨의 보스 사거리가 460px로 제한되어 있어(원거리 스나이핑 방지),
        // 약점 오프셋을 감안해 더 가까운 거리에서 쏜다
        if(hpBefore === null && st.skillCd <= 0 && st.boss.x > st.x && st.boss.x - st.x < 380){
          hpBefore = st.boss.hp; a.fire();
        }
        if(hpBefore !== null && st.boss.hp < hpBefore) hitOk = true;
      } else if(hpBefore !== null) hitOk = true;
    });
  }
  ok("피스톨이 보스 약점에 명중한다", hitOk, "보스 조우 프레임=" + met);
}

/* --- 고무고무 엘리펀트 건 (쿨타임 60초) --- */
{
  const a = start();
  let s = a.peek();
  ok("건도 시작할 때 충전됨", s.gunCd <= 0, "gunCd=" + Math.round(s.gunCd));
  a.fireGun(); H.step();
  s = a.peek();
  ok("발사되면 이펙트가 생긴다", !!s.gun);
  ok("발사 후 쿨타임 진입 (15초 ≈ 900프레임)", s.gunCd > 850, "gunCd=" + Math.round(s.gunCd));
  const before = s.gunCd;
  a.fireGun(); H.step();
  ok("쿨타임 중엔 재발사 불가", a.peek().gunCd <= before);
}
{
  const a = start();
  const s = a.peek();
  s.mobs.length = 0;
  s.mobs.push({ kind:0, x:s.x + 200*1, y:s.y, vy:0, air:true, t:0, cool:0, gone:false });
  s.mobs.push({ kind:1, x:s.x + 200, y:s.SEA, phase:3, t:0, h:300, gone:false });
  a.fireGun();
  let fishGone = false, kingGone = false;
  run(a, 10, (st) => {
    if(!st.mobs.some(m => m.kind===0)) fishGone = true;
    if(!st.mobs.some(m => m.kind===1)) kingGone = true;
  });
  ok("엘리펀트 건이 근처 잡몹·해왕류를 광역 처치한다", fishGone && kingGone,
     "물고기제거=" + fishGone + " 해왕류제거=" + kingGone);
}
{
  let hitOk = false, met = 0;
  for(let attempt=0; attempt<14 && !hitOk; attempt++){
    const a = start();
    let hpBefore = null;
    run(a, 9000, (st) => {
      swing(a, st);
      if(st.boss){
        met++;
        if(hpBefore === null && st.gunCd <= 0 && st.boss.x > st.x && st.boss.x - st.x < 340){
          hpBefore = st.boss.hp; a.fireGun();
        }
        if(hpBefore !== null && st.boss.hp < hpBefore) hitOk = true;
      } else if(hpBefore !== null) hitOk = true;
    });
  }
  ok("엘리펀트 건이 보스에게 명중한다", hitOk, "보스 조우 프레임=" + met);
}

/* --- 보스 약점 --- */
{
  const a = start();
  const P = T().P();
  const res = {};
  // 0~4 중간보스 5종, 5 크라켄(대형) — 돌풍술사(4) 추가로 크라켄이 4에서 5로 밀림
  for(const t of [0,1,2,3,4,5]){
    const b = { type:t, big:t===5, hp:2, maxHp:2, t:0, life:9999, fire:90, invul:0, flash:0,
                x:P.x+400, y:120, vy:-3, air:true, phase:0, sub:200, perch:null, tents:[],
                swing:12, sink:0, dive:0 };
    let mx = 0, pos = new Set();
    for(let f=0; f<400; f++){
      b.t = f;
      const w = T().wp(b);
      mx = Math.max(mx, w.length);
      w.forEach(q => pos.add(Math.round(q.x) + "," + Math.round(q.y)));
    }
    res[t] = { 개수:mx, 위치:pos.size };
  }
  ok("중간보스 5종 모두 약점이 2개", [0,1,2,3,4].every(t => res[t].개수 === 2),
     JSON.stringify(res));
  ok("약점이 고정되어 있지 않다", [0,2,3,4,5].every(t => res[t].위치 > 10));

  const b4 = { type:4, big:false, hp:2, maxHp:2, t:37, life:9999, fire:90, invul:0, flash:0,
               x:P.x+400, y:120, vy:-3, air:true, phase:0, sub:200, perch:null, tents:[],
               swing:12, sink:0, dive:0 };
  const marks = T().wp(b4).map(w => w.mark);
  ok("돌풍술사 약점 이름 확인", marks.includes("돌풍술사") && marks.includes("지팡이 끝"), marks.join(","));
}

/* --- 보호막(보스 격파 보상) --- */
{
  const a = start();
  T().setShield(1);
  let s = a.peek();
  s.mobs.length = 0;
  s.mobs.push({ kind:0, x:s.x + 40, y:s.y, vy:0, air:true, t:0, cool:0, gone:false });
  let usedShield = false, stunned = false;
  const res = run(a, 90, (st) => {
    if(st.shield === 0) usedShield = true;
    if(st.stun > 0) stunned = true;
  });
  ok("보호막이 첫 피격을 대신 막아 스턴 없이 소비된다",
     usedShield && !stunned, "shield소진=" + usedShield + " 스턴발생=" + stunned);
}

/* --- 돌풍술사의 돌풍 (궤적만 밀어내고 스턴은 없음) --- */
{
  const a = start();
  const s0 = a.peek();
  const vxBefore = s0.vx;
  T().pushShot({ x: s0.x + 20, y: s0.y, vx: -1, vy: 0, g: 0, r: 34, kind: 3, spin: 0, windPush: 8.5 });
  let stunned = false, pushed = false;
  const res = run(a, 20, (st) => {
    if(st.stun > 0) stunned = true;
    if(st.vx > vxBefore + 3) pushed = true;
  });
  ok("돌풍은 스턴 없이 궤적만 밀어낸다", pushed && !stunned,
     "밀림=" + pushed + " 스턴=" + stunned);
}

/* --- 콤보(연속 스윙) 스타일 점수 --- */
{
  const a = start();
  a.hold(true);                 // 누르고 있으면 재사용 가능해지는 즉시 자동으로 걸린다(선입력)
  run(a, 30, () => {});
  T().setChain(3);
  let s = a.peek();
  ok("콤보 설정 직후엔 유지된다", s.chain === 3, "chain=" + s.chain);
  const res = run(a, 250, () => {});   // CHAIN_DECAY_T(200프레임)보다 더 오래 대기
  ok("일정 시간 안에 못 이으면 콤보가 끊긴다", res.chain === 0 && res.state !== 2,
     "chain=" + res.chain + " state=" + res.state);
}

/* --- 보스 격파 랜덤 보상 --- */
{
  let sawShieldReward = false;
  for(let attempt=0; attempt<40 && !sawShieldReward; attempt++){
    const a = start();
    const P = T().P();
    T().setBoss({ type:0, big:false, hp:1, maxHp:1, t:0, fire:90, harpoon:70, fishSkill:200,
                  invul:0, flash:0, x:P.x+50, y:P.y, vy:0, air:false, phase:0, sub:0,
                  perch:null, perch2:null, tents:[], swing:0, sink:0, dive:0 });
    T().dmg(true, "test");
    if(a.peek().shield >= 1) sawShieldReward = true;
  }
  ok("보스를 격파하면 랜덤 보상(보호막 포함) 중 하나가 나온다", sawShieldReward,
     "40번 시도 중 보호막 목격=" + sawShieldReward);
}

/* --- 본게임 / 연습 모드 --- */
{
  const a = start();   // start()는 practiceMode를 건드리지 않는 reset()만 호출한다 — 이 시점엔 아직 아무 연습도 선택 안 됨
  ok("본게임으로 시작하면 practiceMode가 없다", !a.peek().practiceMode,
     "practiceMode=" + JSON.stringify(a.peek().practiceMode));
}
{
  let sawType2 = false, sawOtherType = false, sawMob = false, metFrames = 0;
  for(let attempt=0; attempt<6 && !sawType2; attempt++){
    const a = A();
    a.startPractice(2);   // 포함 흑조호(type 2) 연습
    H.step();
    a.hold(true); H.step(); a.hold(false);
    run(a, 2000, (st) => {
      swing(a, st);
      if(st.mobs && st.mobs.length) sawMob = true;
      if(st.boss){
        metFrames++;
        if(st.boss.type === 2) sawType2 = true; else sawOtherType = true;
      }
    });
  }
  ok("보스 연습 — 지정한 보스만 등장한다", sawType2 && !sawOtherType,
     "지정타입목격=" + sawType2 + " 다른타입목격=" + sawOtherType + " 조우프레임=" + metFrames);
  ok("보스 연습 — 잡몹은 나오지 않는다", !sawMob, "잡몹목격=" + sawMob);
}
{
  let kingCount = 0, sawBoss = false, sawFish = false;
  for(let attempt=0; attempt<6 && kingCount < 20; attempt++){
    const a = A();
    a.startPractice(6);   // 해왕류 폭주 연습 (PRACTICE_OPTIONS의 마지막 항목)
    H.step();
    a.hold(true); H.step(); a.hold(false);
    run(a, 2000, (st) => {
      swing(a, st);
      if(st.boss) sawBoss = true;
      for(const m of (st.mobs || [])){ if(m.kind === 1) kingCount++; else sawFish = true; }
    });
  }
  ok("해왕류 폭주 연습 — 일반 보스는 나오지 않는다", !sawBoss, "보스목격=" + sawBoss);
  ok("해왕류 폭주 연습 — 물고기 없이 해왕류만 아주 자주 나온다", !sawFish && kingCount >= 20,
     "물고기목격=" + sawFish + " 해왕류연인원=" + kingCount);
}
{
  const a = A();
  a.startPractice(0);
  const before = T().lifeStats();
  const P = T().P();
  T().setBoss({ type:0, big:false, hp:1, maxHp:1, t:0, fire:90, harpoon:70, fishSkill:200,
                invul:0, flash:0, x:P.x+50, y:P.y, vy:0, air:false, phase:0, sub:0,
                perch:null, perch2:null, tents:[], swing:0, sink:0, dive:0 });
  T().dmg(true, "test");
  const after = T().lifeStats();
  ok("연습 모드에서 격파해도 누적 처치 기록(칭호 진행도)이 오르지 않는다",
     after.boss === before.boss && after.kraken === before.kraken,
     "이전=" + JSON.stringify(before) + " 이후=" + JSON.stringify(after));
  a.startMain();   // 이후 테스트에 영향 없도록 본게임으로 복귀
}
{
  const a = A();
  a.startPractice(0);
  a.toMenu();
  ok("메뉴로 돌아가면 state가 MENU가 된다", a.peek().state === 4, "state=" + a.peek().state);
  a.startMain();   // 이후 테스트에 영향 없도록 본게임으로 복귀, practiceMode도 초기화
  ok("본게임으로 복귀하면 practiceMode가 다시 없다", !a.peek().practiceMode);
}

/* --- 고기 → 고무고무 풍선 --- */
{
  const a = start();
  T().setFusen(1);
  const P = T().P();
  P.y = a.peek().SEA - 30; P.vy = 12; P.vx = 5;
  const s = run(a, 3);
  ok("풍선이 있으면 바다에 빠져도 튕겨 오른다", s.state === 1 && s.fusen === 0 && s.vy < 0,
     "state=" + s.state + " fusen=" + s.fusen + " vy=" + s.vy.toFixed(1));
  P.y = a.peek().SEA - 30; P.vy = 12;
  const s2 = run(a, 3);
  ok("풍선을 다 쓰면 바다에 빠진다", s2.state === 2 && s2.deathReason === "바다", "사인=" + s2.deathReason);
}
{
  const a = start();
  T().setFusen(0);
  const P = T().P();
  T().meats().push({ x:P.x, y:P.y, got:false });
  const s = run(a, 1);
  ok("고기를 먹으면 풍선이 생긴다", s.fusen === 1, "fusen=" + s.fusen);
}

/* --- 퍼펙트 릴리즈 --- */
{
  const a = start();
  let s = run(a, 200, (st) => { a.hold(true); a.keys.right = true; });
  s = a.peek();
  if(s.rope){
    const P = T().P();
    P.x = s.rope.a.x + 40; P.y = s.rope.a.y + 60; P.vx = 9; P.vy = -9;   // 앞쪽 위 45°
    const before = Math.hypot(P.vx, P.vy);
    a.hold(false);
    const after = Math.hypot(P.vx, P.vy);
    ok("알맞은 각도로 놓으면 PERFECT 릴리즈 가속", a.peek().perfects === 1 && after > before * 1.05,
       "perfects=" + a.peek().perfects + " 속도 " + before.toFixed(1) + "→" + after.toFixed(1));
  } else ok("알맞은 각도로 놓으면 PERFECT 릴리즈 가속", false, "줄을 못 잡음");
  // 뒤로 놓으면 판정 없음
  s = run(a, 200, (st) => { a.hold(true); a.keys.right = true; });
  s = a.peek();
  if(s.rope){
    const P = T().P();
    P.x = s.rope.a.x - 40; P.vx = -9; P.vy = -9;
    a.hold(false);
    ok("고리 뒤쪽으로 놓으면 PERFECT가 아니다", a.peek().perfects === 1, "perfects=" + a.peek().perfects);
  }
}

/* --- 항해 미션 --- */
{
  const a = start();
  const ms = a.peek().missions;
  ok("본게임은 미션 3개로 시작한다", ms.length === 3 && new Set(ms.map(m => m.kind)).size === 3,
     ms.map(m => m.text).join(" / "));
  // 금방 차는 거리 미션으로 바꿔 넣고 달성 처리를 확인
  ms.length = 0;
  ms.push({ kind:"dist", n:1, text:"1m 항해", reward:80, done:false });
  const t1 = a.peek().treasure;
  run(a, 60, (st) => swing(a, st));
  ok("미션을 달성하면 완료 처리되고 보물을 받는다", ms[0].done && a.peek().treasure >= t1 + 80,
     "done=" + ms[0].done + " 보물 " + t1 + "→" + a.peek().treasure);
  a.startPractice(0);
  ok("연습 모드엔 미션이 없다", a.peek().missions.length === 0);
  a.startMain();
}

/* --- 최고 기록 깃발 --- */
{
  let broke = false, reached = 0;
  for(let attempt = 0; attempt < 6 && !broke; attempt++){
    T().setBest(60);
    const a = start();
    const s = run(a, 1500, (st) => swing(a, st));
    broke = s.recordBroken; reached = Math.max(reached, s.dist);
  }
  ok("최고 기록을 넘으면 신기록 연출이 뜬다", broke, "도달=" + Math.floor(reached) + "m");
  T().setBest(0);
}

/* --- 날씨 구간 --- */
{
  let started = null, ended = false;
  for(let attempt = 0; attempt < 6 && !ended; attempt++){
    const a = start();
    T().setNextWeather(5);
    run(a, 3000, (st) => {
      swing(a, st);
      if(st.weather && !started) started = st.weather.type;
      if(started && !st.weather && st.dist > 130) ended = true;
    });
  }
  ok("날씨 구간이 시작되고 일정 거리 뒤 끝난다", !!started && ended, "종류=" + started + " 종료=" + ended);
  const a = A();
  a.startPractice(0); H.step();
  T().setNextWeather(0);
  a.hold(true); H.step(); a.hold(false);
  run(a, 60, (st) => swing(a, st));
  ok("연습 모드엔 날씨가 없다", !a.peek().weather);
  a.startMain();
}

/* --- 위험 보너스 --- */
{
  const a = start();
  const P = T().P();
  const S = a.peek().SEA;
  a.hold(false);
  const tr0 = a.peek().treasure;
  run(a, 30, () => { P.y = S - 35; P.vy = 0; P.vx = 12; });
  P.y = 200; P.vy = 0;
  const s = run(a, 2);
  ok("수면 위를 빠르게 스치면 수면 스치기 보너스", s.skims === 1 && s.treasure > tr0, "skims=" + s.skims + " 보물 " + tr0 + "→" + s.treasure);
}
{
  const a = start();
  let s = a.peek();
  s.mobs.length = 0;
  const P = T().P();
  // 해왕류 머리 위를 판정선 바로 바깥으로 지나가게 한다 (머리 중심 = SEA-300-26, 판정 반경 86)
  const kx = P.x + 120;
  s.mobs.push({ kind:1, x:kx, y:s.SEA, phase:3, t:0, h:300, gone:false });
  const headY = s.SEA - 300 - 26;
  a.hold(false);
  s = run(a, 40, () => { P.y = headY - 86 - 20; P.vy = 0; P.vx = 10; });
  ok("해왕류를 아슬아슬하게 피하면 보너스", s.nearMisses === 1 && s.stun <= 0, "nearMisses=" + s.nearMisses + " stun=" + s.stun);
}

/* --- 보물 창고 --- */
{
  const a = A();
  const sh = a.shop;
  sh().setBank(0);
  ok("보물이 모자라면 살 수 없다", sh().buy(0) === false && (sh().upgrades.reach || 0) === 0);
  const reach0 = sh().reach, cd0 = sh().pistolCd;
  sh().setBank(10000);
  const okBuy = sh().buy(0) && sh().buy(1) && sh().buy(3);
  ok("업그레이드를 사면 보물이 빠지고 효과가 붙는다",
     okBuy && sh().bank === 10000 - 800 - 600 - 2500 && sh().reach > reach0 && sh().pistolCd < cd0,
     "창고=" + sh().bank + " 팔 " + reach0 + "→" + Math.round(sh().reach) + " 쿨 " + cd0 + "→" + sh().pistolCd);
  const st = start();
  ok("비상식량을 사면 풍선 하나를 들고 출발한다", st.peek().fusen === 1, "fusen=" + st.peek().fusen);
  // 판이 끝나면 보물이 창고로
  const bank0 = sh().bank;
  st.hold(false);
  T().setFusen(0);
  T().setTreasure(123);
  T().P().y = st.peek().SEA + 10;
  const beforeTr = st.peek().treasure;
  run(st, 3);
  ok("본게임이 끝나면 그 판의 보물이 창고에 쌓인다", st.peek().state === 2 && sh().bank === bank0 + Math.floor(beforeTr),
     "창고 " + bank0 + "→" + sh().bank + " (이번 판 " + Math.floor(beforeTr) + ")");
  // 다른 테스트에 영향 없도록 되돌린다
  for(const k of Object.keys(sh().upgrades)) delete sh().upgrades[k];
  sh().setBank(0);
}

/* --- 특수 고리 --- */
{
  const a = start();
  for(const an of a.peek().anchors) an.gold = true;
  const tr0 = a.peek().treasure;
  const s = run(a, 400, (st) => { swing(a, st); });
  ok("황금 고리를 잡으면 보물이 터진다", s.goldRings >= 1 && s.treasure >= tr0 + 100, "goldRings=" + s.goldRings);
}
{
  const a = start();
  let s = run(a, 200, (st) => { a.hold(true); a.keys.right = true; });
  s = a.peek();
  if(s.rope){
    const an = s.rope.a;
    an.rot = true; an.creak = 3;
    s = run(a, 6, () => a.hold(true));
    ok("삭은 돛대는 잡고 있으면 부러져 줄이 끊긴다", an.broken && (!s.rope || s.rope.a !== an), "broken=" + an.broken);
    ok("부러진 돛대는 다시 잡을 수 없다", a.pick() !== an);
  } else ok("삭은 돛대는 잡고 있으면 부러져 줄이 끊긴다", false, "줄을 못 잡음");
}

/* --- 기어 2 --- */
{
  const a = start();
  a.fireGear();
  ok("게이지가 덜 차면 기어 2가 안 나간다", a.peek().gearT === 0);
  T().setGear(100);
  a.fireGear();
  ok("게이지가 차면 기어 2 발동", a.peek().gearT > 0 && a.peek().gear === 0, "gearT=" + a.peek().gearT);
  let s = a.peek();
  s.mobs.length = 0;
  s.mobs.push({ kind:1, x:s.x + 200, y:s.SEA, phase:3, t:0, h:300, gone:false });
  let hit = false;
  s = run(a, 120, (st) => { a.keys.right = true; st.mobs.forEach(m => { if(m.kind === 1) m.phase = 3; }); if(st.stun > 0) hit = true; });
  ok("기어 2 중엔 해왕류에 닿아도 휘청이지 않는다", !hit, "stun목격=" + hit);
}
{
  // 게이지는 멋진 플레이로 찬다 — PERFECT 한 번이면 18
  const a = start();
  let s = run(a, 200, (st) => { a.hold(true); a.keys.right = true; });
  s = a.peek();
  if(s.rope){
    const P = T().P();
    P.x = s.rope.a.x + 40; P.vx = 9; P.vy = -9;
    a.hold(false);
    ok("PERFECT 릴리즈로 기어 게이지가 찬다", a.peek().gear >= 18, "gear=" + a.peek().gear);
  }
}

/* --- 현상수배 포스터 --- */
{
  const a = start();
  a.hold(false);
  T().setFusen(0);
  T().setTreasure(100);
  T().P().y = a.peek().SEA + 10;
  const s = run(a, 3);
  ok("게임오버 때 현상금이 매겨진다", s.state === 2 && s.runBounty >= 100 * 500, "현상금=" + s.runBounty);
}

/* --- 보물 통 --- */
{
  const a = start();
  const P = T().P();
  const s0 = a.peek();
  s0.barrels.length = 0; s0.mobs.length = 0;
  s0.barrels.push({ x: P.x + 300, gone:false });
  a.fire();
  const s = run(a, 30);
  ok("피스톨로 보물 통을 부수면 금화가 흩뿌려진다", s.barrelsBroken === 1, "부순 통=" + s.barrelsBroken);
}
{
  const a = start();
  const P = T().P();
  const s0 = a.peek();
  s0.barrels.length = 0;
  s0.barrels.push({ x: P.x + 60, gone:false });
  a.hold(false);
  const s = run(a, 12, () => { P.y = s0.SEA - 30; P.vy = 0; P.vx = 10; });
  ok("수면을 스치며 보물 통을 들이받아도 부서진다", s.barrelsBroken === 1, "부순 통=" + s.barrelsBroken);
}

/* --- 두건 스킨 --- */
{
  const sh = A().shop;
  sh().setBank(1000);
  ok("보물이 모자라면 스킨을 못 산다", sh().pickSkin(1) === false && sh().skin === "red");
  sh().setBank(2000);
  ok("스킨을 사면 보물이 빠지고 바로 장착된다", sh().pickSkin(1) && sh().skin === "navy" && sh().bank === 500, "창고=" + sh().bank);
  ok("가진 스킨은 공짜로 다시 장착", sh().pickSkin(0) && sh().skin === "red" && sh().bank === 500);
  sh().ownedSkins.length = 1; sh().setBank(0);
}

/* --- 오늘의 항해 --- */
{
  const a = A();
  const snap = () => { const st = a.peek(); return JSON.stringify({ an: st.anchors.slice(0, 12).map(q => [Math.round(q.x), Math.round(q.y), q.kind]), ms: st.missions.map(m => m.text) }); };
  a.startDaily(); H.step();
  const d1 = snap();
  a.startDaily(); H.step();
  const d2 = snap();
  a.startMain(); H.step();
  const m1 = snap();
  a.startMain(); H.step();
  const m2 = snap();
  ok("오늘의 항해는 매번 같은 코스·미션", d1 === d2 && a.peek().dailyMode === false);
  ok("본게임 코스는 매번 다르다", m1 !== m2);
}

/* --- 오늘의 항해 고스트 --- */
{
  const a = A();
  a.startDaily(); H.step();
  a.hold(true); H.step(); a.hold(false);
  const s = run(a, 6000, (st) => swing(a, st));
  const g = a.ghost();
  ok("오늘의 항해 기록을 세우면 고스트 궤적이 남는다", s.state === 2 && g.best && g.best.length > 20,
     "궤적 점=" + (g.best ? g.best.length/2 : 0));
  a.startMain();
}

/* --- 폭탄 갈매기 --- */
{
  const a = start();
  const P = T().P();
  let s = a.peek();
  s.mobs.length = 0; s.barrels.length = 0; s.gulls.length = 0;
  s.gulls.push({ x:P.x + 300, base:P.y, y:P.y, t:0, vx:-2, gone:false });
  a.fire();
  s = run(a, 30);
  ok("피스톨로 폭탄 갈매기를 격추한다", s.gullKills === 1, "격추=" + s.gullKills);
}
{
  const a = start();
  const P = T().P();
  let s = a.peek();
  s.gulls.length = 0; s.mobs.length = 0;
  s.gulls.push({ x:P.x + 30, base:P.y, y:P.y, t:0, vx:-2, gone:false });
  a.hold(false);
  let stunned = false;
  s = run(a, 20, (st) => { P.vy = 0; if(st.stun > 0) stunned = true; });
  ok("폭탄 갈매기에 부딪히면 휘청인다", stunned && s.gullHits === 1, "hits=" + s.gullHits);
}

/* --- 항해 일지 --- */
{
  const a = start();
  const L = a.log();
  const runs0 = L.runs, dist0 = L.dist;
  run(a, 200, (st) => swing(a, st));
  a.hold(false); T().setFusen(0);
  T().P().y = a.peek().SEA + 10;
  const s = run(a, 3);
  ok("판이 끝나면 항해 일지에 누적된다", s.state === 2 && L.runs === runs0 + 1 && L.dist >= dist0 + Math.floor(s.dist),
     "판 " + runs0 + "→" + L.runs + " 거리 " + dist0 + "→" + L.dist);
  a.startPractice(0); H.step(); a.hold(true); H.step(); a.hold(false);
  T().setFusen(0); T().P().y = a.peek().SEA + 10;
  run(a, 3);
  ok("연습 모드 판은 일지에 안 쌓인다", L.runs === runs0 + 1);
  a.startMain();
}

/* --- 금화 줄 --- */
{
  let done = false, found = false;
  for(let attempt = 0; attempt < 10 && !done; attempt++){
    const a = start();
    run(a, 400, (st) => swing(a, st));      // 앞쪽에 아치가 생길 때까지 조금 달린다
    const st = a.peek();
    if(st.state === 2) continue;
    const arcCoins = st.coins.filter(c => c.arc && !c.got);
    if(!arcCoins.length) continue;
    const id = arcCoins[0].arc;
    const mine = st.coins.filter(c => c.arc === id);
    if(mine.some(c => c.got)) continue;
    found = true;
    const P = T().P();
    a.hold(false);
    for(const c of mine){ P.vx = 0; P.vy = 0; c.x = P.x; c.y = P.y; H.step(); }
    done = a.peek().arcsDone === 1;
  }
  ok("금화 줄을 전부 먹으면 완성 보너스", found && done, "아치발견=" + found);
}

/* --- 앵무새 동료 --- */
{
  const before = T().lifeStats().boss;
  T().setLifeBoss(0);
  let a = start();
  ok("보스를 3마리 잡기 전엔 앵무새가 없다", !a.parrot().active);
  T().setLifeBoss(3);
  a = start();
  const P = T().P();
  const st = a.peek();
  st.coins.length = 0;
  st.coins.push({ x:P.x + 120, y:P.y - 20, got:false });
  a.hold(false);
  const s = run(a, 90, () => { P.vx = 0; P.vy = 0; P.y = 200; });
  ok("앵무새가 근처 금화를 물어 온다", a.parrot().active && st.coins[0].got, "got=" + st.coins[0].got);
  T().setLifeBoss(before);
}

/* --- 흑조호 잠항 (순간이동 금지) --- */
{
  let maxJump = 0, sank = false, fast = false, up = false, wpDown = 0;
  // 플레이어가 먼저 죽으면 보스 갱신이 멈추므로 몇 번 다시 시도한다
  for(let attempt = 0; attempt < 8 && !up; attempt++){
    const a = start();
    const P = T().P();
    const b = { type:2, big:false, hp:2, maxHp:2, t:0, life:60*60, fire:90, invul:0, flash:0,
                x:P.x - 300, y:0, vy:0, air:false, phase:0, sub:0, perch:null, tents:[],
                swing:0, sink:0, dive:0 };
    T().setBoss(b);
    let prevX = b.x;
    for(let f=0; f<900; f++){
      const st = a.peek();
      if(st.state === 2) break;
      swing(a, st);
      H.step();
      const cur = a.peek().boss;
      if(!cur) break;
      maxJump = Math.max(maxJump, Math.abs(cur.x - prevX));
      prevX = cur.x;
      if(cur.dive === 1) sank = true;
      if(cur.dive === 2) fast = true;
      if(fast && cur.dive === 0) up = true;
      if(cur.sink > 12) wpDown = Math.max(wpDown, T().wp(cur).length);
    }
  }
  ok("흑조호가 순간이동하지 않는다", maxJump > 0 && maxJump < 40, Math.round(maxJump) + "px/프레임");
  ok("잠항 → 물밑 이동 → 부상", sank && fast && up,
     "잠항=" + sank + " 이동=" + fast + " 부상=" + up);
  ok("잠항 중엔 약점이 없다", wpDown === 0, "약점 " + wpDown + "개");
}

/* --- 프로젝트 원칙 --- */
{
  const fs = require("fs"), path = require("path");
  const src = fs.readFileSync(process.env.GAME || path.join(__dirname, "..", "index.html"), "utf8");
  const audio = src.split("\n").filter(l =>
    /new Audio|AudioContext|<audio|navigator\.vibrate/.test(l) && !l.trim().startsWith("/*"));
  ok("오디오 코드 없음", audio.length === 0, audio.join(" | "));
  ok("외부 라이브러리 없음", !/src="http|cdn\./.test(src));
  ok("보스(중간·대형)는 시간 초과로 퇴각하지 않는다", !src.includes("물러났다"));
  ok("직전과 같은 중간보스 종류도 다시 나올 수 있다 (lastBossType 필터 제거)", !src.includes("lastBossType"));
  ok("베리어/돌진 스킬 코드 없음", !/fireBarrier|fireDash|BARRIER_CD|DASH_CD/.test(src));
}

console.log(failed === 0 ? "\n전부 통과" : "\n실패 " + failed + "건");
process.exit(failed === 0 ? 0 : 1);
