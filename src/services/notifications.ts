import { Platform } from 'react-native';

import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';

import { getAuthToken } from '../storage/authStorage';

const API_BASE_URL =
  'https://api.scorpiontv.cantic-mali.com';


Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});


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


/**
 * Enregistre le token FCM du téléphone
 * auprès de l'API ScorpionTV.
 */
export async function registerFCMToken(
  fcmToken: string
): Promise<boolean> {
  try {
    const authToken = await getAuthToken();

    if (!authToken) {
      console.log(
        'NOTIFICATIONS : aucun token de session.'
      );

      return false;
    }

    const token = fcmToken.trim();

    if (!token) {
      console.log(
        'NOTIFICATIONS : token FCM vide.'
      );

      return false;
    }

    console.log(
      'NOTIFICATIONS : enregistrement du token FCM auprès de l API...'
    );

    const response = await fetch(
      `${API_BASE_URL}/api/notifications/fcm-token`,
      {
        method: 'POST',

        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: `Bearer ${authToken}`,
        },

        body: JSON.stringify({
          token,
          platform: Platform.OS,
        }),
      }
    );

    console.log(
      'NOTIFICATIONS : HTTP enregistrement FCM :',
      response.status
    );

    const responseText =
      await response.text();

    console.log(
      'NOTIFICATIONS : réponse serveur FCM :',
      responseText
    );

    if (!response.ok) {
      console.log(
        'NOTIFICATIONS : erreur serveur FCM.'
      );

      return false;
    }

    return true;
  } catch (error) {
    console.log(
      'NOTIFICATIONS : erreur enregistrement FCM :',
      error
    );

    return false;
  }
}


/**
 * Récupère le token FCM natif de l'appareil.
 */
export async function registerForPushNotificationsAsync(): Promise<
  string | null
> {
  try {
    console.log(
      'NOTIFICATIONS : démarrage de l enregistrement...'
    );

    if (!Device.isDevice) {
      console.log(
        'NOTIFICATIONS : appareil physique requis.'
      );

      return null;
    }

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(
        'default',
        {
          name: 'Notifications ScorpionTV',
          importance:
            Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#E50914',
          sound: 'default',
        }
      );

      console.log(
        'NOTIFICATIONS : canal Android configuré.'
      );
    }

    const {
      status: existingStatus,
    } =
      await Notifications.getPermissionsAsync();

    console.log(
      'NOTIFICATIONS : permission actuelle :',
      existingStatus
    );

    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const {
        status,
      } =
        await Notifications.requestPermissionsAsync();

      finalStatus = status;

      console.log(
        'NOTIFICATIONS : nouvelle permission :',
        finalStatus
      );
    }

    if (finalStatus !== 'granted') {
      console.log(
        'NOTIFICATIONS : permission refusée.'
      );

      return null;
    }

    const token =
      (
        await Notifications.getDevicePushTokenAsync()
      ).data;

    console.log(
      'NOTIFICATIONS : FCM Token :',
      token
    );

    return token;
  } catch (error) {
    console.log(
      'NOTIFICATIONS : erreur :',
      error
    );

    return null;
  }
}