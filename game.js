/* CONNECTME_SPEED_SYSTEM */
function connectMeUpdatePlayerSpeed(dt) {
  if (typeof player !== "undefined" && player) {
    player.speed = typeof speed !== "undefined" ? speed : 2.0;
    player.moveSpeed = 100;
  }
}

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const startScreen = document.getElementById("startScreen");
const gameUI = document.getElementById("gameUI");
const pauseScreen = document.getElementById("pauseScreen");
const gameOverScreen = document.getElementById("gameOverScreen");
const mobileControls = document.getElementById("mobileControls");

const scoreEl = document.getElementById("score");
const speedEl = document.getElementById("speed");
const shieldCountEl = document.getElementById("shieldCount");
const finalScoreEl = document.getElementById("finalScore");
const finalDistanceEl = document.getElementById("finalDistance");
const eventText = document.getElementById("eventText");
const previewCar = document.getElementById("previewCar");
const biomeSelect = document.getElementById("biomeSelect");
const difficultySelect = document.getElementById("difficultySelect");
const difficultyHud = document.getElementById("difficultyHud");

let W = innerWidth, H = innerHeight, dpr = 1;
function resize() {
  dpr = Math.min(devicePixelRatio || 1, 2);
  W = innerWidth; H = innerHeight;
  canvas.width = W * dpr; canvas.height = H * dpr;
  canvas.style.width = W + "px"; canvas.style.height = H + "px";
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
addEventListener("resize", resize); resize();

const carColors = ["#e53935", "#1e88e5", "#f9a825", "#43a047", "#8e44ad", "#eceff1", "#111111", "#ff9800", "#9c27b0", "#00bcd4"];
let selectedColor = carColors[0];
const colorPicker = document.getElementById("colorPicker");
if (colorPicker) {
  colorPicker.innerHTML = "";
  carColors.slice(0, 7).forEach((c, i) => {
    const b = document.createElement("button");
    b.className = "color-btn" + (i === 0 ? " selected" : "");
    b.style.background = c;
    b.addEventListener("click", () => {
      selectedColor = c;
      document.querySelectorAll(".color-btn").forEach(x => x.classList.remove("selected"));
      b.classList.add("selected");
      if (previewCar) previewCar.style.background = c;
    });
    colorPicker.appendChild(b);
  });
}

let state = "menu";
let trophies = 0, distance = 0, speed = 2.0, baseSpeed = 2.0, shield = 0;
let shieldTimer = 0;
let speedBoostTimer = 0;
const SHIELD_DURATION = 8;
const SPEED_BOOST_DURATION = 3;
const SPEED_BOOST_AMOUNT = 3;
let carsPassed = 0; 
let player = { lane: -0.5, x: 0, targetLane: -0.5, y: 0, w: 54, h: 92 };
let traffic = [], powerups = [];
let roadOffset = 0, spawnTimer = 0, powerTimer = 0, envTimer = 0;
let environment = "grass";
let timeOfDay = "day";

// إعدادات أطوار القمر وتكبير مدة التبديل بين البيئات
let currentMoonPhase = 0; 
const moonNames = ["محاق", "هلال متزايد", "تربيع أول", "أحدب متزايد", "بدر", "أحدب متناقص", "تربيع ثاني", "هلال متناقص"];
let dayNightTimer = 15; 
let biomeChangeTimer = 75; // تم تكبير المدة الابتدائية للبيئة (75 ثانية)

const timeSelect = document.getElementById("timeSelect");
let paused = false, lastTime = 0, shake = 0;
let difficulty = "normal";
const difficultySettings = {
  easy:   { label: " : سهل", maxSpeed: 8.0, acceleration: 0.13, spawnBase: 1.35, spawnMin: 0.72, trafficSpeed: 0.95 },
  normal: { label: "  : عادي", maxSpeed: 10.0, acceleration: 0.18, spawnBase: 1.05, spawnMin: 0.48, trafficSpeed: 1.15 },
  hard:   { label: " : صعب", maxSpeed: 12.5, acceleration: 0.24, spawnBase: 0.82, spawnMin: 0.34, trafficSpeed: 1.38 },
  peaceful: { label: ": السلام التام", maxSpeed: 8.0, acceleration: 0.13, spawnBase: Infinity, spawnMin: Infinity, trafficSpeed: 0 }
};

const environments = [
  { id: "grass", name: "أرض خضراء" },
  { id: "desert", name: "صحراء" },
  { id: "city", name: "مدينة" },
  { id: "winter", name: "شتاء جليد" }
];

function laneX(lane, y) {
  const roadTop = W * 0.35, roadBottom = W * 0.88;
  const t = Math.max(0, Math.min(1, (y - H * 0.34) / (H * 0.66)));
  const roadW = roadTop + (roadBottom - roadTop) * t;
  return (W / 2) + lane * (roadW * 0.25);
}

function getPerspectiveScale(y) {
  const topY = H * 0.34;
  const t = Math.min(1, Math.max(0, (y - topY) / (H * 0.18)));
  return 0.45 + t * 0.55; 
}

function resetGame() {
  state = "playing"; paused = false; trophies = 0; distance = 0; speed = 2.0; baseSpeed = 2.0; shield = 0;
  shieldTimer = 0; speedBoostTimer = 0; carsPassed = 0; 
  traffic = []; powerups = []; roadOffset = 0; spawnTimer = .7; powerTimer = 3; envTimer = 0;
  
  environment = (biomeSelect && biomeSelect.value) ? biomeSelect.value : "grass";
  timeOfDay = (timeSelect && timeSelect.value) ? timeSelect.value : "day";
  
  currentMoonPhase = 0;
  dayNightTimer = 18 + Math.random() * 6;
  
  // تكبير مدة التغيير: بين 60 إلى 90 ثانية عند بداية اللعب
  biomeChangeTimer = 60 + Math.random() * 30;

  difficulty = (difficultySelect && difficultySelect.value) ? difficultySelect.value : "normal";
  if (difficultyHud) difficultyHud.textContent = difficultySettings[difficulty].label;
  player.targetLane = -0.5; player.lane = -0.5; player.y = H * .80; player.x = laneX(-0.5, player.y);
  if (startScreen) startScreen.classList.add("hidden");
  if (gameOverScreen) gameOverScreen.classList.add("hidden");
  if (pauseScreen) pauseScreen.classList.add("hidden");
  if (gameUI) gameUI.classList.remove("hidden");
  if (mobileControls) mobileControls.classList.remove("hidden");
  updateHUD();
}

function updateHUD() {
  if (scoreEl) scoreEl.textContent = trophies + " 🏆";
  if (speedEl) speedEl.textContent = Math.floor(speed);
  if (shieldCountEl) {
    shieldCountEl.textContent = shield > 0 ? Math.ceil(shieldTimer) + "s" : "0";
  }
  if (difficultyHud && difficultySettings[difficulty]) difficultyHud.textContent = difficultySettings[difficulty].label;
}

function showEvent(text) {
  if (!eventText) return;
  eventText.textContent = text; eventText.style.opacity = "1";
  clearTimeout(showEvent.t); showEvent.t = setTimeout(() => eventText.style.opacity = "0", 1400);
}

function start() {
  resetGame(); lastTime = performance.now();
}
if (document.getElementById("startBtn")) document.getElementById("startBtn").onclick = start;
if (document.getElementById("retryBtn")) document.getElementById("retryBtn").onclick = start;
if (document.getElementById("restartBtn")) document.getElementById("restartBtn").onclick = start;

function goMenu() {
  state = "menu"; paused = false;
  if (gameUI) gameUI.classList.add("hidden");
  if (pauseScreen) pauseScreen.classList.add("hidden");
  if (gameOverScreen) gameOverScreen.classList.add("hidden");
  if (mobileControls) mobileControls.classList.add("hidden");
  if (startScreen) startScreen.classList.remove("hidden");
}
if (document.getElementById("menuBtn")) document.getElementById("menuBtn").onclick = goMenu;
if (document.getElementById("overMenuBtn")) document.getElementById("overMenuBtn").onclick = goMenu;

function togglePause() {
  if (state !== "playing") return;
  paused = !paused;
  if (pauseScreen) pauseScreen.classList.toggle("hidden", !paused);
}
if (document.getElementById("pauseBtn")) document.getElementById("pauseBtn").onclick = togglePause;
if (document.getElementById("resumeBtn")) document.getElementById("resumeBtn").onclick = togglePause;

function move(dir) {
  if (state !== "playing" || paused) return;
  player.targetLane = Math.max(-1.5, Math.min(1.5, player.targetLane + dir));
}

addEventListener("keydown", e => {
  if (e.key === "ArrowLeft" || e.key.toLowerCase() === "a") move(-1);
  if (e.key === "ArrowRight" || e.key.toLowerCase() === "d") move(1);
  if (e.key.toLowerCase() === "p" || e.key === "Escape") togglePause();
});

function setupTouchButton(buttonId, dir) {
  const btn = document.getElementById(buttonId);
  if (!btn) return;
  const handleTouch = (e) => {
    e.preventDefault();
    move(dir);
  };
  btn.addEventListener("pointerdown", handleTouch);
}

setupTouchButton("leftBtn", -1);
setupTouchButton("rightBtn", 1);

function spawnTraffic() {
  const types = ["small", "truck", "normal"];
  const type = types[Math.floor(Math.random() * types.length)];
  const lane = [-1.5, -0.5, 0.5, 1.5][Math.floor(Math.random() * 4)];
  const color = carColors[Math.floor(Math.random() * carColors.length)];
  const ds = difficultySettings[difficulty];
  traffic.push({ type, lane, y: H * 0.34, speed: ds.trafficSpeed + Math.random() * 0.42, color: color });
}

function spawnPowerup() {
  const type = Math.random() < .55 ? "speed" : "shield";
  const lane = [-1.5, -0.5, 0.5, 1.5][Math.floor(Math.random() * 4)];
  powerups.push({ type, lane, y: H * 0.34, rot: 0 });
}

function carSize(type) {
  if (type === "truck") return { w: 72, h: 125 };
  if (type === "small") return { w: 50, h: 82 };
  return { w: 58, h: 96 };
}

function roundedRect(x, y, w, h, r, fill, stroke) {
  ctx.beginPath(); ctx.roundRect(x, y, w, h, r);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.stroke(); }
}

