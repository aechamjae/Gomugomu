// 스윙 봇: 고리 아래를 지나 솟구칠 때 놓는 정책으로 실제 플레이를 흉내낸다
const H = require("./harness.js");

const MAX_FRAMES = parseInt(process.argv[2] || "10800", 10);   // 기본 3분
const RUNS = parseInt(process.argv[3] || "5", 10);
const USE_SKILL = process.argv[4] !== "noskill";

const api = () => H.api();

function playOne(){
  const a = api();
  (a.reset || H.evalIn("window.__test").reset)();
  H.step();
  a.hold(true); H.step(); a.hold(false);      // READY → PLAY

  let f = 0, fired = 0, deaths = null;
  let maxDist = 0, sawKing = false, sawFish = false, killedBoss = 0;

  while(f < MAX_FRAMES){
    const s = a.peek();
    if(s.state === 2){ deaths = s.deathReason || "?"; break; }
    maxDist = Math.max(maxDist, s.dist);
    for(const m of (s.mobs || [])){
      if(m.kind === 1) sawKing = true; else sawFish = true;
    }
    killedBoss = s.bossKills;

    // 매달려 있으면: 고리를 지나 위로 솟구치는 순간 놓는다
    if(s.rope){
      const past = s.x > s.rope.a.x;
      if(past && s.vy < -1.2) a.hold(false);
      else a.hold(true);
      a.keys.right = true; a.keys.left = false; a.keys.down = false;
    } else {
      a.hold(true);                             // 선입력 — 걸리면 자동으로 잡힌다
      a.keys.right = true;
      a.keys.down = (s.y < 200 && s.vy > 0);
    }

    // 스킬: 보스나 해왕류가 앞에 있으면 쏜다
    if(USE_SKILL && s.skillCd <= 0){
      const king = (s.mobs || []).some(m => m.kind === 1 && m.h > 40 && m.x > s.x && m.x - s.x < 700);
      if(king || (s.boss && s.boss.x - s.x < 600 && s.boss.x > s.x)){ a.fire(); fired++; }
    }

    H.step();
    f++;
  }
  return { dist: Math.round(maxDist), frames: f, death: deaths, fired,
           sawKing, sawFish, bossKills: killedBoss };
}

const rows = [];
for(let i=0;i<RUNS;i++) rows.push(playOne());

console.log("판 | 거리m | 프레임 | 사인      | 피스톨 | 보스격침 | 물고기 | 해왕류");
for(const r of rows){
  console.log([String(rows.indexOf(r)+1).padStart(2), String(r.dist).padStart(6),
               String(r.frames).padStart(7), (r.death||"생존").padEnd(9),
               String(r.fired).padStart(7), String(r.bossKills).padStart(9),
               r.sawFish ? "  O" : "  -", r.sawKing ? "    O" : "    -"].join(" | "));
}
const avg = rows.reduce((s,r)=>s+r.dist,0)/rows.length;
console.log("평균 " + avg.toFixed(0) + "m · 최고 " + Math.max(...rows.map(r=>r.dist)) + "m");
const causes = {};
for(const r of rows) causes[r.death||"생존"] = (causes[r.death||"생존"]||0)+1;
console.log("사인 분포:", JSON.stringify(causes));
