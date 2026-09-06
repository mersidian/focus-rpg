"use client";

/**
 * The one sound in the app (§1 cut everything else). Synthesised rather than
 * shipped as an asset: two struck tones a fifth apart, decaying.
 */
export function playChime() {
  try {
    const Ctx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const now = ctx.currentTime;

    for (const [freq, delay, gain] of [
      [587.33, 0, 0.22],
      [880.0, 0.14, 0.16],
    ] as const) {
      const osc = ctx.createOscillator();
      const amp = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      amp.gain.setValueAtTime(0, now + delay);
      amp.gain.linearRampToValueAtTime(gain, now + delay + 0.012);
      amp.gain.exponentialRampToValueAtTime(0.0001, now + delay + 1.8);
      osc.connect(amp).connect(ctx.destination);
      osc.start(now + delay);
      osc.stop(now + delay + 1.9);
    }

    setTimeout(() => void ctx.close(), 2400);
  } catch {
    // Audio is a courtesy; a blocked AudioContext must not break the session.
  }
}
