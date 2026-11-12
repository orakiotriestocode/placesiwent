# Weather Window — Alpha 0.1

Buildless tablet dashboard at `/web-apps/weather/`, linked from Web Apps Deluxe.
Default: Ekeren, Belgium. Settings persist per browser. Search and geolocation
change only this dashboard. Geolocation requires a visitor's explicit browser permission.

- Open-Meteo: current conditions and five-day forecast, refreshed every 15 minutes.
- Buienradar: published coordinate raintext feed, refreshed every five minutes.
  Direct HTTPS requests; neither credentials nor a public CORS proxy are used.
  The data source is Buienradar, not Buienalarm. Attribution links are always shown.
- Radar values convert with `10 ** ((value - 109) / 32)`; zero is exactly dry.
  Summaries use a 0.1 mm/h threshold. Start/stop predictions are estimates.
- Raintext clocks use Europe/Amsterdam, including when viewing from another zone.
  Five-minute sequences are checked for gaps, malformed responses and stale times.
  The date-less feed cannot establish an upstream publication date independently.
- Rain predictions are hidden after ten minutes without a successful refresh.
  Weather is marked outdated after thirty minutes. A single per-location cached
  forecast keeps useful weather visible after a network outage. Failures remain visible.
- Rain is enabled only inside the Belgium/Netherlands bounding region. General
  weather supports other locations. No model precipitation substitutes for radar.
- Automatic theme uses the selected place's local time: dark 21:00–07:00.
- No framework, external fonts, mapping library, tracking, or animated background.
  Uses ES2017 browser features and XHR timeouts for older Safari compatibility.
- iPad: Share → Add to Home Screen; Auto-Lock → Never where available.
  Screen Wake Lock is optional and only used on browsers that implement it.
  No claim of hardware testing on an actual older iPad.

Run `npm run test:weather` for rain conversion, midnight rollover, onset, breaks,
invalid/gapped responses and expiration checks. `npm run check` includes it.

Later versions could add animated radar maps, Dutch text and additional cards.
