// Minimal pressurised-water reactor plant: primary and secondary loops on a bench.
// node build.mjs [--light]  →  npp.html / npp-light.html
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "./kit/iso-kit.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const theme = process.argv.includes("--light") ? "light" : "dark";
const kitScript = () => readFileSync(join(HERE, "kit", "iso-kit.mjs"), "utf8").replace(/^export /gm, "");

const WIDTH = 660;
const HEIGHT = 440;
const AZ = 58;

const PLATE = { x: -96, y: -42, w: 220, d: 96, r: 8 };
const REACTOR = [-70, 0];
const PRZ = [-50, -22];
const SG = [-10, 0];
const PUMP = [-40, 26];
const COND = { x: 28, y: -16, w: 44, d: 32, r: 2 };
const TURB = { x: 30, y: -13, w: 40, d: 26, r: 3 };
const GEN = { x: 80, y: -11, w: 30, d: 22, r: 3 };
const FEED = [16, 28];
const DIAL = [-50, 42];
const ROD_TRAVEL = 16;

const P = k.fitProjection([...k.boxCorners(PLATE, -15, 0), [REACTOR[0], REACTOR[1], 104], [SG[0], 0, 82]], WIDTH, HEIGHT, { pad: 28, azimuth: AZ });

const at = (p) => k.iso(p, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const D = (pts, style) => k.dotsSvg(pts, style);
const byDepth = (pts) => [...pts].sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));

// a square duct between two floor points on one axis, at height z0..z0+s
function duct([x0, y0], [x1, y1], z0, s, flowClass, tone = "mid") {
  const plan = x0 === x1
    ? { x: x0 - s / 2, y: Math.min(y0, y1), w: s, d: Math.abs(y1 - y0), r: 0.4 }
    : { x: Math.min(x0, x1), y: y0 - s / 2, w: Math.abs(x1 - x0), d: s, r: 0.4 };
  let out = S(k.slabOf(plan, z0, s, P, 2, 0.3), { tone });
  if (flowClass) out += `<path class="iso-line ${flowClass}" data-tone="hi" d="${k.lineOnTop([x0, y0], [x1, y1], z0 + s, P)}"/>`;
  return out;
}
const riser = ([x, y], z0, z1, s, tone = "mid") => S(k.slabOf({ x: x - s / 2, y: y - s / 2, w: s, d: s, r: 0.4 }, z0, z1 - z0, P, 2, 0.3), { tone });
const elbow = ([x, y], z0, s) => S(k.slabOf({ x: x - s / 2 - 0.8, y: y - s / 2 - 0.8, w: s + 1.6, d: s + 1.6, r: 0.6 }, z0 - 0.8, s + 1.6, P, 2, 0.3), { tone: "mid" });
const flowUp = ([x, y], z0, z1, s, cls) => `<path class="iso-line ${cls}" data-tone="hi" d="${k.segment([x + s / 2 * 0, y + s / 2, z0], [x, y + s / 2, z1], P)}"/>`;

function plate() {
  const out = [`<path class="iso-halo" d="${k.haloOf(PLATE, -15, 10, P)}"/>`];
  for (const [x, y] of byDepth(k.corners(PLATE, 16))) {
    out.push(S(k.cylinder(x, y, 6.4, -15, 1.6, P, 24), { tone: "lo" }));
    out.push(S(k.cylinder(x, y, 5, -13.4, 3.4, P, 24), { tone: "mid" }));
  }
  out.push(S(k.slabOf(PLATE, -10, 10, P, 8, 1.4), { tone: "mid" }));
  out.push(L(k.planOutline(k.insetPlan(PLATE, 5), 0, P), { tone: "lo" }));
  const screws = k.corners(PLATE, 10);
  out.push(L(screws.map(([x, y]) => k.ring(x, y, 2.2, 0, P, 16)).join(""), { tone: "lo" }));
  out.push(D(screws.map(([x, y]) => at([x, y, 0])), { size: 0.5 }));
  const label = { x: 84, y: 30, w: 30, d: 14, r: 1.4 };
  out.push(S(k.slabOf(label, 0, 0.8, P, 4), { tone: "lo", crease: "none" }));
  out.push(L(k.planOutline(k.insetPlan(label, 1.6), 0.8, P, 4), { tone: "faint" }));
  [[18, 4.4], [12, 7.4], [15, 10.2]].forEach(([w, y]) => out.push(L(k.lineOnTop([label.x + 4, label.y + y], [label.x + 4 + w, label.y + y], 0.8, P), { tone: "lo", free: true })));
  return out.join("");
}

