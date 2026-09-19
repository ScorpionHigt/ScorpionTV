import {
  getUserNotifications,
  UserNotification,
} from '../api/notificationApi';

import {
  getNotificationsForUser,
  saveNotifications,
} from '../database/notificationRepository';

export async function syncUserNotifications(
  userId: number
) {
  const notifications =
    await getUserNotifications(userId);

  if (notifications.length > 0) {
    await saveNotifications(
      notifications.map(
        (
          notification: UserNotification
        ) => ({
          ...notification,
          is_read: notification.is_read,
          is_active: notification.is_active,
        })
      )
    );
  }

  return getNotificationsForUser(userId);
}