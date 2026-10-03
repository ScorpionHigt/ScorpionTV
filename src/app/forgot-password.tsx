import { useState } from 'react';

import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';

import { router } from 'expo-router';

import {
  APP_NAME,
  APP_VERSION,
  APP_YEAR,
} from '../constants/app';

export default function ForgotPasswordScreen() {
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);

  const isValid =
    phone.trim().length > 0 &&
    !loading;

  const handleContinue = async () => {
    if (!isValid || loading) {
      return;
    }

    try {
      setLoading(true);

      console.log(
        'MOT DE PASSE OUBLIÉ : numéro saisi :',
        phone
      );

      /*
       * Le backend de récupération du mot de passe
       * sera branché après la mise en place du système
       * OTP / vérification.
       */
      Alert.alert(
        'Mot de passe oublié',
        'Le système de récupération sera bientôt disponible.'
      );

    } catch (error) {
      console.log(
        'MOT DE PASSE OUBLIÉ : erreur :',
        error
      );

      Alert.alert(
        'Mot de passe oublié',
        'Impossible de continuer.'
      );

    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboard}
        behavior={
          Platform.OS === 'ios'
            ? 'padding'
            : undefined
        }
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Pressable
            style={styles.backButton}
            onPress={() => router.back()}
            disabled={loading}
          >
            <Text style={styles.backText}>
              ‹ Retour
            </Text>
          </Pressable>

          <View style={styles.header}>
            <Text style={styles.logo}>
              SCORPION
            </Text>

            <Text style={styles.logoSub}>
              TV
            </Text>

            <Text style={styles.title}>
              Mot de passe oublié ?
            </Text>

            <Text style={styles.subtitle}>
              Entre ton numéro de téléphone pour récupérer ton compte.
            </Text>
          </View>

          <View style={styles.card}>
            <View style={styles.iconContainer}>
              <Text style={styles.icon}>
                🔐
              </Text>
            </View>

            <Text style={styles.infoTitle}>
              Récupération du compte
            </Text>

            <Text style={styles.infoText}>
              Nous utiliserons ton numéro de téléphone
              pour vérifier que le compte t'appartient.
            </Text>

            <Text style={styles.label}>
              Numéro de téléphone
            </Text>

            <TextInput
              style={styles.input}
              placeholder="+223 XX XX XX XX"
              placeholderTextColor="#666666"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              editable={!loading}
              autoCorrect={false}
            />

            <Text style={styles.hint}>
              Utilise le numéro associé à ton compte.
            </Text>

            <Pressable
              style={[
                styles.continueButton,
                !isValid &&
                  styles.continueButtonDisabled,
              ]}
              onPress={handleContinue}
              disabled={!isValid}
            >
              {loading ? (
                <View
                  style={
                    styles.loadingButtonContent
                  }
                >
                  <ActivityIndicator
                    size="small"
                    color="#FFFFFF"
                  />

                  <Text
                    style={[
                      styles.continueButtonText,
                      styles.loadingButtonText,
                    ]}
                  >
                    Vérification...
                  </Text>
                </View>
              ) : (
                <Text
                  style={
                    styles.continueButtonText
                  }
                >
                  Continuer
                </Text>
              )}
            </Pressable>
          </View>

          <View style={styles.loginBox}>
            <Text style={styles.loginText}>
              Tu te souviens de ton mot de passe ?
            </Text>

            <Pressable
              onPress={() =>
                router.replace('/login')
              }
              disabled={loading}
            >
              <Text style={styles.loginLink}>
                Se connecter
              </Text>
            </Pressable>
          </View>

          <Text style={styles.version}>
            {APP_NAME} • v{APP_VERSION} © {APP_YEAR}
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#080808',
  },

  keyboard: {
    flex: 1,
  },

  scrollView: {
    flex: 1,
  },

  content: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 35,
  },

  backButton: {
    alignSelf: 'flex-start',
    marginBottom: 15,
  },

  backText: {
    color: '#E50914',
    fontSize: 15,
    fontWeight: '700',
  },

  header: {
    alignItems: 'center',
    marginBottom: 25,
  },

  logo: {
    color: '#FFFFFF',
    fontSize: 31,
    fontWeight: '900',
    letterSpacing: 4,
  },

  logoSub: {
    color: '#E50914',
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 5,
    marginTop: -4,
  },

  title: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '800',
    marginTop: 22,
    textAlign: 'center',
  },

  subtitle: {
    color: '#777777',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },

  card: {
    backgroundColor: '#151515',
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor:
      'rgba(255,255,255,0.06)',
  },

  iconContainer: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor:
      'rgba(229,9,20,0.12)',
    borderWidth: 1,
    borderColor:
      'rgba(229,9,20,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 18,
  },

  icon: {
    fontSize: 26,
  },

  infoTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
  },

  infoText: {
    color: '#777777',
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 24,
  },

  label: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 8,
  },

  input: {
    height: 52,
    backgroundColor: '#0D0D0D',
    borderRadius: 12,
    borderWidth: 1,
    borderColor:
      'rgba(255,255,255,0.08)',
    color: '#FFFFFF',
    paddingHorizontal: 15,
    fontSize: 15,
  },

  hint: {
    color: '#666666',
    fontSize: 11,
    marginTop: 7,
  },

  continueButton: {
    backgroundColor: '#E50914',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 24,
  },

  continueButtonDisabled: {
    opacity: 0.45,
  },

  continueButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },

  loadingButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },

  loadingButtonText: {
    marginLeft: 10,
  },

  loginBox: {
    alignItems: 'center',
    marginTop: 24,
  },

  loginText: {
    color: '#777777',
    fontSize: 13,
    textAlign: 'center',
  },

  loginLink: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    marginTop: 7,
  },

  version: {
    color: '#555555',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 20,
  },
});
