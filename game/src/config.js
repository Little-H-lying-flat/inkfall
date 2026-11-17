// All simulation tuning, drawing measurements and colours live here.
// Rules use this logical field; only the renderer knows the window size.
export const FIELD = { width: 1280, height: 720 };
export const STEP = 1 / 60;
export const LIVES = 3;
export const INK = { max: 100, start: 100, costPerPx: 1 / 8, refundPerCut: 8, refillPerSec: 6 };
export const NIGHT = { seconds: 25, breather: 3, count: 7, bossHp: 20 };

export const ENEMY = {
  wisp: { radius: 16, hp: 1, speed: 150, points: 10, wobble: 14, wobbleFreq: 1.9 },
  brute: { radius: 30, hp: 3, speed: 70, points: 30, wobble: 20, wobbleFreq: 1.1 },
  splitter: { radius: 22, hp: 2, speed: 110, points: 20, wobble: 18, wobbleFreq: 1.6 },
  ghost: {
    radius: 18, hp: 1, speed: 130, points: 25, wobble: 24, wobbleFreq: 2.1,
    visibleSeconds: 1.2, hiddenSeconds: 0.8,
  },
  boss: {
    radius: 70, hp: NIGHT.bossHp, speed: 0, points: 250, wobble: 0, wobbleFreq: 0,
    homeY: 120, driftX: 360, driftFreq: 0.38, bobY: 18, bobFreq: 0.7,
    spawnInterval: 2.5, spawnCap: 6, spawnOffset: 0.65,
  },
};

export const SPAWN = { baseInterval: 1.1, intervalScale: 0.92, minInterval: 0.45 };
export const COMBO = { windowSec: 1.2, maxMult: 8 };
export const POOL_SIZE = 48;
export const WAVE = {
  budgets: [18, 21, 24, 27, 30, 34, 1],
  // Weights are ordered wisp, brute, splitter, ghost.
  weights: [[1, 0, 0, 0], [7, 3, 0, 0], [5, 2, 3, 0], [4, 2, 2, 2], [3, 2, 3, 3], [3, 3, 3, 4]],
  speedScales: [1, 1, 1, 1, 1.16, 1.32, 1.12],
  speedJitter: 0.12,
  firstDelay: 0.45,
  edgePadding: 44,
  subtitles: [
    'The first ink stirs', 'The brutes come', 'A cut becomes two',
    'Watch for the fading ones', 'The current quickens', 'Hold your brush steady',
    'Seal the ink demon',
  ],
};
export const BACKDROP = { speed: 48, interval: 1.7, cap: 12 };
export const STROKE = { maxAge: 0.55, widthStart: 16, widthEnd: 0.2 };
export const FX = {
  flashSeconds: 0.45,
  hitDroplets: 12, killDroplets: 22, bossDroplets: 64, particleLimit: 320,
  particleMinSpeed: 45, particleSpeedRange: 155, particleLift: 45, gravity: 190,
  particleMinLife: 0.25, particleLifeRange: 0.4, particleMinSize: 1.5, particleSizeRange: 4,
  floaterSeconds: 0.9, floaterRise: 42, comboOffset: 34,
};

export const PALETTE = {
  paper: '#f2ead8', paperEdge: '#e6dcc2', ink: '#1a1a1a', inkSoft: '#3a3a34',
  seal: '#b03a2e', gold: '#c9a227', text: '#1a1a1a', muted: '#6b6252',
};
export const FONT = 'Georgia, "Times New Roman", serif';
export const BEST_KEY = 'inkfall.best';

export const ART = {
  white: '#ffffff',
  textureSeed: 12345, speckles: 4800, fibres: 170,
  speckleAlpha: 0.055, speckleMin: 0.25, speckleRange: 0.85,
  fibreAlpha: 0.045, fibreMin: 4, fibreRange: 25, fibreBend: 3, fibreWidth: 0.6,
  edgeWidth: 24, borderInset: 27, borderAlpha: 0.16, borderWidth: 1,
  ghostHiddenAlpha: 0.25, ghostVisibleAlpha: 1, ghostWaves: 5,
  ghostRipple: 0.075, ghostSegments: 40, ghostOutline: 1.5, ghostCore: 0.86,
  wispCore: 0.86, tailWidth: 0.7, tailHeight: 2.7, tailBend: 1.5,
  bruteCore: 0.82, bruteLeft: -0.23, bruteRight: 0.23, bruteBottom: 0.2,
  blotCount: 7, blotRadius: 0.12, blotSpread: 0.92, seedAngle: 23,
  crackWidth: 2.6, crackStartX: -0.16, crackStartY: -0.84,
  crackMidX: 0.14, crackMidY: -0.13, crackBendX: -0.18, crackBendY: 0.23,
  crackEndX: 0.15, crackEndY: 0.83,
  pipRadius: 3.5, pipGap: 12, pipOffset: 13,
  hornRoot: 0.8, hornTipX: 0.95, hornTipY: 1.4, hornInner: 0.27,
  eyeX: 0.3, eyeY: -0.12, eyeWidth: 0.14, eyeHeight: 0.07, eyeTilt: 0.25,
  bossBarWidth: 2.25, bossBarHeight: 9, bossBarGap: 22, bossBarInset: 2,
  cursorRadius: 4.5, cursorDownRadius: 6, cursorBristle: 15, cursorWidth: 2,
  damageAlpha: 0.25,
};

export const UI = {
  hudSize: 28, hudX: 36, hudY: 26, comboY: 64, comboSize: 22,
  lifeRadius: 10, lifeHeight: 28, lifeGap: 34, lifeY: 28, lifeLabelGap: 24,
  inkX: 48, inkY: 666, inkWidth: 1184, inkHeight: 16, inkRadius: 8,
  inkLabelY: 641, inkLabelSize: 16, inkValueSize: 20, inkOutline: 1.5,
  floaterSize: 26, comboFloaterSize: 24,
  bannerSize: 64, bannerY: 336, bannerSubY: 383, bannerSubSize: 28, bannerFade: 0.45,
  titleSize: 96, titleX: 600, titleY: 265,
  titlePlateX: 110, titlePlateY: 100, titlePlateWidth: 1060, titlePlateHeight: 526,
  titlePlateAlpha: 0.9, titleRuleInset: 36, titleRuleY: 545,
  eyebrowY: 151, eyebrowSize: 20, subtitleY: 329, subtitleSize: 30,
  startY: 424, startSize: 32, bestY: 477, bestSize: 24, legendY: 585, legendSize: 22,
  promptLineY: 438, promptLineWidth: 118, promptLineWeight: 2,
  sealX: 872, sealY: 181, sealSize: 66, sealTilt: -0.08,
  sealInset: 5, sealBorder: 1.5, sealMarkWidth: 6,
  sealMarkLeft: 0.23, sealMarkRight: 0.77, sealMarkTop: 0.22, sealMarkBottom: 0.8,
  overlayAlpha: 0.76, panelX: 300, panelY: 150, panelWidth: 680, panelHeight: 420,
  panelInset: 10, panelTitleY: 231, panelTitleSize: 48, panelSubY: 285, panelSubSize: 26,
  panelScoreY: 356, panelBestY: 398, panelPromptY: 502, panelBodySize: 30, panelPromptSize: 26,
};
