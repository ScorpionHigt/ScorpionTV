import {
  DarkTheme,
  Stack,
  ThemeProvider,
  router,
} from 'expo-router';

import {
  useEffect,
  useState,
} from 'react';

import {
  BackHandler,
} from 'react-native';

import * as Notifications from 'expo-notifications';

import DialogProvider, {
  useDialog,
} from '../components/dialogs/DialogProvider';

import {
  checkForAppUpdate,
  downloadAppUpdate,
  reloadApp,
} from '../services/updateService';

import {
  syncUserNotifications,
} from '../services/notificationService';

import {
  getAuthUser,
} from '../storage/authStorage';


function AppUpdateChecker() {
  const { showDialog } = useDialog();

  const [downloading, setDownloading] =
    useState(false);

  useEffect(() => {
    let mounted = true;

    const checkUpdate = async () => {
      const result =
        await checkForAppUpdate();

      if (
        !mounted ||
        !result.updateAvailable
      ) {
        return;
      }

      showDialog({
        type: 'update',
        downloading: false,

        onUpdate: async () => {
          if (!mounted) {
            return;
          }

          setDownloading(true);

          showDialog({
            type: 'update',
            downloading: true,

            onUpdate: () => {},
            onLater: () => {},
          });

          const updated =
            await downloadAppUpdate();

          if (!mounted) {
            return;
          }

          if (updated) {
            await reloadApp();
            return;
          }

          setDownloading(false);

          showDialog({
            title: 'Mise à jour',
            message:
              'Impossible de télécharger la mise à jour. Veuillez réessayer plus tard.',
            icon: '⚠️',
          });
        },

        onLater: () => {
          console.log(
            'MISE À JOUR REPORTÉE PAR L’UTILISATEUR',
          );
        },
      });
    };

    void checkUpdate();

    return () => {
      mounted = false;
    };
  }, [showDialog]);

  return null;
}


/**
 * Gestion du bouton Retour Android.
 *
 * Si un écran précédent existe,
 * on revient normalement en arrière.
 *
 * Si l'utilisateur est à la racine,
 * on demande confirmation avant de quitter.
 */
function AndroidBackHandler() {
  const { showDialog } = useDialog();

  useEffect(() => {
    const subscription =
      BackHandler.addEventListener(
        'hardwareBackPress',
        () => {
          if (router.canGoBack()) {
            router.back();

            return true;
          }

          showDialog({
            type: 'confirm',
            title: 'Quitter ScorpionTV',
            message:
              'Voulez-vous vraiment quitter l’application ?',
            confirmLabel: 'Quitter',
            cancelLabel: 'Annuler',
            danger: true,

            onConfirm: () => {
              console.log(
                'SORTIE DE SCORPIONTV CONFIRMÉE',
              );

              BackHandler.exitApp();
            },

            onCancel: () => {
              console.log(
                'SORTIE DE SCORPIONTV ANNULÉE',
              );
            },
          });

          return true;
        },
      );

    return () => {
      subscription.remove();
    };
  }, [showDialog]);

  return null;
}


/**
 * Gestion des clics sur les notifications FCM.
 */
function NotificationResponseHandler() {
  useEffect(() => {
    let mounted = true;
    let processing = false;

    const handleNotificationResponse =
      async (
        response: Notifications.NotificationResponse,
      ) => {
        if (!mounted) {
          return;
        }

        if (processing) {
          console.log(
            'NOTIFICATIONS : traitement déjà en cours.',
          );

          return;
        }

        processing = true;

        console.log(
          'NOTIFICATIONS : clic sur une notification détecté.',
        );

        try {
          /*
           * Récupération des données envoyées
           * par Firebase FCM.
           */

          const data =
            response.notification.request.content.data ?? {};

          const notificationId =
            typeof data.notification_id === 'string'
              ? data.notification_id
              : typeof data.notification_id === 'number'
                ? String(data.notification_id)
                : null;

          const notificationType =
            typeof data.notification_type === 'string'
              ? data.notification_type
              : null;

          console.log(
            'NOTIFICATIONS : données du clic :',
            data,
          );

          console.log(
            'NOTIFICATIONS : notification_id :',
            notificationId,
          );

          console.log(
            'NOTIFICATIONS : notification_type :',
            notificationType,
          );

          /*
           * Récupération de l'utilisateur connecté.
           */
          const user =
            await getAuthUser();

          if (!mounted) {
            return;
          }

          if (!user) {
            console.log(
              'NOTIFICATIONS : aucun utilisateur connecté.',
            );

            router.push('/login');

            return;
          }

          /*
           * Récupération des notifications
           * depuis le serveur.
           */
          console.log(
            'NOTIFICATIONS : récupération des notifications du serveur...',
          );

          await syncUserNotifications(
            user.id,
          );

          if (!mounted) {
            return;
          }

          console.log(
            'NOTIFICATIONS : synchronisation terminée.',
          );

          /*
           * Ouverture de l'écran Notifications.
           *
           * Si Firebase nous a donné un ID,
           * on le transmet à l'écran.
           */
          if (notificationId) {
            router.push({
              pathname: '/notifications',
              params: {
                notificationId,
              },
            });
          } else {
            router.push('/notifications');
          }
        } catch (error) {
          console.log(
            'NOTIFICATIONS : erreur après clic :',
            error,
          );

          if (mounted) {
            router.push('/notifications');
          }
        } finally {
          processing = false;
        }
      };

    /*
     * Cas :
     * application déjà ouverte ou en arrière-plan.
     */
    const subscription =
      Notifications.addNotificationResponseReceivedListener(
        handleNotificationResponse,
      );

    /*
     * Cas :
     * application complètement fermée.
     */
    const checkInitialNotification =
      async () => {
        try {
          const response =
            await Notifications.getLastNotificationResponseAsync();

          if (!response) {
            console.log(
              'NOTIFICATIONS : aucune notification initiale.',
            );

            return;
          }

          console.log(
            'NOTIFICATIONS : notification initiale détectée.',
          );

          await handleNotificationResponse(
            response,
          );
        } catch (error) {
          console.log(
            'NOTIFICATIONS : erreur notification initiale :',
            error,
          );
        }
      };

    void checkInitialNotification();

    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  return null;
}


export default function RootLayout() {
  return (
    <ThemeProvider value={DarkTheme}>
      <DialogProvider>

        <AppUpdateChecker />

        <AndroidBackHandler />

        <NotificationResponseHandler />

        <Stack
          screenOptions={{
            headerShown: false,
            animation: 'fade',
            contentStyle: {
              backgroundColor: '#080808',
            },
          }}
        />

      </DialogProvider>
    </ThemeProvider>
  );
}
