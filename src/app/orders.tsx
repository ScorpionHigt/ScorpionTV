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
  getAuthUser,
} from '../storage/authStorage';

import {
  getOrderHistory,
  OrderHistoryItem,
} from '../api/orderHistoryApi';

const RED = '#E50914';

export default function OrdersScreen() {
  const [orders, setOrders] = useState<
    OrderHistoryItem[]
  >([]);

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  const loadOrders = useCallback(
    async () => {
      try {
        setError(null);

        const user = await getAuthUser();

        if (!user) {
          router.replace('/login');
          return;
        }

        const response =
          await getOrderHistory(user.id);

        setOrders(response.orders);
      } catch (error) {
        console.error(
          'ERREUR HISTORIQUE COMMANDES :',
          error
        );

        setError(
          error instanceof Error
            ? error.message
            : 'Impossible de récupérer vos commandes.'
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    []
  );

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadOrders();
  };

  const formatDate = (
    date: string
  ) => {
    const parsedDate =
      new Date(date);

    if (
      Number.isNaN(
        parsedDate.getTime()
      )
    ) {
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

  const formatPaymentMethod = (
    method: OrderHistoryItem['payment_method']
  ) => {
    switch (method) {
      case 'orange_money':
        return 'Orange Money';

      case 'moov_money':
        return 'Moov Money';

      case 'wave':
        return 'Wave';

      case 'card':
        return 'Carte bancaire';

      case 'free':
        return 'Free';

      default:
        return method;
    }
  };

  const getStatusLabel = (
    status: OrderHistoryItem['status']
  ) => {
    switch (status) {
      case 'paid':
        return 'Payée';

      case 'pending':
        return 'En attente';

      case 'failed':
        return 'Échec';

      case 'cancelled':
        return 'Annulée';

      case 'expired':
        return 'Expirée';

      default:
        return status;
    }
  };

  const getStatusStyle = (
    status: OrderHistoryItem['status']
  ) => {
    switch (status) {
      case 'paid':
        return styles.statusPaid;

      case 'pending':
        return styles.statusPending;

      case 'failed':
      case 'cancelled':
      case 'expired':
        return styles.statusFailed;

      default:
        return styles.statusDefault;
    }
  };

  if (loading) {
    return (
      <SafeAreaView
        style={styles.container}
      >
        <View
          style={
            styles.loadingContainer
          }
        >
          <ActivityIndicator
            size="large"
            color={RED}
          />

          <Text
            style={styles.loadingText}
          >
            Chargement des commandes...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={
          styles.content
        }
        showsVerticalScrollIndicator={
          false
        }
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
          <Pressable
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Text
              style={styles.backText}
            >
              ‹
            </Text>
          </Pressable>

          <View style={styles.headerTitleBox}>
            <Text
              style={styles.title}
            >
              Mes commandes
            </Text>

            <Text
              style={styles.subtitle}
            >
              Historique de vos achats
            </Text>
          </View>
        </View>

        {/* ERREUR */}

        {error && (
          <View style={styles.errorBox}>
            <Text
              style={styles.errorText}
            >
              {error}
            </Text>

            <Pressable
              style={styles.retryButton}
              onPress={loadOrders}
            >
              <Text
                style={styles.retryText}
              >
                Réessayer
              </Text>
            </Pressable>
          </View>
        )}

        {/* AUCUNE COMMANDE */}

        {!error &&
          orders.length === 0 && (
            <View
              style={
                styles.emptyBox
              }
            >
              <Text
                style={
                  styles.emptyIcon
                }
              >
                🧾
              </Text>

              <Text
                style={
                  styles.emptyTitle
                }
              >
                Aucune commande
              </Text>

              <Text
                style={
                  styles.emptyText
                }
              >
                Vous n'avez encore effectué
                aucun achat.
              </Text>

              <Pressable
                style={
                  styles.subscriptionButton
                }
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
                  Voir les abonnements
                </Text>
              </Pressable>
            </View>
          )}

        {/* COMMANDES */}

        {!error &&
          orders.map((order) => (
            <View
              key={order.id}
              style={styles.orderCard}
            >
              <View
                style={
                  styles.orderHeader
                }
              >
                <View>
                  <Text
                    style={
                      styles.orderNumber
                    }
                  >
                    Commande #{order.id}
                  </Text>

                  <Text
                    style={
                      styles.orderDate
                    }
                  >
                    {formatDate(
                      order.created_at
                    )}
                  </Text>
                </View>

                <View
                  style={[
                    styles.statusBadge,
                    getStatusStyle(
                      order.status
                    ),
                  ]}
                >
                  <Text
                    style={
                      styles.statusText
                    }
                  >
                    {getStatusLabel(
                      order.status
                    )}
                  </Text>
                </View>
              </View>

              <View
                style={
                  styles.separator
                }
              />

              {/* PLAN */}

              <View
                style={
                  styles.planRow
                }
              >
                <View
                  style={
                    styles.planIcon
                  }
                >
                  <Text
                    style={
                      styles.planIconText
                    }
                  >
                    👑
                  </Text>
                </View>

                <View
                  style={
                    styles.planContent
                  }
                >
                  <Text
                    style={
                      styles.planName
                    }
                  >
                    {order.plan_name}
                  </Text>

                  <Text
                    style={
                      styles.planDuration
                    }
                  >
                    {order.duration_months ===
                    1
                      ? '1 mois'
                      : `${order.duration_months} mois`}
                  </Text>
                </View>
              </View>

              <View
                style={
                  styles.separator
                }
              />

              {/* INFORMATIONS */}

              <View
                style={
                  styles.infoRow
                }
              >
                <Text
                  style={
                    styles.infoLabel
                  }
                >
                  Montant
                </Text>

                <Text
                  style={
                    styles.infoValue
                  }
                >
                  {order.amount.toLocaleString(
                    'fr-FR'
                  )}{' '}
                  {order.currency}
                </Text>
              </View>

              <View
                style={
                  styles.infoRow
                }
              >
                <Text
                  style={
                    styles.infoLabel
                  }
                >
                  Paiement
                </Text>

                <Text
                  style={
                    styles.infoValue
                  }
                >
                  {formatPaymentMethod(
                    order.payment_method
                  )}
                </Text>
              </View>

              {order.transaction_id && (
                <View
                  style={
                    styles.infoRow
                  }
                >
                  <Text
                    style={
                      styles.infoLabel
                    }
                  >
                    Transaction
                  </Text>

                  <Text
                    style={
                      styles.transactionValue
                    }
                    numberOfLines={1}
                  >
                    {order.transaction_id}
                  </Text>
                </View>
              )}

              <View
                style={
                  styles.infoRow
                }
              >
                <Text
                  style={
                    styles.infoLabel
                  }
                >
                  Extension
                </Text>

                <Text
                  style={
                    styles.infoValue
                  }
                >
                  {order.extension_confirmed
                    ? 'Confirmée'
                    : 'Non confirmée'}
                </Text>
              </View>
            </View>
          ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#080808',
  },

  content: {
    paddingHorizontal: 18,
    paddingTop: 15,
    paddingBottom: 40,
  },

  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  loadingText: {
    color: '#777777',
    fontSize: 14,
    marginTop: 15,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 25,
  },

  backButton: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#151515',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },

  backText: {
    color: '#FFFFFF',
    fontSize: 30,
    lineHeight: 32,
  },

  headerTitleBox: {
    flex: 1,
  },

  title: {
    color: '#FFFFFF',
    fontSize: 25,
    fontWeight: '800',
  },

  subtitle: {
    color: '#777777',
    fontSize: 13,
    marginTop: 4,
  },

  orderCard: {
    backgroundColor: '#151515',
    borderRadius: 18,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor:
      'rgba(255,255,255,0.06)',
  },

  orderHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  orderNumber: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },

  orderDate: {
    color: '#777777',
    fontSize: 12,
    marginTop: 4,
  },

  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },

  statusPaid: {
    backgroundColor:
      'rgba(46,204,113,0.15)',
  },

  statusPending: {
    backgroundColor:
      'rgba(241,196,15,0.15)',
  },

  statusFailed: {
    backgroundColor:
      'rgba(229,9,20,0.15)',
  },

  statusDefault: {
    backgroundColor:
      'rgba(255,255,255,0.08)',
  },

  statusText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },

  separator: {
    height: 1,
    backgroundColor:
      'rgba(255,255,255,0.07)',
    marginVertical: 15,
  },

  planRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  planIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#0D0D0D',
    alignItems: 'center',
    justifyContent: 'center',
  },

  planIconText: {
    fontSize: 25,
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

  planDuration: {
    color: '#777777',
    fontSize: 12,
    marginTop: 3,
  },

  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 11,
  },

  infoLabel: {
    color: '#777777',
    fontSize: 13,
  },

  infoValue: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },

  transactionValue: {
    color: '#AAAAAA',
    fontSize: 12,
    fontWeight: '600',
    maxWidth: '60%',
  },

  errorBox: {
    padding: 18,
    borderRadius: 14,
    backgroundColor: '#151515',
    borderWidth: 1,
    borderColor:
      'rgba(229,9,20,0.35)',
    alignItems: 'center',
    marginBottom: 18,
  },

  errorText: {
    color: '#AAAAAA',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
  },

  retryButton: {
    marginTop: 14,
    paddingHorizontal: 22,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: RED,
  },

  retryText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },

  emptyBox: {
    backgroundColor: '#151515',
    borderRadius: 18,
    padding: 30,
    alignItems: 'center',
  },

  emptyIcon: {
    fontSize: 42,
    marginBottom: 12,
  },

  emptyTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
  },

  emptyText: {
    color: '#777777',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
    marginTop: 6,
  },

  subscriptionButton: {
    height: 46,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: RED,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
  },

  subscriptionButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
});
