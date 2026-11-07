// Token bucket rate limiter, drawn as a coin-token dispenser on a bench.
// node build.mjs [--light]  →  token-bucket.html / token-bucket-light.html
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "./kit/iso-kit.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const theme = process.argv.includes("--light") ? "light" : "dark";
const kitScript = () => readFileSync(join(HERE, "kit", "iso-kit.mjs"), "utf8").replace(/^export /gm, "");

const AZ = Number((process.argv.find((a) => a.startsWith('--az=')) || '--az=58').slice(5));
const WIDTH = 640;
const HEIGHT = 440;

// ---- the model's numbers ----------------------------------------------------
const CAPACITY = 10; // b: tokens the bucket holds
const RATES = [0.5, 1, 2, 3, 5]; // r: tokens added per second
const RATE_AT = 2;

// ---- world (units ≈ mm) -----------------------------------------------------
const PLATE = { x: -96, y: -62, w: 180, d: 118, r: 8 };
const PLATE_H = 10;
const FOOT_H = 5;

const COIN_R = 12;
const COIN_T = 3.6;
const FLOOR = 10; // top of the dispenser block: the stack stands here
const BED = FLOOR + CAPACITY * COIN_T; // 46: rail bed; a full stack is flush with it

const BLOCK = { x: -17, y: -19, w: 34, d: 35, r: 2 };
const RODS = [[-14.5, 3.5], [3.5, -14.5]];
const RAIL_Y = 13; // inner face of the side lips
const LIP_D = 2.4;
const PLATE_T = 2.5;
const LEFT_BED = { x: -50, y: -RAIL_Y, w: 37, d: RAIL_Y * 2, r: 0.6 };
const RIGHT_BED = { x: 13, y: -RAIL_Y, w: 19, d: RAIL_Y * 2, r: 0.6 };
const LIP_X = [-50, 32];
const POSTS = [[24, -RAIL_Y - LIP_D / 2], [24, RAIL_Y + LIP_D / 2]];

const MAG = { x: -76, y: -16, w: 26, d: 32, r: 2 };
const MAG_TOP = BED - PLATE_T;
const FEED_C = -63; // centre of a waiting coin in the magazine
const RELEASE_C = -38; // centre of the coin at the end of the feed stroke
const TUBE = { c: [FEED_C, 0], r: 13.6, z0: BED + 4.4, z1: BED + 30 };

const HOUSING = { x: -11, y: -54, w: 22, d: 22, r: 2 };
const HOUSING_H = 18;
const PUSHER = { x: -8, y: -44, w: 16, d: 31.5, r: 0.8 }; // front at y = -12.5 at rest
const PUSH_STROKE = 14.5;

const TRAY = { x: -15, y: 17, w: 30, d: 32, r: 2 };
const TRAY_FLOOR = 2.4;

const BIN = { x: 34, y: -16, w: 32, d: 32, r: 2 };
const BIN_H = 15;
const BIN_FLOOR = 2;

const KNOB = [-63, 26];
const LEDGE = { x: -74, y: 16, w: 22, d: 20, r: 2 };
const LEDGE_Z = 28;

const FLAG = [-27, 36];

const P = k.fitProjection(
  [
    ...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0),
    [TUBE.c[0], TUBE.c[1] - TUBE.r, TUBE.z1 + 1],
    [TUBE.c[0] - TUBE.r, TUBE.c[1], TUBE.z1 + 1],
  ],
  WIDTH,
  HEIGHT,
  { pad: 30, azimuth: AZ },
);

const at = (point) => k.iso(point, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const D = (points, style) => k.dotsSvg(points, style);
const byDepth = (points) => [...points].sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));
const angleOf = (index) => ((-110 + (220 * index) / (RATES.length - 1)) * Math.PI) / 180;

// ---- static parts -----------------------------------------------------------
function plate() {
  const out = [`<path class="iso-halo" d="${k.haloOf(PLATE, -PLATE_H - FOOT_H, PLATE_H, P)}"/>`];
  for (const [x, y] of byDepth(k.corners(PLATE, 18))) {
    out.push(S(k.cylinder(x, y, 7, -PLATE_H - FOOT_H, 1.6, P, 28), { tone: "lo" }));
    out.push(S(k.cylinder(x, y, 5.4, -PLATE_H - FOOT_H + 1.6, FOOT_H - 1.6, P, 28), { tone: "mid" }));
  }
  out.push(S(k.slabOf(PLATE, -PLATE_H, PLATE_H, P, 8, 1.6), { tone: "mid" }));
  out.push(L(k.planOutline(k.insetPlan(PLATE, 5), 0, P), { tone: "lo" }));
  const screws = k.corners(PLATE, 10);
  out.push(L(screws.map(([x, y]) => k.ring(x, y, 2.2, 0, P, 16)).join(""), { tone: "lo" }));
  out.push(D(screws.map(([x, y]) => at([x, y, 0])), { size: 0.5 }));
  // ruler strip along the front edge
  const strip = { x: 0, y: PLATE.y + PLATE.d - 14, w: 74, d: 6, r: 1 };
  out.push(S(k.slabOf(strip, 0, 0.6, P, 3), { tone: "lo", crease: "none" }));
  const ticks = k.topTicks(strip.x + 3, strip.x + strip.w - 3, 3.6, 5, strip.y + 0.6, 0.6, [1.8, 3.4], P);
  out.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));
  out.push(D([at([strip.x + 1.6, strip.y + 3, 0.6]), at([strip.x + strip.w - 1.6, strip.y + 3, 0.6])], { size: 0.45 }));
  // label plate at the back right
  const label = { x: 40, y: -50, w: 34, d: 16, r: 1.5 };
  out.push(S(k.slabOf(label, 0, 0.8, P, 4), { tone: "lo", crease: "none" }));
  out.push(L(k.planOutline(k.insetPlan(label, 1.6), 0.8, P, 4), { tone: "faint" }));
  [[22, 4.6], [16, 8], [19, 11.4]].forEach(([w, y]) => out.push(L(k.lineOnTop([label.x + 5, label.y + y], [label.x + 5 + w, label.y + y], 0.8, P), { tone: "lo", free: true })));
  out.push(D([at([label.x + label.w - 3.4, label.y + 3.4, 0.8]), at([label.x + label.w - 3.4, label.y + label.d - 3.4, 0.8])], { size: 0.45 }));
  return out.join("");
}

