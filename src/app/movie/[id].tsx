import React, { useEffect, useState } from 'react';
import {
ActivityIndicator,
Image,
Pressable,
ScrollView,
StyleSheet,
Text,
ToastAndroid,
View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import * as FileSystem from 'expo-file-system/legacy';
import { XtreamClient } from '../../api/xtreamClient';
import { xtreamConfig } from '../../api/config';

type MovieInfo = {
info?: {
name?: string;
o_name?: string;
cover_big?: string;
movie_image?: string;
releasedate?: string;
episode_run_time?: string;
youtube_trailer?: string;
director?: string;
actors?: string;
cast?: string;
description?: string;
plot?: string;
age?: string;
country?: string;
genre?: string;
duration_secs?: number;
duration?: string;
rating?: string;
};

movie_data?: {
stream_id?: number;
name?: string;
category_id?: string;
container_extension?: string;
};
};

export default function MovieDetailsScreen() {
const { id } = useLocalSearchParams<{ id: string }>();

const [movie, setMovie] = useState<MovieInfo | null>(null);
const [loading, setLoading] = useState(true);
const [downloading, setDownloading] = useState(false);
const [downloadProgress, setDownloadProgress] = useState(0);
const [error, setError] = useState<string | null>(null);

useEffect(() => {
loadMovie();
}, [id]);

async function loadMovie() {
try {
setLoading(true);
setError(null);

  if (!id) {
    throw new Error('ID du film introuvable.');
  }

  console.log('CHARGEMENT DÉTAILS FILM :', id);

  const client = new XtreamClient(xtreamConfig);

  const result = await client.getVodInfo(String(id));

  console.log(
    'DÉTAILS FILM RÉCUPÉRÉS :',
    result?.info?.name
  );

  setMovie(result);
} catch (err) {
  console.error('ERREUR DÉTAILS FILM :', err);

  setError(
    'Impossible de récupérer les informations du film.'
  );
} finally {
  setLoading(false);
}

}

/*---------------------*/
async function downloadMovie() {
if (downloading) {
return;
}

try {
if (!movie?.movie_data?.stream_id) {
ToastAndroid.show(
'ID du film introuvable.',
ToastAndroid.LONG
);
return;
}

const extension =
movie.movie_data.container_extension || 'mp4';

const client = new XtreamClient(xtreamConfig);

const url = client.getMovieUrl(
String(movie.movie_data.stream_id),
extension
);

const title =
movie.info?.name ||
movie.movie_data.name ||
'film-' + movie.movie_data.stream_id;

const safeTitle = title
.replace(/[<>:"/\\|?*\[\]]/g, '')
.replace(/\s+/g, '_')
.substring(0, 100);

const fileName = safeTitle + '.' + extension;

const fileUri =
FileSystem.documentDirectory + fileName;

setDownloading(true);
setDownloadProgress(0);

ToastAndroid.show(
'Téléchargement démarré...',
ToastAndroid.SHORT
);

const downloadResumable =
FileSystem.createDownloadResumable(
url,
fileUri,
{},
(progress) => {
if (
progress.totalBytesExpectedToWrite > 0
) {
const value =
progress.totalBytesWritten /
progress.totalBytesExpectedToWrite;

setDownloadProgress(value);
}
}
);

const result =
await downloadResumable.downloadAsync();

if (!result?.uri) {
throw new Error(
'Le téléchargement est incomplet.'
);
}

setDownloadProgress(1);

ToastAndroid.show(
'Film téléchargé avec succès !',
ToastAndroid.LONG
);

} catch (err) {

console.error(
'ERREUR TÉLÉCHARGEMENT :',
err
);

ToastAndroid.show(
'Le téléchargement a échoué.',
ToastAndroid.LONG
);

} finally {
setDownloading(false);
}
}

/*----------------------*/

if (loading) {
return (
<SafeAreaView style={styles.container}>
<View style={styles.center}>
<ActivityIndicator size="large" color="#E50914" />

      <Text style={styles.loadingText}>
        Chargement du film...
      </Text>
    </View>
  </SafeAreaView>
);

}

if (error || !movie?.info) {
return (
<SafeAreaView style={styles.container}>
<View style={styles.center}>
<Text style={styles.errorIcon}>
⚠️
</Text>

      <Text style={styles.errorText}>
        {error ?? 'Film introuvable.'}
      </Text>

      <Pressable
        style={styles.backButton}
        onPress={() => router.back()}
      >
        <Text style={styles.backButtonText}>
          Retour
        </Text>
      </Pressable>
    </View>
  </SafeAreaView>
);

}

const info = movie.info;

const title =
info.name ||
info.o_name ||
'Film sans titre';

const poster =
info.cover_big ||
info.movie_image ||
null;

const description =
info.description ||
info.plot ||
'Aucune description disponible.';

return (
<SafeAreaView style={styles.container}>
<ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content} >
<Pressable
style={styles.back}
onPress={() => router.back()}
>
<Text style={styles.backText}>
‹ Retour
</Text>
</Pressable>

    {poster ? (
      <Image
        source={{ uri: poster }}
        style={styles.poster}
        resizeMode="cover"
      />
    ) : (
      <View style={styles.posterFallback}>
        <Text style={styles.posterFallbackText}>
          🎬
        </Text>
      </View>
    )}

    <View style={styles.infoContainer}>
      <Text style={styles.title}>
        {title}
      </Text>

      <View style={styles.metaRow}>
        {info.rating ? (
          <View style={styles.metaBadge}>
            <Text style={styles.metaText}>
              ⭐ {info.rating}
            </Text>
          </View>
        ) : null}

        {info.duration ? (
          <View style={styles.metaBadge}>
            <Text style={styles.metaText}>
              ⏱️ {info.duration}
            </Text>
          </View>
        ) : null}

        {info.releasedate ? (
          <View style={styles.metaBadge}>
            <Text style={styles.metaText}>
              📅 {info.releasedate}
            </Text>
          </View>
        ) : null}
      </View>

      <View style={styles.actions}>
        <Pressable
          style={styles.playButton}
          onPress={() => {
            const client =
              new XtreamClient(xtreamConfig);

            const url =
              client.getMovieUrl(
                String(
                  movie.movie_data?.stream_id
                ),
                movie.movie_data
                  ?.container_extension || 'mp4'
              );

            console.log(
              'URL FILM :',
              url
            );

            router.push({
              pathname: '/player',
              params: {
                url,
                title,
              },
            });
          }}
        >
          <Text style={styles.playButtonText}>
            ▶  Lire
          </Text>
        </Pressable>
      </View>

      <Text style={styles.sectionTitle}>
        Description
      </Text>

      <Text style={styles.description}>
        {description}
      </Text>

      {info.genre ? (
        <>
          <Text style={styles.sectionTitle}>
            Genre
          </Text>

          <Text style={styles.detail}>
            {info.genre}
          </Text>
        </>
      ) : null}

      {info.country ? (
        <>
          <Text style={styles.sectionTitle}>
            Pays
          </Text>

          <Text style={styles.detail}>
            {info.country}
          </Text>
        </>
      ) : null}

      {info.director ? (
        <>
          <Text style={styles.sectionTitle}>
            Réalisateur
          </Text>

          <Text style={styles.detail}>
            {info.director}
          </Text>
        </>
      ) : null}

      {info.actors || info.cast ? (
        <>
          <Text style={styles.sectionTitle}>
            Acteurs
          </Text>

          <Text style={styles.detail}>
            {info.actors || info.cast}
          </Text>
        </>
      ) : null}

      {info.age ? (
        <>
          <Text style={styles.sectionTitle}>
            Classification
          </Text>

          <Text style={styles.detail}>
            {info.age}
          </Text>
        </>
      ) : null}
    </View>
  </ScrollView>

  <Pressable
    style={[
      styles.downloadButton,
      downloading && styles.downloadButtonActive,
    ]}
    onPress={downloadMovie}
    disabled={downloading}
  >
    {downloading ? (
      <>
        <ActivityIndicator
          size="small"
          color="#FFFFFF"
        />

        <Text style={styles.progressText}>
          {Math.round(
            downloadProgress * 100
          )}%
        </Text>
      </>
    ) : (
      <Text style={styles.downloadIcon}>
        ⬇
      </Text>
    )}
  </Pressable>
</SafeAreaView>

);
}

const styles = StyleSheet.create({
container: {
flex: 1,
backgroundColor: '#080808',
},

content: {
paddingBottom: 40,
},

center: {
flex: 1,
alignItems: 'center',
justifyContent: 'center',
paddingHorizontal: 30,
},

loadingText: {
color: '#AAAAAA',
fontSize: 15,
marginTop: 14,
},

errorIcon: {
fontSize: 42,
marginBottom: 15,
},

errorText: {
color: '#FFFFFF',
fontSize: 16,
textAlign: 'center',
marginBottom: 25,
},

back: {
paddingHorizontal: 20,
paddingVertical: 15,
},

backText: {
color: '#FFFFFF',
fontSize: 17,
fontWeight: '600',
},

poster: {
width: '100%',
height: 500,
backgroundColor: '#151515',
},

posterFallback: {
width: '100%',
height: 500,
backgroundColor: '#151515',
alignItems: 'center',
justifyContent: 'center',
},

posterFallbackText: {
fontSize: 70,
},

infoContainer: {
paddingHorizontal: 20,
paddingTop: 20,
},

title: {
color: '#FFFFFF',
fontSize: 27,
fontWeight: '800',
lineHeight: 34,
},

metaRow: {
flexDirection: 'row',
flexWrap: 'wrap',
gap: 8,
marginTop: 14,
},

metaBadge: {
backgroundColor: '#181818',
borderWidth: 1,
borderColor: '#292929',
borderRadius: 8,
paddingHorizontal: 10,
paddingVertical: 7,
},

metaText: {
color: '#CCCCCC',
fontSize: 13,
},

actions: {
marginTop: 22,
},

playButton: {
backgroundColor: '#E50914',
borderRadius: 10,
height: 52,
alignItems: 'center',
justifyContent: 'center',
},

playButtonText: {
color: '#FFFFFF',
fontSize: 17,
fontWeight: '800',
},

sectionTitle: {
color: '#FFFFFF',
fontSize: 19,
fontWeight: '700',
marginTop: 28,
marginBottom: 10,
},

description: {
color: '#BBBBBB',
fontSize: 15,
lineHeight: 23,
},

detail: {
color: '#CCCCCC',
fontSize: 15,
lineHeight: 22,
},

backButton: {
backgroundColor: '#E50914',
paddingHorizontal: 25,
paddingVertical: 12,
borderRadius: 8,
},

backButtonText: {
color: '#FFFFFF',
fontSize: 15,
fontWeight: '700',
},

downloadButton: {
position: 'absolute',
right: 20,
bottom: 25,
width: 62,
height: 62,
borderRadius: 31,
backgroundColor: '#E50914',
justifyContent: 'center',
alignItems: 'center',
elevation: 8,
},

downloadButtonActive: {
width: 72,
height: 72,
borderRadius: 36,
},

downloadIcon: {
color: '#FFFFFF',
fontSize: 28,
fontWeight: 'bold',
},

progressText: {
color: '#FFFFFF',
fontSize: 13,
fontWeight: '800',
marginTop: 3,
},
});