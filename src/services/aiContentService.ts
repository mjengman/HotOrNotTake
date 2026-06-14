import { TakeSubmission } from '../types/Take';

const DISABLED_MESSAGE =
  'AI content generation is disabled in client builds. Generate or seed content from trusted server tooling only.';

interface AIGeneratedTake {
  text: string;
  category: string;
  confidence: number;
}

const disabled = async (): Promise<never> => {
  throw new Error(DISABLED_MESSAGE);
};

export const generateAITake = async (
  category?: string,
  maxRetries: number = 5
): Promise<AIGeneratedTake> => {
  void category;
  void maxRetries;
  return disabled();
};

export const generateMultipleAITakes = async (
  count: number = 5
): Promise<AIGeneratedTake[]> => {
  void count;
  return disabled();
};

export const convertAITakeToSubmission = (aiTake: AIGeneratedTake): TakeSubmission => ({
  text: aiTake.text,
  category: aiTake.category,
});

export const autoSeedAITakes = async (
  targetCount: number = 10
): Promise<number> => {
  void targetCount;
  return disabled();
};

export const generateAndPreviewTakes = async (
  count: number = 3
): Promise<AIGeneratedTake[]> => {
  void count;
  return disabled();
};

export const testPersonalityActivation = async (
  category: string = 'food',
  iterations: number = 20
): Promise<void> => {
  void category;
  void iterations;
  console.log(DISABLED_MESSAGE);
};
