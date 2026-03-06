import { useMemo } from 'react';
import type { ApiKeyMetadata } from '../../shared/types/vault.types';

export type PetMood = 'thriving' | 'content' | 'worried' | 'critical' | 'dead';

export interface PetHealth {
  score: number;       // 0–100
  mood: PetMood;
  label: string;
  worstAgeDays: number;
}

export function usePetHealth(keys: ApiKeyMetadata[]): PetHealth {
  return useMemo(() => {
    const activeKeys = keys.filter((k) => k.isActive);

    if (keys.length === 0) {
      return { score: 55, mood: 'worried', label: 'no secrets', worstAgeDays: 0 };
    }
    if (activeKeys.length === 0) {
      return { score: 15, mood: 'critical', label: 'all inactive', worstAgeDays: 0 };
    }

    const now = Date.now();
    const ageDays = activeKeys.map((k) => {
      const ref = k.lastRotatedAt ?? k.createdAt;
      return (now - new Date(ref).getTime()) / (1000 * 60 * 60 * 24);
    });
    const worstAgeDays = Math.max(...ageDays);

    // 100 at day 0, 0 at 90+ days
    const score = Math.max(0, Math.round(100 - (worstAgeDays / 90) * 100));

    let mood: PetMood;
    if (score >= 75) mood = 'thriving';
    else if (score >= 55) mood = 'content';
    else if (score >= 35) mood = 'worried';
    else if (score >= 10) mood = 'critical';
    else mood = 'dead';

    const labels: Record<PetMood, string> = {
      thriving: 'thriving',
      content: 'content',
      worried: 'hungry',
      critical: 'critical',
      dead: 'expired',
    };

    return { score, mood, label: labels[mood], worstAgeDays };
  }, [keys]);
}