function drawWheel(x, y, w, h, isChrome = true) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = "#11161b";
  ctx.beginPath(); ctx.roundRect(-w/2, -h/2, w, h, 3); ctx.fill();
  ctx.strokeStyle = "#283038"; ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-w/2, -h/4); ctx.lineTo(w/2, -h/4);
  ctx.moveTo(-w/2, 0); ctx.lineTo(w/2, 0);
  ctx.moveTo(-w/2, h/4); ctx.lineTo(w/2, h/4);
  ctx.stroke();
  ctx.fillStyle = isChrome ? "#d4e1ec" : "#45505b";
  ctx.beginPath(); ctx.arc(0, 0, Math.min(w, h) * 0.32, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function drawCar(x, y, w, h, color, type = "normal", isPlayer = false, scale = 1.0) {
  ctx.save(); 
  ctx.translate(x, y);
  ctx.scale(scale, scale);

  if (!isPlayer) {
    ctx.rotate(Math.PI);
  }

  ctx.fillStyle = "rgba(0, 0, 0, 0.38)";
  ctx.beginPath(); ctx.ellipse(0, h * 0.05, w * 0.55, h * 0.52, 0, 0, Math.PI * 2); ctx.fill();

  if (type === "truck") {
    const cabW = w * 0.92, cabH = h * 0.32;
    const trailerW = w * 0.98, trailerH = h * 0.62;
    const cabY = -h * 0.33, trailerY = h * 0.16;

    drawWheel(-cabW * 0.48, cabY - cabH * 0.25, 7, 18, true);
    drawWheel(cabW * 0.48, cabY - cabH * 0.25, 7, 18, true);
    drawWheel(-trailerW * 0.49, trailerY + trailerH * 0.15, 8, 20, false);
    drawWheel(-trailerW * 0.49, trailerY + trailerH * 0.35, 8, 20, false);
    drawWheel(trailerW * 0.49, trailerY + trailerH * 0.15, 8, 20, false);
    drawWheel(trailerW * 0.49, trailerY + trailerH * 0.35, 8, 20, false);

    roundedRect(-trailerW / 2, trailerY - trailerH / 2, trailerW, trailerH, 6, "#d8e2eb", "#3a4754");
    ctx.strokeStyle = "rgba(0,0,0,0.12)"; ctx.lineWidth = 2;
    for (let px = -trailerW * 0.38; px <= trailerW * 0.38; px += 8) {
      ctx.beginPath(); ctx.moveTo(px, trailerY - trailerH * 0.45); ctx.lineTo(px, trailerY + trailerH * 0.45); ctx.stroke();
    }
    ctx.fillStyle = "#c0cbd6"; ctx.fillRect(-trailerW * 0.4, trailerY - trailerH * 0.42, trailerW * 0.8, 10);
    ctx.fillStyle = "#222a33"; ctx.fillRect(-trailerW * 0.45, trailerY + trailerH * 0.46, trailerW * 0.9, 5);
    ctx.fillStyle = "#e63946"; ctx.fillRect(-trailerW * 0.4, trailerY + trailerH * 0.45, 12, 3); ctx.fillRect(trailerW * 0.4 - 12, trailerY + trailerH * 0.45, 12, 3);

    ctx.fillStyle = "#1b222a"; ctx.fillRect(-10, cabY + cabH * 0.3, 20, 15);
    roundedRect(-cabW / 2, cabY - cabH / 2, cabW, cabH, 8, color, "#182026");

    ctx.fillStyle = "#202830"; roundedRect(-cabW * 0.38, cabY - cabH * 0.5, cabW * 0.76, 8, 2, "#111", "#888");
    ctx.fillStyle = "#d8e2eb"; ctx.fillRect(-cabW * 0.3, cabY - cabH * 0.49, cabW * 0.6, 4);

    let grad = ctx.createLinearGradient(0, cabY - cabH * 0.25, 0, cabY + cabH * 0.1);
    grad.addColorStop(0, "rgba(225,245,255,0.9)"); grad.addColorStop(1, "rgba(35,80,110,0.9)");
    ctx.fillStyle = grad; roundedRect(-cabW * 0.38, cabY - cabH * 0.25, cabW * 0.76, cabH * 0.35, 4);

    ctx.fillStyle = "#151e24"; ctx.fillRect(-cabW * 0.58, cabY - cabH * 0.2, 7, 12); ctx.fillRect(cabW * 0.58 - 7, cabY - cabH * 0.2, 7, 12);

    ctx.fillStyle = "#ff9800";
    for (let lx = -14; lx <= 14; lx += 7) {
      ctx.beginPath(); ctx.arc(lx, cabY - cabH * 0.4, 2, 0, Math.PI * 2); ctx.fill();
    }

    ctx.fillStyle = "#fffbe0"; ctx.shadowBlur = 10; ctx.shadowColor = "#fffbe0";
    ctx.fillRect(-cabW * 0.42, cabY - cabH * 0.48, 10, 5); ctx.fillRect(cabW * 0.42 - 10, cabY - cabH * 0.48, 10, 5);
    ctx.shadowBlur = 0;

  } else if (type === "small") {
    drawWheel(-w * 0.48, -h * 0.28, 7, 18, true);
    drawWheel(w * 0.48, -h * 0.28, 7, 18, true);
    drawWheel(-w * 0.48, h * 0.28, 7, 18, true);
    drawWheel(w * 0.48, h * 0.28, 7, 18, true);

    roundedRect(-w / 2, -h / 2, w, h, 14, color, "#12181f");

    ctx.fillStyle = "rgba(255,255,255,0.25)";
    ctx.fillRect(-w * 0.1, -h * 0.45, w * 0.08, h * 0.88); ctx.fillRect(0, -h * 0.45, w * 0.08, h * 0.88);

    ctx.fillStyle = "#11171d"; ctx.beginPath(); ctx.arc(0, -h * 0.42, w * 0.3, Math.PI, 0); ctx.fill();

    let wsGrad = ctx.createLinearGradient(0, -h * 0.25, 0, h * 0.1);
    wsGrad.addColorStop(0, "#cbe8fc"); wsGrad.addColorStop(0.5, "#306285"); wsGrad.addColorStop(1, "#122533");
    ctx.fillStyle = wsGrad; ctx.beginPath(); ctx.roundRect(-w * 0.36, -h * 0.25, w * 0.72, h * 0.32, [10, 10, 4, 4]); ctx.fill();

    ctx.fillStyle = color; ctx.fillRect(-w * 0.56, -h * 0.15, 6, 10); ctx.fillRect(w * 0.56 - 6, -h * 0.15, 6, 10);

    ctx.fillStyle = "#12202c"; ctx.beginPath(); ctx.roundRect(-w * 0.3, h * 0.08, w * 0.6, h * 0.2, 4); ctx.fill();

    ctx.fillStyle = "#111820"; ctx.fillRect(-w * 0.46, h * 0.38, w * 0.92, 8);
    ctx.fillStyle = color; ctx.fillRect(-w * 0.48, h * 0.36, 6, 12); ctx.fillRect(w * 0.48 - 6, h * 0.36, 6, 12);

    ctx.fillStyle = "#ffffff"; ctx.shadowBlur = 12; ctx.shadowColor = "#00e5ff";
    ctx.beginPath(); ctx.roundRect(-w * 0.4, -h * 0.46, 12, 5, 2); ctx.roundRect(w * 0.4 - 12, -h * 0.46, 12, 5, 2); ctx.fill();
    ctx.shadowBlur = 0;

    ctx.fillStyle = "#ff1744"; ctx.shadowBlur = 8; ctx.shadowColor = "#ff1744";
    ctx.fillRect(-w * 0.4, h * 0.44, w * 0.8, 4); ctx.shadowBlur = 0;

  } else {
    drawWheel(-w * 0.48, -h * 0.28, 7, 18, true);
    drawWheel(w * 0.48, -h * 0.28, 7, 18, true);
    drawWheel(-w * 0.48, h * 0.28, 7, 18, true);
    drawWheel(w * 0.48, h * 0.28, 7, 18, true);

    roundedRect(-w / 2, -h / 2, w, h, 12, color, "#161c22");

    ctx.strokeStyle = "rgba(255,255,255,0.2)"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-w * 0.3, -h * 0.42); ctx.lineTo(-w * 0.25, -h * 0.25);
    ctx.moveTo(w * 0.3, -h * 0.42); ctx.lineTo(w * 0.25, -h * 0.25); ctx.stroke();

    ctx.fillStyle = "#1e262e"; ctx.fillRect(-w * 0.25, -h * 0.48, w * 0.5, 6);
    ctx.strokeStyle = "#8899a6"; ctx.lineWidth = 1; ctx.strokeRect(-w * 0.25, -h * 0.48, w * 0.5, 6);

    let wsGrad = ctx.createLinearGradient(0, -h * 0.28, 0, -h * 0.02);
    wsGrad.addColorStop(0, "#b3e5fc"); wsGrad.addColorStop(0.6, "#295270"); wsGrad.addColorStop(1, "#132330");
    ctx.fillStyle = wsGrad; ctx.beginPath(); ctx.roundRect(-w * 0.36, -h * 0.28, w * 0.72, h * 0.26, [8, 8, 3, 3]); ctx.fill();

    ctx.fillStyle = color; ctx.fillRect(-w * 0.56, -h * 0.18, 6, 10); ctx.fillRect(w * 0.56 - 6, -h * 0.18, 6, 10);

    ctx.fillStyle = color; ctx.fillRect(-w * 0.32, -h * 0.02, w * 0.64, h * 0.22);

    ctx.fillStyle = "#132330"; ctx.beginPath(); ctx.roundRect(-w * 0.34, h * 0.2, w * 0.68, h * 0.16, [3, 3, 6, 6]); ctx.fill();

    ctx.fillStyle = "#fffbe0"; ctx.shadowBlur = 10; ctx.shadowColor = "#ffeb3b";
    ctx.beginPath(); ctx.roundRect(-w * 0.42, -h * 0.47, 11, 6, 2); ctx.roundRect(w * 0.42 - 11, -h * 0.47, 11, 6, 2); ctx.fill();
    ctx.shadowBlur = 0;

    ctx.fillStyle = "#f44336"; ctx.shadowBlur = 8; ctx.shadowColor = "#f44336";
    ctx.fillRect(-w * 0.42, h * 0.44, 12, 4); ctx.fillRect(w * 0.42 - 12, h * 0.44, 12, 4); ctx.shadowBlur = 0;
  }

  if (isPlayer && shield > 0) {
    ctx.strokeStyle = "rgba(0, 229, 255, 0.85)"; ctx.lineWidth = 5;
    ctx.shadowBlur = 15; ctx.shadowColor = "#00e5ff";
    ctx.beginPath(); ctx.arc(0, 0, Math.max(w, h) * 0.65, 0, Math.PI * 2); ctx.stroke();
    ctx.shadowBlur = 0;
  }

  ctx.restore();
}

