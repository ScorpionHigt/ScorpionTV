import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import {
  getSubscriptionPlans,
  SubscriptionPlan,
} from '../../api/subscriptionApi';

const RED = '#E50914';

export default function SubscriptionScreen() {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPlans = useCallback(async () => {
    try {
      setError(null);

      const data = await getSubscriptionPlans();

      setPlans(data);
    } catch (error) {
      console.error('ERREUR ABONNEMENTS :', error);

      setError(
        'Impossible de récupérer les offres actuellement.'
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadPlans();
  }, [loadPlans]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadPlans();
  };

  const formatPrice = (price: number, currency: string) => {
    return `${price.toLocaleString('fr-FR')} ${currency}`;
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={RED} />

          <Text style={styles.loadingText}>
            Chargement des abonnements...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={RED}
          />
        }
      >
        <View style={styles.header}>
          <Text style={styles.icon}>🎫</Text>

          <Text style={styles.title}>
            Abonnement
          </Text>

          <Text style={styles.description}>
            Choisissez l'offre ScorpionTV qui vous convient.
          </Text>
        </View>

        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>
              {error}
            </Text>

            <Pressable
              style={styles.retryButton}
              onPress={loadPlans}
            >
              <Text style={styles.retryText}>
                Réessayer
              </Text>
            </Pressable>
          </View>
        )}

        {!error && plans.length === 0 && (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>
              Aucune offre disponible actuellement.
            </Text>
          </View>
        )}

        <View style={styles.plansContainer}>
          {plans.map((plan) => (
            <View
              key={plan.id}
              style={[
                styles.planCard,
                plan.is_promotion && styles.promotionCard,
              ]}
            >
              {plan.image_url ? (
                <Image
                  source={{ uri: plan.image_url }}
                  style={styles.planImage}
                  resizeMode="cover"
                />
              ) : (
                <View style={styles.imageFallback}>
                  <Text style={styles.fallbackIcon}>
                    👑
                  </Text>
                </View>
              )}

              {plan.is_promotion && (
                <View style={styles.promotionBadge}>
                  <Text style={styles.promotionText}>
                    PROMOTION
                  </Text>
                </View>
              )}

              <View style={styles.planContent}>
                <Text style={styles.planName}>
                  {plan.name}
                </Text>

                {plan.description && (
                  <Text style={styles.planDescription}>
                    {plan.description}
                  </Text>
                )}

                <View style={styles.priceContainer}>
                  <Text style={styles.price}>
                    {formatPrice(plan.price, plan.currency)}
                  </Text>

                  <Text style={styles.duration}>
                    {plan.duration_months === 1
                      ? '1 mois'
                      : `${plan.duration_months} mois`}
                  </Text>
                </View>

                <View style={styles.separator} />

                <View style={styles.features}>
                  <Feature
                    label="Chaînes TV"
                    value={plan.tv_channels_count}
                  />

                  <Feature
                    label="Films"
                    value={plan.movies_count}
                  />

                  <Feature
                    label="Séries"
                    value={plan.series_count}
                  />
                </View>

                <Pressable
                  style={styles.subscribeButton}
                  onPress={() => {
                    router.push({
                      pathname: '/payment',
                      params: {
                        planId: String(plan.id),
                        planName: plan.name,
                        price: String(plan.price),
                        currency: plan.currency,
                        duration: String(plan.duration_months),
                      },
                    });
                  }}
                    >
                  <Text style={styles.subscribeText}>
                    Choisir cette offre
                  </Text>
                </Pressable>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

type FeatureProps = {
  label: string;
  value: number;
};

function Feature({ label, value }: FeatureProps) {
  return (
    <View style={styles.featureRow}>
      <Text style={styles.featureLabel}>
        {label}
      </Text>

      <Text style={styles.featureValue}>
        {value.toLocaleString('fr-FR')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#080808',
  },

  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 110,
  },

  header: {
    alignItems: 'center',
    marginBottom: 25,
  },

  icon: {
    fontSize: 42,
    marginBottom: 10,
  },

  title: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '800',
  },

  description: {
    color: '#777777',
    fontSize: 15,
    textAlign: 'center',
    marginTop: 8,
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

  plansContainer: {
    gap: 18,
  },

  planCard: {
    overflow: 'hidden',
    backgroundColor: '#151515',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },

  promotionCard: {
    borderColor: 'rgba(229,9,20,0.55)',
  },

  planImage: {
    width: '100%',
    height: 170,
    backgroundColor: '#202020',
  },

  imageFallback: {
    width: '100%',
    height: 170,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#181818',
  },

  fallbackIcon: {
    fontSize: 55,
  },

  promotionBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: RED,
  },

  promotionText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },

  planContent: {
    padding: 18,
  },

  planName: {
    color: '#FFFFFF',
    fontSize: 21,
    fontWeight: '800',
  },

  planDescription: {
    color: '#888888',
    fontSize: 13,
    lineHeight: 19,
    marginTop: 6,
  },

  priceContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginTop: 18,
  },

  price: {
    color: RED,
    fontSize: 23,
    fontWeight: '900',
  },

  duration: {
    color: '#AAAAAA',
    fontSize: 13,
  },

  separator: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginVertical: 16,
  },

  features: {
    gap: 10,
  },

  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  featureLabel: {
    color: '#AAAAAA',
    fontSize: 14,
  },

  featureValue: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },

  subscribeButton: {
    height: 48,
    marginTop: 20,
    borderRadius: 12,
    backgroundColor: RED,
    alignItems: 'center',
    justifyContent: 'center',
  },

  subscribeText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },

  errorBox: {
    padding: 18,
    borderRadius: 14,
    backgroundColor: '#181818',
    borderWidth: 1,
    borderColor: 'rgba(229,9,20,0.35)',
    alignItems: 'center',
    marginBottom: 20,
  },

  errorText: {
    color: '#AAAAAA',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
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
    padding: 30,
    borderRadius: 14,
    backgroundColor: '#151515',
    alignItems: 'center',
  },

  emptyText: {
    color: '#777777',
    fontSize: 14,
    textAlign: 'center',
  },
});