function pressurizer() {
  const [x, y] = PRZ;
  return [
    S(k.cylinder(x, y, 7, 0, 3, P, 28), { tone: "lo" }),
    S(k.cylinder(x, y, 6, 3, 52, P, 32, 0.4), { tone: "mid", inner: L(k.sideArc(x, y, 6, 18, P, 20), { tone: "faint" }) + L(k.sideArc(x, y, 6, 40, P, 20), { tone: "faint" }) }),
    S(k.cylinder(x, y, 4, 55, 3, P, 24, 0.3), { tone: "mid" }),
    S(k.cylinder(x, y, 1.6, 58, 4, P, 14), { tone: "mid" }),
    // surge line to the hot leg
    duct([x, y + 6], [x, -3], 38, 4, null),
  ].join("");
}

function reactor() {
  const [x, y] = REACTOR;
  const out = [];
  out.push(`<path class="iso-halo" d="${k.haloOf({ x: x - 18, y: y - 18, w: 36, d: 36, r: 18 }, 0, 0.1, P)}" style="filter:blur(3px)"/>`);
  out.push(S(k.cylinder(x, y, 17, 0, 4, P, 48, 0.5), { tone: "lo" }));
  for (const [px, py] of byDepth([[x - 12, y - 12], [x + 12, y - 12], [x - 12, y + 12], [x + 12, y + 12]])) out.push(D([at([px, py, 4])], { size: 0.5 }));
  out.push(S(k.cylinder(x, y, 14, 4, 50, P, 48), { tone: "mid", crease: "none", inner: L(k.sideArc(x, y, 14, 16, P, 40), { tone: "faint" }) + L(k.sideArc(x, y, 14, 28, P, 40), { tone: "faint" }) }));
  out.push(S(k.cylinder(x, y, 16.5, 54, 5, P, 48, 0.5), { tone: "mid" }));
  out.push(D(k.circleRing(x, y, 15, 16).filter(([px, py]) => (px - x) * Math.cos((AZ * Math.PI) / 180) + (py - y) * Math.sin((AZ * Math.PI) / 180) > -2).map(([px, py]) => at([px, py, 59])), { size: 0.4 }));
  out.push(S(k.cylinder(x, y, 13, 59, 4, P, 44, 0.4), { tone: "mid" }));
  out.push(S(k.cylinder(x, y, 9.5, 63, 3, P, 40, 0.4), { tone: "mid" }));
  out.push(S(k.cylinder(x, y, 10.5, 66, 1.6, P, 40, 0.3), { tone: "lo" }));
  return out.join("");
}

const RODS = [[-74, -3], [-66, -3], [-74, 4], [-66, 4]];
function rodsSvg() {
  // built fully inserted; the group rises by ROD_TRAVEL × withdrawal
  return byDepth(RODS).map(([x, y]) => S(k.cylinder(x, y, 0.9, 70, 18, P, 12), { tone: "hi", crease: "none", lit: true }) + S(k.cylinder(x, y, 1.5, 88, 1.4, P, 12), { tone: "hi", lit: true })).join("");
}
function rodHousings() {
  return byDepth(RODS).map(([x, y]) => S(k.cylinder(x, y, 1.9, 67.6, 18, P, 14), { tone: "mid", crease: "none" }) + S(k.cylinder(x, y, 2.4, 85.6, 2, P, 14, 0.2), { tone: "mid" })).join("");
}

function hotLeg() {
  return [elbow([-56, 0], 38, 6), duct([-56, 0], [-22, 0], 38, 6, "flow-hot"), elbow([-22, 0], 38, 6)].join("");
}

function steamGenerator() {
  const [x, y] = SG;
  return [
    S(k.cylinder(x, y, 13, 0, 3, P, 40), { tone: "lo" }),
    S(k.cylinder(x, y, 10, 3, 6, P, 36), { tone: "mid", crease: "none" }),
    S(k.cylinder(x, y, 12, 9, 50, P, 44, 0.4), { tone: "mid", inner: L(k.sideArc(x, y, 12, 30, P, 36), { tone: "faint" }) }),
    S(k.cylinder(x, y, 14.5, 59, 14, P, 48, 0.5), { tone: "mid", inner: L(k.sideArc(x, y, 14.5, 66, P, 40), { tone: "faint" }) }),
    S(k.cylinder(x, y, 9, 73, 3, P, 36, 0.4), { tone: "mid" }),
  ].join("");
}

