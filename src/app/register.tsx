import { useMemo, useState } from 'react';

import {
  APP_NAME,
  APP_VERSION,
  APP_YEAR,
} from '../constants/app';

import {
  ActivityIndicator,
  Alert,
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

import { register } from '../api/authApi';

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
  { name: 'Sierra Leone', code: '+232' },
  { name: 'Libéria', code: '+231' },
  { name: 'Guinée équatoriale', code: '+240' },
  { name: 'Cameroun', code: '+237' },
  { name: 'Gabon', code: '+241' },
  { name: 'Congo', code: '+242' },
  { name: 'République démocratique du Congo', code: '+243' },
  { name: 'Tchad', code: '+235' },
  { name: 'République centrafricaine', code: '+236' },
  { name: 'Maroc', code: '+212' },
  { name: 'Algérie', code: '+213' },
  { name: 'Tunisie', code: '+216' },
  { name: 'Égypte', code: '+20' },
  { name: 'Afrique du Sud', code: '+27' },
  { name: 'Éthiopie', code: '+251' },
  { name: 'Kenya', code: '+254' },
  { name: 'Tanzanie', code: '+255' },
  { name: 'Ouganda', code: '+256' },
  { name: 'Rwanda', code: '+250' },
  { name: 'États-Unis', code: '+1' },
  { name: 'Canada', code: '+1' },
  { name: 'France', code: '+33' },
  { name: 'Belgique', code: '+32' },
  { name: 'Suisse', code: '+41' },
  { name: 'Allemagne', code: '+49' },
  { name: 'Italie', code: '+39' },
  { name: 'Espagne', code: '+34' },
  { name: 'Portugal', code: '+351' },
  { name: 'Royaume-Uni', code: '+44' },
  { name: 'Pays-Bas', code: '+31' },
  { name: 'Suède', code: '+46' },
  { name: 'Norvège', code: '+47' },
  { name: 'Danemark', code: '+45' },
  { name: 'Finlande', code: '+358' },
  { name: 'Autriche', code: '+43' },
  { name: 'Irlande', code: '+353' },
  { name: 'Brésil', code: '+55' },
  { name: 'Argentine', code: '+54' },
  { name: 'Mexique', code: '+52' },
  { name: 'Inde', code: '+91' },
  { name: 'Chine', code: '+86' },
  { name: 'Japon', code: '+81' },
  { name: 'Corée du Sud', code: '+82' },
  { name: 'Émirats arabes unis', code: '+971' },
  { name: 'Arabie saoudite', code: '+966' },
  { name: 'Turquie', code: '+90' },
];

