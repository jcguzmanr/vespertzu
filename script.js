// Visual constants
const BG_COLOR = "#f3f3ef";
const LINE_COLOR = "rgba(152, 152, 144, 0.24)";
const DOT_COLOR = "rgba(116, 116, 110, 0.48)";
const LINE_WIDTH = 1;
const DOT_RADIUS = 2.2;
const MOBILE_BREAKPOINT = 768;
const DESKTOP_COLUMNS = 12;
const MOBILE_COLUMNS = 6;
const MAX_PARALLAX_SHIFT = 6;

// Timing constants (ms)
const LINES_DURATION = 980;
const DOTS_DURATION = 560;
const DOTS_WAVE_PORTION = 0.45;
const TITLE_DELAY = 120;

const canvas = document.getElementById("grid-canvas");
const ctx = canvas.getContext("2d", { alpha: false });
const hero = document.querySelector(".hero");
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

let width = 0;
let height = 0;
let dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
let cellSize = 0;

let introStart = 0;
let introFrame = 0;

let parallaxEnabled = false;
let parallaxRunning = false;
let pointerX = 0;
let pointerY = 0;
let currentShiftX = 0;
let currentShiftY = 0;
let targetShiftX = 0;
let targetShiftY = 0;

function easeInCubic(t) {
  return t * t * t;
}

function easeOutCubic(t) {
  const v = 1 - t;
  return 1 - v * v * v;
}

function clamp01(v) {
  return Math.max(0, Math.min(1, v));
}

function getCellSize(viewportWidth) {
  const columnCount = viewportWidth <= MOBILE_BREAKPOINT ? MOBILE_COLUMNS : DESKTOP_COLUMNS;
  return viewportWidth / columnCount;
}

function resizeCanvas() {
  width = window.innerWidth;
  height = window.innerHeight;
  dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
  cellSize = getCellSize(width);

  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.lineWidth = LINE_WIDTH;
}

function getGridMetrics(shiftX, shiftY) {
  const phaseX = ((shiftX % cellSize) + cellSize) % cellSize;
  const phaseY = ((shiftY % cellSize) + cellSize) % cellSize;
  const startX = -phaseX;
  const startY = -phaseY;
  const colCount = Math.ceil((width + phaseX) / cellSize) + 1;
  const rowCount = Math.ceil((height + phaseY) / cellSize) + 1;

  return { startX, startY, colCount, rowCount };
}

function drawGrid(linesProgress, dotsProgress) {
  ctx.fillStyle = BG_COLOR;
  ctx.fillRect(0, 0, width, height);

  const drawWidth = width * linesProgress;
  const drawHeight = height * linesProgress;
  const { startX, startY, colCount, rowCount } = getGridMetrics(currentShiftX, currentShiftY);

  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, drawWidth, drawHeight);
  ctx.clip();

  ctx.globalAlpha = clamp01(0.15 + linesProgress * 0.85);
  ctx.strokeStyle = LINE_COLOR;

  ctx.beginPath();
  for (let i = 0; i <= colCount; i += 1) {
    const x = startX + i * cellSize + 0.5;
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
  }

  for (let j = 0; j <= rowCount; j += 1) {
    const y = startY + j * cellSize + 0.5;
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
  }

  ctx.stroke();
  ctx.restore();

  if (dotsProgress <= 0) {
    return;
  }

  const maxWave = Math.max(1, colCount + rowCount - 2);
  ctx.fillStyle = DOT_COLOR;

  for (let y = 0; y < rowCount; y += 1) {
    for (let x = 0; x < colCount; x += 1) {
      const wave = (x + y) / maxWave;
      const local = clamp01((dotsProgress - wave * DOTS_WAVE_PORTION) / (1 - DOTS_WAVE_PORTION));
      if (local <= 0) continue;

      const eased = easeOutCubic(local);
      const cx = startX + (x + 0.5) * cellSize;
      const cy = startY + (y + 0.5) * cellSize;

      if (cx < -cellSize || cy < -cellSize || cx > width + cellSize || cy > height + cellSize) {
        continue;
      }

      ctx.globalAlpha = eased;
      ctx.beginPath();
      ctx.arc(cx, cy, DOT_RADIUS * (0.6 + 0.4 * eased), 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.globalAlpha = 1;
}

function runIntroFrame(now) {
  const elapsed = now - introStart;

  const linesProgress = reduceMotion
    ? 1
    : clamp01(elapsed / LINES_DURATION);
  const dotsElapsed = elapsed - LINES_DURATION;
  const dotsProgress = reduceMotion
    ? 1
    : clamp01(dotsElapsed / DOTS_DURATION);

  const linesEased = reduceMotion ? 1 : easeInCubic(linesProgress);
  drawGrid(linesEased, dotsProgress);

  if (!reduceMotion && (linesProgress < 1 || dotsProgress < 1)) {
    introFrame = requestAnimationFrame(runIntroFrame);
    return;
  }

  introFrame = 0;
  revealContent();
}

function revealContent() {
  if (reduceMotion) {
    hero.classList.add("hero--show-title");
    return;
  }

  window.setTimeout(() => {
    hero.classList.add("hero--show-title");
  }, TITLE_DELAY);
}

function onPointerMove(event) {
  if (!parallaxEnabled) return;

  pointerX = event.clientX / width - 0.5;
  pointerY = event.clientY / height - 0.5;
  targetShiftX = pointerX * MAX_PARALLAX_SHIFT;
  targetShiftY = pointerY * MAX_PARALLAX_SHIFT;

  if (!parallaxRunning) {
    parallaxRunning = true;
    requestAnimationFrame(runParallaxFrame);
  }
}

function runParallaxFrame() {
  const dx = targetShiftX - currentShiftX;
  const dy = targetShiftY - currentShiftY;
  const distance = Math.abs(dx) + Math.abs(dy);

  currentShiftX += dx * 0.1;
  currentShiftY += dy * 0.1;

  drawGrid(1, 1);

  if (distance < 0.02) {
    parallaxRunning = false;
    return;
  }

  requestAnimationFrame(runParallaxFrame);
}

function onPointerLeave() {
  if (!parallaxEnabled) return;

  targetShiftX = 0;
  targetShiftY = 0;

  if (!parallaxRunning) {
    parallaxRunning = true;
    requestAnimationFrame(runParallaxFrame);
  }
}

function start() {
  resizeCanvas();
  parallaxEnabled = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

  if (reduceMotion) {
    drawGrid(1, 1);
    revealContent();
  } else {
    introStart = performance.now();
    introFrame = requestAnimationFrame(runIntroFrame);
  }

  window.addEventListener("resize", () => {
    resizeCanvas();
    if (introFrame) {
      return;
    }
    drawGrid(1, 1);
  });

  window.addEventListener("orientationchange", () => {
    resizeCanvas();
    if (!introFrame) {
      drawGrid(1, 1);
    }
  });

  if (parallaxEnabled && !reduceMotion) {
    window.addEventListener("mousemove", onPointerMove, { passive: true });
    window.addEventListener("mouseleave", onPointerLeave, { passive: true });
  }
}

start();