function steamLine() {
  const z = 76;
  return [
    riser([-10, 0], 76, z, 5),
    elbow([-10, 0], z, 5),
    duct([-10, 0], [46, 0], z, 5, "flow-steam"),
    elbow([46, 0], z, 5),
  ].join("");
}

function coldLeg() {
  return [
    elbow([-70, 26], 10, 6),
    duct([-70, 26], [-70, 13], 10, 6, "flow-cold-r"),
    duct([-70, 26], [-46, 26], 10, 6, "flow-cold-a"),
    pump(),
    duct([-34, 26], [-10, 26], 10, 6, "flow-cold-b"),
    elbow([-10, 26], 10, 6),
    duct([-10, 26], [-10, 11], 10, 6, "flow-cold-c"),
  ].join("");
}

function pump() {
  const [x, y] = PUMP;
  return [
    S(k.cylinder(x, y, 8, 0, 3, P, 32), { tone: "lo" }),
    S(k.cylinder(x, y, 6.5, 3, 15, P, 32, 0.4), { tone: "mid" }),
    S(k.cylinder(x, y, 5, 18, 3, P, 28), { tone: "mid", crease: "none" }),
    S(k.cylinder(x, y, 6, 21, 14, P, 32, 0.4), { tone: "mid", inner: L(k.knurl(x, y, 6, 21, 35, 28, P), { tone: "lo" }) }),
    S(k.cylinder(x, y, 3, 35, 2, P, 20), { tone: "mid" }),
  ].join("");
}

function feedLine() {
  return [
    elbow([0, 28], 26, 4.4),
    duct([0, 28], [0, 6], 26, 4.4, "flow-feed-b"),
    duct([0, 28], [FEED[0] - 5, 28], 26, 4.4, "flow-feed-a"),
  ].join("");
}

function condenser() {
  const out = [];
  out.push(`<path class="iso-halo" d="${k.haloOf(k.insetPlan(COND, -3), 0, 0.1, P)}" style="filter:blur(3px)"/>`);
  out.push(S(k.slabOf(COND, 0, 18, P, 4, 0.6), { tone: "lo", inner: L(k.sideSeam(COND, 6, P, 4), { tone: "faint" }) }));
  out.push(D([[COND.x + 3, COND.y + COND.d], [COND.x + COND.w - 3, COND.y + COND.d], [COND.x + COND.w, COND.y + COND.d - 3], [COND.x + COND.w, COND.y + 3]].map(([x, y]) => at([x, y, 15])), { size: 0.45 }));
  return out.join("");
}

function turbine() {
  const out = [];
  out.push(S(k.slabOf(TURB, 18, 14, P, 6, 0.6), { tone: "mid", inner: L(k.sideSeam(TURB, 25, P, 6), { tone: "faint" }) }));
  const cover = { x: 34, y: -9, w: 32, d: 18, r: 6 };
  out.push(S(k.slabOf(cover, 32, 6, P, 8, 0.6), { tone: "hi", crease: "lo" }));
  out.push(D([[36, -7], [64, -7], [64, 7], [36, 7]].map(([x, y]) => at([x, y, 38])), { size: 0.4 }));
  // bearing pedestals and shaft
  out.push(S(k.slabOf({ x: 70, y: -5, w: 4, d: 10, r: 0.6 }, 18, 9, P, 2, 0.3), { tone: "mid" }));
  out.push(S(k.slabOf({ x: 70, y: -1.5, w: 10, d: 3, r: 0.6 }, 27, 3, P, 2), { tone: "mid", crease: "none" }));
  return out.join("");
}

const COUPLING = [76, 0, 28.5];
function coupling() {
  const [cx, , cz] = COUPLING;
  return [S(k.slabOf({ x: cx - 2, y: -6, w: 4, d: 12, r: 3 }, cz - 6, 12, P, 6, 0.3), { tone: "mid" }), L(k.sideRing([cx + 2, 0, cz], 4.4, "x", P), { tone: "faint" })].join("");
}
const spokeAt = (angle) => k.segment([COUPLING[0] + 2, Math.cos(angle) * 1.2, COUPLING[2] + Math.sin(angle) * 1.2], [COUPLING[0] + 2, Math.cos(angle) * 4.4, COUPLING[2] + Math.sin(angle) * 4.4], P);

