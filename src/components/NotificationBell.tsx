import { useCallback, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
} from 'react-native';
import {
  router,
  useFocusEffect,
} from 'expo-router';

import { getAuthUser } from '../storage/authStorage';
import {
  getUnreadNotificationCount,
} from '../database/notificationRepository';

const RED = '#E50914';

type NotificationBellProps = {
  size?: number;
};

export default function NotificationBell({
  size = 46,
}: NotificationBellProps) {
  const [unreadCount, setUnreadCount] = useState(0);

  const loadUnreadCount = useCallback(
    async () => {
      try {
        const user = await getAuthUser();

        if (!user) {
          setUnreadCount(0);
          return;
        }

        const count =
          await getUnreadNotificationCount(
            user.id
          );

        setUnreadCount(count);
      } catch (error) {
        console.error(
          'ERREUR COMPTEUR NOTIFICATIONS :',
          error
        );

        setUnreadCount(0);
      }
    },
    []
  );

  useFocusEffect(
    useCallback(() => {
      loadUnreadCount();
    }, [loadUnreadCount])
  );

  const handlePress = () => {
    router.push('/notifications');
  };

  return (
    <Pressable
      style={[
        styles.button,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
        },
      ]}
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel="Notifications"
    >
      <Text style={styles.bell}>
        🔔
      </Text>

      {unreadCount > 0 && (
        <Text style={styles.badge}>
          {unreadCount > 99
            ? '99+'
            : unreadCount}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: '#151515',

    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',

    alignItems: 'center',
    justifyContent: 'center',

    position: 'relative',
  },

  bell: {
    fontSize: 22,
  },

  badge: {
    position: 'absolute',

    top: -4,
    right: -4,

    minWidth: 20,
    height: 20,

    paddingHorizontal: 5,

    borderRadius: 10,

    backgroundColor: RED,

    borderWidth: 2,
    borderColor: '#080808',

    color: '#FFFFFF',

    fontSize: 10,
    fontWeight: '900',

    textAlign: 'center',
    lineHeight: 16,
  },
});
