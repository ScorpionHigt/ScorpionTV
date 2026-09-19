import { useState } from 'react';
import {
  APP_NAME,
  APP_VERSION,
  APP_YEAR,
} from '../constants/app';
import {
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

export default function RegisterScreen() {
  const [username, setUsername] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const passwordsMatch =
    password.length > 0 &&
    confirmPassword.length > 0 &&
    password === confirmPassword;

  const isValid =
    username.trim().length > 0 &&
    phone.trim().length > 0 &&
    password.length > 0 &&
    passwordsMatch;

  const handleRegister = () => {
    if (!isValid) {
      return;
    }

    // L'inscription à l'API sera ajoutée ensuite.
    console.log('Inscription demandée pour :', {
      username,
      phone,
      email,
    });
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
              Créer un compte
            </Text>

            <Text style={styles.subtitle}>
              Rejoins ScorpionTV et profite de ton espace personnel
            </Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>
              Nom d'utilisateur
            </Text>

            <TextInput
              style={styles.input}
              placeholder="Choisis un nom d'utilisateur"
              placeholderTextColor="#666666"
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              autoCorrect={false}
            />

            <Text style={[styles.label, styles.fieldSpacing]}>
              Numéro de téléphone
            </Text>

            <TextInput
              style={styles.input}
              placeholder="+223 XX XX XX XX"
              placeholderTextColor="#666666"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
            />

            <Text style={[styles.label, styles.fieldSpacing]}>
              Email
            </Text>

            <Text style={styles.optional}>
              Facultatif
            </Text>

            <TextInput
              style={styles.input}
              placeholder="exemple@email.com"
              placeholderTextColor="#666666"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />

            <Text style={[styles.label, styles.fieldSpacing]}>
              Mot de passe
            </Text>

            <TextInput
              style={styles.input}
              placeholder="Ton mot de passe"
              placeholderTextColor="#666666"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
            />

            <Text style={[styles.label, styles.fieldSpacing]}>
              Confirmer le mot de passe
            </Text>

            <TextInput
              style={styles.input}
              placeholder="Retape ton mot de passe"
              placeholderTextColor="#666666"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
            />

            {confirmPassword.length > 0 && (
              <Text
                style={
                  passwordsMatch
                    ? styles.successText
                    : styles.errorText
                }
              >
                {passwordsMatch
                  ? '✓ Les mots de passe correspondent'
                  : 'Les mots de passe ne correspondent pas'}
              </Text>
            )}

            <Pressable
              style={[
                styles.registerButton,
                !isValid &&
                  styles.registerButtonDisabled,
              ]}
              onPress={handleRegister}
              disabled={!isValid}
            >
              <Text style={styles.registerButtonText}>
                Créer mon compte
              </Text>
            </Pressable>
          </View>

          <View style={styles.loginBox}>
            <Text style={styles.loginText}>
              Tu as déjà un compte ?
            </Text>

            <Pressable
              onPress={() => router.push('/login')}
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
    fontSize: 27,
    fontWeight: '800',
    marginTop: 22,
  },

  subtitle: {
    color: '#777777',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 7,
    lineHeight: 20,
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

  fieldSpacing: {
    marginTop: 18,
  },

  optional: {
    color: '#666666',
    fontSize: 11,
    marginTop: -5,
    marginBottom: 8,
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

  successText: {
    color: '#4CAF50',
    fontSize: 12,
    marginTop: 8,
  },

  errorText: {
    color: '#E50914',
    fontSize: 12,
    marginTop: 8,
  },

  registerButton: {
    backgroundColor: '#E50914',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 24,
  },

  registerButtonDisabled: {
    opacity: 0.45,
  },

  registerButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },

  loginBox: {
    alignItems: 'center',
    marginTop: 24,
  },

  loginText: {
    color: '#777777',
    fontSize: 13,
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