import { ANNOUNCEMENTS } from './examples.js';

const MAX_TEXT_LENGTH = 2000;
const FILTERS = [
  ['All', 'All'],
  ['Departure', 'Departure'],
  ['Arrival', 'Arrival'],
  ['Platform', 'Platform / operations'],
  ['Delay', 'Delay / disruption'],
  ['Underground', 'Underground / metro'],
  ['Safety', 'Station / safety'],
];

const elements = {
  form: document.querySelector('#announcementForm'),
  text: document.querySelector('#announcementText'),
  counter: document.querySelector('#characterCount'),
  inputError: document.querySelector('#inputError'),
  rate: document.querySelector('#rateRange'),
  rateValue: document.querySelector('#rateValue'),
  generate: document.querySelector('#generateButton'),
  generateLabel: document.querySelector('.generate-label'),
  filters: document.querySelector('#categoryFilters'),
  examples: document.querySelector('#exampleList'),
  exampleCount: document.querySelector('#exampleCount'),
  audio: document.querySelector('#audioElement'),
  audioEmpty: document.querySelector('#audioEmpty'),
  audioResult: document.querySelector('#audioResult'),
  audioFormat: document.querySelector('#audioFormat'),
  play: document.querySelector('#playButton'),
  replay: document.querySelector('#replayButton'),
  progress: document.querySelector('#audioProgress'),
  currentTime: document.querySelector('#currentTime'),
  duration: document.querySelector('#duration'),
  download: document.querySelector('#downloadButton'),
  message: document.querySelector('#liveMessage'),
};

let activeCategory = 'All';
let activeExample = null;
let currentObjectUrl = null;
let requestInFlight = false;

function renderFilters() {
  elements.filters.replaceChildren();

  for (const [label, category] of FILTERS) {
    const button = document.createElement('button');
    button.className = 'category-filter';
    button.type = 'button';
    button.textContent = label;
    button.setAttribute('aria-pressed', String(activeCategory === category));
    button.addEventListener('click', () => {
      activeCategory = category;
      renderFilters();
      renderExamples();
    });
    elements.filters.append(button);
  }
}

function renderExamples() {
  const visible = activeCategory === 'All'
    ? ANNOUNCEMENTS
    : ANNOUNCEMENTS.filter((item) => item.category === activeCategory);

  elements.exampleCount.textContent = String(visible.length);
  elements.examples.replaceChildren();

  for (const item of visible) {
    const button = document.createElement('button');
    button.className = 'example-button';
    button.type = 'button';
    button.setAttribute('aria-pressed', String(activeExample?.id === item.id));
    button.setAttribute('aria-label', `Use example: ${item.title}`);

    const title = document.createElement('span');
    title.className = 'example-title';
    title.textContent = item.title;

    const category = document.createElement('span');
    category.className = 'example-category';
    category.textContent = item.category;

    button.append(title, category);
    button.addEventListener('click', () => {
      activeExample = item;
      elements.text.value = item.text;
      elements.inputError.textContent = '';
      updateCounter();
      renderExamples();
      elements.text.focus({ preventScroll: true });
    });
    elements.examples.append(button);
  }
}

function updateCounter() {
  const count = elements.text.value.length;
  elements.counter.textContent = `${count.toLocaleString('en-GB')} / ${MAX_TEXT_LENGTH.toLocaleString('en-GB')}`;
  elements.counter.classList.toggle('is-near-limit', count > MAX_TEXT_LENGTH * 0.9);
}

function updateRate() {
  const value = Number(elements.rate.value);
  elements.rateValue.textContent = `${value >= 0 ? '+' : ''}${value}%`;
}

function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const wholeSeconds = Math.floor(seconds);
  const minutes = Math.floor(wholeSeconds / 60);
  return `${minutes}:${String(wholeSeconds % 60).padStart(2, '0')}`;
}

function setMessage(message, state = 'ready') {
  elements.message.textContent = message;
  elements.message.dataset.state = state;
}

function setGenerating(isGenerating) {
  elements.generate.disabled = isGenerating;
  elements.generate.setAttribute('aria-busy', String(isGenerating));
  elements.generate.classList.toggle('is-generating', isGenerating);
  elements.generateLabel.textContent = isGenerating ? 'Generating announcement…' : 'Generate MP3';
}

function downloadFilename() {
  if (activeExample) {
    const slug = activeExample.title
      .normalize('NFKD')
      .replace(/[^\w\s-]/g, '')
      .trim()
      .toLowerCase()
      .replace(/[\s-]+/g, '_')
      .slice(0, 48);
    return `${slug || 'announcement'}_sonia.mp3`;
  }

  const now = new Date();
  const stamp = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
    '_',
    String(now.getHours()).padStart(2, '0'),
    String(now.getMinutes()).padStart(2, '0'),
    String(now.getSeconds()).padStart(2, '0'),
  ].join('');
  return `metrovoiceover_sonia_${stamp}.mp3`;
}

