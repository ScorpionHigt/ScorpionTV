import {
  AuthUser,
  getAuthToken,
  saveAuthSession,
} from '../storage/authStorage';

const API_BASE_URL =
  'https://api.scorpiontv.cantic-mali.com';

export type LoginResponse = {
  success: boolean;
  message: string;
  token: string;
  user: AuthUser;
};

export async function login(
  identifier: string,
  password: string
): Promise<LoginResponse> {
  const response = await fetch(
    `${API_BASE_URL}/api/auth/login`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        identifier: identifier.trim(),
        password,
      }),
    }
  );

  const responseText = await response.text();

  console.log(
    'RÉPONSE LOGIN :',
    response.status,
    responseText
  );

  if (!response.ok) {
    throw new Error(
      `Erreur connexion : ${response.status} ${responseText}`
    );
  }

  const data =
    JSON.parse(responseText) as LoginResponse;

  if (!data.success) {
    throw new Error(
      data.message || 'Connexion impossible.'
    );
  }

  if (!data.token) {
    throw new Error(
      'Connexion réussie, mais aucun token n’a été reçu.'
    );
  }

  await saveAuthSession(
    data.token,
    data.user
  );

  return data;
}

export type ChangePasswordResponse = {
  success: boolean;
  message: string;
  token: string;
};

export async function changePassword(
  currentPassword: string,
  newPassword: string,
  confirmPassword: string,
): Promise<ChangePasswordResponse> {
  const token = await getAuthToken();

  if (!token) {
    throw new Error(
      'Session utilisateur introuvable.'
    );
  }

  const response = await fetch(
    `${API_BASE_URL}/api/auth/change-password`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        current_password: currentPassword,
        new_password: newPassword,
        confirm_password: confirmPassword,
      }),
    }
  );

  const responseText = await response.text();

  console.log(
    'RÉPONSE CHANGEMENT MOT DE PASSE :',
    response.status,
    responseText
  );

  let data: ChangePasswordResponse & {
    detail?: string;
  };

  try {
    data = JSON.parse(responseText);
  } catch {
    throw new Error(
      'Réponse invalide du serveur.'
    );
  }

  if (!response.ok) {
    throw new Error(
      data?.detail ||
        'Impossible de modifier le mot de passe.'
    );
  }

  if (!data.success) {
    throw new Error(
      data.message ||
        'Impossible de modifier le mot de passe.'
    );
  }

  if (!data.token) {
    throw new Error(
      'Le serveur n’a pas retourné de nouveau token.'
    );
  }

  /*
   * Le backend révoque toutes les anciennes sessions
   * et crée une nouvelle session.
   *
   * Il faut donc remplacer l'ancien token par le nouveau.
   *
   * On conserve les informations utilisateur existantes.
   */
  const currentUser =
    await import('../storage/authStorage')
      .then((storage) => storage.getAuthUser());

  if (!currentUser) {
    throw new Error(
      'Utilisateur local introuvable.'
    );
  }

  await saveAuthSession(
    data.token,
    currentUser
  );

  return data;
}
