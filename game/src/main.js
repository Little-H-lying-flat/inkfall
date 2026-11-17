// INKFALL boot, screens, and fixed-step loop. The browser boot is guarded so
// importing this module in a Node based check does not touch browser globals.

import { BEST_KEY, LIVES, STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_HIT, EVENT_OVER, EVENT_WIN } from './world.js';
import { ACTION_CONFIRM, ACTION_PAUSE, createInput } from './input.js';
import {
  createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN,
} from './render.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;

function boot() {
  const params = new URLSearchParams(window.location.search);
  const shot = params.get('shot');
  const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
  const seed = Number.isInteger(seedParam)
    ? seedParam
    : Math.floor(Math.random() * 0x100000000);
  const canvas = document.getElementById('game');
  const status = document.getElementById('status');
  const world = createWorld(createRandom(seed));
  const renderer = createRenderer(canvas);

  function readBest() {
    try {
      return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
    } catch {
      return 0;
    }
  }

  function saveBest(value) {
    try {
      window.localStorage.setItem(BEST_KEY, String(value));
    } catch {
      // The score remains available for this visit when storage is unavailable.
    }
  }

  function runShot(name) {
    const scene = stageShot(name, world);
    let painted = 0;
    function paint() {
      renderer.draw(scene.state, scene.screen, scene.best, null);
      painted += 1;
      if (painted < 2) requestAnimationFrame(paint);
      else window.__shotReady = true;
    }
    requestAnimationFrame(paint);
  }

  function runGame() {
    const input = createInput(canvas);
    let screen = SCREEN_TITLE;
    let best = readBest();
    let accumulator = 0;
    let last = performance.now();

    function announce(message) {
      status.textContent = message;
    }

    function startGame() {
      world.reset();
      input.takeStrokePoints();
      accumulator = 0;
      screen = SCREEN_PLAY;
      announce(`Playing. ${LIVES} lives.`);
    }

    function finishGame(nextScreen, message) {
      screen = nextScreen;
      if (world.state.score > best) {
        best = world.state.score;
        saveBest(best);
      }
      announce(message);
    }

    function handleActions() {
      const actions = input.takeActions();
      if (actions & ACTION_CONFIRM
        && (screen === SCREEN_TITLE || screen === SCREEN_OVER || screen === SCREEN_WIN)) {
        startGame();
      } else if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) {
        screen = SCREEN_PAUSED;
        announce('Paused.');
      } else if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && screen === SCREEN_PAUSED) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
    }

    function step() {
      if (screen === SCREEN_TITLE) {
        world.step(STEP, { points: [], active: false }, true);
        return;
      }
      const events = world.step(STEP, input.takeStrokePoints(), false);
      if (events & EVENT_WIN) {
        finishGame(SCREEN_WIN, `Victory. Score ${world.state.score}. Best ${Math.max(best, world.state.score)}.`);
      } else if (events & EVENT_OVER) {
        finishGame(SCREEN_OVER, `Game over. Score ${world.state.score}. Best ${best}.`);
      } else if (events & EVENT_HIT) {
        announce(world.state.lives === 1
          ? 'Hit. 1 life left.'
          : `Hit. ${world.state.lives} lives left.`);
      }
    }

    function frame(now) {
      requestAnimationFrame(frame);
      accumulator += Math.min((now - last) / 1000, MAX_FRAME);
      last = now;
      handleActions();
      if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
        while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
          step();
          accumulator -= STEP;
        }
      } else {
        accumulator = 0;
      }
      renderer.draw(world.state, screen, best, input.pointer());
    }

    document.addEventListener('visibilitychange', () => {
      if (document.hidden && screen === SCREEN_PLAY) {
        screen = SCREEN_PAUSED;
        announce('Paused.');
      }
    });

    announce('INKFALL. Press Space or click to start.');
    requestAnimationFrame(frame);
  }

  if (shot) runShot(shot);
  else runGame();
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') boot();
