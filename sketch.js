function setup() {
  createCanvas(400, 400);
}

// Muestra en pantalla cualquier error real (ya no deberia salir
// "Script error." generico gracias al crossorigin en index.html)
window.addEventListener("error", (e) => {
  document.body.insertAdjacentHTML("beforeend",
    `<pre style="position:fixed;top:0;left:0;background:#300;color:#f88;
     padding:10px;font-size:12px;max-width:90vw;z-index:9999;">
     ERROR: ${e.message}\n${e.filename}:${e.lineno}</pre>`);
});

// =========================================================
// ESTADO GLOBAL
// =========================================================
let paddle, ball, blocks = [];
let gameState = "SETUP"; // SETUP (diseño) o PLAY (musica activa)
let particles = [];

// --- Parametros de Kuramoto (ajustables en tiempo real) ---
let K = 0.55;          // fuerza de acoplamiento -> flechas arriba/abajo
let noiseAmt = 0.0;     // ruido de fase (empuja hacia el desorden) -> flechas izq/der
const K_MIN = 0, K_MAX = 3.5, K_STEP = 0.015;
const NOISE_MIN = 0, NOISE_MAX = 0.05, NOISE_STEP = 0.0006;

// dispersion de frecuencias naturales: pequena a proposito para que
// el sistema pueda sincronizar, pero con K moderado tarda en lograrlo
const FREQ_BASE = 0.020;
const FREQ_SPREAD = 0.006; // +/- alrededor de la base

// escala pentatonica (grados). El registro/octava lo define la fila.
const harpDegrees = [261.63, 293.66, 329.63, 392.00, 440.00];

const colorGroups = [
  { name: "Pink",     col: [255, 140, 170] },
  { name: "Sky",      col: [130, 200, 255] },
  { name: "Lavender", col: [200, 150, 255] },
  { name: "Mint",     col: [140, 255, 190] }
];
let selectedColorIndex = 0;

// --- Layout responsivo ---
let BLOCK_W = 44, BLOCK_H = 18, GAP = 7;
let TOP_MARGIN = 90, BOTTOM_MARGIN = 190;
let COLUMNS = 10, ROWS = 6;
let OFFSET_LEFT = 0, OFFSET_TOP = 0;

// --- Audio ---
let voicePool;
let audioReady = false;

// =========================================================
// SETUP
// =========================================================
function setup() {
  createCanvas(windowWidth, windowHeight);
  textAlign(CENTER, CENTER);
  rectMode(CORNER);
  computeLayout();

  paddle = new Paddle();
  ball = new Ball();
  voicePool = new VoicePool(24);
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  computeLayout();
  for (let b of blocks) b.reposition();
  paddle.reposition();
}

function computeLayout() {
  BLOCK_W = constrain(width / 22, 26, 60);
  BLOCK_H = BLOCK_W * 0.4;
  GAP = BLOCK_W * 0.16;
  TOP_MARGIN = height * 0.12;
  BOTTOM_MARGIN = height * 0.30;

  COLUMNS = floor((width * 0.9) / (BLOCK_W + GAP));
  ROWS = floor((height - TOP_MARGIN - BOTTOM_MARGIN) / (BLOCK_H + GAP));
  COLUMNS = max(COLUMNS, 4);
  ROWS = max(ROWS, 3);

  OFFSET_LEFT = (width - COLUMNS * (BLOCK_W + GAP)) / 2;
  OFFSET_TOP = TOP_MARGIN;
}

// =========================================================
// DRAW LOOP
// =========================================================
function draw() {
  setGradient(0, 0, width, height, color(14, 10, 28), color(46, 30, 62));
  handleContinuousInput();

  if (gameState === "SETUP") {
    drawSetupScreen();
  } else {
    playGame();
  }

  drawParticles();
  drawHUD();
}

function handleContinuousInput() {
  if (keyIsDown(UP_ARROW))   K = constrain(K + K_STEP, K_MIN, K_MAX);
  if (keyIsDown(DOWN_ARROW)) K = constrain(K - K_STEP, K_MIN, K_MAX);
  if (keyIsDown(RIGHT_ARROW)) noiseAmt = constrain(noiseAmt + NOISE_STEP, NOISE_MIN, NOISE_MAX);
  if (keyIsDown(LEFT_ARROW))  noiseAmt = constrain(noiseAmt - NOISE_STEP, NOISE_MIN, NOISE_MAX);
}

function setGradient(x, y, w, h, c1, c2) {
  noFill();
  for (let i = y; i <= y + h; i += 2) {
    let inter = map(i, y, y + h, 0, 1);
    stroke(lerpColor(c1, c2, inter));
    line(x, i, x + w, i + 2);
  }
}

