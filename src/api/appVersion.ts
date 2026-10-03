const API_BASE_URL =
  'https://api.scorpiontv.cantic-mali.com';

export type AppVersionInfo = {
  id: number;
  version_number: string;
  download_url: string;
  description: string | null;
  publication_date: string | null;
  mandatory_update_date: string | null;
  is_available: boolean;
};

export type AppVersionResponse = {
  success: boolean;
  available: boolean;
  current_version: string;
  latest_version: string;
  update_available: boolean;
  update_required: boolean;
  days_until_mandatory: number | null;
  version: AppVersionInfo | null;
};

export async function checkAppVersion(
  currentVersion: string
): Promise<AppVersionResponse | null> {
  try {
    const url =
      `${API_BASE_URL}/api/app-version` +
      `?current_version=${encodeURIComponent(currentVersion)}`;

    console.log(
      'APP UPDATE : vérification de la version :',
      currentVersion
    );

    const response = await fetch(url);

    console.log(
      'APP UPDATE : HTTP :',
      response.status
    );

    if (!response.ok) {
      console.log(
        'APP UPDATE : erreur HTTP :',
        response.status
      );

      return null;
    }

    const data =
      (await response.json()) as AppVersionResponse;

    console.log(
      'APP UPDATE : réponse :',
      data
    );

    return data;
  } catch (error) {
    console.log(
      'APP UPDATE : erreur de vérification :',
      error
    );

    return null;
  }
}