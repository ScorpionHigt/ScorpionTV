import React, { useEffect, useState } from 'react';

import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

type SecurityCodeDialogProps = {
  visible: boolean;
  title: string;
  message?: string;
  icon?: string;

  confirmLabel?: string;
  cancelLabel?: string;

  onConfirm: (code: string) => void;
  onCancel: () => void;

  danger?: boolean;
};

export default function SecurityCodeDialog({
  visible,
  title,
  message,
  icon = '🔐',
  confirmLabel = 'Confirmer',
  cancelLabel = 'Annuler',
  onConfirm,
  onCancel,
  danger = false,
}: SecurityCodeDialogProps) {
  const [code, setCode] = useState('');

  useEffect(() => {
    if (visible) {
      setCode('');
    }
  }, [visible]);

  const handleConfirm = () => {
    const trimmedCode = code.trim();

    if (!trimmedCode) {
      return;
    }

    onConfirm(trimmedCode);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.iconContainer}>
            <Text style={styles.icon}>
              {icon}
            </Text>
          </View>

          <Text style={styles.title}>
            {title}
          </Text>

          {message ? (
            <Text style={styles.message}>
              {message}
            </Text>
          ) : null}

          <TextInput
            value={code}
            onChangeText={setCode}
            placeholder="Code de sécurité"
            placeholderTextColor="#666666"
            secureTextEntry
            keyboardType="number-pad"
            autoFocus
            maxLength={32}
            style={styles.input}
          />

          <View style={styles.buttons}>
            <Pressable
              style={[
                styles.button,
                styles.cancelButton,
              ]}
              onPress={onCancel}
            >
              <Text style={styles.cancelText}>
                {cancelLabel}
              </Text>
            </Pressable>

            <Pressable
              style={[
                styles.button,
                danger
                  ? styles.dangerButton
                  : styles.primaryButton,
                !code.trim() &&
                  styles.disabledButton,
              ]}
              onPress={handleConfirm}
              disabled={!code.trim()}
            >
              <Text style={styles.confirmText}>
                {confirmLabel}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.78)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },

  container: {
    width: '100%',
    backgroundColor: '#151515',
    borderRadius: 20,
    padding: 22,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },

  iconContainer: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: '#0D0D0D',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 14,
  },

  icon: {
    fontSize: 25,
  },

  title: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
  },

  message: {
    color: '#888888',
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 18,
  },

  input: {
    height: 52,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#333333',
    backgroundColor: '#0D0D0D',
    color: '#FFFFFF',
    paddingHorizontal: 15,
    fontSize: 17,
    textAlign: 'center',
    letterSpacing: 4,
  },

  buttons: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
  },

  button: {
    flex: 1,
    minHeight: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },

  cancelButton: {
    backgroundColor: '#252525',
  },

  primaryButton: {
    backgroundColor: '#E50914',
  },

  dangerButton: {
    backgroundColor: '#E50914',
  },

  disabledButton: {
    opacity: 0.45,
  },

  cancelText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },

  confirmText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
});