// =========================================================
// JUEGO
// =========================================================
function playGame() {
  paddle.update();
  paddle.display();
  ball.update();
  ball.display();
  ball.checkPaddleCollision(paddle);

  applyKuramotoSync();

  for (let b of blocks) {
    ball.checkBlockCollision(b);
    b.update();
    b.display();
  }
}

// Kuramoto campo-medio POR GRUPO DE COLOR:
// dTheta_i/dt = omega_i + (K/N) * sum_j sin(theta_j - theta_i) + ruido
// K normalizado por N (no por "count" crudo distinto) => el umbral de
// sincronizacion NO depende de cuantos bloques haya, solo de K vs la
// dispersion de omega. Asi con 8 o con 100 bloques el comportamiento
// cualitativo (rapido/lento) es el mismo.
function applyKuramotoSync() {
  for (let i = 0; i < blocks.length; i++) {
    let b1 = blocks[i];
    let sumSin = 0, n = 0;
    for (let j = 0; j < blocks.length; j++) {
      if (i === j) continue;
      let b2 = blocks[j];
      if (b1.group.name === b2.group.name) {
        sumSin += sin(b2.phase - b1.phase);
        n++;
      }
    }
    let coupling = (n > 0) ? (K / n) * sumSin : 0;
    let noise = noiseAmt > 0 ? random(-noiseAmt, noiseAmt) : 0;
    b1.phaseVelocity = b1.naturalFreq + coupling + noise;
  }
}

// parametro de orden r del modelo de Kuramoto para un grupo:
// r * e^(i*psi) = (1/N) * sum_j e^(i*theta_j)
function orderParameter(groupName) {
  let sx = 0, sy = 0, n = 0;
  for (let b of blocks) {
    if (groupName && b.group.name !== groupName) continue;
    sx += cos(b.phase);
    sy += sin(b.phase);
    n++;
  }
  if (n === 0) return 0;
  return dist(0, 0, sx / n, sy / n);
}

function globalOrder() {
  if (blocks.length === 0) return 0;
  let sx = 0, sy = 0;
  for (let b of blocks) { sx += cos(b.phase); sy += sin(b.phase); }
  return dist(0, 0, sx / blocks.length, sy / blocks.length);
}

// =========================================================
// PANTALLAS
// =========================================================
function drawSetupScreen() {
  drawGridGuides();

  fill(255, 235);
  textSize(min(width, height) * 0.032);
  text("TALLER DE PAISAJE SONORO — CAJA DE MÚSICA KURAMOTO", width / 2, height - BOTTOM_MARGIN + 40);

  textSize(min(width, height) * 0.016);
  fill(200, 180, 220);
  text("Clic: poner/quitar bloque   ·   Teclas 1–4: color   ·   ESPACIO: tocar", width / 2, height - BOTTOM_MARGIN + 68);

  drawPalette();
  for (let b of blocks) b.displaySetup();
}

function drawPalette() {
  let n = colorGroups.length;
  let sw = BLOCK_W * 1.3;
  let startX = width / 2 - (n * (sw + 12)) / 2;
  let y = height - BOTTOM_MARGIN + 100;
  for (let i = 0; i < n; i++) {
    let g = colorGroups[i];
    if (i === selectedColorIndex) { stroke(255); strokeWeight(2); } else { noStroke(); }
    fill(g.col[0], g.col[1], g.col[2]);
    rect(startX + i * (sw + 12), y, sw, sw * 0.5, 6);
  }
}

function drawGridGuides() {
  noFill();
  stroke(255, 255, 255, 22);
  for (let c = 0; c < COLUMNS; c++) {
    for (let r = 0; r < ROWS; r++) {
      let x = c * (BLOCK_W + GAP) + OFFSET_LEFT;
      let y = r * (BLOCK_H + GAP) + OFFSET_TOP;
      rect(x, y, BLOCK_W, BLOCK_H, 6);
    }
  }
}

function drawHUD() {
  let r = globalOrder();
  let label, labelCol;
  if (r < 0.30)      { label = "DESORDEN";               labelCol = [255, 120, 120]; }
  else if (r < 0.75) { label = "ORGANIZACIÓN PARCIAL";    labelCol = [255, 210, 120]; }
  else               { label = "ORGANIZACIÓN ESTABLE";    labelCol = [140, 255, 170]; }

  push();
  textAlign(LEFT, TOP);
  textSize(13);
  noStroke();
  fill(255, 210);
  text("K (acoplamiento): " + nf(K, 1, 2) + "   [↑ / ↓]", 16, 14);
  fill(255, 180);
  text("Ruido (desorden): " + nf(noiseAmt, 1, 4) + "   [← / →]", 16, 34);

  fill(labelCol[0], labelCol[1], labelCol[2]);
  textSize(15);
  text("Estado colectivo: " + label + "  (r=" + nf(r, 1, 2) + ")", 16, 58);

  // barra de coherencia
  noFill();
  stroke(255, 80);
  rect(16, 82, 180, 8, 4);
  noStroke();
  fill(labelCol[0], labelCol[1], labelCol[2]);
  rect(16, 82, 180 * r, 8, 4);
  pop();
}

