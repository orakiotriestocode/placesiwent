(function () {
  'use strict';
  var D = window.WeatherData;
  function $(id) { return document.getElementById(id); }
  function read(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) || fallback; } catch (_) { return fallback; } }
  function save(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch (_) { /* Private browsing can disable storage. */ } }
  var home = { name: 'Ekeren', country: 'Belgium', latitude: 51.28, longitude: 4.418, timezone: 'Europe/Brussels' };
  var place = read('ww-place', home);
  if (!place.name || !isFinite(place.latitude) || !isFinite(place.longitude) || !place.timezone) place = home;
  try { D.localParts(new Date(), place.timezone); } catch (_) { place = home; }
  var theme = read('ww-theme', 'auto');
  var weather = null, rain = null, weatherAt = 0, rainAt = 0;
  var weatherFailed = false, rainFailed = false, generation = 0, working = false, wakeLock = null;
  function text(id, value) { $(id).textContent = value; }
  function clockTime(time, zone) { return new Intl.DateTimeFormat('en-GB', { timeZone: zone || place.timezone, hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(time)); }
  function number(value, suffix) { return typeof value === 'number' && isFinite(value) ? Math.round(value) + suffix : '—'; }
  function condition(code) {
    if (code === 0) return ['☀', 'Clear skies'];
    if (code === 1 || code === 2) return ['⛅', 'Partly cloudy'];
    if (code === 3) return ['☁', 'Overcast'];
    if (code === 45 || code === 48) return ['≋', 'Foggy'];
    if (code >= 51 && code <= 57) return ['☂', 'Drizzle'];
    if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return ['☂', 'Rain'];
    if ((code >= 71 && code <= 77) || code === 85 || code === 86) return ['❄', 'Snow'];
    if (code >= 95 && code <= 99) return ['ϟ', 'Thunderstorms'];
    return ['—', 'Conditions unavailable'];
  }
  function request(url, json) {
    return new Promise(function (resolve, reject) {
      var xhr = new XMLHttpRequest();
      xhr.open('GET', url, true); xhr.timeout = 18000;
      xhr.onload = function () {
        if (xhr.status < 200 || xhr.status >= 300) { reject(Error('Weather service unavailable')); return; }
        try { resolve(json ? JSON.parse(xhr.responseText) : xhr.responseText); } catch (e) { reject(e); }
      };
      xhr.onerror = xhr.ontimeout = function () { reject(Error('Connection failed')); };
      xhr.send();
    });
  }
  function rainCovered() { return place.latitude >= 49.5 && place.latitude <= 53.7 && place.longitude >= 2.5 && place.longitude <= 7.3; }
  function restore() {
    var cached = read('ww-cache', null);
    if (cached && cached.key === place.latitude + ',' + place.longitude) {
      if (Date.now() - cached.weatherAt < 86400000) { weather = cached.weather; weatherAt = cached.weatherAt; }
      if (Date.now() - cached.rainAt < 600000) { rain = cached.rain; rainAt = cached.rainAt; }
    }
  }
  function cache() { save('ww-cache', { key: place.latitude + ',' + place.longitude, weather: weather, weatherAt: weatherAt, rain: rain, rainAt: rainAt }); }
  function renderWeather() {
    text('place', place.name); text('timezone', place.country || place.timezone);
    if (!weather) {
      text('temperature', '—'); text('weather-icon', '☁'); text('condition', weatherFailed ? 'Weather unavailable' : 'Fetching the weather…');
      text('highlow', 'High — · Low —'); ['feels','wind','humidity'].forEach(function (id) { text(id, '—'); }); text('sun', '— / —');
      $('days').textContent = 'Waiting for the forecast…'; return;
    }
    var c = weather.current, daily = weather.daily, info = condition(c.weather_code);
    // Construct temperature with DOM nodes so saved place names are never interpreted as HTML.
    $('temperature').textContent = number(c.temperature_2m, '');
    var unit = document.createElement('span'); unit.textContent = '°C'; $('temperature').appendChild(unit);
    text('weather-icon', c.is_day === 0 && c.weather_code === 0 ? '☾' : info[0]); text('condition', info[1]);
    text('highlow', 'High ' + number(daily.temperature_2m_max[0], '°') + ' · Low ' + number(daily.temperature_2m_min[0], '°'));
    text('feels', number(c.apparent_temperature, '°C')); text('wind', number(c.wind_speed_10m, ' km/h')); text('humidity', number(c.relative_humidity_2m, '%'));
    text('sun', clockTime(daily.sunrise[0] * 1000) + ' / ' + clockTime(daily.sunset[0] * 1000));
    $('days').textContent = '';
    daily.time.slice(0, 5).forEach(function (t, i) {
      var day = document.createElement('div'); day.className = 'day';
      var top = document.createElement('div'); top.className = 'day-top';
      var label = document.createElement('span'); label.textContent = i === 0 ? 'Today' : new Intl.DateTimeFormat('en-GB', { weekday:'short', timeZone:place.timezone }).format(new Date(t * 1000));
      var icon = document.createElement('span'); icon.className = 'day-icon'; icon.textContent = condition(daily.weather_code[i])[0]; icon.setAttribute('role', 'img'); icon.setAttribute('aria-label', condition(daily.weather_code[i])[1]);
      top.appendChild(label); top.appendChild(icon); day.appendChild(top);
      var temp = document.createElement('div'); temp.className = 'day-temp'; temp.textContent = number(daily.temperature_2m_max[i], '°');
      var low = document.createElement('span'); low.textContent = number(daily.temperature_2m_min[i], '°'); temp.appendChild(low); day.appendChild(temp);
      var precip = document.createElement('div'); precip.className = 'day-rain'; precip.textContent = number(daily.precipitation_probability_max[i], '%') + ' rain chance'; day.appendChild(precip); $('days').appendChild(day);
    });
  }
  function chart(samples, now) {
    var points = samples.filter(function (s) { return s.at >= now - 300000; });
    var max = Math.max(1, Math.ceil(Math.max.apply(null, points.map(function (s) { return s.value; }))));
    var end = Math.max(1, (points[points.length - 1].at - now) / 60000);
    var width = 900, x0 = 34, plot = 848, y0 = 8, base = 106, height = base - y0;
    var svg = '<svg viewBox="0 0 900 130" preserveAspectRatio="none" role="img" aria-label="Radar rain intensity forecast in millimetres per hour. ' + $('rain-heading').textContent + '.">';
    [0, .5, 1].forEach(function (f) {
      var y = base - f * height;
      svg += '<line x1="34" x2="882" y1="' + y + '" y2="' + y + '" stroke="currentColor" opacity=".14"/><text x="0" y="' + (y + 4) + '">' + (max * f).toFixed(max > 5 ? 0 : 1) + '</text>';
    });
    var bw = plot * 5 / end;
    points.forEach(function (p) {
      var minute = (p.at - now) / 60000, x = x0 + Math.max(0, minute) / end * plot, h = p.value / max * height;
      var w = Math.max(1, Math.min(bw - 3, width - 18 - x));
      svg += '<rect x="' + x.toFixed(1) + '" y="' + (base - Math.max(2, h)).toFixed(1) + '" width="' + w.toFixed(1) + '" height="' + Math.max(2, h).toFixed(1) + '" rx="2" fill="currentColor" opacity="' + (p.value < .1 ? '.25' : '.9') + '"><title>' + clockTime(p.at) + ': ' + p.value.toFixed(2) + ' mm/h</title></rect>';
    });
    [0,30,60,90].concat(end > 100 ? [Math.floor(end)] : []).forEach(function (m) {
      if (m > end) return;
      var x = x0 + m / end * plot;
      svg += '<text x="' + x + '" y="127" text-anchor="' + (m === 0 ? 'start' : m === Math.floor(end) ? 'end' : 'middle') + '">' + (m === 0 ? 'Now' : clockTime(now + m * 60000)) + '</text>';
    });
    $('chart').innerHTML = svg + '</svg>';
  }
  function renderRain() {
    var now = Date.now();
    if (!rainCovered()) {
      text('rain-heading', 'Outside radar coverage'); text('rain-detail', 'The rain feed is intended for Belgium and the Netherlands.'); text('chart', 'Your daily weather forecast is still available.'); return;
    }
    if (!rain || now - rainAt > 600000 || rain[rain.length - 1].at < now + 600000) {
      text('rain-heading', rainAt ? 'Waiting for fresh radar data' : rainFailed ? 'Rain forecast unavailable' : 'Checking the sky…');
      text('rain-detail', rainAt ? 'Last radar update ' + clockTime(rainAt) + '. Retrying automatically.' : rainFailed ? 'Cannot reach Buienradar. Retrying automatically.' : 'Connecting to the radar rain forecast.');
      $('chart').innerHTML = '<p class="chart-placeholder">No current rain prediction available</p>'; return;
    }
    var summary = D.rainSummary(rain, now);
    text('rain-heading', summary.title); text('rain-detail', summary.detail + (rainFailed ? ' Update failed; showing recent data.' : ''));
    chart(rain, now);
  }
  function tick() {
    var now = new Date(), p = D.localParts(now, place.timezone);
    text('clock', clockTime(now));
    text('date', new Intl.DateTimeFormat('en-GB', { timeZone:place.timezone, weekday:'long', day:'numeric', month:'long' }).format(now));
    var dark = theme === 'dark' || (theme === 'auto' && (+p.hour >= 21 || +p.hour < 7));
    document.body.classList.toggle('light', !dark);
    renderRain();
    var status = [];
    if (navigator.onLine === false) status.push('Offline');
    if (weatherAt) status.push((Date.now() - weatherAt > 1800000 ? 'Weather outdated · ' : 'Weather ') + clockTime(weatherAt));
    else status.push(weatherFailed ? 'Weather unavailable' : 'Connecting…');
    if (weatherFailed && weatherAt) status.push('weather refresh failed');
    if (rainAt && rainCovered()) status.push('Radar ' + clockTime(rainAt));
    text('connection', status.join(' · '));
  }
  function validWeather(w) {
    return w && w.current && typeof w.current.temperature_2m === 'number' && w.daily && ['time','weather_code','temperature_2m_max','temperature_2m_min','sunrise','sunset','precipitation_probability_max'].every(function (k) { return Array.isArray(w.daily[k]) && w.daily[k].length >= 5; });
  }
  function refresh(force) {
    if (working) return;
    working = true;
    var gen = generation, latlon = 'latitude=' + encodeURIComponent(place.latitude) + '&longitude=' + encodeURIComponent(place.longitude), jobs = [];
    $('refresh').disabled = true;
    if (force || !weather || Date.now() - weatherAt >= 900000) {
      jobs.push(request('https://api.open-meteo.com/v1/forecast?' + latlon + '&timezone=' + encodeURIComponent(place.timezone) + '&timeformat=unixtime&forecast_days=5&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,precipitation_probability_max', true).then(function (w) {
        if (gen !== generation) return;
        if (!validWeather(w)) throw Error('Incomplete weather response');
        weather = w; weatherAt = Date.now(); weatherFailed = false; cache(); renderWeather(); tick();
      }).catch(function () { if (gen === generation) { weatherFailed = true; renderWeather(); tick(); } }));
    }
    if (rainCovered()) {
      jobs.push(request('https://gadgets.buienradar.nl/data/raintext/?lat=' + encodeURIComponent(place.latitude) + '&lon=' + encodeURIComponent(place.longitude), false).then(function (r) {
        if (gen !== generation) return;
        rain = D.parseRain(r, Date.now()); rainAt = Date.now(); rainFailed = false; cache(); tick();
      }).catch(function () { if (gen === generation) { rainFailed = true; tick(); } }));
    }
    Promise.all(jobs).then(function () { if (gen === generation) { working = false; $('refresh').disabled = false; tick(); } });
  }
  function choosePlace(next) {
    generation++; place = next; save('ww-place', place); weather = rain = null; weatherAt = rainAt = 0; weatherFailed = rainFailed = false; working = false;
    renderWeather(); closeSettings(); tick(); refresh(true);
  }
  function closeSettings() { $('settings-panel').hidden = true; $('settings').focus(); }
  $('settings').onclick = function () { $('settings-panel').hidden = false; $('city').focus(); };
  $('close-settings').onclick = closeSettings;
  $('settings-panel').onclick = function (e) { if (e.target === this) closeSettings(); };
  document.addEventListener('keydown', function (e) {
    if ($('settings-panel').hidden) return;
    if (e.key === 'Escape') closeSettings();
    if (e.key === 'Tab') {
      var nodes = $('settings-panel').querySelectorAll('button,input,select'), first = nodes[0], last = nodes[nodes.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });
  $('theme').value = theme;
  $('theme').onchange = function () { theme = this.value; save('ww-theme', theme); tick(); };
  $('refresh').onclick = function () { refresh(true); };
  var searchId = 0;
  $('search-form').onsubmit = function (e) {
    e.preventDefault(); var id = ++searchId;
    text('search-results', 'Searching…');
    request('https://geocoding-api.open-meteo.com/v1/search?name=' + encodeURIComponent($('city').value.trim()) + '&count=5&language=en&format=json', true).then(function (result) {
      if (id !== searchId) return;
      text('search-results', result.results && result.results.length ? 'Choose your location:' : 'No locations found. Try a nearby town.');
      (result.results || []).forEach(function (p) {
        var button = document.createElement('button'); button.className = 'result'; button.textContent = [p.name, p.admin1, p.country].filter(Boolean).join(', ');
        button.onclick = function () { choosePlace({ name:p.name, country:p.country || '', latitude:p.latitude, longitude:p.longitude, timezone:p.timezone || 'Europe/Brussels' }); };
        $('search-results').appendChild(button);
      });
    }).catch(function () { if (id === searchId) text('search-results', 'Search unavailable. Please try again.'); });
  };
  $('use-location').onclick = function () {
    if (!navigator.geolocation) { text('search-results', 'Location is unavailable in this browser. Search for a town instead.'); return; }
    text('search-results', 'Waiting for location permission…');
    navigator.geolocation.getCurrentPosition(function (p) {
      choosePlace({ name:'My location', country:'', latitude:Math.round(p.coords.latitude * 1000) / 1000, longitude:Math.round(p.coords.longitude * 1000) / 1000, timezone:Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Brussels' });
    }, function () { text('search-results', 'Location unavailable. Search for a town instead.'); }, { timeout:15000, maximumAge:300000 });
  };
  function stayAwake() {
    if (navigator.wakeLock && !document.hidden && !wakeLock) navigator.wakeLock.request('screen').then(function (lock) { wakeLock = lock; lock.addEventListener('release', function () { wakeLock = null; }); }).catch(function () { /* Older iPads need Auto-Lock set to Never. */ });
  }
  $('fullscreen').onclick = function () {
    var el = document.documentElement;
    if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(function () {});
    else if (el.requestFullscreen) el.requestFullscreen().then(stayAwake).catch(function () { window.alert('Use Share → Add to Home Screen for an iPad full-screen display.'); });
    else window.alert('On iPad: Share → Add to Home Screen, then open Weather Window from its icon.');
  };
  document.addEventListener('visibilitychange', function () { if (!document.hidden) { tick(); refresh(false); stayAwake(); } });
  window.addEventListener('online', function () { refresh(true); });
  window.addEventListener('offline', tick);
  restore(); renderWeather(); tick(); refresh(false); stayAwake();
  setInterval(tick, 30000);
  setInterval(function () { if (!document.hidden) refresh(false); }, 300000);
}());
