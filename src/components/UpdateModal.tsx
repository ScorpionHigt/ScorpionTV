import React from 'react';

import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { COLORS } from '../styles/colors';
import { AppVersionResponse } from '../api/appVersion';

type UpdateModalProps = {
  visible: boolean;
  updateInfo: AppVersionResponse | null;

  downloading?: boolean;
  downloaded?: boolean;

  downloadProgress?: number;
  downloadedBytes?: number;
  totalBytes?: number;

  onUpdate: () => void;
  onInstall: () => void;
  onLater: () => void;
};

export default function UpdateModal({
  visible,
  updateInfo,
  downloading = false,
  downloaded = false,
  downloadProgress = 0,
  downloadedBytes = 0,
  totalBytes = 0,
  onUpdate,
  onInstall,
  onLater,
}: UpdateModalProps) {
  if (!updateInfo?.version) {
    return null;
  }

  const version = updateInfo.version;

  const progressPercent = Math.round(
    Math.max(0, Math.min(1, downloadProgress)) * 100,
  );

  const formatBytes = (bytes: number) => {
    if (!bytes || bytes <= 0) {
      return '0 MB';
    }

    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={
        updateInfo.update_required
          ? undefined
          : onLater
      }
    >
      <View style={styles.overlay}>
        <View style={styles.container}>

          {/* ========================================= */}
          {/* TÉLÉCHARGEMENT EN COURS */}
          {/* ========================================= */}

          {downloading ? (
            <>
              <Text style={styles.icon}>
                ⬇️
              </Text>

              <Text style={styles.title}>
                Téléchargement...
              </Text>

              <Text style={styles.progressPercent}>
                {progressPercent}%
              </Text>

              <View style={styles.progressBackground}>
                <View
                  style={[
                    styles.progressBar,
                    {
                      width: `${progressPercent}%`,
                    },
                  ]}
                />
              </View>

              <Text style={styles.sizeText}>
                {formatBytes(downloadedBytes)}

                {totalBytes > 0
                  ? ` / ${formatBytes(totalBytes)}`
                  : ''}
              </Text>

              <ActivityIndicator
                size="small"
                color={COLORS.primary}
                style={styles.spinner}
              />
            </>
          ) : downloaded ? (

            /* ======================================= */
            /* APK TÉLÉCHARGÉ */
            /* ======================================= */

            <>
              <Text style={styles.icon}>
                ✅
              </Text>

              <Text style={styles.title}>
                Mise à jour prête
              </Text>

              <Text style={styles.description}>
                La version {version.version_number} a été
                téléchargée et est prête à être installée.
              </Text>

              <Pressable
                style={styles.updateButton}
                onPress={onInstall}
              >
                <Text style={styles.updateButtonText}>
                  Installer maintenant
                </Text>
              </Pressable>
            </>

          ) : (

            /* ======================================= */
            /* MISE À JOUR DISPONIBLE */
            /* ======================================= */

            <>
              <Text style={styles.icon}>
                🔄
              </Text>

              <Text style={styles.title}>
                Mise à jour disponible
              </Text>

              <Text style={styles.newVersionLabel}>
                Nouvelle version
              </Text>

              <Text style={styles.version}>
                {version.version_number}
              </Text>

              {version.description ? (
                <Text style={styles.description}>
                  {version.description}
                </Text>
              ) : null}

              <Text style={styles.currentVersion}>
                Version actuelle :{' '}
                {updateInfo.current_version}
              </Text>

              {updateInfo.update_required ? (
                <Text style={styles.requiredText}>
                  Cette mise à jour est obligatoire.
                </Text>
              ) : null}

              <Pressable
                style={styles.updateButton}
                onPress={onUpdate}
              >
                <Text style={styles.updateButtonText}>
                  Télécharger
                </Text>
              </Pressable>

              {!updateInfo.update_required ? (
                <Pressable
                  style={styles.laterButton}
                  onPress={onLater}
                >
                  <Text style={styles.laterButtonText}>
                    Plus tard
                  </Text>
                </Pressable>
              ) : null}
            </>
          )}

        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 25,
  },

  container: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#151515',
    borderRadius: 18,
    paddingHorizontal: 24,
    paddingVertical: 28,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#292929',
  },

  icon: {
    fontSize: 42,
    marginBottom: 12,
  },

  title: {
    color: COLORS.white,
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 18,
  },

  newVersionLabel: {
    color: COLORS.textMuted,
    fontSize: 12,
    marginBottom: 4,
  },

  version: {
    color: COLORS.primary,
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 18,
  },

  description: {
    color: '#BBBBBB',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 18,
  },

  currentVersion: {
    color: COLORS.textMuted,
    fontSize: 12,
    marginBottom: 18,
  },

  requiredText: {
    color: '#FF6B6B',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 18,
  },

  updateButton: {
    width: '100%',
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },

  updateButtonText: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: '700',
  },

  laterButton: {
    marginTop: 14,
    paddingVertical: 8,
    paddingHorizontal: 20,
  },

  laterButtonText: {
    color: '#888888',
    fontSize: 14,
    fontWeight: '600',
  },

  progressPercent: {
    color: COLORS.white,
    fontSize: 30,
    fontWeight: '800',
    marginBottom: 14,
  },

  progressBackground: {
    width: '100%',
    height: 8,
    backgroundColor: '#292929',
    borderRadius: 4,
    overflow: 'hidden',
  },

  progressBar: {
    height: '100%',
    backgroundColor: COLORS.primary,
    borderRadius: 4,
  },

  sizeText: {
    color: COLORS.textMuted,
    fontSize: 12,
    marginTop: 8,
  },

  spinner: {
    marginTop: 18,
  },
});