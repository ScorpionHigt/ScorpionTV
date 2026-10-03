import { StyleSheet } from 'react-native';

import { COLORS } from './colors';

export const seriesDetailStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  content: {
    paddingBottom: 40,
  },

  topBar: {
    paddingHorizontal: 16,
    paddingVertical: 14,
  },

  backBut: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#1A1A1A',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  backButText: {
    color: COLORS.white,
    fontSize: 34,
    lineHeight: 38,
    marginTop: -4,
  },

  hero: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginTop: 4,
  },

  poster: {
    width: 130,
    height: 190,
    borderRadius: 10,
    backgroundColor: '#191919',
  },

  posterPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },

  placeholderText: {
    color: '#666666',
    fontSize: 12,
    fontWeight: '700',
  },

  heroInfo: {
    flex: 1,
    marginLeft: 16,
    justifyContent: 'center',
  },

  title: {
    color: COLORS.white,
    fontSize: 24,
    fontWeight: '700',
  },

  rating: {
    color: '#F5C542',
    fontSize: 15,
    marginTop: 10,
  },

  genre: {
    color: '#BBBBBB',
    fontSize: 14,
    marginTop: 10,
  },

  meta: {
    color: '#888888',
    fontSize: 13,
    marginTop: 7,
  },

  section: {
    marginTop: 24,
    paddingHorizontal: 16,
  },

  sectionTitle: {
    color: COLORS.white,
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 12,
  },

  plot: {
    color: '#CCCCCC',
    fontSize: 14,
    lineHeight: 21,
  },

  seasons: {
    paddingRight: 16,
  },

  season: {
    minWidth: 110,
    paddingHorizontal: 14,
    paddingVertical: 11,
    marginRight: 8,
    borderRadius: 10,
    backgroundColor: '#1B1B1B',
  },

  seasonActive: {
    backgroundColor: COLORS.white,
  },

  seasonText: {
    color: '#BBBBBB',
    fontSize: 14,
    fontWeight: '600',
  },

  seasonTextActive: {
    color: '#000000',
  },

  episodeCount: {
    color: '#777777',
    fontSize: 11,
    marginTop: 4,
  },

  episodeCountActive: {
    color: '#555555',
  },

  episode: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#202020',
  },

  episodeNumber: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1D1D1D',
  },

  episodeNumberText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '700',
  },

  episodeInfo: {
    flex: 1,
    marginLeft: 12,
    marginRight: 10,
  },

  episodeTitle: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: '600',
  },

  duration: {
    color: '#888888',
    fontSize: 11,
    marginTop: 4,
  },

  episodePlot: {
    color: '#777777',
    fontSize: 12,
    marginTop: 5,
    lineHeight: 17,
  },

  playButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
  },

  playButtonText: {
    color: COLORS.white,
    fontSize: 17,
    marginLeft: 2,
  },

  empty: {
    color: '#777777',
    fontSize: 14,
  },

  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 30,
  },

  loadingText: {
    color: COLORS.white,
    marginTop: 12,
  },

  error: {
    color: '#FF7777',
    textAlign: 'center',
    fontSize: 15,
  },

  backButton: {
    marginTop: 20,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: COLORS.white,
  },

  backButtonText: {
    color: '#000000',
    fontWeight: '600',
  },
});
