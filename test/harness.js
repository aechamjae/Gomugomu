// 브라우저 없이 게임 루프를 돌리기 위한 가짜 DOM
const fs = require("fs");
const vm = require("vm");
const path = require("path");

function makeCtx(){
  const noop = () => {};
  const c = {};
  for(const k of ["save","restore","translate","scale","rotate","beginPath","moveTo","lineTo",
                  "quadraticCurveTo","bezierCurveTo","closePath","fill","stroke","arc","ellipse",
                  "fillRect","strokeRect","clearRect","setTransform","fillText","strokeText",
                  "createLinearGradient","createRadialGradient","clip","setLineDash","drawImage",
                  "rect","arcTo","measureText"]) c[k] = noop;
  c.createLinearGradient = c.createRadialGradient = () => ({ addColorStop: noop });
  c.measureText = () => ({ width: 10 });
  return c;
}

function makeEl(id){
  return {
    id, textContent:"", value:"", width:0, height:0, style:{},
    dataset:{}, classList:{ add:()=>{}, remove:()=>{}, toggle:()=>{} },
    getContext: makeCtx, addEventListener:()=>{}, removeEventListener:()=>{},
    focus:()=>{}, getBoundingClientRect:()=>({left:0,top:0,width:900,height:540})
  };
}

const els = {};
const document = {
  hidden:false,
  getElementById: (id) => (els[id] || (els[id] = makeEl(id))),
  querySelectorAll: () => [],
  querySelector: () => null,
  addEventListener: ()=>{}, removeEventListener: ()=>{},
  createElement: (t) => makeEl(t)
};

let frame = 0;
const FPS_MS = 1000/60;
const queue = [];
const window = {
  devicePixelRatio: 1,
  addEventListener: ()=>{}, removeEventListener: ()=>{},
  focus: ()=>{},
  localStorage: { getItem:()=>null, setItem:()=>{} },
  requestAnimationFrame: (fn) => { queue.push(fn); return queue.length; }
};

const sandbox = {
  window, document, console, Math, Date, JSON, parseFloat, parseInt, String, Number,
  setTimeout, clearTimeout, isNaN,
  performance: { now: () => frame * FPS_MS },
  requestAnimationFrame: (fn) => { queue.push(fn); return queue.length; },
  localStorage: window.localStorage
};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);

const html = fs.readFileSync(process.env.GAME || path.join(__dirname, "..", "index.html"), "utf8");
const src  = html.split("<script>")[1].split("</script>")[0];
// 게임 전체가 IIFE로 감싸여 있으므로 훅을 그 안쪽에 끼워 넣는다
const HOOK = '\nwindow.__test = { setBoss:(b)=>{ boss = b; }, wp:(b)=>weakPoints(b), P:()=>p, anchors:()=>anchors, reset:()=>reset() };\n';
const i = src.lastIndexOf("})();");
const wired = i < 0 ? src + HOOK : src.slice(0, i) + HOOK + src.slice(i);
vm.runInContext(wired, sandbox, { filename:"game.js" });

// 한 프레임 진행
function step(){
  frame++;
  const fns = queue.splice(0, queue.length);
  for(const fn of fns) fn(frame * FPS_MS);
}

const sandboxRef = sandbox;
module.exports = { step, api: () => sandbox.window.__swing, frames: () => frame };

const vm2 = require("vm");
module.exports.evalIn = (src) => vm2.runInContext(src, sandbox);
