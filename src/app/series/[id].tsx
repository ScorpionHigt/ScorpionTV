import React, {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { seriesDetailStyles as styles } from '../../styles/seriesDetailStyles';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  router,
  useLocalSearchParams,
} from 'expo-router';

import { XtreamClient } from '../../api/xtreamClient';
import { getUserAccess } from '../../api/accessApi';

import {
  getSeriesInfo,
  type SeriesEpisode,
} from '../../database/seriesRepository';

type Season = {
  season_number: number;
  name?: string;
  episode_count?: number;
  cover?: string | null;
  cover_big?: string | null;
  air_date?: string | null;
};

type XtreamEpisode = {
  id: string | number;
  season?: number;
  episode_num?: number;
  title: string;
  container_extension?: string | null;
  direct_source?: string | null;
  added?: string | null;
  custom_sid?: string | null;
  info?: {
    plot?: string | null;
    rating?: string | null;
    rating_5based?: number | null;
    duration?: string | null;
    duration_secs?: number | null;
  };
};

export default function SeriesDetailsScreen() {
  const { id } =
    useLocalSearchParams<{
      id: string;
    }>();

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState<string | null>(null);

  const [seriesInfo, setSeriesInfo] =
    useState<any>(null);

  const [seasons, setSeasons] =
    useState<Season[]>([]);

  const [selectedSeason, setSelectedSeason] =
    useState<number | null>(null);

  const [episodes, setEpisodes] =
    useState<SeriesEpisode[]>([]);

  const [allEpisodes, setAllEpisodes] =
    useState<Record<
      string,
      XtreamEpisode[]
    >>({});

  const [xtreamClient, setXtreamClient] =
    useState<XtreamClient | null>(null);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        setLoading(true);
        setError(null);

        console.log(
          'SERIES DETAIL : début chargement'
        );

        if (!id) {
          throw new Error(
            'Identifiant de série manquant.'
          );
        }

        console.log(
          'SERIES DETAIL : ID =',
          id
        );

        /*
         * Récupération de l'accès utilisateur.
         */
        const access =
          await getUserAccess();

        if (!access.subscription) {
          throw new Error(
            'Aucun abonnement actif.'
          );
        }

        if (
          !access.limits ||
          access.limits.series <= 0
        ) {
          throw new Error(
            'Votre abonnement ne permet pas d’accéder aux séries.'
          );
        }

        if (!access.xtream) {
          throw new Error(
            'Configuration Xtream indisponible.'
          );
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

        if (!mounted) {
          return;
        }

        setXtreamClient(client);

        console.log(
          'SERIES DETAIL : récupération des informations...'
        );

        const result =
          await getSeriesInfo(
            Number(id)
          );

        if (!mounted) {
          return;
        }

        console.log(
          'SERIES DETAIL : informations reçues'
        );

        /*
         * Informations générales.
         */
        setSeriesInfo(
          result.info ?? null
        );

        /*
         * Saisons.
         */
        const loadedSeasons =
          result.seasons ?? [];

        console.log(
          'SERIES DETAIL : saisons =',
          loadedSeasons.length
        );

        setSeasons(
          loadedSeasons
        );

        /*
         * Épisodes.
         */
        const loadedEpisodes =
          (result.episodes ??
            {}) as Record<
            string,
            XtreamEpisode[]
          >;

        setAllEpisodes(
          loadedEpisodes
        );

        console.log(
          'SERIES DETAIL : saisons avec épisodes =',
          Object.keys(
            loadedEpisodes
          ).length
        );

        /*
         * Première saison.
         */
        if (
          loadedSeasons.length > 0
        ) {
          const firstSeason =
            loadedSeasons[0]
              .season_number;

          setSelectedSeason(
            firstSeason
          );

          const firstEpisodes =
            loadedEpisodes[
              String(firstSeason)
            ] ?? [];

          console.log(
            'SERIES DETAIL : épisodes première saison =',
            firstEpisodes.length
          );

          setEpisodes(
            firstEpisodes.map(
              episode =>
                mapEpisode(
                  episode,
                  Number(id),
                  firstSeason
                )
            )
          );
        } else {
          console.log(
            'SERIES DETAIL : aucune saison'
          );

          setEpisodes([]);
        }
      } catch (err) {
        console.error(
          'ERREUR SERIES DETAIL :',
          err
        );

        if (!mounted) {
          return;
        }

        setError(
          err instanceof Error
            ? err.message
            : 'Impossible de charger la série.'
        );
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      mounted = false;
    };
  }, [id]);

  /*
   * Transforme un épisode Xtream
   * en SeriesEpisode.
   */
  
