/**
 * ============================================================================
 * CAJA DE MÚSICA ETÉREA GENERATIVA BASADA EN KURAMOTO
 * ============================================================================
 * Experiencia audiovisual performativa y contemplativa para la Web.
 * 
 * Dinámica matemática de Kuramoto:
 * dθᵢ/dt = ωᵢ + Σⱼ Kᵢⱼ sin(θⱼ - θᵢ) + ξᵢ(t)
 * 
 * Sincronización lenta y progresiva (~1 minuto):
 * - K rescalado para una convergencia suave y meditativa.
 * - dθᵢ/dt acotado estrictamente hacia adelante para evitar oscilaciones
 *   negativas o inestabilidad numérica.
 * - Fases iniciales distribuidas uniformemente por proporción áurea.
 * 
 * Interacción performativa:
 * - Modo Diseño (SETUP) para colocar/quitar bloques en la constelación.
 * - Modo Tocar (PLAY) con la pelota etérea y el paddle.
 * - La pelota al golpear un bloque reinicia 100% su tiempo (phase = 0).
 * - Control de velocidad de la pelota.
 * - Al salir del campo: onda expansiva luminosa que desorganiza armónicamente.
 * ============================================================================
 */

// ============================================================================
// 1. MOTOR DE AUDIO WEB AUDIO API
// ============================================================================
class EtherealAudioEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.limiter = null;
    this.reverbNode = null;
    this.isReady = false;
  }

  init() {
    if (this.isReady) return;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioContext();

      // Limitador / Compresor Maestro
      this.limiter = this.ctx.createDynamicsCompressor();
      this.limiter.threshold.setValueAtTime(-14, this.ctx.currentTime);
      this.limiter.knee.setValueAtTime(8, this.ctx.currentTime);
      this.limiter.ratio.setValueAtTime(14, this.ctx.currentTime);
      this.limiter.attack.setValueAtTime(0.003, this.ctx.currentTime);
      this.limiter.release.setValueAtTime(0.20, this.ctx.currentTime);

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(0.75, this.ctx.currentTime);

      // Reverberación convolutiva procedural etérea
      this.reverbNode = this.createEtherealReverb(2.6, 2.2);

      this.reverbGain = this.ctx.createGain();
      this.reverbGain.gain.setValueAtTime(0.48, this.ctx.currentTime);

      this.dryGain = this.ctx.createGain();
      this.dryGain.gain.setValueAtTime(0.65, this.ctx.currentTime);

      this.limiter.connect(this.dryGain);
      this.dryGain.connect(this.masterGain);

      this.limiter.connect(this.reverbNode);
      this.reverbNode.connect(this.reverbGain);
      this.reverbGain.connect(this.masterGain);

      this.masterGain.connect(this.ctx.destination);
      this.isReady = true;

      const banner = document.getElementById("audio-prompt");
      if (banner) banner.style.display = "none";
    } catch (e) {
      console.warn("Web Audio API inicialización diferida:", e);
    }
  }

  resume() {
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume();
    }
  }

  createEtherealReverb(duration, decay) {
    const sampleRate = this.ctx.sampleRate;
    const length = sampleRate * duration;
    const impulse = this.ctx.createBuffer(2, length, sampleRate);
    const left = impulse.getChannelData(0);
    const right = impulse.getChannelData(1);

    for (let i = 0; i < length; i++) {
      const t = i / length;
      const factor = Math.exp(-t * decay * 3.5);
      left[i] = (Math.random() * 2 - 1) * factor;
      right[i] = (Math.random() * 2 - 1) * factor;
    }

    const convolver = this.ctx.createConvolver();
    convolver.buffer = impulse;
    return convolver;
  }

  playNote(familyId, freq, panX, isPerturbed = false) {
    if (!this.isReady) return;
    this.resume();

    const now = this.ctx.currentTime;

    // Escalar dinámicamente la ganancia según el total de bloques activos
    // para que incluso con 80+ bloques sonando juntos, la mezcla sea cristalina
    const blockCount = Math.max(16, blocks.length);
    const polyScale = constrain(24 / blockCount, 0.32, 1.0);

    const panner = this.ctx.createStereoPanner ? this.ctx.createStereoPanner() : null;
    if (panner) {
      panner.pan.setValueAtTime(constrain(panX, -0.85, 0.85), now);
      panner.connect(this.limiter);
    }

    const dest = panner || this.limiter;

    switch (familyId) {
      case 0:
        this.synthCrystal(freq, dest, now, isPerturbed, polyScale);
        break;
      case 1:
        this.synthPetal(freq, dest, now, isPerturbed, polyScale);
        break;
      case 2:
        this.synthStar(freq, dest, now, isPerturbed, polyScale);
        break;
      case 3:
        this.synthMoon(freq, dest, now, isPerturbed, polyScale);
        break;
    }
  }

  synthCrystal(freq, dest, now, isPerturbed, polyScale = 1.0) {
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc1.type = "sine";
    osc2.type = "sine";
    osc1.frequency.setValueAtTime(freq, now);
    osc2.frequency.setValueAtTime(freq * 2 + 1.2, now);

    const amp = (isPerturbed ? 0.08 : 0.05) * polyScale;
    const dur = isPerturbed ? 1.7 : 2.1;

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(amp, now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(dest);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + dur + 0.05);
    osc2.stop(now + dur + 0.05);
  }

  synthPetal(freq, dest, now, isPerturbed, polyScale = 1.0) {
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc.type = "triangle";
    osc.frequency.setValueAtTime(freq, now);

    filter.type = "lowpass";
    filter.frequency.setValueAtTime(1200, now);
    filter.Q.setValueAtTime(1.5, now);

    const amp = (isPerturbed ? 0.075 : 0.045) * polyScale;
    const dur = isPerturbed ? 1.6 : 1.9;

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(amp, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(dest);

    osc.start(now);
    osc.stop(now + dur + 0.05);
  }

  synthStar(freq, dest, now, isPerturbed, polyScale = 1.0) {
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc1.type = "sine";
    osc2.type = "sine";
    osc1.frequency.setValueAtTime(freq, now);
    osc2.frequency.setValueAtTime(freq * 3, now);

    const amp = (isPerturbed ? 0.07 : 0.04) * polyScale;
    const dur = isPerturbed ? 1.9 : 2.3;

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(amp, now + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(dest);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + dur + 0.05);
    osc2.stop(now + dur + 0.05);
  }

  synthMoon(freq, dest, now, isPerturbed, polyScale = 1.0) {
    const osc = this.ctx.createOscillator();
    const sub = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc.type = "sine";
    sub.type = "sine";
    osc.frequency.setValueAtTime(freq, now);
    sub.frequency.setValueAtTime(freq * 0.5, now);

    filter.type = "lowpass";
    filter.frequency.setValueAtTime(800, now);

    const amp = (isPerturbed ? 0.09 : 0.06) * polyScale;
    const dur = isPerturbed ? 2.2 : 2.7;

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(amp, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);

    osc.connect(filter);
    sub.connect(filter);
    filter.connect(gain);
    gain.connect(dest);

    osc.start(now);
    sub.start(now);
    osc.stop(now + dur + 0.05);
    sub.stop(now + dur + 0.05);
  }

  playWaveSigh() {
    if (!this.isReady) return;
    this.resume();
    const now = this.ctx.currentTime;
    const chord = [220.00, 293.66, 369.99, 440.00];
    chord.forEach((f, i) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(f * 1.5, now + i * 0.04);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(0.015, now + i * 0.04 + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 2.5);
      osc.connect(gain);
      gain.connect(this.reverbNode);
      osc.start(now + i * 0.04);
      osc.stop(now + 2.6);
    });
  }
}

