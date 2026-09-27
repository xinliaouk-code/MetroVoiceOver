const MAX_PEAK = 10 ** (-1 / 20);
const MIN_GAIN = 0.8;
const MAX_GAIN = 1.25;

export const AUDIO_EFFECTS = Object.freeze({
  'modern-station-pa': Object.freeze({
    name: 'Modern Station PA',
    highPassHz: 160,
    lowPassHz: 7200,
    lowEq: Object.freeze({ frequencyHz: 350, gainDb: -1.8, q: 0.85 }),
    presenceEq: Object.freeze({ frequencyHz: 3200, gainDb: 1.5, q: 0.9 }),
    compressor: Object.freeze({ thresholdDb: -24, kneeDb: 18, ratio: 3, attackSeconds: 0.015, releaseSeconds: 0.14 }),
    saturationDrive: 1.12,
    delayTapsMs: Object.freeze([35, 75]),
    delayTapsDb: Object.freeze([-17, -22]),
    reverbSeconds: 1.4,
    reverbWet: 0.075,
  }),
  'deep-tube': Object.freeze({
    name: 'Deep Tube',
    highPassHz: 220,
    lowPassHz: 5800,
    lowEq: Object.freeze({ frequencyHz: 350, gainDb: -1.8, q: 0.85 }),
    presenceEq: Object.freeze({ frequencyHz: 3200, gainDb: 2.4, q: 0.9 }),
    compressor: Object.freeze({ thresholdDb: -24, kneeDb: 18, ratio: 3, attackSeconds: 0.015, releaseSeconds: 0.14 }),
    saturationDrive: 1.45,
    delayTapsMs: Object.freeze([35, 75]),
    delayTapsDb: Object.freeze([-12, -17]),
    reverbSeconds: 1.8,
    reverbWet: 0.11,
  }),
});

export function detectMp3SampleRate(data) {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  let start = 0;
  if (bytes.length >= 10 && bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) {
    const tagSize = ((bytes[6] & 0x7f) << 21)
      | ((bytes[7] & 0x7f) << 14)
      | ((bytes[8] & 0x7f) << 7)
      | (bytes[9] & 0x7f);
    start = 10 + tagSize + ((bytes[5] & 0x10) ? 10 : 0);
  }

  const mpeg1Rates = [44100, 48000, 32000];
  const mpeg2Rates = [22050, 24000, 16000];
  const mpeg25Rates = [11025, 12000, 8000];
  for (let index = start; index + 3 < bytes.length; index += 1) {
    if (bytes[index] !== 0xff || (bytes[index + 1] & 0xe0) !== 0xe0) continue;
    const version = (bytes[index + 1] >> 3) & 0x03;
    const layer = (bytes[index + 1] >> 1) & 0x03;
    const bitrateIndex = (bytes[index + 2] >> 4) & 0x0f;
    const sampleRateIndex = (bytes[index + 2] >> 2) & 0x03;
    if (version === 1 || layer !== 1 || bitrateIndex === 0 || bitrateIndex === 15 || sampleRateIndex === 3) continue;
    const rates = version === 3 ? mpeg1Rates : version === 2 ? mpeg2Rates : mpeg25Rates;
    return rates[sampleRateIndex];
  }
  return null;
}

export function detectAudioSampleRate(data) {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  if (bytes.length >= 44
    && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46
    && bytes[8] === 0x57 && bytes[9] === 0x41 && bytes[10] === 0x56 && bytes[11] === 0x45) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    for (let offset = 12; offset + 8 <= bytes.length;) {
      const chunkSize = view.getUint32(offset + 4, true);
      if (bytes[offset] === 0x66 && bytes[offset + 1] === 0x6d && bytes[offset + 2] === 0x74 && bytes[offset + 3] === 0x20
        && offset + 16 <= bytes.length) {
        return view.getUint32(offset + 12, true) || null;
      }
      if (chunkSize > bytes.length - offset - 8) break;
      offset += 8 + chunkSize + (chunkSize % 2);
    }
  }
  return detectMp3SampleRate(bytes);
}

export function getAudioEffectPreset(effectId) {
  if (effectId === 'none') return null;
  const preset = AUDIO_EFFECTS[effectId];
  if (!preset) throw new Error('Choose a valid station PA effect.');
  return preset;
}

export function getSafeFrequency(frequencyHz, sampleRate) {
  if (!Number.isFinite(frequencyHz) || !Number.isFinite(sampleRate) || sampleRate <= 0) {
    throw new TypeError('A valid frequency and sample rate are required.');
  }
  const nyquist = sampleRate / 2;
  return Math.max(10, Math.min(frequencyHz, nyquist - Math.max(1, sampleRate * 0.005)));
}

