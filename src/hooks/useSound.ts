import { useCallback } from 'react';

const SOUND_MAP = {
  click: { frequency: 420, duration: 0.05, volume: 0.015 },
  paper: { frequency: 320, duration: 0.08, volume: 0.02 },
  focus: { frequency: 740, duration: 0.18, volume: 0.03 },
} as const;

export function useSound() {
  const play = useCallback((soundName: keyof typeof SOUND_MAP) => {
    const config = SOUND_MAP[soundName];
    const AudioContextCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextCtor) return;

    const context = new AudioContextCtor();
    const oscillator = context.createOscillator();
    const gain = context.createGain();

    oscillator.type = soundName === 'paper' ? 'triangle' : 'sine';
    oscillator.frequency.value = config.frequency;
    gain.gain.value = config.volume;

    oscillator.connect(gain);
    gain.connect(context.destination);

    oscillator.start();
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + config.duration);
    oscillator.stop(context.currentTime + config.duration);
    oscillator.onended = () => {
      void context.close();
    };
  }, []);

  return { play };
}