// ============================================================================
// 2. ESCALAS Y FAMILIAS AUDIOVISUALES
// ============================================================================
const HARP_SCALE = [
  146.83, // D3
  185.00, // F#3
  220.00, // A3
  246.94, // B3
  293.66, // D4
  329.63, // E4
  369.99, // F#4
  440.00, // A4
  493.88, // B4
  554.37, // C#5
  587.33, // D5
  659.25, // E5
  739.99, // F#5
  880.00, // A5
  987.77, // B5
  1174.66 // D6
];

const FAMILIES = [
  {
    id: 0,
    name: "Cristal",
    colorHex: "#dcb8ff",
    rgb: [220, 184, 255],
    baseOmega: 0.0165, // ~6.3 segundos por ciclo
    desc: "Prismas translúcidos · Arpa de cristal"
  },
  {
    id: 1,
    name: "Pétalo",
    colorHex: "#ffafcc",
    rgb: [255, 175, 204],
    baseOmega: 0.0175, // ~6.0 segundos por ciclo
    desc: "Formas orgánicas que respiran · Celesta cálida"
  },
  {
    id: 2,
    name: "Estrella",
    colorHex: "#ffe082",
    rgb: [255, 224, 130],
    baseOmega: 0.0155, // ~6.7 segundos por ciclo
    desc: "Polvo cósmico orbital · Campanas de luz"
  },
  {
    id: 3,
    name: "Luna",
    colorHex: "#9be7ff",
    rgb: [155, 231, 255],
    baseOmega: 0.0145, // ~7.2 segundos por ciclo
    desc: "Cápsulas lunares · Cuenco tibetano profundo"
  }
];

// ============================================================================
// 3. ESTADO GLOBAL
// ============================================================================
let audio;
let blocks = [];
let ball;
let paddle;
let perturbationWaves = [];
let particles = [];
let stars = [];

// Modo de la aplicación: "SETUP" (diseño de bloques) o "PLAY" (música activa)
let appMode = "SETUP";
let selectedPaintFamily = 0; // Familia activa para colocar con clic

// Parámetros de Kuramoto (calibrados para sincronización pausada de ~1 minuto)
let K_global = 0.50;      // Acoplamiento intra-familia base
let K_inter = 0.30;       // Acoplamiento inter-familias (Nivel 2)
let freqSpread = 0.006;   // Dispersión natural de frecuencias (Δω)
let noiseLevel = 0.00015; // Micro-fluctuación térmica suave

// Factores de escala de acoplamiento para evolución lenta y matemáticamente estable
const K_INTRA_SCALE = 0.0028;  // A K_global=0.50 -> pull ~0.0014 rad/frame (~60s para sincronizar)
const K_INTER_SCALE = 0.0016;  // A K_inter=0.30 -> pull inter-familias suave

// Velocidad de la pelota
let ballSpeedMult = 1.0;

// Parámetros de orden en tiempo real
let R_global = 0;
let R_families = [0, 0, 0, 0];

// Geometría del campo
// Geometría del campo (por defecto cuadrícula amplia de 14 columnas x 6 filas)
let BLOCK_W, BLOCK_H, GAP_X, GAP_Y;
let FIELD_LEFT, FIELD_TOP, FIELD_WIDTH, FIELD_HEIGHT;
let COLUMNS = 14, ROWS = 6;

// ============================================================================
// 4. SETUP Y CICLO PRINCIPAL (p5.js)
// ============================================================================
function setup() {
  const canvas = createCanvas(windowWidth, windowHeight);
  canvas.parent(document.body);
  colorMode(RGB, 255);
  ellipseMode(CENTER);
  rectMode(CORNER);
  smooth();

  audio = new EtherealAudioEngine();

  initStarfield();
  paddle = new LuminousPaddle();
  ball = new EtherealBall();

  computeFieldDimensions();
  buildInitialConstellation();

  bindDomControls();
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  computeFieldDimensions();
  for (let b of blocks) b.recalculatePosition();
  paddle.reposition();
  initStarfield();
}

function computeFieldDimensions() {
  // Ocupa generosamente hasta el 90% del ancho disponible y deja margen armónico inferior
  const maxAvailableW = min(width * 0.90, 1450);
  const paddleY = paddle ? paddle.y : height - 55;
  const maxAvailableH = min(height * 0.54, paddleY - height * 0.13 - 75);

  const cellW = maxAvailableW / COLUMNS;
  BLOCK_W = constrain(cellW * 0.77, 24, 76);
  GAP_X = constrain(cellW * 0.23, 5, 22);

  const cellH = maxAvailableH / ROWS;
  BLOCK_H = constrain(cellH * 0.68, 14, 42);
  GAP_Y = constrain(cellH * 0.32, 5, 20);

  FIELD_WIDTH = COLUMNS * BLOCK_W + (COLUMNS - 1) * GAP_X;
  FIELD_HEIGHT = ROWS * BLOCK_H + (ROWS - 1) * GAP_Y;

  FIELD_LEFT = (width - FIELD_WIDTH) / 2;
  FIELD_TOP = height * 0.13;
}

