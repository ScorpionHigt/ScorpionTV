import { getAuthToken } from '../storage/authStorage';

const API_BASE_URL =
  'https://api.scorpiontv.cantic-mali.com';

/*
 * ============================================================
 * TYPES
 * ============================================================
 */

export type UserSubscription = {
  id: number;
  plan_id: number;
  name: string;
  location: string | null;
  start_date: string;
  end_date: string;
  status: string;
  expired: boolean;
  price: number;
  in_promotion: boolean;
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

/*
 * ============================================================
 * CACHE GLOBAL EN MÉMOIRE
 * ============================================================
 *
 * Ces données restent disponibles pendant toute la durée
 * de vie de l'application.
 *
 * Elles sont perdues uniquement lorsque l'application est
 * complètement fermée / relancée.
 */

/**
 * Données UserAccess déjà récupérées.
 */
let cachedUserAccess: UserAccess | null = null;

/**
 * Requête actuellement en cours.
 *
 * Permet d'éviter que plusieurs écrans qui demandent
 * les droits en même temps déclenchent plusieurs requêtes API.
 */
let userAccessPromise: Promise<UserAccess> | null = null;

/*
 * ============================================================
 * RÉCUPÉRATION DES DROITS UTILISATEUR
 * ============================================================
 */

export async function getUserAccess(): Promise<UserAccess> {
  /*
   * ----------------------------------------------------------
   * 1. CACHE DÉJÀ DISPONIBLE
   * ----------------------------------------------------------
   *
   * Si Home, Live TV, Films, Séries, Profil, etc.
   * demandent les droits après la première récupération,
   * on retourne immédiatement les données.
   */

  if (cachedUserAccess !== null) {
    console.log(
      'USER ACCESS : données récupérées depuis le cache mémoire.',
    );

    return cachedUserAccess;
  }

  /*
   * ----------------------------------------------------------
   * 2. REQUÊTE DÉJÀ EN COURS
   * ----------------------------------------------------------
   *
   * Exemple :
   *
   * Home demande getUserAccess()
   * Live demande getUserAccess()
   * Films demande getUserAccess()
   *
   * avant que la première requête soit terminée.
   *
   * Les trois utilisent alors exactement la même Promise.
   */

  if (userAccessPromise !== null) {
    console.log(
      'USER ACCESS : requête déjà en cours, attente de la requête existante.',
    );

    return userAccessPromise;
  }

  /*
   * ----------------------------------------------------------
   * 3. PREMIÈRE REQUÊTE API
   * ----------------------------------------------------------
   */

  userAccessPromise = fetchUserAccessFromApi();

  try {
    const access = await userAccessPromise;

    /*
     * --------------------------------------------------------
     * 4. STOCKAGE EN MÉMOIRE
     * --------------------------------------------------------
     */

    cachedUserAccess = access;

    console.log(
      'USER ACCESS : données chargées et mises en cache.',
    );

    return access;
  } finally {
    /*
     * La Promise n'est conservée que pendant le chargement.
     *
     * Les données définitives sont conservées dans
     * cachedUserAccess.
     */

    userAccessPromise = null;
  }
}

/*
 * ============================================================
 * REQUÊTE API RÉELLE
 * ============================================================
 *
 * Cette fonction ne doit être appelée que par getUserAccess().
 */

async function fetchUserAccessFromApi(): Promise<UserAccess> {
  const token = await getAuthToken();

  if (!token) {
    throw new UserAccessError(
      'Utilisateur non authentifié.',
      401,
    );
  }

  console.log(
    'USER ACCESS : première récupération depuis le serveur...',
  );

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

  /*
   * Ne jamais afficher le vrai mot de passe Xtream dans
   * les logs.
   */

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

  /*
   * ----------------------------------------------------------
   * ERREUR HTTP
   * ----------------------------------------------------------
   */

  if (!response.ok) {
    throw new UserAccessError(
      'detail' in data && data.detail
        ? data.detail
        : 'Impossible de récupérer les droits utilisateur.',
      response.status,
    );
  }

  /*
   * ----------------------------------------------------------
   * VÉRIFICATION DE LA RÉPONSE
   * ----------------------------------------------------------
   */

  if (
    !('success' in data) ||
    !data.success
  ) {
    throw new UserAccessError(
      'Impossible de récupérer les droits utilisateur.',
      response.status,
    );
  }

  return data;
}

/*
 * ============================================================
 * LECTURE DIRECTE DU CACHE
 * ============================================================
 *
 * Utile si un écran veut uniquement consulter le cache sans
 * déclencher de requête réseau.
 */

export function getCachedUserAccess(): UserAccess | null {
  if (cachedUserAccess !== null) {
    console.log(
      'USER ACCESS : lecture directe du cache.',
    );
  }

  return cachedUserAccess;
}

/*
 * ============================================================
 * VIDER LE CACHE
 * ============================================================
 *
 * À utiliser notamment lors de la déconnexion.
 */

export function clearUserAccessCache(): void {
  console.log(
    'USER ACCESS : suppression du cache mémoire.',
  );

  cachedUserAccess = null;
  userAccessPromise = null;
}
