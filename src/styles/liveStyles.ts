import { StyleSheet } from 'react-native';

import { COLORS } from './colors';

export const liveStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
  },

  backButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#1A1A1A',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },

  backButtonText: {
    color: COLORS.white,
    fontSize: 34,
    lineHeight: 38,
    marginTop: -4,
  },

  headerTitleContainer: {
    flex: 1,
  },

  title: {
    color: COLORS.white,
    fontSize: 24,
    fontWeight: '700',
  },

  subtitle: {
    color: '#888888',
    fontSize: 13,
    marginTop: 2,
  },

  categorySection: {
    borderBottomWidth: 1,
    borderBottomColor: '#202020',
    marginBottom: 8,
  },

  categoryList: {
    paddingHorizontal: 12,
    paddingVertical: 10,
  },

  categoryItem: {
    backgroundColor: '#181818',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 9,
    marginHorizontal: 4,
    maxWidth: 180,
  },

  categoryItemActive: {
    backgroundColor: COLORS.primary,
  },

  categoryText: {
    color: '#BBBBBB',
    fontSize: 13,
    fontWeight: '600',
  },

  categoryTextActive: {
    color: COLORS.white,
  },

  channelsList: {
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 30,
  },

  columnWrapper: {
    justifyContent: 'space-between',
  },

  channelCard: {
    width: '31.5%',
    backgroundColor: '#151515',
    borderRadius: 10,
    marginBottom: 12,
    padding: 8,
    alignItems: 'center',
  },

  channelCardPressed: {
    opacity: 0.7,
  },

  logoContainer: {
    width: '100%',
    height: 75,
    borderRadius: 7,
    backgroundColor: '#0F0F0F',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },

  channelLogo: {
    width: '90%',
    height: '90%',
  },

  defaultLogo: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#222222',
    alignItems: 'center',
    justifyContent: 'center',
  },

  defaultLogoText: {
    color: '#777777',
    fontSize: 14,
    fontWeight: '700',
  },

  channelName: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 8,
    minHeight: 30,
  },

  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  loadingTitle: {
    color: COLORS.white,
    fontSize: 18,
    fontWeight: '700',
    marginTop: 18,
    textAlign: 'center',
  },

  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 30,
  },

  emptyIcon: {
    fontSize: 42,
    marginBottom: 12,
  },

  emptyTitle: {
    color: COLORS.white,
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },

  emptyText: {
    color: '#777777',
    fontSize: 13,
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 19,
  },

  subscriptionButton: {
    height: 46,
    paddingHorizontal: 22,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
  },

  subscriptionButtonText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '800',
  },

  syncContainer: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#111111',
    borderBottomWidth: 1,
    borderBottomColor: '#202020',
  },

  syncHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 7,
  },

  syncTitle: {
    color: COLORS.white,
    fontSize: 13,
    fontWeight: '600',
  },

  syncPercent: {
    color: COLORS.primary,
    fontSize: 13,
    fontWeight: '700',
  },

  progressBackground: {
    height: 6,
    width: '100%',
    backgroundColor: '#292929',
    borderRadius: 3,
    overflow: 'hidden',
  },

  progressBar: {
    height: '100%',
    backgroundColor: COLORS.primary,
    borderRadius: 3,
  },

  syncDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
  },

  syncCount: {
    color: '#888888',
    fontSize: 11,
  },

  syncPhase: {
    color: '#666666',
    fontSize: 11,
  },

  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 8,
    paddingHorizontal: 12,
    height: 46,
    backgroundColor: '#181818',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#252525',
  },

  searchInput: {
    flex: 1,
    color: COLORS.white,
    fontSize: 14,
    paddingVertical: 0,
  },

  clearSearch: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },

  clearSearchText: {
    color: '#888888',
    fontSize: 25,
    lineHeight: 28,
  },

  /*
   * ==========================================================
   * MODALE MOT DE PASSE ADULTE
   * ==========================================================
   */

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.78)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 22,
  },

  passwordModal: {
    width: '100%',
    maxWidth: 390,
    backgroundColor: '#151515',
    borderRadius: 20,
    padding: 22,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },

  passwordModalIcon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: '#0D0D0D',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 14,
  },

  passwordModalIconText: {
    fontSize: 27,
  },

  passwordModalTitle: {
    color: COLORS.white,
    fontSize: 21,
    fontWeight: '800',
    textAlign: 'center',
  },

  passwordModalDescription: {
    color: '#888888',
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 18,
  },

  passwordModalInputContainer: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0D0D0D',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.09)',
    borderRadius: 12,
  },

  passwordModalInput: {
    flex: 1,
    color: COLORS.white,
    fontSize: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },

  passwordEyeButton: {
    width: 46,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },

  passwordEyeText: {
    fontSize: 18,
  },

  passwordError: {
    color: '#FF5A60',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 8,
    marginLeft: 2,
  },

  passwordSubmitButton: {
    height: 48,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
  },

  passwordSubmitButtonDisabled: {
    opacity: 0.6,
  },

  passwordSubmitText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '800',
  },

  passwordLoadingContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },

  passwordLoadingText: {
    marginLeft: 9,
  },

  passwordCancelButton: {
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },

  passwordCancelText: {
    color: '#888888',
    fontSize: 13,
    fontWeight: '600',
  },
});