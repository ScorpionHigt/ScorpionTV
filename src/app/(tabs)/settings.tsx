import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { clearLocalProtection } from '../../storage/localProtectionStorage';
import { router } from 'expo-router';
import {
  getAuthUser,
  AuthUser,
} from '../../storage/authStorage';

import { logout } from '../../api/authApi';
import {
  APP_NAME,
  APP_VERSION,
  APP_YEAR,
} from '../../constants/app';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDialog } from '../../components/dialogs/DialogProvider';

/* la cle de stockage des paramètres locaux */
const SETTINGS_STORAGE_KEY = '@ScorpionTV:settings';

type SavedSettings = {
  notificationsEnabled: boolean;
  autoplayEnabled: boolean;
  mobileDataEnabled: boolean;
  darkModeEnabled: boolean;
};

const DEFAULT_SETTINGS: SavedSettings = {
  notificationsEnabled: true,
  autoplayEnabled: true,
  mobileDataEnabled: true,
  darkModeEnabled: true,
};

export default function SettingsScreen() {
  const { showDialog } = useDialog();

  const [notificationsEnabled, setNotificationsEnabled] =
    useState(DEFAULT_SETTINGS.notificationsEnabled);

  const [autoplayEnabled, setAutoplayEnabled] =
    useState(DEFAULT_SETTINGS.autoplayEnabled);

  const [mobileDataEnabled, setMobileDataEnabled] =
    useState(DEFAULT_SETTINGS.mobileDataEnabled);

  const [darkModeEnabled, setDarkModeEnabled] =
    useState(DEFAULT_SETTINGS.darkModeEnabled);

  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const savedSettings = await AsyncStorage.getItem(
          SETTINGS_STORAGE_KEY
        );

        if (savedSettings) {
          const parsedSettings = JSON.parse(
            savedSettings
          ) as Partial<SavedSettings>;

          setNotificationsEnabled(
            parsedSettings.notificationsEnabled ??
              DEFAULT_SETTINGS.notificationsEnabled
          );

          setAutoplayEnabled(
            parsedSettings.autoplayEnabled ??
              DEFAULT_SETTINGS.autoplayEnabled
          );

          setMobileDataEnabled(
            parsedSettings.mobileDataEnabled ??
              DEFAULT_SETTINGS.mobileDataEnabled
          );

          setDarkModeEnabled(
            parsedSettings.darkModeEnabled ??
              DEFAULT_SETTINGS.darkModeEnabled
          );
        }
      } catch (error) {
        console.error(
          'Erreur lors du chargement des paramètres :',
          error
        );
      } finally {
        setIsLoading(false);
      }
    };

    loadSettings();
  }, []);

  useEffect(() => {
    if (isLoading) {
      return;
    }

    const saveSettings = async () => {
      const settingsToSave: SavedSettings = {
        notificationsEnabled,
        autoplayEnabled,
        mobileDataEnabled,
        darkModeEnabled,
      };

      try {
        await AsyncStorage.setItem(
          SETTINGS_STORAGE_KEY,
          JSON.stringify(settingsToSave)
        );

        console.log('Paramètres sauvegardés');
      } catch (error) {
        console.error(
          'Erreur lors de la sauvegarde des paramètres :',
          error
        );
      }
    };

    saveSettings();
  }, [
    notificationsEnabled,
    autoplayEnabled,
    mobileDataEnabled,
    darkModeEnabled,
    isLoading,
  ]);

  const handleClearCache = () => {
    showDialog({
      title: 'Vider le cache',
      message:
        'Cette action supprimera les données temporaires de ScorpionTV.',
      icon: '🗑️',
      buttons: [
        {
          label: 'Annuler',
          variant: 'secondary',
        },
        {
          label: 'Vider',
          variant: 'danger',
          onPress: async () => {
            try {
              await Promise.all([
                AsyncStorage.removeItem(
                  SETTINGS_STORAGE_KEY
                ),
                clearLocalProtection(),
              ]);

              setNotificationsEnabled(
                DEFAULT_SETTINGS.notificationsEnabled
              );

              setAutoplayEnabled(
                DEFAULT_SETTINGS.autoplayEnabled
              );

              setMobileDataEnabled(
                DEFAULT_SETTINGS.mobileDataEnabled
              );

              setDarkModeEnabled(
                DEFAULT_SETTINGS.darkModeEnabled
              );

              showDialog({
                title: 'Cache vidé',
                message:
                  'Les paramètres ont été réinitialisés.',
                icon: '✅',
              });
            } catch (error) {
              console.error(
                'Erreur lors de la suppression du cache :',
                error
              );

              showDialog({
                title: 'Erreur',
                message:
                  'Impossible de vider le cache.',
                icon: '⚠️',
              });
            }
          },
        },
      ],
    });
  };

 
