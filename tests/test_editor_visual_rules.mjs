import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const html = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
const css = readFileSync(new URL('../public/styles.css', import.meta.url), 'utf8');
const header = html.match(/<header class="site-header">([\s\S]*?)<\/header>/)?.[1];

assert.match(html, /<textarea[^>]*class="announcement-input"/s);
assert.match(css, /--tube-red:\s*#c23b3b/i);

const inputRule = css.match(/\.announcement-input\s*\{([^}]+)\}/s)?.[1];
assert.ok(inputRule, 'announcement input should have a dedicated visual treatment');
assert.match(inputRule, /border-left:\s*5px solid var\(--tube-red\)/);
assert.match(inputRule, /background:\s*#fffdf8/i);
assert.match(css, /\.field-heading label::before\s*\{[^}]*content:/s);
assert.match(css, /\.announcement-input:focus\s*\{/);

const effectOptionRule = css.match(/\.effect-option\s*\{([^}]+)\}/s)?.[1];
assert.ok(effectOptionRule, 'station effect choices should have a dedicated layout rule');
assert.match(effectOptionRule, /align-items:\s*center/);
assert.match(css, /\.effect-option input\s*\{[^}]*margin:\s*0/s);

assert.ok(header, 'the page should keep its primary site header');
assert.doesNotMatch(header, /British Station Announcement Generator|en-GB-SoniaNeural|Edge TTS/);
assert.match(html, /<title>MetroVoiceOver<\/title>/);
assert.doesNotMatch(css, /\.(?:brand-description|voice-status|status-light|status-divider)\b/);

const fontPath = new URL('../public/fonts/Johnston100W03-Regular.ttf', import.meta.url);
assert.ok(existsSync(fontPath), 'the supplied Johnston100 font should be served with the site');
assert.match(readFileSync(fontPath).subarray(0, 4).toString('hex'), /^(?:00010000|4f54544f|74727565)$/, 'the bundled font should have a valid TrueType/OpenType signature');
assert.match(css, /font-family:\s*"Johnston100",\s*Inter/i);
assert.match(css, /@font-face\s*\{[^}]*font-family:\s*"Johnston100"[^}]*font-weight:\s*400/s);

console.log('Announcement editor visual rules passed.');
