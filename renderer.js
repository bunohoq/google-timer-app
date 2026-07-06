const CX = 150;
const CY = 150;
const R = 140;

const ticksG = document.getElementById('ticks');
const labelsG = document.getElementById('labels');
const pieEl = document.getElementById('pie');
const knobEl = document.getElementById('knob');
const digitalEl = document.getElementById('digital');
const dial = document.getElementById('dial');
const startBtn = document.getElementById('startBtn');

function point(radius, angleDeg) {
  const rad = (angleDeg * Math.PI) / 180;
  return {
    x: CX + radius * Math.sin(rad),
    y: CY - radius * Math.cos(rad),
  };
}

// 눈금 그리기 (0~59분, 5분마다 굵게)
for (let i = 0; i < 60; i++) {
  const angle = i * 6;
  const major = i % 5 === 0;
  const outer = point(R, angle);
  const inner = point(R - (major ? 16 : 9), angle);
  const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  line.setAttribute('x1', outer.x);
  line.setAttribute('y1', outer.y);
  line.setAttribute('x2', inner.x);
  line.setAttribute('y2', inner.y);
  line.setAttribute('class', major ? 'tick major' : 'tick');
  ticksG.appendChild(line);
}

// 숫자 라벨 (5분 단위)
for (let i = 0; i < 60; i += 5) {
  const angle = i * 6;
  const pos = point(R - 32, angle);
  const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  text.setAttribute('x', pos.x);
  text.setAttribute('y', pos.y);
  text.setAttribute('class', 'label');
  text.textContent = i;
  labelsG.appendChild(text);
}

// 남은 시간(분, 소수) 상태
let remainingMinutes = 0;
let running = false;
let lastTick = null;
let rafId = null;

function getPieColor(minutes) {
  if (minutes > 5) return '#2be830';
  if (minutes > 1) return '#f5a623';
  return '#e74c3c';
}

function drawPie(minutes) {
  const clamped = Math.max(0, Math.min(60, minutes));
  const angle = clamped * 6;

  pieEl.setAttribute('fill', getPieColor(clamped));

  if (clamped <= 0.001) {
    pieEl.setAttribute('d', '');
    return;
  }
  if (clamped >= 59.999) {
    // 원 전체를 두 개의 반원 아크로 채움
    pieEl.setAttribute(
      'd',
      `M ${CX - R},${CY} A ${R},${R} 0 1,1 ${CX + R},${CY} A ${R},${R} 0 1,1 ${CX - R},${CY} Z`
    );
    return;
  }

  const start = point(R, 0);
  const end = point(R, angle);
  const largeArc = angle > 180 ? 1 : 0;
  const d = `M ${CX},${CY} L ${start.x},${start.y} A ${R},${R} 0 ${largeArc},1 ${end.x},${end.y} Z`;
  pieEl.setAttribute('d', d);
}

function formatTime(minutes) {
  const totalSeconds = Math.round(minutes * 60);
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function updateStartBtn() {
  startBtn.classList.toggle('running', running);
  startBtn.textContent = running ? '정지' : '시작';
  startBtn.disabled = !running && remainingMinutes <= 0;
}

function render() {
  drawPie(remainingMinutes);
  digitalEl.textContent = formatTime(remainingMinutes);
  updateStartBtn();
}

function angleFromEvent(evt) {
  const rect = dial.getBoundingClientRect();
  const scale = 300 / rect.width;
  const x = (evt.clientX - rect.left) * scale - CX;
  const y = (evt.clientY - rect.top) * scale - CY;
  let deg = (Math.atan2(x, -y) * 180) / Math.PI;
  if (deg < 0) deg += 360;
  return deg;
}

const DRAG_SNAP_MINUTES = 0.5;

function snapMinutes(minutes) {
  return Math.round(minutes / DRAG_SNAP_MINUTES) * DRAG_SNAP_MINUTES;
}

function minutesFromEvent(evt) {
  return snapMinutes(angleFromEvent(evt) / 6);
}

function stopCountdown() {
  running = false;
  lastTick = null;
  if (rafId) cancelAnimationFrame(rafId);
  rafId = null;
}

let audioCtx = null;

function getAudioCtx() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioCtx;
}

function beep() {
  const ctx = getAudioCtx();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.value = 880;
  gain.gain.setValueAtTime(0.15, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.6);
  osc.connect(gain).connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + 0.6);
}

// 다이얼을 스냅 단위로 돌릴 때 나는 짤깍 소리 (빠르게 돌리면 드르륵처럼 연속으로 울림)
function playDragTick() {
  const ctx = getAudioCtx();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'square';
  osc.frequency.value = 250;
  gain.gain.setValueAtTime(0.09, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.03);
  osc.connect(gain).connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + 0.03);
}

// 부동소수점 오차로 0에 정확히 도달하지 못하고 남는 값 보정용 임계값(0.5초)
const END_THRESHOLD_MINUTES = 0.5 / 60;

function tick(now) {
  if (!running) return;
  if (lastTick === null) lastTick = now;
  const deltaMinutes = (now - lastTick) / 60000;
  lastTick = now;
  remainingMinutes = Math.max(0, remainingMinutes - deltaMinutes);
  if (remainingMinutes < END_THRESHOLD_MINUTES) {
    remainingMinutes = 0;
  }
  render();

  if (remainingMinutes <= 0) {
    stopCountdown();
    beep();
    return;
  }
  rafId = requestAnimationFrame(tick);
}

function startCountdown() {
  if (running || remainingMinutes <= 0) return;
  running = true;
  lastTick = null;
  rafId = requestAnimationFrame(tick);
}

// 드래그로 시간 설정
let dragging = false;

function setDragMinutes(minutes) {
  if (minutes !== remainingMinutes) {
    playDragTick();
  }
  remainingMinutes = minutes;
  render();
}

dial.addEventListener('mousedown', (evt) => {
  dragging = true;
  stopCountdown();
  setDragMinutes(minutesFromEvent(evt));
});

window.addEventListener('mousemove', (evt) => {
  if (!dragging) return;
  setDragMinutes(minutesFromEvent(evt));
});

window.addEventListener('mouseup', () => {
  if (!dragging) return;
  dragging = false;
  render();
});

// 더블클릭으로 리셋
dial.addEventListener('dblclick', () => {
  stopCountdown();
  remainingMinutes = 0;
  render();
});

startBtn.addEventListener('click', () => {
  if (running) {
    stopCountdown();
  } else {
    startCountdown();
  }
  render();
});

document.getElementById('closeBtn').addEventListener('click', () => {
  window.electronAPI.closeWindow();
});

render();