function drawRoadSurface() {
  const topW = W * .35, botW = W * .88, topY = H * .34;
  ctx.fillStyle = "#343a40";
  ctx.beginPath(); ctx.moveTo(W / 2 - topW / 2, topY); ctx.lineTo(W / 2 + topW / 2, topY); ctx.lineTo(W / 2 + botW / 2, H); ctx.lineTo(W / 2 - botW / 2, H); ctx.closePath(); ctx.fill();

  ctx.fillStyle = "#d7d7d7";
  ctx.beginPath(); ctx.moveTo(W / 2 - topW / 2, topY); ctx.lineTo(W / 2 - topW / 2 + 7, topY); ctx.lineTo(W / 2 - botW / 2 + 10, H); ctx.lineTo(W / 2 - botW / 2, H); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(W / 2 + topW / 2 - 7, topY); ctx.lineTo(W / 2 + topW / 2, topY); ctx.lineTo(W / 2 + botW / 2, H); ctx.lineTo(W / 2 + botW / 2 - 10, H); ctx.closePath(); ctx.fill();

  ctx.strokeStyle = "#f4f4f4"; ctx.lineWidth = 5; ctx.setLineDash([28, 28]); ctx.lineDashOffset = -roadOffset;
  ctx.beginPath();
  ctx.moveTo(W / 2, topY); ctx.lineTo(W / 2, H);
  ctx.moveTo(W / 2 - topW / 4, topY); ctx.lineTo(W / 2 - botW / 4, H);
  ctx.moveTo(W / 2 + topW / 4, topY); ctx.lineTo(W / 2 + botW / 4, H);
  ctx.stroke(); ctx.setLineDash([]);
}