// =========================================================
// INTERACCION
// =========================================================
function mousePressed() {
  if (!audioReady) { userStartAudio(); audioReady = true; }

  if (mouseY < OFFSET_TOP + ROWS * (BLOCK_H + GAP)) {
    let c = floor((mouseX - OFFSET_LEFT) / (BLOCK_W + GAP));
    let r = floor((mouseY - OFFSET_TOP) / (BLOCK_H + GAP));
    if (c >= 0 && c < COLUMNS && r >= 0 && r < ROWS) {
      let idx = blocks.findIndex(b => b.col === c && b.row === r);
      let group = colorGroups[selectedColorIndex];
      if (idx !== -1) {
        if (blocks[idx].group.name === group.name) blocks.splice(idx, 1);
        else blocks[idx].group = group;
      } else {
        blocks.push(new MusicBlock(c, r, group));
      }
    }
  }
}

function keyPressed() {
  if (key >= '1' && key <= '4') selectedColorIndex = int(key) - 1;

  if (key === ' ') {
    if (!audioReady) { userStartAudio(); audioReady = true; }
    if (gameState === "SETUP" && blocks.length > 0) {
      gameState = "PLAY";
      ball.reset();
    } else if (gameState === "PLAY") {
      gameState = "SETUP";
    }
  }
}

// =========================================================
// PARTICULAS (feedback visual de perturbacion)
// =========================================================
function spawnBurst(x, y, col) {
  for (let i = 0; i < 7; i++) {
    particles.push({
      x, y,
      vx: random(-2, 2), vy: random(-3, -0.5),
      life: 255, col
    });
  }
}
function drawParticles() {
  noStroke();
  for (let i = particles.length - 1; i >= 0; i--) {
    let p = particles[i];
    p.x += p.vx; p.y += p.vy; p.vy += 0.05; p.life -= 8;
    fill(p.col[0], p.col[1], p.col[2], p.life);
    circle(p.x, p.y, 4);
    if (p.life <= 0) particles.splice(i, 1);
  }
}

// =========================================================
// AUDIO: pool de voces reutilizables (evita crear/destruir
// osciladores por nota, que era la causa de clics/saturacion)
// =========================================================
class VoicePool {
  constructor(size) {
    this.reverb = new p5.Reverb();
    this.voices = [];
    for (let i = 0; i < size; i++) {
      let osc = new p5.Oscillator('sine');
      let sub = new p5.Oscillator('triangle'); // capa suave a la octava
      osc.amp(0); sub.amp(0);
      osc.start(); sub.start();
      osc.disconnect(); sub.disconnect();
      this.reverb.process(osc, 2.2, 2.5);
      this.reverb.process(sub, 2.2, 2.5);
      this.voices.push({ osc, sub, busy: false, timer: null });
    }
  }
  play(freq, peakAmp, isPerturbed) {
    let v = this.voices.find(v => !v.busy) || this.voices[0];
    v.busy = true;
    if (v.timer) clearTimeout(v.timer);

    v.osc.freq(freq);
    v.sub.freq(freq * 2); // octava superior, siempre consonante

    v.osc.amp(0);
    v.sub.amp(0);
    v.osc.amp(peakAmp, 0.02);
    v.sub.amp(isPerturbed ? peakAmp * 0.5 : peakAmp * 0.2, 0.02);

    let release = isPerturbed ? 1.6 : 2.0;
    v.timer = setTimeout(() => {
      v.osc.amp(0, release);
      v.sub.amp(0, release);
      setTimeout(() => { v.busy = false; }, release * 1000);
    }, 45);
  }
}

// =========================================================
// PADDLE / BALL
// =========================================================
class Paddle {
  constructor() { this.reposition(); }
  reposition() {
    this.w = width * 0.14;
    this.h = height * 0.014;
    this.y = height - BOTTOM_MARGIN + 130;
    this.x = width / 2 - this.w / 2;
  }
  update() { this.x = constrain(mouseX - this.w / 2, 0, width - this.w); }
  display() { noStroke(); fill(255, 255, 255, 210); rect(this.x, this.y, this.w, this.h, 10); }
}

