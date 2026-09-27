import assert from 'node:assert/strict';

import {
  AUDIO_EFFECTS,
  detectAudioSampleRate,
  detectMp3SampleRate,
  encodePcmWav,
  getAudioEffectPreset,
  getSafeFrequency,
  matchLoudness,
} from '../public/audio-effects.js';

assert.equal(getAudioEffectPreset('none'), null);
assert.deepEqual(Object.keys(AUDIO_EFFECTS), ['modern-station-pa', 'deep-tube']);

assert.deepEqual(
  {
    highPassHz: AUDIO_EFFECTS['modern-station-pa'].highPassHz,
    lowPassHz: AUDIO_EFFECTS['modern-station-pa'].lowPassHz,
    lowShelfHz: AUDIO_EFFECTS['modern-station-pa'].lowEq.frequencyHz,
    lowGainDb: AUDIO_EFFECTS['modern-station-pa'].lowEq.gainDb,
    presenceHz: AUDIO_EFFECTS['modern-station-pa'].presenceEq.frequencyHz,
    presenceGainDb: AUDIO_EFFECTS['modern-station-pa'].presenceEq.gainDb,
    delayDb: AUDIO_EFFECTS['modern-station-pa'].delayTapsDb,
    reverbSeconds: AUDIO_EFFECTS['modern-station-pa'].reverbSeconds,
  },
  {
    highPassHz: 160,
    lowPassHz: 7200,
    lowShelfHz: 350,
    lowGainDb: -1.8,
    presenceHz: 3200,
    presenceGainDb: 1.5,
    delayDb: [-17, -22],
    reverbSeconds: 1.4,
  },
);

assert.equal(AUDIO_EFFECTS['deep-tube'].highPassHz, 220);
assert.equal(AUDIO_EFFECTS['deep-tube'].lowPassHz, 5800);
assert.equal(AUDIO_EFFECTS['deep-tube'].presenceEq.gainDb, 2.4);
assert.deepEqual(AUDIO_EFFECTS['deep-tube'].delayTapsDb, [-12, -17]);
assert.equal(AUDIO_EFFECTS['deep-tube'].reverbSeconds, 1.8);
for (const preset of Object.values(AUDIO_EFFECTS)) {
  assert.equal(preset.compressor.ratio, 3);
  assert.equal(preset.compressor.attackSeconds, 0.015);
  assert.equal(preset.compressor.releaseSeconds, 0.14);
  assert.deepEqual(preset.delayTapsMs, [35, 75]);
}
assert.deepEqual(AUDIO_EFFECTS['modern-station-pa'].delayTapsDb, [-17, -22]);
assert.ok(AUDIO_EFFECTS['modern-station-pa'].reverbWet < 0.1);
assert.ok(AUDIO_EFFECTS['deep-tube'].reverbWet >= 0.1 && AUDIO_EFFECTS['deep-tube'].reverbWet < 0.2);
assert.ok(AUDIO_EFFECTS['deep-tube'].saturationDrive > AUDIO_EFFECTS['modern-station-pa'].saturationDrive);
assert.ok(getSafeFrequency(7200, 16000) < 8000);
assert.ok(getSafeFrequency(7200, 8000) < 4000);
assert.ok(getSafeFrequency(350, 8000) < 4000);
assert.equal(detectMp3SampleRate(new Uint8Array([0xff, 0xfb, 0x90, 0x64])), 44100);
assert.equal(
  detectMp3SampleRate(new Uint8Array([
    0x49, 0x44, 0x33, 0x04, 0, 0, 0, 0, 0, 5, 0, 0, 0, 0, 0,
    0xff, 0xf3, 0x94, 0x64,
  ])),
  24000,
);
assert.equal(detectMp3SampleRate(new Uint8Array([0, 1, 2, 3])), null);

const matched = matchLoudness(
  [new Float32Array([0.4, -0.4])],
  [new Float32Array([0.32, -0.32, 0.16])],
  2,
);
assert.ok(Math.abs(matched.channels[0][0] - 0.4) < 0.001);
assert.ok(Math.abs(matched.channels[0][2] - 0.2) < 0.001);
assert.ok(matched.peak <= 10 ** (-1 / 20));

const hot = matchLoudness(
  [new Float32Array([0.98, -0.98])],
  [new Float32Array([1.2, -1.2])],
  2,
);
assert.ok(hot.peak <= 10 ** (-1 / 20));
assert.ok(hot.channels[0].every((sample) => Math.abs(sample) <= 10 ** (-1 / 20)));

const wav = encodePcmWav({
  numberOfChannels: 2,
  length: 2,
  sampleRate: 24000,
  getChannelData(channel) {
    return channel === 0 ? new Float32Array([-1.2, 0.5]) : new Float32Array([1.2, -0.5]);
  },
});
const view = new DataView(wav);
const bytes = new Uint8Array(wav);
assert.equal(detectAudioSampleRate(wav), 24000);
assert.equal(new TextDecoder().decode(bytes.subarray(0, 4)), 'RIFF');
assert.equal(new TextDecoder().decode(bytes.subarray(8, 12)), 'WAVE');
assert.equal(view.getUint16(22, true), 2);
assert.equal(view.getUint32(24, true), 24000);
assert.equal(view.getUint16(34, true), 16);
assert.equal(view.getUint32(40, true), 8);
assert.equal(view.getInt16(44, true), -32768);
assert.equal(view.getInt16(46, true), 32767);
assert.equal(view.getInt16(48, true), 16384);
assert.equal(view.getInt16(50, true), -16384);

console.log('Audio effect and WAV export checks passed.');