function drawTree(x, y, scale) {
  ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale);
  ctx.fillStyle = "#5d4037"; ctx.fillRect(-5, 0, 10, 25);
  ctx.fillStyle = "#2e7d32"; ctx.beginPath(); ctx.arc(0, -10, 22, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#388e3c"; ctx.beginPath(); ctx.arc(-8, -18, 16, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(8, -18, 16, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function drawCactus(x, y, scale) {
  ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale);
  ctx.fillStyle = "#2e7d32";
  ctx.beginPath(); ctx.roundRect(-6, -30, 12, 35, 6); ctx.fill();
  ctx.fillRect(-16, -18, 10, 5); ctx.fillRect(-16, -26, 5, 12);
  ctx.fillRect(6, -12, 10, 5); ctx.fillRect(11, -20, 5, 12);
  ctx.restore();
}

function drawLampPost(x, y, scale, isNight) {
  ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale);
  ctx.fillStyle = "#37474f"; ctx.fillRect(-3, -40, 6, 45);
  ctx.fillRect(-10, -43, 20, 5);
  ctx.fillStyle = isNight ? "#fff59d" : "#cfd8dc";
  ctx.beginPath(); ctx.arc(0, -38, 5, 0, Math.PI * 2); ctx.fill();
  if (isNight) {
    ctx.fillStyle = "rgba(255, 245, 157, 0.18)";
    ctx.beginPath(); ctx.moveTo(0, -38); ctx.lineTo(-25, 10); ctx.lineTo(25, 10); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}

