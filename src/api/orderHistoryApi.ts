import { getAuthToken } from '../storage/authStorage';

const API_BASE_URL =
  'https://api.scorpiontv.cantic-mali.com';

export type OrderHistoryItem = {
  id: number;
  user_id: number;
  subscription_plan_id: number;
  amount: number;
  currency: string;
  payment_method:
    | 'orange_money'
    | 'moov_money'
    | 'wave'
    | 'card'
    | 'free';
  status:
    | 'pending'
    | 'paid'
    | 'failed'
    | 'cancelled'
    | 'expired';
  extension_confirmed: boolean;
  transaction_id: string | null;
  created_at: string;
  updated_at: string;

  plan_name: string;
  duration_months: number;
};

export type OrderHistoryResponse = {
  success: boolean;
  user: {
    id: number;
    username: string;
    phone: string | null;
    email: string | null;
    is_active: boolean;
  };
  orders: OrderHistoryItem[];
  count: number;
};

async function getAuthHeaders(): Promise<HeadersInit> {
  const token = await getAuthToken();

  if (!token) {
    throw new Error(
      'Votre session a expiré. Veuillez vous reconnecter.'
    );
  }

  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/json',
  };
}

async function parseResponse(
  response: Response
): Promise<OrderHistoryResponse> {
  const responseText = await response.text();

  if (!response.ok) {
    try {
      const data = JSON.parse(responseText);

      if (typeof data.detail === 'string') {
        throw new Error(data.detail);
      }

      if (
        data.detail &&
        typeof data.detail === 'object' &&
        typeof data.detail.message === 'string'
      ) {
        throw new Error(data.detail.message);
      }

      if (typeof data.message === 'string') {
        throw new Error(data.message);
      }
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
    }

    throw new Error(
      `Erreur récupération commandes : ${response.status}`
    );
  }

  try {
    return JSON.parse(
      responseText
    ) as OrderHistoryResponse;
  } catch {
    throw new Error(
      'Le serveur a retourné une réponse invalide.'
    );
  }
}

export async function getOrderHistory(
  userId: number
): Promise<OrderHistoryResponse> {
  const headers = await getAuthHeaders();

  const response = await fetch(
    `${API_BASE_URL}/api/users/${userId}/orders`,
    {
      method: 'GET',
      headers,
    }
  );

  console.log(
    'RÉPONSE HISTORIQUE COMMANDES :',
    response.status
  );

  return parseResponse(response);
}
