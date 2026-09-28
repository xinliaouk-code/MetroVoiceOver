import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
const css = readFileSync(new URL('../public/styles.css', import.meta.url), 'utf8');

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

console.log('Announcement editor visual rules passed.');
