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