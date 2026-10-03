import { useMemo, useState } from 'react';

import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
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

import { syncUserNotifications } from '../services/notificationService';

import {
  APP_NAME,
  APP_VERSION,
  APP_YEAR,
} from '../constants/app';

import { login } from '../api/authApi';

const RED = '#E50914';

type Country = {
  name: string;
  code: string;
};

const COUNTRIES: Country[] = [
  { name: 'Mali', code: '+223' },
  { name: 'Burkina Faso', code: '+226' },
  { name: 'Côte d’Ivoire', code: '+225' },
  { name: 'Sénégal', code: '+221' },
  { name: 'Guinée', code: '+224' },
  { name: 'Guinée-Bissau', code: '+245' },
  { name: 'Mauritanie', code: '+222' },
  { name: 'Niger', code: '+227' },
  { name: 'Togo', code: '+228' },
  { name: 'Bénin', code: '+229' },
  { name: 'Ghana', code: '+233' },
  { name: 'Nigeria', code: '+234' },
  { name: 'Gambie', code: '+220' },
  { name: 'Guinée équatoriale', code: '+240' },
  { name: 'Cameroun', code: '+237' },
  { name: 'Gabon', code: '+241' },
  { name: 'Congo', code: '+242' },
  {
    name: 'République démocratique du Congo',
    code: '+243',
  },
  { name: 'République centrafricaine', code: '+236' },
  { name: 'Tchad', code: '+235' },
  { name: 'Soudan', code: '+249' },
  { name: 'Éthiopie', code: '+251' },
  { name: 'Kenya', code: '+254' },
  { name: 'Tanzanie', code: '+255' },
  { name: 'Ouganda', code: '+256' },
  { name: 'Rwanda', code: '+250' },
  { name: 'Burundi', code: '+257' },
  { name: 'Afrique du Sud', code: '+27' },
  { name: 'Algérie', code: '+213' },
  { name: 'Maroc', code: '+212' },
  { name: 'Tunisie', code: '+216' },
  { name: 'Égypte', code: '+20' },
  { name: 'Libye', code: '+218' },

  { name: 'France', code: '+33' },
  { name: 'Belgique', code: '+32' },
  { name: 'Suisse', code: '+41' },
  { name: 'Allemagne', code: '+49' },
  { name: 'Espagne', code: '+34' },
  { name: 'Italie', code: '+39' },
  { name: 'Portugal', code: '+351' },
  { name: 'Royaume-Uni', code: '+44' },
  { name: 'Pays-Bas', code: '+31' },
  { name: 'Suède', code: '+46' },
  { name: 'Norvège', code: '+47' },
  { name: 'Danemark', code: '+45' },
  { name: 'Finlande', code: '+358' },
  { name: 'Autriche', code: '+43' },
  { name: 'Irlande', code: '+353' },

  { name: 'États-Unis', code: '+1' },
  { name: 'Canada', code: '+1' },
  { name: 'Mexique', code: '+52' },
  { name: 'Brésil', code: '+55' },
  { name: 'Argentine', code: '+54' },
  { name: 'Chili', code: '+56' },
  { name: 'Colombie', code: '+57' },
  { name: 'Pérou', code: '+51' },

  { name: 'Chine', code: '+86' },
  { name: 'Japon', code: '+81' },
  { name: 'Corée du Sud', code: '+82' },
  { name: 'Inde', code: '+91' },
  { name: 'Pakistan', code: '+92' },
  { name: 'Bangladesh', code: '+880' },
  { name: 'Indonésie', code: '+62' },
  { name: 'Malaisie', code: '+60' },
  { name: 'Singapour', code: '+65' },
  { name: 'Thaïlande', code: '+66' },
  { name: 'Philippines', code: '+63' },
  { name: 'Australie', code: '+61' },
  { name: 'Nouvelle-Zélande', code: '+64' },

  { name: 'Arabie saoudite', code: '+966' },
  { name: 'Émirats arabes unis', code: '+971' },
  { name: 'Qatar', code: '+974' },
  { name: 'Koweït', code: '+965' },
  { name: 'Bahreïn', code: '+973' },
  { name: 'Oman', code: '+968' },
  { name: 'Turquie', code: '+90' },
  { name: 'Israël', code: '+972' },
  { name: 'Jordanie', code: '+962' },
  { name: 'Liban', code: '+961' },
];

