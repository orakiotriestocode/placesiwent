const { test } = require('node:test');
const assert = require('node:assert/strict');
const D = require('../web-apps/weather/weather-data.js');
const now = Date.parse('2026-11-11T22:55:00Z'); // 23:55 in Belgium
function feed(wetFrom = 99) {
  return Array.from({ length: 24 }, (_, i) => {
    const m = (23 * 60 + 55 + i * 5) % 1440;
    return `${i >= wetFrom ? '109' : '000'}|${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  }).join('\n');
}
test('zero means dry; timestamps roll across midnight', () => {
  const points = D.parseRain(feed(), now);
  assert.equal(points[0].value, 0);
  assert.equal(points[23].at, now + 115 * 60000);
  assert.match(D.rainSummary(points, now).detail, /115 minutes/);
});
test('radar encoding converts to mm/h and predicts onset', () => {
  const points = D.parseRain(feed(4), now);
  assert.equal(points[4].value, 1);
  assert.match(D.rainSummary(points, now).title, /20 minutes/);
});
test('rain now and subsequent break use forecast timestamps', () => {
  const points = D.parseRain(feed(0), now);
  points[5].value = 0;
  assert.match(D.rainSummary(points, now).detail, /25 minutes/);
});
test('rejects malformed, incomplete, stale, and gapped forecasts', () => {
  assert.throws(() => D.parseRain('<html>unavailable</html>', now));
  assert.throws(() =>
    D.parseRain(feed().split('\n').slice(0, 4).join('\n'), now),
  );
  assert.throws(() =>
    D.parseRain(feed().replace('000|00:00', '000|00:10'), now),
  );
  assert.throws(() => D.parseRain(feed(), now + 3600000));
  assert.throws(() => D.parseRain(feed().replace('000', '999'), now));
});
test('expired forecast cannot report a dry window', () => {
  assert.match(
    D.rainSummary(D.parseRain(feed(), now), now + 86400000).title,
    /unavailable/,
  );
});
