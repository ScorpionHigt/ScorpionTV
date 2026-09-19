import { getAuthToken } from '../storage/authStorage';

const API_BASE_URL =
  'https://api.scorpiontv.cantic-mali.com';

export type PaymentMethod =
  | 'orange_money'
  | 'moov_money'
  | 'wave'
  | 'card'
  | 'free';

export type CreateOrderRequest = {
  user_id: number;
  plan_id: number;
  payment_method: PaymentMethod;
};

export type Order = {
  id: number;
  user_id: number;
  subscription_plan_id: number;
  amount: number;
  currency: string;
  payment_method: PaymentMethod;
  status: string;
  extension_confirmed: boolean;
  transaction_id: string | null;
  created_at?: string;
  updated_at?: string;
};

export type CurrentSubscription = {
  id: number;
  subscription_plan_id: number;
  subscription_type: string;
  start_date: string;
  end_date: string;
  status: string;
};

export type CreateOrderResponse = {
  success: boolean;
  message: string;
  requires_extension_confirmation: boolean;
  purchase_type?: 'extension' | 'scheduled';
  order: Order;
  plan: {
    id: number;
    name: string;
    duration_months: number;
  };
  current_subscription?: CurrentSubscription;
};

export type ConfirmExtensionRequest = {
  confirmed: boolean;
};

export type ConfirmExtensionResponse = {
  success: boolean;
  message: string;
  requires_extension_confirmation?: boolean;
  extension_confirmed?: boolean;
  purchase_type?: 'extension' | 'scheduled';
  order_id: number;
  current_subscription?: CurrentSubscription;
  new_plan?: {
    id: number;
    name: string;
    duration_months: number;
  };
};

export type ConfirmPaymentRequest = {
  transaction_id: string;
};

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
};

export type ConfirmPaymentResponse = {
  success: boolean;
  message: string;
  purchase_type: 'new' | 'extension' | 'scheduled';
  order: {
    id: number;
    user_id: number;
    subscription_plan_id: number;
    amount: number;
    currency: string;
    payment_method: PaymentMethod;
    status: string;
    extension_confirmed: boolean;
    transaction_id: string;
  };
  subscription: Subscription;
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
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
}

async function parseError(
  response: Response,
  fallbackMessage: string
): Promise<Error> {
  const responseText = await response.text();

  try {
    const data = JSON.parse(responseText);

    if (typeof data.detail === 'string') {
      return new Error(data.detail);
    }

    if (
      data.detail &&
      typeof data.detail === 'object' &&
      typeof data.detail.message === 'string'
    ) {
      return new Error(data.detail.message);
    }

    if (typeof data.message === 'string') {
      return new Error(data.message);
    }
  } catch {
    // Réponse non JSON
  }

  if (responseText) {
    return new Error(
      `${fallbackMessage} ${responseText}`
    );
  }

  return new Error(fallbackMessage);
}

/**
 * Crée une commande d'abonnement.
 */
export async function createOrder(
  request: CreateOrderRequest
): Promise<CreateOrderResponse> {
  const headers = await getAuthHeaders();

  const response = await fetch(
    `${API_BASE_URL}/api/orders`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify(request),
    }
  );

  const responseText = await response.text();

  console.log(
    'RÉPONSE CRÉATION COMMANDE :',
    response.status,
    responseText
  );

  if (!response.ok) {
    throw await parseError(
      new Response(responseText, {
        status: response.status,
        headers: response.headers,
      }),
      `Erreur création commande : ${response.status}`
    );
  }

  return JSON.parse(
    responseText
  ) as CreateOrderResponse;
}

/**
 * Confirme ou refuse la prolongation /
 * programmation d'un abonnement existant.
 */
export async function confirmExtension(
  orderId: number,
  confirmed: boolean
): Promise<ConfirmExtensionResponse> {
  const headers = await getAuthHeaders();

  const response = await fetch(
    `${API_BASE_URL}/api/orders/${orderId}/confirm-extension`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify({
        confirmed,
      } satisfies ConfirmExtensionRequest),
    }
  );

  const responseText = await response.text();

  console.log(
    'RÉPONSE CONFIRMATION EXTENSION :',
    response.status,
    responseText
  );

  if (!response.ok) {
    throw await parseError(
      new Response(responseText, {
        status: response.status,
        headers: response.headers,
      }),
      `Erreur confirmation extension : ${response.status}`
    );
  }

  return JSON.parse(
    responseText
  ) as ConfirmExtensionResponse;
}

/**
 * Confirme le paiement d'une commande.
 */
export async function confirmPayment(
  orderId: number,
  transactionId: string
): Promise<ConfirmPaymentResponse> {
  const headers = await getAuthHeaders();

  const response = await fetch(
    `${API_BASE_URL}/api/orders/${orderId}/confirm-payment`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify({
        transaction_id: transactionId.trim(),
      } satisfies ConfirmPaymentRequest),
    }
  );

  const responseText = await response.text();

  console.log(
    'RÉPONSE CONFIRMATION PAIEMENT :',
    response.status,
    responseText
  );

  if (!response.ok) {
    throw await parseError(
      new Response(responseText, {
        status: response.status,
        headers: response.headers,
      }),
      `Erreur confirmation paiement : ${response.status}`
    );
  }

  return JSON.parse(
    responseText
  ) as ConfirmPaymentResponse;
}
