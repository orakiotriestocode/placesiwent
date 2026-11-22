(() => {
  'use strict';
  // Original miniature melodies. Synthesized humming: no downloads or voice service.
  const songs = [
    {
      title: 'A sunny hello',
      notes: [60, 64, 67, 67, 69, 67, 64, 62, 60, 64, 62, 60],
    },
    {
      title: 'Little puddle dance',
      notes: [62, 65, 69, 65, 62, 65, 69, 72, 69, 65, 64, 62],
    },
    {
      title: 'Cuddle song',
      notes: [60, 62, 64, 67, 64, 62, 60, 64, 65, 64, 62, 60],
    },
    {
      title: 'Sleepy stars',
      notes: [67, 64, 62, 60, 62, 64, 65, 62, 60, 59, 60, 60],
      slow: true,
    },
  ];
  let audio, cancel;
  const parse = (text) => {
    const match = /^♫ animal-song:([0-3])$/.exec(text || '');
    return match ? Number(match[1]) : null;
  };
  async function unlock() {
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (!Audio) throw Error('Audio is unavailable');
    audio ||= new Audio();
    await audio.resume();
    if (audio.state !== 'running')
      throw Error('Tap Test voice to enable songs');
  }
  function stop() {
    cancel?.();
  }
  async function play(index, animal, onNote) {
    await unlock();
    stop();
    const song = songs[index],
      beat = song.slow ? 0.55 : 0.36;
    return new Promise((resolve) => {
      const nodes = [],
        timers = [];
      let finished = false;
      const finish = (status) => {
        if (finished) return;
        finished = true;
        timers.forEach(clearTimeout);
        nodes.forEach((node) => {
          try {
            node.stop();
          } catch {}
          node.disconnect();
        });
        cancel = null;
        resolve(status);
      };
      cancel = () => finish('stopped');
      song.notes.forEach((note, i) => {
        const start = audio.currentTime + 0.04 + i * beat;
        const oscillator = audio.createOscillator(),
          gain = audio.createGain();
        const filter = audio.createBiquadFilter();
        oscillator.type = 'triangle';
        oscillator.frequency.value =
          440 *
          2 **
            ((note +
              (animal === 'frog' ? -12 : animal === 'goose' ? 5 : 0) -
              69) /
              12);
        filter.type = 'lowpass';
        filter.frequency.value = 1100;
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(0.18, start + 0.035);
        gain.gain.setValueAtTime(0.18, start + beat * 0.65);
        gain.gain.linearRampToValueAtTime(0, start + beat * 0.92);
        oscillator.connect(filter);
        filter.connect(gain);
        gain.connect(audio.destination);
        oscillator.start(start);
        oscillator.stop(start + beat);
        nodes.push(oscillator, filter, gain);
        timers.push(setTimeout(() => onNote(i), (0.04 + i * beat) * 1000));
      });
      timers.push(
        setTimeout(
          () => finish('spoken'),
          (song.notes.length * beat + 0.15) * 1000,
        ),
      );
    });
  }
  window.BearSongs = {
    songs,
    parse,
    unlock,
    play,
    stop,
    message: (index) => '♫ animal-song:' + index,
  };
})();
