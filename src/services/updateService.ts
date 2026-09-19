import * as Updates from 'expo-updates';

export type UpdateCheckResult = {
  updateAvailable: boolean;
  message?: string;
};

export async function checkForAppUpdate(): Promise<UpdateCheckResult> {
  if (__DEV__) {
    return {
      updateAvailable: false,
      message:
        'Les mises à jour EAS ne sont pas vérifiées en mode développement.',
    };
  }

  try {
    const result =
      await Updates.checkForUpdateAsync();

    if (!result.isAvailable) {
      return {
        updateAvailable: false,
      };
    }

    return {
      updateAvailable: true,
      message:
        'Une nouvelle version de ScorpionTV est disponible.',
    };
  } catch (error) {
    console.error(
      'ERREUR VÉRIFICATION MISE À JOUR :',
      error,
    );

    return {
      updateAvailable: false,
      message:
        'Impossible de vérifier les mises à jour.',
    };
  }
}

export async function downloadAppUpdate(): Promise<boolean> {
  try {
    const result =
      await Updates.fetchUpdateAsync();

    return result.isNew;
  } catch (error) {
    console.error(
      'ERREUR TÉLÉCHARGEMENT MISE À JOUR :',
      error,
    );

    return false;
  }
}

export async function reloadApp(): Promise<void> {
  await Updates.reloadAsync();
}