// Constelación armónica balanceada en la cuadrícula amplia
function buildInitialConstellation() {
  blocks = [];
  for (let r = 0; r < ROWS; r++) {
    const familyId = r % 4;
    // Patrón celestial con bordes sutilmente escalonados
    const startC = (r === 0 || r === ROWS - 1) ? 2 : 1;
    const endC = (r === 0 || r === ROWS - 1) ? COLUMNS - 2 : COLUMNS - 1;
    for (let c = startC; c < endC; c++) {
      const noteIdx = (r * 3 + c) % HARP_SCALE.length;
      const freq = HARP_SCALE[noteIdx];
      blocks.push(new KuramotoBlock(c, r, familyId, freq));
    }
  }
  randomizePhases();
}

function initStarfield() {
  stars = [];
  const count = floor(map(width * height, 400000, 2000000, 90, 180, true));
  for (let i = 0; i < count; i++) {
    stars.push({
      x: random(width),
      y: random(height),
      size: random(0.8, 2.4),
      alphaBase: random(40, 180),
      speed: random(0.002, 0.007),
      phase: random(TWO_PI)
    });
  }
}

// ============================================================================
// 5. DRAW LOOP
// ============================================================================
function draw() {
  handleContinuousKeys();

  drawCosmicBackground();
  drawStarfield();

  // En modo diseño, dibuja las casillas vacías de la cuadrícula
  if (appMode === "SETUP") {
    drawSetupGridSlots();
  }

  // Actualizar dinámica de Kuramoto
  updateKuramotoDynamics();

  // Ondas de perturbación
  updateAndDrawWaves();

  // Dibujar bloques
  for (let b of blocks) {
    b.update();
    b.display();
  }

  // Paddle y Pelota
  paddle.update();
  paddle.display();

  ball.update();
  ball.checkPaddle(paddle);
  ball.checkBlocks(blocks);
  ball.display();

  // Partículas y HUD
  updateAndDrawParticles();
  drawEtherealHUD();
}

// Dibuja las casillas vacías de la constelación en modo diseño
function drawSetupGridSlots() {
  push();
  rectMode(CORNER);

  for (let c = 0; c < COLUMNS; c++) {
    for (let r = 0; r < ROWS; r++) {
      const exists = blocks.some(b => b.col === c && b.row === r);
      if (!exists) {
        const x = FIELD_LEFT + c * (BLOCK_W + GAP_X);
        const y = FIELD_TOP + r * (BLOCK_H + GAP_Y);

        stroke(255, 255, 255, 22);
        strokeWeight(1);
        fill(255, 255, 255, 5);
        rect(x, y, BLOCK_W, BLOCK_H, 6);

        noStroke();
        fill(255, 255, 255, 35);
        circle(x + BLOCK_W / 2, y + BLOCK_H / 2, 3);
      }
    }
  }

  // Mensaje de guía sutil en modo diseño
  textAlign(CENTER, CENTER);
  textFont("Outfit");
  textSize(12);
  fill(255, 255, 255, 140);
  text("Modo Diseño: Clic para colocar o quitar bloques · Presiona ESPACIO para tocar", width / 2, FIELD_TOP + FIELD_HEIGHT + 35);
  pop();
}

// ============================================================================
// 6. DINÁMICA DE KURAMOTO EN DOS NIVELES (Estable y Progresiva)
// ============================================================================
function updateKuramotoDynamics() {
  const N = blocks.length;
  if (N === 0) {
    R_global = 0;
    R_families = [0, 0, 0, 0];
    return;
  }

  // 1. Calcular parámetros de orden R
  calculateOrderParameters();

  // 2. Integración matemática de Kuramoto
  const deltaThetas = new Float32Array(N);

  // Conteo de miembros por familia para normalizar acoplamiento
  const famCounts = [0, 0, 0, 0];
  for (let b of blocks) famCounts[b.familyId]++;

  for (let i = 0; i < N; i++) {
    const bi = blocks[i];
    let couplingSum = 0;
    const fi = bi.familyId;
    const nSameFamily = famCounts[fi];

    for (let j = 0; j < N; j++) {
      if (i === j) continue;
      const bj = blocks[j];
      const fj = bj.familyId;
      const sinDiff = Math.sin(bj.phase - bi.phase);

      if (fi === fj) {
        // Nivel 1: Acoplamiento intra-familia
        const denom = Math.max(1, nSameFamily);
        couplingSum += ((K_global * K_INTRA_SCALE) / denom) * sinDiff;
      } else {
        // Nivel 2: Acoplamiento inter-familias
        // Se intensifica a medida que ambas familias alcanzan coherencia interna
        const familyCoherence = Math.sqrt(R_families[fi] * R_families[fj]);
        const dynamicInterK = (K_inter * K_INTER_SCALE) * (0.15 + 0.85 * familyCoherence);
        couplingSum += (dynamicInterK / N) * sinDiff;
      }
    }

    const noise = (Math.random() * 2 - 1) * noiseLevel;

    // FÓRMULA CLAVE DE ESTABILIDAD:
    // La velocidad de fase siempre se mantiene positiva (>= 0.003 rad/frame),
    // lo que elimina cualquier oscilación negativa, retroceso o inestabilidad numérica.
    deltaThetas[i] = Math.max(0.003, bi.naturalFreq + couplingSum + noise);
  }

  // 3. Aplicar avance de fase y detectar cruce de ciclo
  for (let i = 0; i < N; i++) {
    const b = blocks[i];
    b.phase += deltaThetas[i];

    // Cruce de ciclo [0, 2π) -> Disparo del sonido y del destello
    if (b.phase >= TWO_PI) {
      b.phase = b.phase % TWO_PI;
      b.triggerPluck(false);
    }
  }
}

function calculateOrderParameters() {
  const N = blocks.length;
  let globalCos = 0, globalSin = 0;
  const famCos = [0, 0, 0, 0];
  const famSin = [0, 0, 0, 0];
  const famCounts = [0, 0, 0, 0];

  for (let i = 0; i < N; i++) {
    const b = blocks[i];
    const c = Math.cos(b.phase);
    const s = Math.sin(b.phase);

    globalCos += c;
    globalSin += s;

    famCos[b.familyId] += c;
    famSin[b.familyId] += s;
    famCounts[b.familyId]++;
  }

  R_global = Math.sqrt(globalCos * globalCos + globalSin * globalSin) / N;

  for (let f = 0; f < 4; f++) {
    if (famCounts[f] > 0) {
      R_families[f] = Math.sqrt(famCos[f] * famCos[f] + famSin[f] * famSin[f]) / famCounts[f];
    } else {
      R_families[f] = 0;
    }
  }
}