export default function LoginScreen() {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');

  const [showPassword, setShowPassword] =
    useState(false);

  const [loading, setLoading] = useState(false);

  const [error, setError] =
    useState<string | null>(null);

  const [selectedCountry, setSelectedCountry] =
    useState<Country>(COUNTRIES[0]);

  const [countryModalVisible, setCountryModalVisible] =
    useState(false);

  const [countrySearch, setCountrySearch] =
    useState('');

  // -------------------------------------------------
  // FILTRAGE DES PAYS
  // -------------------------------------------------

  const filteredCountries = useMemo(() => {
    const search = countrySearch
      .trim()
      .toLowerCase();

    if (!search) {
      return COUNTRIES;
    }

    return COUNTRIES.filter(
      (country) =>
        country.name
          .toLowerCase()
          .includes(search) ||
        country.code.includes(search)
    );
  }, [countrySearch]);

  // -------------------------------------------------
  // DÉTECTION TÉLÉPHONE
  // -------------------------------------------------

  const isPhoneIdentifier = (
    value: string
  ): boolean => {
    const cleaned = value.trim();

    if (!cleaned) {
      return false;
    }

    // Numéro international déjà complet.
    if (cleaned.startsWith('+')) {
      return true;
    }

    // Numéro composé uniquement de chiffres,
    // espaces, tirets ou parenthèses.
    return /^[0-9\s\-()]+$/.test(cleaned);
  };

  // -------------------------------------------------
  // CONSTRUCTION IDENTIFIANT
  // -------------------------------------------------

  const buildIdentifier = (
    value: string
  ): string => {
    const cleaned = value.trim();

    // Username
    if (!isPhoneIdentifier(cleaned)) {
      return cleaned;
    }

    // Numéro déjà international
    if (cleaned.startsWith('+')) {
      return cleaned
        .replace(/\s+/g, '')
        .replace(/-/g, '')
        .replace(/[()]/g, '');
    }

    // Numéro local
    const localNumber = cleaned.replace(
      /[\s\-()]/g,
      ''
    );

    return `${selectedCountry.code}${localNumber}`;
  };

  // -------------------------------------------------
  // CONNEXION
  // -------------------------------------------------

  const handleLogin = async () => {
    if (!identifier.trim() || !password) {
      setError(
        'Veuillez saisir votre téléphone ou votre nom d’utilisateur, ainsi que votre mot de passe.'
      );
      return;
    }

    const finalIdentifier =
      buildIdentifier(identifier);

    try {
      setLoading(true);
      setError(null);

      console.log('DONNÉES LOGIN :', {
        identifierSaisi:
          identifier.trim(),
        indicatif:
          isPhoneIdentifier(identifier)
            ? selectedCountry.code
            : null,
        identifierEnvoye:
          finalIdentifier,
        password: '********',
      });

      const loginResponse = await login(
        finalIdentifier,
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

  // -------------------------------------------------
  // SÉLECTION PAYS
  // -------------------------------------------------

  const handleSelectCountry = (
    country: Country
  ) => {
    setSelectedCountry(country);
    setCountryModalVisible(false);
    setCountrySearch('');
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
          {/* --------------------------------------- */}
          {/* HEADER */}
          {/* --------------------------------------- */}

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

          {/* --------------------------------------- */}
          {/* FORMULAIRE */}
          {/* --------------------------------------- */}

          <View style={styles.card}>
            <Text style={styles.label}>
              Téléphone ou nom d’utilisateur
            </Text>

            <View style={styles.identifierRow}>
              {/* ----------------------------------- */}
              {/* INDICATIF */}
              {/* ----------------------------------- */}

              <Pressable
                style={styles.countryButton}
                onPress={() =>
                  setCountryModalVisible(true)
                }
                disabled={loading}
              >
                <Text style={styles.countryCode}>
                  {selectedCountry.code}
                </Text>

                <Text style={styles.countryArrow}>
                  ▼
                </Text>
              </Pressable>

              {/* ----------------------------------- */}
              {/* IDENTIFIANT */}
              {/* ----------------------------------- */}

              <TextInput
                style={styles.identifierInput}
                placeholder="Téléphone ou username"
                placeholderTextColor="#666666"
                value={identifier}
                onChangeText={setIdentifier}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="default"
                editable={!loading}
              />
            </View>

            <Text style={styles.phoneHint}>
              Pour un téléphone, saisis uniquement le
              numéro local.
            </Text>

            <Text
              style={[
                styles.label,
                styles.passwordLabel,
              ]}
            >
              Mot de passe
            </Text>

            <View
              style={styles.passwordContainer}
            >
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
                  {showPassword
                    ? '🙈'
                    : '👁️'}
                </Text>
              </Pressable>
            </View>

            {/* --------------------------------------- */}
            {/* ERREUR */}
            {/* --------------------------------------- */}

            {error && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>
                  {error}
                </Text>
              </View>
            )}

            {/* --------------------------------------- */}
            {/* BOUTON CONNEXION */}
            {/* --------------------------------------- */}

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
                <View
                  style={styles.loadingContent}
                >
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
                <Text
                  style={styles.loginButtonText}
                >
                  Se connecter
                </Text>
              )}
            </Pressable>

            {/* --------------------------------------- */}
            {/* MOT DE PASSE OUBLIÉ */}
            {/* --------------------------------------- */}

            <Pressable
              style={styles.forgotButton}
              disabled={loading}
              onPress={() => {
                console.log(
                  'OUVERTURE MOT DE PASSE OUBLIÉ'
                );

                router.push(
                  '/forgot-password'
                );
              }}
            >
              <Text style={styles.forgotText}>
                Mot de passe oublié ?
              </Text>
            </Pressable>
          </View>

          {/* --------------------------------------- */}
          {/* INSCRIPTION */}
          {/* --------------------------------------- */}

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
              <Text
                style={styles.registerLink}
              >
                Créer un compte
              </Text>
            </Pressable>
          </View>

          <Text style={styles.version}>
            {APP_NAME} • v{APP_VERSION} ©{' '}
            {APP_YEAR}
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ========================================= */}
      {/* MODAL INDICATIFS */}
      {/* ========================================= */}

      <Modal
        visible={countryModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() =>
          setCountryModalVisible(false)
        }
      >
        <View style={styles.modalOverlay}>
          <View style={styles.countryModal}>
            {/* ------------------------------------- */}
            {/* HEADER MODAL */}
            {/* ------------------------------------- */}

            <View
              style={styles.modalHeader}
            >
              <Text
                style={styles.modalTitle}
              >
                Choisir un pays
              </Text>

              <Pressable
                onPress={() => {
                  setCountryModalVisible(
                    false
                  );
                  setCountrySearch('');
                }}
              >
                <Text
                  style={styles.closeText}
                >
                  ✕
                </Text>
              </Pressable>
            </View>

            {/* ------------------------------------- */}
            {/* RECHERCHE */}
            {/* ------------------------------------- */}

            <TextInput
              style={styles.searchInput}
              placeholder="Rechercher un pays ou indicatif"
              placeholderTextColor="#666666"
              value={countrySearch}
              onChangeText={setCountrySearch}
              autoCapitalize="none"
              autoCorrect={false}
            />

            {/* ------------------------------------- */}
            {/* LISTE */}
            {/* ------------------------------------- */}

            <FlatList
              data={filteredCountries}
              keyExtractor={(item, index) =>
                `${item.name}-${item.code}-${index}`
              }
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => {
                const selected =
                  item.code ===
                    selectedCountry.code &&
                  item.name ===
                    selectedCountry.name;

                return (
                  <Pressable
                    style={[
                      styles.countryItem,
                      selected &&
                        styles.countryItemSelected,
                    ]}
                    onPress={() =>
                      handleSelectCountry(
                        item
                      )
                    }
                  >
                    <Text
                      style={
                        styles.countryName
                      }
                    >
                      {item.name}
                    </Text>

                    <Text
                      style={
                        styles.countryItemCode
                      }
                    >
                      {item.code}
                    </Text>
                  </Pressable>
                );
              }}
              ListEmptyComponent={
                <Text
                  style={
                    styles.emptyCountryText
                  }
                >
                  Aucun pays trouvé.
                </Text>
              }
            />
          </View>
        </View>
      </Modal>
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
    borderColor:
      'rgba(255,255,255,0.06)',
  },

  label: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 8,
  },

  identifierRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  countryButton: {
    height: 52,
    minWidth: 82,
    paddingHorizontal: 12,
    backgroundColor: '#0D0D0D',
    borderTopLeftRadius: 12,
    borderBottomLeftRadius: 12,
    borderWidth: 1,
    borderRightWidth: 0,
    borderColor:
      'rgba(255,255,255,0.08)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },

  countryCode: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },

  countryArrow: {
    color: '#888888',
    fontSize: 9,
    marginLeft: 7,
  },

  identifierInput: {
    flex: 1,
    height: 52,
    backgroundColor: '#0D0D0D',
    borderTopRightRadius: 12,
    borderBottomRightRadius: 12,
    borderWidth: 1,
    borderColor:
      'rgba(255,255,255,0.08)',
    color: '#FFFFFF',
    paddingHorizontal: 15,
    fontSize: 15,
  },

  phoneHint: {
    color: '#666666',
    fontSize: 11,
    marginTop: 7,
    lineHeight: 16,
  },

  passwordLabel: {
    marginTop: 18,
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
    borderColor:
      'rgba(255,255,255,0.08)',
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
    backgroundColor:
      'rgba(229,9,20,0.10)',
    borderWidth: 1,
    borderColor:
      'rgba(229,9,20,0.35)',
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

  // ===============================================
  // MODAL
  // ===============================================

  modalOverlay: {
    flex: 1,
    backgroundColor:
      'rgba(0,0,0,0.75)',
    justifyContent: 'flex-end',
  },

  countryModal: {
    height: '82%',
    backgroundColor: '#151515',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
  },

  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },

  modalTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
  },

  closeText: {
    color: '#FFFFFF',
    fontSize: 22,
    padding: 5,
  },

  searchInput: {
    height: 48,
    backgroundColor: '#0D0D0D',
    borderRadius: 12,
    borderWidth: 1,
    borderColor:
      'rgba(255,255,255,0.08)',
    color: '#FFFFFF',
    paddingHorizontal: 15,
    fontSize: 14,
    marginBottom: 12,
  },

  countryItem: {
    minHeight: 54,
    paddingHorizontal: 14,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },

  countryItemSelected: {
    backgroundColor:
      'rgba(229,9,20,0.12)',
    borderWidth: 1,
    borderColor:
      'rgba(229,9,20,0.35)',
  },

  countryName: {
    color: '#FFFFFF',
    fontSize: 14,
    flex: 1,
  },

  countryItemCode: {
    color: RED,
    fontSize: 14,
    fontWeight: '800',
    marginLeft: 10,
  },

  emptyCountryText: {
    color: '#777777',
    textAlign: 'center',
    marginTop: 30,
    fontSize: 14,
  },
});