async function responseError(response) {
  let code = 'generation_failed';
  try {
    const result = await response.json();
    code = result?.error?.code || code;
  } catch {
    // A proxy or platform error may not return JSON.
  }

  const messages = {
    empty_text: 'Enter an announcement before generating audio.',
    invalid_text: 'Enter an announcement and try again.',
    text_too_long: 'Keep the announcement to 2,000 characters or fewer.',
    payload_too_large: 'This request is too large. Shorten the announcement and try again.',
    invalid_rate: 'Choose a speed between −10% and +15%.',
    generation_timeout: 'Audio generation took too long. Please try again.',
    generation_failed: 'Audio generation failed. Please try again.',
    invalid_audio: 'The speech service returned an invalid audio file. Please try again.',
  };
  return messages[code] || 'Audio generation failed. Please try again.';
}

async function generateAudio(event) {
  event.preventDefault();
  if (requestInFlight) return;
  const text = elements.text.value.trim();
  elements.inputError.textContent = '';
  setMessage('');

  if (!text) {
    elements.inputError.textContent = 'Enter an announcement before generating audio.';
    elements.text.focus();
    return;
  }
  if (text.length > MAX_TEXT_LENGTH) {
    elements.inputError.textContent = 'Keep the announcement to 2,000 characters or fewer.';
    elements.text.focus();
    return;
  }

  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 55_000);
  requestInFlight = true;
  setGenerating(true);
  setMessage('Connecting to Sonia voice…');

  try {
    const response = await fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        rate: `${Number(elements.rate.value) >= 0 ? '+' : ''}${elements.rate.value}%`,
        filename_hint: activeExample?.title || 'announcement',
      }),
      signal: controller.signal,
    });

    if (!response.ok) throw new Error(await responseError(response));
    if (!response.headers.get('content-type')?.toLowerCase().includes('audio/mpeg')) {
      throw new Error('The speech service returned an unexpected file. Please try again.');
    }

    const blob = await response.blob();
    if (blob.size === 0) throw new Error('The generated audio was empty. Please try again.');

    const oldUrl = currentObjectUrl;
    currentObjectUrl = URL.createObjectURL(blob);
    elements.audio.src = currentObjectUrl;
    elements.audio.load();
    elements.audioEmpty.hidden = true;
    elements.audioResult.hidden = false;
    elements.audioFormat.hidden = false;
    elements.play.disabled = false;
    elements.replay.disabled = false;
    elements.progress.disabled = true;
    elements.progress.value = '0';
    elements.currentTime.textContent = '0:00';
    elements.duration.textContent = '0:00';
    elements.play.textContent = '▶';
    elements.play.setAttribute('aria-label', 'Play announcement');
    elements.download.href = currentObjectUrl;
    elements.download.download = downloadFilename();
    elements.download.setAttribute('aria-disabled', 'false');
    if (oldUrl) URL.revokeObjectURL(oldUrl);
    setMessage('Audio ready. Press Play to listen.');
  } catch (error) {
    if (error.name === 'AbortError') {
      setMessage('Audio generation timed out. Please try again.', 'error');
    } else {
      setMessage(error.message || 'Audio generation failed. Please try again.', 'error');
    }
  } finally {
    window.clearTimeout(timeoutId);
    requestInFlight = false;
    setGenerating(false);
  }
}

async function playAudio(fromStart = false) {
  if (fromStart || elements.audio.ended) elements.audio.currentTime = 0;
  try {
    await elements.audio.play();
  } catch {
    setMessage('Tap Play to listen to the generated announcement.', 'error');
  }
}

elements.form.addEventListener('submit', generateAudio);
elements.text.addEventListener('input', () => {
  elements.inputError.textContent = '';
  updateCounter();
  if (activeExample) {
    activeExample = null;
    renderExamples();
  }
});
elements.rate.addEventListener('input', updateRate);
elements.play.addEventListener('click', () => {
  if (elements.audio.paused) playAudio();
  else elements.audio.pause();
});
elements.replay.addEventListener('click', () => playAudio(true));
elements.progress.addEventListener('input', () => {
  if (Number.isFinite(elements.audio.duration) && elements.audio.duration > 0) {
    elements.audio.currentTime = (Number(elements.progress.value) / 1000) * elements.audio.duration;
  }
});

elements.audio.addEventListener('loadedmetadata', () => {
  elements.duration.textContent = formatTime(elements.audio.duration);
  elements.progress.disabled = !(elements.audio.duration > 0);
});
elements.audio.addEventListener('timeupdate', () => {
  elements.currentTime.textContent = formatTime(elements.audio.currentTime);
  if (elements.audio.duration > 0) {
    elements.progress.value = String(Math.round((elements.audio.currentTime / elements.audio.duration) * 1000));
  }
});
elements.audio.addEventListener('play', () => {
  elements.play.textContent = 'Ⅱ';
  elements.play.setAttribute('aria-label', 'Pause announcement');
});
elements.audio.addEventListener('pause', () => {
  elements.play.textContent = '▶';
  elements.play.setAttribute('aria-label', 'Play announcement');
});
elements.audio.addEventListener('ended', () => {
  elements.play.textContent = '▶';
  elements.play.setAttribute('aria-label', 'Play announcement');
  elements.progress.value = '1000';
});

window.addEventListener('pagehide', () => {
  if (currentObjectUrl) URL.revokeObjectURL(currentObjectUrl);
});

renderFilters();
renderExamples();
updateCounter();
updateRate();