const handleLogout = () => {
  showDialog({
    title: 'Déconnexion',
    message:
      'Voulez-vous vraiment vous déconnecter ?',
    icon: '🚪',
    buttons: [
      {
        label: 'Annuler',
        variant: 'secondary',
      },
      {
        label: 'Se déconnecter',
        variant: 'danger',
        onPress: async () => {
          try {
            console.log(
              'DÉCONNEXION DEMANDÉE',
            );

            await logout();

            console.log(
              'DÉCONNEXION SERVEUR TERMINÉE',
            );

            router.replace('/login');
          } catch (error) {
            console.error(
              'ERREUR DÉCONNEXION :',
              error,
            );

            // Même en cas d'erreur réseau,
            // on retourne vers l'écran de connexion.
            router.replace('/login');
          }
        },
      },
    ],
  });
};

  const handleVideoQuality = () => {
    showDialog({
      title: 'Qualité vidéo',
      message:
        'Le choix de la qualité sera disponible prochainement.',
      icon: '📺',
    });
  };

  const handleAbout = () => {
    showDialog({
      title: APP_NAME,
      message:
        `${APP_NAME} • v${APP_VERSION} © ${APP_YEAR}
        PlumaSoft inc\n\n` +
        'Votre plateforme de télévision, films et séries.',
      icon: 'ℹ️',
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.title}>
            Paramètres
          </Text>

          <Text style={styles.subtitle}>
            Personnalise ton expérience ScorpionTV
          </Text>
        </View>

        <Text style={styles.category}>
          APPLICATION
        </Text>

        <View style={styles.card}>
          <View style={styles.settingRow}>
            <View style={styles.settingIcon}>
              <Text>🔔</Text>
            </View>

            <View style={styles.settingContent}>
              <Text style={styles.settingTitle}>
                Notifications
              </Text>

              <Text style={styles.settingDescription}>
                Recevoir les messages et alertes
              </Text>
            </View>

            <Switch
              value={notificationsEnabled}
              onValueChange={setNotificationsEnabled}
              trackColor={{
                false: '#333333',
                true: '#7A080E',
              }}
              thumbColor={
                notificationsEnabled
                  ? '#E50914'
                  : '#777777'
              }
            />
          </View>

          <View style={styles.separator} />

          <View style={styles.settingRow}>
            <View style={styles.settingIcon}>
              <Text>🎨</Text>
            </View>

            <View style={styles.settingContent}>
              <Text style={styles.settingTitle}>
                Mode sombre
              </Text>

              <Text style={styles.settingDescription}>
                Utiliser le thème sombre
              </Text>
            </View>

            <Switch
              value={darkModeEnabled}
              onValueChange={setDarkModeEnabled}
              trackColor={{
                false: '#333333',
                true: '#7A080E',
              }}
              thumbColor={
                darkModeEnabled
                  ? '#E50914'
                  : '#777777'
              }
            />
          </View>
        </View>

        <Text style={styles.category}>
          LECTURE
        </Text>

        <View style={styles.card}>
          <View style={styles.settingRow}>
            <View style={styles.settingIcon}>
              <Text>▶️</Text>
            </View>

            <View style={styles.settingContent}>
              <Text style={styles.settingTitle}>
                Lecture automatique
              </Text>

              <Text style={styles.settingDescription}>
                Lire automatiquement les vidéos
              </Text>
            </View>

            <Switch
              value={autoplayEnabled}
              onValueChange={setAutoplayEnabled}
              trackColor={{
                false: '#333333',
                true: '#7A080E',
              }}
              thumbColor={
                autoplayEnabled
                  ? '#E50914'
                  : '#777777'
              }
            />
          </View>

          <View style={styles.separator} />

          <Pressable
            style={styles.settingRow}
            onPress={handleVideoQuality}
          >
            <View style={styles.settingIcon}>
              <Text>📺</Text>
            </View>

            <View style={styles.settingContent}>
              <Text style={styles.settingTitle}>
                Qualité vidéo
              </Text>

              <Text style={styles.settingDescription}>
                Automatique
              </Text>
            </View>

            <Text style={styles.arrow}>
              ›
            </Text>
          </Pressable>

          <View style={styles.separator} />

          <View style={styles.settingRow}>
            <View style={styles.settingIcon}>
              <Text>📶</Text>
            </View>

            <View style={styles.settingContent}>
              <Text style={styles.settingTitle}>
                Données mobiles
              </Text>

              <Text style={styles.settingDescription}>
                Autoriser le streaming sur réseau mobile
              </Text>
            </View>

            <Switch
              value={mobileDataEnabled}
              onValueChange={setMobileDataEnabled}
              trackColor={{
                false: '#333333',
                true: '#7A080E',
              }}
              thumbColor={
                mobileDataEnabled
                  ? '#E50914'
                  : '#777777'
              }
            />
          </View>
        </View>

        <Text style={styles.category}>
          STOCKAGE
        </Text>

        <View style={styles.card}>
          <Pressable
            style={styles.settingRow}
            onPress={handleClearCache}
          >
            <View style={styles.settingIcon}>
              <Text>🗑️</Text>
            </View>

            <View style={styles.settingContent}>
              <Text style={styles.settingTitle}>
                Vider le cache
              </Text>

              <Text style={styles.settingDescription}>
                Supprimer les paramètres enregistrés
              </Text>
            </View>

            <Text style={styles.arrow}>
              ›
            </Text>
          </Pressable>
        </View>

        <Text style={styles.category}>
          COMPTE
        </Text>

        <View style={styles.card}>
          <Pressable
            style={styles.settingRow}
            onPress={() => {
              router.push('/security');
            }}
          >
            <View style={styles.settingIcon}>
              <Text>🔐</Text>
            </View>

            <View style={styles.settingContent}>
              <Text style={styles.settingTitle}>
                Sécurité
              </Text>

              <Text style={styles.settingDescription}>
                Mot de passe et sécurité du compte
              </Text>
            </View>

            <Text style={styles.arrow}>
              ›
            </Text>
          </Pressable>

          <View style={styles.separator} />

          <Pressable
            style={styles.settingRow}
            onPress={handleLogout}
          >
            <View style={styles.settingIcon}>
              <Text>🚪</Text>
            </View>

            <View style={styles.settingContent}>
              <Text style={styles.logoutTitle}>
                Se déconnecter
              </Text>

              <Text style={styles.settingDescription}>
                Quitter ton compte ScorpionTV
              </Text>
            </View>

            <Text style={styles.arrow}>
              ›
            </Text>
          </Pressable>

          
          <Pressable
            style={styles.settingRow}
            onPress={handleLogout}
          >
            <View style={styles.settingIcon}>
              <Text>♾️</Text>
            </View>

            <View style={styles.settingContent}>
              <Text style={styles.logoutTitle}>
                Restorer les valeurs d'usine
              </Text>

              <Text style={styles.settingDescription}>
                cela supprime toutes vos données ScorpionTV
              </Text>
            </View>

            <Text style={styles.arrow}>
              ›
            </Text>
          </Pressable>
        </View>

        <Text style={styles.category}>
          À PROPOS
        </Text>

        <View style={styles.card}>
          <Pressable
            style={styles.settingRow}
            onPress={handleAbout}
          >
            <View style={styles.settingIcon}>
              <Text>ℹ️</Text>
            </View>

            <View style={styles.settingContent}>
              <Text style={styles.settingTitle}>
                À propos de ScorpionTV
              </Text>

              <Text style={styles.settingDescription}>
                Informations sur l'application
              </Text>
            </View>

            <Text style={styles.arrow}>
              ›
            </Text>
          </Pressable>
        </View>

        <Text style={styles.version}>
          {APP_NAME} • v{APP_VERSION} © {APP_YEAR}  PlumaSoft inc
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
    paddingTop: 25,
    paddingBottom: 40,
  },

  header: {
    marginBottom: 28,
  },

  title: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '800',
  },

  subtitle: {
    color: '#777777',
    fontSize: 14,
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
    paddingHorizontal: 16,
    marginBottom: 23,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },

  settingRow: {
    minHeight: 70,
    flexDirection: 'row',
    alignItems: 'center',
  },

  settingIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#0D0D0D',
    alignItems: 'center',
    justifyContent: 'center',
  },

  settingContent: {
    flex: 1,
    marginLeft: 12,
    marginRight: 10,
  },

  settingTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },

  logoutTitle: {
    color: '#E50914',
    fontSize: 15,
    fontWeight: '700',
  },

  settingDescription: {
    color: '#777777',
    fontSize: 12,
    marginTop: 4,
    lineHeight: 17,
  },

  separator: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },

  arrow: {
    color: '#777777',
    fontSize: 28,
    marginLeft: 5,
  },

  version: {
    color: '#555555',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 5,
  },

  copyright: {
    color: '#444444',
    fontSize: 11,
    textAlign: 'center',
    marginTop: 5,
  },
});
