/**
 * Synthesizes and plays a pleasant chime sound using the Web Audio API.
 * This sound consists of two notes: E4 followed by G4
 */
export const playJoinChime = () => {
    try {
        const AudioContextClass = (window.AudioContext || (window as any).webkitAudioContext);
        if (!AudioContextClass) return;

        const ctx = new AudioContextClass();

        // Use a slight delay to ensure the context is ready
        const playNote = (frequency: number, startTime: number, duration: number) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = 'sine';
            osc.frequency.setValueAtTime(frequency, startTime);

            gain.gain.setValueAtTime(0, startTime);
            gain.gain.linearRampToValueAtTime(0.08, startTime + 0.03); // Reduced volume
            gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.start(startTime);
            osc.stop(startTime + duration);
        };

        const now = ctx.currentTime;
        // E4 (329.63 Hz)
        playNote(329.63, now, 0.15);
        // G4 (392.00 Hz)
        playNote(392.00, now + 0.07, 0.25);

        // Auto-close context after sound finishes to save resources
        setTimeout(() => {
            if (ctx.state !== 'closed') {
                ctx.close().catch(() => { });
            }
        }, 1000);
    } catch (err) {
        console.warn('[Audio] Failed to play join chime:', err);
    }
};