function steamDown() {
  return riser([46, 0], 38, 76, 5);
}

function generator() {
  const out = [];
  out.push(`<path class="iso-halo" d="${k.haloOf(k.insetPlan(GEN, -3), 0, 0.1, P)}" style="filter:blur(3px)"/>`);
  out.push(S(k.slabOf({ x: GEN.x - 2, y: GEN.y - 3, w: GEN.w + 4, d: GEN.d + 6, r: 2 }, 0, 12, P, 4, 0.5), { tone: "lo" }));
  out.push(S(k.slabOf(GEN, 12, 24, P, 8, 0.6), { tone: "mid", inner: [17, 21, 25, 29, 33].map((z) => L(k.sideSeam(GEN, z, P, 8), { tone: "faint" })).join("") }));
  const box = { x: 90, y: -5, w: 10, d: 10, r: 1 };
  out.push(S(k.slabOf(box, 36, 5, P, 3, 0.4), { tone: "mid" }));
  out.push(L([[92.5, -2.5], [97.5, -2.5], [95, 2.5]].map(([x, y]) => k.ring(x, y, 1.2, 41, P, 12)).join(""), { tone: "lo" }));
  out.push(D([[92.5, -2.5], [97.5, -2.5], [95, 2.5]].map(([x, y]) => at([x, y, 41])), { size: 0.5, tone: "hi" }));
  return out.join("");
}

function feedPump() {
  const [x, y] = FEED;
  return [
    S(k.cylinder(x, y, 6, 0, 2.4, P, 28), { tone: "lo" }),
    S(k.cylinder(x, y, 5, 2.4, 22, P, 28, 0.4), { tone: "mid", inner: L(k.knurl(x, y, 5, 14, 24.4, 22, P), { tone: "lo" }) + L(k.sideArc(x, y, 5, 14, P, 20), { tone: "lo" }) }),
    S(k.cylinder(x, y, 3, 24.4, 6, P, 20), { tone: "mid", crease: "none" }),
    S(k.cylinder(x, y, 3.6, 30.4, 1.6, P, 20), { tone: "mid" }),
  ].join("");
}

function condensate() {
  return [duct([36, 16], [36, 28], 3, 4.4, "flow-cond-a"), elbow([36, 28], 3, 4.4), duct([36, 28], [FEED[0] + 5, 28], 3, 4.4, "flow-cond-b")].join("");
}

function coolingWater() {
  return [56, 66].map((x, i) => duct([x, 16], [x, PLATE.y + PLATE.d - 4], 5, 5, i ? "flow-cw-out" : "flow-cw-in", "lo")).join("");
}

function dial() {
  const [x, y] = DIAL;
  const box = { x: x - 11, y: y - 8, w: 22, d: 16, r: 2 };
  const out = [S(k.slabOf(box, 0, 4, P, 4, 0.5), { tone: "mid" })];
  out.push(S(k.cylinder(x, y, 7, 4, 1.6, P, 40, 0.3), { tone: "hi", crease: "lo" }));
  const t = k.radialTicks(x, y, 6.2, 10, 5, 5.6, [1, 1.8], P, (-120 * Math.PI) / 180, (240 * Math.PI) / 180);
  out.push(L(t.minor, { tone: "lo" }), L(t.major, { tone: "mid" }));
  out.push(D([at([box.x + 2.4, box.y + box.d - 2.4, 4]), at([box.x + box.w - 2.4, box.y + box.d - 2.4, 4])], { size: 0.4 }));
  return out.join("");
}
const needleAt = (f) => {
  const a = ((-120 + 240 * f) * Math.PI) / 180;
  return k.lineOnTop([DIAL[0] - Math.sin(a) * 1.4, DIAL[1] + Math.cos(a) * 1.4], [DIAL[0] + Math.sin(a) * 5.2, DIAL[1] - Math.cos(a) * 5.2], 5.8, P);
};

