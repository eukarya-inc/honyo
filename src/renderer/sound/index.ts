// Hidden sound window (see src/ui/sound.ts): plays the chime named in the URL
// fragment with Web Audio, so no audio file is needed.

// [frequency Hz, start s] per note; a soft rising pair for "done", a lower
// falling pair for "error".
const NOTES: Record<string, Array<[number, number]>> = {
  done: [
    [880, 0],
    [1318.5, 0.09],
  ],
  error: [
    [440, 0],
    [330, 0.12],
  ],
};

function play(name: string): void {
  const notes = NOTES[name];
  if (!notes) return;
  const ctx = new AudioContext();
  const end = ctx.currentTime + 0.6;
  for (const [freq, start] of notes) {
    const t = ctx.currentTime + start;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    // Quick attack, gentle decay: a bell-like ping rather than a beep.
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.18, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.4);
  }
  setTimeout(() => void ctx.close(), (end - ctx.currentTime) * 1000 + 100);
}

play(location.hash.slice(1));
