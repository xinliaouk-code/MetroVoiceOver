import assert from 'node:assert/strict';

import { ANNOUNCEMENTS } from '../examples.js';

assert.equal(ANNOUNCEMENTS.length, 20);
assert.equal(new Set(ANNOUNCEMENTS.map((item) => item.id)).size, 20);
assert.ok(ANNOUNCEMENTS.every((item) => item.title.trim() && item.text.trim()));
assert.ok(ANNOUNCEMENTS.every((item) => item.text.length <= 2000));

const categories = new Set(ANNOUNCEMENTS.map((item) => item.category));

assert.deepEqual(
  [...categories].sort(),
  ['Arrival', 'Departure', 'Delay / disruption', 'Platform / operations', 'Station / safety', 'Underground / metro'].sort(),
);

console.log('Example library checks passed.');
