import {
  AuthUser,
  saveAuthSession,
} from '../storage/authStorage';

const API_BASE_URL =
  'https://api.scorpiontv.cantic-mali.com';

export type RegisterResponse = {
  success: boolean;
  message: string;
  token: string;
  user: AuthUser;
};

export async function register(
  username: string,
  phone: string,
  email: string,
  password: string
): Promise<RegisterResponse> {
  const response = await fetch(
    `${API_BASE_URL}/api/auth/register`,
    {
      method: 'POST',

      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },

      body: JSON.stringify({
        username: username.trim(),
        phone: phone.trim(),
        email: email.trim()
          ? email.trim()
          : null,
        password,
      }),
    }
  );

  const responseText =
    await response.text();

  console.log(
    'RÉPONSE INSCRIPTION :',
    response.status,
    responseText
  );

  if (!response.ok) {
    let message =
      `Erreur inscription : ${response.status}`;

    try {
      const errorData =
        JSON.parse(responseText);

      if (typeof errorData.detail === 'string') {
        message = errorData.detail;
      }
    } catch {
      if (responseText) {
        message += ` ${responseText}`;
      }
    }

    throw new Error(message);
  }

  const data =
    JSON.parse(
      responseText
    ) as RegisterResponse;

  if (!data.success) {
    throw new Error(
      data.message ||
        'Impossible de créer le compte.'
    );
  }

  if (!data.token) {
    throw new Error(
      'Compte créé, mais aucun token de session n’a été reçu.'
    );
  }

  await saveAuthSession(
    data.token,
    data.user
  );

  return data;
}
