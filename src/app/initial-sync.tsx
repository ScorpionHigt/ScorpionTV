import React, { useEffect, useMemo, useState } from 'react';

import {
  ActivityIndicator,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { router } from 'expo-router';

import {
  InitialCatalogSyncState,
  INITIAL_CATALOG_SYNC_STATE,
  runInitialCatalogSync,
} from '../services/initialCatalogSync';

type CatalogRowProps = {
  icon: string;
  title: string;
  state: InitialCatalogSyncState['live'];
};

function CatalogRow({
  icon,
  title,
  state,
}: CatalogRowProps) {
  const percentage = useMemo(() => {
    if (state.status === 'completed') {
      return 100;
    }

    if (!state.total || state.total <= 0) {
      return 0;
    }

    return Math.min(
      100,
      Math.round((state.current / state.total) * 100),
    );
  }, [state]);

  const isCompleted = state.status === 'completed';
  const isError = state.status === 'error';
  const isActive =
    state.status === 'loading' ||
    state.status === 'syncing';

  return (
    <View style={styles.catalogCard}>
      <View style={styles.catalogHeader}>
        <View style={styles.catalogTitleContainer}>
          <Text style={styles.catalogIcon}>{icon}</Text>

          <View style={styles.catalogTextContainer}>
            <Text style={styles.catalogTitle}>
              {title}
            </Text>

            <Text style={styles.catalogPhase}>
              {state.phase}
            </Text>
          </View>
        </View>

        {isCompleted && (
          <Text style={styles.completedIcon}>✓</Text>
        )}

        {isActive && (
          <ActivityIndicator
            size="small"
            color="#E50914"
          />
        )}

        {isError && (
          <Text style={styles.errorIcon}>!</Text>
        )}
      </View>

      <View style={styles.progressBackground}>
        <View
          style={[
            styles.progressFill,
            {
              width: `${percentage}%`,
            },
          ]}
        />
      </View>

      <View style={styles.progressInfo}>
        {state.total > 0 ? (
          <Text style={styles.progressText}>
            {state.current.toLocaleString('fr-FR')} /{' '}
            {state.total.toLocaleString('fr-FR')}
          </Text>
        ) : (
          <Text style={styles.progressText}>
            Préparation...
          </Text>
        )}

        <Text style={styles.percentageText}>
          {percentage} %
        </Text>
      </View>

      {state.error && (
        <Text style={styles.errorText}>
          {state.error}
        </Text>
      )}
    </View>
  );
}

export default function InitialSyncScreen() {
  const [syncState, setSyncState] =
    useState<InitialCatalogSyncState>(
      INITIAL_CATALOG_SYNC_STATE,
    );

  const [error, setError] = useState<string | null>(
    null,
  );

  const globalProgress = useMemo(() => {
    const catalogs = [
      syncState.live,
      syncState.movies,
      syncState.series,
    ];

    const completed = catalogs.filter(
      (catalog) => catalog.status === 'completed',
    ).length;

    if (completed === 3) {
      return 100;
    }

    /**
     * On calcule la progression à partir des éléments
     * réellement traités.
     *
     * Les catalogues dont le total est encore inconnu
     * ne sont pas artificiellement considérés comme à 0 %.
     */
    let knownCurrent = 0;
    let knownTotal = 0;

    for (const catalog of catalogs) {
      if (catalog.total > 0) {
        knownCurrent += Math.min(
          catalog.current,
          catalog.total,
        );

        knownTotal += catalog.total;
      }
    }

    if (knownTotal <= 0) {
      return 0;
    }

    return Math.min(
      100,
      Math.round(
        (knownCurrent / knownTotal) * 100,
      ),
    );
  }, [syncState]);

  useEffect(() => {
    let mounted = true;

    async function startSynchronization() {
      console.log(
        '🚀 Écran InitialSync — démarrage',
      );

      try {
        setError(null);

        await runInitialCatalogSync((state) => {
          if (!mounted) {
            return;
          }

          setSyncState(state);
        });

        if (!mounted) {
          return;
        }

        console.log(
          '✅ InitialSync — tous les catalogues sont prêts',
        );

        /**
         * Petit délai pour laisser l'utilisateur voir
         * les 100 % avant de retourner à l'accueil.
         */
        setTimeout(() => {
          if (!mounted) {
            return;
          }

          router.replace('/');
        }, 700);
      } catch (syncError) {
        if (!mounted) {
          return;
        }

        console.error(
          '❌ InitialSync — erreur globale :',
          syncError,
        );

        const message =
          syncError instanceof Error
            ? syncError.message
            : 'La synchronisation a échoué.';

        setError(message);
      }
    }

    startSynchronization();

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.logo}>
          SCORPION
        </Text>

        <Text style={styles.logoSubtitle}>
          TV
        </Text>

        <Text style={styles.title}>
          Préparation du catalogue
        </Text>

        <Text style={styles.subtitle}>
          Nous préparons vos contenus pour une
          utilisation plus rapide de l'application.
        </Text>

        <View style={styles.globalProgressContainer}>
          <View style={styles.globalProgressHeader}>
            <Text style={styles.globalProgressLabel}>
              Progression globale
            </Text>

            <Text style={styles.globalProgressValue}>
              {globalProgress} %
            </Text>
          </View>

          <View style={styles.globalProgressBackground}>
            <View
              style={[
                styles.globalProgressFill,
                {
                  width: `${globalProgress}%`,
                },
              ]}
            />
          </View>
        </View>

        <View style={styles.catalogs}>
          <CatalogRow
            icon="📺"
            title="Live TV"
            state={syncState.live}
          />

          <CatalogRow
            icon="🎬"
            title="Films"
            state={syncState.movies}
          />

          <CatalogRow
            icon="📚"
            title="Séries"
            state={syncState.series}
          />
        </View>

        {error ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorTitle}>
              Synchronisation interrompue
            </Text>

            <Text style={styles.errorMessage}>
              {error}
            </Text>

            <Text style={styles.errorHint}>
              Relancez l'application pour réessayer.
            </Text>
          </View>
        ) : (
          <View style={styles.warningContainer}>
            <ActivityIndicator
              size="small"
              color="#E50914"
            />

            <Text style={styles.warningText}>
              Ne fermez pas l'application pendant la
              préparation.
            </Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#080808',
  },

  content: {
    flex: 1,
    paddingHorizontal: 22,
    justifyContent: 'center',
  },

  logo: {
    color: '#E50914',
    fontSize: 34,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: 4,
  },

  logoSubtitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: 5,
    marginTop: -4,
  },

  title: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
    marginTop: 36,
  },

  subtitle: {
    color: '#999999',
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    marginTop: 10,
    marginBottom: 28,
  },

  globalProgressContainer: {
    marginBottom: 22,
  },

  globalProgressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },

  globalProgressLabel: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },

  globalProgressValue: {
    color: '#E50914',
    fontSize: 15,
    fontWeight: '800',
  },

  globalProgressBackground: {
    height: 8,
    backgroundColor: '#252525',
    borderRadius: 5,
    overflow: 'hidden',
  },

  globalProgressFill: {
    height: '100%',
    backgroundColor: '#E50914',
    borderRadius: 5,
  },

  catalogs: {
    gap: 12,
  },

  catalogCard: {
    backgroundColor: '#121212',
    borderRadius: 12,
    padding: 15,
    borderWidth: 1,
    borderColor: '#202020',
  },

  catalogHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  catalogTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },

  catalogIcon: {
    fontSize: 24,
    marginRight: 12,
  },

  catalogTextContainer: {
    flex: 1,
  },

  catalogTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },

  catalogPhase: {
    color: '#888888',
    fontSize: 12,
    marginTop: 3,
  },

  completedIcon: {
    color: '#32CD32',
    fontSize: 24,
    fontWeight: '900',
  },

  errorIcon: {
    color: '#E50914',
    fontSize: 22,
    fontWeight: '900',
  },

  progressBackground: {
    height: 5,
    backgroundColor: '#252525',
    borderRadius: 4,
    overflow: 'hidden',
    marginTop: 13,
  },

  progressFill: {
    height: '100%',
    backgroundColor: '#E50914',
    borderRadius: 4,
  },

  progressInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 7,
  },

  progressText: {
    color: '#777777',
    fontSize: 11,
  },

  percentageText: {
    color: '#BBBBBB',
    fontSize: 11,
    fontWeight: '700',
  },

  errorText: {
    color: '#E50914',
    fontSize: 11,
    marginTop: 8,
  },

  warningContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    marginTop: 25,
  },

  warningText: {
    color: '#777777',
    fontSize: 12,
  },

  errorContainer: {
    marginTop: 25,
    padding: 14,
    borderRadius: 10,
    backgroundColor: '#1A0A0A',
    borderWidth: 1,
    borderColor: '#4A1515',
  },

  errorTitle: {
    color: '#E50914',
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
  },

  errorMessage: {
    color: '#CCCCCC',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 6,
  },

  errorHint: {
    color: '#777777',
    fontSize: 11,
    textAlign: 'center',
    marginTop: 8,
  },
});