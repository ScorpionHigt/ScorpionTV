import * as Crypto from 'expo-crypto';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import {
  changePassword,
} from '../api/authApi';

import {
  getLocalProtection,
  saveLocalProtection,
  LocalProtectionMode,
} from '../storage/localProtectionStorage';

const RED = '#E50914';

async function hashPassword(
  password: string
): Promise<string> {
  return Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    password
  );
}

export default function SecurityScreen() {
  const [showAccountPassword, setShowAccountPassword] =
    useState(false);

  const [showLocalPassword, setShowLocalPassword] =
    useState(false);

  const [useSamePassword, setUseSamePassword] =
    useState(true);

  const [accountPassword, setAccountPassword] =
    useState('');

  const [newAccountPassword, setNewAccountPassword] =
    useState('');

  const [confirmAccountPassword, setConfirmAccountPassword] =
    useState('');

  const [localPassword, setLocalPassword] =
    useState('');

  const [confirmLocalPassword, setConfirmLocalPassword] =
    useState('');

  const [changingPassword, setChangingPassword] =
    useState(false);

  const [savingLocalProtection, setSavingLocalProtection] =
    useState(false);

  const [loadingLocalProtection, setLoadingLocalProtection] =
    useState(true);

  useEffect(() => {
    const loadLocalProtectionSettings = async () => {
      try {
        const protection =
          await getLocalProtection();

        if (protection) {
          setUseSamePassword(
            protection.mode === 'same'
          );
        } else {
          setUseSamePassword(true);
        }
      } catch (error) {
        console.error(
          'ERREUR CHARGEMENT PROTECTION LOCALE :',
          error
        );
      } finally {
        setLoadingLocalProtection(false);
      }
    };

    loadLocalProtectionSettings();
  }, []);

  const handleChangeAccountPassword = async () => {
    if (changingPassword) {
      return;
    }

    if (!accountPassword.trim()) {
      Alert.alert(
        'Mot de passe',
        'Entre ton mot de passe actuel.'
      );
      return;
    }

    if (!newAccountPassword) {
      Alert.alert(
        'Mot de passe',
        'Entre ton nouveau mot de passe.'
      );
      return;
    }

    if (newAccountPassword.length < 6) {
      Alert.alert(
        'Mot de passe',
        'Le nouveau mot de passe doit contenir au moins 6 caractères.'
      );
      return;
    }

    if (!confirmAccountPassword) {
      Alert.alert(
        'Mot de passe',
        'Confirme ton nouveau mot de passe.'
      );
      return;
    }

    if (
      newAccountPassword !==
      confirmAccountPassword
    ) {
      Alert.alert(
        'Mot de passe',
        'Les nouveaux mots de passe ne correspondent pas.'
      );
      return;
    }

    if (
      accountPassword ===
      newAccountPassword
    ) {
      Alert.alert(
        'Mot de passe',
        "Le nouveau mot de passe doit être différent de l'ancien."
      );
      return;
    }

    try {
      setChangingPassword(true);

      await changePassword(
        accountPassword,
        newAccountPassword,
        confirmAccountPassword
      );

      /*
       * Si la protection locale utilise le même
       * mot de passe que le compte, on met à jour
       * son vérificateur avec le nouveau mot de passe.
       */
      try {
        const localProtection =
          await getLocalProtection();

        if (
          localProtection &&
          localProtection.mode === 'same'
        ) {
          const newPasswordHash =
            await hashPassword(
              newAccountPassword
            );

          await saveLocalProtection(
            'same',
            newPasswordHash
          );
        }
      } catch (localError) {
        console.error(
          'ERREUR MISE À JOUR PROTECTION LOCALE :',
          localError
        );
      }

      setAccountPassword('');
      setNewAccountPassword('');
      setConfirmAccountPassword('');

      Alert.alert(
        'Mot de passe modifié',
        'Ton mot de passe a été modifié avec succès. Ta nouvelle session est maintenant active.'
      );
    } catch (error) {
      console.error(
        'ERREUR CHANGEMENT MOT DE PASSE :',
        error
      );

      const message =
        error instanceof Error
          ? error.message
          : 'Impossible de modifier le mot de passe.';

      Alert.alert(
        'Modification impossible',
        message
      );
    } finally {
      setChangingPassword(false);
    }
  };

  const handleSaveLocalProtection = async () => {
    if (
      savingLocalProtection ||
      loadingLocalProtection
    ) {
      return;
    }

    try {
      setSavingLocalProtection(true);

      let mode: LocalProtectionMode;
      let passwordToHash: string;

      if (useSamePassword) {
        /*
         * Le mot de passe du compte n'est jamais
         * récupéré depuis le stockage.
         *
         * L'utilisateur doit donc saisir son mot
         * de passe actuel dans la section COMPTE
         * afin que nous puissions créer son hash.
         */
        if (!accountPassword) {
          Alert.alert(
            'Mot de passe requis',
            'Pour utiliser le même mot de passe que ton compte, entre d’abord ton mot de passe actuel dans la section COMPTE.'
          );

          return;
        }

        mode = 'same';
        passwordToHash = accountPassword;
      } else {
        if (!localPassword) {
          Alert.alert(
            'Mot de passe local',
            'Entre un mot de passe local.'
          );

          return;
        }

        if (localPassword.length < 6) {
          Alert.alert(
            'Mot de passe local',
            'Le mot de passe local doit contenir au moins 6 caractères.'
          );

          return;
        }

        if (!confirmLocalPassword) {
          Alert.alert(
            'Mot de passe local',
            'Confirme ton mot de passe local.'
          );

          return;
        }

        if (
          localPassword !==
          confirmLocalPassword
        ) {
          Alert.alert(
            'Mot de passe local',
            'Les deux mots de passe locaux ne correspondent pas.'
          );

          return;
        }

        mode = 'custom';
        passwordToHash = localPassword;
      }

      const passwordHash =
        await hashPassword(passwordToHash);

      await saveLocalProtection(
        mode,
        passwordHash
      );

      setLocalPassword('');
      setConfirmLocalPassword('');

      /*
       * On ne conserve pas le mot de passe
       * dans l'état React après l'enregistrement.
       */
      if (useSamePassword) {
        setAccountPassword('');
      }

      Alert.alert(
        'Protection enregistrée',
        useSamePassword
          ? 'La protection locale utilise maintenant le même mot de passe que ton compte.'
          : 'La protection locale a été enregistrée sur cet appareil.'
      );
    } catch (error) {
      console.error(
        'ERREUR ENREGISTREMENT PROTECTION LOCALE :',
        error
      );

      Alert.alert(
        'Erreur',
        'Impossible d’enregistrer la protection locale.'
      );
    } finally {
      setSavingLocalProtection(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {/* HEADER */}
        <View style={styles.header}>
          <Pressable
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Text style={styles.backText}>
              ‹
            </Text>
          </Pressable>

          <View style={styles.headerTextContainer}>
            <Text style={styles.title}>
              Sécurité
            </Text>

            <Text style={styles.subtitle}>
              Gère les mots de passe de ton compte et
              de ton contenu protégé.
            </Text>
          </View>
        </View>

        {/* MOT DE PASSE DU COMPTE */}
        <Text style={styles.category}>
          COMPTE
        </Text>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.securityIcon}>
              <Text>🔑</Text>
            </View>

            <View style={styles.cardHeaderContent}>
              <Text style={styles.cardTitle}>
                Mot de passe du compte
              </Text>

              <Text style={styles.cardDescription}>
                Modifie le mot de passe utilisé pour
                te connecter à ScorpionTV.
              </Text>
            </View>
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>
              Mot de passe actuel
            </Text>

            <View style={styles.passwordContainer}>
              <TextInput
                value={accountPassword}
                onChangeText={setAccountPassword}
                placeholder="Mot de passe actuel"
                placeholderTextColor="#555555"
                secureTextEntry={!showAccountPassword}
                style={styles.passwordInput}
                autoCapitalize="none"
                autoCorrect={false}
              />

              <Pressable
                style={styles.eyeButton}
                onPress={() =>
                  setShowAccountPassword(
                    !showAccountPassword
                  )
                }
              >
                <Text style={styles.eyeText}>
                  {showAccountPassword
                    ? '🙈'
                    : '👁️'}
                </Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>
              Nouveau mot de passe
            </Text>

            <View style={styles.passwordContainer}>
              <TextInput
                value={newAccountPassword}
                onChangeText={setNewAccountPassword}
                placeholder="Nouveau mot de passe"
                placeholderTextColor="#555555"
                secureTextEntry={!showAccountPassword}
                style={styles.passwordInput}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>
              Confirmer le nouveau mot de passe
            </Text>

            <View style={styles.passwordContainer}>
              <TextInput
                value={confirmAccountPassword}
                onChangeText={
                  setConfirmAccountPassword
                }
                placeholder="Confirmer le mot de passe"
                placeholderTextColor="#555555"
                secureTextEntry={!showAccountPassword}
                style={styles.passwordInput}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
          </View>

          <Pressable
            style={[
              styles.primaryButton,
              changingPassword &&
                styles.primaryButtonDisabled,
            ]}
            onPress={handleChangeAccountPassword}
            disabled={changingPassword}
          >
            {changingPassword ? (
              <View style={styles.loadingButtonContent}>
                <ActivityIndicator
                  size="small"
                  color="#FFFFFF"
                />

                <Text
                  style={[
                    styles.primaryButtonText,
                    styles.loadingButtonText,
                  ]}
                >
                  Modification...
                </Text>
              </View>
            ) : (
              <Text style={styles.primaryButtonText}>
                Modifier le mot de passe
              </Text>
            )}
          </Pressable>
        </View>

        {/* CONTENU PROTÉGÉ */}
        <Text style={styles.category}>
          CONTENU PROTÉGÉ
        </Text>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.securityIcon}>
              <Text>🔒</Text>
            </View>

            <View style={styles.cardHeaderContent}>
              <Text style={styles.cardTitle}>
                Mot de passe local
              </Text>

              <Text style={styles.cardDescription}>
                Protège les catégories et contenus
                nécessitant une autorisation.
              </Text>
            </View>
          </View>

          <View style={styles.samePasswordRow}>
            <View style={styles.samePasswordContent}>
              <Text style={styles.settingTitle}>
                Utiliser le même mot de passe
              </Text>

              <Text style={styles.settingDescription}>
                Utiliser le mot de passe du compte pour
                déverrouiller le contenu protégé.
                {' '}
                De préférence, utilise un code différent.
              </Text>
            </View>

            <Switch
              value={useSamePassword}
              onValueChange={setUseSamePassword}
              trackColor={{
                false: '#333333',
                true: '#7A080E',
              }}
              thumbColor={
                useSamePassword
                  ? RED
                  : '#777777'
              }
              disabled={
                savingLocalProtection
              }
            />
          </View>

          {!useSamePassword && (
            <>
              <View style={styles.separator} />

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>
                  Nouveau mot de passe local
                </Text>

                <View style={styles.passwordContainer}>
                  <TextInput
                    value={localPassword}
                    onChangeText={setLocalPassword}
                    placeholder="Mot de passe local"
                    placeholderTextColor="#555555"
                    secureTextEntry={!showLocalPassword}
                    style={styles.passwordInput}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />

                  <Pressable
                    style={styles.eyeButton}
                    onPress={() =>
                      setShowLocalPassword(
                        !showLocalPassword
                      )
                    }
                  >
                    <Text style={styles.eyeText}>
                      {showLocalPassword
                        ? '🙈'
                        : '👁️'}
                    </Text>
                  </Pressable>
                </View>
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>
                  Confirmer le mot de passe local
                </Text>

                <View style={styles.passwordContainer}>
                  <TextInput
                    value={confirmLocalPassword}
                    onChangeText={
                      setConfirmLocalPassword
                    }
                    placeholder="Confirmer le mot de passe"
                    placeholderTextColor="#555555"
                    secureTextEntry={!showLocalPassword}
                    style={styles.passwordInput}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>
              </View>
            </>
          )}

          <View style={styles.protectedInfo}>
            <Text style={styles.protectedInfoIcon}>
              🛡️
            </Text>

            <Text style={styles.protectedInfoText}>
              Le mot de passe sera vérifié localement
              sur cet appareil. Le mot de passe en
              clair n'est jamais enregistré.
            </Text>
          </View>

          <Pressable
            style={[
              styles.primaryButton,
              (savingLocalProtection ||
                loadingLocalProtection) &&
                styles.primaryButtonDisabled,
            ]}
            onPress={handleSaveLocalProtection}
            disabled={
              savingLocalProtection ||
              loadingLocalProtection
            }
          >
            {savingLocalProtection ? (
              <View style={styles.loadingButtonContent}>
                <ActivityIndicator
                  size="small"
                  color="#FFFFFF"
                />

                <Text
                  style={[
                    styles.primaryButtonText,
                    styles.loadingButtonText,
                  ]}
                >
                  Enregistrement...
                </Text>
              </View>
            ) : (
              <Text style={styles.primaryButtonText}>
                Enregistrer la protection
              </Text>
            )}
          </Pressable>
        </View>

        {/* INFORMATION */}
        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>
            🛡️ Sécurité
          </Text>

          <Text style={styles.infoText}>
            Le mot de passe du compte est géré par
            le serveur ScorpionTV.
            {'\n\n'}
            Le mot de passe de protection du contenu
            est conservé uniquement sous forme de
            vérificateur sécurisé sur cet appareil.
            {'\n\n'}
            Aucune version en clair du mot de passe
            local n'est enregistrée.
          </Text>
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

  content: {
    paddingHorizontal: 20,
    paddingTop: 15,
    paddingBottom: 50,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 30,
  },

  backButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: '#151515',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },

  backText: {
    color: '#FFFFFF',
    fontSize: 32,
    lineHeight: 32,
    marginTop: -3,
  },

  headerTextContainer: {
    flex: 1,
  },

  title: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '800',
  },

  subtitle: {
    color: '#777777',
    fontSize: 13,
    lineHeight: 19,
    marginTop: 6,
  },

  category: {
    color: '#777777',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginBottom: 9,
    marginLeft: 5,
  },

  card: {
    backgroundColor: '#151515',
    borderRadius: 18,
    padding: 16,
    marginBottom: 23,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },

  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },

  securityIcon: {
    width: 46,
    height: 46,
    borderRadius: 13,
    backgroundColor: '#0D0D0D',
    alignItems: 'center',
    justifyContent: 'center',
  },

  cardHeaderContent: {
    flex: 1,
    marginLeft: 12,
  },

  cardTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },

  cardDescription: {
    color: '#777777',
    fontSize: 12,
    lineHeight: 17,
    marginTop: 4,
  },

  inputContainer: {
    marginTop: 14,
  },

  inputLabel: {
    color: '#AAAAAA',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 7,
  },

  passwordContainer: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0D0D0D',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
  },

  passwordInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },

  eyeButton: {
    width: 46,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },

  eyeText: {
    fontSize: 18,
  },

  primaryButton: {
    height: 48,
    borderRadius: 12,
    backgroundColor: RED,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },

  primaryButtonDisabled: {
    opacity: 0.6,
  },

  loadingButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },

  loadingButtonText: {
    marginLeft: 9,
  },

  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },

  samePasswordRow: {
    minHeight: 65,
    flexDirection: 'row',
    alignItems: 'center',
  },

  samePasswordContent: {
    flex: 1,
    marginRight: 12,
  },

  settingTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },

  settingDescription: {
    color: '#777777',
    fontSize: 12,
    lineHeight: 17,
    marginTop: 4,
  },

  separator: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.07)',
    marginVertical: 4,
  },

  protectedInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 18,
    padding: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(229,9,20,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(229,9,20,0.15)',
  },

  protectedInfoIcon: {
    fontSize: 18,
    marginRight: 9,
  },

  protectedInfoText: {
    flex: 1,
    color: '#888888',
    fontSize: 11,
    lineHeight: 17,
  },

  infoBox: {
    padding: 16,
    borderRadius: 15,
    backgroundColor: '#111111',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    marginTop: 2,
  },

  infoTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 8,
  },

  infoText: {
    color: '#777777',
    fontSize: 12,
    lineHeight: 19,
  },
});