// ============================================================================
// 7. BLOQUE DE KURAMOTO
// ============================================================================
class KuramotoBlock {
  constructor(col, row, familyId, noteFreq) {
    this.col = col;
    this.row = row;
    this.familyId = familyId;
    this.family = FAMILIES[familyId];
    this.noteFreq = noteFreq;

    this.recalculatePosition();

    this.phase = random(TWO_PI);
    this.naturalFreq = this.family.baseOmega + (random(-1, 1) + random(-1, 1)) * 0.5 * freqSpread;

    this.flashPulse = 0;
    this.perturbScale = 1.0;
    this.lastPluckTime = 0;
  }

  recalculatePosition() {
    this.x = FIELD_LEFT + this.col * (BLOCK_W + GAP_X);
    this.y = FIELD_TOP + this.row * (BLOCK_H + GAP_Y);
    this.w = BLOCK_W;
    this.h = BLOCK_H;
    this.centerX = this.x + this.w / 2;
    this.centerY = this.y + this.h / 2;
  }

  update() {
    this.flashPulse *= 0.90;
    this.perturbScale += (1.0 - this.perturbScale) * 0.12;
  }

  triggerPluck(isPerturbed = false) {
    const nowMs = millis();
    if (this.lastPluckTime && nowMs - this.lastPluckTime < 80) return;
    this.lastPluckTime = nowMs;

    this.flashPulse = 1.0;
    const panNorm = map(this.centerX, 0, width, -0.85, 0.85);
    audio.playNote(this.familyId, this.noteFreq, panNorm, isPerturbed);

    const sparkCount = isPerturbed ? 10 : 4;
    for (let i = 0; i < sparkCount; i++) {
      particles.push(new StardustSpark(
        this.centerX + random(-this.w * 0.3, this.w * 0.3),
        this.centerY + random(-this.h * 0.3, this.h * 0.3),
        this.family.rgb,
        isPerturbed ? 1.6 : 1.0
      ));
    }
  }

  // REINICIO COMPLETO DE TIEMPO:
  // La pelota al golpear resetea la fase a 0.0 exactamente
  resetTiming() {
    this.phase = 0; // FULLY RESET TIMING
    this.flashPulse = 1.0;
    this.perturbScale = 1.35;
    this.triggerPluck(true);
  }

  perturbByWave(waveDist, maxDistance = 650) {
    const factor = Math.exp(-waveDist / maxDistance);
    const delta = factor * 2.0;
    this.phase = (this.phase + delta) % TWO_PI;
    this.flashPulse = max(this.flashPulse, factor * 0.85);
    this.perturbScale = 1.0 + factor * 0.22;

    for (let i = 0; i < 3; i++) {
      particles.push(new StardustSpark(this.centerX, this.centerY, this.family.rgb, 0.8));
    }
  }

  display() {
    push();
    translate(this.centerX, this.centerY);
    scale(this.perturbScale);

    const rgb = this.family.rgb;
    const phaseProgress = this.phase / TWO_PI;
    const anticipGlow = Math.pow(phaseProgress, 3.2);

    const currentAlpha = map(this.flashPulse, 0, 1, 90 + anticipGlow * 110, 255);

    // Halo difuso exterior que respira con la fase
    noStroke();
    const haloSize = (this.w + this.h) * 0.45 * (1 + 0.15 * Math.sin(this.phase));
    fill(rgb[0], rgb[1], rgb[2], 18 + this.flashPulse * 45 + anticipGlow * 25);
    ellipse(0, 0, haloSize * 1.8, haloSize * 1.3);

    switch (this.familyId) {
      case 0:
        this.drawCrystalFamily(currentAlpha, phaseProgress, rgb);
        break;
      case 1:
        this.drawPetalFamily(currentAlpha, phaseProgress, rgb);
        break;
      case 2:
        this.drawStarFamily(currentAlpha, phaseProgress, rgb);
        break;
      case 3:
        this.drawMoonFamily(currentAlpha, phaseProgress, rgb);
        break;
    }

    // Destello de pulso
    if (this.flashPulse > 0.05) {
      noFill();
      stroke(255, 255, 255, this.flashPulse * 240);
      strokeWeight(1.5 + this.flashPulse * 2);
      const fw = this.w + this.flashPulse * 18;
      const fh = this.h + this.flashPulse * 18;
      rect(-fw / 2, -fh / 2, fw, fh, 8);
    }

    pop();
  }

  drawCrystalFamily(alphaVal, phaseProgress, rgb) {
    const hw = this.w / 2;
    const hh = this.h / 2;

    fill(rgb[0], rgb[1], rgb[2], alphaVal * 0.55);
    stroke(255, 255, 255, map(this.flashPulse, 0, 1, 70, 240));
    strokeWeight(1.2);

    beginShape();
    vertex(-hw + 8, -hh);
    vertex(hw - 8, -hh);
    vertex(hw, 0);
    vertex(hw - 8, hh);
    vertex(-hw + 8, hh);
    vertex(-hw, 0);
    endShape(CLOSE);

    stroke(255, 255, 255, 45 + this.flashPulse * 120);
    strokeWeight(0.8);
    line(-hw + 14, 0, hw - 14, 0);

    // Prisma orbital que anticipa la fase
    const orbitAngle = this.phase - HALF_PI;
    const orbitRadX = hw + 9;
    const orbitRadY = hh + 7;
    const px = Math.cos(orbitAngle) * orbitRadX;
    const py = Math.sin(orbitAngle) * orbitRadY;

    noFill();
    stroke(rgb[0], rgb[1], rgb[2], 30 + phaseProgress * 55);
    strokeWeight(1);
    ellipse(0, 0, orbitRadX * 2, orbitRadY * 2);

    fill(255, 255, 255, 140 + phaseProgress * 115);
    noStroke();
    push();
    translate(px, py);
    rotate(orbitAngle + QUARTER_PI);
    const pSize = 3.5 + phaseProgress * 2.5 + this.flashPulse * 3;
    rect(-pSize / 2, -pSize / 2, pSize, pSize);
    pop();
  }

  drawPetalFamily(alphaVal, phaseProgress, rgb) {
    const hw = this.w / 2;
    const hh = this.h / 2;

    const unfold = Math.sin(this.phase * 0.5) * 6 + phaseProgress * 5;
    noStroke();
    fill(rgb[0], rgb[1], rgb[2], 25 + phaseProgress * 65);
    ellipse(-hw * 0.5, -hh - unfold, 12, 10);
    ellipse(hw * 0.5, -hh - unfold, 12, 10);
    ellipse(-hw * 0.5, hh + unfold, 12, 10);
    ellipse(hw * 0.5, hh + unfold, 12, 10);

    fill(rgb[0], rgb[1], rgb[2], alphaVal * 0.6);
    stroke(255, 240, 245, map(this.flashPulse, 0, 1, 60, 230));
    strokeWeight(1.2);
    rect(-hw, -hh, this.w, this.h, 14);

    noFill();
    stroke(255, 255, 255, 50 + phaseProgress * 120);
    strokeWeight(1.4);
    const arcRadius = hw * 0.7;
    arc(0, 0, arcRadius * 2, hh * 1.5, -PI * phaseProgress, PI * phaseProgress);
  }

