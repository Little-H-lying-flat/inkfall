// Browser input for the brush. Pointer samples are queued until the fixed-step
// loop takes them; an up event closes the current stroke on the next step.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;

const CONFIRM = new Set(['Space', 'Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const FIELD_WIDTH = 1280;
const FIELD_HEIGHT = 720;

function fieldPoint(event) {
  const scale = Math.min(window.innerWidth / FIELD_WIDTH, window.innerHeight / FIELD_HEIGHT);
  const offsetX = (window.innerWidth - FIELD_WIDTH * scale) / 2;
  const offsetY = (window.innerHeight - FIELD_HEIGHT * scale) / 2;
  return {
    x: Math.max(0, Math.min(FIELD_WIDTH, (event.clientX - offsetX) / scale)),
    y: Math.max(0, Math.min(FIELD_HEIGHT, (event.clientY - offsetY) / scale)),
  };
}

export function createInput(canvas) {
  let actions = 0;
  let pointerPosition = null;
  let pointerDown = false;
  let pointerId = null;
  let pendingPoints = [];
  const heldKeys = new Set();

  function updatePointer(event) {
    pointerPosition = fieldPoint(event);
    return pointerPosition;
  }

  function onPointerDown(event) {
    if (pointerDown) return;
    pointerDown = true;
    pointerId = event.pointerId;
    const point = updatePointer(event);
    pendingPoints = [point];
    actions |= ACTION_CONFIRM;
    if (typeof canvas.setPointerCapture === 'function') canvas.setPointerCapture(event.pointerId);
    event.preventDefault();
  }

  function onPointerMove(event) {
    const point = updatePointer(event);
    if (pointerDown && event.pointerId === pointerId) {
      pendingPoints.push(point);
      event.preventDefault();
    }
  }

  function endPointer(event) {
    if (event && pointerId !== null && event.pointerId !== pointerId) return;
    if (event) updatePointer(event);
    pointerDown = false;
    pointerId = null;
    // A release closes the stroke. Pending samples are intentionally dropped:
    // the next call reports an inactive pointer with no new segment.
    pendingPoints = [];
    if (event) event.preventDefault();
  }

  function onKeyDown(event) {
    if (CONFIRM.has(event.code)) {
      if (!event.repeat) actions |= ACTION_CONFIRM;
      if (event.code === 'Space') event.preventDefault();
      heldKeys.add(event.code);
      return;
    }
    if (PAUSE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_PAUSE;
      heldKeys.add(event.code);
      event.preventDefault();
    }
  }

  function onKeyUp(event) {
    heldKeys.delete(event.code);
  }

  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', endPointer);
  canvas.addEventListener('pointercancel', endPointer);
  window.addEventListener('pointerup', endPointer);
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', () => {
    heldKeys.clear();
    if (pointerDown) endPointer();
  });

  return {
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },

    takeStrokePoints() {
      const points = pendingPoints;
      pendingPoints = [];
      return { points, active: pointerDown };
    },

    pointer() {
      if (!pointerPosition) return null;
      return { x: pointerPosition.x, y: pointerPosition.y, down: pointerDown };
    },
  };
}
