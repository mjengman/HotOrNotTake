import { useEffect, useState } from 'react';
import { autoSeedAITakes } from '../services/aiContentService';

interface AIContentSeedingConfig {
  enabled: boolean;
  targetCount: number;
  checkInterval: number; // in milliseconds
}

const DEFAULT_CONFIG: AIContentSeedingConfig = {
  enabled: true,
  targetCount: 15, // Maintain at least 15 takes
  checkInterval: 5 * 60 * 1000, // Check every 5 minutes
};

export const useAIContentSeeding = (config: Partial<AIContentSeedingConfig> = {}) => {
  const [isSeeding, setIsSeeding] = useState(false);
  const [lastSeedTime, setLastSeedTime] = useState<Date | null>(null);
  const [seedCount, setSeedCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const finalConfig = { ...DEFAULT_CONFIG, ...config };

  const performSeed = async () => {
    if (isSeeding || !finalConfig.enabled) return;

    try {
      setIsSeeding(true);
      setError(null);
      
      const submitted = await autoSeedAITakes(finalConfig.targetCount);
      
      if (submitted > 0) {
        setLastSeedTime(new Date());
        setSeedCount(prev => prev + submitted);
        console.log(`🌱 Auto-seeded ${submitted} AI takes`);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown seeding error';
      setError(errorMessage);
      console.error('Auto-seeding failed:', errorMessage);
    } finally {
      setIsSeeding(false);
    }
  };

  // Initial seed check
  useEffect(() => {
    if (finalConfig.enabled) {
      // Small delay to let the app initialize
      const initialTimeout = setTimeout(() => {
        performSeed();
      }, 3000);

      return () => clearTimeout(initialTimeout);
    }
  }, [finalConfig.enabled]);

  // Periodic seed checks
  useEffect(() => {
    if (!finalConfig.enabled) return;

    const interval = setInterval(() => {
      performSeed();
    }, finalConfig.checkInterval);

    return () => clearInterval(interval);
  }, [finalConfig.enabled, finalConfig.checkInterval]);

  // Manual trigger function
  const triggerSeed = () => {
    performSeed();
  };

  return {
    isSeeding,
    lastSeedTime,
    seedCount,
    error,
    triggerSeed,
    config: finalConfig,
  };
};