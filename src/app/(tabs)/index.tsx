import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';

import {
  APP_NAME,
  APP_VERSION,
  APP_YEAR,
} from '../../constants/app';

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
        const token = await getAuthToken();

        console.log(
          'VÉRIFICATION TOKEN :',
          token
            ? 'TOKEN PRÉSENT'
            : 'AUCUN TOKEN',
        );

        /*
         * ------------------------------------------------
         * Aucun token
         * ------------------------------------------------
         */
        if (!token) {
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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: '#080808',
    justifyContent: 'center',
    alignItems: 'center',
  },

  loadingText: {
    color: '#777777',
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
    color: '#FFFFFF',
    fontSize: 30,
    fontWeight: '900',
    letterSpacing: 3,
  },

  subtitle: {
    color: '#E50914',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 5,
    marginTop: -4,
  },

  welcome: {
    color: '#FFFFFF',
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
    color: '#FFFFFF',
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
    color: '#E50914',
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