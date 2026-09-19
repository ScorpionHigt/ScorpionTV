import { useState } from 'react';
import { syncUserNotifications } from '../services/notificationService';
import {
  APP_NAME,
  APP_VERSION,
  APP_YEAR,
} from '../constants/app';
import {
  ActivityIndicator,
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

import { login } from '../api/authApi';

const RED = '#E50914';

export default function LoginScreen() {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    if (!identifier.trim() || !password) {
      setError(
        'Veuillez saisir votre téléphone ou votre nom d’utilisateur, ainsi que votre mot de passe.'
      );
      return;
    }

    try {
      setLoading(true);
      setError(null);

      console.log('DONNÉES LOGIN :', {
        identifier: identifier.trim(),
        password: '********',
      });

      const loginResponse = await login(
          identifier.trim(),
          password
        );

        const notifications =
          await syncUserNotifications(
              loginResponse.user.id
            );

        console.log(
          'NOTIFICATIONS RÉCUPÉRÉES :',
          notifications
        );

        router.replace('/(tabs)');
    } catch (error) {
      console.error(
        'ERREUR CONNEXION :',
        error
      );

      setError(
        error instanceof Error
          ? error.message
          : 'Impossible de se connecter.'
      );
    } finally {
      setLoading(false);
    }
  };

  const canLogin =
    identifier.trim().length > 0 &&
    password.length > 0 &&
    !loading;

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
          <View style={styles.header}>
            <Text style={styles.logo}>
              SCORPION
            </Text>

            <Text style={styles.logoSub}>
              TV
            </Text>

            <Text style={styles.title}>
              Connexion
            </Text>

            <Text style={styles.subtitle}>
              Connecte-toi à ton compte ScorpionTV
            </Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>
              Téléphone ou nom d’utilisateur
            </Text>

            <TextInput
              style={styles.input}
              placeholder="Téléphone ou nom d’utilisateur"
              placeholderTextColor="#666666"
              value={identifier}
              onChangeText={setIdentifier}
              autoCapitalize="none"
              autoCorrect={false}
              editable={!loading}
            />

            <Text
              style={[
                styles.label,
                styles.passwordLabel,
              ]}
            >
              Mot de passe
            </Text>

            <View style={styles.passwordContainer}>
              <TextInput
                style={styles.passwordInput}
                placeholder="Ton mot de passe"
                placeholderTextColor="#666666"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                editable={!loading}
                onSubmitEditing={handleLogin}
              />

              <Pressable
                style={styles.eyeButton}
                onPress={() =>
                  setShowPassword(
                    (previous) => !previous
                  )
                }
                disabled={loading}
                accessibilityRole="button"
                accessibilityLabel={
                  showPassword
                    ? 'Masquer le mot de passe'
                    : 'Afficher le mot de passe'
                }
              >
                <Text style={styles.eyeIcon}>
                  {showPassword ? '🙈' : '👁️'}
                </Text>
              </Pressable>
            </View>

            {error && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>
                  {error}
                </Text>
              </View>
            )}

            <Pressable
              style={[
                styles.loginButton,
                !canLogin &&
                  styles.loginButtonDisabled,
              ]}
              onPress={handleLogin}
              disabled={!canLogin}
            >
              {loading ? (
                <View style={styles.loadingContent}>
                  <ActivityIndicator
                    size="small"
                    color="#FFFFFF"
                  />

                  <Text
                    style={[
                      styles.loginButtonText,
                      styles.loadingText,
                    ]}
                  >
                    Connexion...
                  </Text>
                </View>
              ) : (
                <Text style={styles.loginButtonText}>
                  Se connecter
                </Text>
              )}
            </Pressable>

            <Pressable
              style={styles.forgotButton}
              disabled={loading}
              onPress={() => {
                console.log(
                  'Mot de passe oublié'
                );
              }}
            >
              <Text style={styles.forgotText}>
                Mot de passe oublié ?
              </Text>
            </Pressable>
          </View>

          <View style={styles.registerBox}>
            <Text style={styles.registerText}>
              Tu n’as pas encore de compte ?
            </Text>

            <Pressable
              disabled={loading}
              onPress={() =>
                router.push('/register')
              }
            >
              <Text style={styles.registerLink}>
                Créer un compte
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
    paddingTop: 45,
    paddingBottom: 35,
    justifyContent: 'center',
  },

  header: {
    alignItems: 'center',
    marginBottom: 30,
  },

  logo: {
    color: '#FFFFFF',
    fontSize: 31,
    fontWeight: '900',
    letterSpacing: 4,
  },

  logoSub: {
    color: RED,
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 5,
    marginTop: -4,
  },

  title: {
    color: '#FFFFFF',
    fontSize: 27,
    fontWeight: '800',
    marginTop: 25,
  },

  subtitle: {
    color: '#777777',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 7,
  },

  card: {
    backgroundColor: '#151515',
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },

  label: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 8,
  },

  passwordLabel: {
    marginTop: 18,
  },

  input: {
    height: 52,
    backgroundColor: '#0D0D0D',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    color: '#FFFFFF',
    paddingHorizontal: 15,
    fontSize: 15,
  },

  passwordContainer: {
    position: 'relative',
    justifyContent: 'center',
  },

  passwordInput: {
    height: 52,
    backgroundColor: '#0D0D0D',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    color: '#FFFFFF',
    paddingHorizontal: 15,
    paddingRight: 55,
    fontSize: 15,
  },

  eyeButton: {
    position: 'absolute',
    right: 14,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
  },

  eyeIcon: {
    fontSize: 20,
  },

  errorBox: {
    marginTop: 16,
    padding: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(229,9,20,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(229,9,20,0.35)',
  },

  errorText: {
    color: '#FF6B6B',
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },

  loginButton: {
    backgroundColor: RED,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 24,
  },

  loginButtonDisabled: {
    opacity: 0.45,
  },

  loadingContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },

  loadingText: {
    marginLeft: 10,
  },

  loginButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },

  forgotButton: {
    alignItems: 'center',
    marginTop: 18,
  },

  forgotText: {
    color: RED,
    fontSize: 13,
    fontWeight: '600',
  },

  registerBox: {
    alignItems: 'center',
    marginTop: 25,
  },

  registerText: {
    color: '#777777',
    fontSize: 13,
  },

  registerLink: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    marginTop: 7,
  },

  version: {
    color: '#555555',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 25,
  },
});