function terminal() {
  // terminal block and cable from the push solenoid
  const out = [];
  const block = { x: -46, y: -56, w: 18, d: 10, r: 1.2 };
  out.push(S(k.slabOf(block, 0, 5, P, 3, 0.4), { tone: "mid" }));
  const pins = [-41, -37, -33];
  out.push(L(pins.map((x) => k.ring(x, -51, 1.3, 5, P, 12)).join(""), { tone: "lo" }));
  out.push(D(pins.map((x) => at([x, -51, 5])), { size: 0.5, tone: "hi" }));
  out.push(k.wireSvg(at([-33, -51, 5]), at([HOUSING.x, -45, 6]), { via: [at([-22, -51, 5]), at([-18, -45, 6])], tone: "lo" }));
  out.push(k.wireSvg(at([-37, -51, 5]), at([HOUSING.x, -41, 6]), { via: [at([-30, -47, 5]), at([-22, -41, 6])], tone: "lo" }));
  return out.join("");
}

function magazine() {
  const out = [];
  out.push(`<path class="iso-halo" d="${k.haloOf(k.insetPlan(MAG, -2), 0, 0.1, P)}" style="filter:blur(3px)"/>`);
  out.push(S(k.slabOf(MAG, 0, 6, P, 4, 0.6), { tone: "lo" }));
  const body = k.insetPlan(MAG, 1.4);
  out.push(S(k.slabOf(body, 6, MAG_TOP - 6, P, 4, 0.8), { tone: "mid", inner: L(k.sideSeam(body, 20, P, 4), { tone: "faint" }) + L(k.sideSeam(body, 34, P, 4), { tone: "faint" }) }));
  // vents on the front face (closed slots)
  for (let i = 0; i < 4; i++) {
    const z = 10 + i * 2.4;
    const y = body.y + body.d;
    out.push(L(k.pathOf([at([-70, y, z]), at([-58, y, z]), at([-58, y, z + 1]), at([-70, y, z + 1])], true), { tone: "lo" }));
  }
  out.push(D([at([body.x + 3, body.y + body.d, 26]), at([body.x + body.w - 3, body.y + body.d, 26]), at([body.x + body.w, body.y + body.d - 3, 26]), at([body.x + body.w, body.y + 3, 26])], { size: 0.45 }));
  // deck at bed level
  const deck = { x: MAG.x, y: -RAIL_Y - LIP_D, w: MAG.w, d: (RAIL_Y + LIP_D) * 2, r: 1 };
  out.push(S(k.slabOf(deck, MAG_TOP, PLATE_T, P, 3, 0.4), { tone: "mid" }));
  // feed guide behind the coin
  out.push(S(k.slabOf({ x: MAG.x, y: -9, w: 3, d: 18, r: 0.6 }, BED, 3.4, P, 2), { tone: "mid" }));
  return out.join("");
}

function feedPusherSvg() {
  // built at rest: front face at x = FEED_C - COIN_R
  const front = FEED_C - COIN_R;
  return [
    S(k.slabOf({ x: front - 30, y: -2.2, w: 30, d: 4.4, r: 0.6 }, BED + 0.6, 2.2, P, 2), { tone: "mid", crease: "none" }),
    S(k.slabOf({ x: front - 2.4, y: -7, w: 2.4, d: 14, r: 0.6 }, BED + 0.2, 3, P, 2, 0.3), { tone: "hi" }),
  ].join("");
}

