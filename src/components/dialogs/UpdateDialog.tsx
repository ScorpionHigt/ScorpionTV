import React from 'react';

import AppDialog from './AppDialog';

type UpdateDialogProps = {
  visible: boolean;

  onUpdate: () => void;
  onLater: () => void;

  downloading?: boolean;
};

export default function UpdateDialog({
  visible,
  onUpdate,
  onLater,
  downloading = false,
}: UpdateDialogProps) {
  return (
    <AppDialog
      visible={visible}
      title={
        downloading
          ? 'Mise à jour en cours'
          : 'Mise à jour disponible'
      }
      message={
        downloading
          ? 'Téléchargement de la nouvelle version de ScorpionTV...'
          : 'Une nouvelle version de ScorpionTV est disponible.'
      }
      icon={downloading ? '⬇️' : '🔄'}
      onClose={downloading ? undefined : onLater}
      buttons={
        downloading
          ? []
          : [
              {
                label: 'Plus tard',
                onPress: onLater,
                variant: 'secondary',
              },
              {
                label: 'Mettre à jour',
                onPress: onUpdate,
                variant: 'primary',
              },
            ]
      }
    />
  );
}
