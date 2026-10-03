import { StyleSheet } from 'react-native';

import { COLORS } from './colors';

export const playerStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  header: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 15,
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


  title: {
    color: COLORS.white,
    fontSize: 20,
    fontWeight: '800',
  },

  videoContainer: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: '#000000',
    position: 'relative',
  },

  video: {
    width: '100%',
    height: '100%',
  },

  /* --------------------------------------------------
     BARRE DE ZAPPING
     -------------------------------------------------- */

  zappingBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 12,
    marginTop: 10,
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: '#151515',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },

  zappingButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#222222',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },

  zappingButtonPressed: {
    backgroundColor: COLORS.primary,
    transform: [
      {
        scale: 0.94,
      },
    ],
  },

  zappingArrow: {
    color: COLORS.white,
    fontSize: 34,
    lineHeight: 38,
    fontWeight: '300',
    marginTop: -3,
  },

  channelInfo: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 12,
  },

  channelLabel: {
    color: COLORS.textMuted,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginBottom: 3,
  },

  zappingTitle: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },

  /* --------------------------------------------------
     RECONNEXION
     -------------------------------------------------- */

  reconnectBadge: {
    position: 'absolute',
    left: 15,
    right: 15,
    bottom: 15,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(20,20,20,0.92)',
  },

  reconnectInfo: {
    marginLeft: 10,
  },

  reconnectTitle: {
    color: '#FFB000',
    fontSize: 14,
    fontWeight: '700',
  },

  reconnectText: {
    color: '#AAAAAA',
    fontSize: 12,
    marginTop: 2,
  },

  statusText: {
    color: '#666666',
    fontSize: 12,
    paddingHorizontal: 20,
    paddingTop: 10,
  },

  /* --------------------------------------------------
     ERREUR
     -------------------------------------------------- */

  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 30,
  },

  errorTitle: {
    color: COLORS.white,
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 10,
  },

  errorText: {
    color: '#888888',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 25,
  },
});
