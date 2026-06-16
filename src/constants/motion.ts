export const motion = {
  duration: {
    pressIn: 90,
    pressOut: 140,
    fadeIn: 180,
    fadeOut: 140,
    overlayIn: 220,
    overlayOut: 180,
    cardNudge: 140,
    cardFlip: 360,
    cardPromote: 220,
    cardResultExit: 230,
    cardEntrance: 200,
    resultReveal: 250,
    resultCountUp: 950,
    instructionFadeOut: 220,
    instructionFadeIn: 320,
  },
  spring: {
    press: {
      damping: 18,
      stiffness: 360,
    },
    cardReturn: {
      damping: 17,
      stiffness: 320,
    },
    cardSkip: {
      damping: 17,
      stiffness: 135,
      mass: 0.8,
    },
  },
  haptic: {
    light: 6,
    selection: 10,
    medium: 16,
    heavy: 32,
    vote: 32,
  },
  touchTarget: {
    minimum: 44,
    comfortable: 48,
  },
} as const;
