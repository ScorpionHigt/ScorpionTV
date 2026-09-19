import {
  useCallback,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  router,
  useFocusEffect,
} from 'expo-router';

import {
  SafeAreaView,
} from 'react-native-safe-area-context';

import { getAuthUser } from '../storage/authStorage';

import {
  getNotificationsForUser,
  markNotificationAsRead,
  deleteNotification,
  LocalNotification,
} from '../database/notificationRepository';

import {
  syncUserNotifications,
} from '../services/notificationService';

const RED = '#E50914';

export default function NotificationsScreen() {
  const [
    notifications,
    setNotifications,
  ] = useState<LocalNotification[]>([]);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    refreshing,
    setRefreshing,
  ] = useState(false);

  const loadNotifications =
    useCallback(async () => {
      try {
        const user =
          await getAuthUser();

        if (!user) {
          setNotifications([]);
          return;
        }

        /*
         * On récupère d'abord les nouvelles
         * notifications depuis l'API.
         */
        await syncUserNotifications(
          user.id
        );

        /*
         * Puis on affiche tout ce qui est
         * actuellement stocké dans SQLite.
         */
        const localNotifications =
          await getNotificationsForUser(
            user.id
          );

        setNotifications(
          localNotifications
        );
      } catch (error) {
        console.error(
          'ERREUR CHARGEMENT NOTIFICATIONS :',
          error
        );

        Alert.alert(
          'Notifications',
          'Impossible de charger les notifications.'
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    }, []);

  useFocusEffect(
    useCallback(() => {
      loadNotifications();
    }, [loadNotifications])
  );

  const handleRefresh =
    useCallback(() => {
      setRefreshing(true);
      loadNotifications();
    }, [loadNotifications]);

  const handleNotificationPress =
    async (
      notification: LocalNotification
    ) => {
      try {
        if (!notification.is_read) {
          await markNotificationAsRead(
            notification.id
          );

          setNotifications(
            (current) =>
              current.map((item) =>
                item.id === notification.id
                  ? {
                      ...item,
                      is_read: true,
                    }
                  : item
              )
          );
        }
      } catch (error) {
        console.error(
          'ERREUR LECTURE NOTIFICATION :',
          error
        );
      }
    };

  const handleDelete =
    (notification: LocalNotification) => {
      Alert.alert(
        'Supprimer la notification',
        'Voulez-vous supprimer cette notification ?',
        [
          {
            text: 'Annuler',
            style: 'cancel',
          },
          {
            text: 'Supprimer',
            style: 'destructive',
            onPress: async () => {
              try {
                await deleteNotification(
                  notification.id
                );

                setNotifications(
                  (current) =>
                    current.filter(
                      (item) =>
                        item.id !==
                        notification.id
                    )
                );
              } catch (error) {
                console.error(
                  'ERREUR SUPPRESSION NOTIFICATION :',
                  error
                );

                Alert.alert(
                  'Erreur',
                  'Impossible de supprimer cette notification.'
                );
              }
            },
          },
        ]
      );
    };

  const formatDate =
    (dateString: string) => {
      const date =
        new Date(dateString);

      if (Number.isNaN(
        date.getTime()
      )) {
        return dateString;
      }

      return date.toLocaleDateString(
        'fr-FR',
        {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        }
      );
    };

  const renderNotification =
    ({
      item,
    }: {
      item: LocalNotification;
    }) => (
      <Pressable
        style={[
          styles.notificationCard,
          !item.is_read &&
            styles.unreadCard,
        ]}
        onPress={() =>
          handleNotificationPress(item)
        }
      >
        {!item.is_read && (
          <View style={styles.unreadDot} />
        )}

        <View style={styles.notificationContent}>
          <View style={styles.notificationHeader}>
            <Text
              style={styles.notificationTitle}
              numberOfLines={2}
            >
              {item.title}
            </Text>

            <Pressable
              style={styles.deleteButton}
              onPress={() =>
                handleDelete(item)
              }
              hitSlop={8}
            >
              <Text style={styles.deleteIcon}>
                🗑️
              </Text>
            </Pressable>
          </View>

          <Text style={styles.message}>
            {item.message}
          </Text>

          <Text style={styles.date}>
            {formatDate(item.created_at)}
          </Text>
        </View>
      </Pressable>
    );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator
            size="large"
            color={RED}
          />

          <Text style={styles.loadingText}>
            Chargement des notifications...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Text style={styles.backIcon}>
            ‹
          </Text>
        </Pressable>

        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>
            Notifications
          </Text>

          {notifications.length > 0 && (
            <Text style={styles.count}>
              {notifications.length}
            </Text>
          )}
        </View>

        <View style={styles.headerSpacer} />
      </View>

      {notifications.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>
            🔔
          </Text>

          <Text style={styles.emptyTitle}>
            Aucune notification
          </Text>

          <Text style={styles.emptyDescription}>
            Vous n'avez aucune nouvelle notification
            pour le moment.
          </Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) =>
            String(item.id)
          }
          renderItem={renderNotification}
          contentContainerStyle={
            styles.listContent
          }
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={RED}
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#080808',
  },

  header: {
    height: 68,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor:
      'rgba(255,255,255,0.06)',
  },

  backButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#151515',
    alignItems: 'center',
    justifyContent: 'center',
  },

  backIcon: {
    color: '#FFFFFF',
    fontSize: 34,
    lineHeight: 36,
    fontWeight: '300',
    marginTop: -4,
  },

  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  headerTitle: {
    color: '#FFFFFF',
    fontSize: 21,
    fontWeight: '800',
  },

  count: {
    minWidth: 22,
    height: 22,
    paddingHorizontal: 6,
    borderRadius: 11,
    backgroundColor: RED,
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
    textAlign: 'center',
    lineHeight: 22,
  },

  headerSpacer: {
    width: 42,
  },

  listContent: {
    padding: 16,
    paddingBottom: 110,
    gap: 12,
  },

  notificationCard: {
    position: 'relative',
    flexDirection: 'row',
    backgroundColor: '#151515',
    borderRadius: 16,
    borderWidth: 1,
    borderColor:
      'rgba(255,255,255,0.07)',
    overflow: 'hidden',
  },

  unreadCard: {
    borderColor:
      'rgba(229,9,20,0.35)',
  },

  unreadDot: {
    position: 'absolute',
    top: 18,
    left: 10,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: RED,
  },

  notificationContent: {
    flex: 1,
    padding: 16,
    paddingLeft: 22,
  },

  notificationHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },

  notificationTitle: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 21,
    paddingRight: 10,
  },

  deleteButton: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#202020',
    alignItems: 'center',
    justifyContent: 'center',
  },

  deleteIcon: {
    fontSize: 15,
  },

  message: {
    color: '#AAAAAA',
    fontSize: 14,
    lineHeight: 21,
    marginTop: 10,
  },

  date: {
    color: '#666666',
    fontSize: 11,
    marginTop: 12,
  },

  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  loadingText: {
    color: '#777777',
    fontSize: 14,
    marginTop: 14,
  },

  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 35,
  },

  emptyIcon: {
    fontSize: 55,
    marginBottom: 18,
  },

  emptyTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
  },

  emptyDescription: {
    color: '#777777',
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    marginTop: 10,
  },
});
