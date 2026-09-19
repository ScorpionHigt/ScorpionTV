import { DarkTheme, ThemeProvider } from 'expo-router';
import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';

import DialogProvider, {
  useDialog,
} from '../components/dialogs/DialogProvider';

import {
  checkForAppUpdate,
  downloadAppUpdate,
  reloadApp,
} from '../services/updateService';

function AppUpdateChecker() {
  const { showDialog } = useDialog();

  const [downloading, setDownloading] =
    useState(false);

  useEffect(() => {
    let mounted = true;

    const checkUpdate = async () => {
      const result =
        await checkForAppUpdate();

      if (!mounted || !result.updateAvailable) {
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

    checkUpdate();

    return () => {
      mounted = false;
    };
  }, [showDialog]);

  return null;
}

export default function RootLayout() {
  return (
    <ThemeProvider value={DarkTheme}>
      <DialogProvider>
        <AppUpdateChecker />

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
