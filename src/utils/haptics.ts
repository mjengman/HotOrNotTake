import { Platform, Vibration } from 'react-native';

export const vibrate = (pattern?: number | number[]) => {
  if (Platform.OS === 'ios') {
    return;
  }

  Vibration.vibrate(pattern);
};