const svg = k.figureSvg({
  width: WIDTH,
  height: HEIGHT,
  label:
    "A bench model of a pressurised-water nuclear plant. Primary loop: the reactor vessel with control-rod drives, the main coolant pump, the pressuriser and the steam generator, joined by the hot and cold legs. Secondary loop: steam from the generator drives the turbine and electric generator, is condensed under the turbine by cooling water, and the feed pump returns the water to the steam generator.",
  body: [
    plate(),
    pressurizer(),
    reactor(),
    `<g data-part="rods">${rodsSvg()}</g>`,
    rodHousings(),
    hotLeg(),
    steamGenerator(),
    steamLine(),
    coldLeg(),
    dial(),
    `<path data-part="needle" class="iso-line" data-tone="hi" data-free="start" d="${needleAt(0)}" style="stroke-width:0.9"/>`,
    D([at([DIAL[0], DIAL[1], 5.8])], { size: 0.55, tone: "hi" }),
    feedLine(),
    condenser(),
    turbine(),
    steamDown(),
    coupling(),
    `<path data-part="spoke" class="iso-line" data-tone="hi" d="${spokeAt(0)}"/>`,
    generator(),
    feedPump(),
    condensate(),
    coolingWater(),
  ],
});

const live = `
const P = ${JSON.stringify(P)};
const DIAL = ${JSON.stringify(DIAL)}, COUPLING = ${JSON.stringify(COUPLING)}, ROD_TRAVEL = ${ROD_TRAVEL};
const needleAt = ${needleAt.toString().replace("k.lineOnTop", "lineOnTop")};
const spokeAt = ${spokeAt.toString().replace("k.segment", "segment")};
const stage = document.querySelector(".iso-stage");
const svg = stage.querySelector("svg");
const rods = svg.querySelector('[data-part="rods"]'), needle = svg.querySelector('[data-part="needle"]'), spoke = svg.querySelector('[data-part="spoke"]');
const readout = document.querySelector("[data-readout]");
const still = matchMedia("(prefers-reduced-motion: reduce)");
const flows = (sel) => [...svg.querySelectorAll(sel)];
const primary = flows(".flow-hot,.flow-cold-r,.flow-cold-a,.flow-cold-b,.flow-cold-c");
const secondary = flows(".flow-steam,.flow-feed-a,.flow-feed-b,.flow-cond-a,.flow-cond-b");
const cooling = flows(".flow-cw-in,.flow-cw-out");
// direction of travel: +1 along the drawn path, -1 against it
const dir = new Map([[".flow-hot", 1], [".flow-cold-r", -1], [".flow-cold-a", -1], [".flow-cold-b", -1], [".flow-cold-c", 1], [".flow-steam", 1], [".flow-feed-a", 1], [".flow-feed-b", 1], [".flow-cond-a", 1], [".flow-cond-b", 1], [".flow-cw-in", -1], [".flow-cw-out", 1]]);
const sign = (el) => { for (const [s, d] of dir) if (el.matches(s)) return d; return 1; };

// ---- model (VVER-1000 nameplate) ----
// rods: withdrawal 0..1. Steady thermal power rises with withdrawal, follows with a 2 s lag.
const NOM_TH = 3000, EFF = 0.33, T_COLD = 290, DT_NOM = 30, RPM = 3000;
const steady = (w) => NOM_TH * Math.pow(Math.min(1, Math.max(0, (w - 0.2) / 0.6)), 1.3);
let w = 0.8, target = 0.8, power = steady(0.8), rpm = RPM, angle = 0, offP = 0, offS = 0, offC = 0, scram = false;
let touring = !still.matches, clock = 0, idle = 0;
const tourAt = (t) => { const c = t % 20; return c < 6 ? 0.8 : c < 12 ? 0.5 : c < 14 ? 0.3 : 0.8; };

function draw() {
  rods.setAttribute("transform", translateAlong(P, [0, 0, w * ROD_TRAVEL]));
  const f = power / NOM_TH;
  needle.setAttribute("d", needleAt(Math.min(1.05, f)));
  spoke.setAttribute("d", spokeAt(angle));
  primary.forEach((el) => (el.style.strokeDashoffset = (-offP * sign(el)).toFixed(2)));
  secondary.forEach((el) => (el.style.strokeDashoffset = (-offS * sign(el)).toFixed(2)));
  cooling.forEach((el) => (el.style.strokeDashoffset = (-offC * sign(el)).toFixed(2)));
  const th = Math.round(power), el = Math.round(power * EFF * Math.min(1, rpm / RPM));
  const text = Math.round(w * 100) + "% · " + th + " МВт т · " + el + " МВт э · " + Math.round(T_COLD + DT_NOM * f) + "/" + T_COLD + " °C";
  if (readout.textContent !== text) readout.textContent = text;
}
let frame = 0, last = 0, visible = false;
function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
  last = now;
  const calm = still.matches;
  if (touring) { clock += dt; target = tourAt(clock); }
  const tau = scram ? 0.25 : 0.6; // rods fall fast on a trip
  w = calm ? target : w + (target - w) * (1 - Math.exp(-dt / tau));
  if (scram && w < 0.01) scram = false;
  const goal = steady(w);
  // after a trip, decay heat stays at ~6 % and falls away
  const floor = 0;
  power = calm ? goal : power + (goal - power) * (1 - Math.exp(-dt / 2));
  const f = power / NOM_TH;
  const running = f > 0.02;
  rpm = calm ? (running ? RPM : 0) : rpm + ((running ? RPM : 0) - rpm) * (1 - Math.exp(-dt / (running ? 1.5 : 4)));
  angle += (rpm / 60) * dt * 2 * Math.PI * 0.02; // shown at 1/50 of true speed
  offP += 14 * dt;                // main coolant pumps run at constant flow
  offS += 18 * f * dt;            // steam and feed flow follow the power
  offC += 10 * Math.min(1, f * 4) * dt;
  if (!calm) draw(); else draw();
  frame = visible ? requestAnimationFrame(tick) : 0;
}
const run = () => { if (!frame && visible) { last = 0; frame = requestAnimationFrame(tick); } };
new IntersectionObserver((e) => { visible = e[e.length - 1].isIntersecting; if (visible) run(); }, { rootMargin: "120px 0px" }).observe(stage);
const touch = (ms = 3600) => { touring = false; clearTimeout(idle); idle = setTimeout(() => { touring = !still.matches; clock = 0; }, ms); };
const clamp = (v) => Math.min(1, Math.max(0, v));
stage.addEventListener("pointermove", (e) => { const b = svg.getBoundingClientRect(); touch(); scram = false; target = clamp(1 - (e.clientY - b.top) / b.height * 1.25 + 0.1); });
stage.addEventListener("keydown", (e) => {
  if (e.key === " " || e.key === "Enter") { e.preventDefault(); touch(12000); scram = true; target = 0; describe(); return; }
  let d = 0;
  if (e.key === "ArrowUp" || e.key === "ArrowRight") d = 0.05;
  if (e.key === "ArrowDown" || e.key === "ArrowLeft") d = -0.05;
  if (!d) return;
  e.preventDefault(); touch(); scram = false; target = clamp(target + d); describe();
});
function describe() { stage.setAttribute("aria-valuenow", String(Math.round(target * 100))); stage.setAttribute("aria-valuetext", "Стержни извлечены на " + Math.round(target * 100) + " %"); }
draw();
`;

