import React, {
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { seriesStyles as styles } from '../styles/seriesStyles';

import {
  getSeriesCategoriesFromDatabase,
  getSeriesFromDatabase,
  getSeriesCountFromDatabase,
  searchSeriesFromDatabase,
  getSearchSeriesCountFromDatabase,
  syncSeriesTV,
  Series,
  SeriesCategory,
  SeriesSyncProgress,
} from '../database/seriesRepository';

const PAGE_SIZE = 100;

/*
============================================================
IMAGE PAR DÉFAUT
============================================================
*/

const DEFAULT_SERIES_IMAGE =
  require('../assets/icon.png');

/*
============================================================
TYPE CARTE SÉRIE
============================================================
*/

type SeriesCardProps = {
  item: Series;
  imageFailed: boolean;
  onImageError: (seriesId: number) => void;
  onPress: (seriesId: number) => void;
};

/*
============================================================
RÉCUPÉRATION IMAGE SÉRIE
============================================================
*
* Priorité :
*
* 1. cover
* 2. backdrop_path
* 3. image par défaut
*
============================================================
*/

const getSeriesImage = (
  item: Series
): string | null => {
  /*
  ----------------------------------------------------------
  PRIORITÉ 1 : COVER
  ----------------------------------------------------------
  */

  if (
    item.cover &&
    item.cover.trim() !== ''
  ) {
    return item.cover.trim();
  }

  /*
  ----------------------------------------------------------
  PRIORITÉ 2 : BACKDROP
  ----------------------------------------------------------
  */

  if (item.backdrop_path) {
    try {
      const paths =
        JSON.parse(
          item.backdrop_path
        );

      if (
        Array.isArray(paths) &&
        paths.length > 0 &&
        typeof paths[0] === 'string' &&
        paths[0].trim() !== ''
      ) {
        return paths[0].trim();
      }

      if (
        typeof paths === 'string' &&
        paths.trim() !== ''
      ) {
        return paths.trim();
      }
    } catch {
      /*
      * Certains serveurs peuvent retourner
      * directement une URL.
      */

      if (
        item.backdrop_path.startsWith(
          'http'
        )
      ) {
        return item.backdrop_path;
      }
    }
  }

  return null;
};

/*
============================================================
CARTE SÉRIE
============================================================
*/

const SeriesCard = memo(
  ({
    item,
    imageFailed,
    onImageError,
    onPress,
  }: SeriesCardProps) => {
    const image =
      getSeriesImage(item);

    return (
      <Pressable
        style={({ pressed }) => [
          styles.seriesCard,
          pressed &&
            styles.seriesCardPressed,
        ]}
        onPress={() =>
          onPress(item.series_id)
        }
      >
        <View
          style={styles.posterContainer}
        >
          {!imageFailed && image ? (
            <Image
              source={{
                uri: image,
              }}
              style={styles.poster}
              resizeMode="cover"
              onError={event => {
                console.log(
                  'SERIES IMAGE : erreur chargement =',
                  item.name,
                  image,
                  event.nativeEvent.error
                );

                onImageError(
                  item.series_id
                );
              }}
            />
          ) : (
            <Image
              source={
                DEFAULT_SERIES_IMAGE
              }
              style={styles.poster}
              resizeMode="cover"
            />
          )}

          {item.rating ? (
            <View
              style={styles.ratingBadge}
            >
              <Text
                style={
                  styles.ratingText
                }
              >
                ★ {item.rating}
              </Text>
            </View>
          ) : null}
        </View>

        <Text
          style={styles.seriesTitle}
          numberOfLines={2}
        >
          {item.name}
        </Text>
      </Pressable>
    );
  }
);

SeriesCard.displayName =
  'SeriesCard';

/*
============================================================
ÉCRAN SÉRIES
============================================================
*/

export default function SeriesScreen() {
  const [categories, setCategories] =
    useState<SeriesCategory[]>([]);

  const [activeCategory, setActiveCategory] =
    useState<string>('all');

  const [series, setSeries] =
    useState<Series[]>([]);

  const [search, setSearch] =
    useState('');

  const [failedImages, setFailedImages] =
    useState<number[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [syncing, setSyncing] =
    useState(false);

  const [total, setTotal] =
    useState(0);

  const [offset, setOffset] =
    useState(0);

  const [error, setError] =
    useState<string | null>(null);

  const [syncProgress, setSyncProgress] =
    useState<SeriesSyncProgress | null>(
      null
    );

  /*
  * Empêche plusieurs synchronisations
  * simultanées.
  */

  const syncRunningRef =
    useRef(false);

  /*
  * Empêche plusieurs chargements
  * de pagination simultanés.
  */

  const loadingMoreRef =
    useRef(false);

  /*
  ============================================================
  CHARGEMENT CATÉGORIES
  ============================================================
  */

  const loadCategories =
    useCallback(async () => {
      console.log(
        'SERIES : chargement catégories SQLite...'
      );

      const result =
        await getSeriesCategoriesFromDatabase();

      console.log(
        'SERIES : catégories SQLite :',
        result.length
      );

      setCategories(result);
    }, []);

  /*
  ============================================================
  CHARGEMENT SÉRIES
  ============================================================
  */

  const loadSeries =
    useCallback(
      async (
        categoryId: string,
        reset = true
      ) => {
        const currentOffset =
          reset ? 0 : offset;

        console.log(
          'SERIES : loadSeries',
          'category =',
          categoryId,
          'offset =',
          currentOffset
        );

        const [
          result,
          count,
        ] = await Promise.all([
          getSeriesFromDatabase(
            categoryId,
            PAGE_SIZE,
            currentOffset
          ),

          getSeriesCountFromDatabase(
            categoryId
          ),
        ]);

        console.log(
          'SERIES : séries récupérées SQLite =',
          result.length,
          '/',
          count
        );

        if (reset) {
          setSeries(result);
          setOffset(PAGE_SIZE);
          setFailedImages([]);
        } else {
          setSeries(previous => {
            const existingIds =
              new Set(
                previous.map(
                  item =>
                    item.series_id
                )
              );

            const newSeries =
              result.filter(
                item =>
                  !existingIds.has(
                    item.series_id
                  )
              );

            return [
              ...previous,
              ...newSeries,
            ];
          });

          setOffset(
            currentOffset +
              PAGE_SIZE
          );
        }

        setTotal(count);
      },
      [offset]
    );

  /*
  ============================================================
  RECHERCHE
  ============================================================
  */

  const searchSeries =
    useCallback(
      async (text: string) => {
        const term =
          text.trim();

        if (!term) {
          await loadSeries(
            activeCategory,
            true
          );

          return;
        }

        console.log(
          'SERIES : recherche =',
          term
        );

        try {
          const [
            result,
            count,
          ] = await Promise.all([
            searchSeriesFromDatabase(
              term,
              activeCategory,
              PAGE_SIZE,
              0
            ),

            getSearchSeriesCountFromDatabase(
              term,
              activeCategory
            ),
          ]);

          console.log(
            'SERIES : résultats recherche =',
            result.length,
            '/',
            count
          );

          setSeries(result);
          setTotal(count);
          setOffset(PAGE_SIZE);
          setFailedImages([]);
        } catch (err) {
          console.error(
            'ERREUR RECHERCHE SERIES :',
            err
          );
        }
      },
      [
        activeCategory,
        loadSeries,
      ]
    );

  /*
  ============================================================
  INITIALISATION
  ============================================================
  */

  const initialize =
    useCallback(async () => {
      try {
        console.log(
          '===================================='
        );

        console.log(
          'SERIES : début initialize'
        );

        /*
        ------------------------------------------------------
        ÉTAPE 1
        SQLite
        ------------------------------------------------------
        */

        console.log(
          'SERIES : chargement initial SQLite...'
        );

        await loadCategories();

        const [
          initialSeries,
          initialTotal,
        ] = await Promise.all([
          getSeriesFromDatabase(
            'all',
            PAGE_SIZE,
            0
          ),

          getSeriesCountFromDatabase(
            'all'
          ),
        ]);

        console.log(
          'SERIES : SQLite initial =',
          initialSeries.length,
          '/',
          initialTotal
        );

        setSeries(initialSeries);
        setTotal(initialTotal);
        setOffset(PAGE_SIZE);

        /*
        * L'interface peut maintenant
        * afficher le cache SQLite.
        */

        setLoading(false);

        /*
        ------------------------------------------------------
        ÉTAPE 2
        Synchronisation Xtream
        ------------------------------------------------------
        */

        if (
          syncRunningRef.current
        ) {
          return;
        }

        syncRunningRef.current =
          true;

        console.log(
          'SERIES : début synchronisation Xtream...'
        );

        setSyncing(true);
        setSyncProgress(null);

        const syncResult =
          await syncSeriesTV(
            progress => {
              console.log(
                'SERIES SYNC PROGRESS :',
                progress
              );

              setSyncProgress(
                progress
              );
            }
          );

        console.log(
          'SERIES : synchronisation terminée :',
          syncResult
        );

        /*
        ------------------------------------------------------
        ÉTAPE 3
        Rechargement SQLite
        ------------------------------------------------------
        */

        await loadCategories();

        const [
          synchronizedSeries,
          synchronizedTotal,
        ] = await Promise.all([
          getSeriesFromDatabase(
            activeCategory,
            PAGE_SIZE,
            0
          ),

          getSeriesCountFromDatabase(
            activeCategory
          ),
        ]);

        console.log(
          'SERIES : après synchronisation =',
          synchronizedSeries.length,
          '/',
          synchronizedTotal
        );

        setSeries(
          synchronizedSeries
        );

        setTotal(
          synchronizedTotal
        );

        setOffset(PAGE_SIZE);
        setFailedImages([]);

        console.log(
          'SERIES : initialize terminé'
        );

        console.log(
          '===================================='
        );
      } catch (error) {
        console.error(
          'ERREUR INITIALISATION SERIES :',
          error
        );

        /*
        ------------------------------------------------------
        FALLBACK SQLITE
        ------------------------------------------------------
        */

        try {
          await loadCategories();

          const [
            localSeries,
            localTotal,
          ] = await Promise.all([
            getSeriesFromDatabase(
              activeCategory,
              PAGE_SIZE,
              0
            ),

            getSeriesCountFromDatabase(
              activeCategory
            ),
          ]);

          setSeries(localSeries);
          setTotal(localTotal);
          setOffset(PAGE_SIZE);
        } catch (databaseError) {
          console.error(
            'ERREUR CHARGEMENT SQLITE SERIES :',
            databaseError
          );
        }
      } finally {
        setLoading(false);
        setSyncing(false);
        syncRunningRef.current =
          false;
      }
    }, [
      activeCategory,
      loadCategories,
    ]);

  /*
  ============================================================
  INITIALISATION
  ============================================================
  */

  useEffect(() => {
    void initialize();
  }, [initialize]);

  /*
  ============================================================
  RECHERCHE AVEC PETIT DÉLAI
  ============================================================
  */

  useEffect(() => {
    if (loading) {
      return;
    }

    const timer =
      setTimeout(() => {
        void searchSeries(search);
      }, 300);

    return () =>
      clearTimeout(timer);
  }, [
    search,
    loading,
    searchSeries,
  ]);

  /*
  ============================================================
  RECHERCHE
  ============================================================
  */

  const handleSearch =
    useCallback(
      (text: string) => {
        setSearch(text);
      },
      []
    );

  /*
  ============================================================
  CHANGEMENT CATÉGORIE
  ============================================================
  */

  const handleCategory =
    useCallback(
      async (
        categoryId: string
      ) => {
        console.log(
          'SERIES : changement catégorie =',
          categoryId
        );

        setActiveCategory(
          categoryId
        );

        setSearch('');

        try {
          const [
            result,
            count,
          ] = await Promise.all([
            getSeriesFromDatabase(
              categoryId,
              PAGE_SIZE,
              0
            ),

            getSeriesCountFromDatabase(
              categoryId
            ),
          ]);

          console.log(
            'SERIES : catégorie chargée =',
            result.length,
            '/',
            count
          );

          setSeries(result);
          setTotal(count);
          setOffset(PAGE_SIZE);
          setFailedImages([]);
        } catch (error) {
          console.error(
            'ERREUR CHANGEMENT CATEGORIE SERIES :',
            error
          );
        }
      },
      []
    );

  /*
  ============================================================
  SYNCHRONISATION MANUELLE
  ============================================================
  */

  const handleSync =
    useCallback(async () => {
      if (
        syncing ||
        syncRunningRef.current
      ) {
        return;
      }

      syncRunningRef.current =
        true;

      try {
        console.log(
          'SERIES : synchronisation manuelle...'
        );

        setSyncing(true);
        setSyncProgress(null);
        setError(null);

        const syncResult =
          await syncSeriesTV(
            progress => {
              console.log(
                'SERIES SYNC PROGRESS :',
                progress
              );

              setSyncProgress(
                progress
              );
            }
          );

        console.log(
          'SERIES : résultat sync manuelle =',
          syncResult
        );

        await loadCategories();

        const [
          result,
          count,
        ] = await Promise.all([
          getSeriesFromDatabase(
            activeCategory,
            PAGE_SIZE,
            0
          ),

          getSeriesCountFromDatabase(
            activeCategory
          ),
        ]);

        setSeries(result);
        setTotal(count);
        setOffset(PAGE_SIZE);
        setFailedImages([]);
      } catch (error) {
        console.error(
          'ERREUR SYNCHRONISATION SERIES :',
          error
        );

        setError(
          'Synchronisation impossible. Les données locales sont utilisées.'
        );
      } finally {
        setSyncing(false);
        syncRunningRef.current =
          false;
      }
    }, [
      syncing,
      activeCategory,
      loadCategories,
    ]);

  /*
  ============================================================
  PAGINATION
  ============================================================
  */

  const loadMore =
    useCallback(async () => {
      if (
        loading ||
        syncing ||
        loadingMoreRef.current ||
        series.length >= total
      ) {
        return;
      }

      loadingMoreRef.current =
        true;

      console.log(
        'SERIES : chargement page suivante, offset =',
        offset
      );

      try {
        const result =
          search.trim()
            ? await searchSeriesFromDatabase(
                search.trim(),
                activeCategory,
                PAGE_SIZE,
                offset
              )
            : await getSeriesFromDatabase(
                activeCategory,
                PAGE_SIZE,
                offset
              );

        if (
          result.length === 0
        ) {
          return;
        }

        setSeries(previous => {
          const existingIds =
            new Set(
              previous.map(
                item =>
                  item.series_id
              )
            );

          const newSeries =
            result.filter(
              item =>
                !existingIds.has(
                  item.series_id
                )
            );

          return [
            ...previous,
            ...newSeries,
          ];
        });

        setOffset(
          previous =>
            previous + PAGE_SIZE
        );
      } catch (error) {
        console.error(
          'ERREUR PAGINATION SERIES :',
          error
        );
      } finally {
        loadingMoreRef.current =
          false;
      }
    }, [
      loading,
      syncing,
      series.length,
      total,
      search,
      activeCategory,
      offset,
    ]);

  /*
  ============================================================
  ERREUR IMAGE
  ============================================================
  */

  const handleImageError =
    useCallback(
      (seriesId: number) => {
        setFailedImages(
          previous => {
            if (
              previous.includes(
                seriesId
              )
            ) {
              return previous;
            }

            return [
              ...previous,
              seriesId,
            ];
          }
        );
      },
      []
    );

  /*
  ============================================================
  OUVERTURE SÉRIE
  ============================================================
  */

  const handleSeriesPress =
    useCallback(
      (seriesId: number) => {
        router.push({
          pathname:
            '/series/[id]',
          params: {
            id: String(seriesId),
          },
        });
      },
      []
    );

  /*
  ============================================================
  RENDU SÉRIE
  ============================================================
  */

  const renderSeries =
    useCallback(
      ({
        item,
      }: {
        item: Series;
      }) => {
        const imageFailed =
          failedImages.includes(
            item.series_id
          );

        return (
          <SeriesCard
            item={item}
            imageFailed={
              imageFailed
            }
            onImageError={
              handleImageError
            }
            onPress={
              handleSeriesPress
            }
          />
        );
      },
      [
        failedImages,
        handleImageError,
        handleSeriesPress,
      ]
    );

  /*
  ============================================================
  NOM CATÉGORIE
  ============================================================
  */

  const categoryName =
    activeCategory === 'all'
      ? 'Toutes les séries'
      : categories.find(
          category =>
            category.category_id ===
            activeCategory
        )?.category_name ||
        'Séries';

  /*
  ============================================================
  TEXTE SYNCHRONISATION
  ============================================================
  */

  const getSyncText = () => {
    if (!syncProgress) {
      return 'Connexion à Xtream...';
    }

    switch (
      syncProgress.phase
    ) {
      case 'checking':
        return 'Vérification du catalogue...';

      case 'syncing':
        if (
          syncProgress.total > 0
        ) {
          return `Synchronisation : ${syncProgress.current}/${syncProgress.total}`;
        }

        return 'Synchronisation des séries...';

      case 'deleting':
        return `Nettoyage : ${syncProgress.current}/${syncProgress.total}`;

      case 'done':
        if (
          syncProgress.added > 0 ||
          syncProgress.updated > 0 ||
          syncProgress.deleted > 0
        ) {
          return 'Catalogue mis à jour';
        }

        return 'Catalogue déjà à jour';

      default:
        return 'Synchronisation...';
    }
  };

  /*
  ============================================================
  FOOTER
  ============================================================
  */

  const renderFooter =
    () => {
      if (
        series.length > 0 &&
        series.length < total
      ) {
        return (
          <View
            style={styles.footer}
          >
            <ActivityIndicator
              size="small"
              color="#E50914"
            />

            <Text
              style={
                styles.footerText
              }
            >
              Chargement...
            </Text>
          </View>
        );
      }

      if (
        series.length > 0 &&
        series.length >= total
      ) {
        return (
          <View
            style={styles.footer}
          >
            <Text
              style={styles.endText}
            >
              Toutes les séries sont
              chargées
            </Text>
          </View>
        );
      }

      return null;
    };

  /*
  ============================================================
  CHARGEMENT INITIAL
  ============================================================
  */

  if (loading) {
    return (
      <SafeAreaView
        style={styles.container}
      >
        <View
          style={styles.loadingScreen}
        >
          <ActivityIndicator
            size="large"
            color="#E50914"
          />

          <Text
            style={styles.loadingText}
          >
            Chargement des séries...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  /*
  ============================================================
  INTERFACE
  ============================================================
  */

  return (
    <SafeAreaView
      style={styles.container}
    >
      {/* HEADER */}

      <View
        style={styles.header}
      >
        <Pressable
          style={
            styles.backButton
          }
          onPress={() =>
            router.back()
          }
        >
          <Text
            style={
              styles.backButtonText
            }
          >
            ‹
          </Text>
        </Pressable>

        <View
          style={
            styles.headerTextContainer
          }
        >
          <Text
            style={styles.title}
          >
            SÉRIES
          </Text>

          <Text
            style={styles.subtitle}
            numberOfLines={1}
          >
            {categoryName}
          </Text>
        </View>

        <View
          style={styles.headerSpacer}
        />
      </View>

      {/* SYNCHRONISATION */}

      {syncing ? (
        <View
          style={
            styles.syncContainer
          }
        >
          <View
            style={
              styles.syncHeader
            }
          >
            <Text
              style={
                styles.syncTitle
              }
            >
              Synchronisation
            </Text>

            <Text
              style={
                styles.syncText
              }
              numberOfLines={1}
            >
              {getSyncText()}
            </Text>
          </View>

          <View
            style={
              styles.progressBackground
            }
          >
            {syncProgress &&
            syncProgress.total > 0 ? (
              <View
                style={[
                  styles.progressBar,
                  {
                    width: `${Math.min(
                      100,
                      Math.round(
                        (syncProgress.current /
                          syncProgress.total) *
                          100
                      )
                    )}%`,
                  },
                ]}
              />
            ) : (
              <View
                style={
                  styles.progressIndeterminate
                }
              />
            )}
          </View>

          {syncProgress &&
          syncProgress.total > 0 ? (
            <Text
              style={
                styles.syncPercentage
              }
            >
              {Math.round(
                (syncProgress.current /
                  syncProgress.total) *
                  100
              )}
              %
            </Text>
          ) : null}
        </View>
      ) : null}

      {/* RECHERCHE */}

      <View
        style={
          styles.searchContainer
        }
      >
        <TextInput
          value={search}
          onChangeText={
            handleSearch
          }
          placeholder="Rechercher une série..."
          placeholderTextColor="#666666"
          style={
            styles.searchInput
          }
          autoCapitalize="none"
          autoCorrect={false}
        />

        {search.length > 0 ? (
          <Pressable
            style={
              styles.clearSearch
            }
            onPress={() =>
              setSearch('')
            }
          >
            <Text
              style={
                styles.clearSearchText
              }
            >
              ×
            </Text>
          </Pressable>
        ) : null}
      </View>

      {/* CATÉGORIES */}
      {/* CATÉGORIES */}

<View style={styles.categoriesContainer}>
  <FlatList
    horizontal
    data={[
      {
        category_id: 'all',
        category_name: 'Toutes',
        parent_id: 0,
      },
      ...categories,
    ]}
    keyExtractor={item => item.category_id}
    showsHorizontalScrollIndicator={false}
    contentContainerStyle={styles.categories}
    renderItem={({ item }) => (
      <Pressable
        style={[
          styles.category,
          activeCategory === item.category_id &&
            styles.categoryActive,
        ]}
        onPress={() =>
          void handleCategory(item.category_id)
        }
      >
        <Text
          style={[
            styles.categoryText,
            activeCategory === item.category_id &&
              styles.categoryTextActive,
          ]}
          numberOfLines={1}
        >
          {item.category_name}
        </Text>
      </Pressable>
    )}
  />
</View>

      {/* INFORMATIONS */}

      <View
        style={styles.infoRow}
      >
        <Text
          style={
            styles.resultCount
          }
        >
          {search.trim() !== ''
            ? `${total} résultat${
                total > 1
                  ? 's'
                  : ''
              }`
            : `${total} séries`}
        </Text>

        {!syncing &&
        series.length === 0 ? null : null}
      </View>

      {/* ERREUR */}

      {error ? (
        <View
          style={
            styles.errorContainer
          }
        >
          <Text
            style={
              styles.errorText
            }
          >
            {error}
          </Text>
        </View>
      ) : null}

      {/* GRILLE */}

      <FlatList
        data={series}
        renderItem={
          renderSeries
        }
        keyExtractor={item =>
          String(
            item.series_id
          )
        }
        numColumns={2}
        columnWrapperStyle={
          styles.row
        }
        contentContainerStyle={[
          styles.seriesList,
          series.length === 0 &&
            styles.seriesListEmpty,
        ]}
        removeClippedSubviews
        initialNumToRender={10}
        maxToRenderPerBatch={8}
        windowSize={5}
        updateCellsBatchingPeriod={
          50
        }
        onEndReached={() =>
          void loadMore()
        }
        onEndReachedThreshold={0.5}
        ListFooterComponent={
          renderFooter
        }
        ListEmptyComponent={
          <View
            style={
              styles.emptyContainer
            }
          >
            <Text
              style={styles.emptyIcon}
            >
              📺
            </Text>

            <Text
              style={
                styles.emptyTitle
              }
            >
              Aucune série trouvée
            </Text>

            <Text
              style={
                styles.emptyText
              }
            >
              {search.trim() !== ''
                ? 'Aucune série ne correspond à votre recherche.'
                : 'Cette catégorie ne contient aucune série.'}
            </Text>
          </View>
        }
      />

      {/* SYNCHRONISATION MANUELLE */}

      {!syncing ? (
        <Pressable
          style={{
            position: 'absolute',
            right: 16,
            top: 14,
            height: 42,
            justifyContent: 'center',
          }}
          onPress={() =>
            void handleSync()
          }
        >
          <Text
            style={{
              color: '#4DA6FF',
              fontSize: 12,
              fontWeight: '600',
            }}
          >
            Synchroniser
          </Text>
        </Pressable>
      ) : null}
    </SafeAreaView>
  );
}