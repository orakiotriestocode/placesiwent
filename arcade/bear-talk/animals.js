/* Character art and preset wording. Never rewrite a parent's own message. */
(() => {
  'use strict';
  const keys = ['bear', 'goose', 'frog'];
  let selected = 'bear',
    rendered = false;
  const $ = (id) => document.getElementById(id);
  try {
    const saved = localStorage.getItem('bear-animal');
    if (keys.includes(saved)) selected = saved;
  } catch {}
  function label(emotion = '') {
    return 'A friendly ' + selected + (emotion ? ' · ' + emotion : '');
  }
  function set(value) {
    if (!keys.includes(value)) return false;
    if (rendered && selected === value) return true;
    selected = value;
    rendered = true;
    const element = $('bear');
    element.setAttribute('data-animal', value);
    $('scene-label').textContent = 'A little moment together';
    const pose = element.getAttribute('aria-label')?.split(' · ')[1] || '';
    element.setAttribute('aria-label', label(pose));
    document
      .querySelectorAll('[data-animal-choice]')
      .forEach((button) =>
        button.setAttribute(
          'aria-pressed',
          String(button.dataset.animalChoice === value),
        ),
      );
    $('touch-hint').textContent = {
      bear: 'Tap my head, tummy or paws ♡',
      goose: 'Tap my head, tummy or wings ♡',
      frog: 'Tap my head, tummy or feet ♡',
    }[value];
    $('remote-animal-icon').textContent = {
      bear: '🐻',
      goose: '🪿',
      frog: '🐸',
    }[value];
    try {
      localStorage.setItem('bear-animal', value);
    } catch {}
    return true;
  }
  function bindPicker(onChoose) {
    document.querySelectorAll('[data-animal-choice]').forEach((button) => {
      button.onclick = () => onChoose(button.dataset.animalChoice);
    });
  }
  function caption(action, fallback) {
    if (selected === 'bear') return fallback;
    if (action === 'cuddle')
      return selected === 'goose'
        ? 'A big goose cuddle!'
        : 'A big frog cuddle!';
    if (action === 'paw' && selected === 'goose') return 'A wing wave for you!';
    if (action === 'feet')
      return selected === 'goose'
        ? 'A little goose waddle!'
        : 'Hop, hop, hooray!';
    return fallback;
  }
  function phrase(text, lang) {
    if (selected === 'bear') return text;
    const goose = selected === 'goose';
    const replacements =
      {
        en: [
          [/\bBear\b/g, goose ? 'Goose' : 'Frog'],
          [/\bbear\b/g, goose ? 'goose' : 'frog'],
          [/\bpaws\b/g, goose ? 'wings' : 'hands'],
          [/\bpaw\b/g, goose ? 'wing' : 'hand'],
        ],
        nl: [
          [/beertje/g, goose ? 'gansje' : 'kikkertje'],
          [/beren/g, goose ? 'ganzen' : 'kikker'],
          [/\bBeer\b/g, goose ? 'Gans' : 'Kikker'],
          [/\bbeer\b/g, goose ? 'gans' : 'kikker'],
          [/pootjes/g, goose ? 'vleugeltjes' : 'voetjes'],
          [/pootje/g, goose ? 'vleugeltje' : 'handje'],
        ],
        fr: [
          [/ton petit ours/g, goose ? 'ta petite oie' : 'ta petite grenouille'],
          [/ton ours/g, goose ? 'ton oie' : 'ta grenouille'],
          [/[Pp]etit ours/g, goose ? 'Petite oie' : 'Petite grenouille'],
          [/d’ours/g, goose ? 'd’oie' : 'de grenouille'],
          [/ours/g, goose ? 'oie' : 'grenouille'],
          [/petites pattes/g, goose ? 'petites ailes' : 'petites pattes'],
          [/Ma patte/g, goose ? 'Mon aile' : 'Ma patte'],
        ],
        de: [
          [
            /dein kleiner Bär/g,
            goose ? 'deine kleine Gans' : 'dein kleiner Frosch',
          ],
          [/Bären/g, goose ? 'Gänse' : 'Frosch'],
          [/Bär/g, goose ? 'Gans' : 'Frosch'],
          [/Pfoten/g, goose ? 'Flügel' : 'Hände'],
          [/Meine Pfote/g, goose ? 'Mein Flügel' : 'Meine Hand'],
        ],
        es: [
          [/Osito/g, goose ? 'Gansito' : 'Ranita'],
          [/ositos/g, goose ? 'gansitos' : 'ranitas'],
          [/osito/g, goose ? 'gansito' : 'ranita'],
          [/oso/g, goose ? 'ganso' : 'rana'],
          [/patitas/g, goose ? 'alitas' : 'patitas'],
          [/patita/g, goose ? 'alita' : 'patita'],
        ],
      }[String(lang).split('-')[0]] || [];
    return replacements.reduce(
      (value, [pattern, replacement]) => value.replace(pattern, replacement),
      text,
    );
  }
  set(selected);
  window.BearAnimals = {
    set,
    bindPicker,
    caption,
    phrase,
    label,
    get selected() {
      return selected;
    },
  };
})();