export function matchLoudness(referenceChannels, outputChannels, referenceLength) {
  if (!referenceChannels.length || !outputChannels.length) {
    throw new TypeError('Audio channels are required for loudness matching.');
  }

  const channelCount = Math.min(referenceChannels.length, outputChannels.length);
  const length = Math.min(
    referenceLength,
    ...referenceChannels.slice(0, channelCount).map((channel) => channel.length),
    ...outputChannels.slice(0, channelCount).map((channel) => channel.length),
  );
  if (!Number.isInteger(length) || length <= 0) {
    throw new TypeError('Audio must contain at least one sample.');
  }

  let referencePower = 0;
  let outputPower = 0;
  let outputPeak = 0;
  let referenceSamples = 0;
  let outputSamples = 0;

  for (let channelIndex = 0; channelIndex < channelCount; channelIndex += 1) {
    const reference = referenceChannels[channelIndex];
    const output = outputChannels[channelIndex];
    referenceSamples += length;
    outputSamples += length;
    for (let index = 0; index < length; index += 1) {
      const referenceSample = Number.isFinite(reference[index]) ? reference[index] : 0;
      const outputSample = Number.isFinite(output[index]) ? output[index] : 0;
      referencePower += referenceSample ** 2;
      outputPower += outputSample ** 2;
    }
  }

  for (const channel of outputChannels) {
    for (const sample of channel) {
      if (Number.isFinite(sample)) outputPeak = Math.max(outputPeak, Math.abs(sample));
    }
  }

  const referenceRms = Math.sqrt(referencePower / referenceSamples);
  const outputRms = Math.sqrt(outputPower / outputSamples);
  const requestedGain = outputRms > 0 ? referenceRms / outputRms : 1;
  let gain = Math.max(MIN_GAIN, Math.min(requestedGain, MAX_GAIN));
  if (outputPeak > 0) gain = Math.min(gain, MAX_PEAK / outputPeak);

  const channels = outputChannels.map((channel) => {
    const matched = new Float32Array(channel.length);
    for (let index = 0; index < channel.length; index += 1) {
      const sample = Number.isFinite(channel[index]) ? channel[index] * gain : 0;
      matched[index] = Math.max(-MAX_PEAK, Math.min(MAX_PEAK, sample));
    }
    return matched;
  });

  return { channels, gain, peak: outputPeak * gain };
}

export function encodePcmWav(audioBuffer) {
  const { numberOfChannels, length, sampleRate } = audioBuffer;
  if (!Number.isInteger(numberOfChannels) || numberOfChannels < 1 || numberOfChannels > 8
    || !Number.isInteger(length) || length < 1
    || !Number.isInteger(sampleRate) || sampleRate < 1) {
    throw new TypeError('A valid audio buffer is required for WAV export.');
  }

  const bytesPerSample = 2;
  const blockAlign = numberOfChannels * bytesPerSample;
  const dataBytes = length * blockAlign;
  const output = new ArrayBuffer(44 + dataBytes);
  const view = new DataView(output);
  const writeAscii = (offset, value) => {
    for (let index = 0; index < value.length; index += 1) {
      view.setUint8(offset + index, value.charCodeAt(index));
    }
  };

  writeAscii(0, 'RIFF');
  view.setUint32(4, 36 + dataBytes, true);
  writeAscii(8, 'WAVE');
  writeAscii(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numberOfChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bytesPerSample * 8, true);
  writeAscii(36, 'data');
  view.setUint32(40, dataBytes, true);

  const inputChannels = Array.from({ length: numberOfChannels }, (_, index) => audioBuffer.getChannelData(index));
  let offset = 44;
  for (let frame = 0; frame < length; frame += 1) {
    for (let channel = 0; channel < numberOfChannels; channel += 1) {
      const raw = inputChannels[channel][frame];
      const sample = Number.isFinite(raw) ? Math.max(-1, Math.min(1, raw)) : 0;
      view.setInt16(offset, sample < 0 ? Math.round(sample * 32768) : Math.round(sample * 32767), true);
      offset += bytesPerSample;
    }
  }

  return output;
}

function makeSaturationCurve(drive) {
  const curve = new Float32Array(4096);
  const normalizer = Math.tanh(drive);
  for (let index = 0; index < curve.length; index += 1) {
    const input = (index * 2) / (curve.length - 1) - 1;
    curve[index] = Math.tanh(drive * input) / normalizer;
  }
  return curve;
}

function makeImpulseResponse(context, durationSeconds) {
  const length = Math.max(1, Math.ceil(context.sampleRate * durationSeconds));
  const impulse = context.createBuffer(1, length, context.sampleRate);
  const response = impulse.getChannelData(0);
  let seed = 0x51a7;
  let energy = 0;
  for (let index = 0; index < length; index += 1) {
    seed = (seed * 16807) % 2147483647;
    const noise = (seed / 1073741823.5) - 1;
    const time = index / context.sampleRate;
    const envelope = 10 ** (-3 * time / durationSeconds);
    const sample = noise * envelope;
    response[index] = sample;
    energy += sample * sample;
  }

  const normalization = energy > 0 ? 1 / Math.sqrt(energy) : 1;
  for (let index = 0; index < response.length; index += 1) response[index] *= normalization;
  return impulse;
}

function createFilter(context, type, frequencyHz, sampleRate, q = Math.SQRT1_2, gainDb = 0) {
  const filter = context.createBiquadFilter();
  filter.type = type;
  filter.frequency.value = getSafeFrequency(frequencyHz, sampleRate);
  filter.Q.value = q;
  if (type === 'peaking') filter.gain.value = gainDb;
  return filter;
}

