import {
  ActivityIndicator,
  Pressable,
  Text,
  View,
  ScrollView,
} from 'react-native';
import { registerFCMToken } from '../../api/authApi';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { homeStyles as styles } from '../../styles/homeStyles';
import {
  registerForPushNotificationsAsync,
} from '../../services/notifications';
import {
  APP_NAME,
  APP_VERSION,
  APP_YEAR,
} from '../../constants/app';
import UpdateModal from '../../components/UpdateModal';
import {
  checkForAppUpdate,
  downloadAppUpdate,
  installAppUpdate,
} from '../../services/appUpdater';
import {
  AppVersionResponse,
} from '../../api/appVersion';
import { initDatabase } from '../../database/database';

import { useDialog } from '../../components/dialogs/DialogProvider';

import {
  getUserAccess,
  UserAccessError,
} from '../../api/accessApi';

import {
  getAuthToken,
  clearAuthSession,
} from '../../storage/authStorage';

import {
  needsInitialCatalogSync,
} from '../../services/initialCatalogSync';

export default function HomeScreen() {
  const { showDialog } = useDialog();
  const [updateInfo, setUpdateInfo] =
    useState<AppVersionResponse | null>(null);

  const [updateModalVisible, setUpdateModalVisible] =
    useState(false);

  const [downloadingUpdate, setDownloadingUpdate] =
    useState(false);

  const [downloadProgress, setDownloadProgress] =
     useState(0);

  const [downloadedBytes, setDownloadedBytes] =
     useState(0);

  const [totalBytes, setTotalBytes] =
     useState(0);

  const [downloadedApkUri, setDownloadedApkUri] =
     useState<string | null>(null);

  const [checkingAccess, setCheckingAccess] =
    useState(true);

  const [catalogAccess, setCatalogAccess] =
    useState(false);

  const [accessChecked, setAccessChecked] =
    useState(false);

  /*
   * ------------------------------------------------------
   * Vérification de l'accès utilisateur
   * ------------------------------------------------------
   */
  const checkUserAccess = useCallback(
    async () => {
      try {
        setCheckingAccess(true);

        /*
         * ------------------------------------------------
         * Initialisation SQLite
         * ------------------------------------------------
         */
        await initDatabase();

        console.log(
          'SQLite ScorpionTV OK',
        );

        /*
         * ------------------------------------------------
         * Récupération du token
         * ------------------------------------------------
         */
         const fcmToken =
            await registerForPushNotificationsAsync();

            if (fcmToken) {
              console.log(
                'NOTIFICATIONS : token FCM récupéré.'
              );

              const registered =
                await registerFCMToken(fcmToken);

              if (registered) {
                console.log(
                  'NOTIFICATIONS : token FCM synchronisé avec le serveur.'
                );
              }
            }

        /*
         * ------------------------------------------------
         * Aucun token
         * ------------------------------------------------
         */
        if (!fcmToken) {
          console.log(
            'TOKEN ABSENT → REDIRECTION LOGIN',
          );

          await clearAuthSession();

          router.replace('/login');

          return;
        }

        /*
         * ------------------------------------------------
         * Vérification backend
         * ------------------------------------------------
         */
        const access =
          await getUserAccess();

        console.log(
          'USER ACCESS :',
          access,
        );

        /*
         * ------------------------------------------------
         * Aucun abonnement actif
         * ------------------------------------------------
         */
        if (!access.subscription) {
          console.log(
            'AUCUN ABONNEMENT ACTIF',
          );

          setCatalogAccess(false);
          setAccessChecked(true);

          showDialog({
            title: 'Aucun abonnement actif',
            message:
              'Vous n’avez actuellement aucun abonnement actif. Choisissez un abonnement pour accéder au catalogue ScorpionTV.',
            icon: '🔒',

            buttons: [
              {
                label: 'Plus tard',
                variant: 'secondary',

                onPress: () => {
                  console.log(
                    'ABONNEMENT REPORTÉ',
                  );
                },
              },

              {
                label: 'Voir les abonnements',
                variant: 'primary',

                onPress: () => {
                  console.log(
                    'OUVERTURE DES ABONNEMENTS',
                  );

                  router.push(
                    '/subscription',
                  );
                },
              },
            ],
          });

          return;
        }

        /*
         * ------------------------------------------------
         * Abonnement actif
         * ------------------------------------------------
         */
        console.log(
          'ABONNEMENT ACTIF :',
          access.subscription.name,
        );

        console.log(
          'LIMITE TV :',
          access.limits?.tv_channels,
        );

        console.log(
          'LIMITE FILMS :',
          access.limits?.movies,
        );

        console.log(
          'LIMITE SÉRIES :',
          access.limits?.series,
        );

        console.log(
          'ACCÈS ADULTE :',
          access.limits?.adult,
        );

        console.log(
          'SERVEUR XTREAM :',
          access.xtream?.server_url,
        );

        /*
         * ------------------------------------------------
         * Vérification de la synchronisation initiale
         * ------------------------------------------------
         */
        console.log(
          'VÉRIFICATION DE LA SYNCHRONISATION INITIALE...',
        );

        const initialSyncRequired =
          await needsInitialCatalogSync();

        console.log(
          'SYNCHRONISATION INITIALE NÉCESSAIRE :',
          initialSyncRequired,
        );

        /*
         * ------------------------------------------------
         * Accès catalogue validé
         * ------------------------------------------------
         */
        setCatalogAccess(true);
        setAccessChecked(true);

        /*
         * ------------------------------------------------
         * Première utilisation / catalogue incomplet
         * ------------------------------------------------
         */
        if (initialSyncRequired) {
          console.log(
            'CATALOGUE NON INITIALISÉ → /initial-sync',
          );

          router.replace('/initial-sync');

          return;
        }

        /*
         * ------------------------------------------------
         * Catalogue déjà initialisé
         * ------------------------------------------------
         */
        console.log(
          'CATALOGUE DÉJÀ INITIALISÉ → ACCUEIL',
        );
      } catch (error) {
        console.error(
          'ERREUR VÉRIFICATION ACCÈS :',
          error,
        );

        /*
         * ------------------------------------------------
         * Token invalide ou expiré
         * ------------------------------------------------
         */
        if (
          error instanceof UserAccessError &&
          (
            error.status === 401 ||
            error.status === 403
          )
        ) {
          console.log(
            'TOKEN INVALIDE OU EXPIRÉ → LOGIN',
          );

          await clearAuthSession();

          router.replace('/login');

          return;
        }
        /*
         * ------------------------------------------------
         * Erreur réseau / serveur
         *
         * On ne déconnecte PAS l'utilisateur.
         * ------------------------------------------------
         */
        setAccessChecked(true);

        showDialog({
          title: 'Connexion impossible',
          message:
            'Impossible de vérifier votre accès actuellement. Vérifiez votre connexion Internet puis réessayez.',
          icon: '⚠️',
        });
      } finally {
        setCheckingAccess(false);
      }
    },
    [showDialog],
  );
  /*
   * ------------------------------------------------------
   * Initialisation
   * ------------------------------------------------------
   */
   useEffect(() => {
  checkUserAccess();
}, [checkUserAccess]);

/* Vérification et inscription aux notifications push */
useEffect(() => {
  let mounted = true;

  const registerNotifications = async () => {
    console.log(
      'NOTIFICATIONS : enregistrement au démarrage de ScorpionTV...'
    );

    const fcmToken =
      await registerForPushNotificationsAsync();

    if (!mounted || !fcmToken) {
      return;
    }

    console.log(
      'NOTIFICATIONS : token FCM récupéré.'
    );

    const registered =
      await registerFCMToken(fcmToken);

    if (!mounted) {
      return;
    }

    if (registered) {
      console.log(
        'NOTIFICATIONS : token FCM synchronisé avec le serveur.'
      );
    }
  };

  void registerNotifications();

  return () => {
    mounted = false;
  };
}, []);

/* Vérification de mise à jour */
useEffect(() => {
  let mounted = true;

  const checkUpdate = async () => {
    console.log(
      'APP UPDATE : démarrage de la vérification...'
    );

    const result = await checkForAppUpdate();

    if (!mounted || !result) {
      return;
    }

    setUpdateInfo(result);
    setUpdateModalVisible(true);

    console.log(
      'APP UPDATE : fenêtre de mise à jour affichée.'
    );
  };

  void checkUpdate();

  return () => {
    mounted = false;
  };
}, []);
  /*
   * ------------------------------------------------------
   * M3U
   * ------------------------------------------------------
   */
  const handleM3U = () => {
    showDialog({
      title: 'M3U TV',
      message:
        'La prise en charge des listes M3U sera bientôt disponible.',
      icon: '📡',
    });
  };

  /*
   * ------------------------------------------------------
   * Accès catalogue
   * ------------------------------------------------------
   */
  const handleCatalogPress = (
    route:
      | '/live'
      | '/movies'
      | '/series',
  ) => {
    /*
     * La vérification n'est pas encore terminée.
     */
    if (!accessChecked) {
      return;
    }

    /*
     * Aucun abonnement.
     */
    if (!catalogAccess) {
      showDialog({
        title: 'Abonnement requis',
        message:
          'Un abonnement actif est nécessaire pour accéder au catalogue ScorpionTV.',
        icon: '🔒',

        buttons: [
          {
            label: 'Plus tard',
            variant: 'secondary',
          },

          {
            label: 'Voir les abonnements',
            variant: 'primary',

            onPress: () => {
              router.push(
                '/subscription',
              );
            },
          },
        ],
      });

      return;
    }

    /*
     * Abonnement actif.
     */
    router.push(route);
  };

  /*
   * ------------------------------------------------------
   * Écran de vérification
   * ------------------------------------------------------
   */
  if (checkingAccess) {
    return (
      <SafeAreaView
        style={styles.loadingContainer}
      >
        <ActivityIndicator
          size="large"
          color="#E50914"
        />

        <Text style={styles.loadingText}>
          Vérification de votre accès...
        </Text>
      </SafeAreaView>
    );
  }

  /*
   * ------------------------------------------------------
   * Accueil
   * ------------------------------------------------------
   */
  return (
    <ScrollView
      style={styles.scrollView}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Text style={styles.logo}>
            SCORPION
          </Text>

          <Text style={styles.subtitle}>
            TV
          </Text>
        </View>

        <View style={styles.content}>
          <Text style={styles.welcome}>
            Bienvenue
          </Text>

          <Text style={styles.description}>
            Retrouvez tous vos contenus au même endroit
          </Text>

          <View style={styles.menu}>
            <Pressable
              style={({ pressed }) => [
                styles.card,
                pressed && styles.cardPressed,
              ]}
              onPress={() =>
                handleCatalogPress('/live')
              }
            >
              <Text style={styles.icon}>
                📺
              </Text>

              <Text style={styles.cardTitle}>
                Live TV
              </Text>

              <Text style={styles.cardDescription}>
                Regardez vos chaînes en direct
              </Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.card,
                pressed && styles.cardPressed,
              ]}
              onPress={() =>
                handleCatalogPress('/movies')
              }
            >
              <Text style={styles.icon}>
                🎬
              </Text>

              <Text style={styles.cardTitle}>
                Films
              </Text>

              <Text style={styles.cardDescription}>
                Découvrez vos films préférés
              </Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.card,
                pressed && styles.cardPressed,
              ]}
              onPress={() =>
                handleCatalogPress('/series')
              }
            >
              <Text style={styles.icon}>
                🗂️
              </Text>

              <Text style={styles.cardTitle}>
                Séries
              </Text>

              <Text style={styles.cardDescription}>
                Retrouvez vos séries et épisodes
              </Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.card,
                styles.m3uCard,
                pressed && styles.cardPressed,
              ]}
              onPress={handleM3U}
            >
              <Text style={styles.icon}>
                📡
              </Text>

              <View style={styles.m3uTitleRow}>
                <Text style={styles.cardTitle}>
                  M3U TV
                </Text>

                <View style={styles.comingSoon}>
                  <Text
                    style={
                      styles.comingSoonText
                    }
                  >
                    BIENTÔT
                  </Text>
                </View>
              </View>

              <Text style={styles.cardDescription}>
                Ajoutez vos propres listes M3U
              </Text>
            </Pressable>
          </View>
        </View>

        <Text style={styles.email}>
          scorpionhigt@gmail.com
        </Text>

        <Text style={styles.version}>
          {APP_NAME} • v{APP_VERSION} © {APP_YEAR}
        </Text>
      </SafeAreaView>
            <UpdateModal
          visible={updateModalVisible}
          updateInfo={updateInfo}

          downloading={downloadingUpdate}
          downloaded={!!downloadedApkUri}

          downloadProgress={downloadProgress}
          downloadedBytes={downloadedBytes}
          totalBytes={totalBytes}

          onUpdate={() => {
            if (!updateInfo || downloadingUpdate) {
              return;
            }

            console.log(
              'APP UPDATE : téléchargement demandé.'
            );

            setDownloadingUpdate(true);
            setDownloadProgress(0);
            setDownloadedBytes(0);
            setTotalBytes(0);
            setDownloadedApkUri(null);

            void downloadAppUpdate(
              updateInfo,
              {
                onProgress: ({
                  progress,
                  downloadedBytes: currentDownloadedBytes,
                  totalBytes: currentTotalBytes,
                }) => {
                  setDownloadProgress(progress);

                  setDownloadedBytes(
                    currentDownloadedBytes,
                  );

                  setTotalBytes(
                    currentTotalBytes,
                  );
                },
              },
            ).then((uri) => {
              if (!uri) {
                console.log(
                  'APP UPDATE : téléchargement échoué.'
                );

                setDownloadingUpdate(false);

                return;
              }

              console.log(
                'APP UPDATE : APK prêt :',
                uri,
              );

              setDownloadedApkUri(uri);
              setDownloadingUpdate(false);
              setDownloadProgress(1);
            });
          }}

          onInstall={() => {
            if (!downloadedApkUri) {
              console.log(
                'APP UPDATE : aucun APK disponible pour installation.'
              );

              return;
            }

            console.log(
              'APP UPDATE : installation demandée.'
            );

            void installAppUpdate(
              downloadedApkUri,
            );
          }}

          onLater={() => {
            console.log(
              'APP UPDATE : utilisateur choisit Plus tard.'
            );

            setUpdateModalVisible(false);
          }}
        />
    </ScrollView>
  );
}
