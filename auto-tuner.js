
const NOTE_FREQUENCIES = [
  { note: "E2", freq: 82.41 },
  { note: "A2", freq: 110.00 },
  { note: "D3", freq: 146.83 },
  { note: "G3", freq: 196.00 },
  { note: "B3", freq: 246.94 },
  { note: "E4", freq: 329.63 }
];

function getClosestNote(freq) {
  let closest = NOTE_FREQUENCIES[0];
  let minDiff = Math.abs(freq - closest.freq);
  for (let i = 1; i < NOTE_FREQUENCIES.length; i++) {
    let diff = Math.abs(freq - NOTE_FREQUENCIES[i].freq);
    if (diff < minDiff) {
      minDiff = diff;
      closest = NOTE_FREQUENCIES[i];
    }
  }
  return { ...closest, diff: freq - closest.freq };
}

async function startAutoTuner() {
  const result = document.getElementById("result");
  if (!navigator.mediaDevices.getUserMedia) {
    result.textContent = "Microfone não suportado";
    return;
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const source = audioCtx.createMediaStreamSource(stream);
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 2048;
    source.connect(analyser);
    const buffer = new Float32Array(analyser.fftSize);

    function detect() {
      analyser.getFloatTimeDomainData(buffer);
      const freq = autoCorrelate(buffer, audioCtx.sampleRate);
      if (freq === -1) {
        result.textContent = "Aguardando som...";
        result.style.background = "#ccc";
      } else {
        const { note, freq: expected, diff } = getClosestNote(freq);
        const absDiff = Math.abs(diff);
        const color = absDiff < 5 ? "#0c0" : "#c00"; // verde se afinado
        const status = absDiff < 5 ? "Afinado!" : (diff > 0 ? "Muito Alto" : "Muito Baixo");
        result.innerHTML = `${status}<br>${note} - ${freq.toFixed(2)} Hz`;
        result.style.background = color;
        result.style.color = "#fff";
      }
      requestAnimationFrame(detect);
    }
    detect();
  } catch (err) {
    result.textContent = "Erro ao acessar microfone.";
  }
}

function autoCorrelate(buf, sampleRate) {
  let SIZE = buf.length;
  let rms = 0;
  for (let i = 0; i < SIZE; i++) rms += buf[i] * buf[i];
  rms = Math.sqrt(rms / SIZE);
  if (rms < 0.01) return -1;

  let r1 = 0, r2 = SIZE - 1, thres = 0.2;
  for (let i = 0; i < SIZE / 2; i++) if (Math.abs(buf[i]) < thres) { r1 = i; break; }
  for (let i = 1; i < SIZE / 2; i++) if (Math.abs(buf[SIZE - i]) < thres) { r2 = SIZE - i; break; }

  buf = buf.slice(r1, r2);
  SIZE = buf.length;
  const c = new Array(SIZE).fill(0);
  for (let i = 0; i < SIZE; i++)
    for (let j = 0; j < SIZE - i; j++)
      c[i] = c[i] + buf[j] * buf[j + i];

  let d = 0;
  while (c[d] > c[d + 1]) d++;
  let maxval = -1, maxpos = -1;
  for (let i = d; i < SIZE; i++) {
    if (c[i] > maxval) {
      maxval = c[i];
      maxpos = i;
    }
  }
  let T0 = maxpos;
  return sampleRate / T0;
}
