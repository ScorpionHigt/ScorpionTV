import { getAuthToken } from '../storage/authStorage';

const API_BASE_URL =
  'https://api.scorpiontv.cantic-mali.com';

// =====================================================
// TYPES
// =====================================================

export type ExchangeMessage = {
  id: number;
  user_id: number;
  sender_type: 'user' | 'admin';
  message_type: 'text' | 'audio';
  message_text: string | null;
  audio_url: string | null;
  audio_duration: number | null;
  is_read: boolean;
  created_at: string;
  updated_at: string;
};

export type GetExchangesResponse = {
  success: boolean;
  messages: ExchangeMessage[];
};

export type SendExchangeMessageResponse = {
  success: boolean;
  message: ExchangeMessage;
};

type ApiErrorResponse = {
  detail?: string;
};

// =====================================================
// RÉCUPÉRER LES ÉCHANGES
// =====================================================

export async function getExchanges(): Promise<
  GetExchangesResponse
> {
  const token = await getAuthToken();

  if (!token) {
    throw new Error(
      'Session utilisateur introuvable.'
    );
  }

  const response = await fetch(
    `${API_BASE_URL}/api/exchanges`,
    {
      method: 'GET',

      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
    }
  );

  const responseText =
    await response.text();

  console.log(
    'RÉPONSE GET ÉCHANGES :',
    response.status,
    responseText
  );

  let data:
    | GetExchangesResponse
    | ApiErrorResponse;

  try {
    data = JSON.parse(responseText);
  } catch {
    throw new Error(
      'Réponse invalide du serveur.'
    );
  }

  if (!response.ok) {
    const detail =
      'detail' in data
        ? data.detail
        : undefined;

    throw new Error(
      detail ||
        `Erreur récupération échanges : ${response.status}`
    );
  }

  if (
    !('success' in data) ||
    !data.success
  ) {
    throw new Error(
      'Impossible de récupérer les échanges.'
    );
  }

  if (!Array.isArray(data.messages)) {
    throw new Error(
      'Format de réponse des échanges invalide.'
    );
  }

  return data;
}

// =====================================================
// ENVOYER UN MESSAGE TEXTE
// =====================================================

export async function sendExchangeMessage(
  messageText: string
): Promise<SendExchangeMessageResponse> {
  const token = await getAuthToken();

  if (!token) {
    throw new Error(
      'Session utilisateur introuvable.'
    );
  }

  const text =
    messageText.trim();

  if (!text) {
    throw new Error(
      'Le message est obligatoire.'
    );
  }

  if (text.length > 2000) {
    throw new Error(
      'Le message ne peut pas dépasser 2000 caractères.'
    );
  }

  const response = await fetch(
    `${API_BASE_URL}/api/exchanges`,
    {
      method: 'POST',

      headers: {
        'Content-Type':
          'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },

      body: JSON.stringify({
        message_text: text,
      }),
    }
  );

  const responseText =
    await response.text();

  console.log(
    'RÉPONSE POST ÉCHANGE :',
    response.status,
    responseText
  );

  let data:
    | SendExchangeMessageResponse
    | ApiErrorResponse;

  try {
    data = JSON.parse(responseText);
  } catch {
    throw new Error(
      'Réponse invalide du serveur.'
    );
  }

  if (!response.ok) {
    const detail =
      'detail' in data
        ? data.detail
        : undefined;

    throw new Error(
      detail ||
        `Erreur envoi message : ${response.status}`
    );
  }

  if (
    !('success' in data) ||
    !data.success
  ) {
    throw new Error(
      'Le message n’a pas pu être envoyé.'
    );
  }

  if (!data.message) {
    throw new Error(
      'Le serveur n’a pas retourné le message créé.'
    );
  }

  return data;
}


export async function sendExchangeAudio(
  audioUri: string,
  audioDuration: number,
): Promise<SendExchangeMessageResponse> {
  const token = await getAuthToken();

  if (!token) {
    throw new Error('Session utilisateur introuvable.');
  }

  if (!audioUri) {
    throw new Error('Fichier audio introuvable.');
  }

  if (audioDuration <= 0) {
    throw new Error('Durée audio invalide.');
  }

  const formData = new FormData();

  formData.append(
    'audio',
    {
      uri: audioUri,
      name: `exchange_${Date.now()}.m4a`,
      type: 'audio/mp4',
    } as any,
  );

  formData.append(
    'audio_duration',
    String(audioDuration),
  );

  const response = await fetch(
    `${API_BASE_URL}/api/exchanges/audio`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    },
  );

  const data = await response.json();

  if (!response.ok) {
    const detail =
      typeof data?.detail === 'string'
        ? data.detail
        : 'Erreur lors de l’envoi du message audio.';

    throw new Error(detail);
  }

  if (!data?.success || !data?.message) {
    throw new Error(
      'Réponse invalide du serveur lors de l’envoi audio.',
    );
  }

  return data as SendExchangeMessageResponse;
}
