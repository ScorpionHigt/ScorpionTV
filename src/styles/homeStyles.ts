import { StyleSheet } from 'react-native';

import { COLORS } from './colors';

export const homeStyles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
  },

  loadingText: {
    color: COLORS.textMuted,
    fontSize: 14,
    marginTop: 15,
  },

  safeArea: {
    flex: 1,
  },

  content: {
    paddingHorizontal: 20,
    paddingTop: 25,
    paddingBottom: 30,
  },

  header: {
    paddingHorizontal: 24,
    paddingTop: 20,
    alignItems: 'center',
  },

  logo: {
    color: COLORS.white,
    fontSize: 30,
    fontWeight: '900',
    letterSpacing: 3,
  },

  subtitle: {
    color: COLORS.primary,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 5,
    marginTop: -4,
  },

  welcome: {
    color: COLORS.white,
    fontSize: 32,
    fontWeight: '800',
    textAlign: 'center',
  },

  description: {
    color: '#999999',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 28,
  },

  menu: {
    gap: 12,
  },

  card: {
    backgroundColor: '#151515',
    borderRadius: 16,
    padding: 18,
    minHeight: 100,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#252525',
  },

  m3uCard: {
    borderColor: '#333333',
  },

  cardPressed: {
    opacity: 0.75,
    transform: [
      {
        scale: 0.98,
      },
    ],
  },

  icon: {
    fontSize: 28,
    marginBottom: 6,
  },

  cardTitle: {
    color: COLORS.white,
    fontSize: 20,
    fontWeight: '800',
  },

  cardDescription: {
    color: '#888888',
    fontSize: 13,
    marginTop: 4,
  },

  m3uTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },

  comingSoon: {
    backgroundColor: '#252525',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },

  comingSoonText: {
    color: COLORS.primary,
    fontSize: 9,
    fontWeight: '900',
  },

  email: {
    color: '#555555',
    textAlign: 'center',
    marginBottom: 5,
    fontSize: 11,
  },

  version: {
    color: '#444444',
    textAlign: 'center',
    marginBottom: 15,
    fontSize: 12,
  },

  scrollView: {
    flex: 1,
  },
});