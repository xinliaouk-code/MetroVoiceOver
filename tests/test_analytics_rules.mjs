import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const html = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
const app = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
const vercel = readFileSync(new URL('../vercel.json', import.meta.url), 'utf8');
const bootstrapPath = new URL('../public/analytics-bootstrap.js', import.meta.url);

assert.ok(existsSync(bootstrapPath), 'Vercel Analytics bootstrap should be self-hosted for the site CSP');
assert.match(readFileSync(bootstrapPath, 'utf8'), /window\.va\s*=\s*window\.va\s*\|\|/);
assert.match(html, /<script defer src="\/analytics-bootstrap\.js"><\/script>/);
assert.match(html, /<script defer src="\/_vercel\/insights\/script\.js"><\/script>/);
assert.match(html, /id="siteVisitCount"/);
assert.match(html, /id="audioGenerationCount"/);
assert.match(app, /https:\/\/counterapi\.com\/api/);
assert.match(app, /updateSiteCount\('view',\s*elements\.siteVisitCount,\s*true\)/);

const generationFlow = app.match(/async function generateAudio\(event\)\s*\{([\s\S]*?)\n\}\n\nasync function playAudio/)?.[1];
assert.ok(generationFlow, 'generation flow should be present');
assert.match(generationFlow, /setMessage\('Audio ready\. Press Play to listen\.'\);\s*void updateSiteCount\('audio-generated',\s*elements\.audioGenerationCount,\s*true\)/);
assert.match(vercel, /connect-src 'self' https:\/\/counterapi\.com/);

console.log('Analytics and public counter checks passed.');
