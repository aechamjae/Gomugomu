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
  const a = start();
  let s = a.peek();
  s.mobs.length = 0;
  s.mobs.push({ kind:1, x:s.x + 300, y:s.SEA, phase:3, t:0, h:300, gone:false });
  s = run(a, 400, (st) => { st.mobs.forEach(m => { if(m.kind===1) m.phase = 3; }); a.keys.right = true; });
  ok("해왕류에 닿으면 즉사", s.state === 2 && s.deathReason === "해왕류", "사인=" + s.deathReason);
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

/* --- 고무고무 피스톨 --- */
{
  const a = start();
  let s = a.peek();
  ok("시작할 때 충전됨", s.skillCd <= 0, "skillCd=" + Math.round(s.skillCd));
  a.fire(); H.step();
  s = a.peek();
  ok("발사되면 주먹이 생긴다", !!s.fist);
  ok("발사 후 쿨타임 진입", s.skillCd > 7000, "skillCd=" + Math.round(s.skillCd));
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
  let pushed = false;
  run(a, 60, (st) => { st.mobs.forEach(m => { if(m.kind===1 && m.phase === 4) pushed = true; }); });
  ok("피스톨이 해왕류를 물러나게 한다", pushed);
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