  drawStarFamily(alphaVal, phaseProgress, rgb) {
    const hw = this.w / 2;
    const hh = this.h / 2;

    fill(rgb[0], rgb[1], rgb[2], alphaVal * 0.55);
    stroke(255, 255, 220, map(this.flashPulse, 0, 1, 75, 240));
    strokeWeight(1.2);
    rect(-hw, -hh, this.w, this.h, 6);

    const starGlow = 4 + phaseProgress * 5 + this.flashPulse * 7;
    fill(255, 255, 240, 160 + phaseProgress * 95);
    noStroke();
    beginShape();
    vertex(0, -starGlow);
    vertex(starGlow * 0.35, -starGlow * 0.35);
    vertex(starGlow, 0);
    vertex(starGlow * 0.35, starGlow * 0.35);
    vertex(0, starGlow);
    vertex(-starGlow * 0.35, starGlow * 0.35);
    vertex(-starGlow, 0);
    vertex(-starGlow * 0.35, -starGlow * 0.35);
    endShape(CLOSE);

    for (let i = 0; i < 3; i++) {
      const angle = this.phase + (i * TWO_PI) / 3;
      const orbitR = map(phaseProgress, 0, 1, hw + 10, hw * 0.65);
      const sx = Math.cos(angle) * orbitR;
      const sy = Math.sin(angle) * (hh * 0.8 + 4);
      fill(255, 255, 255, 120 + phaseProgress * 135);
      circle(sx, sy, 2.2 + phaseProgress * 1.5);
    }
  }

  drawMoonFamily(alphaVal, phaseProgress, rgb) {
    const hw = this.w / 2;
    const hh = this.h / 2;

    fill(rgb[0], rgb[1], rgb[2], alphaVal * 0.52);
    stroke(220, 245, 255, map(this.flashPulse, 0, 1, 70, 235));
    strokeWeight(1.2);
    rect(-hw, -hh, this.w, this.h, hh);

    noFill();
    stroke(255, 255, 255, 70 + phaseProgress * 150);
    strokeWeight(1.8);
    const moonRadius = hh * 0.72;
    arc(0, 0, moonRadius * 2, moonRadius * 2, -HALF_PI, -HALF_PI + TWO_PI * phaseProgress);

    fill(255, 255, 255, 40 + phaseProgress * 120);
    noStroke();
    circle(0, 0, 4 + phaseProgress * 4);
  }
}

// ============================================================================
// 8. LA PELOTA ETÉREA Y EL PADDLE
// ============================================================================
class EtherealBall {
  constructor() {
    this.reset();
    this.history = [];
    this.isRespawning = false;
    this.respawnTimer = 0;
  }

  reset() {
    this.x = width / 2;
    const paddleY = paddle ? paddle.y : height - 55;
    const clearanceCenter = (FIELD_TOP + FIELD_HEIGHT + paddleY) / 2;
    this.y = constrain(clearanceCenter, FIELD_TOP + FIELD_HEIGHT + 20, paddleY - 25);
    this.r = 7.5;
    this.vx = random([-2.2, 2.2]);
    this.vy = -3.2;
    this.history = [];
    this.isRespawning = false;
  }

  update() {
    if (appMode === "SETUP") {
      // En modo diseño, la pelota espera posada sobre el paddle
      this.x = paddle.x + paddle.w / 2;
      this.y = paddle.y - this.r - 2;
      this.history = [];
      return;
    }

    if (this.isRespawning) {
      this.respawnTimer--;
      if (this.respawnTimer <= 0) {
        this.reset();
      }
      return;
    }

    this.history.push({ x: this.x, y: this.y, life: 1.0 });
    if (this.history.length > 14) this.history.shift();
    for (let h of this.history) h.life *= 0.88;

    // Movimiento escalado con ballSpeedMult
    this.x += this.vx * ballSpeedMult;
    this.y += this.vy * ballSpeedMult;

    // Rebotes laterales
    if (this.x - this.r < 10) {
      this.x = 10 + this.r;
      this.vx = Math.abs(this.vx);
      this.spawnBounceSparks();
    } else if (this.x + this.r > width - 10) {
      this.x = width - 10 - this.r;
      this.vx = -Math.abs(this.vx);
      this.spawnBounceSparks();
    }

    // Rebote superior
    if (this.y - this.r < 10) {
      this.y = 10 + this.r;
      this.vy = Math.abs(this.vy);
      this.spawnBounceSparks();
    }

    // SALIDA DEL CAMPO -> ONDA EXPANSIVA DE LUZ
    if (this.y > height + 20 && !this.isRespawning) {
      this.triggerFieldExitWave(this.x, height - 10);
      this.isRespawning = true;
      this.respawnTimer = 75;
    }
  }

  triggerFieldExitWave(exitX, exitY) {
    perturbationWaves.push(new PerturbationWave(exitX, exitY));
    audio.playWaveSigh();

    for (let i = 0; i < 20; i++) {
      particles.push(new StardustSpark(exitX, exitY, [220, 200, 255], 1.8));
    }
  }

  spawnBounceSparks() {
    for (let i = 0; i < 3; i++) {
      particles.push(new StardustSpark(this.x, this.y, [255, 250, 230], 0.7));
    }
  }

  checkPaddle(p) {
    if (this.isRespawning || appMode === "SETUP") return;
    if (
      this.y + this.r >= p.y &&
      this.y - this.r <= p.y + p.h &&
      this.x >= p.x - this.r &&
      this.x <= p.x + p.w + this.r &&
      this.vy > 0
    ) {
      const hitOffset = (this.x - (p.x + p.w / 2)) / (p.w / 2);
      this.vx = hitOffset * 4.2;
      this.vy = -Math.abs(this.vy);
      this.y = p.y - this.r;
      p.pulse = 1.0;
      this.spawnBounceSparks();
    }
  }

