// 기능 단위 검사 — node test/checks.js
// 실패가 하나라도 있으면 종료 코드 1
const H = require("./harness.js");
const A = () => H.api();
const T = () => H.evalIn("window.__test");
const SEA_Y = () => A().peek().SEA;

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
// 부활 제안(state 9)은 기본적으로 거절한다 — 부활 자체는 따로 검사한다
// 보상 카드(state 10)는 첫 장을 고르고, 항구(state 11)는 바로 출항한다 — 각각은 따로 검사한다
function run(a, n, fn){
  for(let i=0;i<n;i++){
    if(a.peek().state === 9) a.decline();
    if(a.peek().state === 10) a.pickCard(0);
    if(a.peek().state === 11) a.port().leave();
    if(fn) fn(a.peek(), i);
    if(a.peek().state === 2) return a.peek();
    H.step();
  }
  if(a.peek().state === 9) a.decline();
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

/* --- 고무고무 채찍 (W 기본 근거리 기술, 쿨타임 15초) --- */
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
  ok("근거리 기술(채찍)이 근처 잡몹·해왕류를 광역 처치한다", fishGone && kingGone,
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
  ok("근거리 기술(채찍)이 보스에게 명중한다", hitOk, "보스 조우 프레임=" + met);
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
    const offer = a.pick2().offer || [];
    for(let i=0;i<120 && a.peek().state !== 10;i++) H.step();     // 격침 슬로모션이 끝나면 카드가 뜬다
    const si = offer.findIndex(c => c.reward && c.reward.id === "shield");
    if(a.peek().state === 10 && si >= 0){ a.pickCard(si); if(a.peek().shield >= 1 && a.peek().state === 1) sawShieldReward = true; }
    else if(a.peek().state === 10) a.pickCard(0);
  }
  ok("보스를 격파하면 보상 카드가 뜨고, 보호막 카드를 고르면 보호막이 생긴다", sawShieldReward,
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
    a.startPractice(8);   // 해왕류 폭주 연습 (PRACTICE_OPTIONS의 마지막 항목)
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

/* --- 기어 시리즈 --- */
{
  const a = start();
  a.gearSel(2);
  a.fireGear();
  ok("게이지가 덜 차면 기어가 안 나간다", a.peek().gearT === 0);
  T().setGear(100);
  a.fireGear();
  ok("기어 2 — 게이지 100이 차면 발동", a.peek().gearT > 0 && a.peek().gear === 0, "gearT=" + a.peek().gearT);
  // 기어 2는 방어력 — 휘청은 하되 스턴이 30% 줄어든다
  let st0 = 0;
  const s0 = a.peek(); s0.mobs.length = 0;
  s0.mobs.push({ kind:1, x:s0.x + 60, y:s0.SEA, phase:3, t:0, h:300, gone:false });
  run(a, 60, (st) => { st.mobs.forEach(m => { if(m.kind === 1) m.phase = 3; }); if(st.stun > st0) st0 = st.stun; });
  ok("기어 2 중엔 해왕류에 맞아도 스턴이 줄어든다(60 → 42)", st0 > 0 && st0 <= 43, "최대 스턴=" + st0.toFixed(1));
}
{
  const a = start();
  a.gearSel(5, true);
  T().setGear(399);
  a.fireGear();
  ok("기어 5는 게이지 400이 다 차야 한다", a.peek().gearT === 0);
  T().setGear(400);
  a.fireGear();
  let s = a.peek();
  s.mobs.length = 0;
  s.mobs.push({ kind:1, x:s.x + 200, y:s.SEA, phase:3, t:0, h:300, gone:false });
  let hit = false;
  s = run(a, 120, (st) => { a.keys.right = true; st.mobs.forEach(m => { if(m.kind === 1) m.phase = 3; }); if(st.stun > 0) hit = true; });
  ok("기어 5 중엔 해왕류에 닿아도 휘청이지 않는다", !hit, "stun목격=" + hit);
  // 바다도 튕겨 낸다
  const b = start(); b.gearSel(5, true); T().setGear(400); b.fireGear();
  b.hold(false); T().setFusen(0); T().P().y = b.peek().SEA + 5; T().P().vy = 8;
  run(b, 3);
  ok("기어 5 중엔 바다에 빠져도 튕겨 오른다", b.peek().state === 1 && b.peek().vy < 0);
  // 공격력 2배 — 보스에게 2 피해
  const P = T().P();
  const boss = { type:0, big:false, hp:2, maxHp:2, t:0, fire:90, invul:0, flash:0, x:P.x + 300, y:120, vy:0, air:true, phase:0, sub:0, perch:null, tents:[], swing:0, sink:0, dive:0 };
  T().setBoss(boss);
  T().dmg(false, "t");
  ok("기어 5 중엔 한 대에 보스 체력 2가 깎인다", boss.hp === 0 || !b.peek().boss, "hp=" + boss.hp);
  b.gearSel(2);
}
{
  // 기어 3 — 거대 주먹: 범위 안 잡몹 일소 + 보스에 4 피해
  const a = start();
  a.gearSel(3, true);
  T().setGear(160);
  const P = T().P();
  const s = a.peek();
  s.mobs.length = 0; s.gulls.length = 0;
  s.gulls.push({ x:P.x + 240, base:P.y, y:P.y, t:0, vx:-2, gone:false });
  const boss = { type:5, big:true, hp:8, maxHp:8, t:0, fire:90, invul:40, flash:0, x:P.x + 260, y:P.y + 20, vy:0, air:false, phase:0, sub:200, perch:null, tents:[], swing:0, sink:0, dive:0 };
  T().setBoss(boss);
  P.vx = 5;
  a.fireGear();
  ok("기어 3 — 거대 주먹이 무적 중인 보스에게도 4 피해", boss.hp === 4, "hp=" + boss.hp);
  ok("기어 3 — 범위 안의 갈매기도 격추", a.peek().gullKills >= 1, "격추=" + a.peek().gullKills);
  ok("기어 3은 즉발이라 강화(방어·무적)가 걸리지 않는다", a.gearInfo().buff === null);
  a.gearSel(2);
}
{
  // 기어 4 — 공중에서 ↑를 누르면 부스터로 치솟는다
  const a = start();
  a.gearSel(4, true);
  T().setGear(230);
  a.fireGear();
  a.hold(false);
  const P = T().P(); P.y = 250; P.vy = 0;
  a.keys.up = true;
  run(a, 20, () => { a.hold(false); });
  a.keys.up = false;
  ok("기어 4 — 공중 부스터로 떠오른다", T().P().y < 250 - 20, "y 250→" + Math.round(T().P().y));
  a.gearSel(2);
}
{
  // 해금 — 보물로 순서대로
  const a = A(), sh = a.shop;
  sh().setBank(100000);
  a.gearSel(2);
  T().setGearUnlocked(2);        // 앞선 검사에서 풀린 기어를 다시 잠근다
  a.selectGear(4);
  ok("기어는 순서대로만 해금된다(3 전에 4 불가)", a.gearInfo().unlocked === 2);
  a.selectGear(3);
  ok("보물 3000으로 기어 3 해금·선택", a.gearInfo().unlocked === 3 && a.gearInfo().sel === 3 && sh().bank === 97000, "창고=" + sh().bank);
  a.selectGear(2);
  ok("해금한 기어끼리는 자유롭게 고른다", a.gearInfo().sel === 2 && sh().bank === 97000);
  sh().setBank(0);
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
  A().parrot().setOn(false);     // 앵무새가 아치 금화를 먼저 물어 가면 판정이 흔들린다
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
    const before = a.peek().arcsDone;    // 봇이 준비 중에 스스로 한 줄을 완성했을 수도 있다
    for(const c of mine){ P.vx = 0; P.vy = 0; c.x = P.x; c.y = P.y; H.step(); }
    done = a.peek().arcsDone === before + 1;
  }
  ok("금화 줄을 전부 먹으면 완성 보너스", found && done, "아치발견=" + found);
  A().parrot().setOn(true);
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

/* --- 리뷰에서 나온 버그 회귀 방지 --- */
{
  // 기어 2가 끝나는 순간 최고 속도 초과분 때문에 불꽃이 공짜로 붙지 않아야 한다
  const a = start();
  T().setGear(100); a.fireGear();
  const P = T().P();
  a.hold(false);
  // 기어 동안엔 높은 곳에서 최고 속도 이상으로 날게 한다
  for(let i = 0; i < 400 && a.peek().gearT > 0; i++){ P.vx = 30; P.vy = -1; P.y = 150; H.step(); }
  let fireSeen = false;
  for(let i = 0; i < 3; i++){ H.step(); if(a.peek().fire > 0) fireSeen = true; }
  ok("기어가 끝나도 불꽃이 공짜로 붙지 않는다", a.peek().gearT <= 0 && !fireSeen, "불꽃=" + fireSeen);
}
{
  // 오늘의 항해는 날씨도 같은 자리·같은 종류
  const a = A();
  const seen = [];
  for(let k = 0; k < 2; k++){
    a.startDaily(); H.step();
    T().setNextWeather(5);   // 시작 지점만 당겨서 빨리 보고, 종류는 시드 그대로
    a.hold(true); H.step(); a.hold(false);
    let type = null;
    run(a, 1500, (st) => { swing(a, st); if(!type && st.weather) type = st.weather.type; });
    seen.push(type);
  }
  ok("오늘의 항해는 날씨 종류도 같다", seen[0] && seen[0] === seen[1], seen.join(" / "));
  a.startMain();
}
{
  // 보스가 뜨면 날씨가 걷힌다
  const a = start();
  T().setNextWeather(0);
  run(a, 30, (st) => swing(a, st));
  const hadWeather = !!a.peek().weather;
  const P = T().P();
  T().setBoss({ type:0, big:false, hp:2, maxHp:2, t:0, fire:90, invul:0, flash:0, x:P.x + 400, y:200, vy:0,
                air:true, phase:0, sub:0, perch:null, tents:[], swing:0, sink:0, dive:0 });
  run(a, 3, (st) => swing(a, st));
  ok("보스가 뜨면 날씨가 걷힌다", hadWeather && !a.peek().weather, "날씨있었음=" + hadWeather);
}

/* --- 보스 컷인 · 격침 슬로모션 --- */
{
  const a = A();
  a.startPractice(0); H.step(); a.hold(true); H.step(); a.hold(false);
  let introSeen = false;
  run(a, 1200, (st) => { swing(a, st); if(st.bossIntro) introSeen = true; if(st.boss) {} });
  ok("보스가 나오면 등장 컷인이 뜬다", introSeen);
  const P = T().P();
  if(a.peek().boss){
    const b = a.peek().boss; b.hp = 1; b.invul = 0;
    T().dmg(true, "테스트");
    ok("보스를 격침하면 슬로모션이 걸린다", a.peek().slowT > 0 && !a.peek().boss, "slowT=" + a.peek().slowT);
  }
  a.startMain();
}

/* --- 고리 도둑 문어 (신규 중간보스, type 6) --- */
{
  const a = A();
  let seenType = null, grabbed = false, moved = 0, sucker = false;
  for(let attempt = 0; attempt < 4 && !(grabbed && moved > 30); attempt++){
    a.startPractice(6); H.step(); a.hold(true); H.step(); a.hold(false);
    run(a, 1500, (st) => {
      swing(a, st);
      const b = st.boss;
      if(b){
        seenType = b.type;
        if(b.grab){
          grabbed = true;
          if(b.grab.y0 === undefined) b.grab.y0 = b.grab.y;
          moved = Math.max(moved, Math.abs(b.grab.y - b.grab.y0));
          if(a.weak().some(w => w.mark === "빨판")) sucker = true;
        }
      }
    });
  }
  ok("고리 도둑 문어 연습 — 문어가 나온다", seenType === 6, "type=" + seenType);
  ok("문어가 앞쪽 고리를 붙잡아 끌고 간다", grabbed && moved > 30, "최대 이동=" + Math.round(moved) + "px");
  ok("고리를 붙잡은 동안엔 빨판도 약점이다", sucker);
  a.startMain();
}

/* --- 보스 재배치 속도 (빠른 플레이어를 못 따라잡아 거리가 멈추던 버그) --- */
{
  const a = A();
  const worst = {};
  for(const t of [0, 1, 4, 6]){
    a.startPractice(t); H.step(); a.hold(true); H.step(); a.hold(false);
    let streak = 0, maxStreak = 0;
    run(a, 2400, (st) => {
      swing(a, st);
      if(st.boss && st.boss.dive === 2){ streak++; maxStreak = Math.max(maxStreak, streak); } else streak = 0;
    });
    worst[t] = maxStreak;
  }
  ok("보스가 재배치 중에 오래 갇히지 않는다(플레이어보다 빨리 따라온다)", Object.values(worst).every(v => v < 200), JSON.stringify(worst));
  a.startMain();
}

/* --- 보스 보상 가중치 --- */
{
  const cnt = {};
  for(let i = 0; i < 6000; i++){ const r = T().pickReward(); cnt[r.id] = (cnt[r.id] || 0) + 1; }
  ok("즉시 보상 10종이 모두 나오고, 보호막은 보물 폭풍보다 드물다",
     Object.keys(cnt).length === 10 && cnt.shield < cnt.treasure * 0.6, JSON.stringify(cnt));
}

/* --- 보물섬 해역 --- */
{
  const a = start();
  T().teleport(1200 * 22 + 10);
  T().setFusen(2);
  const st = a.peek();
  run(a, 20, (s) => swing(a, s));
  const s = a.peek();
  const zoneMobs = s.mobs.concat(s.gulls).filter(m => m.x / 22 > 1205 && m.x / 22 < 1300).length;
  const arcCoins = s.coins.filter(c => c.arc && c.x / 22 > 1205 && c.x / 22 < 1300).length;
  ok("보물섬 해역에 들어가면 배너가 뜨고 잡몹 없이 금화 줄이 깔린다", s.bonusOn && zoneMobs === 0 && arcCoins >= 7,
     "bonusOn=" + s.bonusOn + " 잡몹=" + zoneMobs + " 아치금화=" + arcCoins);
}

/* --- 트램펄린 해파리 --- */
{
  const a = start();
  const P = T().P();
  a.hold(false);
  const st = a.peek();
  st.jellies.length = 0;
  st.jellies.push({ x:P.x + 4, base:P.y + 40, t:0, cd:0 });
  P.vx = 1; P.vy = 6;
  let up = false;
  run(a, 12, (s) => { if(s.vy < -8) up = true; });
  ok("해파리를 위에서 밟으면 튕겨 오른다", a.peek().bounces === 1 && up, "bounces=" + a.peek().bounces);
}
{
  const a = start();
  const P = T().P();
  a.hold(false);
  const st = a.peek();
  st.jellies.length = 0;
  st.jellies.push({ x:P.x + 30, base:P.y, t:0, cd:0 });
  P.vx = 10; P.vy = -0.3;
  let stunned = false;
  run(a, 6, (s) => { if(s.stun > 0) stunned = true; });
  ok("옆으로 부딪히면 튕기지 않고 스턴도 없다", a.peek().bounces === 0 && !stunned);
}

/* --- 보물 지도 조각 --- */
{
  const a = start();
  const M = a.map, sh = a.shop;
  M().set(3);
  const bank0 = sh().bank;
  const P = T().P();
  a.hold(false);
  const st = a.peek();
  st.mapItems.push({ x:P.x + 10, y:P.y, got:false });
  run(a, 2, () => { P.vx = 5; P.vy = 0; });
  ok("지도 조각을 주우면 판을 넘어 쌓인다", M().pieces === 4, "조각=" + M().pieces);
  a.peek().mapItems.push({ x:T().P().x + 10, y:T().P().y, got:false });
  run(a, 2, () => { P.vx = 5; P.vy = 0; });
  // 조각마다 창고 +400, 완성하면 +20000 — 4·5번째 조각을 주웠으니 400×2 + 20000
  ok("5조각을 모으면 지도 완성 — 창고에 보물", M().pieces === 0 && M().done >= 1 && sh().bank === bank0 + 20800,
     "조각=" + M().pieces + " 완성=" + M().done + " 창고 " + bank0 + "→" + sh().bank);
  sh().setBank(0); M().set(0);
}

/* --- 60초 보물 사냥 --- */
{
  const a = A();
  a.startBlitz(); H.step(); a.hold(true); H.step(); a.hold(false);
  ok("60초 사냥은 미션 없이 시작한다", a.peek().blitzMode && a.peek().missions.length === 0);
  const P = T().P();
  T().setFusen(0);
  const t0 = a.peek().blitzT;
  P.y = a.peek().SEA - 20; P.vy = 10;
  run(a, 3);
  ok("60초 사냥에선 바다에 빠져도 끝나지 않고 5초를 잃는다", a.peek().state === 1 && a.peek().blitzT < t0 - 290, "남은=" + Math.round(a.peek().blitzT));
  let bossSeen = false, s = null;
  // 봇이 가끔 제자리에 멈춰 '정체'로 끝나는 판이 있어서 몇 번 다시 해 본다
  for(let attempt = 0; attempt < 4; attempt++){
    if(attempt){ a.startBlitz(); H.step(); a.hold(true); H.step(); a.hold(false); }
    s = run(a, 4000, (st) => { swing(a, st); if(st.boss) bossSeen = true; });
    if(s.deathReason === "시간") break;
  }
  ok("60초가 지나면 끝나고 보스는 나오지 않는다", s.state === 2 && s.deathReason === "시간" && !bossSeen, "사인=" + s.deathReason);
  a.startMain();
}

/* --- 결과 공유 --- */
{
  const a = start();
  T().setTreasure(321);
  a.hold(false); T().setFusen(0); T().P().y = a.peek().SEA + 10;
  run(a, 3);
  const t = a.resultText();
  ok("결과 공유 문구에 모드·보물·현상금이 들어간다", /본게임/.test(t) && /보물 321/.test(t) && /현상금 ฿/.test(t), JSON.stringify(t.split("\n")[1]));
}

/* --- 문어가 끌고 가던 고리를 잡으면 놓아 준다 (리뷰에서 나온 버그) --- */
{
  const a = A();
  let released = null;
  for(let attempt = 0; attempt < 4 && released !== true; attempt++){
    a.startPractice(6); H.step(); a.hold(true); H.step(); a.hold(false);
    for(let f = 0; f < 1500; f++){
      const st = a.peek();
      if(st.state === 2) break;
      const b = st.boss;
      if(b && b.grab){
        // 붙잡힌 고리 바로 아래로 옮겨 놓고 그 고리를 잡는다
        const an = b.grab, P = T().P();
        P.x = an.x - 10; P.y = an.y + 80; P.vx = 0; P.vy = 0;
        a.hold(false);
        // 플레이어만 옮기면 보스가 뒤처진 걸로 보고 재배치하면서 고리를 놓아 버리니 보스도 옆에 둔다
        for(let k = 0; k < 12; k++){ b.x = P.x + 250; b.dive = 0; H.step(); }
        a.hold(true); H.step();
        const s2 = a.peek();
        // 끌기 시간이 넉넉히 남은 상태에서 잡았을 때만 판정 — 시간이 다 돼서 놓은 것과 구분
        if(s2.rope && s2.rope.a === an && s2.boss && (s2.boss.grab ? s2.boss.grabT > 40 : true)){
          const leftBefore = b.grabT;
          b.x = P.x + 250; b.dive = 0;
          H.step();
          if(leftBefore > 40) released = !(a.peek().boss && a.peek().boss.grab);
        }
        break;
      }
      swing(a, st);
      H.step();
    }
  }
  ok("끌려가는 고리를 잡으면 문어가 놓아 준다", released === true, "released=" + released);
  a.startMain();
}

/* --- 선장 레벨 --- */
{
  const a = start();
  const L = a.log();
  const xp0 = L.xp || 0;
  T().setTreasure(700);
  a.hold(false); T().setFusen(0); T().P().y = a.peek().SEA + 10;
  const s = run(a, 3);
  ok("판이 끝나면 보물+거리만큼 경험치가 쌓인다", L.xp === xp0 + 700 + Math.floor(s.dist), "xp " + xp0 + "→" + L.xp);
  const lv = a.level();
  ok("경험치로 레벨이 계산된다", lv.L >= 1 && lv.rest < lv.need, "Lv." + lv.L + " " + lv.rest + "/" + lv.need);
}

/* --- 보스 러시 --- */
{
  const a = A();
  let order = [], s = null, fishSeen = false;
  for(let attempt = 0; attempt < 3; attempt++){
    order = []; fishSeen = false;
    a.startRush(); H.step(); a.hold(true); H.step(); a.hold(false);
    T().setFusen(2);
    s = run(a, 9000, (st) => {
      if(st.mobs.length) fishSeen = true;
      if(st.boss){
        if(!st.boss._seen){ st.boss._seen = true; order.push(st.boss.type); }
        st.boss.hp = 1; st.boss.invul = 0; T().dmg(true, "테스트");
      } else { swing(a, st); T().setFusen(2); }
    });
    if(s.deathReason === "완주") break;
  }
  ok("보스 러시 — 해군 대장 군함까지 9연전을 순서대로 치르고 완주한다", s.deathReason === "완주" && order.join(",") === "0,1,3,4,2,6,5,7,8" && !fishSeen,
     "사인=" + s.deathReason + " 순서=" + order.join(","));
  a.startMain();
}

/* --- 코치 힌트 --- */
{
  const a = start();
  run(a, 200, (st) => swing(a, st));
  const h = a.hints();
  ok("처음 매달리면 그네 힌트가 뜨고 본 것으로 기록된다", h.seen.indexOf("swing") >= 0, "본 힌트=" + h.seen.join(","));
  const a2 = start();
  let shownAgain = false;
  run(a2, 200, (st) => { swing(a2, st); const n = a2.hints().now; if(n && /그네를 밀어/.test(n.text)) shownAgain = true; });
  ok("한 번 본 힌트는 다시 나오지 않는다", !shownAgain);
}

/* --- 포격 구간 --- */
{
  const a = start();
  T().teleport(300 * 22);     // 보스(500m)보다 앞 — 보스가 뜨면 포격이 걷힌다
  T().setFusen(2);
  T().setNextBarrage(0);
  let started = false, shellSeen = false;
  const s = run(a, 900, (st) => {
    swing(a, st); T().setFusen(2);
    if(st.barrage) started = true;
    if(st.shells.length) shellSeen = true;
  });
  ok("포격 구간이 시작되면 조준 표식과 포탄이 나온다", started && shellSeen, "시작=" + started + " 표식=" + shellSeen);
}
{
  // 표식 위에 가만히 있으면 착탄 때 휘청인다
  const a = start();
  const P = T().P();
  a.hold(false);
  a.peek().shells.push({ x:P.x, y:P.y, t:58, boom:false });
  let stunned = false;
  run(a, 8, (st) => { P.vx = 0; P.vy = 0; if(st.stun > 0) stunned = true; });
  ok("포탄이 떨어진 자리에 있으면 휘청인다", stunned);
}

/* --- 해역별 지형: 유빙 · 용암 분수 --- */
{
  const a = start();
  const P = T().P();
  a.hold(false); T().setFusen(0);
  a.peek().floes.push({ x:P.x + 5, t:0 });
  P.y = a.peek().SEA - 30; P.vy = 8; P.vx = 3;
  const s = run(a, 4);
  ok("유빙 위에 떨어지면 빠지지 않고 튕겨 오른다", s.state === 1 && s.floeSaves === 1 && s.vy < 0, "state=" + s.state + " saves=" + s.floeSaves);
}
{
  const a = start();
  const P = T().P();
  a.hold(false);
  a.peek().geysers.push({ x:P.x + 20, t:85, cyc:260 });
  let stunned = false;
  run(a, 10, (st) => { P.vx = 0; P.vy = 0; P.y = st.SEA - 120; if(st.stun > 0) stunned = true; });
  ok("분출 중인 용암 분수에 닿으면 휘청인다", stunned && a.peek().geyserHits >= 1, "hits=" + a.peek().geyserHits);
}

/* --- 최근 기록 그래프 --- */
{
  const a = start();
  const L = a.log();
  a.hold(false); T().setFusen(0); T().P().y = a.peek().SEA + 10;
  const s = run(a, 3);
  ok("판이 끝나면 최근 기록에 거리가 쌓인다(최대 20)", Array.isArray(L.recent) && L.recent[L.recent.length - 1] === Math.floor(s.dist) && L.recent.length <= 20,
     "recent=" + L.recent.slice(-3).join(","));
}

/* --- 고무고무 로켓 --- */
{
  let fired = false, vy = 0;
  for(let attempt = 0; attempt < 4 && !fired; attempt++){
    const a = start();
    run(a, 200, (st) => { a.hold(true); a.keys.right = false; });
    if(!a.peek().rope) continue;
    a.keys.down = true;
    run(a, 160, () => { a.hold(true); a.keys.down = true; });
    a.keys.down = false;
    const before = a.peek().rockets;
    if(!a.peek().rope) continue;
    a.hold(false);
    fired = a.peek().rockets === before + 1;
    vy = a.peek().vy;
  }
  ok("줄을 끝까지 감고 ↓를 계속 누르다 놓으면 고무고무 로켓", fired && vy < -5, "vy=" + vy.toFixed(1));
}
{
  const a = start();
  run(a, 200, (st) => { a.hold(true); });
  if(a.peek().rope){
    run(a, 10, () => { a.hold(true); a.keys.down = true; });   // 잠깐만 감으면 충전이 모자라다
    a.keys.down = false;
    const before = a.peek().rockets;
    a.hold(false);
    ok("충전이 모자라면 로켓이 나가지 않는다", a.peek().rockets === before);
  }
}

/* --- 세 번째 리뷰 회귀 방지 --- */
{
  // 로켓 충전이 끊긴 줄을 넘어 다음 고리로 이어지지 않는다
  const a = start();
  run(a, 200, () => a.hold(true));
  if(a.peek().rope){
    run(a, 160, () => { a.hold(true); a.keys.down = true; });
    a.keys.down = false;
    // 줄을 강제로 끊는다(과신장 등과 같은 효과) — 멀리 떨어뜨리면 REACH×1.7을 넘어 끊긴다
    T().P().x += 2000; H.step();
    const P = T().P();
    a.hold(false); for(let k = 0; k < 12; k++) H.step();
    a.hold(true); H.step();
    ok("줄이 다른 이유로 끊기면 로켓 충전이 다음 고리로 넘어가지 않는다", !a.peek().rope || a.peek().rocketCharge < 30, "충전=" + a.peek().rocketCharge.toFixed(0));
  }
}
{
  // 기어 2로 막은 포탄은 무피해 도전을 깨지 않는다
  const a = start();
  T().setNextBarrage(0); a.gearSel(5, true); T().setGear(400); a.fireGear();
  run(a, 60, (st) => swing(a, st));
  const P = T().P();
  if(a.peek().barrage){
    a.peek().shells.push({ x:P.x, y:P.y, t:60, boom:false });
    run(a, 3, () => { P.vx = 0; P.vy = 0; });
    ok("기어 5로 막은 포탄은 무피해 도전을 깨지 않는다", a.peek().barrage && !a.peek().barrage.hit);
  } else ok("기어 5로 막은 포탄은 무피해 도전을 깨지 않는다", false, "포격이 시작되지 않음");
}

/* --- 설정 --- */
{
  const a = start();
  a.settings.shake = false;
  a.fireGun();
  ok("화면 흔들림을 끄면 근거리 기술(채찍)을 쏴도 흔들리지 않는다", a.peek().shakeT === 0);
  a.settings.shake = true;
  const b = start();
  b.fireGun();
  ok("켜 두면 흔들린다", b.peek().shakeT > 0);
}

/* --- 망령의 유령선 (대형, type 7) --- */
{
  const a = start();
  const P = T().P();
  const mk = () => ({ type:7, big:true, hp:8, maxHp:8, t:0, fire:80, summon:90, walk:0, invul:0, flash:0,
                      x:P.x + 330, y:a.peek().SEA - 14, vy:0, air:false, phase:0, sub:190, perch:null, tents:[], swing:0, sink:0, dive:0 });
  const b = mk();
  T().setBoss(b);
  ok("유령선은 실체일 때 등불·선장이 약점", T().wp(b).map(w => w.mark).join(",") === "등불,선장");
  b.phase = 1;
  ok("유령 상태에선 약점이 없다(무적)", T().wp(b).length === 0);
  // 유령 상태에선 유령 갈매기를 부른다
  b.summon = 1; b.sub = 100;
  const g0 = a.peek().gulls.length;
  run(a, 3, (st) => swing(a, st));
  ok("유령 상태에선 유령 갈매기를 부른다", a.peek().gulls.some(g => g.ghost), "갈매기 " + g0 + "→" + a.peek().gulls.length);
  // 유령 상태에선 표식 뒤 망령 사슬을 내리꽂는다 — 맞으면 크라켄급 스턴(42)
  b.fire = 1; b.sub = 100; b.chains = [];
  run(a, 3, (st) => swing(a, st));
  ok("유령 상태에선 망령 사슬 표식을 띄운다", b.chains.length > 0 && b.chains[0].drop === 0);
  b.chains = [{ x:P.x, t:40, warn:40, life:95, drop:1 }]; b.fire = 999;
  a.peek().stun = 0;
  let maxStun = 0;
  run(a, 4, (st) => { if(st.stun > maxStun) maxStun = st.stun; });
  ok("망령 사슬에 닿으면 스턴 42", maxStun > 30 && maxStun <= 42, "최대 스턴=" + maxStun.toFixed(1));
  b.chains = [];
  // 맞으면 유령으로 숨는다, 격침해도 크라켄 누적은 오르지 않는다
  const ks = T().lifeStats().kraken;
  b.phase = 0; b.invul = 0; b.hp = 2;
  T().dmg(true, "t");
  ok("맞으면 유령 상태로 숨는다", b.phase === 1);
  b.invul = 0; T().dmg(true, "t");
  ok("유령선 격침은 크라켄 누적에 들어가지 않는다", !a.peek().boss && T().lifeStats().kraken === ks);
}
{
  // 대형 슬롯(2000m마다)은 크라켄·유령선이 같은 확률로
  start();
  const n = { 5:0, 7:0 };
  for(let k = 0; k < 400; k++){ const ty = T().spawnBig(); n[ty] = (n[ty] || 0) + 1; }
  ok("크라켄 촉수 스턴은 해왕류와 같은 60", T().hit(true) === 60 && T().hit("chain") === 42, "촉수=" + T().hit(true) + " 사슬=" + T().hit("chain"));
  ok("대형 보스는 크라켄·유령선이 반반 확률", n[5] + n[7] === 400 && n[5] > 160 && n[7] > 160, "크라켄 " + n[5] + " · 유령선 " + n[7]);
}

/* --- 유령선 연습 --- */
{
  const a = A();
  a.startPractice(7); H.step(); a.hold(true); H.step(); a.hold(false);
  let t = null;
  run(a, 600, (st) => { swing(a, st); if(st.boss) t = st.boss.type; });
  ok("유령선 연습 — 유령선이 대형 보스로 나온다", t === 7, "type=" + t);
  a.startMain();
}

/* --- 항해 등급 --- */
{
  const a = start();
  T().setTreasure(5000);
  a.hold(false); T().setFusen(0); T().P().y = a.peek().SEA + 10;
  let s = run(a, 3);
  ok("짧게 끝난 판은 보물이 많아도 A 이상을 안 준다", s.runGrade && s.runGrade[0] === "B", "등급=" + (s.runGrade && s.runGrade[0]));
  const b = start();
  T().teleport(300 * 22);
  T().setTreasure(300 * 7);
  b.hold(false); T().setFusen(0); T().P().y = b.peek().SEA + 10;
  s = run(b, 3);
  ok("300m에 보물 2100이면 S", s.runGrade && s.runGrade[0] === "S", "등급=" + (s.runGrade && s.runGrade[0]) + " 거리=" + Math.floor(s.dist));
}

/* --- 칭호 보상 스킨 --- */
{
  const sh = A().shop;
  const U = T().titles();
  const had = U.has("kraken1");
  U.delete("kraken1");
  ok("칭호가 없으면 칭호 보상 스킨은 잠겨 있다", sh().pickSkin(4) === false && sh().skin !== "kraken");
  U.add("kraken1");
  ok("칭호를 따면 칭호 보상 스킨을 공짜로 장착한다", sh().pickSkin(4) === true && sh().skin === "kraken");
  if(!had) U.delete("kraken1");
  sh().pickSkin(0);
}

/* --- 보물로 부활 --- */
{
  const a = start();
  const sh = a.shop;
  sh().setBank(800);
  a.hold(false); T().setFusen(0);
  T().P().y = a.peek().SEA + 10;
  H.step();
  ok("창고 보물이 있으면 바다에 빠질 때 부활을 묻는다", a.peek().state === 9);
  a.revive();
  const s1 = a.peek();
  ok("부활하면 보물 500을 쓰고 튕겨 올라 이어 간다", s1.state === 1 && s1.vy < 0 && sh().bank === 300, "창고=" + sh().bank);
  T().P().y = a.peek().SEA + 10;
  for(let k = 0; k < 3; k++) H.step();
  ok("부활은 판당 한 번뿐", a.peek().state === 2, "state=" + a.peek().state);
  sh().setBank(0);
}
{
  const a = A();
  a.shop().setBank(800);
  a.startDaily(); H.step(); a.hold(true); H.step(); a.hold(false);
  T().setFusen(0); T().P().y = a.peek().SEA + 10;
  for(let k = 0; k < 3; k++) H.step();
  ok("오늘의 항해에선 부활이 없다", a.peek().state === 2);
  a.shop().setBank(0);
  a.startMain();
}

/* --- 오늘의 항해 연속 출석 --- */
{
  const a = A();
  const d = new Date(); d.setDate(d.getDate() - 1);
  const y = d.getFullYear() + "-" + String(d.getMonth()+1).padStart(2,"0") + "-" + String(d.getDate()).padStart(2,"0");
  a.streak().set(y, 2);
  const bank0 = a.shop().bank;
  a.startDaily(); H.step(); a.hold(true); H.step(); a.hold(false);
  T().setFusen(0); T().P().y = a.peek().SEA + 10;
  run(a, 3);
  ok("어제까지 2일 연속이면 오늘 첫 판에 3일 연속·보물 +300", a.streak().n === 3 && a.shop().bank - bank0 >= 300 && a.streak().reward === 300,
     "연속=" + a.streak().n + " 보상=" + a.streak().reward);
  a.startDaily(); H.step(); a.hold(true); H.step(); a.hold(false);
  T().setFusen(0); T().P().y = a.peek().SEA + 10;
  run(a, 3);
  ok("같은 날 두 번째 판엔 보상이 없다", a.streak().n === 3 && a.streak().reward === 0);
  a.streak().set("", 0);
  a.startMain();
}

/* --- 네 번째 리뷰 회귀 방지 --- */
{
  // 첫 판이 D여도 최고 등급으로 저장된다
  T().setBestGrade("");
  const a = start();
  a.hold(false); T().setFusen(0); T().setTreasure(0);
  T().P().y = a.peek().SEA + 10;
  const s = run(a, 3);
  ok("첫 판이 D 등급이어도 최고 등급으로 기록된다", s.runGrade && s.runGrade[0] === "D" && a.shop().grade === "D", "최고=" + a.shop().grade);
}
{
  // 유령 상태 유령선은 근거리 기술(채찍)에도 안 맞는다
  const a = start();
  const P = T().P();
  const b = { type:7, big:true, hp:8, maxHp:8, t:0, fire:80, summon:90, walk:0, invul:0, flash:0,
              x:P.x + 200, y:P.y, vy:0, air:false, phase:1, sub:100, perch:null, tents:[], swing:0, sink:0, dive:0 };
  T().setBoss(b);
  a.fireGun();
  ok("유령 상태 유령선은 근거리 기술(채찍)에도 무적", b.hp === 8, "hp=" + b.hp);
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

/* --- 칭호 고르기 --- */
{
  const a = start();
  const U = T().titles();
  const saved = [...U];
  U.clear(); U.add("novice"); U.add("hunter");
  ok("칭호를 고르지 않으면(자동) 딴 것 중 가장 높은 칭호", a.title().name === "현상금 사냥꾼" && a.title().sel === null, a.title().name);
  ok("딴 칭호는 골라서 달 수 있다", a.title().pick("novice") === true && a.title().name === "풋내기 사냥꾼", a.title().name);
  ok("못 딴 칭호는 고를 수 없다", a.title().pick("kraken10") === false && a.title().name === "풋내기 사냥꾼");
  a.title().pick(null);
  ok("자동으로 되돌리면 다시 가장 높은 칭호", a.title().name === "현상금 사냥꾼" && a.title().sel === null);
  U.clear(); saved.forEach(t => U.add(t));
}

/* --- 예측 조준 --- */
{
  const a = start();
  const s = a.peek(), P = T().P();
  s.mobs.length = 0; s.gulls.length = 0; s.barrels.length = 0;
  s.gulls.push({ x:P.x + 520, y:P.y - 40, base:P.y - 40, vx:-6, t:0, gone:false });
  const g = s.gulls[0];
  const aim = a.tech().aim(33, 860);
  ok("움직이는 목표는 날아가는 동안 올 자리를 노린다(예측 조준)", aim && aim.x < g.x - 40, "목표 x=" + Math.round(g.x) + " 조준 x=" + (aim && Math.round(aim.x)));
  a.fire();
  let hit = false;
  run(a, 40, () => { if(g.gone) hit = true; P.vx = 0; P.vy = 0; });
  ok("피스톨이 다가오는 갈매기를 맞힌다", hit);
}
{
  const a = start();
  const s = a.peek(), P = T().P();
  s.mobs.length = 0; s.gulls.length = 0; s.barrels.length = 0;
  P.vx = 0; P.vy = 0;
  s.mobs.push({ kind:0, x:P.x + 380, y:P.y + 40, vy:-8, air:true, t:0, cool:0, gone:false });
  a.fire();
  let hit = false;
  run(a, 30, (st) => { if(!st.mobs.some(m => m.kind === 0)) hit = true; P.vx = 0; P.vy = 0; });
  ok("피스톨이 포물선으로 뛰어오르는 물고기를 맞힌다", hit);
}
{
  // 예전 기간트 피스톨은 정면 250px 고정이라 이 해왕류는 빗나갔다
  const a = start();
  a.gearSel(3, true);
  const s = a.peek(), P = T().P();
  s.mobs.length = 0; s.gulls.length = 0; s.barrels.length = 0;
  s.mobs.push({ kind:1, x:P.x + 540, y:s.SEA, phase:3, t:0, h:200, gone:false });
  T().setGear(999);
  a.fireGear();
  const g = a.gearInfo().giant;
  ok("기어 3 거대 주먹이 목표 쪽으로 조준된다", g && Math.abs(g.cx - (P.x + 540)) < 120, g ? "주먹 x=" + Math.round(g.cx - P.x) : "없음");
  ok("조준한 해왕류를 거대 주먹이 쓰러뜨린다", !a.peek().mobs.some(m => m.kind === 1 && !m.gone));
  a.gearSel(2);
}

/* --- 기술 뽑기 --- */
{
  const a = start(), sh = a.shop, tc = a.tech;
  const savedLv = Object.assign({}, tc().lv), savedM = Object.assign({}, tc().mats);
  for(const k of Object.keys(tc().lv)) delete tc().lv[k];
  tc().lv.pistol = 1; tc().lv.whip = 1;
  tc().mats.melee = 0; tc().mats.ranged = 0; tc().mats.gear = 0;
  sh().setBank(500);
  ok("보물이 모자라면 팩을 못 산다", tc().open("melee") === null && sh().bank === 500);
  sh().setBank(10000);
  const r1 = tc().open("melee", () => 0);
  ok("팩에서 새 기술을 뽑는다", r1.kind === "tech" && tc().lv[r1.id] === 1 && sh().bank === 8800, r1.id + " 창고=" + sh().bank);
  const r2 = tc().open("melee", () => 0);
  ok("가진 기술이 또 나오면 비급으로 바뀐다", r2.kind === "dup" && tc().mats.melee === 4, "근거리 비급=" + tc().mats.melee);
  const r3 = tc().open("melee", () => 0.5);
  ok("기술이 아니면 비급 2~4개", r3.kind === "mat" && tc().mats.melee === 7, "근거리 비급=" + tc().mats.melee);
  ok("기본 기술(채찍·피스톨)은 팩에서 나오지 않는다", ["whip", "pistol"].indexOf(r1.id) < 0);
  const cd1 = (tc().equip(r1.id), tc().meleeCd);
  ok("뽑은 기술을 W에 장착한다", tc().eqM === r1.id);
  ok("비급으로 기술을 강화하면 재충전이 짧아진다", tc().up(r1.id) === true && tc().lv[r1.id] === 2 && tc().mats.melee === 4 && tc().meleeCd < cd1,
     "Lv=" + tc().lv[r1.id] + " 비급=" + tc().mats.melee + " 쿨 " + Math.round(cd1) + "→" + Math.round(tc().meleeCd));
  ok("없는 기술은 장착·강화할 수 없다", tc().equip("gatling") === false && tc().up("gatling") === false);
  // 특성 — 예열: 출항하면 게이지가 차 있다
  tc().set("gstart", 5);
  (a.reset)(); H.step(); a.hold(true); H.step(); a.hold(false);
  ok("특성 '예열'은 출항할 때 게이지를 채워 둔다", a.peek().gear >= a.gearInfo().max * 0.59, "게이지=" + Math.round(a.peek().gear) + "/" + a.gearInfo().max);
  for(const k of Object.keys(tc().lv)) delete tc().lv[k];
  Object.assign(tc().lv, savedLv); Object.assign(tc().mats, savedM);
  tc().equip("whip"); tc().equip("pistol");
  sh().setBank(0);
}
{
  // 창고 → 기술 뽑기 → 기술 목록, 숫자 키와 같은 줄 배열
  const a = A();
  a.shopPage(2);
  ok("기술 뽑기 화면에 팩 세 개가 있다", a.rows().filter(r => /팩 — 보물/.test(r.label)).length === 3);
  a.shopPage(3);
  ok("기술 목록 화면에 장착 3줄·강화 3줄", a.rows().filter(r => /^[1-3]\) /.test(r.label)).length === 3 && a.rows().filter(r => /^[4-6]\) 강화/.test(r.label)).length === 3);
  a.toMenu();
}

/* --- 근거리·원거리 기술 동작 --- */
{
  const a = start(), tc = a.tech;
  tc().set("axe", 1); tc().equip("axe");
  const s = a.peek(), P = T().P();
  s.mobs.length = 0;
  s.mobs.push({ kind:1, x:P.x + 60, y:s.SEA, phase:3, t:0, h:150, gone:false });
  const tr0 = s.treasure;
  a.fireGun();
  ok("도끼가 발밑의 해왕류를 내리찍는다", !a.peek().mobs.some(m => m.kind === 1 && !m.gone) && a.peek().gun.kind === "axe");
  ok("해왕류 처치 보상은 600", a.peek().treasure - tr0 === 600, "+" + (a.peek().treasure - tr0));
  tc().equip("whip"); delete tc().lv.axe;
}
{
  const a = start(), tc = a.tech;
  tc().set("gatling", 1); tc().equip("gatling");
  const s = a.peek(), P = T().P();
  s.mobs.length = 0; s.gulls.length = 0; s.barrels.length = 0;
  for(const dx of [160, 260, 360]) s.gulls.push({ x:P.x + dx, y:P.y - dx*0.1, base:P.y - dx*0.1, vx:0, t:0, gone:false });
  a.fire();
  ok("개틀링이 부채꼴 안의 갈매기를 한꺼번에 떨어뜨린다", a.peek().gulls.every(g => g.gone) && !!tc().volley, "격추=" + a.peek().gullKills);
  ok("개틀링은 주먹을 남기지 않고 바로 재충전에 들어간다", !a.peek().fist && a.peek().skillCd > 400, "쿨=" + Math.round(a.peek().skillCd));
  tc().equip("pistol"); delete tc().lv.gatling;
}
{
  const a = start(), tc = a.tech;
  tc().set("rifle", 1); tc().equip("rifle");
  const s = a.peek(), P = T().P();
  s.mobs.length = 0; s.gulls.length = 0; s.barrels.length = 0;
  P.vx = 0; P.vy = 0;
  const h = s.SEA - 26 - P.y;
  s.mobs.push({ kind:1, x:P.x + 300, y:s.SEA, phase:3, t:0, h, gone:false });
  s.mobs.push({ kind:1, x:P.x + 650, y:s.SEA, phase:3, t:0, h, gone:false });
  a.fire();
  run(a, 40, () => { P.vx = 0; P.vy = 0; });
  ok("라이플은 꿰뚫고 날아가 해왕류 둘을 한 번에", !a.peek().mobs.some(m => m.kind === 1 && !m.gone), "남은 해왕류=" + a.peek().mobs.filter(m => m.kind === 1 && !m.gone).length);
  tc().equip("pistol"); delete tc().lv.rifle;
}

/* --- v36: 보상 카드 · 새총 · 선원 · 해군 추격 · 항구 --- */
const mkBoss = (P) => ({ type:0, big:false, hp:1, maxHp:1, t:0, fire:90, harpoon:70, fishSkill:200,
                         invul:0, flash:0, x:P.x+50, y:P.y, vy:0, air:false, phase:0, sub:0,
                         perch:null, perch2:null, tents:[], swing:0, sink:0, dive:0 });
{
  const a = start();
  T().setBoss(mkBoss(T().P()));
  T().dmg(true, "test");
  ok("격침 직후(슬로모션 중)엔 아직 카드가 안 뜬다", a.peek().state === 1 && a.pick2().pending);
  for(let i=0;i<120 && a.peek().state !== 10;i++) H.step();
  const offer = a.pick2().offer || [];
  ok("슬로모션이 끝나면 보상 카드 3장이 뜨고 강화가 적어도 한 장", a.peek().state === 10 && offer.length === 3 && offer.some(c => c.perk),
     "state=" + a.peek().state + " 카드=" + offer.map(c => c.perk ? c.perk.id : c.reward.id).join(","));
  const pi = offer.findIndex(c => c.perk), id = offer[pi].perk.id;
  a.hold(true); a.hold(false);                       // 카드 화면에서 팔 버튼은 아무 일도 안 한다
  ok("카드 화면에선 팔 조작이 먹지 않는다", a.peek().state === 10);
  a.pickCard(pi);
  ok("강화 카드를 고르면 이번 판 강화가 쌓이고 게임이 이어진다", a.peek().state === 1 && a.pick2().perks[id] === 1, id);
  a.reset();
  ok("새 판을 시작하면 강화가 사라진다", Object.keys(a.pick2().perks).length === 0);
}
{
  const a = start();
  const r0 = a.shop().reach;
  a.pick2().perks.long = 2;
  ok("늘어나는 팔 ×2 — 팔 길이 +16%", Math.abs(a.shop().reach / r0 - 1.16) < 0.001, r0 + "→" + a.shop().reach);
  const s0 = T().hit(false);
  a.pick2().perks.tough = 2;
  ok("질긴 고무 ×2 — 휘청 시간 40% 줄어든다", Math.abs(T().hit(false) - s0 * 0.6) < 0.01, s0 + "→" + T().hit(false));
  a.reset();
}
{
  const a = A();
  a.startPractice(0); H.step(); a.hold(true); H.step(); a.hold(false);
  T().setBoss(mkBoss(T().P()));
  T().dmg(true, "test");
  run(a, 100);
  ok("연습 모드는 카드 없이 예전처럼 바로 보상", a.peek().state !== 10 && !a.pick2().pending);
  a.startMain();
}
{
  // 새총 — 매달린 고리 앞쪽에 고리가 하나 더 닿으면
  const a = start();
  T().teleport(3000);
  const P = T().P(), an = T().anchors();
  an.length = 0;
  const a1 = { x: P.x + 40, y: 120, kind:0 }, a2 = { x: P.x + 220, y: 130, kind:0 };
  an.push(a1, a2);
  P.y = 230; P.vx = 0; P.vy = 0;
  a.hold(true);
  for(let i=0;i<14 && !a.peek().rope;i++){ P.vx = 0; H.step(); }
  ok("새총 준비: 첫 고리에 매달려 있다", a.peek().rope && a.peek().rope.a === a1);
  ok("앞쪽 고리가 새총 대상으로 잡힌다", a.sling().target === a2);
  a.slingStart();
  for(let i=0;i<6;i++) H.step();
  a.slingFire();
  ok("덜 당기고 놓으면 그냥 그네로 돌아간다", a.peek().rope && a.sling().n === 0);
  a.slingStart();
  const y0 = P.y;
  for(let i=0;i<60;i++) H.step();
  ok("당기는 동안 몸이 뒤쪽 아래로 끌려간다", P.y > y0 + 20 && P.x < (a1.x + a2.x)/2, "y " + y0.toFixed(0) + "→" + P.y.toFixed(0));
  a.slingFire();
  const s = a.peek();
  ok("놓으면 두 고리 사이로 앞·위로 튀어 나간다", !s.rope && s.vx > 12 && s.vy < -6 && a.sling().n === 1, "vx=" + s.vx.toFixed(1) + " vy=" + s.vy.toFixed(1));
  ok("최고 속도를 넘지 않아 불꽃이 공짜로 붙지 않는다", Math.hypot(s.vx, s.vy) < 27);
  ok("쏜 뒤엔 재충전 30초", Math.round(a.sling().cd) === 1800 && !a.slingStart(), "cd=" + a.sling().cd);
  a.hold(false);
}
{
  // 선원
  const a = A(), sh = a.shop(), cr = a.crew;
  sh.setBank(5000);
  ok("선원은 비싸다 — 보물 5000으로는 요리사(120000)도 못 쓴다", !cr().hire(0) && cr().owned.indexOf("cook") < 0);
  sh.setBank(500000);
  cr().hire(0);
  ok("요리사 고용 — 보물이 빠지고 바로 동행", cr().owned.indexOf("cook") >= 0 && cr().sel === "cook" && a.shop().bank === 380000);
  ok("가진 선원을 다시 누르면 혼자 출항", cr().hire(0) && cr().sel === null);
  cr().set("cook");
  start();
  ok("요리사와 출항하면 풍선 하나를 들고 간다", a.peek().fusen >= 1);
  cr().set("sword");
  let b = start();
  T().teleport(3000);
  const P = T().P(), s = b.peek();
  s.mobs.length = 0; s.gulls.length = 0;
  s.mobs.push({ kind:0, x:P.x + 90, y:P.y + 20, vy:-3, t:0, gone:false, air:true, cool:0 });
  cr().mate.cd = 0;
  run(b, 6);
  ok("검객이 곁의 물고기를 벤다", s.mobs[0].gone && cr().kills >= 1, "kills=" + cr().kills);
  cr().set("sniper");
  b = start();
  T().teleport(3000);
  const s2 = b.peek(), P2 = T().P();
  s2.gulls.length = 0; s2.mobs.length = 0; s2.barrels.length = 0;
  s2.gulls.push({ x:P2.x + 400, y:P2.y - 30, vx:0, vy:0, t:0, gone:false, base:P2.y - 30 });
  cr().mate.cd = 0;
  run(b, 6);
  ok("저격수가 앞쪽 갈매기를 쏜다", s2.gulls.length === 0 || s2.gulls[0].gone);
  cr().set(null);
}
{
  // 해군 추격
  const a = start();
  T().teleport(400 * 22);                 // 첫 보스(500m)·포격(850m~) 전
  a.navy().setNext(0);
  H.step();
  const n = a.navy().n;
  ok("추격 거리가 되면 해군 군함이 나타난다", !!n);
  T().setShield(3);
  n.x = T().P().x - 50;
  H.step();
  const s = a.peek();
  ok("해군에게 따라잡히면 보호막이 있어도 그대로 게임오버", s.state === 2 && s.deathReason === "해군", "state=" + s.state + " 사인=" + s.deathReason);
}
{
  const a = start();
  T().teleport(400 * 22);
  a.pick2().perks.undying = 1;
  a.navy().setNext(0); H.step();
  a.navy().n.x = T().P().x - 50; H.step();
  ok("희귀 강화 '불사의 고무'는 해군에게 잡혀도 한 번 버틴다", a.peek().state === 1 && !a.navy().n);
  const P = T().P(); P.y = a.peek().SEA + 5; P.vy = 3; T().setFusen(0);
  run(a, 3);
  ok("…두 번째는 버티지 못한다", a.peek().state === 2);
}
{
  const a = start();
  T().teleport(400 * 22);
  a.navy().setNext(0); H.step();
  const n2 = a.navy().n;
  n2.t = 720; n2.x = T().P().x - 900;
  const tr = a.peek().treasure, esc = a.navy().esc;
  H.step();
  ok("12초를 버티면 따돌리고 현상금 +300", !a.navy().n && a.navy().esc === esc + 1 && a.peek().treasure >= tr + 300, "navy=" + !!a.navy().n + " esc=" + esc + "→" + a.navy().esc + " 보물 " + tr + "→" + a.peek().treasure + " state=" + a.peek().state + " boss=" + !!a.peek().boss);
}
{
  // 항구
  const a = start();
  const portX = 900 * 22;
  T().teleport(portX - 300);
  T().setBoss(null);
  let port = T().anchors().find(q => q.port);
  for(let i=0;i<5 && !port;i++){ T().teleport(portX - 300 + i*200); port = T().anchors().find(q => q.port); }
  ok("900m 근처에 항구 돛대가 생긴다", !!port, port ? Math.round(port.x/22) + "m" : "");
  if(port){
    const an = T().anchors(); an.length = 0; an.push(port);
    port.cut = 0;                          // 지우기 전 '밧줄 끊는 자'가 끊어 둔 표시가 남아 있을 수 있다
    const P = T().P(); P.x = port.x - 60; P.y = port.y + 140; P.vx = 0; P.vy = 0;
    a.hold(true);
    // 팔 재사용 대기·휘청이 끝날 때까지 돛대 아래에 붙잡아 둔다
    for(let i=0;i<90 && a.peek().state === 1;i++){ T().setBoss(null); port.cut = 0; P.x = port.x - 60; P.y = port.y + 140; P.vx = 0; P.vy = 0; H.step(); }
    ok("항구 돛대를 잡으면 정박한다", a.peek().state === 11 && a.port().idx === 1, "state=" + a.peek().state);
    T().setTreasure(1000);
    a.shop().setBank(999999);
    ok("항구 값은 10배 — 이번 판 보물 1000으론 보호막(2200)을 못 산다(창고 보물은 안 쓴다)", !a.port().act(2) && a.peek().shield === 0);
    T().setTreasure(10000);
    a.port().act(2);
    ok("보호막을 사면 이번 판 보물이 줄고 보호막이 생긴다", a.peek().shield === 1 && a.peek().treasure === 7800, "보물=" + a.peek().treasure);
    ok("같은 항구에서 같은 걸 두 번 못 산다", !a.port().act(2));
    a.port().act(4);
    ok("강화 카드를 사면 강화만 3장이 뜨고, 고르면 항구로 돌아온다", a.peek().state === 10 && a.pick2().offer.every(c => c.perk) && a.pick2().back === 11);
    a.pickCard(0);
    ok("…항구 화면으로 복귀", a.peek().state === 11);
    ok("항구 한 곳에선 2개까지만 산다", !a.port().act(3) && a.peek().treasure === 3800, "보물=" + a.peek().treasure);
    a.port().leave();
    ok("출항하면 게임이 이어진다", a.peek().state === 1);
    ok("다음 항구는 1500m 뒤", Math.round(a.port().next) === 2400);
    a.hold(false);
  }
}

/* --- v38: 미니게임 · 주간 해류 · 선원 레벨 --- */
{
  const a = A();
  a.toMenu();
  const row0 = a.rows().find(r => r.key === 0);
  ok("메뉴 0번은 미니게임", !!row0 && /미니게임/.test(row0.label));
  row0.action();
  ok("미니게임 목록 화면(state 12)에 세 가지", a.peek().state === 12 && a.rows().filter(r => /^[1-3]\) /.test(r.label)).length === 3);

  // 1) 해파리 트램펄린
  const M = a.mini();
  M.start("jelly");
  ok("트램펄린을 고르면 미니게임 화면(state 13)·준비 단계", a.peek().state === 13 && a.mini().m.phase === "ready");
  M.down(); H.step(); M.up();
  ok("누르면 시작", a.mini().m.phase === "play");
  let m = a.mini().m, bounced = false;
  for(let i=0;i<120;i++){ H.step(); if(m.p.vy < -8) bounced = true; }
  ok("가만히 있어도 바닥 해파리에서 튕긴다", bounced && m.phase === "play");
  // 슈퍼 점프 — 착지 직전에 누르면 더 높이
  for(let i=0;i<200 && !(m.p.vy > 0 && m.js[0].y - 24 - m.p.y < m.p.vy * 4 && m.js[0].y - 24 - m.p.y > 0);i++) H.step();
  M.down(); M.up();
  let topV = 0;
  for(let i=0;i<10;i++){ H.step(); topV = Math.min(topV, m.p.vy); }
  ok("착지 직전에 누르면 슈퍼 점프", m.supers >= 1 && topV < -13, "supers=" + m.supers + " vy=" + topV.toFixed(1));
  // 전기 해파리 — 감전되면 조작 불능 잠깐
  m.js.push({ x: m.p.x, y: m.p.y + 40, r: 32, type: 2, vx: 0, t: 0, sq: 0 });
  m.p.vy = 4;
  for(let i=0;i<12;i++) H.step();
  ok("전기 해파리를 밟으면 감전(조작 불능)", m.stunT > 0);
  // 화면 아래로 떨어지면 끝 + 보물 창고 적립
  const bank0 = a.shop().bank;
  m.js.length = 0; m.nextY = -1e9; m.cy = -2000; m.p.y = -1900; m.p.vy = 5; m.top = -1900;
  for(let i=0;i<200 && m.phase === "play";i++) H.step();
  ok("떨어지면 결과 화면", m.phase === "over");
  ok("점수에 따라 창고 보물이 쌓이고 최고 기록이 남는다", a.shop().bank > bank0 && a.mini().best.jelly === Math.floor(m.score) && m.score >= 100,
     "점수=" + m.score + " 보상=" + m.reward);
  ok("메달을 처음 따면 덤 보물(115m → 동메달)", m.medalBonus === 300 && a.mini().medals.jelly === 1, "덤=" + m.medalBonus);
  ok("한 판 보상은 " + 500 + "까지", m.reward <= 500);

  // 2) 고무고무 대포
  M.start("cannon");
  m = a.mini().m; m.ang = 40;
  M.down();
  for(let i=0;i<45;i++) H.step();
  M.up();
  ok("누르고 떼면 발사", m.flying && m.p.vx > 10, "vx=" + m.p.vx.toFixed(1));
  m.objs.length = 0; m.nextX = 1e9;   // 장애물 없이
  m.objs.push({ k:"jelly", x: m.p.x + 3000, y: SEA_Y() - 80, t: 0, sq: 0 });
  let puffed = false;
  for(let i=0;i<20;i++) H.step();
  const vy0 = m.p.vy; M.down(); M.up(); puffed = m.puffs === 2 && m.p.vy <= -7;
  ok("날면서 누르면 고무 풍선(3번까지)", puffed, "vy " + vy0.toFixed(1) + "→" + m.p.vy.toFixed(1));
  for(let i=0;i<60*60 && m.phase === "play";i++) H.step();
  ok("결국 바다에 가라앉아 끝난다", m.phase === "over" && m.score > 50, "거리=" + Math.floor(m.score));
  // 해파리 위에 떨어지면 튕긴다
  M.start("cannon"); m = a.mini().m; M.down(); M.up();
  m.flying = true; m.objs.length = 0; m.nextX = 1e9;
  m.p.x = 2000; m.p.y = 300; m.p.vx = 8; m.p.vy = 6;
  m.objs.push({ k:"jelly", x: 2010, y: 360, t: 0, sq: 0 });
  for(let i=0;i<15;i++) H.step();
  ok("대포: 해파리를 밟으면 위로 튕긴다", m.bouncesN === 1 && m.p.vy < 0);

  // 3) 해파리 징검다리
  M.start("hop");
  m = a.mini().m;
  m.slots = [0, 1, 1, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  const hold = (n) => { M.down(); for(let i=0;i<n;i++) H.step(); M.up(); for(let i=0;i<70 && m.hop;i++) H.step(); };
  hold(40);
  ok("길게 누르면 3칸", m.i === 3 && m.phase === "play", "칸=" + m.i);
  hold(4);
  ok("전기 해파리에 내려앉으면 끝", m.phase === "over" && /감전/.test(m.reason));
  M.start("hop"); m = a.mini().m;
  M.down(); M.up(); H.step();   // 시작 누름은 1칸 점프
  for(let i=0;i<80 && m.hop;i++) H.step();
  const i0 = m.i;
  for(let i=0;i<400 && m.phase === "play";i++) H.step();
  ok("가만히 있으면 밟은 해파리와 함께 가라앉는다", m.phase === "over" && /가라앉/.test(m.reason) && m.i === i0);

  // 해파리 두건 — 셋 다 금메달
  ok("금메달 셋 전엔 해파리 두건이 잠겨 있다", !a.shop().pickSkin(7));
  M.set("cannon", 2000, 3); M.set("hop", 200, 3);
  M.start("jelly"); m = a.mini().m; M.down(); M.up();
  m.js.length = 0; m.nextY = -1e9; m.cy = -7000; m.p.y = -6900; m.top = -6900; m.p.vy = 5;
  for(let i=0;i<200 && m.phase === "play";i++) H.step();
  ok("셋 다 금메달이면 해파리 두건이 풀린다", m.skinUp && a.shop().pickSkin(7) && a.shop().skin === "jelly");
  a.shop().pickSkin(0);

  // 조작
  M.start("jelly");
  M.toList();
  ok("Esc(목록)로 미니게임 목록으로", a.peek().state === 12);
  a.toMenu();

  // 주간 해류
  const Wk = a.weekly();
  ok("주간 해류는 4가지 중 하나", Wk.list.length === 4 && Wk.list.indexOf(Wk.now) >= 0);
  Wk.force("gull");
  a.startMain(); H.step();
  ok("갈매기 철엔 '갈매기 철'이 이번 주 해류", a.weekly().now.id === "gull");
  Wk.force("jelly");
  {
    let jelly3 = 0, jelly1 = 0;
    for(let r=0;r<40;r++){ a.startMain(); T().teleport(30000); jelly3 += a.peek().jellies.length; }
    Wk.force("gold");
    for(let r=0;r<40;r++){ a.startMain(); T().teleport(30000); jelly1 += a.peek().jellies.length; }
    ok("해파리 대이동 주엔 해파리가 훨씬 많다", jelly3 > jelly1 * 1.6, jelly3 + " vs " + jelly1);
  }
  Wk.force(null);
  a.toMenu();

  // 선원 레벨
  const C = a.crewLv();
  a.crew().set("sword");
  ok("선원 레벨은 1부터", C.lv("sword") === 1 && Math.abs(C.cdMul("sword") - 1) < 1e-9);
  C.gain(4100);
  ok("4000m 함께 가면 Lv.3, 쿨타임 -16%", C.lv("sword") === 3 && Math.abs(C.cdMul("sword") - 0.84) < 1e-9 && a.crewLv().up && a.crewLv().up.lv === 3);
  C.gain(1e6);
  ok("최고 Lv.5", C.lv("sword") === 5);
  a.crew().set(null);
}

/* --- v39: 유령선 칭호 --- */
{
  const a = A();
  a.startMain(); H.step();
  const before = a.lifeStats().ghost;
  ok("유령선 칭호를 따기 전엔 망령 두건이 잠겨 있다", a.lifeStats().titles.indexOf("ghost1") >= 0 || !a.shop().pickSkin(8));
  const b = a.spawnBoss(true, 7);
  b.hp = 1; b.invul = 0;
  T().dmg(true, "test");
  const st = a.lifeStats();
  ok("유령선을 격침하면 유령선 격파 수가 오른다", st.ghost === before + 1 && a.boss() === null, "ghost=" + st.ghost);
  ok("유령선 1척이면 칭호 '유령선 퇴마사'", st.titles.indexOf("ghost1") >= 0);
  ok("칭호를 따면 망령 두건을 장착할 수 있다", a.shop().pickSkin(8) && a.shop().skin === "ghost");
  a.shop().pickSkin(0);
  const k = a.spawnBoss(true, 5); k.hp = 1; k.invul = 0; T().dmg(true, "test");
  ok("크라켄 격침은 유령선 수에 안 센다", a.lifeStats().ghost === before + 1);
  a.toMenu();
}

/* --- v39: 항로 갈림길 --- */
{
  const a = A();
  a.startMain(); H.step();
  // 카메라를 앞으로 밀며 5000m까지 지형을 만들어 본다
  let pairs = 0, routesSeen = new Set(), portInRoute = 0, ports = 0, lowOk = true, upOk = true;
  for(let x=0; x<5000*22; x+=700){
    const an = a.route().scan(x);
    for(const q of an){
      if(q.lane === 1 && q.y > 100) upOk = false;
      if(q.lane === 2 && q.y < 230) lowOk = false;
      if(q.lane) routesSeen.add(q.route);
      if(q.lane === 1 && an.some(o => o.lane === 2 && o.route === q.route && Math.abs(o.x - q.x) < 30)) pairs++;
    }
    for(const r of a.route().list) for(const q of an) if(q.port && r.x1 && q.x > r.x0 - 40 && q.x < r.x1 + 40){ portInRoute++; }
    ports += an.filter(q => q.port).length;
  }
  ok("갈림길이 생기고 위·아래 고리가 짝으로 선다", routesSeen.size >= 3 && pairs > 10, "갈림길 " + routesSeen.size + "개 · 짝 " + pairs);
  ok("하늘길 고리는 높이, 바닷길 고리는 낮게", upOk && lowOk);
  ok("항구 돛대는 갈림길 안에 서지 않는다", portInRoute === 0 && ports > 0, "항구 " + ports);

  // 바닷길 금화 2배
  a.startMain(); H.step(); a.hold(true); H.step(); a.hold(false);
  const st = a.peek();
  T().setTreasure(0);
  st.coins.push({ x: st.x, y: st.y, got:false });
  H.step();
  const g1 = a.peek().treasure;
  T().setTreasure(0);
  const st2 = a.peek();
  st2.coins.push({ x: st2.x, y: st2.y, got:false, dbl:true });
  H.step();
  const g2 = a.peek().treasure;
  ok("바닷길 금화는 2배", g1 > 0 && Math.abs(g2 - g1*2) <= 1, g1 + " → " + g2);

  // 갈림길을 다 지나면 많이 탄 쪽 보상
  const R = a.route();
  const p0 = a.peek();
  R.list.push({ id: 999, x0: p0.x - 900, x1: p0.x - 10, up: 3, low: 1, done: false, shown: true });
  T().setTreasure(0);
  H.step();
  ok("하늘길을 더 많이 타고 지나가면 하늘길 돌파 보상", R.done.up === 1 && a.peek().treasure >= 150, "보물 " + Math.floor(a.peek().treasure));
  R.list.push({ id: 998, x0: p0.x - 900, x1: a.peek().x - 10, up: 0, low: 4, done: false, shown: true });
  H.step();
  ok("바닷길로 지나가면 바닷길 돌파", R.done.low === 1);
  R.list.push({ id: 997, x0: p0.x - 900, x1: a.peek().x - 10, up: 0, low: 1, done: false, shown: true });
  H.step();
  ok("거의 안 잡고 넘으면 보상 없음", R.done.low === 1 && R.done.up === 1);

  // 오늘의 항해 — 갈림길 위치도 같다
  const snapR = () => { a.startDaily(); H.step(); const an = a.route().scan(1500*22); return JSON.stringify(an.filter(q => q.lane).slice(0, 6).map(q => [Math.round(q.x), Math.round(q.y)])); };
  ok("오늘의 항해는 갈림길도 매번 같은 자리", snapR() === snapR());

  // 연습 모드엔 없다
  a.startPractice(0); H.step();
  ok("연습 모드엔 갈림길이 없다", !a.route().scan(3000*22).some(q => q.lane));
  a.toMenu();
}

/* --- v39: 라이벌 해적 레이스 --- */
{
  const a = A();
  a.startMain(); H.step(); a.hold(true); H.step(); a.hold(false);
  a.rival().setNext(5);
  const R = () => a.rival();
  let st = a.peek();
  for(let i=0;i<400 && !R().r && st.state !== 2;i++){ swing(a, st); H.step(); st = a.peek(); }
  ok("정해진 거리가 되면 라이벌 해적이 경주를 건다", !!R().r && R().races === 1, "dist=" + Math.floor(st.dist));
  if(st.state === 2){ a.startMain(); H.step(); a.hold(true); H.step(); a.hold(false); R().start(); }
  // 이기기 — 결승선을 플레이어 바로 앞으로 당긴다
  T().setTreasure(0);
  const w0 = R().wins;
  R().r.finish = a.peek().x - 1;
  H.step();
  ok("먼저 결승에 닿으면 이기고 현상금", R().wins === w0 + 1 && R().r.over === "win" && a.peek().treasure >= 400, "보물 " + Math.floor(a.peek().treasure));
  for(let i=0;i<130;i++){ H.step(); a.hold(true); }
  ok("경주가 끝나면 라이벌은 떠난다", !R().r);
  // 지기
  a.startMain(); H.step(); a.hold(true); H.step();
  R().start();
  T().setTreasure(0);
  R().r.x = R().r.finish + 1;
  H.step();
  ok("라이벌이 먼저 닿으면 지고 보상 없음", R().r.over === "lose" && R().wins === 0 && a.peek().treasure < 400);
  // 경주 중엔 보스가 안 나온다 — 끝나면 나온다
  a.startMain(); H.step(); a.hold(true); H.step();
  R().start();
  a.setNextBoss(0);
  for(let i=0;i<5;i++) H.step();
  const noBoss = !a.boss();
  R().r.finish = a.peek().x - 1;
  for(let i=0;i<3;i++) H.step();
  ok("경주 중엔 보스가 끼어들지 않고, 끝나면 나온다", noBoss && !!a.boss());
  a.startPractice(0); H.step();
  a.rival().setNext(0);
  for(let i=0;i<30;i++) H.step();
  ok("연습 모드엔 라이벌이 없다", !a.rival().r);
  a.toMenu();
}

/* --- v39: 해군 대장 군함 --- */
{
  const a = A();
  a.startMain(); H.step(); a.hold(true); H.step();
  const N = () => a.navy();
  N().setChases(1);
  N().setNext(0);
  H.step();
  ok("두 번째 해군 추격 자리엔 해군 대장 군함이 대형 보스로 나온다", a.boss() && a.boss().type === 8 && a.boss().big && !N().n && N().chases === 2);
  const b = a.boss();
  ok("해군 대장 군함은 HP 10", b.maxHp === 10);
  b.t = 30;  const w1 = a.weak().map(w => w.mark);
  b.t = 130; const w2 = a.weak().map(w => w.mark);
  b.t = 190; const w3 = a.weak().map(w => w.mark);
  ok("대장은 늘, 화약고와 망루는 번갈아 드러난다", w1.join() === "대장,화약고" && w2.join() === "대장,망루" && w3.join() === "대장", w1 + " / " + w2 + " / " + w3);
  // 그물
  const st = a.peek();
  T().pushShot({ x: st.x, y: st.y, vx: 0, vy: 0, g: 0, r: 16, kind: 4, spin: 0 });
  H.step();
  ok("그물에 맞으면 휘청하며 뒤로 끌려간다", a.peek().stun > 0 && a.peek().vx < 0, "vx=" + a.peek().vx.toFixed(1));
  // 격침
  const before = a.lifeStats().admiral;
  const big0 = a.peek().dist;
  b.hp = 1; b.invul = 0;
  T().dmg(true, "test");
  ok("해군 대장을 격침하면 칭호 '정의를 꺾은 자'", a.lifeStats().admiral === before + 1 && a.lifeStats().titles.indexOf("admiral1") >= 0);
  ok("격침하면 이번 항해엔 해군이 더 안 쫓아온다", N().beaten === true);
  while(a.peek().state === 10 || a.pick2().pending){ if(a.peek().state === 10) a.pickCard(0); H.step(); }
  N().setNext(0);
  a.setNextBoss(1e9);
  for(let i=0;i<10;i++){ H.step(); if(a.peek().state === 10) a.pickCard(0); }
  ok("격침 뒤엔 해군 추격도 대장 군함도 안 나온다", !N().n && !(a.boss() && a.boss().type === 8));
  // 첫 추격은 그대로 군함
  a.startMain(); H.step(); a.hold(true); H.step();
  N().setNext(0); H.step();
  ok("첫 해군 추격은 예전처럼 쫓아오는 군함", !!N().n && !a.boss());
  a.startPractice(9); H.step();
  ok("연습 목록 맨 끝은 해군 대장 군함", a.peek().practiceMode && a.peek().practiceMode.bossType === 8);
  a.toMenu();
}

/* --- v39: 신규 선원 5명 --- */
{
  const a = A(), CT = () => a.crewTest(), C = a.crew();
  ok("선원은 9명 — 선의·고고학자·조선공·음악가·조타수 추가", CT().list.length === 9 && ["doctor","arch","wright","music","helm"].every(id => CT().list.some(c => c.id === id)));
  a.shopPage(4); CT().setPage(0);
  const rows1 = a.rows().filter(r => /\d\) /.test(r.label) && r.swatch).length;
  CT().setPage(1);
  const rows2 = a.rows().filter(r => /\d\) /.test(r.label) && r.swatch).length;
  ok("창고 선원 쪽은 5명 + 4명 두 쪽", rows1 === 5 && rows2 === 4, rows1 + "/" + rows2);
  CT().setPage(0);
  const stunWith = (id) => { C.set(id); a.startMain(); H.step(); a.hold(true); H.step(); return T().hit(false); };
  const s0 = stunWith(null), s1 = stunWith("doctor");
  ok("선의 — 휘청 시간 -30%", Math.abs(s1 - s0 * 0.7) < 0.01, s0.toFixed(1) + " → " + s1.toFixed(1));
  C.set("doctor"); a.startMain(); H.step();
  ok("선의 — 출발할 때 보호막 1", CT().shield() === 1);
  C.set(null); a.startMain(); H.step();
  ok("선의가 없으면 보호막 없이 출발", CT().shield() === 0);
  // 고고학자 — 보물 통
  const barrelGain = (id) => { C.set(id); a.startMain(); H.step(); a.hold(true); H.step(); T().setTreasure(0); CT().barrel(); return a.peek().treasure; };
  const b0 = barrelGain(null), b1 = barrelGain("arch");
  ok("고고학자 — 보물 통 보물 +50%", b1 === Math.round(b0 * 1.5), b0 + " → " + b1);
  // 조선공 — 항구 값·삭은 돛대
  C.set(null); a.startMain(); H.step(); CT().setPortIdx(1); const pr0 = CT().portPrice(0);
  C.set("wright"); a.startMain(); H.step(); CT().setPortIdx(1); const pr1 = CT().portPrice(0);
  ok("조선공 — 항구 값 -20%", pr1 === Math.round(pr0 * 0.8 / 10) * 10, pr0 + " → " + pr1);
  a.hold(true); H.step(); a.hold(false);
  const rot = CT().grabRot();
  ok("조선공 — 삭은 돛대가 두 배 오래 버틴다", rot.creak === 144, "creak=" + rot.creak);
  // 음악가 — 기어 게이지
  C.set(null); a.startMain(); H.step(); a.hold(true); H.step(); T().setGear(0); const g0 = CT().gearAdd("kill");
  C.set("music"); a.startMain(); H.step(); a.hold(true); H.step(); T().setGear(0); const g1 = CT().gearAdd("kill");
  ok("음악가 — 기어 게이지 +25%", Math.abs(g1 - g0 * 1.25) < 1e-6, g0 + " → " + g1);
  // 조타수 — 갈림길 보상 2배, 라이벌 느려짐
  C.set("helm"); a.startMain(); H.step(); a.hold(true); H.step();
  const R = a.route(); const p0 = a.peek();
  R.list.push({ id: 991, x0: p0.x - 900, x1: p0.x - 10, up: 3, low: 0, done: false, shown: true });
  T().setTreasure(0); H.step();
  ok("조타수 — 갈림길 보상 2배", a.peek().treasure >= 300, "보물 " + Math.floor(a.peek().treasure));
  a.rival().start(); a.rival().r.t = 0;
  const v1 = a.rival().speed();
  C.set(null); a.startMain(); H.step(); a.hold(true); H.step();
  a.rival().start(); a.rival().r.t = 0;
  const v0 = a.rival().speed();
  ok("조타수 — 라이벌 해적이 8% 느려진다", Math.abs(v1 - v0 * 0.92) < 1e-6, v0.toFixed(2) + " → " + v1.toFixed(2));
  // 레벨이 오르면 효과가 세진다
  C.set("doctor"); a.crewLv().gain(4100);
  ok("선원 레벨이 오르면 효과도 세진다(선의 Lv.3 -38%)", Math.abs(CT().k("doctor", 0.3, 0.04) - 0.38) < 1e-9);
  C.set(null);
  a.toMenu();
}

