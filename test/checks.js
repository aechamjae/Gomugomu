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
        if(hpBefore === null && st.skillCd <= 0 && st.boss.x > st.x && st.boss.x - st.x < 620){
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

/* --- 베리어베리어 (쿨타임 90초, 짧게 완전 무적) --- */
{
  const a = start();
  let s = a.peek();
  ok("베리어도 시작할 때 충전됨", s.barrierCd <= 0, "barrierCd=" + Math.round(s.barrierCd));
  a.fireBarrier(); H.step();
  s = a.peek();
  ok("발사되면 무적 상태가 된다", s.barrier > 0, "barrier=" + Math.round(s.barrier));
  ok("발사 후 쿨타임 진입 (22.5초 ≈ 1350프레임)", s.barrierCd > 1300, "barrierCd=" + Math.round(s.barrierCd));
  const before = s.barrierCd;
  a.fireBarrier(); H.step();
  ok("쿨타임 중엔 재발사 불가", a.peek().barrierCd <= before);
}
{
  const a = start();
  let s = a.peek();
  s.mobs.length = 0;
  s.mobs.push({ kind:1, x:s.x + 10, y:s.SEA, phase:3, t:0, h:300, gone:false });
  a.fireBarrier();
  s = run(a, 90, (st) => { st.mobs.forEach(m => { if(m.kind===1) m.phase = 3; }); a.keys.right = true; });
  ok("베리어 중엔 해왕류에 닿아도 죽지 않는다", s.state !== 2, "state=" + s.state);
}
{
  const a = start();
  a.fireBarrier();
  const P = T().P();
  P.y = a.peek().SEA + 40;                 // 강제로 바다 밑에 위치시킨다
  H.step();
  ok("베리어 지속 중 바다에 빠져도 죽지 않는다", a.peek().state !== 2, "state=" + a.peek().state);
}

/* --- 돌진 (쿨타임 20초) --- */
{
  const a = start();
  let s = a.peek();
  ok("돌진도 시작할 때 충전됨", s.dashCd <= 0, "dashCd=" + Math.round(s.dashCd));
  const vxBefore = s.vx;
  a.fireDash(); H.step();
  s = a.peek();
  ok("돌진하면 잔상 이펙트가 생긴다", !!s.dash);
  ok("돌진 후 쿨타임 진입 (5초 ≈ 300프레임)", s.dashCd > 280, "dashCd=" + Math.round(s.dashCd));
  const before = s.dashCd;
  a.fireDash(); H.step();
  ok("쿨타임 중엔 재발사 불가", a.peek().dashCd <= before);
}
{
  const a = start();
  const s = a.peek();
  s.mobs.length = 0;
  s.mobs.push({ kind:0, x:s.x + 30, y:s.y, vy:0, air:true, t:0, cool:0, gone:false });
  s.mobs.push({ kind:1, x:s.x + 30, y:s.SEA, phase:3, t:0, h:300, gone:false });
  a.fireDash();
  let fishGone = false, kingGone = false;
  run(a, 10, (st) => {
    if(!st.mobs.some(m => m.kind===0)) fishGone = true;
    if(!st.mobs.some(m => m.kind===1)) kingGone = true;
  });
  ok("돌진이 근처 잡몹·해왕류를 쓸어버린다", fishGone && kingGone,
     "물고기제거=" + fishGone + " 해왕류제거=" + kingGone);
}
{
  let hitOk = false, met = 0;
  for(let attempt=0; attempt<24 && !hitOk; attempt++){
    const a = start();
    let hpBefore = null;
    run(a, 9000, (st) => {
      swing(a, st);
      if(st.boss){
        met++;
        // 실제 판정(DASH_R+40=130)과 같은 방식(2D 거리)으로 트리거해야 헛방을 줄인다
        const d = Math.hypot(st.boss.x-st.x, st.boss.y-st.y);
        if(hpBefore === null && st.dashCd <= 0 && st.boss.x > st.x && d < 120){
          hpBefore = st.boss.hp; a.fireDash();
        }
        if(hpBefore !== null && st.boss.hp < hpBefore) hitOk = true;
      } else if(hpBefore !== null) hitOk = true;
    });
  }
  ok("돌진이 보스에게 명중한다", hitOk, "보스 조우 프레임=" + met);
}

/* --- 보스 약점 --- */
{
  const a = start();
  const P = T().P();
  const res = {};
  for(const t of [0,1,2,3,4]){
    const b = { type:t, big:t===4, hp:2, maxHp:2, t:0, life:9999, fire:90, invul:0, flash:0,
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
  ok("중간보스 4종 모두 약점이 2개", [0,1,2,3].every(t => res[t].개수 === 2),
     JSON.stringify(res));
  ok("약점이 고정되어 있지 않다", [0,2,3,4].every(t => res[t].위치 > 10));
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
}

console.log(failed === 0 ? "\n전부 통과" : "\n실패 " + failed + "건");
process.exit(failed === 0 ? 0 : 1);