  checkBlocks(blockList) {
    if (this.isRespawning || appMode === "SETUP") return;
    for (let b of blockList) {
      if (
        this.x + this.r > b.x &&
        this.x - this.r < b.x + b.w &&
        this.y + this.r > b.y &&
        this.y - this.r < b.y + b.h
      ) {
        // LA PELOTA REINICIA 100% EL TIEMPO DEL BLOQUE (phase = 0)
        b.resetTiming();

        // Rebote elástico
        const prevX = this.x - this.vx * ballSpeedMult;
        const prevY = this.y - this.vy * ballSpeedMult;

        if (prevX + this.r <= b.x || prevX - this.r >= b.x + b.w) {
          this.vx *= -1;
          this.x = (this.vx > 0) ? b.x + b.w + this.r : b.x - this.r;
        } else {
          this.vy *= -1;
          this.y = (this.vy > 0) ? b.y + b.h + this.r : b.y - this.r;
        }
        break;
      }
    }
  }

  display() {
    if (this.isRespawning) return;

    noStroke();
    for (let i = 0; i < this.history.length; i++) {
      const h = this.history[i];
      const trailAlpha = h.life * 90;
      const trailSize = map(i, 0, this.history.length, 2, this.r * 1.5);
      fill(255, 240, 220, trailAlpha);
      circle(h.x, h.y, trailSize);
    }

    fill(255, 235, 200, 45);
    circle(this.x, this.y, this.r * 3.4);

    fill(255, 255, 250, 245);
    circle(this.x, this.y, this.r * 2);
  }
}

class LuminousPaddle {
  constructor() {
    this.reposition();
    this.pulse = 0;
  }

  reposition() {
    this.w = max(width * 0.13, 110);
    this.h = 10;
    this.x = width / 2 - this.w / 2;
    this.y = height - 55;
  }

  update() {
    const targetX = constrain(mouseX - this.w / 2, 20, width - this.w - 20);
    this.x += (targetX - this.x) * 0.22;
    this.pulse *= 0.90;
  }

  display() {
    push();
    translate(this.x, this.y);

    noStroke();
    fill(220, 200, 255, 30 + this.pulse * 70);
    rect(-6, -4, this.w + 12, this.h + 8, 8);

    fill(245, 240, 255, 180 + this.pulse * 75);
    rect(0, 0, this.w, this.h, 5);

    fill(255, 255, 255, 220);
    rect(this.w / 2 - 12, 2, 24, this.h - 4, 2);
    pop();
  }
}

// ============================================================================
// 9. ONDA EXPANSIVA DE PERTURBACIÓN LUMINOSA
// ============================================================================
class PerturbationWave {
  constructor(originX, originY) {
    this.originX = originX;
    this.originY = originY;
    this.radius = 0;
    this.speed = 8.5;
    this.maxRadius = max(width, height) * 1.3;
    this.isAlive = true;
    this.affectedBlocks = new Set();
  }

  update() {
    this.radius += this.speed;

    for (let i = 0; i < blocks.length; i++) {
      if (this.affectedBlocks.has(i)) continue;
      const b = blocks[i];
      const d = dist(this.originX, this.originY, b.centerX, b.centerY);

      if (Math.abs(d - this.radius) < this.speed * 1.2) {
        b.perturbByWave(d, 650);
        this.affectedBlocks.add(i);
      }
    }

    if (this.radius > this.maxRadius) {
      this.isAlive = false;
    }
  }

  display() {
    push();
    noFill();

    const progress = this.radius / this.maxRadius;
    const waveAlpha = (1.0 - progress) * 160;

    stroke(230, 210, 255, waveAlpha);
    strokeWeight(2.0);
    ellipse(this.originX, this.originY, this.radius * 2);

    if (this.radius > 30) {
      stroke(200, 230, 255, waveAlpha * 0.45);
      strokeWeight(4.5);
      ellipse(this.originX, this.originY, (this.radius - 20) * 2);
    }
    pop();
  }
}

function updateAndDrawWaves() {
  for (let i = perturbationWaves.length - 1; i >= 0; i--) {
    const w = perturbationWaves[i];
    w.update();
    w.display();
    if (!w.isAlive) {
      perturbationWaves.splice(i, 1);
    }
  }
}

// ============================================================================
// 10. PARTÍCULAS
// ============================================================================
class StardustSpark {
  constructor(x, y, rgb, speedMult = 1.0) {
    this.x = x;
    this.y = y;
    this.rgb = rgb;
    const angle = random(TWO_PI);
    const speed = random(0.6, 2.8) * speedMult;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed - 0.4;
    this.life = 255;
    this.decay = random(4.5, 8.5);
    this.size = random(2.0, 4.5);
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.vy += 0.02;
    this.life -= this.decay;
  }

  display() {
    noStroke();
    fill(this.rgb[0], this.rgb[1], this.rgb[2], this.life * 0.85);
    circle(this.x, this.y, this.size);
  }
}

function updateAndDrawParticles() {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.update();
    p.display();
    if (p.life <= 0) particles.splice(i, 1);
  }
}

// ============================================================================
// 11. AMBIENTE CÓSMICO
// ============================================================================
function drawCosmicBackground() {
  const ctx = drawingContext;
  const grad = ctx.createLinearGradient(0, 0, 0, height);
  grad.addColorStop(0, '#06040d');
  grad.addColorStop(0.5, '#0c081d');
  grad.addColorStop(1, '#160e28');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  const nebulaAlpha = map(R_global, 0, 1, 0.04, 0.12);
  const nebulaGrad = ctx.createRadialGradient(
    width / 2, height * 0.35, 10,
    width / 2, height * 0.35, width * 0.55
  );
  nebulaGrad.addColorStop(0, `rgba(180, 140, 240, ${nebulaAlpha})`);
  nebulaGrad.addColorStop(0.6, `rgba(100, 160, 230, ${nebulaAlpha * 0.5})`);
  nebulaGrad.addColorStop(1, 'rgba(10, 6, 20, 0)');
  ctx.fillStyle = nebulaGrad;
  ctx.fillRect(0, 0, width, height);
}

function drawStarfield() {
  noStroke();
  const globalPulse = (Math.sin(frameCount * 0.03) + 1) * 0.5;

  for (let s of stars) {
    s.phase += s.speed;
    const starTwinkle = (Math.sin(s.phase) + 1) * 0.5;
    const blendedTwinkle = lerp(starTwinkle, globalPulse, R_global * 0.65);
    const alpha = s.alphaBase * (0.3 + 0.7 * blendedTwinkle);

    fill(240, 235, 255, alpha);
    circle(s.x, s.y, s.size * (1 + 0.25 * blendedTwinkle));
  }
}

