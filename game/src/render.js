// Canvas drawing only. Importing this module does not access browser globals.
import { ART, FIELD, FONT, INK, LIVES, PALETTE, STROKE, UI } from './config.js';
import { createRandom } from './random.js';
import { KIND_BOSS, KIND_BRUTE, KIND_GHOST, KIND_SPLITTER, KIND_WISP } from './world.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_WIN = 'win';

const TAU = Math.PI * 2;

function cachedLabel(prefix) {
  let previous = null;
  let label = '';
  return (value) => {
    if (value !== previous) {
      previous = value;
      label = prefix + value.toLocaleString('en-US');
    }
    return label;
  };
}

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  const fonts = new Map();
  const scoreLabel = cachedLabel('Score ');
  const bestLabel = cachedLabel('Best ');
  const nightLabel = cachedLabel('Night ');

  // The washes are drawn once onto a cached sheet from a fixed seed, so the paper looks identical on every load.
  // Washes and fibres share a cached sheet and their own seeded visual RNG.
  const texture = canvas.ownerDocument.createElement('canvas');
  texture.width = FIELD.width;
  texture.height = FIELD.height;
  const grain = texture.getContext('2d');
  const random = createRandom(ART.textureSeed);
  for (let i = 0; i < 19; i += 1) {
    const x = random() * FIELD.width;
    const y = 140 + random() * 460;
    const width = 170 + random() * 320;
    const height = 60 + random() * 150;
    grain.save();
    grain.translate(x, y);
    grain.rotate(-0.45 + random() * 0.6);
    grain.scale(width, height);
    const wash = grain.createRadialGradient(0, 0, 0, 0, 0, 1);
    wash.addColorStop(0, `rgba(46, 52, 51, ${0.035 + random() * 0.045})`);
    wash.addColorStop(0.5, 'rgba(63, 68, 64, 0.025)');
    wash.addColorStop(1, 'rgba(63, 68, 64, 0)');
    grain.fillStyle = wash;
    grain.fillRect(-1, -1, 2, 2);
    grain.restore();
  }
  grain.fillStyle = PALETTE.inkSoft;
  grain.globalAlpha = ART.speckleAlpha;
  for (let i = 0; i < ART.speckles; i += 1) {
    grain.beginPath();
    grain.arc(random() * FIELD.width, random() * FIELD.height, ART.speckleMin + random() * ART.speckleRange, 0, TAU);
    grain.fill();
  }
  grain.globalAlpha = ART.fibreAlpha;
  grain.strokeStyle = PALETTE.muted;
  grain.lineWidth = ART.fibreWidth;
  for (let i = 0; i < ART.fibres; i += 1) {
    const x = random() * FIELD.width;
    const y = random() * FIELD.height;
    const length = ART.fibreMin + random() * ART.fibreRange;
    const bend = (random() * 2 - 1) * ART.fibreBend;
    grain.beginPath();
    grain.moveTo(x, y);
    grain.quadraticCurveTo(x + length / 2, y + bend, x + length, y + bend / 2);
    grain.stroke();
  }
  // Lift the wash away from both HUD bands so small labels stay crisp.
  grain.globalAlpha = 1;
  grain.globalCompositeOperation = 'destination-out';
  const clearHud = grain.createLinearGradient(0, 0, 0, FIELD.height);
  clearHud.addColorStop(0, 'rgba(0, 0, 0, 1)');
  clearHud.addColorStop(0.16, 'rgba(0, 0, 0, 0)');
  clearHud.addColorStop(0.82, 'rgba(0, 0, 0, 0)');
  clearHud.addColorStop(0.92, 'rgba(0, 0, 0, 1)');
  grain.fillStyle = clearHud;
  grain.fillRect(0, 0, FIELD.width, FIELD.height);
  const motes = Array.from({ length: 42 }, () => ({
    x: random() * FIELD.width, y: random() * 490,
    radius: 0.7 + random() * 1.7, phase: random() * TAU,
    speed: 2 + random() * 5,
  }));

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / FIELD.width, height / FIELD.height);
    view.x = (width - FIELD.width * view.scale) / 2;
    view.y = (height - FIELD.height * view.scale) / 2;
  }

  function text(value, x, y, size, colour = PALETTE.text, align = 'center') {
    if (!fonts.has(size)) fonts.set(size, `${size}px ${FONT}`);
    context.font = fonts.get(size);
    context.fillStyle = colour;
    context.textAlign = align;
    context.fillText(value, x, y);
  }

  function circle(x, y, radius) {
    context.beginPath();
    context.arc(x, y, radius, 0, TAU);
    context.fill();
  }

  function roundBar(x, y, width, height, radius) {
    context.beginPath();
    context.roundRect(x, y, width, height, radius);
  }

  function drawPaper(elapsed) {
    context.fillStyle = PALETTE.paper;
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    context.drawImage(texture, 0, 0);
    context.fillStyle = PALETTE.inkSoft;
    for (const mote of motes) {
      const x = mote.x + Math.sin(elapsed * 0.18 + mote.phase) * 12;
      const y = 116 + (mote.y + elapsed * mote.speed) % 490;
      context.globalAlpha = 0.055 + Math.sin(elapsed * 0.3 + mote.phase) * 0.02;
      circle(x, y, mote.radius);
    }
    context.globalAlpha = 1;
    context.strokeStyle = PALETTE.paperEdge;
    context.lineWidth = ART.edgeWidth;
    context.strokeRect(ART.edgeWidth / 2, ART.edgeWidth / 2, FIELD.width - ART.edgeWidth, FIELD.height - ART.edgeWidth);
    context.globalAlpha = ART.borderAlpha;
    context.strokeStyle = PALETTE.muted;
    context.lineWidth = ART.borderWidth;
    context.strokeRect(ART.borderInset, ART.borderInset, FIELD.width - ART.borderInset * 2, FIELD.height - ART.borderInset * 2);
    context.globalAlpha = 1;
  }

  function drawBlot(enemy) {
    const r = enemy.r;
    context.fillStyle = PALETTE.ink;
    circle(r * ART.bruteLeft, -r * ART.bruteBottom, r * ART.bruteCore);
    circle(r * ART.bruteRight, 0, r * ART.bruteCore);
    circle(0, r * ART.bruteBottom, r * ART.bruteCore);
    for (let i = 0; i < ART.blotCount; i += 1) {
      const angle = i * TAU / ART.blotCount + enemy.seed * ART.seedAngle;
      circle(Math.cos(angle) * r * ART.blotSpread, Math.sin(angle) * r * ART.blotSpread, r * ART.blotRadius);
    }
  }

  function drawWisp(enemy) {
    const r = enemy.r;
    context.fillStyle = PALETTE.ink;
    const bend = Math.sin(enemy.phase) * r * ART.tailBend;
    context.beginPath();
    context.moveTo(-r * ART.tailWidth, 0);
    context.quadraticCurveTo(bend - r, -r * ART.tailBend, bend, -r * ART.tailHeight);
    context.quadraticCurveTo(bend + r * ART.tailWidth, -r, r * ART.tailWidth, 0);
    context.fill();
    circle(0, 0, r * ART.wispCore);
  }

  function drawGhost(enemy) {
    const r = enemy.r;
    context.fillStyle = PALETTE.ink;
    circle(0, 0, r * ART.ghostCore);
    context.strokeStyle = PALETTE.ink;
    context.lineWidth = ART.ghostOutline;
    context.beginPath();
    for (let i = 0; i <= ART.ghostSegments; i += 1) {
      const angle = i * TAU / ART.ghostSegments;
      const radius = r * (1 + Math.sin(angle * ART.ghostWaves + enemy.phase) * ART.ghostRipple);
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      if (i === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    }
    context.closePath();
    context.stroke();
  }

  function drawBoss(enemy) {
    const r = enemy.r;
    drawBlot(enemy);
    context.fillStyle = PALETTE.ink;
    for (const side of [-1, 1]) {
      context.beginPath();
      context.moveTo(side * r * ART.hornRoot, -r / 2);
      context.lineTo(side * r * ART.hornTipX, -r * ART.hornTipY);
      context.lineTo(side * r * ART.hornInner, -r * ART.bruteCore);
      context.closePath();
      context.fill();
      context.fillStyle = PALETTE.seal;
      context.beginPath();
      context.ellipse(side * r * ART.eyeX, r * ART.eyeY, r * ART.eyeWidth, r * ART.eyeHeight, side * ART.eyeTilt, 0, TAU);
      context.fill();
      context.fillStyle = PALETTE.ink;
    }
    const width = r * ART.bossBarWidth;
    const y = -r - ART.bossBarGap;
    context.fillStyle = PALETTE.paper;
    context.fillRect(-width / 2, y, width, ART.bossBarHeight);
    context.strokeStyle = PALETTE.ink;
    context.lineWidth = ART.borderWidth;
    context.strokeRect(-width / 2, y, width, ART.bossBarHeight);
    context.fillStyle = PALETTE.seal;
    context.fillRect(-width / 2 + ART.bossBarInset, y + ART.bossBarInset,
      (width - ART.bossBarInset * 2) * Math.max(0, enemy.hp / enemy.maxHp), ART.bossBarHeight - ART.bossBarInset * 2);
  }

  function drawEnemies(state) {
    for (const enemy of state.enemies) {
      if (!enemy.active) continue;
      context.save();
      context.translate(enemy.x, enemy.y);
      if (enemy.kind === KIND_GHOST) {
        context.globalAlpha = enemy.visible ? ART.ghostVisibleAlpha : ART.ghostHiddenAlpha;
        drawGhost(enemy);
      } else if (enemy.kind === KIND_WISP) drawWisp(enemy);
      else if (enemy.kind === KIND_BOSS) drawBoss(enemy);
      else {
        if (enemy.kind === KIND_BRUTE) drawBlot(enemy);
        else {
          context.fillStyle = PALETTE.ink;
          circle(0, 0, enemy.r);
          context.strokeStyle = PALETTE.paper;
          context.lineWidth = ART.crackWidth;
          context.beginPath();
          context.moveTo(enemy.r * ART.crackStartX, enemy.r * ART.crackStartY);
          context.lineTo(enemy.r * ART.crackMidX, enemy.r * ART.crackMidY);
          context.lineTo(enemy.r * ART.crackBendX, enemy.r * ART.crackBendY);
          context.lineTo(enemy.r * ART.crackEndX, enemy.r * ART.crackEndY);
          context.stroke();
        }
      }
      if (enemy.kind === KIND_BRUTE || enemy.kind === KIND_SPLITTER) {
        context.fillStyle = PALETTE.ink;
        for (let hp = 0; hp < enemy.hp; hp += 1) {
          circle((hp - (enemy.hp - 1) / 2) * ART.pipGap, -enemy.r - ART.pipOffset, ART.pipRadius);
        }
      }
      context.restore();
    }
  }

  // A slash tapers from 16px at its start to 0.2px at its end over its 0.55s life,
  // and fades out instead of vanishing so the mark dries like wet ink on paper.
  function drawStroke(stroke, alpha) {
    const points = stroke.points;
    if (points.length < 2 || alpha <= 0) return;
    let total = 0;
    const samples = [{ ...points[0], distance: 0 }];
    for (let i = 1; i < points.length; i += 1) {
      const a = points[i - 1];
      const b = points[i];
      const length = Math.hypot(b.x - a.x, b.y - a.y);
      const count = Math.ceil(length / 8);
      for (let j = 1; j <= count; j += 1) {
        const t = j / count;
        samples.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, distance: total + length * t });
      }
      total += length;
    }
    if (total === 0) return;

    function ribbon(bleed) {
      context.beginPath();
      for (const side of [1, -1]) {
        for (let j = 0; j < samples.length; j += 1) {
          const i = side === 1 ? j : samples.length - 1 - j;
          const point = samples[i];
          const before = samples[Math.max(0, i - 1)];
          const after = samples[Math.min(samples.length - 1, i + 1)];
          const dx = after.x - before.x;
          const dy = after.y - before.y;
          const length = Math.hypot(dx, dy) || 1;
          const t = point.distance / total;
          const bristle = 1 + Math.sin(point.distance * 0.73) * 0.035;
          const radius = (STROKE.widthEnd + (STROKE.widthStart - STROKE.widthEnd) * (1 - t) ** 0.65) / 2;
          const width = radius * bristle + bleed * (1 - t);
          const x = point.x - dy / length * width * side;
          const y = point.y + dx / length * width * side;
          if (side === 1 && j === 0) context.moveTo(x, y);
          else context.lineTo(x, y);
        }
      }
      context.closePath();
      context.fill();
    }

    context.save();
    context.fillStyle = PALETTE.ink;
    context.globalAlpha = alpha * 0.15;
    context.shadowColor = PALETTE.inkSoft;
    context.shadowBlur = 2;
    ribbon(2.2);
    context.shadowBlur = 0;
    context.globalAlpha = alpha;
    ribbon(0);
    context.restore();
  }

  function drawEffects(state) {
    for (const stroke of state.strokes) {
      // A wet mark holds its black core briefly, then dries independently.
      const fade = Math.max(0, 1 - Math.max(0, stroke.age - 0.12) / (stroke.maxAge - 0.12));
      drawStroke(stroke, fade ** 0.7);
    }
    if (state.currentStroke) drawStroke(state.currentStroke, 1);
    context.save();
    context.fillStyle = PALETTE.ink;
    for (const particle of state.particles) {
      context.globalAlpha = Math.max(0, particle.life / particle.maxLife);
      context.beginPath();
      context.ellipse(particle.x, particle.y, particle.size * 1.5, particle.size * 0.75,
        Math.atan2(particle.vy, particle.vx), 0, TAU);
      context.fill();
    }
    context.textBaseline = 'alphabetic';
    const labels = [];
    const combos = [];
    for (let i = state.floaters.length - 1; i >= 0; i -= 1) {
      const floater = state.floaters[i];
      context.globalAlpha = Math.max(0, 1 - floater.age / floater.maxAge);
      const combo = floater.text.includes('COMBO');
      // Show the latest local combo and fan simultaneous score labels apart.
      if (combo && combos.some(other => Math.hypot(other.x - floater.x, other.y - floater.y) < 140)) continue;
      if (combo) combos.push(floater);
      const size = combo ? UI.comboFloaterSize : UI.floaterSize;
      context.font = `${size}px ${FONT}`;
      const width = context.measureText(floater.text).width;
      let fx = Math.max(width / 2 + 36, Math.min(FIELD.width - width / 2 - 36, floater.x));
      let fy = Math.max(110, Math.min(615, floater.y));
      for (let attempt = 0; attempt < 12; attempt += 1) {
        if (labels.every(other => Math.abs(fx - other.x) > (width + other.width) / 2 + 8 || Math.abs(fy - other.y) > 29)) break;
        fy -= 31;
        if (fy < 110) {
          fy = Math.max(110, Math.min(615, floater.y));
          fx = Math.max(width / 2 + 36, Math.min(FIELD.width - width / 2 - 36, fx + width + 14));
        }
      }
      labels.push({ x: fx, y: fy, width });
      text(floater.text, fx, fy, size, combo ? PALETTE.seal : PALETTE.ink);
    }
    context.restore();
  }

  function drawLife(x, alive) {
    const r = UI.lifeRadius;
    const y = UI.lifeY;
    context.beginPath();
    context.moveTo(x, y);
    context.bezierCurveTo(x - r / 2, y + UI.lifeHeight / 2, x - r, y + UI.lifeHeight / 2, x - r, y + UI.lifeHeight - r);
    context.bezierCurveTo(x - r, y + UI.lifeHeight + r / 2, x + r, y + UI.lifeHeight + r / 2, x + r, y + UI.lifeHeight - r);
    context.bezierCurveTo(x + r, y + UI.lifeHeight / 2, x + r / 2, y + UI.lifeHeight / 2, x, y);
    context.closePath();
    context.strokeStyle = PALETTE.ink;
    context.lineWidth = UI.inkOutline;
    if (alive) {
      context.fillStyle = PALETTE.ink;
      context.fill();
    } else context.stroke();
  }

  function drawHud(state) {
    context.textBaseline = 'top';
    text(scoreLabel(state.score), UI.hudX, UI.hudY, UI.hudSize, PALETTE.text, 'left');
    text(nightLabel(state.night), FIELD.width / 2, UI.hudY, UI.hudSize);
    const firstLife = FIELD.width - UI.hudX - UI.lifeRadius - (LIVES - 1) * UI.lifeGap;
    text('Lives', firstLife - UI.lifeLabelGap, UI.hudY, UI.hudSize, PALETTE.text, 'right');
    for (let life = 0; life < LIVES; life += 1) drawLife(firstLife + life * UI.lifeGap, life < state.lives);
    // No HUD combo line: the combo flashes once, as a floater near the cut.
    text('INK', UI.inkX, UI.inkLabelY, UI.inkLabelSize, PALETTE.muted, 'left');
    text(`${Math.ceil(state.ink)} / ${INK.max}`, UI.inkX + UI.inkWidth, UI.inkLabelY, UI.inkValueSize, PALETTE.muted, 'right');
    context.fillStyle = PALETTE.paperEdge;
    roundBar(UI.inkX, UI.inkY, UI.inkWidth, UI.inkHeight, UI.inkRadius);
    context.fill();
    context.save();
    context.clip();
    context.fillStyle = PALETTE.ink;
    context.fillRect(UI.inkX, UI.inkY, UI.inkWidth * Math.max(0, Math.min(1, state.ink / INK.max)), UI.inkHeight);
    context.restore();
    context.strokeStyle = PALETTE.inkSoft;
    context.lineWidth = UI.inkOutline;
    roundBar(UI.inkX, UI.inkY, UI.inkWidth, UI.inkHeight, UI.inkRadius);
    context.stroke();
  }

  function drawBanner(banner) {
    if (!banner) return;
    context.save();
    context.globalAlpha = Math.max(0, Math.min(1, banner.timer / UI.bannerFade, (banner.duration - banner.timer) / UI.bannerFade));
    context.textBaseline = 'alphabetic';
    text(banner.text, FIELD.width / 2, UI.bannerY, UI.bannerSize);
    text(banner.sub, FIELD.width / 2, UI.bannerSubY, UI.bannerSubSize, PALETTE.muted);
    context.restore();
  }

  function drawSeal() {
    context.save();
    context.translate(UI.sealX, UI.sealY);
    context.rotate(UI.sealTilt);
    context.fillStyle = PALETTE.seal;
    context.fillRect(0, 0, UI.sealSize, UI.sealSize);
    context.strokeStyle = PALETTE.paper;
    context.lineWidth = UI.sealBorder;
    context.strokeRect(UI.sealInset, UI.sealInset, UI.sealSize - UI.sealInset * 2, UI.sealSize - UI.sealInset * 2);
    // Abstract brushwork made of paths; no font or character is needed for the seal.
    const left = UI.sealSize * UI.sealMarkLeft;
    const right = UI.sealSize * UI.sealMarkRight;
    const top = UI.sealSize * UI.sealMarkTop;
    const bottom = UI.sealSize * UI.sealMarkBottom;
    context.strokeStyle = ART.white;
    context.lineWidth = UI.sealMarkWidth;
    context.lineCap = 'round';
    context.beginPath();
    context.moveTo(right, top);
    context.quadraticCurveTo(left, top, left, bottom);
    context.moveTo(left, bottom);
    context.quadraticCurveTo(right, bottom, right, (top + bottom) / 2);
    context.moveTo(left, (top + bottom) / 2);
    context.lineTo(right, top);
    context.stroke();
    context.restore();
  }

  function drawTitle(best) {
    context.save();
    context.globalAlpha = UI.titlePlateAlpha;
    context.fillStyle = PALETTE.paper;
    context.fillRect(UI.titlePlateX, UI.titlePlateY, UI.titlePlateWidth, UI.titlePlateHeight);
    context.restore();
    context.textBaseline = 'alphabetic';
    text('SEVEN NIGHTS / ONE BRUSH', FIELD.width / 2, UI.eyebrowY, UI.eyebrowSize, PALETTE.seal);
    text('INKFALL', UI.titleX, UI.titleY, UI.titleSize);
    drawSeal();
    text('Drag to slash the ink spirits', FIELD.width / 2, UI.subtitleY, UI.subtitleSize, PALETTE.muted);
    text('Click to start', FIELD.width / 2, UI.startY, UI.startSize);
    context.strokeStyle = PALETTE.seal;
    context.lineWidth = UI.promptLineWeight;
    context.beginPath();
    context.moveTo((FIELD.width - UI.promptLineWidth) / 2, UI.promptLineY);
    context.lineTo((FIELD.width + UI.promptLineWidth) / 2, UI.promptLineY);
    context.stroke();
    text(bestLabel(best), FIELD.width / 2, UI.bestY, UI.bestSize, PALETTE.muted);
    context.strokeStyle = PALETTE.gold;
    context.lineWidth = ART.borderWidth;
    context.beginPath();
    context.moveTo(UI.titlePlateX + UI.titleRuleInset, UI.titleRuleY);
    context.lineTo(UI.titlePlateX + UI.titlePlateWidth - UI.titleRuleInset, UI.titleRuleY);
    context.stroke();
    text("Wisp 10 - Brute 30 - Splitter 20 - Ghost 25. Don't let them reach the bottom.",
      FIELD.width / 2, UI.legendY, UI.legendSize, PALETTE.muted);
  }

  function drawPanel(state, screen, best) {
    context.save();
    context.globalAlpha = UI.overlayAlpha;
    context.fillStyle = PALETTE.paper;
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    context.restore();
    context.fillStyle = PALETTE.paper;
    context.fillRect(UI.panelX, UI.panelY, UI.panelWidth, UI.panelHeight);
    context.strokeStyle = PALETTE.ink;
    context.lineWidth = ART.borderWidth;
    context.strokeRect(UI.panelX, UI.panelY, UI.panelWidth, UI.panelHeight);
    context.strokeStyle = PALETTE.paperEdge;
    context.strokeRect(UI.panelX + UI.panelInset, UI.panelY + UI.panelInset,
      UI.panelWidth - UI.panelInset * 2, UI.panelHeight - UI.panelInset * 2);
    context.textBaseline = 'alphabetic';
    const paused = screen === SCREEN_PAUSED;
    const won = screen === SCREEN_WIN;
    text(paused ? 'Paused' : won ? 'Victory' : 'Game over', FIELD.width / 2, UI.panelTitleY, UI.panelTitleSize);
    if (won) text('The ink demon is sealed.', FIELD.width / 2, UI.panelSubY, UI.panelSubSize, PALETTE.seal);
    if (!paused) {
      text(scoreLabel(state.score), FIELD.width / 2, UI.panelScoreY, UI.panelBodySize);
      text(bestLabel(best), FIELD.width / 2, UI.panelBestY, UI.bestSize, PALETTE.muted);
    }
    text(paused ? 'Space / Esc to resume' : 'Click to play again', FIELD.width / 2, UI.panelPromptY, UI.panelPromptSize, PALETTE.seal);
  }

  function drawCursor(pointer) {
    context.fillStyle = PALETTE.ink;
    circle(pointer.x, pointer.y, pointer.down ? ART.cursorDownRadius : ART.cursorRadius);
    context.strokeStyle = PALETTE.inkSoft;
    context.lineWidth = ART.cursorWidth;
    context.lineCap = 'round';
    context.beginPath();
    context.moveTo(pointer.x, pointer.y);
    context.lineTo(pointer.x - ART.cursorBristle, pointer.y - ART.cursorBristle);
    context.stroke();
  }

  /** Paint the centred logical field without changing any simulation state. */
  function draw(state, screen, best, pointer = null) {
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.globalAlpha = 1;
    context.fillStyle = PALETTE.paperEdge;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    context.save();
    context.beginPath();
    context.rect(0, 0, FIELD.width, FIELD.height);
    context.clip();
    drawPaper(state.elapsed);
    drawEnemies(state);
    drawEffects(state);
    if (screen === SCREEN_PLAY || screen === SCREEN_PAUSED) {
      drawHud(state);
      drawBanner(state.banner);
    }
    if (state.flash > 0) {
      context.globalAlpha = state.flash * ART.damageAlpha;
      context.fillStyle = PALETTE.seal;
      context.fillRect(0, 0, FIELD.width, FIELD.height);
      context.globalAlpha = 1;
    }
    if (screen === SCREEN_PLAY && pointer) drawCursor(pointer);
    if (screen === SCREEN_TITLE) drawTitle(best);
    else if (screen === SCREEN_PAUSED || screen === SCREEN_OVER || screen === SCREEN_WIN) drawPanel(state, screen, best);
    context.restore();
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw };
}