function tubeAndLedge() {
  const out = [];
  const [cx, cy] = TUBE.c;
  // standoffs carrying the reserve tube over the feed gap
  for (const [x, y] of byDepth([[cx - 11, cy - 11], [cx - 11, cy + 11], [cx + 11, cy - 11]])) out.push(S(k.cylinder(x, y, 1.4, BED, TUBE.z0 - BED, P, 12), { tone: "mid", crease: "none" }));
  out.push(S(k.cylinder(cx, cy, TUBE.r + 1.2, TUBE.z0, 2.4, P, 48, 0.4), { tone: "mid" }));
  out.push(S(k.cylinder(cx, cy, TUBE.r, TUBE.z0 + 2.4, TUBE.z1 - TUBE.z0 - 4.8, P, 48), { tone: "mid", crease: "none", inner: L(k.sideArc(cx, cy, TUBE.r, TUBE.z0 + 12, P, 32), { tone: "faint" }) }));
  out.push(S(k.cylinder(cx, cy, TUBE.r + 1.2, TUBE.z1 - 2.4, 2.4, P, 48, 0.4), { tone: "mid" }));
  out.push(L(k.ring(cx, cy, TUBE.r - 0.8, TUBE.z1, P, 48), { tone: "lo" }));
  // reserve coin seen in the open top
  out.push(L(k.ring(cx, cy, COIN_R - 1.4, TUBE.z1, P, 40), { tone: "faint" }));
  out.push(D([at([cx, cy, TUBE.z1])], { size: 0.45, tone: "lo" }));
  return out.join("");
}

function rateDial() {
  const out = [];
  out.push(S(k.slabOf({ x: LEDGE.x + 4, y: MAG.y + MAG.d - 1.4, w: 4, d: LEDGE.y - MAG.y - MAG.d + 1.4 + 2, r: 0.6 }, 6, LEDGE_Z - 6, P, 2), { tone: "mid", crease: "none" }));
  out.push(S(k.slabOf(LEDGE, LEDGE_Z, 3, P, 4, 0.5), { tone: "mid" }));
  const [x, y] = KNOB;
  const top = LEDGE_Z + 3;
  const ticks = k.radialTicks(x, y, 9.2, RATES.length - 1, 1, top, [1.4, 2.2], P, angleOf(0), angleOf(RATES.length - 1) - angleOf(0));
  out.push(L(ticks.major, { tone: "mid" }));
  out.push(D([at([LEDGE.x + 2.6, LEDGE.y + LEDGE.d - 2.6, top]), at([LEDGE.x + LEDGE.w - 2.6, LEDGE.y + LEDGE.d - 2.6, top])], { size: 0.45 }));
  out.push(S(k.cylinder(x, y, 6.4, top, 1.2, P, 32), { tone: "lo" }));
  out.push(S(k.cylinder(x, y, 5.6, top + 1.2, 4.6, P, 32, 0.4), { tone: "mid" }));
  out.push(L(k.knurl(x, y, 5.6, top + 1.2, top + 5.8, 36, P), { tone: "lo" }));
  return out.join("");
}

const KNOB_TOP = LEDGE_Z + 3 + 5.8;
const pointerAt = (angle) => k.lineOnTop([KNOB[0], KNOB[1]], [KNOB[0] + Math.sin(angle) * 4.8, KNOB[1] - Math.cos(angle) * 4.8], KNOB_TOP, P);

function backRail() {
  const out = [];
  const [px, py] = POSTS[0];
  out.push(S(k.cylinder(px, py, 3.6, 0, 2, P, 20), { tone: "lo" }));
  out.push(D(k.circleRing(px, py, 2.9, 4).map(([x, y]) => at([x, y, 2])), { size: 0.35 }));
  out.push(S(k.cylinder(px, py, 2.2, 2, BED - PLATE_T - 6, P, 18), { tone: "mid", crease: "none", inner: L(k.sideArc(px, py, 2.2, 20, P, 12), { tone: "faint" }) }));
  out.push(S(k.slabOf({ x: LIP_X[0], y: -RAIL_Y - LIP_D, w: LIP_X[1] - LIP_X[0], d: LIP_D, r: 0.5 }, BED - PLATE_T, PLATE_T + 2.6, P, 2, 0.3), { tone: "mid" }));
  out.push(D([-44, -4, 26].map((x) => at([x, -RAIL_Y - LIP_D / 2, BED + 2.6])), { size: 0.4 }));
  return out.join("");
}

function column() {
  const out = [];
  out.push(S(k.slabOf(LEFT_BED, BED - PLATE_T, PLATE_T, P, 2, 0.3), { tone: "mid" }));
  out.push(L(k.lineOnTop([LEFT_BED.x + 2, 0], [LEFT_BED.x + LEFT_BED.w, 0], BED, P), { tone: "faint" }));
  for (const [x, y] of byDepth(RODS)) {
    out.push(S(k.cylinder(x, y, 2.6, FLOOR, 1.6, P, 16), { tone: "lo" }));
    out.push(S(k.cylinder(x, y, 1.5, FLOOR + 1.6, BED - PLATE_T - FLOOR - 1.6, P, 16), { tone: "mid", crease: "none" }));
  }
  return out.join("");
}

function housing() {
  const out = [];
  out.push(S(k.slabOf(HOUSING, 0, HOUSING_H, P, 4, 0.8), { tone: "mid", inner: L(k.sideSeam(HOUSING, 6, P, 4), { tone: "faint" }) }));
  out.push(L(k.planOutline(k.insetPlan(HOUSING, 3), HOUSING_H, P, 3), { tone: "faint" }));
  out.push(D(k.corners(HOUSING, 2.6).map(([x, y]) => at([x, y, HOUSING_H])), { size: 0.45 }));
  // slot the pusher runs through
  const y = HOUSING.y + HOUSING.d;
  out.push(L(k.pathOf([at([-9, y, FLOOR - 0.4]), at([9, y, FLOOR - 0.4]), at([9, y, FLOOR + 4]), at([-9, y, FLOOR + 4])], true), { tone: "lo" }));
  return out.join("");
}

