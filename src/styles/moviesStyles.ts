import { StyleSheet } from 'react-native';

import { COLORS } from './colors';

export const moviesStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  header: {
    height: 70,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
  },

  backButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#171717',
    alignItems: 'center',
    justifyContent: 'center',
  },

  backButtonText: {
    color: COLORS.white,
    fontSize: 34,
    lineHeight: 38,
    marginTop: -4,
  },

  headerTextContainer: {
    flex: 1,
    alignItems: 'center',
  },

  title: {
    color: COLORS.white,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 1,
  },

  subtitle: {
    color: COLORS.textMuted,
    fontSize: 12,
    marginTop: 2,
  },

  headerSpacer: {
    width: 42,
  },

  /*
   * Synchronisation
   */

  syncContainer: {
    marginHorizontal: 20,
    marginBottom: 12,
    padding: 12,
    backgroundColor: '#121212',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#242424',
  },

  syncHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },

  syncTitle: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: '700',
  },

  syncText: {
    color: '#888888',
    fontSize: 11,
    flexShrink: 1,
    marginLeft: 10,
  },

  progressBackground: {
    height: 6,
    backgroundColor: '#292929',
    borderRadius: 3,
    overflow: 'hidden',
  },

  progressBar: {
    height: '100%',
    backgroundColor: COLORS.primary,
    borderRadius: 3,
  },

  progressIndeterminate: {
    width: '35%',
    height: '100%',
    backgroundColor: COLORS.primary,
    borderRadius: 3,
  },

  syncPercentage: {
    color: COLORS.textMuted,
    fontSize: 10,
    textAlign: 'right',
    marginTop: 5,
  },

  searchContainer: {
    marginHorizontal: 20,
    marginBottom: 14,
    position: 'relative',
  },

  searchInput: {
    height: 48,
    backgroundColor: '#151515',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#292929',
    color: COLORS.white,
    paddingHorizontal: 18,
    paddingRight: 50,
    fontSize: 15,
  },

  clearSearch: {
    position: 'absolute',
    right: 8,
    top: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#292929',
    alignItems: 'center',
    justifyContent: 'center',
  },

  clearSearchText: {
    color: COLORS.white,
    fontSize: 24,
    lineHeight: 27,
  },

  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 10,
  },

  resultCount: {
    color: COLORS.textMuted,
    fontSize: 13,
  },

  movieList: {
    paddingHorizontal: 12,
    paddingBottom: 30,
  },

  movieListEmpty: {
    flexGrow: 1,
  },

  row: {
    justifyContent: 'space-between',
  },

  movieCard: {
    width: '48%',
    marginBottom: 18,
  },

  movieCardPressed: {
    opacity: 0.7,
    transform: [
      {
        scale: 0.98,
      },
    ],
  },

  posterContainer: {
    width: '100%',
    aspectRatio: 0.67,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#151515',
    position: 'relative',
  },

  poster: {
    width: '100%',
    height: '100%',
  },

  posterFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#171717',
  },

  posterFallbackIcon: {
    fontSize: 42,
  },

  ratingBadge: {
    position: 'absolute',
    right: 7,
    top: 7,
    backgroundColor: 'rgba(0,0,0,0.8)',
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 6,
  },

  ratingText: {
    color: COLORS.white,
    fontSize: 11,
    fontWeight: '700',
  },

  movieTitle: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '600',
    marginTop: 8,
    lineHeight: 19,
  },

  extension: {
    color: '#666666',
    fontSize: 10,
    fontWeight: '600',
    marginTop: 3,
  },

  footer: {
    height: 70,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },

  footerText: {
    color: COLORS.textMuted,
    fontSize: 12,
  },

  endText: {
    color: '#555555',
    fontSize: 12,
  },

  loadingScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  loadingText: {
    color: COLORS.textMuted,
    marginTop: 12,
    fontSize: 14,
  },

  errorContainer: {
    marginHorizontal: 20,
    marginBottom: 10,
    padding: 12,
    backgroundColor: '#2A0D0D',
    borderRadius: 8,
  },

  errorText: {
    color: '#FF6B6B',
    fontSize: 13,
    textAlign: 'center',
  },

  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 30,
  },

  emptyIcon: {
    fontSize: 50,
    marginBottom: 15,
  },

  emptyTitle: {
    color: COLORS.white,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },

  emptyText: {
    color: '#666666',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
  },
});