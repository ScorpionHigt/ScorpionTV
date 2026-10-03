import {
  Directory,
  File,
  Paths,
} from 'expo-file-system';
import * as IntentLauncher from 'expo-intent-launcher';
import {
  checkAppVersion,
  AppVersionResponse,
} from '../api/appVersion';

export type DownloadProgress = {
  progress: number;
  downloadedBytes: number;
  totalBytes: number;
};

type DownloadCallbacks = {
  onProgress?: (progress: DownloadProgress) => void;
};



/*
 * ------------------------------------------------------
 * Vérification de mise à jour
 * ------------------------------------------------------
 */

export async function checkForAppUpdate(): Promise<AppVersionResponse | null> {
  const currentVersion =
    require('expo-constants').default.expoConfig?.version ??
    '0.0.0';

  console.log(
    'APP UPDATE : version installée :',
    currentVersion,
  );

  const result =
    await checkAppVersion(currentVersion);

  if (!result) {
    console.log(
      'APP UPDATE : impossible de vérifier les mises à jour.',
    );

    return null;
  }

  if (
    !result.success ||
    !result.available
  ) {
    console.log(
      'APP UPDATE : système de mise à jour indisponible.',
    );

    return null;
  }

  if (
    !result.update_available ||
    !result.version
  ) {
    console.log(
      'APP UPDATE : aucune mise à jour disponible.',
    );

    return null;
  }

  console.log(
    'APP UPDATE : mise à jour disponible :',
    result.latest_version,
  );

  console.log(
    'APP UPDATE : obligatoire :',
    result.update_required,
  );

  return result;
}





export async function installAppUpdate(
  apkUri: string,
): Promise<boolean> {
  try {
    console.log(
      'APP UPDATE : préparation de l installation...',
    );

    const apkFile = new File(apkUri);

    if (!apkFile.exists) {
      console.log(
        'APP UPDATE : APK introuvable.',
      );

      return false;
    }

    console.log(
      'APP UPDATE : APK trouvé :',
      apkFile.uri,
    );

    console.log(
      'APP UPDATE : taille APK :',
      apkFile.size,
    );

    if (!apkFile.size || apkFile.size <= 0) {
      console.log(
        'APP UPDATE : APK vide, installation impossible.',
      );

      return false;
    }

    const contentUri =
      apkFile.contentUri;

    if (!contentUri) {
      console.log(
        'APP UPDATE : impossible d obtenir le contentUri.',
      );

      return false;
    }

    console.log(
      'APP UPDATE : contentUri :',
      contentUri,
    );

    await IntentLauncher.startActivityAsync(
      'android.intent.action.INSTALL_PACKAGE',
      {
        data: contentUri,
        type: 'application/vnd.android.package-archive',
        flags: 1,
      },
    );

    console.log(
      'APP UPDATE : installateur Android lancé.',
    );

    return true;
  } catch (error) {
    console.error(
      'APP UPDATE : erreur installation :',
      error,
    );

    return false;
  }
}

/*
 * ------------------------------------------------------
 * Téléchargement de la mise à jour
 * ------------------------------------------------------
 */
export async function downloadAppUpdate(
  updateInfo: AppVersionResponse,
  callbacks?: DownloadCallbacks,
): Promise<string | null> {
  /*
   * Vérification de la version
   */
  const versionInfo =
    updateInfo.version;

  if (!versionInfo) {
    console.log(
      'APP UPDATE : informations de version absentes.',
    );

    return null;
  }

  /*
   * Vérification de l'URL
   */
  const downloadUrl =
    versionInfo.download_url;

  if (!downloadUrl) {
    console.log(
      'APP UPDATE : aucune URL de téléchargement disponible.',
    );

    return null;
  }

  const version =
    versionInfo.version_number;

  console.log(
    'APP UPDATE : début du téléchargement :',
    version,
  );

  console.log(
    'APP UPDATE : URL APK :',
    downloadUrl,
  );

  try {
    /*
     * --------------------------------------------------
     * Dossier de téléchargement
     * --------------------------------------------------
     */
    const updateDirectory =
      new Directory(
        Paths.cache,
        'scorpiontv-updates',
      );

    if (!updateDirectory.exists) {
      updateDirectory.create({
        intermediates: true,
      });
    }

    /*
     * --------------------------------------------------
     * Fichier APK
     * --------------------------------------------------
     */
    const fileName =
      `ScorpionTV-${version}.apk`;

    const apkFile =
      new File(
        updateDirectory,
        fileName,
      );

    /*
     * --------------------------------------------------
     * Suppression d'un ancien APK
     * --------------------------------------------------
     */
    if (apkFile.exists) {
      console.log(
        'APP UPDATE : ancien APK trouvé, suppression.',
      );

      apkFile.delete();
    }

    /*
     * --------------------------------------------------
     * Téléchargement
     * --------------------------------------------------
     */
    const downloadTask =
      File.createDownloadTask(
        downloadUrl,
        apkFile,
        {
          onProgress: ({
            bytesWritten,
            totalBytes,
          }) => {
            const progress =
              totalBytes > 0
                ? bytesWritten / totalBytes
                : 0;

            console.log(
              'APP UPDATE : progression :',
              Math.round(progress * 100),
              '%',
              bytesWritten,
              '/',
              totalBytes,
            );

            callbacks?.onProgress?.({
              progress,
              downloadedBytes:
                bytesWritten,
              totalBytes,
            });
          },
        },
      );

    const downloadedFile =
      await downloadTask.downloadAsync();

    if (!downloadedFile) {
      console.log(
        'APP UPDATE : téléchargement annulé.',
      );

      return null;
    }

    console.log(
      'APP UPDATE : téléchargement terminé.',
    );

    console.log(
      'APP UPDATE : APK :',
      downloadedFile.uri,
    );

    return downloadedFile.uri;
  } catch (error) {
    console.error(
      'APP UPDATE : erreur téléchargement :',
      error,
    );

    /*
     * --------------------------------------------------
     * Nettoyage
     * --------------------------------------------------
     */
    try {
      const updateDirectory =
        new Directory(
          Paths.cache,
          'scorpiontv-updates',
        );

      const fileName =
        `ScorpionTV-${version}.apk`;

      const apkFile =
        new File(
          updateDirectory,
          fileName,
        );

      if (apkFile.exists) {
        apkFile.delete();

        console.log(
          'APP UPDATE : APK incomplet supprimé.',
        );
      }
    } catch (cleanupError) {
      console.log(
        'APP UPDATE : erreur nettoyage APK :',
        cleanupError,
      );
    }

    return null;
  }
}
