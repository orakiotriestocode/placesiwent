/* Pure rain interpretation; no synthetic fallback data. Times in this feed are Europe/Amsterdam. */
(function (root) {
  'use strict';
  function localParts(date, zone) {
    var parts = new Intl.DateTimeFormat('en-GB', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(date);
    var out = {}; parts.forEach(function (p) { out[p.type] = p.value; }); return out;
  }
  function parseRain(text, now) {
    var p = localParts(new Date(now), 'Europe/Amsterdam');
    var minutes = (+p.hour % 24) * 60 + +p.minute;
    var rows = text.trim().split(/\r?\n/);
    if (rows.length < 12 || rows.length > 30) throw Error('Incomplete radar forecast');
    var previous;
    var samples = rows.map(function (row, index) {
      var m = /^(\d{3})\|([01]\d|2[0-3]):([0-5]\d)$/.exec(row.trim());
      if (!m || +m[1] > 255) throw Error('Invalid radar response');
      var delta = +m[2] * 60 + +m[3] - minutes;
      if (delta > 720) delta -= 1440;
      if (delta < -720) delta += 1440;
      if (index && delta !== previous + 5) throw Error('Radar forecast has gaps');
      if (!index && (delta < -10 || delta > 15)) throw Error('Radar forecast is out of date');
      previous = delta;
      return { at: now - (new Date(now).getSeconds() * 1000 + new Date(now).getMilliseconds()) + delta * 60000, value: +m[1] === 0 ? 0 : Math.pow(10, (+m[1] - 109) / 32) };
    });
    return samples;
  }
  function rainSummary(samples, now) {
    var next = samples.filter(function (s) { return s.at >= now - 5 * 60000; });
    if (next.length < 2 || next[0].at > now + 15 * 60000) return { title: 'Rain forecast unavailable', detail: 'Waiting for a fresh radar forecast.' };
    var wet = next.findIndex(function (s) { return s.value >= 0.1; });
    var end = Math.max(0, Math.floor((next[next.length - 1].at - now) / 60000));
    if (wet < 0) return { title: 'A dry spell ahead', detail: 'No significant rain expected for the next ' + end + ' minutes.' };
    var start = Math.max(0, Math.round((next[wet].at - now) / 60000));
    if (wet === 0) {
      var stop = next.findIndex(function (s, i) { return i > 0 && s.value < 0.1; });
      return { title: 'Rain expected around now', detail: stop > 0 ? 'A break may arrive in around ' + Math.max(5, Math.round((next[stop].at - now) / 60000)) + ' minutes.' : 'Rain may continue throughout the forecast window.' };
    }
    return { title: 'Rain in around ' + start + ' minutes', detail: 'Likely dry until then. Radar timing can shift as showers develop.' };
  }
  var api = { parseRain: parseRain, rainSummary: rainSummary, localParts: localParts };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.WeatherData = api;
}(typeof window !== 'undefined' ? window : this));
