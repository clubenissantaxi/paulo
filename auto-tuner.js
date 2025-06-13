
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

function cleanSignal(buffer, threshold = 0.01) {
  let rms = 0;
  for (let i = 0; i < buffer.length; i++) rms += buffer[i] * buffer[i];
  rms = Math.sqrt(rms / buffer.length);
  return rms >= threshold;
}

let lastUpdateTime = 0;
const UPDATE_DELAY_MS = 1500; // 1.5 segundos de pausa

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
      const now = Date.now();

      if (!cleanSignal(buffer)) {
        if (now - lastUpdateTime > UPDATE_DELAY_MS) {
          result.textContent = "Ruído ou som fraco...";
          result.style.background = "#999";
          result.style.color = "#fff";
        }
        requestAnimationFrame(detect);
        return;
      }

      const freq = autoCorrelate(buffer, audioCtx.sampleRate);
      if (freq === -1) {
        if (now - lastUpdateTime > UPDATE_DELAY_MS) {
          result.textContent = "Aguardando som...";
          result.style.background = "#ccc";
          result.style.color = "#000";
        }
      } else if (now - lastUpdateTime > UPDATE_DELAY_MS) {
        const { note, freq: expected, diff } = getClosestNote(freq);
        const absDiff = Math.abs(diff);
        const color = absDiff < 5 ? "#0c0" : "#c00"; // verde se afinado
        const status = absDiff < 5 ? "Afinado!" : (diff > 0 ? "Muito Alto" : "Muito Baixo");
        result.innerHTML = `${status}<br>${note} - ${freq.toFixed(2)} Hz`;
        result.style.background = color;
        result.style.color = "#fff";
        lastUpdateTime = now;
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
  let MAX_SAMPLES = Math.floor(SIZE / 2);
  let bestOffset = -1;
  let bestCorrelation = 0;
  let rms = 0;
  let foundGoodCorrelation = false;
  let correlations = new Array(MAX_SAMPLES);

  for (let i = 0; i < SIZE; i++) {
    let val = buf[i];
    rms += val * val;
  }
  rms = Math.sqrt(rms / SIZE);
  if (rms < 0.01) return -1;

  let lastCorrelation = 1;
  for (let offset = 0; offset < MAX_SAMPLES; offset++) {
    let correlation = 0;
    for (let i = 0; i < MAX_SAMPLES; i++) {
      correlation += Math.abs(buf[i] - buf[i + offset]);
    }
    correlation = 1 - correlation / MAX_SAMPLES;
    correlations[offset] = correlation;
    if (correlation > 0.9 && correlation > lastCorrelation) {
      foundGoodCorrelation = true;
      if (correlation > bestCorrelation) {
        bestCorrelation = correlation;
        bestOffset = offset;
      }
    } else if (foundGoodCorrelation) {
      let shift = (correlations[bestOffset + 1] - correlations[bestOffset - 1]) / correlations[bestOffset];
      return sampleRate / (bestOffset + 8 * shift);
    }
    lastCorrelation = correlation;
  }
  if (bestCorrelation > 0.01) {
    return sampleRate / bestOffset;
  }
  return -1;
}
