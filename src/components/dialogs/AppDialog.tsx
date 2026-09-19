import React from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

type DialogButton = {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
};

type AppDialogProps = {
  visible: boolean;
  title: string;
  message?: string;
  icon?: string;
  buttons: DialogButton[];
  onClose?: () => void;
};

export default function AppDialog({
  visible,
  title,
  message,
  icon,
  buttons,
  onClose,
}: AppDialogProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {icon && (
            <Text style={styles.icon}>
              {icon}
            </Text>
          )}

          <Text style={styles.title}>
            {title}
          </Text>

          {message && (
            <Text style={styles.message}>
              {message}
            </Text>
          )}

          <View style={styles.buttonsContainer}>
            {buttons.map((button, index) => (
              <Pressable
                key={`${button.label}-${index}`}
                style={[
                  styles.button,
                  button.variant === 'primary' &&
                    styles.primaryButton,
                  button.variant === 'danger' &&
                    styles.dangerButton,
                  button.variant === 'secondary' &&
                    styles.secondaryButton,
                ]}
                onPress={button.onPress}
              >
                <Text
                  style={[
                    styles.buttonText,
                    button.variant === 'secondary' &&
                      styles.secondaryButtonText,
                  ]}
                >
                  {button.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },

  container: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#151515',
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },

  icon: {
    fontSize: 42,
    textAlign: 'center',
    marginBottom: 12,
  },

  title: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
  },

  message: {
    color: '#AAAAAA',
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    marginTop: 10,
  },

  buttonsContainer: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 22,
  },

  button: {
    flex: 1,
    minHeight: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },

  primaryButton: {
    backgroundColor: '#E50914',
  },

  dangerButton: {
    backgroundColor: '#B00020',
  },

  secondaryButton: {
    backgroundColor: '#252525',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },

  buttonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },

  secondaryButtonText: {
    color: '#BBBBBB',
  },
});
