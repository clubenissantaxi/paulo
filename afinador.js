let audioContext, analyser, dataArray;

async function iniciarAfinador() {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  audioContext = new (window.AudioContext || window.webkitAudioContext)();
  const source = audioContext.createMediaStreamSource(stream);
  analyser = audioContext.createAnalyser();
  source.connect(analyser);
  analyser.fftSize = 2048;

  const bufferLength = analyser.fftSize;
  dataArray = new Float32Array(bufferLength);

  detectarFrequencia();
}

function detectarFrequencia() {
  analyser.getFloatTimeDomainData(dataArray);

  let rms = 0;
  for (let i = 0; i < dataArray.length; i++) {
    rms += dataArray[i] * dataArray[i];
  }
  rms = Math.sqrt(rms / dataArray.length);
  if (rms < 0.01) {
    requestAnimationFrame(detectarFrequencia);
    return;
  }

  let bestOffset = -1;
  let bestCorrelation = 0;
  let sampleRate = audioContext.sampleRate;
  for (let offset = 50; offset < 1000; offset++) {
    let correlation = 0;
    for (let i = 0; i < dataArray.length - offset; i++) {
      correlation += dataArray[i] * dataArray[i + offset];
    }
    if (correlation > bestCorrelation) {
      bestCorrelation = correlation;
      bestOffset = offset;
    }
  }

  if (bestOffset !== -1) {
    let freq = sampleRate / bestOffset;
    document.getElementById('frequencia').innerText = `Frequência: ${freq.toFixed(2)} Hz`;
  }

  requestAnimationFrame(detectarFrequencia);
}
