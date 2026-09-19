import { getAuthToken } from '../storage/authStorage';

const API_BASE_URL =
  'https://api.scorpiontv.cantic-mali.com';

export type UserSubscription = {
  id: number;
  plan_id: number;
  name: string;
  start_date: string;
  end_date: string;
  status: string;
  expired: boolean;
};

export type UserLimits = {
  tv_channels: number;
  movies: number;
  series: number;
  adult: boolean;
};

export type XtreamAccess = {
  server_url: string;
  username: string;
  password: string;
};

export type UserAccess = {
  success: boolean;
  subscription: UserSubscription | null;
  limits: UserLimits | null;
  xtream: XtreamAccess | null;
};

export class UserAccessError extends Error {
  status: number;

  constructor(
    message: string,
    status: number,
  ) {
    super(message);
    this.name = 'UserAccessError';
    this.status = status;
  }
}

export async function getUserAccess(): Promise<UserAccess> {
  const token = await getAuthToken();

  if (!token) {
    throw new UserAccessError(
      'Utilisateur non authentifié.',
      401,
    );
  }

  const response = await fetch(
    `${API_BASE_URL}/api/user/access`,
    {
      method: 'GET',

      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
    },
  );

  const responseText =
    await response.text();

  console.log(
    'RÉPONSE USER ACCESS :',
     response.status,
     responseText.replace(
         /("password"\s*:\s*")[^"]*(")/gi,
         '$1*****$2',
     ),
   );

  let data:
    | UserAccess
    | {
        detail?: string;
      };

  try {
    data = JSON.parse(responseText);
  } catch {
    throw new UserAccessError(
      'Réponse invalide du serveur.',
      response.status,
    );
  }

  if (!response.ok) {
    throw new UserAccessError(
      'detail' in data && data.detail
        ? data.detail
        : 'Impossible de récupérer les droits utilisateur.',
      response.status,
    );
  }

  if (!('success' in data) || !data.success) {
    throw new UserAccessError(
      'Impossible de récupérer les droits utilisateur.',
      response.status,
    );
  }

  return data;
}
