import { XtreamClient } from '../../api/xtreamClient';
import { xtreamConfig } from '../../api/config';

import React, {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Image,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  router,
  useLocalSearchParams,
} from 'expo-router';

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

export default function SeriesDetailsScreen() {
  
const xtreamClient =
    useMemo(
      () => new XtreamClient(xtreamConfig),
      []
    );

const { id } = useLocalSearchParams<{
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

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        setLoading(true);
        setError(null);

        if (!id) {
          throw new Error(
            'Identifiant de série manquant.'
          );
        }

            const result =
            await getSeriesInfo(Number(id));

        if (!mounted) {
          return;
        }

        setSeriesInfo(result.info ?? null);

        const loadedSeasons =
          result.seasons ?? [];

        setSeasons(loadedSeasons);

        if (loadedSeasons.length > 0) {
          setSelectedSeason(
            loadedSeasons[0].season_number
          );
        }

        const allEpisodes =
          result.episodes ?? {};

        const firstSeason =
          loadedSeasons.length > 0
            ? String(
                loadedSeasons[0]
                  .season_number
              )
            : null;

        if (firstSeason) {
          const firstEpisodes =
            allEpisodes[firstSeason] ?? [];

          setEpisodes(
            firstEpisodes.map(episode => ({
              episode_id: Number(
                episode.id
              ),
              series_id: Number(id),
              season:
                episode.season ??
                Number(firstSeason),
              episode:
                episode.episode_num,
              title: episode.title,
              container_extension:
                episode.container_extension,
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
                episode.episode_num,
            }))
          );
        }
      } catch (err) {
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

  const selectedSeasonEpisodes =
    useMemo(() => {
      if (!selectedSeason || !seriesInfo) {
        return episodes;
      }

      return episodes;
    }, [
      selectedSeason,
      seriesInfo,
      episodes,
    ]);

  const handleSeason = (
    seasonNumber: number
  ) => {
    setSelectedSeason(seasonNumber);

    const allEpisodes =
      seriesInfo?.episodes ?? {};

    const seasonEpisodes =
      allEpisodes[String(seasonNumber)] ??
      [];

    setEpisodes(
      seasonEpisodes.map(
        (episode: any) => ({
          episode_id: Number(
            episode.id
          ),
          series_id: Number(id),
          season:
            episode.season ??
            seasonNumber,
          episode:
            episode.episode_num,
          title: episode.title,
          container_extension:
            episode.container_extension,
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
            episode.episode_num,
        })
      )
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <ActivityIndicator size="large" />
          <Text style={styles.loadingText}>
            Chargement de la série...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <Text style={styles.error}>
            {error}
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

  if (!seriesInfo) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <Text style={styles.error}>
            Série introuvable.
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

  const poster =
    seriesInfo.cover ?? null;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={
          styles.content
        }
      >
        <View style={styles.topBar}>
          <Pressable
            onPress={() => router.back()}
          >
            <Text style={styles.back}>
              ← Retour
            </Text>
          </Pressable>
        </View>

        <View style={styles.hero}>
          {poster ? (
            <Image
              source={{ uri: poster }}
              style={styles.poster}
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

          <View style={styles.heroInfo}>
            <Text style={styles.title}>
              {seriesInfo.name}
            </Text>

            {seriesInfo.rating ? (
              <Text style={styles.rating}>
                ★ {seriesInfo.rating}
              </Text>
            ) : null}

            {seriesInfo.genre ? (
              <Text style={styles.genre}>
                {seriesInfo.genre}
              </Text>
            ) : null}

            {seriesInfo.releaseDate ? (
              <Text style={styles.meta}>
                {seriesInfo.releaseDate}
              </Text>
            ) : null}
          </View>
        </View>

        {seriesInfo.plot ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              Synopsis
            </Text>

            <Text style={styles.plot}>
              {seriesInfo.plot}
            </Text>
          </View>
        ) : null}

        {seriesInfo.cast ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              Acteurs
            </Text>

            <Text style={styles.meta}>
              {seriesInfo.cast}
            </Text>
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
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
            {seasons.map(season => (
              <Pressable
                key={season.season_number}
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
                    {season.episode_count}{' '}
                    épisode
                    {season.episode_count >
                    1
                      ? 's'
                      : ''}
                  </Text>
                ) : null}
              </Pressable>
            ))}
          </ScrollView>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
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
                    onPress={() => {
                      if (!episode.episode_id) {
                        return;
                      }

                      const extension =
                        episode.container_extension ||
                        'mp4';

                      const episodeUrl =
                        episode.direct_source ||
                        xtreamClient.getSeriesEpisodeUrl(
                          episode.episode_id,
                          extension
                        );

                      router.push({
                        pathname: '/player',
                        params: {
                          url: episodeUrl,
                          title: `${seriesInfo.name} - ${episode.title}`,
                        },
                      });
                    }}
                >
                  <View
                    style={styles.episodeNumber}
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

                  <View
                    style={styles.episodeInfo}
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
                        style={styles.duration}
                      >
                        {episode.duration}
                      </Text>
                    ) : null}

                    {episode.plot ? (
                      <Text
                        style={styles.episodePlot}
                        numberOfLines={2}
                      >
                        {episode.plot}
                      </Text>
                    ) : null}
                  </View>

                  <Text
                    style={styles.playIcon}
                  >
                    ▶
                  </Text>
                </Pressable>
              )
            )
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0b0b0b',
  },

  content: {
    paddingBottom: 40,
  },

  topBar: {
    paddingHorizontal: 16,
    paddingVertical: 14,
  },

  back: {
    color: '#ffffff',
    fontSize: 16,
  },

  hero: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginTop: 4,
  },

  poster: {
    width: 130,
    height: 190,
    borderRadius: 10,
    backgroundColor: '#191919',
  },

  posterPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },

  placeholderText: {
    color: '#666666',
    fontSize: 12,
    fontWeight: '700',
  },

  heroInfo: {
    flex: 1,
    marginLeft: 16,
    justifyContent: 'center',
  },

  title: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '700',
  },

  rating: {
    color: '#f5c542',
    fontSize: 15,
    marginTop: 10,
  },

  genre: {
    color: '#bbbbbb',
    fontSize: 14,
    marginTop: 10,
  },

  meta: {
    color: '#888888',
    fontSize: 13,
    marginTop: 7,
  },

  section: {
    marginTop: 24,
    paddingHorizontal: 16,
  },

  sectionTitle: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 12,
  },

  plot: {
    color: '#cccccc',
    fontSize: 14,
    lineHeight: 21,
  },

  seasons: {
    paddingRight: 16,
  },

  season: {
    minWidth: 110,
    paddingHorizontal: 14,
    paddingVertical: 11,
    marginRight: 8,
    borderRadius: 10,
    backgroundColor: '#1b1b1b',
  },

  seasonActive: {
    backgroundColor: '#ffffff',
  },

  seasonText: {
    color: '#bbbbbb',
    fontSize: 14,
    fontWeight: '600',
  },

  seasonTextActive: {
    color: '#000000',
  },

  episodeCount: {
    color: '#777777',
    fontSize: 11,
    marginTop: 4,
  },

  episodeCountActive: {
    color: '#555555',
  },

  episode: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#202020',
  },

  episodeNumber: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1d1d1d',
  },

  episodeNumberText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },

  episodeInfo: {
    flex: 1,
    marginLeft: 12,
    marginRight: 10,
  },

  episodeTitle: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },

  duration: {
    color: '#888888',
    fontSize: 11,
    marginTop: 4,
  },

  episodePlot: {
    color: '#777777',
    fontSize: 12,
    marginTop: 5,
    lineHeight: 17,
  },

  playIcon: {
    color: '#ffffff',
    fontSize: 18,
    paddingHorizontal: 8,
  },

  empty: {
    color: '#777777',
    fontSize: 14,
  },

  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 30,
  },

  loadingText: {
    color: '#ffffff',
    marginTop: 12,
  },

  error: {
    color: '#ff7777',
    textAlign: 'center',
    fontSize: 15,
  },

  backButton: {
    marginTop: 20,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#ffffff',
  },

  backButtonText: {
    color: '#000000',
    fontWeight: '600',
  },
});