function drawPineTree(x, y, scale) {
  ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale);
  ctx.fillStyle = "#4e342e"; ctx.fillRect(-4, 0, 8, 20);
  ctx.fillStyle = "#1b5e20";
  ctx.beginPath(); ctx.moveTo(0, -35); ctx.lineTo(-18, -15); ctx.lineTo(18, -15); ctx.fill();
  ctx.beginPath(); ctx.moveTo(0, -25); ctx.lineTo(-22, -2); ctx.lineTo(22, -2); ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.beginPath(); ctx.moveTo(0, -35); ctx.lineTo(-8, -26); ctx.lineTo(8, -26); ctx.fill();
  ctx.restore();
}

function drawMoon(cx, cy, r, phase) {
  ctx.save();
  ctx.translate(cx, cy);

  ctx.fillStyle = "rgba(255, 255, 255, 0.15)";
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#fffde7";
  ctx.shadowColor = "#fffde7";
  ctx.shadowBlur = phase === 0 ? 0 : 12;

  if (phase === 4) { // بدر
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
  } else if (phase === 0) { // محاق
    ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.stroke();
  } else if (phase === 2) { // تربيع أول
    ctx.beginPath();
    ctx.arc(0, 0, r, -Math.PI / 2, Math.PI / 2);
    ctx.closePath();
    ctx.fill();
  } else if (phase === 6) { // تربيع ثاني
    ctx.beginPath();
    ctx.arc(0, 0, r, Math.PI / 2, 3 * Math.PI / 2);
    ctx.closePath();
    ctx.fill();
  } else if (phase === 1) { // هلال متزايد
    ctx.beginPath();
    ctx.arc(0, 0, r, -Math.PI / 2, Math.PI / 2);
    ctx.ellipse(0, 0, r * 0.5, r, 0, Math.PI / 2, -Math.PI / 2, true);
    ctx.fill();
  } else if (phase === 3) { // أحدب متزايد
    ctx.beginPath();
    ctx.arc(0, 0, r, -Math.PI / 2, Math.PI / 2);
    ctx.ellipse(0, 0, r * 0.5, r, 0, Math.PI / 2, -Math.PI / 2, false);
    ctx.fill();
  } else if (phase === 5) { // أحدب متناقص
    ctx.beginPath();
    ctx.arc(0, 0, r, Math.PI / 2, 3 * Math.PI / 2);
    ctx.ellipse(0, 0, r * 0.5, r, 0, -Math.PI / 2, Math.PI / 2, false);
    ctx.fill();
  } else if (phase === 7) { // هلال متناقص
    ctx.beginPath();
    ctx.arc(0, 0, r, Math.PI / 2, 3 * Math.PI / 2);
    ctx.ellipse(0, 0, r * 0.5, r, 0, -Math.PI / 2, Math.PI / 2, true);
    ctx.fill();
  }

  ctx.restore();
}

