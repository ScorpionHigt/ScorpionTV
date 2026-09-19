import { router } from 'expo-router';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useCallback, useEffect, useState } from 'react';
import {
  APP_NAME,
  APP_VERSION,
  APP_YEAR,
} from '../../constants/app';
import NotificationBell from '../../components/NotificationBell';
import {
  getAuthUser,
  clearAuthSession,
  AuthUser,
} from '../../storage/authStorage';

import {
  getCurrentSubscription,
  Subscription,
} from '../../api/userSubscriptionApi';

const RED = '#E50914';

export default function ProfileScreen() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [subscription, setSubscription] =
    useState<Subscription | null>(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [subscriptionError, setSubscriptionError] =
    useState<string | null>(null);

  const loadProfile = useCallback(async () => {
    try {
      setSubscriptionError(null);

      const currentUser = await getAuthUser();

      if (!currentUser) {
        router.replace('/login');
        return;
      }

      setUser(currentUser);

      const response =
        await getCurrentSubscription(currentUser.id);

      setSubscription(
        response.active_subscription
      );
    } catch (error) {
      console.error(
        'ERREUR PROFIL :',
        error
      );

      setSubscriptionError(
        error instanceof Error
          ? error.message
          : 'Impossible de récupérer votre abonnement.'
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadProfile();
  };

  const handleLogout = async () => {
    try {
      await clearAuthSession();

      router.replace('/login');
    } catch (error) {
      console.error(
        'ERREUR DÉCONNEXION :',
        error
      );
    }
  };

  const formatDate = (date: string) => {
    const parsedDate = new Date(date);

    if (Number.isNaN(parsedDate.getTime())) {
      return date;
    }

    return parsedDate.toLocaleDateString(
      'fr-FR',
      {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      }
    );
  };

  const getRemainingDays = (endDate: string) => {
    const end = new Date(endDate).getTime();
    const now = Date.now();

    const difference = end - now;

    if (difference <= 0) {
      return 0;
    }

    return Math.ceil(
      difference / (1000 * 60 * 60 * 24)
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator
            size="large"
            color={RED}
          />

          <Text style={styles.loadingText}>
            Chargement du profil...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const username =
    user?.username ?? 'Utilisateur';

  const phone =
    user?.phone ?? 'Non renseigné';

  const email =
    user?.email ?? 'Non renseigné';

  const remainingDays = subscription
    ? getRemainingDays(subscription.end_date)
    : 0;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={RED}
          />
        }
      >
        {/* HEADER */}

        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View style={styles.headerSpacer} />

            <NotificationBell />
          </View>

          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              👤
            </Text>
          </View>

          <Text style={styles.title}>
            Mon profil
          </Text>

          <Text style={styles.username}>
            @{username}
          </Text>
        </View>

        {/* INFORMATIONS */}

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>
            Informations personnelles
          </Text>

          <View style={styles.infoRow}>
            <View style={styles.infoIcon}>
              <Text>👤</Text>
            </View>

            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>
                Nom d'utilisateur
              </Text>

              <Text style={styles.infoValue}>
                {username}
              </Text>
            </View>
          </View>

          <View style={styles.separator} />

          <View style={styles.infoRow}>
            <View style={styles.infoIcon}>
              <Text>📱</Text>
            </View>

            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>
                Téléphone
              </Text>

              <Text style={styles.infoValue}>
                {phone}
              </Text>
            </View>
          </View>

          <View style={styles.separator} />

          <View style={styles.infoRow}>
            <View style={styles.infoIcon}>
              <Text>✉️</Text>
            </View>

            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>
                Email
              </Text>

              <Text style={styles.infoValue}>
                {email}
              </Text>
            </View>
          </View>
        </View>

        {/* ABONNEMENT ACTUEL */}

        <View style={styles.card}>
          <View style={styles.subscriptionHeader}>
            <Text style={styles.sectionTitle}>
              Mon abonnement
            </Text>

            {subscription && (
              <View style={styles.activeBadge}>
                <Text style={styles.activeBadgeText}>
                  ACTIF
                </Text>
              </View>
            )}
          </View>

          {subscriptionError ? (
            <View style={styles.subscriptionMessage}>
              <Text style={styles.errorText}>
                {subscriptionError}
              </Text>

              <Pressable
                style={styles.retryButton}
                onPress={loadProfile}
              >
                <Text style={styles.retryText}>
                  Réessayer
                </Text>
              </Pressable>
            </View>
          ) : subscription ? (
            <>
              <View style={styles.planBox}>
                <View style={styles.planIcon}>
                  <Text style={styles.planIconText}>
                    👑
                  </Text>
                </View>

                <View style={styles.planContent}>
                  <Text style={styles.planName}>
                    {subscription.plan_name ??
                      subscription.subscription_type}
                  </Text>

                  <Text style={styles.planType}>
                    {subscription.subscription_type}
                  </Text>
                </View>
              </View>

              <View style={styles.subscriptionSeparator} />

              <View style={styles.subscriptionRow}>
                <Text style={styles.subscriptionLabel}>
                  Début
                </Text>

                <Text style={styles.subscriptionValue}>
                  {formatDate(
                    subscription.start_date
                  )}
                </Text>
              </View>

              <View style={styles.subscriptionRow}>
                <Text style={styles.subscriptionLabel}>
                  Expiration
                </Text>

                <Text style={styles.subscriptionValue}>
                  {formatDate(
                    subscription.end_date
                  )}
                </Text>
              </View>

              <View style={styles.subscriptionRow}>
                <Text style={styles.subscriptionLabel}>
                  Temps restant
                </Text>

                <Text
                  style={[
                    styles.subscriptionValue,
                    remainingDays <= 5 &&
                      styles.warningValue,
                  ]}
                >
                  {remainingDays} jour
                  {remainingDays > 1
                    ? 's'
                    : ''}
                </Text>
              </View>

              <View style={styles.subscriptionRow}>
                <Text style={styles.subscriptionLabel}>
                  Prix
                </Text>

                <Text style={styles.subscriptionValue}>
                  {subscription.price.toLocaleString(
                    'fr-FR'
                  )}{' '}
                  {subscription.currency ??
                    'FCFA'}
                </Text>
              </View>

              <Pressable
                style={styles.subscriptionButton}
                onPress={() =>
                  router.push(
                    '/subscription'
                  )
                }
              >
                <Text
                  style={
                    styles.subscriptionButtonText
                  }
                >
                  Gérer mon abonnement
                </Text>
              </Pressable>
            </>
          ) : (
            <View style={styles.subscriptionMessage}>
              <Text style={styles.noSubscriptionIcon}>
                📦
              </Text>

              <Text style={styles.noSubscriptionTitle}>
                Aucun abonnement actif
              </Text>

              <Text
                style={
                  styles.noSubscriptionText
                }
              >
                Vous n'avez actuellement aucun
                abonnement actif.
              </Text>

              <Pressable
                style={styles.subscriptionButton}
                onPress={() =>
                  router.push(
                    '/subscription'
                  )
                }
              >
                <Text
                  style={
                    styles.subscriptionButtonText
                  }
                >
                  Voir les offres
                </Text>
              </Pressable>
            </View>
          )}
        </View>

        {/* MON ESPACE */}

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>
            Mon espace
          </Text>

          <Pressable
            style={styles.menuItem}
            onPress={() =>
              router.push('/subscription')
            }
          >
            <View style={styles.menuIcon}>
              <Text>📦</Text>
            </View>

            <View style={styles.menuContent}>
              <Text style={styles.menuTitle}>
                Mon abonnement
              </Text>

              <Text
                style={styles.menuDescription}
              >
                Consulte ton abonnement actuel
              </Text>
            </View>

            <Text style={styles.arrow}>
              ›
            </Text>
          </Pressable>

          <View style={styles.separator} />

          <Pressable
              style={styles.menuItem}
              onPress={() => router.push('/orders')}
          >
            <View style={styles.menuIcon}>
              <Text>🧾</Text>
            </View>

            <View style={styles.menuContent}>
              <Text style={styles.menuTitle}>
                Mes commandes
              </Text>

              <Text
                style={styles.menuDescription}
              >
                Historique de tes commandes
              </Text>
            </View>

            <Text style={styles.arrow}>
              ›
            </Text>
          </Pressable>

          <View style={styles.separator} />

          <Pressable
            style={styles.menuItem}
            onPress={() =>
              router.push('/notifications')
            }
          >
            <View style={styles.menuIcon}>
              <Text>🔔</Text>
            </View>

            <View style={styles.menuContent}>
              <Text style={styles.menuTitle}>
                Notifications
              </Text>

              <Text
                style={styles.menuDescription}
              >
                Tes messages et alertes
              </Text>
            </View>

            <Text style={styles.arrow}>
              ›
            </Text>
          </Pressable>

          <View style={styles.separator} />

          <Pressable style={styles.menuItem}>
            <View style={styles.menuIcon}>
              <Text>⚙️</Text>
            </View>

            <View style={styles.menuContent}>
              <Text style={styles.menuTitle}>
                Paramètres
              </Text>

              <Text
                style={styles.menuDescription}
              >
                Gérer les paramètres du compte
              </Text>
            </View>

            <Text style={styles.arrow}>
              ›
            </Text>
          </Pressable>
        </View>

        {/* DÉCONNEXION */}

        <Pressable
          style={styles.logoutButton}
          onPress={handleLogout}
        >
          <Text style={styles.logoutButtonText}>
            Se déconnecter
          </Text>
        </Pressable>

        <Text style={styles.version}>
          {APP_NAME} • v{APP_VERSION} © {APP_YEAR}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#080808',
  },

  scrollView: {
    flex: 1,
  },

  content: {
    paddingHorizontal: 20,
    paddingTop: 15,
    paddingBottom: 40,
  },

  header: {
    alignItems: 'center',
    marginBottom: 25,
  },

  headerTop: {
    width: '100%',
    height: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },

  headerSpacer: {
    width: 46,
    height: 46,
  },

  avatar: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#151515',
    borderWidth: 2,
    borderColor: RED,
    alignItems: 'center',
    justifyContent: 'center',
  },

  avatarText: {
    fontSize: 42,
  },

  title: {
    color: '#FFFFFF',
    fontSize: 27,
    fontWeight: '800',
    marginTop: 14,
  },

  username: {
    color: '#777777',
    fontSize: 14,
    marginTop: 5,
  },

  card: {
    backgroundColor: '#151515',
    borderRadius: 18,
    padding: 18,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },

  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 15,
  },

  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  infoIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#0D0D0D',
    alignItems: 'center',
    justifyContent: 'center',
  },

  infoContent: {
    flex: 1,
    marginLeft: 12,
  },

  infoLabel: {
    color: '#777777',
    fontSize: 12,
  },

  infoValue: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
    marginTop: 3,
  },

  separator: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.07)',
    marginVertical: 14,
  },

  subscriptionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  activeBadge: {
    backgroundColor: 'rgba(46, 204, 113, 0.15)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginBottom: 15,
  },

  activeBadgeText: {
    color: '#2ECC71',
    fontSize: 10,
    fontWeight: '800',
  },

  planBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0D0D0D',
    borderRadius: 14,
    padding: 14,
  },

  planIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#181818',
    alignItems: 'center',
    justifyContent: 'center',
  },

  planIconText: {
    fontSize: 26,
  },

  planContent: {
    flex: 1,
    marginLeft: 12,
  },

  planName: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },

  planType: {
    color: '#777777',
    fontSize: 12,
    marginTop: 3,
  },

  subscriptionSeparator: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.07)',
    marginVertical: 15,
  },

  subscriptionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 11,
  },

  subscriptionLabel: {
    color: '#777777',
    fontSize: 13,
  },

  subscriptionValue: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },

  warningValue: {
    color: RED,
  },

  subscriptionButton: {
    height: 46,
    borderRadius: 12,
    backgroundColor: RED,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },

  subscriptionButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },

  subscriptionMessage: {
    alignItems: 'center',
    paddingVertical: 8,
  },

  errorText: {
    color: '#AAAAAA',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
  },

  retryButton: {
    marginTop: 12,
    paddingHorizontal: 20,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: RED,
  },

  retryText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },

  noSubscriptionIcon: {
    fontSize: 32,
    marginBottom: 8,
  },

  noSubscriptionTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },

  noSubscriptionText: {
    color: '#777777',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
    marginTop: 5,
    marginBottom: 12,
  },

  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  menuIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#0D0D0D',
    alignItems: 'center',
    justifyContent: 'center',
  },

  menuContent: {
    flex: 1,
    marginLeft: 12,
  },

  menuTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },

  menuDescription: {
    color: '#777777',
    fontSize: 12,
    marginTop: 3,
  },

  arrow: {
    color: '#777777',
    fontSize: 28,
    marginLeft: 10,
  },

  logoutButton: {
    backgroundColor: '#151515',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(229,9,20,0.5)',
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 2,
  },

  logoutButtonText: {
    color: RED,
    fontSize: 16,
    fontWeight: '800',
  },

  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  loadingText: {
    color: '#777777',
    fontSize: 14,
    marginTop: 15,
  },

  version: {
    color: '#555555',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 20,
  },
});