function block() {
  const out = [];
  out.push(`<path class="iso-halo" d="${k.haloOf(k.insetPlan(BLOCK, -2), 0, 0.1, P)}" style="filter:blur(3px)"/>`);
  out.push(S(k.slabOf(BLOCK, 0, FLOOR, P, 4, 0.6), { tone: "mid", inner: L(k.sideSeam(BLOCK, 4, P, 4), { tone: "faint" }) }));
  // pusher channel and coin seat on top
  out.push(L(k.planOutline({ x: -8.6, y: BLOCK.y, w: 17.2, d: 18, r: 0.4 }, FLOOR, P, 2), { tone: "faint" }));
  out.push(L(k.ring(0, 0, COIN_R + 0.8, FLOOR, P, 48), { tone: "faint" }));
  out.push(D([[BLOCK.x + 3, BLOCK.y + 3], [BLOCK.x + BLOCK.w - 3, BLOCK.y + 3], [BLOCK.x + BLOCK.w - 3, BLOCK.y + BLOCK.d - 3], [BLOCK.x + 3, BLOCK.y + BLOCK.d - 3]].map(([x, y]) => at([x, y, FLOOR])), { size: 0.45 }));
  return out.join("");
}

function pusherSvg() {
  const out = [];
  out.push(S(k.slabOf(PUSHER, FLOOR, COIN_T - 0.2, P, 2, 0.3), { tone: "hi", crease: "lo" }));
  out.push(L(k.planOutline({ x: PUSHER.x + 3, y: PUSHER.y + PUSHER.d - 9, w: PUSHER.w - 6, d: 3, r: 1.4 }, FLOOR + COIN_T - 0.2, P, 3), { tone: "faint" }));
  return out.join("");
}

function tray() {
  const out = [];
  out.push(S(k.slabOf(TRAY, 0, TRAY_FLOOR, P, 4, 0.5), { tone: "mid" }));
  out.push(L(k.planOutline(k.insetPlan(TRAY, 3), TRAY_FLOOR, P, 3), { tone: "faint" }));
  for (const x of [TRAY.x, TRAY.x + TRAY.w - 2]) out.push(S(k.slabOf({ x, y: TRAY.y, w: 2, d: TRAY.d, r: 0.5 }, TRAY_FLOOR, 3, P, 2, 0.3), { tone: "mid" }));
  return out.join("");
}

function trayFront() {
  return S(k.slabOf({ x: TRAY.x + 2, y: TRAY.y + TRAY.d - 2, w: TRAY.w - 4, d: 2, r: 0.4 }, TRAY_FLOOR, 3, P, 2, 0.3), { tone: "mid" });
}

function flagPost() {
  const out = [];
  const [x, y] = FLAG;
  out.push(S(k.cylinder(x, y, 3.4, 0, 2, P, 20), { tone: "lo" }));
  out.push(S(k.cylinder(x, y, 1.2, 2, 30, P, 14), { tone: "mid", crease: "none" }));
  out.push(S(k.cylinder(x, y, 1.8, 32, 1.4, P, 14), { tone: "mid" }));
  return out.join("");
}

function flagSvg() {
  // built at rest, hanging low on the post
  const [x, y] = FLAG;
  return [
    S(k.slabOf({ x: x - 2, y: y - 2, w: 4, d: 4, r: 1 }, 4, 3.4, P, 3), { tone: "mid" }),
    S(k.slabOf({ x: x + 2, y: y - 0.6, w: 11, d: 1.2, r: 0.3 }, 3, 7, P, 2), { tone: "hi", crease: "lo" }),
  ].join("");
}

function rightBed() {
  const out = [];
  const [px] = POSTS[0];
  out.push(S(k.slabOf({ x: px - 3, y: -RAIL_Y - LIP_D - 1, w: 6, d: RAIL_Y * 2 + LIP_D + 1, r: 0.8 }, BED - PLATE_T - 4, 4, P, 2, 0.3), { tone: "mid" }));
  out.push(S(k.slabOf(RIGHT_BED, BED - PLATE_T, PLATE_T, P, 2, 0.3), { tone: "mid" }));
  out.push(L(k.lineOnTop([RIGHT_BED.x, 0], [RIGHT_BED.x + RIGHT_BED.w - 2, 0], BED, P), { tone: "faint" }));
  return out.join("");
}

function binBack() {
  const out = [];
  out.push(`<path class="iso-halo" d="${k.haloOf(k.insetPlan(BIN, -2), 0, 0.1, P)}" style="filter:blur(3px)"/>`);
  out.push(S(k.slabOf(BIN, 0, BIN_FLOOR, P, 4, 0.4), { tone: "lo" }));
  out.push(L(k.planOutline(k.insetPlan(BIN, 6), BIN_FLOOR, P, 3), { tone: "faint" }));
  out.push(S(k.slabOf({ x: BIN.x, y: BIN.y, w: 2, d: BIN.d, r: 0.5 }, BIN_FLOOR, BIN_H - BIN_FLOOR, P, 2, 0.3), { tone: "mid" }));
  out.push(S(k.slabOf({ x: BIN.x, y: BIN.y, w: BIN.w, d: 2, r: 0.5 }, BIN_FLOOR, BIN_H - BIN_FLOOR, P, 2, 0.3), { tone: "mid" }));
  return out.join("");
}

