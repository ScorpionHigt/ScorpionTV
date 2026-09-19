import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';

import AppDialog from './AppDialog';
import ConfirmDialog from './ConfirmDialog';
import UpdateDialog from './UpdateDialog';

type AppDialogButton = {
  label: string;
  onPress?: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
};

type AppDialogOptions = {
  type?: 'app';

  title: string;
  message?: string;
  icon?: string;

  buttons?: AppDialogButton[];

  onClose?: () => void;
};

type ConfirmDialogOptions = {
  type: 'confirm';

  title: string;
  message: string;

  confirmLabel?: string;
  cancelLabel?: string;

  onConfirm: () => void;
  onCancel?: () => void;

  danger?: boolean;
};

type UpdateDialogOptions = {
  type: 'update';

  downloading?: boolean;

  onUpdate: () => void;
  onLater: () => void;
};

type ShowDialogOptions =
  | AppDialogOptions
  | ConfirmDialogOptions
  | UpdateDialogOptions;

type DialogContextValue = {
  showDialog: (options: ShowDialogOptions) => void;
  hideDialog: () => void;
};

const DialogContext =
  createContext<DialogContextValue | null>(null);

type DialogProviderProps = {
  children: React.ReactNode;
};

export default function DialogProvider({
  children,
}: DialogProviderProps) {
  const [dialog, setDialog] =
    useState<ShowDialogOptions | null>(null);

  const hideDialog = useCallback(() => {
    setDialog(null);
  }, []);

  const showDialog = useCallback(
    (options: ShowDialogOptions) => {
      setDialog(options);
    },
    [],
  );

  const handleAppDialogClose = useCallback(() => {
    if (!dialog || dialog.type === 'confirm' || dialog.type === 'update') {
      return;
    }

    const onClose = dialog.onClose;

    setDialog(null);

    onClose?.();
  }, [dialog]);

  const handleConfirmCancel = useCallback(() => {
    if (!dialog || dialog.type !== 'confirm') {
      return;
    }

    const onCancel = dialog.onCancel;

    setDialog(null);

    onCancel?.();
  }, [dialog]);

  const handleConfirm = useCallback(() => {
    if (!dialog || dialog.type !== 'confirm') {
      return;
    }

    const onConfirm = dialog.onConfirm;

    setDialog(null);

    onConfirm();
  }, [dialog]);

  const handleUpdate = useCallback(() => {
    if (!dialog || dialog.type !== 'update') {
      return;
    }

    dialog.onUpdate();
  }, [dialog]);

  const handleUpdateLater = useCallback(() => {
    if (!dialog || dialog.type !== 'update') {
      return;
    }

    const onLater = dialog.onLater;

    setDialog(null);

    onLater();
  }, [dialog]);

  const appDialogButtons = useMemo(() => {
    if (!dialog || dialog.type === 'confirm' || dialog.type === 'update') {
      return [];
    }

    if (!dialog.buttons?.length) {
      return [
        {
          label: 'OK',
          variant: 'primary' as const,
          onPress: hideDialog,
        },
      ];
    }

    return dialog.buttons.map((button, index) => ({
      label: button.label,
      variant: button.variant ?? 'primary',
      onPress: () => {
        hideDialog();
        button.onPress?.();
      },
      key: `${button.label}-${index}`,
    }));
  }, [dialog, hideDialog]);

  const value = useMemo(
    () => ({
      showDialog,
      hideDialog,
    }),
    [showDialog, hideDialog],
  );

  return (
    <DialogContext.Provider value={value}>
      {children}

      {dialog?.type !== 'confirm' &&
        dialog?.type !== 'update' && (
          <AppDialog
            visible={dialog !== null}
            title={dialog?.title ?? ''}
            message={dialog?.message}
            icon={dialog?.icon}
            buttons={appDialogButtons}
            onClose={handleAppDialogClose}
          />
        )}

      {dialog?.type === 'confirm' && (
        <ConfirmDialog
          visible
          title={dialog.title}
          message={dialog.message}
          confirmLabel={dialog.confirmLabel}
          cancelLabel={dialog.cancelLabel}
          danger={dialog.danger}
          onConfirm={handleConfirm}
          onCancel={handleConfirmCancel}
        />
      )}

      {dialog?.type === 'update' && (
        <UpdateDialog
          visible
          downloading={dialog.downloading}
          onUpdate={handleUpdate}
          onLater={handleUpdateLater}
        />
      )}
    </DialogContext.Provider>
  );
}

export function useDialog(): DialogContextValue {
  const context = useContext(DialogContext);

  if (!context) {
    throw new Error(
      'useDialog doit être utilisé à l’intérieur de DialogProvider.',
    );
  }

  return context;
}
