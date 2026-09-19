import { getAuthToken } from '../storage/authStorage';

const API_BASE_URL =
  'https://api.scorpiontv.cantic-mali.com';

export type Subscription = {
  id: number;
  user_id: number;
  subscription_plan_id: number;
  subscription_type: string;
  subscription_location: string | null;
  start_date: string;
  end_date: string;
  expired: boolean;
  status: string;
  price: number;
  created_at?: string;
  updated_at?: string;

  plan_name?: string;
  currency?: string;
  duration_months?: number;
  tv_channels_count?: number;
  movies_count?: number;
  series_count?: number;
  is_promotion?: boolean;
};

export type SubscriptionUser = {
  id: number;
  username: string;
  phone: string | null;
  email: string | null;
  is_active: boolean;
};

export type CurrentSubscriptionResponse = {
  success: boolean;
  user: SubscriptionUser;
  active_subscription: Subscription | null;
  pending_subscriptions: Subscription[];
  subscriptions: Subscription[];
  count: number;
};

export type SubscriptionHistoryResponse = {
  success: boolean;
  user: SubscriptionUser;
  active_subscription: Subscription | null;
  pending_subscriptions: Subscription[];
  expired_subscriptions: Subscription[];
  cancelled_subscriptions: Subscription[];
  subscriptions: Subscription[];
  count: number;
  counts: {
    active: number;
    pending: number;
    expired: number;
    cancelled: number;
  };
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

async function handleResponse<T>(
  response: Response,
  fallbackMessage: string
): Promise<T> {
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
      `${fallbackMessage} ${responseText}`.trim()
    );
  }

  try {
    return JSON.parse(responseText) as T;
  } catch {
    throw new Error(
      'Le serveur a retourné une réponse invalide.'
    );
  }
}

export async function getCurrentSubscription(
  userId: number
): Promise<CurrentSubscriptionResponse> {
  const headers = await getAuthHeaders();

  const response = await fetch(
    `${API_BASE_URL}/api/users/${userId}/subscription`,
    {
      method: 'GET',
      headers,
    }
  );

  console.log(
    'RÉPONSE ABONNEMENT ACTUEL :',
    response.status
  );

  return handleResponse<CurrentSubscriptionResponse>(
    response,
    `Erreur récupération abonnement : ${response.status}`
  );
}

export async function getSubscriptionHistory(
  userId: number
): Promise<SubscriptionHistoryResponse> {
  const headers = await getAuthHeaders();

  const response = await fetch(
    `${API_BASE_URL}/api/users/${userId}/subscriptions`,
    {
      method: 'GET',
      headers,
    }
  );

  console.log(
    'RÉPONSE HISTORIQUE ABONNEMENTS :',
    response.status
  );

  return handleResponse<SubscriptionHistoryResponse>(
    response,
    `Erreur récupération historique : ${response.status}`
  );
}