function binFront() {
  const out = [];
  const side = { x: BIN.x + BIN.w - 2, y: BIN.y + 2, w: 2, d: BIN.d - 2, r: 0.5 };
  const front = { x: BIN.x + 2, y: BIN.y + BIN.d - 2, w: BIN.w - 2, d: 2, r: 0.5 };
  out.push(S(k.slabOf(side, BIN_FLOOR, BIN_H - BIN_FLOOR, P, 2, 0.3), { tone: "mid" }));
  out.push(S(k.slabOf(front, BIN_FLOOR, BIN_H - BIN_FLOOR, P, 2, 0.3), { tone: "mid" }));
  out.push(D([at([BIN.x + BIN.w - 1, BIN.y + 5, BIN_H]), at([BIN.x + BIN.w - 1, BIN.y + BIN.d - 5, BIN_H]), at([BIN.x + 5, BIN.y + BIN.d - 1, BIN_H])], { size: 0.4 }));
  return out.join("");
}

function frontRail() {
  const out = [];
  // the front lip stops either side of the column so the stack stays in view
  for (const [x0, x1] of [[LIP_X[0], LEFT_BED.x + LEFT_BED.w]]) out.push(S(k.slabOf({ x: x0, y: RAIL_Y, w: x1 - x0, d: LIP_D, r: 0.5 }, BED - PLATE_T, PLATE_T + 2.6, P, 2, 0.3), { tone: "mid" }));
  out.push(D([-44, -19].map((px) => at([px, RAIL_Y + LIP_D / 2, BED + 2.6])), { size: 0.4 }));
  return out.join("");
}

function coinSvg(lit) {
  const out = [];
  out.push(S(k.cylinder(0, 0, COIN_R, 0, COIN_T, P, 48, 0.5), { tone: "hi", crease: "lo", lit, inner: L(k.knurl(0, 0, COIN_R, 0.5, COIN_T - 0.5, 72, P, 0.3), { tone: "faint" }) }));
  out.push(L(k.ring(0, 0, COIN_R - 1.6, COIN_T, P, 48), { tone: lit ? "mid" : "faint" }));
  out.push(L(k.ring(0, 0, 4.2, COIN_T, P, 28), { tone: lit ? "mid" : "faint" }));
  return out.join("");
}

// ---- assemble ---------------------------------------------------------------
const STACK_POOL = CAPACITY + 2;
const OUT_POOL = 5;
const SPILL_POOL = 7;
const coinG = (part, lit, index) => `<g data-coin="${part}" data-i="${index}" style="display:none">${coinSvg(lit)}</g>`;

const svg = k.figureSvg({
  width: WIDTH,
  height: HEIGHT,
  label:
    "A token bucket drawn as a coin dispenser on a bench. A feed pusher slides coins out of a reserve tube at a set rate onto a rail; each one drops into a column that holds ten. A request fires a pusher under the column that takes the bottom coin out onto a tray. With no coin in the column the request is refused and a flag rises; when the column is full, new coins slide over it and spill into a bin.",
  body: [
    plate(),
    terminal(),
    magazine(),
    `<g data-part="waiting">${coinG("wait", false, 0).replace(' style="display:none"', "")}</g>`,
    `<g data-part="feeder">${feedPusherSvg()}</g>`,
    tubeAndLedge(),
    rateDial(),
    `<path data-part="pointer" class="iso-line" data-tone="hi" data-free="end" d="${pointerAt(angleOf(RATE_AT))}" style="stroke-width:0.9"/>`,
    D([at([KNOB[0], KNOB[1], KNOB_TOP])], { size: 0.55, tone: "hi" }),
    backRail(),
    column(),
    housing(),
    block(),
    tray(),
    `<g data-part="pusher">${pusherSvg()}</g>`,
    `<g data-slot="stack">${Array.from({ length: STACK_POOL }, (_, i) => coinG("stack", false, i)).join("")}${Array.from({ length: OUT_POOL }, (_, i) => coinG("out", true, i)).join("")}</g>`,
    `<g data-slot="drop"></g>`,
    trayFront(),
    rightBed(),
    `<g data-slot="rail">${[0, 1, 2].map((i) => coinG("feed", true, i)).join("")}</g>`,
    binBack(),
    `<g data-slot="bin">${Array.from({ length: SPILL_POOL }, (_, i) => coinG("spill", false, i)).join("")}</g>`,
    binFront(),
    frontRail(),
    flagPost(),
    `<g data-part="flag">${flagSvg()}</g>`,
  ],
});

