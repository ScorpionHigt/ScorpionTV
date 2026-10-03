
import { useCallback, useState } from 'react';

import {
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  router,
  useFocusEffect,
  useLocalSearchParams,
} from 'expo-router';

import { SafeAreaView } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';

import { getAuthUser } from '../storage/authStorage';

import { useDialog } from '../components/dialogs/DialogProvider';

import {
  getNotificationsForUser,
  markNotificationAsRead,
  deleteNotification,
  LocalNotification,
} from '../database/notificationRepository';

import { syncUserNotifications } from '../services/notificationService';

const RED = '#E50914';

const INTERNAL_ROUTES = [
  '/subscription',
  '/profile',
  '/live',
  '/movies',
  '/series',
  '/orders',
  '/notifications',
] as const;

type InternalRoute = (typeof INTERNAL_ROUTES)[number];

export default function NotificationsScreen() {
  const { showDialog } = useDialog();

  const { notificationId } = useLocalSearchParams<{
    notificationId?: string;
  }>();

  const [highlightedNotificationId, setHighlightedNotificationId] =
    useState<number | null>(null);

  const [selectedNotificationIds, setSelectedNotificationIds] =
    useState<Set<number>>(new Set());

  const [notifications, setNotifications] =
    useState<LocalNotification[]>([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const handleNavigate = useCallback(
    async (rawLink: string) => {
      try {
        const link = rawLink.trim();

        if (!link) return;

        // Liens internes sous forme scorpiontv://subscription
        // ou scorpiontv:///subscription
        if (/^scorpiontv:\/\//i.test(link)) {
          const path = link
            .replace(/^scorpiontv:\/\//i, '')
            .replace(/^\/+/, '')
            .split(/[?#]/)[0];

          const route = `/${path}` as InternalRoute;

          if (
            INTERNAL_ROUTES.includes(route as InternalRoute)
          ) {
            router.push(route as any);
            return;
          }

          showDialog({
            title: 'Page indisponible',
            message: 'Cette destination de ScorpionTV n’est pas reconnue.',
            icon: '⚠️',
          });
          return;
        }

        // Chemins internes directs : /subscription, /live...
        if (link.startsWith('/')) {
          const pathname = link.split(/[?#]/)[0];

          if (
            INTERNAL_ROUTES.includes(pathname as InternalRoute)
          ) {
            router.push(link as any);
            return;
          }

          showDialog({
            title: 'Page indisponible',
            message: 'Cette page de ScorpionTV n’est pas reconnue.',
            icon: '⚠️',
          });
          return;
        }

        // Liens web
        const url = /^https?:\/\//i.test(link)
          ? link
          : /^www\./i.test(link)
            ? `https://${link}`
            : null;

        if (!url) {
          showDialog({
            title: 'Lien non reconnu',
            message: 'Ce lien ne peut pas être ouvert.',
            icon: '⚠️',
          });
          return;
        }

        await Linking.openURL(url);
      } catch (error) {
        console.error('ERREUR NAVIGATION NOTIFICATION :', error);

        showDialog({
          title: 'Erreur',
          message: 'Impossible d’ouvrir cette destination.',
          icon: '⚠️',
        });
      }
    },
    [showDialog],
  );

  const handleCopyNotification = useCallback(
    async (notification: LocalNotification) => {
      try {
        const content =
          `${notification.title}\n\n${notification.message}`;

        await Clipboard.setStringAsync(content);

        showDialog({
          title: 'Copié',
          message: 'La notification a été copiée dans le presse-papiers.',
          icon: '✓',
        });
      } catch (error) {
        console.error('ERREUR COPIE NOTIFICATION :', error);

        showDialog({
          title: 'Copie impossible',
          message: 'Impossible de copier cette notification.',
          icon: '⚠️',
        });
      }
    },
    [showDialog],
  );

  const renderInteractiveMessage = useCallback(
    (message: string) => {
      // Détecte les liens web et les destinations ScorpionTV.
      const linkRegex =
        /(https?:\/\/[^\s]+|www\.[^\s]+|scorpiontv:\/\/[^\s]+|\/(?:subscription|profile|live|movies|series|orders|notifications)(?:\?[^\s]*)?)/gi;

      const parts = message.split(linkRegex);

      return parts.map((part, index) => {
        const isLink =
          /^(https?:\/\/|www\.|scorpiontv:\/\/|\/(?:subscription|profile|live|movies|series|orders|notifications)(?:\?|$))/i.test(
            part,
          );

        if (!isLink) {
          return <Text key={index}>{part}</Text>;
        }

        // Retire la ponctuation finale souvent accolée au lien.
        const match = part.match(/^(.*?)([.,;!?)]*)$/);
        const link = match?.[1] ?? part;
        const punctuation = match?.[2] ?? '';

        return (
          <Text key={index}>
            <Text
              style={styles.messageLink}
              onPress={() => handleNavigate(link)}
              accessibilityRole="link"
            >
              {link}
            </Text>
            {punctuation}
          </Text>
        );
      });
    },
    [handleNavigate],
  );

  const loadNotifications = useCallback(async () => {
    try {
      const user = await getAuthUser();

      if (!user) {
        setNotifications([]);
        setSelectedNotificationIds(new Set());
        return;
      }

      await syncUserNotifications(user.id);

      const localNotifications =
        await getNotificationsForUser(user.id);

      setNotifications(localNotifications);

      // Supprime de la sélection les notifications disparues.
      const existingIds = new Set(
        localNotifications.map((item) => item.id),
      );

      setSelectedNotificationIds((current) => {
        const next = new Set<number>();

        current.forEach((id) => {
          if (existingIds.has(id)) next.add(id);
        });

        return next;
      });

      if (notificationId) {
        const clickedNotification =
          localNotifications.find(
            (item) => String(item.id) === String(notificationId),
          );

        const id = Number(notificationId);

        if (Number.isFinite(id)) {
          setHighlightedNotificationId(id);
        }

        if (clickedNotification) {
          console.log(
            'NOTIFICATIONS : notification cliquée retrouvée :',
            clickedNotification.id,
          );
        } else {
          console.log(
            'NOTIFICATIONS : notification cliquée introuvable dans SQLite :',
            notificationId,
          );
        }
      }
    } catch (error) {
      console.error('ERREUR CHARGEMENT NOTIFICATIONS :', error);

      showDialog({
        title: 'Notifications',
        message: 'Impossible de charger les notifications.',
        icon: '⚠️',
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [notificationId, showDialog]);

  useFocusEffect(
    useCallback(() => {
      loadNotifications();
    }, [loadNotifications]),
  );

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadNotifications();
  }, [loadNotifications]);

  const handleNotificationPress = useCallback(
    async (notification: LocalNotification) => {
      try {
        if (!notification.is_read) {
          await markNotificationAsRead(notification.id);

          setNotifications((current) =>
            current.map((item) =>
              item.id === notification.id
                ? { ...item, is_read: true }
                : item,
            ),
          );
        }
      } catch (error) {
        console.error('ERREUR LECTURE NOTIFICATION :', error);
      }
    },
    [],
  );

  const toggleNotificationSelection = useCallback(
    (id: number) => {
      setSelectedNotificationIds((current) => {
        const next = new Set(current);

        if (next.has(id)) {
          next.delete(id);
        } else {
          next.add(id);
        }

        return next;
      });
    },
    [],
  );

  const allSelected =
    notifications.length > 0 &&
    selectedNotificationIds.size === notifications.length;

  const toggleSelectAll = useCallback(() => {
    setSelectedNotificationIds((current) => {
      if (
        current.size === notifications.length &&
        notifications.length > 0
      ) {
        return new Set();
      }

      return new Set(
        notifications.map((notification) => notification.id),
      );
    });
  }, [notifications]);

  const handleDeleteSelected = useCallback(() => {
    const ids = Array.from(selectedNotificationIds);

    if (ids.length === 0) return;

    showDialog({
      type: 'confirm',
      title: 'Supprimer les notifications',
      message:
        ids.length === 1
          ? 'Voulez-vous supprimer la notification sélectionnée ?'
          : `Voulez-vous supprimer les ${ids.length} notifications sélectionnées ?`,
      confirmLabel: 'Supprimer',
      cancelLabel: 'Annuler',
      danger: true,
      onConfirm: async () => {
        try {
          for (const id of ids) {
            await deleteNotification(id);
          }

          const deletedIds = new Set(ids);

          setNotifications((current) =>
            current.filter(
              (notification) => !deletedIds.has(notification.id),
            ),
          );

          setSelectedNotificationIds(new Set());
        } catch (error) {
          console.error(
            'ERREUR SUPPRESSION NOTIFICATIONS :',
            error,
          );

          showDialog({
            title: 'Notifications',
            message:
              'Impossible de supprimer toutes les notifications sélectionnées.',
            icon: '⚠️',
          });
        }
      },
    });
  }, [selectedNotificationIds, showDialog]);

  const handleDelete = useCallback(
    (notification: LocalNotification) => {
      showDialog({
        type: 'confirm',
        title: 'Supprimer la notification',
        message: 'Voulez-vous supprimer cette notification ?',
        confirmLabel: 'Supprimer',
        cancelLabel: 'Annuler',
        danger: true,
        onConfirm: async () => {
          try {
            await deleteNotification(notification.id);

            setNotifications((current) =>
              current.filter(
                (item) => item.id !== notification.id,
              ),
            );

            setSelectedNotificationIds((current) => {
              const next = new Set(current);
              next.delete(notification.id);
              return next;
            });
          } catch (error) {
            console.error(
              'ERREUR SUPPRESSION NOTIFICATION :',
              error,
            );

            showDialog({
              title: 'Notifications',
              message: 'Impossible de supprimer cette notification.',
              icon: '⚠️',
            });
          }
        },
      });
    },
    [showDialog],
  );

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);

    if (Number.isNaN(date.getTime())) {
      return dateString;
    }

    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const renderNotification = ({
    item,
  }: {
    item: LocalNotification;
  }) => {
    const isSelected = selectedNotificationIds.has(item.id);

    return (
      <View
        style={[
          styles.notificationCard,
          !item.is_read && styles.unreadCard,
          item.id === highlightedNotificationId &&
            styles.highlightedCard,
          isSelected && styles.selectedCard,
        ]}
      >
        <Pressable
          style={styles.checkboxContainer}
          onPress={() => toggleNotificationSelection(item.id)}
          hitSlop={8}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: isSelected }}
          accessibilityLabel="Sélectionner la notification"
        >
          <View
            style={[
              styles.checkbox,
              isSelected && styles.checkboxSelected,
            ]}
          >
            {isSelected && (
              <Text style={styles.checkboxCheck}>✓</Text>
            )}
          </View>
        </Pressable>

        <Pressable
          style={styles.notificationMain}
          onPress={() => handleNotificationPress(item)}
          onLongPress={() =>
            toggleNotificationSelection(item.id)
          }
        >
          {!item.is_read && <View style={styles.unreadDot} />}

          <View style={styles.notificationContent}>
            <View style={styles.notificationHeader}>
              <Text
                style={styles.notificationTitle}
                numberOfLines={2}
              >
                {item.title}
              </Text>

              <View style={styles.notificationActions}>
                <Pressable
                  style={styles.copyButton}
                  onPress={() => handleCopyNotification(item)}
                  hitSlop={8}
                  accessibilityLabel="Copier la notification"
                >
                  <Text style={styles.actionIcon}>📋</Text>
                </Pressable>

                <Pressable
                  style={styles.deleteButton}
                  onPress={() => handleDelete(item)}
                  hitSlop={8}
                  accessibilityLabel="Supprimer la notification"
                >
                  <Text style={styles.actionIcon}>🗑️</Text>
                </Pressable>
              </View>
            </View>

            <Text style={styles.message}>
              {renderInteractiveMessage(item.message)}
            </Text>

            <Text style={styles.date}>
              {formatDate(item.created_at)}
            </Text>
          </View>
        </Pressable>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={RED} />
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
          <Text style={styles.backIcon}>‹</Text>
        </Pressable>

        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>Notifications</Text>

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
          <Text style={styles.emptyIcon}>🔔</Text>

          <Text style={styles.emptyTitle}>
            Aucune notification
          </Text>

          <Text style={styles.emptyDescription}>
            Vous n'avez aucune nouvelle notification pour le moment.
          </Text>
        </View>
      ) : (
        <>
          <View style={styles.selectionBar}>
            <Pressable
              style={styles.selectAllButton}
              onPress={toggleSelectAll}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: allSelected }}
            >
              <View
                style={[
                  styles.checkbox,
                  allSelected && styles.checkboxSelected,
                ]}
              >
                {allSelected && (
                  <Text style={styles.checkboxCheck}>✓</Text>
                )}
              </View>

              <Text style={styles.selectAllText}>
                Tout sélectionner
              </Text>
            </Pressable>

            {selectedNotificationIds.size > 0 && (
              <Pressable
                style={styles.deleteSelectedButton}
                onPress={handleDeleteSelected}
              >
                <Text style={styles.deleteSelectedText}>
                  🗑️ Supprimer ({selectedNotificationIds.size})
                </Text>
              </Pressable>
            )}
          </View>

          <FlatList
            data={notifications}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderNotification}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                tintColor={RED}
              />
            }
          />
        </>
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
    borderBottomColor: 'rgba(255,255,255,0.06)',
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
    borderColor: 'rgba(255,255,255,0.07)',
    overflow: 'hidden',
  },

  unreadCard: {
    borderColor: 'rgba(229,9,20,0.35)',
  },

  selectedCard: {
    borderColor: RED,
    backgroundColor: '#1A1010',
  },

  highlightedCard: {
    borderColor: RED,
    borderWidth: 2,
  },

  notificationMain: {
    flex: 1,
    flexDirection: 'row',
  },

  checkboxContainer: {
    width: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },

  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#555555',
    alignItems: 'center',
    justifyContent: 'center',
  },

  checkboxSelected: {
    backgroundColor: RED,
    borderColor: RED,
  },

  checkboxCheck: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
  },

  unreadDot: {
    position: 'absolute',
    top: 18,
    left: 2,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: RED,
  },

  notificationContent: {
    flex: 1,
    padding: 16,
    paddingLeft: 10,
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

  notificationActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  copyButton: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#202020',
    alignItems: 'center',
    justifyContent: 'center',
  },

  deleteButton: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#202020',
    alignItems: 'center',
    justifyContent: 'center',
  },

  actionIcon: {
    fontSize: 15,
  },

  message: {
    color: '#AAAAAA',
    fontSize: 14,
    lineHeight: 21,
    marginTop: 10,
  },

  messageLink: {
    color: '#FF4B55',
    textDecorationLine: 'underline',
    fontWeight: '600',
  },

  date: {
    color: '#666666',
    fontSize: 11,
    marginTop: 12,
  },

  selectionBar: {
    minHeight: 54,
    paddingHorizontal: 16,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
    backgroundColor: '#0D0D0D',
  },

  selectAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  selectAllText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 10,
  },

  deleteSelectedButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(229,9,20,0.15)',
  },

  deleteSelectedText: {
    color: RED,
    fontSize: 13,
    fontWeight: '700',
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