const style = `<style>.iso-line[class*="flow-"]{stroke-dasharray:2.2 4.2;stroke-width:0.9}</style>`;
const body = k.plateHtml({
  fig: "Fig 2",
  title: "АЭС с ВВЭР",
  hint: "↑↓ стержни · Space — АЗ",
  readout: "80% · 3000 МВт т · 990 МВт э · 320/290 °C",
  keys: [
    { mark: "lit", label: "Регулирующие стержни: выше — больше мощность" },
    { mark: "raised", label: "Первый контур: реактор → горячая нитка → парогенератор → ГЦН → реактор; компенсатор давления держит 15,7 МПа" },
    { mark: "flat", label: "Второй контур: пар → турбина → генератор; конденсатор → питательный насос → парогенератор" },
  ],
  caption:
    "Вода первого контура нагревается в реакторе с 290 до 320 °C и не кипит под давлением 15,7 МПа. В парогенераторе она отдаёт тепло воде второго контура, та превращается в пар 6,3 МПа и крутит турбину на 3000 об/мин (50 Гц). Пар конденсируется охлаждающей водой, и питательный насос возвращает воду в парогенератор. Номинал ВВЭР-1000: 3000 МВт тепловых, около 1000 МВт электрических, КПД ≈ 33 %. Контуры не смешиваются: радиоактивная вода остаётся в первом. Вращение муфты показано в 50 раз медленнее.",
  body: `${style}<div class="iso-stage" tabindex="0" role="slider" aria-label="АЭС: стрелки вверх и вниз двигают регулирующие стержни, пробел — аварийная защита" aria-valuemin="0" aria-valuemax="100" aria-valuenow="80">${svg}</div>`,
});

const file = theme === "light" ? "npp-light.html" : "npp.html";
writeFileSync(join(HERE, file), k.pageHtml({ title: "АЭС с ВВЭР", theme, body, script: kitScript() + live }));
console.log("wrote", file);
