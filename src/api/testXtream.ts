import { XtreamClient } from './xtreamClient';
import { getUserAccess } from './accessApi';

export async function testXtreamConnection() {
  try {
    const access =
      await getUserAccess();

    if (!access.subscription) {
      console.log(
        'TEST XTREAM : aucun abonnement actif.'
      );

      return null;
    }

    if (!access.xtream) {
      console.log(
        'TEST XTREAM : configuration Xtream indisponible.'
      );

      return null;
    }

    const client =
      new XtreamClient({
        server:
          access.xtream.server_url,
        username:
          access.xtream.username,
        password:
          access.xtream.password,
      });

    const movies =
      await client.getVodStreams();

    const firstMovie =
      movies[0];

    let movieInfo = null;

    if (firstMovie) {
      movieInfo =
        await client.getVodInfo(
          String(firstMovie.stream_id)
        );
    }

    const categories =
      await client.getVodCategories();

    const account =
      await client.authenticate();

    console.log(
      'Connexion Xtream réussie'
    );

    console.log(
      'Compte :',
      account
    );

    console.log(
      'Catégories VOD :',
      categories
    );

    console.log(
      'PREMIER FILM :',
      JSON.stringify(firstMovie)
    );

    console.log(
      'INFO PREMIER FILM :',
      JSON.stringify(movieInfo)
    );

    return {
      account,
      categories,
      movies,
      movieInfo,
    };
  } catch (error) {
    console.error(
      'Erreur connexion Xtream :',
      error
    );

    return null;
  }
}