function drawBackground() {
  const night = timeOfDay === "night";
  let sky, ground;
  if (environment === "grass") { sky = night ? "#081421" : "#7ac1ed"; ground = night ? "#173022" : "#43a047"; }
  else if (environment === "desert") { sky = night ? "#111426" : "#f8c276"; ground = night ? "#332719" : "#d49a43"; }
  else if (environment === "city") { sky = night ? "#070c16" : "#8ca0b3"; ground = night ? "#1a2029" : "#4b5561"; }
  else { sky = night ? "#081521" : "#c8e6c9"; ground = night ? "#25343d" : "#e3f2fd"; }

  ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H * 0.34);

  if (timeOfDay === "night") {
    drawMoon(W * 0.8, H * 0.1, 22, currentMoonPhase);

    ctx.fillStyle = "rgba(255,255,255,0.7)";
    for (let i = 0; i < 25; i++) {
      ctx.fillRect((i * 137) % W, (i * 59) % (H * 0.3), 2, 2);
    }
  } else if (environment === "desert") {
    ctx.fillStyle = "#fff3e0"; ctx.shadowBlur = 25; ctx.shadowColor = "#ff9800";
    ctx.beginPath(); ctx.arc(W * 0.2, H * 0.12, 32, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
  }

  const horizonY = H * 0.34;
  if (environment === "city") {
    for (let i = 0; i < 16; i++) {
      let bx = (i * 90) % (W + 100) - 50;
      let bw = 55 + (i * 17) % 40;
      let bh = 40 + (i * 31) % 110;
      let by = horizonY - bh;

      ctx.fillStyle = timeOfDay === "night" ? "#0f1c2d" : "#5d6d7e";
      ctx.fillRect(bx, by, bw, bh);

      ctx.fillStyle = timeOfDay === "night" ? ((i % 2 === 0) ? "#ffd54f" : "#4fc3f7") : "#85929e";
      for (let wx = bx + 6; wx < bx + bw - 8; wx += 12) {
        for (let wy = by + 8; wy < horizonY - 6; wy += 14) {
          if ((wx + wy + i) % 3 !== 0) ctx.fillRect(wx, wy, 6, 8);
        }
      }
    }
  } else if (environment === "grass") {
    ctx.fillStyle = "#388e3c";
    ctx.beginPath(); ctx.moveTo(0, horizonY);
    for (let x = 0; x <= W; x += 40) {
      ctx.lineTo(x, horizonY - 15 - Math.sin(x * 0.015) * 15);
    }
    ctx.lineTo(W, horizonY); ctx.fill();
  } else if (environment === "desert") {
    ctx.fillStyle = "#c08030";
    ctx.beginPath(); ctx.moveTo(W * 0.65, horizonY); ctx.lineTo(W * 0.78, horizonY - 60); ctx.lineTo(W * 0.91, horizonY); ctx.fill();
    ctx.fillStyle = "#d49240";
    ctx.beginPath(); ctx.moveTo(W * 0.78, horizonY - 60); ctx.lineTo(W * 0.91, horizonY); ctx.lineTo(W * 0.82, horizonY); ctx.fill();
  } else if (environment === "winter") {
    ctx.fillStyle = "#90a4ae";
    ctx.beginPath(); ctx.moveTo(0, horizonY); ctx.lineTo(W * 0.25, horizonY - 70); ctx.lineTo(W * 0.5, horizonY); ctx.lineTo(W * 0.75, horizonY - 90); ctx.lineTo(W, horizonY); ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.beginPath(); ctx.moveTo(W * 0.25, horizonY - 70); ctx.lineTo(W * 0.2, horizonY - 55); ctx.lineTo(W * 0.3, horizonY - 55); ctx.fill();
    ctx.beginPath(); ctx.moveTo(W * 0.75, horizonY - 90); ctx.lineTo(W * 0.68, horizonY - 68); ctx.lineTo(W * 0.82, horizonY - 68); ctx.fill();
  }

  ctx.fillStyle = ground; ctx.fillRect(0, horizonY, W, H * 0.66);

  drawRoadSurface();

  for (let i = 0; i < 12; i++) {
    let progress = ((i * 120 + roadOffset * 1.5) % (H * 0.66));
    let propY = horizonY + progress;

    let t = (propY - horizonY) / (H * 0.66);
    let roadW = (W * 0.35) + (W * 0.53) * t;
    let scale = 0.4 + 0.8 * t;

    let leftX = (W / 2) - (roadW / 2) - (40 * scale);
    let rightX = (W / 2) + (roadW / 2) + (40 * scale);

    if (environment === "grass") {
      drawTree(leftX, propY, scale); drawTree(rightX, propY, scale);
    } else if (environment === "desert") {
      drawCactus(leftX, propY, scale); drawCactus(rightX, propY, scale);
    } else if (environment === "city") {
      drawLampPost(leftX, propY, scale, timeOfDay === "night");
      drawLampPost(rightX, propY, scale, timeOfDay === "night");
    } else if (environment === "winter") {
      drawPineTree(leftX, propY, scale); drawPineTree(rightX, propY, scale);
    }
  }
}