export default function RegisterScreen() {
  const [username, setUsername] =
    useState('');

  const [phone, setPhone] =
    useState('');

  const [email, setEmail] =
    useState('');

  const [password, setPassword] =
    useState('');

  const [confirmPassword, setConfirmPassword] =
    useState('');

  const [loading, setLoading] =
    useState(false);

  const [countryModalVisible, setCountryModalVisible] =
    useState(false);

  const [countrySearch, setCountrySearch] =
    useState('');

  const [selectedCountry, setSelectedCountry] =
    useState<Country>(COUNTRIES[0]);

  const passwordsMatch =
    password.length > 0 &&
    confirmPassword.length > 0 &&
    password === confirmPassword;

  const filteredCountries =
    useMemo(() => {
      const search =
        countrySearch.trim().toLowerCase();

      if (!search) {
        return COUNTRIES;
      }

      return COUNTRIES.filter(
        country =>
          country.name
            .toLowerCase()
            .includes(search) ||
          country.code.includes(search)
      );
    }, [countrySearch]);

  const isValid =
    username.trim().length > 0 &&
    phone.trim().length > 0 &&
    password.length >= 8 &&
    passwordsMatch &&
    !loading;

  const cleanPhone = (
    value: string
  ): string => {
    return value.replace(
      /[\s\-()]/g,
      ''
    );
  };

  const buildPhoneNumber = (
    value: string
  ): string => {
    const cleaned =
      cleanPhone(value.trim());

    /*
     * Si l'utilisateur saisit déjà
     * un numéro international complet,
     * on ne rajoute pas l'indicatif.
     */
    if (cleaned.startsWith('+')) {
      return cleaned;
    }

    return `${selectedCountry.code}${cleaned}`;
  };

  const handleSelectCountry = (
    country: Country
  ) => {
    setSelectedCountry(country);
    setCountryModalVisible(false);
    setCountrySearch('');
  };

  const handleRegister =
    async () => {
      if (!isValid || loading) {
        return;
      }

      const finalPhone =
        buildPhoneNumber(phone);

      /*
       * Pour le moment, le backend ScorpionTV
       * attend le format international.
       */
      if (!finalPhone.startsWith('+')) {
        Alert.alert(
          'Numéro invalide',
          'Veuillez saisir un numéro de téléphone valide.'
        );
        return;
      }

      try {
        setLoading(true);

        console.log(
          'INSCRIPTION : création du compte...'
        );

        console.log(
          'INSCRIPTION : numéro saisi :',
          phone
        );

        console.log(
          'INSCRIPTION : indicatif sélectionné :',
          selectedCountry.code
        );

        console.log(
          'INSCRIPTION : numéro envoyé :',
          finalPhone
        );

        const result =
          await register(
            username,
            finalPhone,
            email,
            password,
          );

        console.log(
          'INSCRIPTION : compte créé :',
          result.user
        );

        /*
         * Le token et l'utilisateur ont déjà
         * été sauvegardés par register().
         *
         * On entre directement dans ScorpionTV.
         */
        router.replace('/');

      } catch (error) {
        console.log(
          'INSCRIPTION : erreur :',
          error
        );

        const message =
          error instanceof Error
            ? error.message
            : 'Impossible de créer le compte.';

        Alert.alert(
          'Création du compte',
          message
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
              editable={!loading}
            />

            <Text
              style={[
                styles.label,
                styles.fieldSpacing,
              ]}
            >
              Numéro de téléphone
            </Text>

            <View style={styles.phoneRow}>
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
                  ▾
                </Text>
              </Pressable>

              <TextInput
                style={[
                  styles.input,
                  styles.phoneInput,
                ]}
                placeholder="XX XX XX XX"
                placeholderTextColor="#666666"
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                editable={!loading}
              />
            </View>

            <Text style={styles.phoneHint}>
              Saisis uniquement ton numéro local.
            </Text>

            <Text
              style={[
                styles.label,
                styles.fieldSpacing,
              ]}
            >
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
              editable={!loading}
            />

            <Text
              style={[
                styles.label,
                styles.fieldSpacing,
              ]}
            >
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
              editable={!loading}
            />

            {password.length > 0 &&
              password.length < 8 && (
                <Text style={styles.errorText}>
                  Le mot de passe doit contenir au moins 8 caractères.
                </Text>
              )}

            <Text
              style={[
                styles.label,
                styles.fieldSpacing,
              ]}
            >
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
              editable={!loading}
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
                      styles.registerButtonText,
                      styles.loadingButtonText,
                    ]}
                  >
                    Création du compte...
                  </Text>
                </View>
              ) : (
                <Text
                  style={
                    styles.registerButtonText
                  }
                >
                  Créer mon compte
                </Text>
              )}
            </Pressable>
          </View>

          <View style={styles.loginBox}>
            <Text style={styles.loginText}>
              Tu as déjà un compte ?
            </Text>

            <Pressable
              onPress={() =>
                router.push('/login')
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
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                Indicatif du pays
              </Text>

              <Pressable
                onPress={() =>
                  setCountryModalVisible(false)
                }
              >
                <Text style={styles.closeText}>
                  ✕
                </Text>
              </Pressable>
            </View>

            <TextInput
              style={styles.searchInput}
              placeholder="Rechercher un pays ou indicatif"
              placeholderTextColor="#666666"
              value={countrySearch}
              onChangeText={setCountrySearch}
              autoCapitalize="none"
              autoCorrect={false}
            />

            <FlatList
              data={filteredCountries}
              keyExtractor={item =>
                `${item.name}-${item.code}`
              }
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => (
                <Pressable
                  style={[
                    styles.countryItem,
                    item.code ===
                      selectedCountry.code &&
                      item.name ===
                        selectedCountry.name &&
                      styles.countryItemSelected,
                  ]}
                  onPress={() =>
                    handleSelectCountry(item)
                  }
                >
                  <Text
                    style={styles.countryName}
                  >
                    {item.name}
                  </Text>

                  <Text
                    style={styles.countryItemCode}
                  >
                    {item.code}
                  </Text>
                </Pressable>
              )}
              ListEmptyComponent={
                <Text style={styles.emptyText}>
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
    borderColor:
      'rgba(255,255,255,0.06)',
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
    borderColor:
      'rgba(255,255,255,0.08)',
    color: '#FFFFFF',
    paddingHorizontal: 15,
    fontSize: 15,
  },

  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  countryButton: {
    height: 52,
    minWidth: 82,
    backgroundColor: '#0D0D0D',
    borderRadius: 12,
    borderWidth: 1,
    borderColor:
      'rgba(255,255,255,0.08)',
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },

  countryCode: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },

  countryArrow: {
    color: '#888888',
    fontSize: 13,
    marginLeft: 6,
  },

  phoneInput: {
    flex: 1,
  },

  phoneHint: {
    color: '#666666',
    fontSize: 11,
    marginTop: 7,
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

  modalOverlay: {
    flex: 1,
    backgroundColor:
      'rgba(0,0,0,0.75)',
    justifyContent: 'flex-end',
  },

  countryModal: {
    backgroundColor: '#151515',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 30,
    maxHeight: '82%',
  },

  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 15,
  },

  modalTitle: {
    color: '#FFFFFF',
    fontSize: 19,
    fontWeight: '800',
  },

  closeText: {
    color: '#E50914',
    fontSize: 20,
    fontWeight: '800',
  },

  searchInput: {
    height: 48,
    backgroundColor: '#0D0D0D',
    borderRadius: 12,
    borderWidth: 1,
    borderColor:
      'rgba(255,255,255,0.08)',
    color: '#FFFFFF',
    paddingHorizontal: 14,
    fontSize: 14,
    marginBottom: 10,
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
      'rgba(229,9,20,0.14)',
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
    color: '#E50914',
    fontSize: 14,
    fontWeight: '800',
    marginLeft: 10,
  },

  emptyText: {
    color: '#777777',
    textAlign: 'center',
    paddingVertical: 25,
  },
});
