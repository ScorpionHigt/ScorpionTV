import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';

import {
  createOrder,
  confirmExtension,
  PaymentMethod,
} from '../api/orderApi';

import { getAuthUser } from '../storage/authStorage';

type PaymentOption = {
  id: PaymentMethod;
  label: string;
  icon: string;
  description: string;
};

const PAYMENT_OPTIONS: PaymentOption[] = [
  {
    id: 'free',
    label: 'Gratuit',
    icon: '🔵',
    description: 'Gratuit pour les fans.',
  },  
  {
    id: 'orange_money',
    label: 'Orange Money',
    icon: '🟠',
    description: 'Paiement mobile Orange Money',
  },
  {
    id: 'moov_money',
    label: 'Moov Money',
    icon: '🟢',
    description: 'Paiement mobile Moov Money',
  },
  {
    id: 'wave',
    label: 'Wave',
    icon: '🔵',
    description: 'Paiement avec Wave',
  },
  {
    id: 'card',
    label: 'Carte bancaire',
    icon: '💳',
    description: 'Visa, Mastercard, etc.',
  },
  
];

export default function PaymentScreen() {
  const params = useLocalSearchParams<{
    planId?: string;
    planName?: string;
    price?: string;
    currency?: string;
    duration?: string;
  }>();

  const [selectedPaymentMethod, setSelectedPaymentMethod] =
    useState<PaymentMethod | null>(null);

  const [isCreatingOrder, setIsCreatingOrder] =
    useState(false);

  const [isConfirmingExtension, setIsConfirmingExtension] =
    useState(false);

  const [orderMessage, setOrderMessage] =
    useState('');

  const [orderId, setOrderId] =
    useState<number | null>(null);

  const [requiresExtensionConfirmation, setRequiresExtensionConfirmation] =
    useState(false);

  const [currentSubscriptionEndDate, setCurrentSubscriptionEndDate] =
    useState<string | null>(null);

  const [currentSubscriptionType, setCurrentSubscriptionType] =
    useState<string | null>(null);

  const [purchaseType, setPurchaseType] =
    useState<'extension' | 'scheduled' | null>(null);

  const price = Number(params.price ?? 0);

  const handleCreateOrder = async () => {
    const planId = Number(params.planId);

    if (!planId) {
      setOrderMessage(
        'Identifiant de l’offre invalide.'
      );
      return;
    }

    if (!selectedPaymentMethod) {
      setOrderMessage(
        'Sélectionne un moyen de paiement.'
      );
      return;
    }

    try {
      setIsCreatingOrder(true);
      setOrderMessage('');

      const user = await getAuthUser();

      if (!user) {
        setOrderMessage(
          'Votre session a expiré. Veuillez vous reconnecter.'
        );
        return;
      }

      const result = await createOrder({
        user_id: user.id,
        plan_id: planId,
        payment_method: selectedPaymentMethod,
      });

      console.log(
        'COMMANDE CRÉÉE :',
        result
      );

      setOrderId(result.order.id);

      if (result.requires_extension_confirmation) {
        setRequiresExtensionConfirmation(true);

        setCurrentSubscriptionEndDate(
          result.current_subscription?.end_date ?? null
        );

        setCurrentSubscriptionType(
          result.current_subscription?.subscription_type ?? null
        );

        setPurchaseType(
          result.purchase_type ?? null
        );

        setOrderMessage(
          result.message
        );

        return;
      }

      setRequiresExtensionConfirmation(false);

      setOrderMessage(
        result.message ||
          `Commande créée : ${result.order.id}`
      );
    } catch (error) {
      console.error(
        'ERREUR CRÉATION COMMANDE :',
        error
      );

      setOrderMessage(
        error instanceof Error
          ? error.message
          : 'Impossible de créer la commande.'
      );
    } finally {
      setIsCreatingOrder(false);
    }
  };

  const handleExtensionConfirmation = async (
    confirmed: boolean
  ) => {
    if (!orderId) {
      setOrderMessage(
        'Commande introuvable.'
      );
      return;
    }

    try {
      setIsConfirmingExtension(true);
      setOrderMessage('');

      const result = await confirmExtension(
        orderId,
        confirmed
      );

      console.log(
        'CONFIRMATION EXTENSION :',
        result
      );

      setRequiresExtensionConfirmation(false);

      setPurchaseType(
        result.purchase_type ?? null
      );

      setOrderMessage(
        result.message
      );
    } catch (error) {
      console.error(
        'ERREUR CONFIRMATION EXTENSION :',
        error
      );

      setOrderMessage(
        error instanceof Error
          ? error.message
          : 'Impossible de valider cette opération.'
      );
    } finally {
      setIsConfirmingExtension(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.icon}>
          💳
        </Text>

        <Text style={styles.title}>
          Paiement
        </Text>

        {/* OFFRE */}
        <View style={styles.card}>
          <Text style={styles.label}>
            Offre sélectionnée
          </Text>

          <Text style={styles.planName}>
            {params.planName ?? 'Abonnement'}
          </Text>

          <Text style={styles.duration}>
            {params.duration ?? ''} mois
          </Text>

          <View style={styles.separator} />

          <Text style={styles.label}>
            Montant
          </Text>

          <Text style={styles.price}>
            {price.toLocaleString('fr-FR')}{' '}
            {params.currency ?? 'FCFA'}
          </Text>
        </View>

        {/* MOYENS DE PAIEMENT */}
        <View style={styles.paymentBox}>
          <Text style={styles.paymentTitle}>
            Moyen de paiement
          </Text>

          <Text style={styles.paymentText}>
            Sélectionne le moyen que tu souhaites utiliser.
          </Text>

          <View style={styles.paymentList}>
            {PAYMENT_OPTIONS.map((option) => {
              const isSelected =
                selectedPaymentMethod === option.id;

              return (
                <Pressable
                  key={option.id}
                  style={[
                    styles.paymentOption,
                    isSelected &&
                      styles.paymentOptionSelected,
                  ]}
                  onPress={() => {
                    setSelectedPaymentMethod(option.id);
                    setOrderMessage('');
                  }}
                  disabled={
                    isCreatingOrder ||
                    isConfirmingExtension ||
                    requiresExtensionConfirmation
                  }
                >
                  <View style={styles.paymentIcon}>
                    <Text style={styles.paymentIconText}>
                      {option.icon}
                    </Text>
                  </View>

                  <View style={styles.paymentInfo}>
                    <Text
                      style={styles.paymentOptionTitle}
                    >
                      {option.label}
                    </Text>

                    <Text
                      style={
                        styles.paymentOptionDescription
                      }
                    >
                      {option.description}
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.radio,
                      isSelected &&
                        styles.radioSelected,
                    ]}
                  >
                    {isSelected && (
                      <View
                        style={styles.radioInner}
                      />
                    )}
                  </View>
                </Pressable>
              );
            })}
          </View>

          {/* CONFIRMATION ABONNEMENT EXISTANT */}
          {requiresExtensionConfirmation && (
            <View style={styles.confirmationBox}>
              <Text style={styles.confirmationIcon}>
                ⚠️
              </Text>

              <Text style={styles.confirmationTitle}>
                Abonnement déjà actif
              </Text>

              {currentSubscriptionType && (
                <Text style={styles.confirmationText}>
                  Abonnement actuel :{' '}
                  {currentSubscriptionType}
                </Text>
              )}

              {currentSubscriptionEndDate && (
                <Text style={styles.confirmationText}>
                  Il se termine le :{' '}
                  {currentSubscriptionEndDate}
                </Text>
              )}

              <Text style={styles.confirmationText}>
                {purchaseType === 'extension'
                  ? 'Le nouvel achat prolongera votre abonnement actuel.'
                  : 'Le nouvel abonnement commencera à la fin de votre abonnement actuel.'}
              </Text>

              <Text style={styles.confirmationQuestion}>
                Voulez-vous continuer ?
              </Text>

              <View style={styles.confirmationButtons}>
                <Pressable
                  style={[
                    styles.refuseButton,
                    isConfirmingExtension &&
                      styles.buttonDisabled,
                  ]}
                  onPress={() =>
                    handleExtensionConfirmation(false)
                  }
                  disabled={isConfirmingExtension}
                >
                  {isConfirmingExtension ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.refuseButtonText}>
                      Refuser
                    </Text>
                  )}
                </Pressable>

                <Pressable
                  style={[
                    styles.confirmButton,
                    isConfirmingExtension &&
                      styles.buttonDisabled,
                  ]}
                  onPress={() =>
                    handleExtensionConfirmation(true)
                  }
                  disabled={isConfirmingExtension}
                >
                  {isConfirmingExtension ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.confirmButtonText}>
                      Continuer
                    </Text>
                  )}
                </Pressable>
              </View>
            </View>
          )}

          {/* BOUTON CRÉER COMMANDE */}
          {!requiresExtensionConfirmation && (
            <Pressable
              style={[
                styles.payButton,
                (!selectedPaymentMethod ||
                  isCreatingOrder) &&
                  styles.payButtonDisabled,
              ]}
              onPress={handleCreateOrder}
              disabled={
                !selectedPaymentMethod ||
                isCreatingOrder
              }
            >
              {isCreatingOrder ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.payButtonText}>
                  Créer la commande
                </Text>
              )}
            </Pressable>
          )}

          {/* MESSAGE */}
          {orderMessage !== '' && (
            <Text style={styles.orderMessage}>
              {orderMessage}
            </Text>
          )}
        </View>
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
    paddingTop: 25,
    paddingBottom: 30,
  },

  icon: {
    fontSize: 42,
    textAlign: 'center',
    marginBottom: 10,
  },

  title: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 25,
  },

  card: {
    backgroundColor: '#151515',
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },

  label: {
    color: '#777777',
    fontSize: 13,
  },

  planName: {
    color: '#FFFFFF',
    fontSize: 21,
    fontWeight: '800',
    marginTop: 6,
  },

  duration: {
    color: '#999999',
    fontSize: 14,
    marginTop: 4,
  },

  separator: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginVertical: 18,
  },

  price: {
    color: '#E50914',
    fontSize: 25,
    fontWeight: '900',
    marginTop: 6,
  },

  paymentBox: {
    marginTop: 20,
    backgroundColor: '#151515',
    borderRadius: 18,
    padding: 20,
  },

  paymentTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },

  paymentText: {
    color: '#777777',
    fontSize: 14,
    marginTop: 8,
    lineHeight: 20,
  },

  paymentList: {
    marginTop: 16,
    gap: 10,
  },

  paymentOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0D0D0D',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },

  paymentOptionSelected: {
    borderColor: '#E50914',
    backgroundColor: 'rgba(229,9,20,0.08)',
  },

  paymentIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#151515',
    alignItems: 'center',
    justifyContent: 'center',
  },

  paymentIconText: {
    fontSize: 21,
  },

  paymentInfo: {
    flex: 1,
    marginLeft: 12,
  },

  paymentOptionTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },

  paymentOptionDescription: {
    color: '#777777',
    fontSize: 12,
    marginTop: 3,
  },

  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#555555',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
  },

  radioSelected: {
    borderColor: '#E50914',
  },

  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#E50914',
  },

  confirmationBox: {
    marginTop: 20,
    padding: 18,
    borderRadius: 14,
    backgroundColor: '#1A1A1A',
    borderWidth: 1,
    borderColor: 'rgba(229,9,20,0.45)',
    alignItems: 'center',
  },

  confirmationIcon: {
    fontSize: 30,
    marginBottom: 8,
  },

  confirmationTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
  },

  confirmationText: {
    color: '#AAAAAA',
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: 8,
  },

  confirmationQuestion: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 16,
  },

  confirmationButtons: {
    flexDirection: 'row',
    width: '100%',
    gap: 10,
    marginTop: 16,
  },

  refuseButton: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#333333',
    alignItems: 'center',
    justifyContent: 'center',
  },

  refuseButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },

  confirmButton: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#E50914',
    alignItems: 'center',
    justifyContent: 'center',
  },

  confirmButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },

  buttonDisabled: {
    opacity: 0.5,
  },

  payButton: {
    width: '100%',
    backgroundColor: '#E50914',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 24,
  },

  payButtonDisabled: {
    opacity: 0.45,
  },

  payButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },

  orderMessage: {
    color: '#FFFFFF',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 16,
    lineHeight: 20,
  },
});