/* --- v39: 난이도 선택 --- */
{
  const a = A(), D = () => a.diff();
  D().set("normal");
  a.startMain(); H.step();
  ok("난이도 기본은 보통", D().sel === "normal" && D().now === "normal");
  D().cycle();
  ok("출항 화면에서 V(버튼)로 난이도를 바꾼다 — 보통 → 어려움 → 쉬움", D().sel === "hard" && D().cycle() && D().sel === "easy" && D().cycle() && D().sel === "normal");
  // 고리 간격
  const meanGap = (d) => {
    D().set(d); let sum = 0, n = 0;
    for(let r=0;r<8;r++){
      a.startMain(); H.step();
      const xs = [];
      for(let x=0; x<560*22; x+=700) for(const q of a.route().scan(x)) if(!q.lane && xs.indexOf(q.x) < 0) xs.push(q.x);
      xs.sort((u, v) => u - v);
      for(let i=1;i<xs.length;i++){ sum += xs[i] - xs[i-1]; n++; }
    }
    return sum / n;
  };
  const ge = meanGap("easy"), gn = meanGap("normal"), gh = meanGap("hard");
  ok("어려울수록 고리 간격이 넓다", ge < gn && gn < gh, ge.toFixed(0) + " < " + gn.toFixed(0) + " < " + gh.toFixed(0));
  D().set("hard"); a.startMain(); H.step();
  ok("어려움은 첫 보스가 더 일찍", Math.abs(D().bossAt - 400) < 1e-6, "bossAt=" + D().bossAt);
  // 기록·보물 — 난이도별로 따로
  const best0 = a.peek().dist, bn0 = a.diff().bests.hard;
  a.hold(true); H.step(); a.hold(false);
  T().teleport(a.peek().x + 22*300);
  for(let i=0;i<3;i++) H.step();
  T().setTreasure(1000);
  const bank0 = a.bank();
  const normalBest = H.evalIn("0");
  a.die("바다");
  if(a.peek().state === 9) a.decline();
  ok("어려움 최고 기록은 따로 남는다", a.diff().bests.hard > 0 && a.diff().best === a.diff().bests.hard, "hard=" + Math.floor(a.diff().bests.hard));
  ok("어려움은 창고에 보물이 ×1.4로 쌓인다", a.bank() - bank0 === 1400, (a.bank() - bank0) + "");
  D().set("normal"); a.startMain(); H.step();
  ok("보통으로 돌아오면 보통 기록을 보여 준다", D().best !== a.diff().bests.hard || a.diff().bests.hard === 0);
  // 다른 모드는 늘 보통
  D().set("hard");
  a.startDaily(); H.step();
  ok("오늘의 항해는 난이도와 상관없이 보통", D().now === "normal" && !D().cycle());
  a.startPractice(0); H.step();
  ok("연습 모드에선 난이도를 못 바꾼다", D().now === "normal" && !D().cycle() && D().sel === "hard");
  D().set("normal");
  a.toMenu();
}

