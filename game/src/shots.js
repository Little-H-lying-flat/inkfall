// Deterministic screenshot scenes. The pilots feed the real world one fixed
// step at a time, making the captured frames show the same game as play.
// The play scene keeps the liveliest frame it sees (most enemies, a fresh
// stroke, particles) and returns that state for the screenshot.

import { FIELD, INK, STEP } from './config.js';
import {
  EVENT_OVER, KIND_BOSS, KIND_GHOST,
} from './world.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const START_SECONDS = 5;
const PLAY_SECONDS = 150;
const END_LIMIT_SECONDS = 600;

function cuttable(enemy) {
  return enemy.active && (enemy.kind !== KIND_GHOST || enemy.visible);
}

function makePilot(kind) {
  // The good pilot saves ink with compact cuts between rapid diagonal bursts.
  // It lets a later-night crowd descend before starting a burst; all costs,
  // refunds, spawns and collisions still go through the unmodified world.
  const cooldownSteps = kind === 'poor' ? 90 : 5;
  let cooldown = 0;
  let burst = 0;
  let cutNumber = 0;
  let dramaticBurst = false;
  const burstTargets = new Set();

  function strokeFor(enemy, state, dramatic) {
    if (kind === 'poor' || !dramatic) {
      return {
        points: [
          { x: Math.max(0, enemy.x - enemy.r - 5), y: enemy.y },
          { x: Math.min(FIELD.width, enemy.x + enemy.r + 5), y: enemy.y },
        ],
        active: false,
      };
    }
    const available = state.ink / INK.costPerPx;
    const length = Math.min(210, available - 4);
    let angle = cutNumber % 2 === 0 ? -0.6 : 0.65;
    let bestHits = 0;
    // Prefer a diagonal through a second enemy, including splitter offspring.
    for (const other of state.enemies) {
      if (other === enemy || !cuttable(other)) continue;
      const dx = other.x - enemy.x;
      const dy = other.y - enemy.y;
      const distance = Math.hypot(dx, dy);
      if (distance < 12 || distance > length - 45 || Math.abs(dy) < 25) continue;
      const hits = 1 + other.hp;
      if (hits > bestHits) {
        bestHits = hits;
        angle = Math.atan2(dy, dx);
      }
    }
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    // Start close to the target so a low meter still pays for a real hit.
    const lead = Math.min(enemy.r + 24, length * 0.35);
    const start = { x: enemy.x - dx * lead, y: enemy.y - dy * lead };
    const points = [];
    for (let i = 0; i <= 6; i += 1) {
      const distance = length * i / 6;
      const bow = Math.sin(i / 6 * Math.PI) * 7;
      points.push({
        x: Math.max(34, Math.min(FIELD.width - 34, start.x + dx * distance - dy * bow)),
        y: Math.max(100, Math.min(615, start.y + dy * distance + dx * bow)),
      });
    }
    return {
      points,
      active: false,
    };
  }

  return (state) => {
    if (cooldown > 0) {
      cooldown -= 1;
      return { points: [], active: false };
    }

    let target = null;
    if (kind === 'good' && state.night === 7 && state.boss?.active) {
      target = state.boss;
    } else {
      for (const enemy of state.enemies) {
        if (!cuttable(enemy)) continue;
        if (kind === 'good' && burst > 0 && enemy.y < 590
          && [...burstTargets].some(previous => previous === enemy || Math.hypot(previous.x - enemy.x, previous.y - enemy.y) < 90)) continue;
        if (target === null || enemy.y > target.y) target = enemy;
      }
      // Accumulate a genuine crowd before cutting, well below the HUD.
      const depth = state.night >= 3 ? 540 : 310;
      if (kind === 'good' && target && burst === 0 && target.y < depth) return { points: [], active: false };
    }
    if (!target) {
      burst = 0;
      return { points: [], active: false };
    }

    if (kind === 'good' && burst === 0) {
      burst = 3;
      burstTargets.clear();
      dramaticBurst = state.night >= 3 && state.ink >= 65;
    }
    const dramatic = kind === 'good' && dramaticBurst && state.ink >= 20;
    cooldown = cooldownSteps;
    burst = Math.max(0, burst - 1);
    burstTargets.add(target);
    cutNumber += 1;
    return strokeFor(target, state, dramatic);
  };
}

