import { StyleSheet } from 'react-native';
import { COLORS } from './colors';

export const commonStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  loadingText: {
    marginTop: 12,
    color: COLORS.text,
    fontSize: 16,
  },

  error: {
    color: COLORS.error,
    fontSize: 16,
    textAlign: 'center',
    paddingHorizontal: 20,
  },

  backButton: {
    marginTop: 20,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: COLORS.primary,
  },

  backButtonText: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: '600',
  },
});