const mapEpisode = (
  episode: XtreamEpisode,
  seriesId: number,
  seasonNumber: number
): SeriesEpisode => {
  return {
    episode_id:
      Number(episode.id),

    series_id:
      seriesId,

    season:
      episode.season ??
      seasonNumber,

    episode:
      episode.episode_num ??
      null,

    title:
      episode.title,

    container_extension:
      episode.container_extension ??
      null,

    plot:
      episode.info?.plot ??
      null,

    rating:
      episode.info?.rating ??
      null,

    rating_5based:
      episode.info
        ?.rating_5based ??
      null,

    duration:
      episode.info?.duration ??
      null,

    duration_seconds:
      episode.info
        ?.duration_secs ??
      null,

    direct_source:
      episode.direct_source ??
      null,

    added:
      episode.added ??
      null,

    custom_sid:
      episode.custom_sid ??
      null,

    episode_num:
      episode.episode_num ??
      null,
  };
};



  /*
   * Épisodes de la saison sélectionnée.
   */
  const selectedSeasonEpisodes =
    useMemo(() => {
      if (
        selectedSeason === null
      ) {
        return [];
      }

      return episodes;
    }, [
      selectedSeason,
      episodes,
    ]);

  /*
   * Changement de saison.
   */
  const handleSeason = (
    seasonNumber: number
  ) => {
    console.log(
      'SERIES DETAIL : changement saison =',
      seasonNumber
    );

    setSelectedSeason(
      seasonNumber
    );

    const seasonEpisodes =
      allEpisodes[
        String(seasonNumber)
      ] ?? [];

    console.log(
      'SERIES DETAIL : épisodes saison',
      seasonNumber,
      '=',
      seasonEpisodes.length
    );

    setEpisodes(
      seasonEpisodes.map(
        episode =>
          mapEpisode(
            episode,
            Number(id),
            seasonNumber
          )
      )
    );
  };

  /*
   * Lecture d'un épisode.
   */
  const handlePlayEpisode = (
    episode: SeriesEpisode
  ) => {
    if (!episode.episode_id) {
      console.error(
        'SERIES PLAY : episode_id manquant'
      );

      return;
    }

    const extension =
      episode.container_extension ||
      'mp4';

    let episodeUrl =
      episode.direct_source ||
      '';

    /*
     * Si Xtream ne fournit pas de
     * direct_source, on construit
     * l'URL avec le client Xtream.
     */
    if (
      !episodeUrl &&
      xtreamClient
    ) {
      episodeUrl =
        xtreamClient.getSeriesEpisodeUrl(
          episode.episode_id,
          extension
        );
    }

    console.log(
      'SERIES PLAY : episode =',
      episode.episode_id
    );

    console.log(
      'SERIES PLAY : extension =',
      extension
    );

    console.log(
      'SERIES PLAY : URL =',
      episodeUrl
    );

    if (!episodeUrl) {
      console.error(
        'SERIES PLAY : URL épisode introuvable'
      );

      return;
    }

    router.push({
      pathname: '/player',
      params: {
        url: episodeUrl,
       title: (seriesInfo?.name ?? 'Série') + ' - ' + episode.title,
      },
    });
  };

  /*
    Chargement.
   */
  if (loading) {
    return (
      <SafeAreaView
        style={styles.container}
      >
        <View style={styles.center}>
          <ActivityIndicator
            size="large"
          />

          <Text
            style={styles.loadingText}
          >
            Chargement de la série...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  /*
   * Erreur.
   */

  if (error) {
    return (
      <SafeAreaView
        style={styles.container}
      >
        <View style={styles.center}>
          <Text style={styles.error}>
            {error}
          </Text>

          <Pressable
            style={styles.backButton}
            onPress={() =>
              router.back()
            }
          >
            <Text
              style={styles.backButtonText }
            >
              Retour
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  /*
   * Série introuvable.
   */
  if (!seriesInfo) {
    return (
      <SafeAreaView
        style={styles.container}
      >
        <View style={styles.center}>
          <Text style={styles.error}>
            Série introuvable.
          </Text>

          <Pressable
            style={styles.backButton}
            onPress={() =>
              router.back()
            }
          >
            <Text
              style={
                styles.backButtonText
              }
            >
              Retour
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const poster =
    seriesInfo.cover ?? null;

  return (
    <SafeAreaView
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={
          styles.content
        }
      >
        {/* BARRE SUPÉRIEURE */}
        <View style={styles.topBar}>
          <Pressable
            style={styles.backBut}
            onPress={() =>
              router.back()
            }
          >
            <Text style={styles.backButText}>
              ‹
            </Text>
          </Pressable>
        </View>

        {/* INFORMATIONS SÉRIE */}
        <View style={styles.hero}>
          {poster ? (
            <Image
              source={{
                uri: poster,
              }}
              style={styles.poster}
              resizeMode="cover"
            />
          ) : (
            <View
              style={[
                styles.poster,
                styles.posterPlaceholder,
              ]}
            >
              <Text
                style={
                  styles.placeholderText
                }
              >
                SERIES
              </Text>
            </View>
          )}

          <View
            style={styles.heroInfo}
          >
            <Text style={styles.title}>
              {seriesInfo.name}
            </Text>

            {seriesInfo.rating ? (
              <Text
                style={styles.rating}
              >
                ★ {seriesInfo.rating}
              </Text>
            ) : null}

            {seriesInfo.genre ? (
              <Text
                style={styles.genre}
              >
                {seriesInfo.genre}
              </Text>
            ) : null}

            {seriesInfo.releaseDate ? (
              <Text
                style={styles.meta}
              >
                {seriesInfo.releaseDate}
              </Text>
            ) : null}
          </View>
        </View>

        {/* SYNOPSIS */}
        {seriesInfo.plot ? (
          <View style={styles.section}>
            <Text
              style={
                styles.sectionTitle
              }
            >
              Synopsis
            </Text>

            <Text style={styles.plot}>
              {seriesInfo.plot}
            </Text>
          </View>
        ) : null}

        {/* ACTEURS */}
        {seriesInfo.cast ? (
          <View style={styles.section}>
            <Text
              style={
                styles.sectionTitle
              }
            >
              Acteurs
            </Text>

            <Text style={styles.meta}>
              {seriesInfo.cast}
            </Text>
          </View>
        ) : null}

        {/* SAISONS */}
        <View style={styles.section}>
          <Text
            style={styles.sectionTitle}
          >
            Saisons
          </Text>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={
              false
            }
            contentContainerStyle={
              styles.seasons
            }
          >
            {seasons.map(
              season => (
                <Pressable
                  key={
                    season.season_number
                  }
                  style={[
                    styles.season,
                    selectedSeason ===
                      season.season_number &&
                      styles.seasonActive,
                  ]}
                  onPress={() =>
                    handleSeason(
                      season.season_number
                    )
                  }
                >
                  <Text
                    style={[
                      styles.seasonText,
                      selectedSeason ===
                        season.season_number &&
                        styles.seasonTextActive,
                    ]}
                  >
                    {season.name ??
                      `Saison ${season.season_number}`}
                  </Text>

                  {season.episode_count !==
                  undefined ? (
                    <Text
                      style={[
                        styles.episodeCount,
                        selectedSeason ===
                          season.season_number &&
                          styles.episodeCountActive,
                      ]}
                    >
                      {
                        season.episode_count
                      }{' '}
                      épisode
                      {season.episode_count >
                      1
                        ? 's'
                        : ''}
                    </Text>
                  ) : null}
                </Pressable>
              )
            )}
          </ScrollView>
        </View>

        {/* ÉPISODES */}
        <View style={styles.section}>
          <Text
            style={styles.sectionTitle}
          >
            Épisodes
          </Text>

          {selectedSeasonEpisodes.length ===
          0 ? (
            <Text style={styles.empty}>
              Aucun épisode disponible.
            </Text>
          ) : (
            selectedSeasonEpisodes.map(
              (episode, index) => (
                <Pressable
                  key={`${episode.episode_id}-${index}`}
                  style={styles.episode}
                  onPress={() =>
                    handlePlayEpisode(
                      episode
                    )
                  }
                >
                  {/* NUMÉRO */}
                  <View
                    style={
                      styles.episodeNumber
                    }
                  >
                    <Text
                      style={
                        styles.episodeNumberText
                      }
                    >
                      {episode.episode_num ??
                        index + 1}
                    </Text>
                  </View>

                  {/* INFORMATIONS */}
                  <View
                    style={
                      styles.episodeInfo
                    }
                  >
                    <Text
                      style={
                        styles.episodeTitle
                      }
                      numberOfLines={2}
                    >
                      {episode.title}
                    </Text>

                    {episode.duration ? (
                      <Text
                        style={
                          styles.duration
                        }
                      >
                        {episode.duration}
                      </Text>
                    ) : null}

                    {episode.plot ? (
                      <Text
                        style={
                          styles.episodePlot
                        }
                        numberOfLines={2}
                      >
                        {episode.plot}
                      </Text>
                    ) : null}
                  </View>

                  {/* BOUTON PLAY */}
                  <View
                    style={
                      styles.playButton
                    }
                  >
                    <Text
                      style={
                        styles.playButtonText
                      }
                    >
                      ▶
                    </Text>
                  </View>
                </Pressable>
              )
            )
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
