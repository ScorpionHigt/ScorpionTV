import { XtreamClient } from './xtreamClient';
import { xtreamConfig } from './config';
import { ToastAndroid } from 'react-native';

export async function testXtreamConnection() {
try {
const client = new XtreamClient(xtreamConfig);

const movies = await client.getVodStreams();
const firstMovie = movies[0];
const movieInfo = await client.getVodInfo(String(firstMovie.stream_id));
console.log('INFO PREMIER FILM :', JSON.stringify(movieInfo));
const categories = await client.getVodCategories();
const account = await client.authenticate();

console.log('Connexion Xtream réussie');
console.log('Compte :', account);
console.log('Catégories VOD :', categories);
console.log('PREMIER FILM :', JSON.stringify(firstMovie));
return { account, categories, movies, movieInfo};
} catch (error) {
console.log('Erreur connexion Xtream');
console.log(error);
return null;
}
}