// Pairing links carry only the short-lived code, never a session capability.
(() => {
  const valid = (code) => /^[A-Z2-9]{10}$/.test(code);
  const languages = ['en', 'nl', 'fr', 'de', 'es'];
  window.BearPairing = {
    link(code, base, language = 'en') {
      if (!valid(code)) throw Error('Invalid pairing code');
      const url = new URL(base);
      url.search = '';
      url.hash = new URLSearchParams({
        pair: code,
        ui: languages.includes(language) ? language : 'en',
      }).toString();
      return url.href;
    },
    readHash(hash) {
      const p = new URLSearchParams((hash || '').replace(/^#/, ''));
      if (!p.has('pair')) return null;
      const code = (p.get('pair') || '').toUpperCase();
      return {
        code: valid(code) ? code : null,
        language: languages.includes(p.get('ui')) ? p.get('ui') : null,
      };
    },
    deadline(session) {
      return Date.parse(session.expires) - 110 * 60000;
    },
  };
})();
