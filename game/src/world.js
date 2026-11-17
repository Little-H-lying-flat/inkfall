// Simulation only. The injected random function is the sole source of randomness.
import {
  BACKDROP, COMBO, ENEMY, FIELD, FX, INK, LIVES, NIGHT, POOL_SIZE, SPAWN, STROKE, WAVE,
} from './config.js';

export const KIND_WISP = 0;
export const KIND_BRUTE = 1;
export const KIND_SPLITTER = 2;
export const KIND_GHOST = 3;
export const KIND_BOSS = 4;
export const EVENT_CUT = 1;
export const EVENT_HIT = 2;
export const EVENT_OVER = 4;
export const EVENT_WIN = 8;
export const EVENT_NIGHT = 16;

const TYPES = [ENEMY.wisp, ENEMY.brute, ENEMY.splitter, ENEMY.ghost, ENEMY.boss];
const TAU = Math.PI * 2;

function intersects(a, b, enemy) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) return false;
  const t = Math.max(0, Math.min(1, ((enemy.x - a.x) * dx + (enemy.y - a.y) * dy) / lengthSquared));
  const x = a.x + t * dx - enemy.x;
  const y = a.y + t * dy - enemy.y;
  return x * x + y * y <= enemy.r * enemy.r;
}

export function createWorld(random) {
  const enemies = Array.from({ length: POOL_SIZE }, () => ({
    active: false, kind: KIND_WISP, x: 0, y: 0, r: 0, hp: 0, maxHp: 0,
    speed: 0, phase: 0, visible: true, wobble: 0, wobbleFreq: 0, seed: 0,
  }));
  // A drag can damage each enemy once, even if it contains many crossing segments.
  const hitInStroke = new Uint8Array(POOL_SIZE);
  const state = {
    score: 0, lives: LIVES, night: 1, ink: INK.start, combo: 0, comboMult: 1, comboTimer: 0,
    enemies, strokes: [], currentStroke: null, particles: [], floaters: [], banner: null,
    breather: false, breatherTimer: 0, nightTimer: 0, spawnTimer: 0, spawned: 0, budget: 0,
    boss: null, victory: false, flash: 0, elapsed: 0,
  };

  function clearCombo() {
    state.combo = 0;
    state.comboMult = 1;
    state.comboTimer = 0;
  }

  function finishStroke() {
    if (state.currentStroke && state.currentStroke.points.length > 1) {
      state.strokes.push({ points: state.currentStroke.points, age: 0, maxAge: STROKE.maxAge });
    }
    state.currentStroke = null;
  }

  function prepareNight(number, breather) {
    finishStroke();
    state.night = number;
    state.nightTimer = 0;
    state.spawnTimer = WAVE.firstDelay;
    state.spawned = 0;
    state.budget = WAVE.budgets[number - 1];
    state.boss = null;
    state.breather = breather;
    state.breatherTimer = breather ? NIGHT.breather : 0;
    state.banner = {
      text: `Night ${number}`, sub: WAVE.subtitles[number - 1], timer: 0, duration: NIGHT.breather,
    };
  }

  function reset() {
    for (const enemy of enemies) enemy.active = false;
    hitInStroke.fill(0);
    state.score = 0;
    state.lives = LIVES;
    state.ink = INK.start;
    clearCombo();
    state.strokes.length = 0;
    state.currentStroke = null;
    state.particles.length = 0;
    state.floaters.length = 0;
    state.victory = false;
    state.flash = 0;
    state.elapsed = 0;
    prepareNight(1, false);
  }

  function spawn(kind, x, y, harmless = false, bornFromCut = false) {
    const index = enemies.findIndex((enemy) => !enemy.active);
    if (index < 0) return null;
    const enemy = enemies[index];
    const tuning = TYPES[kind];
    enemy.active = true;
    enemy.kind = kind;
    enemy.r = tuning.radius;
    enemy.hp = tuning.hp;
    enemy.maxHp = tuning.hp;
    enemy.x = x ?? WAVE.edgePadding + random() * (FIELD.width - WAVE.edgePadding * 2);
    enemy.y = y ?? -tuning.radius;
    enemy.speed = harmless ? BACKDROP.speed : tuning.speed * WAVE.speedScales[state.night - 1]
      * (1 + (random() * 2 - 1) * WAVE.speedJitter);
    enemy.phase = random() * (kind === KIND_GHOST ? tuning.visibleSeconds + tuning.hiddenSeconds : TAU);
    enemy.visible = kind !== KIND_GHOST || enemy.phase < tuning.visibleSeconds;
    enemy.wobble = tuning.wobble;
    enemy.wobbleFreq = tuning.wobbleFreq;
    enemy.seed = random();
    // Split offspring survive their birth stroke; another drag can cut them.
    hitInStroke[index] = bornFromCut ? 1 : 0;
    if (kind === KIND_BOSS) {
      state.boss = enemy;
      positionBoss(enemy);
    }
    return enemy;
  }

  function positionBoss(enemy) {
    enemy.x = FIELD.width / 2 + Math.sin(enemy.phase * ENEMY.boss.driftFreq) * ENEMY.boss.driftX;
    enemy.y = ENEMY.boss.homeY + Math.sin(enemy.phase * ENEMY.boss.bobFreq) * ENEMY.boss.bobY;
  }

  function chooseKind() {
    const weights = WAVE.weights[state.night - 1];
    let choice = random() * weights.reduce((sum, weight) => sum + weight, 0);
    for (let kind = KIND_WISP; kind <= KIND_GHOST; kind += 1) {
      choice -= weights[kind];
      if (choice < 0) return kind;
    }
    return KIND_WISP;
  }

  function schedule(dt) {
    state.spawnTimer -= dt;
    if (state.night === NIGHT.count) {
      if (state.boss === null) {
        spawn(KIND_BOSS);
        state.spawned = 1;
        state.spawnTimer = ENEMY.boss.spawnInterval;
      } else if (state.spawnTimer <= 0 && state.boss.active) {
        const wisps = enemies.filter((enemy) => enemy.active && enemy.kind === KIND_WISP).length;
        if (wisps < ENEMY.boss.spawnCap) {
          spawn(KIND_WISP, state.boss.x, state.boss.y + state.boss.r * ENEMY.boss.spawnOffset);
        }
        state.spawnTimer = ENEMY.boss.spawnInterval;
      }
      return;
    }
    if (state.spawnTimer <= 0 && state.spawned < state.budget && state.nightTimer < NIGHT.seconds) {
      if (spawn(chooseKind())) state.spawned += 1;
      state.spawnTimer += Math.max(SPAWN.minInterval, SPAWN.baseInterval * SPAWN.intervalScale ** (state.night - 1));
    }
  }

  function moveEnemies(dt, harmless) {
    for (const enemy of enemies) {
      if (!enemy.active) continue;
      enemy.phase += dt;
      if (enemy.kind === KIND_BOSS) {
        positionBoss(enemy);
        continue;
      }
      enemy.x += Math.cos(enemy.phase * enemy.wobbleFreq) * enemy.wobble * enemy.wobbleFreq * dt;
      enemy.x = Math.max(enemy.r, Math.min(FIELD.width - enemy.r, enemy.x));
      enemy.y += (harmless ? BACKDROP.speed : enemy.speed) * dt;
      if (enemy.kind === KIND_GHOST) {
        const cycle = ENEMY.ghost.visibleSeconds + ENEMY.ghost.hiddenSeconds;
        enemy.visible = enemy.phase % cycle < ENEMY.ghost.visibleSeconds;
      }
    }
  }

  function updateEffects(dt) {
    state.flash = Math.max(0, state.flash - dt / FX.flashSeconds);
    for (let i = state.strokes.length - 1; i >= 0; i -= 1) {
      const stroke = state.strokes[i];
      stroke.age += dt;
      if (stroke.age >= stroke.maxAge) state.strokes.splice(i, 1);
    }
    for (let i = state.particles.length - 1; i >= 0; i -= 1) {
      const particle = state.particles[i];
      particle.life -= dt;
      if (particle.life <= 0) {
        state.particles.splice(i, 1);
        continue;
      }
      particle.vy += FX.gravity * dt;
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
    }
    for (let i = state.floaters.length - 1; i >= 0; i -= 1) {
      const floater = state.floaters[i];
      floater.age += dt;
      floater.y -= FX.floaterRise * dt;
      if (floater.age >= floater.maxAge) state.floaters.splice(i, 1);
    }
    if (state.banner) {
      state.banner.timer += dt;
      if (state.banner.timer >= state.banner.duration) state.banner = null;
    }
  }

  function splash(enemy, count) {
    for (let i = 0; i < count && state.particles.length < FX.particleLimit; i += 1) {
      const angle = random() * TAU;
      const speed = FX.particleMinSpeed + random() * FX.particleSpeedRange;
      const life = FX.particleMinLife + random() * FX.particleLifeRange;
      state.particles.push({
        x: enemy.x, y: enemy.y, vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - FX.particleLift, life, maxLife: life,
        size: FX.particleMinSize + random() * FX.particleSizeRange,
      });
    }
  }

  function floatText(x, y, text) {
    state.floaters.push({ x, y, text, age: 0, maxAge: FX.floaterSeconds });
  }

  function cut(enemy) {
    const prevMult = state.comboMult;
    state.combo = state.comboTimer > 0 ? state.combo + 1 : 1;
    state.comboMult = Math.min(COMBO.maxMult, state.combo);
    state.comboTimer = COMBO.windowSec;
    state.ink = Math.min(INK.max, state.ink + INK.refundPerCut);
    enemy.hp -= 1;
    let events = EVENT_CUT;
    if (enemy.hp <= 0) {
      enemy.active = false;
      const points = TYPES[enemy.kind].points * state.comboMult;
      state.score += points;
      floatText(enemy.x, enemy.y - enemy.r, `+${points}`);
      splash(enemy, enemy.kind === KIND_BOSS ? FX.bossDroplets : FX.killDroplets);
      if (enemy.kind === KIND_BOSS) {
        state.victory = true;
        state.breather = false;
        state.breatherTimer = 0;
        state.banner = null;
        // The demon's remaining summons cannot take a life on the winning step.
        for (const other of enemies) other.active = false;
        events |= EVENT_WIN;
      }
    } else {
      splash(enemy, FX.hitDroplets);
      floatText(enemy.x, enemy.y - enemy.r, '-1');
      if (enemy.kind === KIND_SPLITTER && enemy.hp === enemy.maxHp - 1) {
        spawn(KIND_WISP, enemy.x, enemy.y, false, true);
        spawn(KIND_WISP, enemy.x, enemy.y, false, true);
      }
    }
    // Flash the combo only when the multiplier rises; on every cut it piles up.
    if (state.comboMult > prevMult && state.comboMult >= 3) floatText(enemy.x, enemy.y - enemy.r - FX.comboOffset, `x${state.comboMult} COMBO`);
    return events;
  }

  function drawStroke(stroke) {
    let events = 0;
    for (const point of stroke?.points ?? []) {
      if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) continue;
      if (state.ink <= 0 || state.victory) {
        finishStroke();
        continue;
      }
      const next = {
        x: Math.max(0, Math.min(FIELD.width, point.x)),
        y: Math.max(0, Math.min(FIELD.height, point.y)),
      };
      if (state.currentStroke === null) {
        state.currentStroke = { points: [next] };
        hitInStroke.fill(0);
        continue;
      }
      const points = state.currentStroke.points;
      const previous = points[points.length - 1];
      const dx = next.x - previous.x;
      const dy = next.y - previous.y;
      const length = Math.hypot(dx, dy);
      if (length === 0) continue;
      const paidLength = Math.min(length, state.ink / INK.costPerPx);
      const clipped = paidLength < length;
      const end = clipped ? { x: previous.x + dx * paidLength / length, y: previous.y + dy * paidLength / length } : next;
      state.ink = Math.max(0, state.ink - paidLength * INK.costPerPx);
      points.push(end);
      for (let index = 0; index < enemies.length; index += 1) {
        const enemy = enemies[index];
        if (!enemy.active || hitInStroke[index] || (enemy.kind === KIND_GHOST && !enemy.visible)) continue;
        if (!intersects(previous, end, enemy)) continue;
        hitInStroke[index] = 1;
        events |= cut(enemy);
        if (state.victory) break;
      }
      // Never bridge an unpaid gap, even when a cut refunds ink on this segment.
      if (clipped) finishStroke();
    }
    if (!stroke?.active || state.victory) finishStroke();
    return events;
  }

  function escapeEnemies(harmless) {
    let events = 0;
    for (const enemy of enemies) {
      if (!enemy.active || enemy.kind === KIND_BOSS || enemy.y - enemy.r <= FIELD.height) continue;
      enemy.active = false;
      if (harmless) continue;
      state.lives = Math.max(0, state.lives - 1);
      clearCombo();
      state.flash = 1;
      events |= EVENT_HIT;
      if (state.lives === 0) {
        finishStroke();
        events |= EVENT_OVER;
        break;
      }
    }
    return events;
  }

  /** Advance the fixed simulation; points are new samples, not the whole drag. */
  function step(dt, stroke, harmless = false) {
    if (!Number.isFinite(dt) || dt <= 0) return 0;
    state.elapsed += dt;
    updateEffects(dt);
    if (harmless) {
      state.currentStroke = null;
      state.strokes.length = 0;
      state.banner = null;
      clearCombo();
      for (const enemy of enemies) if (enemy.kind !== KIND_WISP) enemy.active = false;
      state.spawnTimer -= dt;
      if (state.spawnTimer <= 0) {
        if (enemies.filter((enemy) => enemy.active).length < BACKDROP.cap) spawn(KIND_WISP, undefined, undefined, true);
        state.spawnTimer = BACKDROP.interval;
      }
      moveEnemies(dt, true);
      escapeEnemies(true);
      return 0;
    }
    if (state.victory || state.lives <= 0) return 0;
    state.ink = Math.min(INK.max, state.ink + INK.refillPerSec * dt);
    state.comboTimer = Math.max(0, state.comboTimer - dt);
    if (state.comboTimer === 0) clearCombo();
    if (state.breather) {
      finishStroke();
      state.breatherTimer = Math.max(0, state.breatherTimer - dt);
      if (state.breatherTimer > 0) return 0;
      state.breather = false;
      state.spawnTimer = 0;
    }
    state.nightTimer += dt;
    schedule(dt);
    moveEnemies(dt, false);
    let events = drawStroke(stroke);
    if (state.victory) return events;
    events |= escapeEnemies(false);
    if (state.lives === 0) return events;
    const cleared = !enemies.some((enemy) => enemy.active);
    if (state.night < NIGHT.count && cleared && (state.nightTimer >= NIGHT.seconds || state.spawned >= state.budget)) {
      prepareNight(state.night + 1, true);
      events |= EVENT_NIGHT;
    }
    return events;
  }

  reset();
  return { state, reset, step };
}
