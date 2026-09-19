import Constants from 'expo-constants';

export const APP_NAME =
  Constants.expoConfig?.name ?? 'ScorpionTV';

export const APP_VERSION =
  Constants.expoConfig?.version ?? '2.8.5';

export const APP_YEAR =
  new Date().getFullYear();