/* --- v39: 바다 도감 --- */
{
  const a = A(), X = () => a.dex();
  ok("도감은 33종 — 생물·보스 9종·지형·해역·사건", X().list.length === 33 && X().list.filter(e => e.cat === "boss").length === 9);
  a.startMain(); H.step(); a.hold(true); H.step();
  ok("출항하면 노을 군도가 등록된다", "biome0" in X().book);
  delete X().book.wind;
  T().setTreasure(0);
  const f0 = X().found;
  X().see("wind");
  ok("처음 만나면 도감 등록 + 보물 100", X().found === f0 + 1 && a.peek().treasure === 100 && X().book.wind === 1);
  X().see("wind");
  ok("두 번째부터는 횟수만 는다", a.peek().treasure === 100 && X().book.wind === 2);
  X().book.fish = 29; ok("별은 횟수 단계 — 물고기 29마리 ★1", X().stars("fish") === 1);
  X().book.fish = 30; ok("물고기 30마리 ★2", X().stars("fish") === 2);
  // 보스 — 나타나면 등록(0), 격침하면 센다
  delete X().book.boss3;
  const b = a.spawnBoss(false, 3);
  ok("보스는 나타나면 등록(격침 0)", X().book.boss3 === 0 && X().stars("boss3") === 0);
  b.hp = 1; b.invul = 0; T().dmg(true, "test");
  ok("격침하면 별이 붙는다", X().book.boss3 === 1 && X().stars("boss3") === 1);
  // 실제 플레이 — 화면에 들어온 생물을 센다
  a.startMain(); H.step(); a.hold(true); H.step(); a.hold(false);
  const g0 = X().book.gull || 0;
  const st = a.peek();
  st.gulls.push({ x: st.x + 200, base: 200, y: 200, t: 0, vx: -2, gone: false });
  for(let i=0;i<10;i++) H.step();
  ok("화면에 들어온 갈매기를 도감에 센다", (X().book.gull || 0) === g0 + 1);
  for(let i=0;i<20;i++) H.step();
  ok("같은 갈매기는 한 번만 센다", (X().book.gull || 0) === g0 + 1);
  // 연습 모드는 무시
  a.startPractice(0); H.step();
  const n0 = X().book.storm || 0;
  X().see("storm");
  ok("연습 모드에선 도감이 안 바뀐다", (X().book.storm || 0) === n0);
  // 완성 — 칭호와 두건
  a.startMain(); H.step(); a.hold(true); H.step();
  for(const e of X().list) if(!(e.id in X().book) && e.id !== "searoute") X().book[e.id] = 1;
  delete X().book.searoute;
  ok("하나 남았을 땐 박물학자 칭호가 없다", a.lifeStats().titles.indexOf("naturalist") < 0);
  X().see("searoute");
  ok("도감을 다 채우면 칭호 '바다의 박물학자'", X().found === 33 && a.lifeStats().titles.indexOf("naturalist") >= 0);
  ok("칭호를 따면 박물학자 두건을 장착할 수 있다", a.shop().pickSkin(9) && a.shop().skin === "dex");
  a.shop().pickSkin(0);
  // 화면
  X().open();
  ok("항해 일지 → 바다 도감 화면, 9로 돌아간다", X().page() && a.rows().length === 1 && a.rows()[0].key === 9);
  a.rows()[0].action();
  ok("도감에서 일지로", !X().page() && a.rows().some(r => r.key === 4));
  a.toMenu();
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
  const ver = (src.match(/const GAME_VER = "v(\d+)"/) || [])[1];
  const cache = (require("fs").readFileSync(require("path").join(__dirname, "..", "sw.js"), "utf8").match(/gomupal-v(\d+)/) || [])[1];
  ok("화면 버전(GAME_VER)과 sw.js 캐시 버전이 같다", ver && ver === cache, "GAME_VER=v" + ver + " 캐시=v" + cache);
}

console.log(failed === 0 ? "\n전부 통과" : "\n실패 " + failed + "건");
process.exit(failed === 0 ? 0 : 1);
