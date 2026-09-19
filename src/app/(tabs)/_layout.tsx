import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as NavigationBar from 'expo-navigation-bar';

import TVIcon from '../../assets/icons/tv.svg';
import ExchangesIcon from '../../assets/icons/exchanges.svg';
import SubscriptionIcon from '../../assets/icons/subscription.svg';
import ProfileIcon from '../../assets/icons/profile.svg';
import SettingsIcon from '../../assets/icons/settings.svg';

import {
  getAuthToken,
  getAuthUser,
} from '../../storage/authStorage';

import {
  getUnreadNotificationCount,
} from '../../database/notificationRepository';

const ACTIVE_COLOR = '#E50914';
const INACTIVE_COLOR = '#777777';

export default function TabsLayout() {
  const insets = useSafeAreaInsets();

  const [authChecked, setAuthChecked] =
    useState(false);

  const [
    unreadNotificationCount,
    setUnreadNotificationCount,
  ] = useState(0);

  /**
   * Vérification de l'authentification
   *
   * Si aucun token actif n'est trouvé,
   * l'utilisateur est directement envoyé vers Login.
   */
  useEffect(() => {
    const checkAuthentication =
      async () => {
        try {
          const token = await getAuthToken();
          const user = await getAuthUser();

          if (!token || !user) {
            router.replace('/login');
            return;
          }

          setAuthChecked(true);
        } catch (error) {
          console.error(
            'ERREUR VÉRIFICATION AUTHENTIFICATION :',
            error
          );

          router.replace('/login');
        }
      };

    checkAuthentication();
  }, []);

  const loadUnreadNotificationCount =
    useCallback(async () => {
      try {
        const user = await getAuthUser();

        if (!user) {
          setUnreadNotificationCount(0);
          return;
        }

        const count =
          await getUnreadNotificationCount(
            user.id
          );

        setUnreadNotificationCount(count);
      } catch (error) {
        console.error(
          'ERREUR COMPTEUR NOTIFICATIONS TABS :',
          error
        );

        setUnreadNotificationCount(0);
      }
    }, []);

  useEffect(() => {
    if (Platform.OS === 'android') {
      NavigationBar.setStyle('light');
    }
  }, []);

  useEffect(() => {
    if (!authChecked) {
      return;
    }

    loadUnreadNotificationCount();
  }, [
    authChecked,
    loadUnreadNotificationCount,
  ]);

  /**
   * Pendant la vérification du token,
   * on n'affiche pas encore les Tabs.
   */
  if (!authChecked) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator
          size="large"
          color={ACTIVE_COLOR}
        />
      </View>
    );
  }

  return (
    <Tabs
      initialRouteName="index"

      screenListeners={{
        focus: () => {
          loadUnreadNotificationCount();
        },
      }}

      screenOptions={{
        headerShown: false,

        tabBarStyle: {
          position: 'absolute',

          left: 12,
          right: 12,
          bottom: Math.max(insets.bottom, 8),

          height: 64,

          backgroundColor:
            'rgba(17, 17, 17, 0.92)',

          borderTopWidth: 1,
          borderTopColor:
            'rgba(255, 255, 255, 0.08)',

          borderRadius: 24,

          paddingTop: 6,
          paddingBottom: 6,

          elevation: 12,

          shadowColor: '#000',
          shadowOffset: {
            width: 0,
            height: 5,
          },
          shadowOpacity: 0.35,
          shadowRadius: 10,
        },

        tabBarActiveTintColor:
          ACTIVE_COLOR,

        tabBarInactiveTintColor:
          INACTIVE_COLOR,

        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '600',
          marginTop: 1,
        },

        tabBarItemStyle: {
          height: 52,
        },
      }}
    >
      {/* ÉCHANGES */}
      <Tabs.Screen
        name="exchanges"
        options={{
          title: 'Échanges',

          tabBarIcon: ({ color }) => (
            <View style={styles.iconContainer}>
              <ExchangesIcon
                width={23}
                height={23}
                color={color}
              />

              {unreadNotificationCount > 0 && (
                <View style={styles.tabBadge}>
                  <Text style={styles.tabBadgeText}>
                    {unreadNotificationCount > 99
                      ? '99+'
                      : unreadNotificationCount}
                  </Text>
                </View>
              )}
            </View>
          ),
        }}
      />

      {/* ABONNEMENT */}
      <Tabs.Screen
        name="subscription"
        options={{
          title: 'Abonnement',

          tabBarIcon: ({ color }) => (
            <SubscriptionIcon
              width={23}
              height={23}
              color={color}
            />
          ),
        }}
      />

      {/* TV — BOUTON CENTRAL */}
      <Tabs.Screen
        name="index"
        options={{
          title: 'TV',

          tabBarIcon: ({
            color,
            focused,
          }) => (
            <View
              style={[
                styles.tvButton,
                focused &&
                  styles.tvButtonActive,
              ]}
            >
              <TVIcon
                width={
                  focused ? 29 : 26
                }
                height={
                  focused ? 29 : 26
                }
                color={color}
              />
            </View>
          ),
        }}
      />

      {/* PROFIL */}
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profil',

          tabBarIcon: ({ color }) => (
            <ProfileIcon
              width={23}
              height={23}
              color={color}
            />
          ),
        }}
      />

      {/* PARAMÈTRES */}
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Paramètres',

          tabBarIcon: ({ color }) => (
            <SettingsIcon
              width={23}
              height={23}
              color={color}
            />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: '#080808',
    alignItems: 'center',
    justifyContent: 'center',
  },

  iconContainer: {
    width: 28,
    height: 28,

    alignItems: 'center',
    justifyContent: 'center',

    position: 'relative',
  },

  tabBadge: {
    position: 'absolute',

    top: -7,
    right: -8,

    minWidth: 17,
    height: 17,

    paddingHorizontal: 4,

    borderRadius: 9,

    backgroundColor: ACTIVE_COLOR,

    borderWidth: 1.5,
    borderColor: '#111111',

    alignItems: 'center',
    justifyContent: 'center',
  },

  tabBadgeText: {
    color: '#FFFFFF',

    fontSize: 8,
    fontWeight: '900',

    textAlign: 'center',
  },

  tvButton: {
    width: 48,
    height: 48,

    marginTop: -13,

    borderRadius: 24,

    alignItems: 'center',
    justifyContent: 'center',

    backgroundColor:
      'rgba(30, 30, 30, 0.98)',

    borderWidth: 1,
    borderColor:
      'rgba(255, 255, 255, 0.08)',

    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 5,
    },
    shadowOpacity: 0.35,
    shadowRadius: 8,

    elevation: 10,
  },

  tvButtonActive: {
    backgroundColor:
      'rgba(229, 9, 20, 0.16)',

    borderColor:
      'rgba(229, 9, 20, 0.45)',
  },
});
