export type SubscriptionPlan = {
  id: number;
  name: string;
  description: string | null;
  image_url: string | null;
  price: number;
  currency: string;
  duration_months: number;
  tv_channels_count: number;
  movies_count: number;
  series_count: number;
  is_promotion: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type SubscriptionPlansResponse = {
  success: boolean;
  count: number;
  plans: SubscriptionPlan[];
};

const API_BASE_URL =
  'https://api.scorpiontv.cantic-mali.com';

export async function getSubscriptionPlans(): Promise<
  SubscriptionPlan[]
> {
  const response = await fetch(
    `${API_BASE_URL}/api/subscription-plans`
  );

  const responseText = await response.text();

  console.log(
    'RÉPONSE ABONNEMENTS :',
    response.status,
    responseText
  );

  if (!response.ok) {
    throw new Error(
      `Erreur API abonnements : ${response.status} ${responseText}`
    );
  }

  const data =
    JSON.parse(
      responseText
    ) as SubscriptionPlansResponse;

  if (!data.success) {
    throw new Error(
      'L’API n’a pas pu récupérer les abonnements.'
    );
  }

  return data.plans;
}
