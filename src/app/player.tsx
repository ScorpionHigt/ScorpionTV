import {
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';

import {
  router,
  useLocalSearchParams,
} from 'expo-router';

import {
  VideoView,
  useVideoPlayer,
} from 'expo-video';

import {
  getNextChannel,
  getPreviousChannel,
} from '../store/liveZappingStore';

import {
  XtreamClient,
} from '../api/xtreamClient';

import {
  getUserAccess,
} from '../api/accessApi';

export default function PlayerScreen() {
  const {
    url,
    title,
  } =
    useLocalSearchParams<{
      url: string;
      title: string;
    }>();

  const videoUrl =
    Array.isArray(url)
      ? url[0]
      : url;

  const initialTitle =
    Array.isArray(title)
      ? title[0]
      : title;

  const [status, setStatus] =
    useState('loading');

  const [isReconnecting, setIsReconnecting] =
    useState(false);

  const [retryCount, setRetryCount] =
    useState(0);

  const [currentUrl, setCurrentUrl] =
    useState(videoUrl);

  const [currentTitle, setCurrentTitle] =
    useState(initialTitle);

  const retryTimerRef =
    useRef<ReturnType<typeof setTimeout> | null>(
      null
    );

  const retryCountRef =
    useRef(0);

  const reconnectAttemptRunningRef =
    useRef(false);

  const mountedRef =
    useRef(true);

  const hasPlayedRef =
    useRef(false);

  const currentUrlRef =
    useRef(videoUrl);

  console.log(
    'URL INITIALE :',
    currentUrl
  );

  const player =
    useVideoPlayer(
      currentUrl || '',
      (player) => {
        player.loop = false;
      }
    );

  /* --------------------------------------------------
   * NETTOYAGE
   * -------------------------------------------------- */

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;

      if (
        retryTimerRef.current
      ) {
        clearTimeout(
          retryTimerRef.current
        );

        retryTimerRef.current = null;
      }
    };
  }, []);

  /* --------------------------------------------------
   * CHANGEMENT DE CHAÎNE
   * -------------------------------------------------- */

  const changeChannel = async (
    direction:
      | 'previous'
      | 'next'
  ) => {
    const channel =
      direction === 'next'
        ? getNextChannel()
        : getPreviousChannel();

    if (!channel) {
      console.log(
        'AUCUNE CHAÎNE DISPONIBLE :',
        direction
      );

      return;
    }

    try {
      /*
       * Récupération de la configuration
       * Xtream depuis le backend.
       */
      const access =
        await getUserAccess();

      if (
        !access.subscription
      ) {
        console.log(
          'ZAPPING IMPOSSIBLE : AUCUN ABONNEMENT'
        );

        return;
      }

      if (
        !access.xtream
      ) {
        console.log(
          'ZAPPING IMPOSSIBLE : SERVEUR XTREAM ABSENT'
        );

        return;
      }

      const client =
        new XtreamClient({
          server:
            access.xtream.server_url,

          username:
            access.xtream.username,

          password:
            access.xtream.password,
        });

      const newUrl =
        channel.direct_source ||
        client.getLiveStreamUrl(
          channel.stream_id
        );

      setCurrentUrl(
        newUrl
      );

      currentUrlRef.current =
        newUrl;

      setCurrentTitle(
        channel.name
      );

      retryCountRef.current = 0;

      setRetryCount(0);

      setIsReconnecting(
        false
      );

      hasPlayedRef.current =
        false;

      reconnectAttemptRunningRef.current =
        false;

      if (
        retryTimerRef.current
      ) {
        clearTimeout(
          retryTimerRef.current
        );

        retryTimerRef.current =
          null;
      }

      console.log(
        'ZAPPING CHAÎNE :',
        channel.name
      );

      console.log(
        'ZAPPING URL :',
        newUrl
      );

      await player.replaceAsync(
        newUrl
      );

      if (
        !mountedRef.current
      ) {
        return;
      }

      player.play();

    } catch (error) {
      console.error(
        'ERREUR ZAPPING :',
        error
      );
    }
  };

  /* --------------------------------------------------
   * RECONNEXION AUTOMATIQUE
   * -------------------------------------------------- */

  const scheduleReconnect =
    () => {
      if (
        !mountedRef.current ||
        !currentUrlRef.current
      ) {
        return;
      }

      if (
        retryTimerRef.current
      ) {
        return;
      }

      if (
        reconnectAttemptRunningRef.current
      ) {
        return;
      }

      setIsReconnecting(
        true
      );

      const delays = [
        2000,
        4000,
        6000,
        10000,
        15000,
      ];

      const retryIndex =
        Math.min(
          retryCountRef.current,
          delays.length - 1
        );

      const delay =
        delays[retryIndex];

      const nextAttempt =
        retryCountRef.current +
        1;

      console.log(
        `RECONNEXION DANS ${
          delay / 1000
        }s — TENTATIVE ${nextAttempt}`
      );

      retryTimerRef.current =
        setTimeout(
          async () => {
            retryTimerRef.current =
              null;

            if (
              !mountedRef.current ||
              !currentUrlRef.current
            ) {
              return;
            }

            reconnectAttemptRunningRef.current =
              true;

            retryCountRef.current =
              nextAttempt;

            setRetryCount(
              nextAttempt
            );

            console.log(
              `TENTATIVE DE RECONNEXION ${nextAttempt}`
            );

            try {
              await player.replaceAsync(
                currentUrlRef.current
              );

              if (
                !mountedRef.current
              ) {
                return;
              }

              player.play();

              console.log(
                'RECONNEXION — LECTURE DEMANDÉE'
              );

            } catch (error) {
              console.error(
                'ERREUR RECONNEXION :',
                error
              );

              reconnectAttemptRunningRef.current =
                false;

              scheduleReconnect();

              return;
            }

            reconnectAttemptRunningRef.current =
              false;
          },
          delay
        );
    };

  /* --------------------------------------------------
   * ÉTAT DU LECTEUR
   * -------------------------------------------------- */

  useEffect(() => {
    if (!videoUrl) {
      return;
    }

    const subscription =
      player.addListener(
        'statusChange',
        (event) => {
          if (
            !mountedRef.current
          ) {
            return;
          }

          const newStatus =
            event.status;

          setStatus(
            newStatus
          );

          console.log(
            'STATUT VIDÉO :',
            newStatus
          );

          if (
            newStatus ===
            'readyToPlay'
          ) {
            hasPlayedRef.current =
              true;

            reconnectAttemptRunningRef.current =
              false;

            retryCountRef.current =
              0;

            setRetryCount(0);

            setIsReconnecting(
              false
            );

            if (
              retryTimerRef.current
            ) {
              clearTimeout(
                retryTimerRef.current
              );

              retryTimerRef.current =
                null;
            }

            player.play();

            return;
          }

          if (
            newStatus ===
            'error'
          ) {
            const message =
              event.error?.message ||
              'Erreur vidéo inconnue';

            console.error(
              'ERREUR VIDÉO :',
              message
            );

            reconnectAttemptRunningRef.current =
              false;

            scheduleReconnect();

            return;
          }

          if (
            newStatus ===
            'idle'
          ) {
            if (
              hasPlayedRef.current
            ) {
              reconnectAttemptRunningRef.current =
                false;

              scheduleReconnect();
            }
          }
        }
      );

    return () => {
      subscription.remove();

      if (
        retryTimerRef.current
      ) {
        clearTimeout(
          retryTimerRef.current
        );

        retryTimerRef.current =
          null;
      }
    };
  }, [
    player,
    videoUrl,
  ]);

  /* --------------------------------------------------
   * URL ABSENTE
   * -------------------------------------------------- */

  if (!videoUrl) {
    return (
      <SafeAreaView
        style={styles.container}
      >
        <View
          style={
            styles.errorContainer
          }
        >
          <Text
            style={styles.errorTitle}
          >
            Flux introuvable
          </Text>

          <Text
            style={styles.errorText}
          >
            L'URL de la chaîne vidéo
            est absente.
          </Text>

          <Pressable
            style={
              styles.backButtonError
            }
            onPress={() =>
              router.back()
            }
          >
            <Text
              style={
                styles.backButtonErrorText
              }
            >
              Retour
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  /* --------------------------------------------------
   * LECTEUR
   * -------------------------------------------------- */

  return (
    <SafeAreaView
      style={styles.container}
      edges={[
        'top',
        'bottom',
      ]}
    >
      <View
        style={styles.header}
      >
        <Pressable
          style={
            styles.backButton
          }
          onPress={() =>
            router.back()
          }
        >
          <Text
            style={styles.backText}
          >
            ‹ Retour
          </Text>
        </Pressable>

        <Text
          style={styles.title}
          numberOfLines={1}
        >
          {currentTitle ||
            'Lecture en direct'}
        </Text>
      </View>

      <View
        style={
          styles.videoContainer
        }
      >
        <VideoView
          player={player}
          style={styles.video}
          contentFit="contain"
          nativeControls
          fullscreenOptions={{
            enable: true,
          }}
        />

        {/* ------------------------------------------
            BARRE DE ZAPPING
            ------------------------------------------ */}

        <View
          style={
            styles.zappingBar
          }
        >
          <Pressable
            style={({ pressed }) => [
              styles.zappingButton,
              pressed &&
                styles.zappingButtonPressed,
            ]}
            onPress={() =>
              changeChannel(
                'previous'
              )
            }
          >
            <Text
              style={
                styles.zappingArrow
              }
            >
              ‹
            </Text>
          </Pressable>

          <View
            style={
              styles.channelInfo
            }
          >
            <Text
              style={
                styles.channelLabel
              }
            >
              CHAÎNE
            </Text>

            <Text
              style={
                styles.zappingTitle
              }
              numberOfLines={1}
            >
              {currentTitle ||
                'Lecture en direct'}
            </Text>
          </View>

          <Pressable
            style={({ pressed }) => [
              styles.zappingButton,
              pressed &&
                styles.zappingButtonPressed,
            ]}
            onPress={() =>
              changeChannel(
                'next'
              )
            }
          >
            <Text
              style={
                styles.zappingArrow
              }
            >
              ›
            </Text>
          </Pressable>
        </View>

        {isReconnecting && (
          <View
            style={
              styles.reconnectBadge
            }
          >
            <ActivityIndicator
              size="small"
              color="#FFB000"
            />

            <View
              style={
                styles.reconnectInfo
              }
            >
              <Text
                style={
                  styles.reconnectTitle
                }
              >
                Connexion instable
              </Text>

              <Text
                style={
                  styles.reconnectText
                }
              >
                Reconnexion automatique
                {' • '}
                tentative{' '}
                {retryCount}
              </Text>
            </View>
          </View>
        )}
      </View>

      <Text
        style={styles.statusText}
      >
        État : {status}
      </Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#080808',
  },

  header: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 15,
  },

  backButton: {
    alignSelf: 'flex-start',
    paddingVertical: 6,
    marginBottom: 8,
  },

  backText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },

  title: {
    color: '#FFFFFF',
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
    borderColor:
      'rgba(255,255,255,0.08)',
  },

  zappingButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#222222',
    borderWidth: 1,
    borderColor:
      'rgba(255,255,255,0.08)',
  },

  zappingButtonPressed: {
    backgroundColor: '#E50914',
    transform: [
      {
        scale: 0.94,
      },
    ],
  },

  zappingArrow: {
    color: '#FFFFFF',
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
    color: '#777777',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginBottom: 3,
  },

  zappingTitle: {
    color: '#FFFFFF',
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
    backgroundColor:
      'rgba(20,20,20,0.92)',
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
    color: '#FFFFFF',
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

  backButtonError: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#222222',
  },

  backButtonErrorText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});