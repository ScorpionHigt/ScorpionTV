import React from 'react';

import AppDialog from './AppDialog';

type ConfirmDialogProps = {
  visible: boolean;
  title: string;
  message: string;

  confirmLabel?: string;
  cancelLabel?: string;

  onConfirm: () => void;
  onCancel: () => void;

  danger?: boolean;
};

export default function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel = 'Confirmer',
  cancelLabel = 'Annuler',
  onConfirm,
  onCancel,
  danger = false,
}: ConfirmDialogProps) {
  return (
    <AppDialog
      visible={visible}
      title={title}
      message={message}
      icon={danger ? '⚠️' : '❓'}
      onClose={onCancel}
      buttons={[
        {
          label: cancelLabel,
          onPress: onCancel,
          variant: 'secondary',
        },
        {
          label: confirmLabel,
          onPress: onConfirm,
          variant: danger ? 'danger' : 'primary',
        },
      ]}
    />
  );
}