function runPilot(world, pilot, seconds) {
  for (let step = 0; step < seconds / STEP; step += 1) {
    if (world.step(STEP, pilot(world.state), false) & EVENT_OVER) break;
  }
}

// Pick a later-night action frame with distinct trails, a crowd and wet ink.
function interest(state) {
  let alive = 0;
  const kinds = new Set();
  const silhouettes = [];
  const regions = new Set();
  for (const enemy of state.enemies) {
    if (!enemy.active) continue;
    if (enemy.y >= 100 && enemy.y <= 610) {
      if (silhouettes.every(other => Math.hypot(other.x - enemy.x, other.y - enemy.y) > 55)) {
        alive += 1;
        silhouettes.push(enemy);
      }
      kinds.add(enemy.kind);
      regions.add(`${Math.floor(enemy.x / 320)},${Math.floor(enemy.y / 170)}`);
    }
  }
  let particles = 0;
  let spread = 0;
  for (const p of state.particles) {
    if (p.life / p.maxLife > 0.25) {
      particles += 1;
      spread += Math.min(1, (p.maxLife - p.life) / 0.12);
    }
  }
  let strokes = 0;
  let fresh = 0;
  for (const stroke of state.strokes) {
    if (stroke.age > 0.44) continue;
    let length = 0;
    for (let i = 1; i < stroke.points.length; i += 1) {
      length += Math.hypot(stroke.points[i].x - stroke.points[i - 1].x, stroke.points[i].y - stroke.points[i - 1].y);
    }
    if (length >= 125) {
      strokes += 1;
      fresh += 1 - stroke.age / stroke.maxAge;
    }
  }
  return alive * 50 + kinds.size * 65 + regions.size * 12
    + Math.min(strokes, 3) * 65 + fresh * 30
    + (alive >= 5 && strokes >= 2 ? 400 : 0)
    + Math.min(particles, 100) * 0.6 + Math.min(spread, 100) * 1.2
    + Math.min(state.floaters.length, 6) * 5
    - (state.banner ? 30 : 0) - state.flash * 60;
}

/** Stage `start`, `play`, or `end` and return the screen, best and state to draw. */
export function stageShot(name, world) {
  world.reset();
  if (name !== 'play' && name !== 'end') {
    for (let step = 0; step < START_SECONDS / STEP; step += 1) {
      world.step(STEP, { points: [], active: false }, true);
    }
    return { screen: SCREEN_TITLE, best: 0, state: world.state };
  }

  if (name === 'end') {
    const pilot = makePilot('poor');
    runPilot(world, pilot, END_LIMIT_SECONDS);
    return {
      screen: world.state.lives === 0 ? SCREEN_OVER : SCREEN_PLAY,
      best: world.state.score,
      state: world.state,
    };
  }

  // Play: simulate the whole scene, keep the liveliest frame seen.
  const pilot = makePilot('good');
  let bestState = null;
  let bestInterest = -1;
  for (let step = 0; step < PLAY_SECONDS / STEP; step += 1) {
    if (world.step(STEP, pilot(world.state), false) & EVENT_OVER) break;
    if (world.state.night < 3 || world.state.night > 4) continue;
    const score = interest(world.state);
    if (score > bestInterest) {
      bestInterest = score;
      bestState = structuredClone(world.state);
    }
  }
  const state = bestState ?? world.state;
  return {
    screen: state.lives === 0 ? SCREEN_OVER : SCREEN_PLAY,
    best: state.score,
    state,
  };
}