// ============================================================================
// 12. HUD ETÉREO
// ============================================================================
function drawEtherealHUD() {
  push();
  textAlign(CENTER, TOP);

  let stateTitle = "DESORDEN CONTEMPLATIVO";
  let stateColor = [255, 175, 190];

  if (R_global >= 0.88) {
    stateTitle = "RESPIRACIÓN COLECTIVA ESTABLE";
    stateColor = [255, 245, 190];
  } else if (R_global >= 0.68) {
    stateTitle = "ORGANIZACIÓN GLOBAL EMERGENTE";
    stateColor = [160, 240, 230];
  } else if (R_global >= 0.35) {
    stateTitle = "ORGANIZACIÓN DE FAMILIA";
    stateColor = [220, 195, 255];
  }

  noStroke();
  fill(255, 255, 255, 140);
  textFont("Outfit");
  textSize(11);
  text("CAJA DE MÚSICA ETÉREA · DINÁMICA DE KURAMOTO EN DOS NIVELES", width / 2, 16);

  fill(stateColor[0], stateColor[1], stateColor[2], 230);
  textFont("Cormorant Garamond");
  textSize(21);
  text(stateTitle, width / 2, 34);

  const barW = min(width * 0.28, 260);
  const barH = 3.5;
  const barX = width / 2 - barW / 2;
  const barY = 64;

  fill(255, 255, 255, 25);
  rect(barX, barY, barW, barH, 2);

  fill(stateColor[0], stateColor[1], stateColor[2], 220);
  rect(barX, barY, barW * R_global, barH, 2);

  textFont("Outfit");
  textSize(9);
  fill(255, 255, 255, 120);
  text(`R = ${R_global.toFixed(3)}`, width / 2, barY + 8);

  // Indicadores por familia
  const famBadgeW = 86;
  const famSpacing = 10;
  const totalFamW = 4 * famBadgeW + 3 * famSpacing;
  const startFamX = width / 2 - totalFamW / 2;
  const famY = barY + 28;

  for (let i = 0; i < 4; i++) {
    const fam = FAMILIES[i];
    const fx = startFamX + i * (famBadgeW + famSpacing);
    const Rf = R_families[i];

    stroke(fam.rgb[0], fam.rgb[1], fam.rgb[2], 55);
    strokeWeight(1);
    fill(fam.rgb[0], fam.rgb[1], fam.rgb[2], 12);
    rect(fx, famY, famBadgeW, 20, 10);

    noStroke();
    fill(fam.rgb[0], fam.rgb[1], fam.rgb[2], 140);
    rect(fx + 6, famY + 16, (famBadgeW - 12) * Rf, 2, 1);

    textAlign(LEFT, CENTER);
    textFont("Outfit");
    textSize(9.5);
    fill(fam.rgb[0], fam.rgb[1], fam.rgb[2], 220);
    text(fam.name, fx + 8, famY + 8);

    textAlign(RIGHT, CENTER);
    fill(255, 255, 255, 160);
    text(Rf.toFixed(2), fx + famBadgeW - 8, famY + 8);
  }

  pop();
}

// ============================================================================
// 13. INTERACCIÓN Y EVENTOS
// ============================================================================
document.addEventListener("contextmenu", (e) => {
  if (e.target.tagName === "CANVAS") e.preventDefault();
});

function mousePressed(event) {
  audio.init();

  const isRightClick = (mouseButton === RIGHT) || (event && event.button === 2);
  const isShift = keyIsDown(SHIFT);

  // 1. Clic sobre un bloque existente
  const hitIndex = blocks.findIndex(b =>
    mouseX >= b.x && mouseX <= b.x + b.w &&
    mouseY >= b.y && mouseY <= b.y + b.h
  );

  if (hitIndex !== -1) {
    const b = blocks[hitIndex];

    // Cambiar familia (lo que al usuario le gusta conservar)
    if (isRightClick || isShift) {
      b.familyId = (b.familyId + 1) % 4;
      b.family = FAMILIES[b.familyId];
      b.naturalFreq = b.family.baseOmega + (random(-1, 1) + random(-1, 1)) * 0.5 * freqSpread;
      b.triggerPluck(true);
      return false;
    }

    if (appMode === "SETUP") {
      // En modo diseño:
      if (b.familyId === selectedPaintFamily) {
        // Mismo color -> quitar bloque
        blocks.splice(hitIndex, 1);
      } else {
        // Distinto color -> asignar familia activa
        b.familyId = selectedPaintFamily;
        b.family = FAMILIES[selectedPaintFamily];
        b.naturalFreq = b.family.baseOmega + (random(-1, 1) + random(-1, 1)) * 0.5 * freqSpread;
        b.triggerPluck(true);
      }
      return false;
    } else {
      // En modo tocar: golpear y resetear tiempo
      b.resetTiming();
      return false;
    }
  }

  // 2. Clic en una casilla vacía de la cuadrícula
  if (
    mouseX >= FIELD_LEFT && mouseX <= FIELD_LEFT + FIELD_WIDTH &&
    mouseY >= FIELD_TOP && mouseY <= FIELD_TOP + FIELD_HEIGHT
  ) {
    const col = Math.floor((mouseX - FIELD_LEFT) / (BLOCK_W + GAP_X));
    const row = Math.floor((mouseY - FIELD_TOP) / (BLOCK_H + GAP_Y));

    if (col >= 0 && col < COLUMNS && row >= 0 && row < ROWS) {
      const noteIdx = (row * 3 + col) % HARP_SCALE.length;
      const freq = HARP_SCALE[noteIdx];
      const newBlock = new KuramotoBlock(col, row, selectedPaintFamily, freq);
      newBlock.phase = random(TWO_PI);
      newBlock.triggerPluck(true);
      blocks.push(newBlock);
      return false;
    }
  }

  // 3. Clic en espacio libre fuera de la cuadrícula
  if (mouseY < height - 70) {
    perturbationWaves.push(new PerturbationWave(mouseX, mouseY));
    audio.playWaveSigh();
    for (let i = 0; i < 16; i++) {
      particles.push(new StardustSpark(mouseX, mouseY, [220, 200, 255], 1.4));
    }
  }
}