class Ball {
  constructor() { this.reset(); }
  reset() {
    this.x = width / 2;
    this.y = height / 2;
    this.r = max(width, height) * 0.009;
    this.vx = random(-2, 2);
    this.vy = -3.4;
    this.prevX = this.x; this.prevY = this.y;
  }
  update() {
    this.prevX = this.x; this.prevY = this.y;
    this.x += this.vx; this.y += this.vy;
    if (this.x - this.r < 0) { this.x = this.r; this.vx *= -1; }
    if (this.x + this.r > width) { this.x = width - this.r; this.vx *= -1; }
    if (this.y - this.r < 0) { this.y = this.r; this.vy *= -1; }
    let floorY = height - BOTTOM_MARGIN + 110;
    if (this.y > floorY) { this.y = floorY - 10; this.vy *= -1; }
  }
  display() {
    noStroke();
    fill(255, 250, 230, 240);
    circle(this.x, this.y, this.r * 2);
    fill(255, 255, 255, 55);
    circle(this.x, this.y, this.r * 4);
  }
  checkPaddleCollision(p) {
    if (this.x + this.r > p.x && this.x - this.r < p.x + p.w &&
        this.y + this.r > p.y && this.y - this.r < p.y + p.h) {
      this.vx = (this.x - (p.x + p.w / 2)) * 0.12;
      this.vy *= -1;
      this.y = p.y - this.r;
    }
  }
  checkBlockCollision(b) {
    if (this.x + this.r > b.x && this.x - this.r < b.x + b.w &&
        this.y + this.r > b.y && this.y - this.r < b.y + b.h) {
      b.perturb();
      if (this.prevY + this.r <= b.y || this.prevY - this.r >= b.y + b.h) {
        this.vy *= -1;
        this.y = (this.vy > 0) ? b.y + b.h + this.r : b.y - this.r;
      } else {
        this.vx *= -1;
        this.x = (this.vx > 0) ? b.x + b.w + this.r : b.x - this.r;
      }
      return true;
    }
    return false;
  }
}

// =========================================================
// MUSIC BLOCK
// =========================================================
class MusicBlock {
  constructor(col, row, group) {
    this.col = col; this.row = row;
    this.group = group;
    this.reposition();

    this.phase = random(TWO_PI);
    // dispersion pequena a proposito: con K moderado, sincroniza
    // pero le toma tiempo (no es instantaneo ni con muchos bloques)
    this.naturalFreq = FREQ_BASE + random(-FREQ_SPREAD, FREQ_SPREAD);
    this.phaseVelocity = this.naturalFreq;

    // grado de la escala por columna, octava por fila (arriba = agudo)
    let degree = harpDegrees[col % harpDegrees.length];
    let octaveExp = map(row, 0, max(ROWS - 1, 1), 1, -1);
    this.noteFreq = degree * pow(2, octaveExp);

    this.pulse = 0; // para el "flash" visual al sonar
  }

  reposition() {
    this.x = this.col * (BLOCK_W + GAP) + OFFSET_LEFT;
    this.y = this.row * (BLOCK_H + GAP) + OFFSET_TOP;
    this.w = BLOCK_W; this.h = BLOCK_H;
  }

  update() {
    let prevPhase = this.phase;
    this.phase += this.phaseVelocity;
    this.pulse *= 0.9;

    if (floor(this.phase / TWO_PI) > floor(prevPhase / TWO_PI)) {
      this.pluck(false);
    }
  }

  perturb() {
    this.phase += PI / 2;
    this.pulse = 1;
    this.pluck(true);
    spawnBurst(this.x + this.w / 2, this.y + this.h / 2, this.group.col);
  }

  pluck(isPerturbed) {
    let peakAmp = isPerturbed ? 0.05 : 0.025;
    voicePool.play(this.noteFreq, peakAmp, isPerturbed);
    if (!isPerturbed) this.pulse = max(this.pulse, 0.6);
  }

  displaySetup() {
    noStroke();
    fill(this.group.col[0], this.group.col[1], this.group.col[2]);
    rect(this.x, this.y, this.w, this.h, 6);
  }

  display() {
    let baseGlow = map(sin(this.phase), -1, 1, 90, 200);
    let glow = baseGlow + this.pulse * 90;
    noStroke();
    fill(this.group.col[0], this.group.col[1], this.group.col[2], min(glow, 255));
    rect(this.x, this.y, this.w, this.h, 6);

    if (this.pulse > 0.05) {
      let ext = this.pulse * BLOCK_W * 0.6;
      fill(this.group.col[0], this.group.col[1], this.group.col[2], this.pulse * 80);
      rect(this.x - ext / 2, this.y - ext / 2, this.w + ext, this.h + ext, 8);
    }
  }
}
