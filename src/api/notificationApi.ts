import { getAuthToken } from '../storage/authStorage';

const API_BASE_URL =
  'https://api.scorpiontv.cantic-mali.com';

export type UserNotification = {
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

type NotificationsResponse = {
  notifications: UserNotification[];
  count: number;
};

export async function getUserNotifications(
  userId: number
): Promise<UserNotification[]> {
  const token = await getAuthToken();

  if (!token) {
    throw new Error(
      'Session utilisateur introuvable.'
    );
  }

  const response = await fetch(
    `${API_BASE_URL}/api/users/${userId}/notifications`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
    }
  );

  const responseText = await response.text();

  console.log(
    'RÉPONSE NOTIFICATIONS :',
    response.status,
    responseText
  );

  if (!response.ok) {
    throw new Error(
      `Erreur notifications : ${response.status} ${responseText}`
    );
  }

  const data =
    JSON.parse(responseText) as NotificationsResponse;

  return data.notifications;
}