function handleContinuousKeys() {
  if (keyIsDown(UP_ARROW)) {
    K_global = min(K_global + 0.010, 2.0);
    updateDomSlider("slider-k", "val-k", K_global);
  }
  if (keyIsDown(DOWN_ARROW)) {
    K_global = max(K_global - 0.010, 0.0);
    updateDomSlider("slider-k", "val-k", K_global);
  }
  if (keyIsDown(RIGHT_ARROW)) {
    freqSpread = min(freqSpread + 0.0002, 0.020);
    updateDomSlider("slider-spread", "val-spread", freqSpread, 3);
  }
  if (keyIsDown(LEFT_ARROW)) {
    freqSpread = max(freqSpread - 0.0002, 0.001);
    updateDomSlider("slider-spread", "val-spread", freqSpread, 3);
  }
}

function keyPressed() {
  audio.init();

  // Teclas 1 a 4 para cambiar la familia activa de colocación
  if (key >= '1' && key <= '4') {
    selectPaintFamily(int(key) - 1);
  }

  // Espacio: alternar entre modo Diseño y modo Tocar (o relanzar pelota)
  if (key === ' ') {
    if (appMode === "SETUP") {
      setAppMode("PLAY");
    } else {
      ball.reset();
    }
  }

  // Tecla E o Tab: alternar modo
  if (key === 'e' || key === 'E') {
    setAppMode(appMode === "SETUP" ? "PLAY" : "SETUP");
  }

  // W: onda expansiva manual
  if (key === 'w' || key === 'W') {
    triggerManualWave();
  }

  // C: sembrar caos / aleatorizar fases con dispersión áurea
  if (key === 'c' || key === 'C') {
    randomizePhases();
  }
}

// ============================================================================
// 14. FUNCIONES EXPUESTAS AL DOM
// ============================================================================
function setAppMode(mode) {
  appMode = mode;
  const btnSetup = document.getElementById("btn-mode-setup");
  const btnPlay = document.getElementById("btn-mode-play");

  if (btnSetup && btnPlay) {
    if (mode === "SETUP") {
      btnSetup.classList.add("active");
      btnPlay.classList.remove("active");
    } else {
      btnPlay.classList.add("active");
      btnSetup.classList.remove("active");
      ball.reset();
    }
  }
}

function selectPaintFamily(idx) {
  selectedPaintFamily = constrain(idx, 0, 3);
  for (let i = 0; i < 4; i++) {
    const el = document.getElementById(`pal-${i}`);
    if (el) {
      if (i === selectedPaintFamily) el.classList.add("active");
      else el.classList.remove("active");
    }
  }
}

function loadDefaultConstellation() {
  buildInitialConstellation();
}

function clearAllBlocks() {
  blocks = [];
}

function startAudioExperience() {
  audio.init();
}

function triggerManualWave() {
  audio.init();
  perturbationWaves.push(new PerturbationWave(width / 2, height - 60));
  audio.playWaveSigh();
}

// Dispersión uniforme garantizada por proporción áurea (nunca arrancan demasiado sincronizados)
function randomizePhases() {
  const phi = 0.618033988749895;
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    b.phase = ((i * phi + Math.random() * 0.15) % 1.0) * TWO_PI;
    b.naturalFreq = b.family.baseOmega + (random(-1, 1) + random(-1, 1)) * 0.5 * freqSpread;
  }
}

function setGridSize(newCols, newRows) {
  COLUMNS = constrain(newCols, 6, 22);
  ROWS = constrain(newRows, 3, 10);

  updateDomSlider("slider-cols", "val-cols", COLUMNS, 0);
  updateDomSlider("slider-rows", "val-rows", ROWS, 0);
  const badge = document.getElementById("val-grid");
  if (badge) badge.innerText = `${COLUMNS} × ${ROWS}`;

  document.querySelectorAll(".preset-pill").forEach(el => el.classList.remove("active"));
  const presetBtn = document.getElementById(`preset-${COLUMNS}-${ROWS}`);
  if (presetBtn) presetBtn.classList.add("active");

  computeFieldDimensions();

  // Filtrar bloques que queden fuera de las nuevas dimensiones y reposicionar los restantes
  blocks = blocks.filter(b => b.col < COLUMNS && b.row < ROWS);
  for (let b of blocks) {
    b.recalculatePosition();
  }
}

function fillAllGridBlocks() {
  blocks = [];
  const colBlock = Math.max(1, Math.floor(COLUMNS / 4));
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLUMNS; c++) {
      const familyId = (r + Math.floor(c / colBlock)) % 4;
      const noteIdx = (r * 3 + c) % HARP_SCALE.length;
      const freq = HARP_SCALE[noteIdx];
      blocks.push(new KuramotoBlock(c, r, familyId, freq));
    }
  }
  randomizePhases();
}

function toggleControlPanel() {
  const panel = document.getElementById("control-panel");
  if (panel) panel.classList.toggle("collapsed");
}

function bindDomControls() {
  const sK = document.getElementById("slider-k");
  const sInter = document.getElementById("slider-inter");
  const sSpread = document.getElementById("slider-spread");
  const sSpeed = document.getElementById("slider-speed");
  const sCols = document.getElementById("slider-cols");
  const sRows = document.getElementById("slider-rows");

  if (sK) {
    sK.addEventListener("input", (e) => {
      K_global = parseFloat(e.target.value);
      document.getElementById("val-k").innerText = K_global.toFixed(2);
    });
  }

  if (sInter) {
    sInter.addEventListener("input", (e) => {
      K_inter = parseFloat(e.target.value);
      document.getElementById("val-inter").innerText = K_inter.toFixed(2);
    });
  }

  if (sSpread) {
    sSpread.addEventListener("input", (e) => {
      freqSpread = parseFloat(e.target.value);
      document.getElementById("val-spread").innerText = freqSpread.toFixed(3);
      for (let b of blocks) {
        b.naturalFreq = b.family.baseOmega + (random(-1, 1) + random(-1, 1)) * 0.5 * freqSpread;
      }
    });
  }

  if (sSpeed) {
    sSpeed.addEventListener("input", (e) => {
      ballSpeedMult = parseFloat(e.target.value);
      document.getElementById("val-speed").innerText = `${ballSpeedMult.toFixed(1)}x`;
    });
  }

  if (sCols) {
    sCols.addEventListener("input", (e) => {
      setGridSize(parseInt(e.target.value), ROWS);
    });
  }

  if (sRows) {
    sRows.addEventListener("input", (e) => {
      setGridSize(COLUMNS, parseInt(e.target.value));
    });
  }
}

function updateDomSlider(sliderId, badgeId, val, decimals = 2) {
  const sl = document.getElementById(sliderId);
  const bd = document.getElementById(badgeId);
  if (sl) sl.value = val;
  if (bd) bd.innerText = val.toFixed(decimals);
}
