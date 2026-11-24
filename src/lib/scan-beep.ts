/** Short tones: a high double beep for success, a low buzz for a failed scan, a chime for a delivered order. */
export function beep(kind: "success" | "fail" | "delivered") {
  if (typeof window === "undefined") return;
  try {
    const Context = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Context) return;
    const audio = new Context();
    const notes = kind === "success" ? [[1046, 0], [1318, 0.12]] : kind === "fail" ? [[180, 0], [140, 0.18]] : [[784, 0], [988, 0.15], [1175, 0.3]];
    for (const [frequency, delay] of notes) {
      const tone = audio.createOscillator();
      const gain = audio.createGain();
      tone.type = kind === "fail" ? "square" : "sine";
      tone.frequency.value = frequency;
      gain.gain.setValueAtTime(0.2, audio.currentTime + delay);
      gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + delay + (kind === "fail" ? 0.25 : 0.14));
      tone.connect(gain).connect(audio.destination);
      tone.start(audio.currentTime + delay);
      tone.stop(audio.currentTime + delay + 0.3);
    }
    if (kind === "fail" && "vibrate" in navigator) navigator.vibrate?.(200);
  } catch {
    /* audio needs one tap on the page first */
  }
}