// ---- live -------------------------------------------------------------------
const live = `
const P = ${JSON.stringify(P)};
const CAP = ${CAPACITY}, RATES = ${JSON.stringify(RATES)};
const T = ${COIN_T}, R = ${COIN_R}, FLOOR = ${FLOOR}, BED = ${BED};
const FEED_C = ${FEED_C}, RELEASE_C = ${RELEASE_C}, STROKE = ${PUSH_STROKE};
const TRAY_Z = ${TRAY_FLOOR}, BIN = ${JSON.stringify(BIN)}, BIN_FLOOR = ${BIN_FLOOR}, BLOCK_FRONT = ${BLOCK.y + BLOCK.d}, RIGHT_END = ${RIGHT_BED.x + RIGHT_BED.w};
const KNOB = ${JSON.stringify(KNOB)}, KNOB_TOP = ${KNOB_TOP};
const angleOf = ${angleOf.toString().replace("RATES.length", String(RATES.length))};
const pointerAt = (angle) => lineOnTop([KNOB[0], KNOB[1]], [KNOB[0] + Math.sin(angle) * 4.8, KNOB[1] - Math.cos(angle) * 4.8], KNOB_TOP, P);
const G = 2600; // gravity, units/s² (eased for reading)

const stage = document.querySelector(".iso-stage");
const svg = stage.querySelector("svg");
const $ = (q) => svg.querySelector(q);
const readout = document.querySelector("[data-readout]");
const still = matchMedia("(prefers-reduced-motion: reduce)");
const slots = { stack: $('[data-slot="stack"]'), drop: $('[data-slot="drop"]'), rail: $('[data-slot="rail"]'), bin: $('[data-slot="bin"]') };
const feederEl = $('[data-part="feeder"]'), waitEl = $('[data-part="waiting"] g'), pusherEl = $('[data-part="pusher"]'), flagEl = $('[data-part="flag"]'), pointerEl = $('[data-part="pointer"]');
const pool = (name) => [...svg.querySelectorAll('[data-coin="' + name + '"]')];
const stackEls = pool("stack"), outEls = pool("out"), spillEls = pool("spill"), feedEls = pool("feed");
const place = (el, x, y, z, alpha = 1) => { el.setAttribute("transform", translateAlong(P, [x, y, z])); el.style.display = alpha > 0.01 ? "" : "none"; el.style.opacity = alpha < 1 ? alpha.toFixed(3) : ""; };

// ---- model: the token bucket itself ----
// n whole tokens (coins committed to the column) plus the fraction the feed pusher has travelled.
// A request passes when n >= 1 and spends one. A coin that arrives while n = b is discarded.
const M = { rate: 2, n: CAP, passed: 0, limited: 0, spilled: 0 };
let fraction = 0;
// ---- visual state ----
let rateIndex = ${RATE_AT};
const coins = []; // in the column, bottom first: {el, z, v}
const feeds = []; // coins travelling from the feeder: {el, x, z, v, vx, over, dropping}
const outs = []; // coins pushed out to the tray
const spills = []; // coins in the bin
let push = null;
const queue = []; // pending push strokes (true = pass, false = refused)
const flag = { z: 0, v: 0, hold: 0 };

const used = (list, el) => list.some((c) => c.el === el);
const freeStackEl = () => stackEls.find((el) => !used(coins, el));
for (let i = 0; i < CAP; i++) coins.push({ el: freeStackEl(), z: FLOOR + i * T, v: 0 });
const stackTop = (n) => FLOOR + n * T;

function request() {
  const ok = M.n >= 1;
  if (ok) { M.n -= 1; M.passed++; } else M.limited++;
  queue.push(ok);
  if (queue.length > 8) queue.splice(0, queue.length - 8);
  describe();
  run();
}

function release() {
  const over = M.n >= CAP;
  if (over) M.spilled++; else M.n++;
  const el = feedEls.find((e) => !used(feeds, e));
  if (!el) { const f = feeds.shift(); finish(f); return release2(over, f.el); }
  release2(over, el);
}
function release2(over, el) { feeds.push({ el, x: RELEASE_C, z: BED, v: 0, vx: 120, over, dropping: false }); }

function finish(f) {
  if (!f.over) { coins.push({ el: freeStackEl(), z: f.z, v: f.v }); }
  else {
    const el = spillEls.find((e) => !used(spills, e)) || spills.shift().el;
    const pileZ = BIN_FLOOR + Math.min(spills.length, 1) * T;
    spills.push({ el, x: BIN.x + BIN.w / 2 + (Math.random() - 0.5) * 7, y: (Math.random() - 0.5) * 7, z: pileZ, life: 1 });
    if (spills.length > 4) spills[0].fading = true;
  }
  f.el.style.display = "none";
}

function step(dt, calm) {
  // refill: r tokens per second; the stroke completes once per 1/r seconds
  fraction += M.rate * dt;
  while (fraction >= 1) { fraction -= 1; release(); }

  for (let i = feeds.length - 1; i >= 0; i--) {
    const f = feeds[i];
    let done = false;
    if (!f.dropping) {
      f.vx += 1500 * dt; f.x += f.vx * dt;
      if (!f.over && f.x >= 0) { f.x = 0; f.dropping = true; f.v = 0; }
      if (f.over && f.x >= RIGHT_END + R * 0.55) { f.dropping = true; f.v = 0; }
    } else if (!f.over) {
      const below = coins.length + (push && !push.dropped && push.coin ? 1 : 0) + feeds.slice(0, i).filter((g) => !g.over).length;
      const floorZ = stackTop(below);
      f.v += G * dt; f.z -= f.v * dt;
      if (f.z <= floorZ) { f.z = floorZ; done = true; }
    } else {
      f.v += G * dt; f.z -= f.v * dt; f.x += 40 * dt;
      if (f.z <= BIN_FLOOR + Math.min(spills.length, 1) * T) done = true;
    }
    if (calm) done = true;
    if (done) { feeds.splice(i, 1); finish(f); }
  }

  // a push stroke: out and back; the stack rests on the pusher until it withdraws
  if (!push && queue.length) {
    const ok = queue.shift();
    if (ok && !coins.length) { const f = feeds.find((g) => !g.over); if (f) { feeds.splice(feeds.indexOf(f), 1); f.z = FLOOR; finish(f); } }
    const coin = ok ? coins.shift() : null;
    push = { t: 0, dur: queue.length ? Math.max(0.07, 0.24 / (1 + queue.length)) : 0.3, coin, dropped: false };
    if (coin) {
      const el = outEls.find((e) => !used(outs, e)) || outs.shift().el;
      push.out = { el, x: 0, y: 0, z: FLOOR, v: 0, vy: 0, life: 1, pushed: true };
      outs.push(push.out);
    }
    if (!ok) flag.hold = 0.9;
  }
  let ext = 0;
  if (push) {
    push.t += dt;
    const p = calm ? 1 : Math.min(1, push.t / push.dur);
    ext = calm ? 0 : Math.sin(Math.PI * p);
    if (push.out && push.out.pushed) {
      push.out.y = Math.max(push.out.y, ext * STROKE);
      if (p >= 0.5) { push.out.pushed = false; push.out.vy = 80; }
    }
    if (p >= 0.6) push.dropped = true;
    if (p >= 1) push = null;
  }
  pushExt = ext;

  // column coins fall onto whatever is under them
  const lift = push && !push.dropped && push.coin ? 1 : 0;
  coins.forEach((c, i) => {
    const target = stackTop(i + lift);
    if (calm || c.z <= target) { c.z = target; c.v = 0; return; }
    c.v += G * dt; c.z = Math.max(target, c.z - c.v * dt);
    if (c.z === target) c.v = 0;
  });

  // pushed coins slide off the block onto the tray, then are spent
  for (const o of outs) {
    if (o.pushed) continue;
    if (calm) { o.y = BLOCK_FRONT + 8; o.z = TRAY_Z; }
    o.y += o.vy * dt; o.vy = Math.max(0, o.vy - 90 * dt);
    if (o.y > BLOCK_FRONT - 4 && o.z > TRAY_Z) { o.v += G * dt; o.z = Math.max(TRAY_Z, o.z - o.v * dt); }
    if (o.z === TRAY_Z) { o.vy = Math.min(o.vy, 30); o.life -= dt / 0.9; }
  }
  for (let i = outs.length - 1; i >= 0; i--) if (outs[i].life <= 0) { outs[i].el.style.display = "none"; outs.splice(i, 1); }
  for (const s of spills) if (s.fading) s.life -= dt / 0.8;
  for (let i = spills.length - 1; i >= 0; i--) if (spills[i].life <= 0) { spills[i].el.style.display = "none"; spills.splice(i, 1); }

  // refused flag: rises on a spring, holds, drops back
  flag.hold = Math.max(0, flag.hold - dt);
  const fTarget = flag.hold > 0 ? 18 : 0;
  if (calm) { flag.z = fTarget; flag.v = 0; }
  else for (let i = 0; i < 4; i++) { flag.v += ((fTarget - flag.z) * 380 - flag.v * 22) * dt / 4; flag.z += flag.v * dt / 4; }
  if (flag.z < 0) { flag.z = 0; flag.v = 0; }
}
let pushExt = 0;

function draw() {
  feederEl.setAttribute("transform", translateAlong(P, [fraction * (RELEASE_C - FEED_C), 0, 0]));
  place(waitEl, FEED_C + fraction * (RELEASE_C - FEED_C), 0, BED);
  pusherEl.setAttribute("transform", translateAlong(P, [0, pushExt * STROKE, 0]));
  coins.forEach((c) => place(c.el, 0, 0, c.z));
  stackEls.forEach((el) => { if (!used(coins, el)) el.style.display = "none"; });
  for (const f of feeds) {
    const slot = f.over ? (f.dropping ? slots.bin : slots.rail) : f.dropping ? slots.drop : slots.rail;
    if (f.el.parentNode !== slot) slot.appendChild(f.el);
    place(f.el, f.x, 0, f.z);
  }
  [...outs].sort((a, b) => a.y - b.y).forEach((o) => { slots.stack.appendChild(o.el); place(o.el, o.x, o.y, o.z, Math.max(0, Math.min(1, o.life * 1.6))); });
  [...spills].sort((a, b) => a.z - b.z).forEach((s) => { slots.bin.insertBefore(s.el, slots.bin.firstChild); });
  spills.forEach((s) => place(s.el, s.x, s.y, s.z, Math.max(0, s.life)));
  flagEl.setAttribute("transform", translateAlong(P, [0, 0, flag.z]));
  pointerEl.setAttribute("d", pointerAt(angleOf(rateIndex)));
  const shown = Math.min(CAP, M.n + fraction);
  const text = shown.toFixed(1) + " / " + CAP + " tokens · +" + M.rate + "/s · " + M.passed + " passed · " + M.limited + " limited";
  if (readout.textContent !== text) readout.textContent = text;
}
function describe() {
  stage.setAttribute("aria-valuenow", String(rateIndex));
  stage.setAttribute("aria-valuetext", "Refill " + M.rate + " tokens per second, " + M.n + " of " + CAP + " tokens; " + M.passed + " requests passed, " + M.limited + " limited");
}

// ---- tour: a burst that drains the bucket, then a steady trickle ----
let touring = !still.matches, clock = 0, nextTour = 0.8, idleTimer = 0;
const TOUR = [];
for (let i = 0; i < 14; i++) TOUR.push(1.2 + i * 0.1);
for (let i = 0; i < 8; i++) TOUR.push(4.5 + i * 0.9);
const TOUR_LEN = 13;
let tourIndex = 0;
function tour(dt) {
  clock += dt;
  while (tourIndex < TOUR.length && clock >= TOUR[tourIndex]) { request(); tourIndex++; }
  if (clock >= TOUR_LEN) { clock = 0; tourIndex = 0; }
}

let frame = 0, last = 0, visible = false;
function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
  last = now;
  if (touring) tour(dt);
  step(dt, still.matches);
  draw();
  frame = visible ? requestAnimationFrame(tick) : 0;
}
const run = () => { if (!frame && visible) { last = 0; frame = requestAnimationFrame(tick); } };
new IntersectionObserver((entries) => { visible = entries[entries.length - 1].isIntersecting; if (visible) run(); }, { rootMargin: "120px 0px" }).observe(stage);

const touch = () => { touring = false; clearTimeout(idleTimer); idleTimer = setTimeout(() => { touring = !still.matches; clock = 0; tourIndex = 0; }, 3600); };
const setRate = (i) => { rateIndex = Math.max(0, Math.min(RATES.length - 1, i)); M.rate = RATES[rateIndex]; describe(); };
let holdTimer = 0;
const startHold = () => { touch(); request(); clearInterval(holdTimer); holdTimer = setInterval(() => { touch(); request(); }, 110); };
const stopHold = () => clearInterval(holdTimer);
stage.addEventListener("pointerdown", (e) => { e.preventDefault(); stage.focus({ preventScroll: true }); startHold(); });
addEventListener("pointerup", stopHold); addEventListener("pointercancel", stopHold); stage.addEventListener("pointerleave", stopHold);
stage.addEventListener("keydown", (e) => {
  if (e.key === " " || e.key === "Enter") { e.preventDefault(); if (!e.repeat) startHold(); return; }
  let to = null;
  if (e.key === "ArrowRight" || e.key === "ArrowUp") to = rateIndex + 1;
  if (e.key === "ArrowLeft" || e.key === "ArrowDown") to = rateIndex - 1;
  if (e.key === "Home") to = 0;
  if (e.key === "End") to = RATES.length - 1;
  if (to === null) return;
  e.preventDefault(); touch(); setRate(to);
});
stage.addEventListener("keyup", (e) => { if (e.key === " " || e.key === "Enter") stopHold(); });
setRate(rateIndex);
draw();
window.__tb = { M, request, setRate, get coins() { return coins.length; }, get feeds() { return feeds.length; } };
`;