function drawHeadlights() {
  if (timeOfDay !== "night" || environment === "city") return;
  const y = player.y - player.h * 0.40;
  const x = player.x;
  const g = ctx.createRadialGradient(x, y, 5, x, y - H * 0.40, W * 0.38);
  g.addColorStop(0, "rgba(255,248,200,.28)");
  g.addColorStop(.45, "rgba(255,248,200,.10)");
  g.addColorStop(1, "rgba(255,248,200,0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(x-16,y); ctx.lineTo(x-W*.40,y-H*.42); ctx.lineTo(x+W*.40,y-H*.42); ctx.lineTo(x+16,y);
  ctx.closePath(); ctx.fill();
}

function drawPowerup(p) {
  const x = laneX(p.lane, p.y);
  const scale = getPerspectiveScale(p.y);
  ctx.save(); ctx.translate(x, p.y); ctx.scale(scale, scale); p.rot += .05; ctx.rotate(Math.sin(p.rot) * .08);
  const c = p.type === "speed" ? "#ff4d4d" : "#36b7ff";
  ctx.shadowBlur = 16; ctx.shadowColor = c; ctx.fillStyle = c;
  ctx.beginPath(); ctx.arc(0, 0, 18, 0, Math.PI * 2); ctx.fill();
  ctx.shadowBlur = 0; ctx.fillStyle = "#fff";
  if (p.type === "speed") {
    ctx.beginPath(); ctx.moveTo(-5, -12); ctx.lineTo(8, -2); ctx.lineTo(1, -2); ctx.lineTo(7, 12); ctx.lineTo(-8, 1); ctx.lineTo(-1, 1); ctx.closePath(); ctx.fill();
  } else {
    ctx.beginPath(); ctx.moveTo(0, -12); ctx.lineTo(11, -6); ctx.lineTo(8, 9); ctx.lineTo(0, 14); ctx.lineTo(-8, 9); ctx.lineTo(-11, -6); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}

function collision(a, b) {
  const dx = Math.abs(a.x - b.x), dy = Math.abs(a.y - b.y);
  return dx < (a.w + b.w) * .42 && dy < (a.h + b.h) * .42;
}
function playerBox() { return { x: player.x, y: player.y, w: player.w, h: player.h }; }

function endGame() {
  state = "over";
  if (finalScoreEl) finalScoreEl.textContent = trophies + " 🏆";
  if (finalDistanceEl) finalDistanceEl.textContent = Math.floor(distance) + " m";
  if (gameUI) gameUI.classList.add("hidden");
  if (mobileControls) mobileControls.classList.add("hidden");
  if (gameOverScreen) gameOverScreen.classList.remove("hidden");
}

function update(dt) {
  connectMeUpdatePlayerSpeed(dt);
  if (state !== "playing" || paused) return;

  const ds = difficultySettings[difficulty];

  if (shieldTimer > 0) {
    shieldTimer -= dt;
    if (shieldTimer <= 0) {
      shieldTimer = 0;
      shield = 0;
      showEvent("🛡 انتهى الدرع!");
    }
  }

  if (speedBoostTimer > 0) {
    speedBoostTimer -= dt;
    if (speedBoostTimer <= 0) {
      speedBoostTimer = 0;
      showEvent("⚡ انتهت قوة السرعة!");
    }
  }

  // تعاقب الليل والنهار
  dayNightTimer -= dt;
  if (dayNightTimer <= 0) {
    dayNightTimer = 18 + Math.random() * 8;
    if (timeOfDay === "day") {
      timeOfDay = "night";
      currentMoonPhase = (currentMoonPhase + 1) % 8;
      showEvent(`🌙 حلّ الليل! (القمر: ${moonNames[currentMoonPhase]})`);
    } else {
      timeOfDay = "day";
      showEvent("☀️ أشرقت الشمس!");
    }
  }

  // التغيير الديناميكي للبيئة (Biome) - أصبحت المدة أطول (تتراوح بين 60 إلى 90 ثانية)
  biomeChangeTimer -= dt;
  if (biomeChangeTimer <= 0) {
    biomeChangeTimer = 60 + Math.random() * 30; // إعادة ضبط المؤقت لمرحلة طويلة قادمة
    const availableBiomes = environments.filter(e => e.id !== environment);
    const nextBiome = availableBiomes[Math.floor(Math.random() * availableBiomes.length)];
    environment = nextBiome.id;
    showEvent(`🏞️ انطلقت إلى بيئة: ${nextBiome.name}`);
  }

  baseSpeed = Math.min(ds.maxSpeed, baseSpeed + ds.acceleration * dt);
  speed = Math.min(ds.maxSpeed + SPEED_BOOST_AMOUNT, baseSpeed + (speedBoostTimer > 0 ? SPEED_BOOST_AMOUNT : 0));

  roadOffset += speed * 90 * dt;
  distance += speed * dt * 3;

  if (difficulty !== "peaceful") {
    spawnTimer -= dt;
    if (spawnTimer <= 0) {
      spawnTraffic();
      spawnTimer = Math.max(ds.spawnMin, ds.spawnBase - speed * .025) + Math.random() * .45;
    }
  }
  powerTimer -= dt;
  if (powerTimer <= 0) {
    spawnPowerup();
    powerTimer = 4 + Math.random() * 6;
  }

  player.lane += (player.targetLane - player.lane) * 8.0 * dt;
  player.x = laneX(player.lane, player.y);

  for (let i = traffic.length - 1; i >= 0; i--) {
    const t = traffic[i];
    t.y += speed * 55 * t.speed * dt;
    const s = carSize(t.type);
    const scale = getPerspectiveScale(t.y);
    
    const bx = { x: laneX(t.lane, t.y), y: t.y, w: s.w * scale, h: s.h * scale };

    if (collision(playerBox(), bx)) {
      if (shield > 0) {
        shield = 0; shieldTimer = 0; traffic.splice(i, 1); shake = .25; showEvent("🛡️ الدرع حماك!"); updateHUD(); continue;
      }
      endGame(); return;
    }

    if (t.y > H + 150) {
      traffic.splice(i, 1);
      carsPassed++; 
      trophies++;

      if (carsPassed >= 5) {
        carsPassed = 0;
        showEvent("🏁 5 سيارات تم تجاوزها!");
      }
    }
  }

  for (let i = powerups.length - 1; i >= 0; i--) {
    const p = powerups[i]; p.y += speed * 52 * dt;
    const scale = getPerspectiveScale(p.y);
    const bx = { x: laneX(p.lane, p.y), y: p.y, w: 40 * scale, h: 40 * scale };
    if (collision(playerBox(), bx)) {
      if (p.type === "speed") {
        speedBoostTimer = SPEED_BOOST_DURATION;
        speed = Math.min(ds.maxSpeed + SPEED_BOOST_AMOUNT, baseSpeed + SPEED_BOOST_AMOUNT);
        showEvent("⚡ قوة سرعة لمدة 3 ثوانٍ!");
      } else {
        shield = 1;
        shieldTimer = SHIELD_DURATION;
        showEvent("🛡️ درع لمدة 8 ثوانٍ!");
      }
      powerups.splice(i, 1); updateHUD(); continue;
    }
    if (p.y > H + 80) powerups.splice(i, 1);
  }
  if (shake > 0) shake -= dt;
  updateHUD();
}

function draw() {
  ctx.save();
  if (shake > 0) ctx.translate((Math.random() - .5) * 8, (Math.random() - .5) * 8);
  drawBackground();
  drawHeadlights();

  for (const t of traffic) {
    const s = carSize(t.type);
    const scale = getPerspectiveScale(t.y);
    drawCar(laneX(t.lane, t.y), t.y, s.w, s.h, t.color, t.type, false, scale);
  }
  for (const p of powerups) drawPowerup(p);

  drawCar(player.x, player.y, player.w, player.h, selectedColor, "normal", true, 1.0);
  ctx.restore();

  if (state === "menu") {
    ctx.fillStyle = "rgba(0,0,0,.12)"; ctx.fillRect(0, 0, W, H);
  }
}

function loop(t) {
  const dt = Math.min(.035, (t - lastTime) / 1000 || 0);
  lastTime = t;
  update(dt); draw();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);