async function decodeAudio(context, arrayBuffer) {
  return new Promise((resolve, reject) => {
    const result = context.decodeAudioData(arrayBuffer, resolve, reject);
    if (result && typeof result.then === 'function') result.then(resolve, reject);
  });
}

async function resampleAudioBuffer(audioBuffer, sampleRate, OfflineContextClass) {
  const channels = Math.max(1, Math.min(audioBuffer.numberOfChannels, 2));
  const length = Math.max(1, Math.ceil(audioBuffer.length * sampleRate / audioBuffer.sampleRate));
  const context = new OfflineContextClass(channels, length, sampleRate);
  const source = context.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(context.destination);
  source.start(0);
  return context.startRendering();
}

export async function renderAudioEffect(audioBlob, effectId) {
  const preset = getAudioEffectPreset(effectId);
  if (!preset) return audioBlob;

  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  const OfflineContextClass = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  if (!AudioContextClass || !OfflineContextClass) {
    throw new Error('This browser does not support audio effects. Please use a recent Safari, Chrome, or Edge browser.');
  }

  const audioData = await audioBlob.arrayBuffer();
  const inputSampleRate = detectAudioSampleRate(audioData);
  let decoder;
  let decoded;
  try {
    decoder = inputSampleRate
      ? new AudioContextClass({ sampleRate: inputSampleRate })
      : new AudioContextClass();
  } catch {
    decoder = new AudioContextClass();
  }
  try {
    decoded = await decodeAudio(decoder, audioData);
  } finally {
    if (typeof decoder.close === 'function') await decoder.close().catch(() => {});
  }
  if (inputSampleRate && decoded.sampleRate !== inputSampleRate) {
    decoded = await resampleAudioBuffer(decoded, inputSampleRate, OfflineContextClass);
  }

  const sampleRate = decoded.sampleRate;
  const channels = Math.max(1, Math.min(decoded.numberOfChannels, 2));
  const reverbTailSeconds = preset.reverbSeconds + 0.12;
  const renderLength = decoded.length + Math.ceil(reverbTailSeconds * sampleRate);
  const offline = new OfflineContextClass(channels, renderLength, sampleRate);
  const source = offline.createBufferSource();
  source.buffer = decoded;

  const highPass = createFilter(offline, 'highpass', preset.highPassHz, sampleRate);
  const lowEq = createFilter(offline, 'peaking', preset.lowEq.frequencyHz, sampleRate, preset.lowEq.q, preset.lowEq.gainDb);
  const presenceEq = createFilter(offline, 'peaking', preset.presenceEq.frequencyHz, sampleRate, preset.presenceEq.q, preset.presenceEq.gainDb);
  const lowPass = createFilter(offline, 'lowpass', preset.lowPassHz, sampleRate);
  const compressor = offline.createDynamicsCompressor();
  compressor.threshold.value = preset.compressor.thresholdDb;
  compressor.knee.value = preset.compressor.kneeDb;
  compressor.ratio.value = preset.compressor.ratio;
  compressor.attack.value = preset.compressor.attackSeconds;
  compressor.release.value = preset.compressor.releaseSeconds;
  const saturation = offline.createWaveShaper();
  saturation.curve = makeSaturationCurve(preset.saturationDrive);
  saturation.oversample = '4x';

  const mix = offline.createGain();
  source.connect(highPass);
  highPass.connect(lowEq);
  lowEq.connect(presenceEq);
  presenceEq.connect(lowPass);
  lowPass.connect(compressor);
  compressor.connect(saturation);
  saturation.connect(mix);

  preset.delayTapsMs.forEach((delayMs, index) => {
    const delay = offline.createDelay(0.2);
    delay.delayTime.value = delayMs / 1000;
    const tapLevel = offline.createGain();
    tapLevel.gain.value = 10 ** (preset.delayTapsDb[index] / 20);
    saturation.connect(delay);
    delay.connect(tapLevel);
    tapLevel.connect(mix);
  });

  const convolver = offline.createConvolver();
  convolver.buffer = makeImpulseResponse(offline, preset.reverbSeconds);
  convolver.normalize = false;
  const reverbLevel = offline.createGain();
  reverbLevel.gain.value = preset.reverbWet;
  saturation.connect(convolver);
  convolver.connect(reverbLevel);
  reverbLevel.connect(mix);
  mix.connect(offline.destination);

  source.start(0);
  const rendered = await offline.startRendering();
  const inputChannels = Array.from({ length: channels }, (_, index) => decoded.getChannelData(index));
  const renderedChannels = Array.from({ length: channels }, (_, index) => rendered.getChannelData(index));
  const matched = matchLoudness(inputChannels, renderedChannels, decoded.length);
  const normalized = offline.createBuffer(channels, matched.channels[0].length, sampleRate);
  matched.channels.forEach((channel, index) => normalized.copyToChannel(channel, index));
  return new Blob([encodePcmWav(normalized)], { type: 'audio/wav' });
}