const body = k.plateHtml({
  fig: "Fig 1",
  title: "Token bucket",
  hint: "Click or hold · ←/→ rate",
  readout: `${CAPACITY.toFixed(1)} / ${CAPACITY} tokens · +${RATES[RATE_AT]}/s · 0 passed · 0 limited`,
  keys: [
    { mark: "lit", label: "A token in motion: refilled from the magazine, or spent by a request" },
    { mark: "raised", label: "The column: the bucket, ten coins deep" },
    { mark: "flat", label: "Bin: tokens that arrive while the bucket is full are discarded" },
  ],
  caption:
    "A token bucket of capacity b = 10 refilled at r tokens per second (0.5–5, set on the knob). The feed pusher’s travel is the fractional token, so the readout is continuous. Each request needs one token: if the column holds a coin the pusher takes it and the request passes, otherwise it is limited and the flag rises. A burst can spend at most b tokens at once, and over time no more than r per second get through; coins that arrive at a full column slide over it into the bin.",
  body: `<div class="iso-stage" tabindex="0" role="slider" aria-label="Token bucket: click, Space or Enter sends a request (hold for a burst); arrow keys set the refill rate" aria-valuemin="0" aria-valuemax="${RATES.length - 1}" aria-valuenow="${RATE_AT}" style="touch-action:pan-y;cursor:pointer">${svg}</div>`,
});

const file = theme === "light" ? "token-bucket-light.html" : "token-bucket.html";
writeFileSync(join(HERE, file), k.pageHtml({ title: "Token bucket", theme, body, script: kitScript() + live }));
console.log("wrote", file);
