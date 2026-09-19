import { initDatabase } from './database';

export type LocalNotification = {
  id: number;
  user_id: number;
  subscription_id: number | null;
  notification_type: string;
  title: string;
  message: string;
  is_read: boolean;
  is_active: boolean;
  created_at: string;
  expires_at: string | null;
};

type NotificationRow = {
  id: number;
  user_id: number;
  subscription_id: number | null;
  notification_type: string;
  title: string;
  message: string;
  is_read: number;
  is_active: number;
  created_at: string;
  expires_at: string | null;
};

function mapNotification(
  row: NotificationRow
): LocalNotification {
  return {
    id: row.id,
    user_id: row.user_id,
    subscription_id: row.subscription_id,
    notification_type: row.notification_type,
    title: row.title,
    message: row.message,
    is_read: row.is_read === 1,
    is_active: row.is_active === 1,
    created_at: row.created_at,
    expires_at: row.expires_at,
  };
}

export async function saveNotifications(
  notifications: LocalNotification[]
): Promise<void> {
  if (notifications.length === 0) {
    return;
  }

  const db = await initDatabase();

  await db.withExclusiveTransactionAsync(
    async (transaction) => {
      for (const notification of notifications) {
        await transaction.runAsync(
          `
          INSERT OR IGNORE INTO notifications (
            id,
            user_id,
            subscription_id,
            notification_type,
            title,
            message,
            is_read,
            is_active,
            created_at,
            expires_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
          `,
          notification.id,
          notification.user_id,
          notification.subscription_id,
          notification.notification_type,
          notification.title,
          notification.message,
          notification.is_read ? 1 : 0,
          notification.is_active ? 1 : 0,
          notification.created_at,
          notification.expires_at
        );
      }
    }
  );
}

export async function getNotificationsForUser(
  userId: number
): Promise<LocalNotification[]> {
  const db = await initDatabase();

  const rows =
    await db.getAllAsync<NotificationRow>(
      `
      SELECT
        id,
        user_id,
        subscription_id,
        notification_type,
        title,
        message,
        is_read,
        is_active,
        created_at,
        expires_at
      FROM notifications
      WHERE user_id = ?
        AND is_active = 1
        AND (
          expires_at IS NULL
          OR expires_at > ?
        )
      ORDER BY
        datetime(created_at) DESC,
        id DESC;
      `,
      userId,
      new Date().toISOString()
    );

  return rows.map(mapNotification);
}

export async function markNotificationAsRead(
  notificationId: number
): Promise<void> {
  const db = await initDatabase();

  await db.runAsync(
    `
    UPDATE notifications
    SET is_read = 1
    WHERE id = ?;
    `,
    notificationId
  );
}

export async function deleteNotification(
  notificationId: number
): Promise<void> {
  const db = await initDatabase();

  await db.runAsync(
    `
    DELETE FROM notifications
    WHERE id = ?;
    `,
    notificationId
  );
}

export async function getUnreadNotificationCount(
  userId: number
): Promise<number> {
  const db = await initDatabase();

  const result =
    await db.getFirstAsync<{ count: number }>(
      `
      SELECT COUNT(*) AS count
      FROM notifications
      WHERE user_id = ?
        AND is_active = 1
        AND is_read = 0
        AND (
          expires_at IS NULL
          OR expires_at > ?
        );
      `,
      userId,
      new Date().toISOString()
    );

  return result?.count ?? 0;
}
