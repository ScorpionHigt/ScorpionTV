import React, {
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import { moviesStyles as styles } from '../styles/moviesStyles';

import {
  getCategoriesFromDatabase,
  getMoviesFromDatabase,
  getMoviesCountFromDatabase,
  searchMoviesFromDatabase,
  getSearchMoviesCountFromDatabase,
  syncCategories,
  syncMoviesWithProgress,
  Movie,
  MovieSyncProgress,
} from '../database/catalogRepository';

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

import CategoryBar from '../components/CategoryBar';

import {
  getCachedUserAccess,
} from '../api/accessApi';

type Category = {
  category_id: string;
  category_name: string;
};

const PAGE_SIZE = 100;
const SEARCH_PAGE_SIZE = 50;

type MovieCardProps = {
  item: Movie;
  imageFailed: boolean;
  onImageError: (streamId: number) => void;
  onPress: (streamId: number) => void;
};

const MovieCard = memo(
  ({
    item,
    imageFailed,
    onImageError,
    onPress,
  }: MovieCardProps) => {
    return (
      <Pressable
        style={({ pressed }) => [
          styles.movieCard,
          pressed && styles.movieCardPressed,
        ]}
        onPress={() => onPress(item.stream_id)}
      >
        <View style={styles.posterContainer}>
          {!imageFailed && item.stream_icon ? (
            <Image
              source={{
                uri: item.stream_icon,
              }}
              style={styles.poster}
              resizeMode="cover"
              onError={() =>
                onImageError(item.stream_id)
              }
            />
          ) : (
            <View style={styles.posterFallback}>
              <Text style={styles.posterFallbackIcon}>
                🎬
              </Text>
            </View>
          )}

          {item.rating ? (
            <View style={styles.ratingBadge}>
              <Text style={styles.ratingText}>
                ★ {item.rating}
              </Text>
            </View>
          ) : null}
        </View>

        <Text
          style={styles.movieTitle}
          numberOfLines={2}
        >
          {item.name}
        </Text>

        {item.container_extension ? (
          <Text style={styles.extension}>
            {item.container_extension.toUpperCase()}
          </Text>
        ) : null}
      </Pressable>
    );
  },
);

MovieCard.displayName = 'MovieCard';

export default function MoviesScreen() {
  /*
   * ---------------------------------------------------------------
   * DONNÉES
   * ---------------------------------------------------------------
   */

  const [categories, setCategories] =
    useState<Category[]>([]);

  const [movies, setMovies] =
    useState<Movie[]>([]);

  const [searchText, setSearchText] =
    useState('');

  const [failedImages, setFailedImages] =
    useState<number[]>([]);

  const [activeCategory, setActiveCategory] =
    useState('');

  const [totalMovies, setTotalMovies] =
    useState(0);

  /*
   * ---------------------------------------------------------------
   * DROITS UTILISATEUR
   * ---------------------------------------------------------------
   */

  const [accessChecked, setAccessChecked] =
    useState(false);

  const [moviesLimit, setMoviesLimit] =
    useState(0);

  const [adultAccess, setAdultAccess] =
    useState(false);

  /*
   * ---------------------------------------------------------------
   * CHARGEMENT
   * ---------------------------------------------------------------
   */

  const [loadingCategories, setLoadingCategories] =
    useState(true);

  const [loadingMovies, setLoadingMovies] =
    useState(false);

  const [loadingMore, setLoadingMore] =
    useState(false);

  const [hasMore, setHasMore] =
    useState(true);

  const [error, setError] =
    useState<string | null>(null);

  /*
   * ---------------------------------------------------------------
   * SYNCHRONISATION XTREAM
   * ---------------------------------------------------------------
   */

  const [syncing, setSyncing] =
    useState(false);

  const [syncProgress, setSyncProgress] =
    useState<MovieSyncProgress | null>(null);

  /*
   * ---------------------------------------------------------------
   * REFS
   * ---------------------------------------------------------------
   */

  const initializedRef =
    useRef(false);

  const syncRunningRef =
    useRef(false);

  const loadingMoreRef =
    useRef(false);

  const searchRequestRef =
    useRef(0);

  /*
   * ---------------------------------------------------------------
   * INITIALISATION
   * ---------------------------------------------------------------
   */

  useEffect(() => {
    initialize();
  }, []);

  const initialize = async () => {
    try {
      setError(null);

      /*
       * -----------------------------------------------------------
       * 0. RÉCUPÉRATION DES DROITS DEPUIS LE CACHE
       * -----------------------------------------------------------
       */

      console.log(
        'FILMS : récupération des droits depuis le cache...',
      );

      const userAccess =
        getCachedUserAccess();

      console.log(
        'FILMS : UserAccess en cache =',
        userAccess,
      );

      /*
       * Aucun accès disponible.
       */
      if (
        !userAccess?.subscription ||
        !userAccess?.limits
      ) {
        console.log(
          'FILMS : aucun abonnement ou aucune limite disponible.',
        );

        setMoviesLimit(0);
        setAdultAccess(false);
        setAccessChecked(true);

        setMovies([]);
        setTotalMovies(0);
        setHasMore(false);

        return;
      }

      /*
       * Limite films.
       */
      const cachedMoviesLimit =
        userAccess.limits.movies ?? 0;

      /*
       * Accès contenu adulte.
       */
      const cachedAdultAccess =
        userAccess.limits.adult === true;

      console.log(
        'FILMS : limite films =',
        cachedMoviesLimit,
      );

      console.log(
        'FILMS : accès adulte =',
        cachedAdultAccess,
      );

      setMoviesLimit(
        cachedMoviesLimit,
      );

      setAdultAccess(
        cachedAdultAccess,
      );

      setAccessChecked(true);

      /*
       * Aucun film autorisé.
       */
      if (cachedMoviesLimit <= 0) {
        console.log(
          'FILMS : accès aux films refusé.',
        );

        setMovies([]);
        setTotalMovies(0);
        setHasMore(false);

        return;
      }

      /*
       * -----------------------------------------------------------
       * 1. CHARGER IMMÉDIATEMENT SQLITE
       * -----------------------------------------------------------
       */

      console.log(
        'FILMS : chargement du cache SQLite...',
      );

      const cachedCategories =
        await getCategoriesFromDatabase();

      setCategories(
        cachedCategories,
      );

      let firstCategory = '';

      if (
        cachedCategories.length > 0
      ) {
        firstCategory =
          cachedCategories[0].category_id;

        setActiveCategory(
          firstCategory,
        );

        await loadMovies(
          firstCategory,
          cachedMoviesLimit,
        );
      } else {
        setMovies([]);
        setTotalMovies(0);
        setHasMore(false);
      }

      /*
       * L'écran peut maintenant fonctionner
       * avec les données locales.
       */
      initializedRef.current = true;

      /*
       * -----------------------------------------------------------
       * 2. SYNCHRONISATION XTREAM
       * -----------------------------------------------------------
       */

      await synchronizeCatalog();

      /*
       * -----------------------------------------------------------
       * 3. RELIRE SQLITE APRÈS SYNCHRONISATION
       * -----------------------------------------------------------
       */

      const updatedCategories =
        await getCategoriesFromDatabase();

      setCategories(
        updatedCategories,
      );

      let categoryToLoad =
        firstCategory;

      /*
       * Utiliser la catégorie actuellement sélectionnée
       * si elle existe toujours.
       */
      const currentCategoryExists =
        updatedCategories.some(
          category =>
            category.category_id ===
            activeCategory,
        );

      if (
        currentCategoryExists
      ) {
        categoryToLoad =
          activeCategory;
      }

      /*
       * Si la catégorie actuelle n'existe plus,
       * utiliser la première disponible.
       */
      if (
        !currentCategoryExists &&
        updatedCategories.length > 0
      ) {
        categoryToLoad =
          updatedCategories[0]
            .category_id;

        setActiveCategory(
          categoryToLoad,
        );
      }

      if (
        updatedCategories.length > 0
      ) {
        await loadMovies(
          categoryToLoad,
          cachedMoviesLimit,
        );
      } else {
        setMovies([]);
        setTotalMovies(0);
        setHasMore(false);
      }
    } catch (err) {
      console.error(
        'Erreur initialisation films :',
        err,
      );

      setError(
        'Impossible de charger les films.',
      );
    } finally {
      setLoadingCategories(false);
    }
  };

  /*
   * ---------------------------------------------------------------
   * SYNCHRONISATION XTREAM
   * ---------------------------------------------------------------
   */

  const synchronizeCatalog =
    async () => {
      if (
        syncRunningRef.current
      ) {
        return;
      }

      syncRunningRef.current =
        true;

      try {
        setSyncing(true);
        setError(null);

        console.log(
          'FILMS : début synchronisation Xtream...',
        );

        /*
         * Synchronisation des catégories.
         */
        console.log(
          'CATÉGORIES FILMS : synchronisation...',
        );

        await syncCategories();

        /*
         * Synchronisation intelligente.
         */
        console.log(
          'FILMS : synchronisation intelligente...',
        );

        const result =
          await syncMoviesWithProgress(
            progress => {
              setSyncProgress(
                progress,
              );
            },
          );

        console.log(
          'FILMS : synchronisation terminée',
          result,
        );

        /*
         * Relire les catégories.
         */
        const updatedCategories =
          await getCategoriesFromDatabase();

        setCategories(
          updatedCategories,
        );

        /*
         * Si aucune catégorie n'est sélectionnée,
         * prendre la première.
         */
        if (
          activeCategory === '' &&
          updatedCategories.length > 0
        ) {
          setActiveCategory(
            updatedCategories[0]
              .category_id,
          );
        }
      } catch (err) {
        console.error(
          'Erreur synchronisation films :',
          err,
        );

        /*
         * Les données SQLite restent affichées.
         */
        setError(
          'Synchronisation impossible. Les données locales sont utilisées.',
        );
      } finally {
        setSyncing(false);

        syncRunningRef.current =
          false;
      }
    };

  /*
   * ---------------------------------------------------------------
   * RECHERCHE
   * ---------------------------------------------------------------
   */

  useEffect(() => {
    if (
      !initializedRef.current
    ) {
      return;
    }

    const timer =
      setTimeout(() => {
        if (
          searchText.trim() !== ''
        ) {
          searchMovies(
            searchText,
          );
        } else {
          searchRequestRef.current++;

          loadMovies(
            activeCategory,
            moviesLimit,
          );
        }
      }, 300);

    return () =>
      clearTimeout(timer);
  }, [
    searchText,
    activeCategory,
    moviesLimit,
  ]);

  /*
   * ---------------------------------------------------------------
   * RECHERCHE SQLITE
   * ---------------------------------------------------------------
   */

  const searchMovies =
    async (
      text: string,
    ) => {
      const requestId =
        ++searchRequestRef.current;

      const search =
        text.trim();

      if (search === '') {
        await loadMovies(
          activeCategory,
          moviesLimit,
        );

        return;
      }

      try {
        setLoadingMovies(true);
        setError(null);

        const [
          result,
          count,
        ] =
          await Promise.all([
            searchMoviesFromDatabase(
              search,
              activeCategory,
              SEARCH_PAGE_SIZE,
              0,
            ),

            getSearchMoviesCountFromDatabase(
              search,
              activeCategory,
            ),
          ]);

        /*
         * Recherche plus récente :
         * ignorer le résultat.
         */
        if (
          requestId !==
          searchRequestRef.current
        ) {
          return;
        }

        /*
         * Respect de la limite utilisateur.
         */
        const limitedResult =
          result.slice(
            0,
            moviesLimit,
          );

        const limitedCount =
          Math.min(
            count,
            moviesLimit,
          );

        setMovies(
          limitedResult,
        );

        setTotalMovies(
          limitedCount,
        );

        setFailedImages([]);

        setHasMore(
          limitedResult.length <
            limitedCount,
        );
      } catch (err) {
        if (
          requestId !==
          searchRequestRef.current
        ) {
          return;
        }

        console.error(
          'Erreur recherche films :',
          err,
        );

        setMovies([]);
        setTotalMovies(0);
        setHasMore(false);

        setError(
          'Erreur pendant la recherche.',
        );
      } finally {
        if (
          requestId ===
          searchRequestRef.current
        ) {
          setLoadingMovies(
            false,
          );
        }
      }
    };

  /*
   * ---------------------------------------------------------------
   * CHARGEMENT SQLITE
   * ---------------------------------------------------------------
   */

  const loadMovies =
    async (
      categoryId?: string,
      limitOverride?: number,
    ) => {
      try {
        setLoadingMovies(true);
        setError(null);

        const effectiveLimit =
          limitOverride ??
          moviesLimit;

        /*
         * Aucun droit.
         */
        if (
          effectiveLimit <= 0
        ) {
          setMovies([]);
          setTotalMovies(0);
          setHasMore(false);

          return;
        }

        const [
          result,
          count,
        ] =
          await Promise.all([
            getMoviesFromDatabase(
              categoryId,
              PAGE_SIZE,
              0,
            ),

            getMoviesCountFromDatabase(
              categoryId,
            ),
          ]);

        /*
         * Respect de la limite du compte.
         */
        const limitedResult =
          result.slice(
            0,
            effectiveLimit,
          );

        const limitedCount =
          Math.min(
            count,
            effectiveLimit,
          );

        setMovies(
          limitedResult,
        );

        setTotalMovies(
          limitedCount,
        );

        setFailedImages([]);

        setHasMore(
          limitedResult.length <
            limitedCount,
        );
      } catch (err) {
        console.error(
          'Erreur chargement films :',
          err,
        );

        setMovies([]);
        setTotalMovies(0);
        setHasMore(false);

        setError(
          'Impossible de charger les films.',
        );
      } finally {
        setLoadingMovies(
          false,
        );
      }
    };

  /*
   * ---------------------------------------------------------------
   * PAGINATION
   * ---------------------------------------------------------------
   */

  const loadMoreMovies =
    useCallback(
      async () => {
        if (
          loadingMoreRef.current
        ) {
          return;
        }

        if (
          loadingMore ||
          loadingMovies ||
          !hasMore
        ) {
          return;
        }

        /*
         * Aucun accès.
         */
        if (
          moviesLimit <= 0
        ) {
          setHasMore(false);
          return;
        }

        /*
         * Limite déjà atteinte.
         */
        if (
          movies.length >=
          moviesLimit
        ) {
          setHasMore(false);
          return;
        }

        const remaining =
          moviesLimit -
          movies.length;

        if (
          remaining <= 0
        ) {
          setHasMore(false);
          return;
        }

        loadingMoreRef.current =
          true;

        setLoadingMore(true);

        try {
          const offset =
            movies.length;

          let result: Movie[] =
            [];

          /*
           * Recherche.
           */
          if (
            searchText.trim() !==
            ''
          ) {
            result =
              await searchMoviesFromDatabase(
                searchText,
                activeCategory,
                Math.min(
                  SEARCH_PAGE_SIZE,
                  remaining,
                ),
                offset,
              );
          } else {
            /*
             * Catalogue normal.
             */
            result =
              await getMoviesFromDatabase(
                activeCategory,
                Math.min(
                  PAGE_SIZE,
                  remaining,
                ),
                offset,
              );
          }

          if (
            result.length === 0
          ) {
            setHasMore(false);
            return;
          }

          /*
           * Sécurité :
           * ne jamais dépasser la limite.
           */
          const limitedResult =
            result.slice(
              0,
              remaining,
            );

          setMovies(
            previous => {
              const existingIds =
                new Set(
                  previous.map(
                    movie =>
                      movie.stream_id,
                  ),
                );

              const newMovies =
                limitedResult.filter(
                  movie =>
                    !existingIds.has(
                      movie.stream_id,
                    ),
                );

              return [
                ...previous,
                ...newMovies,
              ].slice(
                0,
                moviesLimit,
              );
            },
          );

          const newTotal =
            Math.min(
              movies.length +
                limitedResult.length,
              moviesLimit,
            );

          setHasMore(
            newTotal <
              Math.min(
                totalMovies,
                moviesLimit,
              ),
          );
        } catch (err) {
          console.error(
            'Erreur chargement page suivante :',
            err,
          );
        } finally {
          loadingMoreRef.current =
            false;

          setLoadingMore(false);
        }
      },
      [
        loadingMore,
        loadingMovies,
        hasMore,
        movies.length,
        moviesLimit,
        activeCategory,
        totalMovies,
        searchText,
      ],
    );

  /*
   * ---------------------------------------------------------------
   * CHANGEMENT CATÉGORIE
   * ---------------------------------------------------------------
   */

  const handleCategorySelect =
    useCallback(
      async (
        categoryId: string,
      ) => {
        searchRequestRef.current++;

        setActiveCategory(
          categoryId,
        );

        setSearchText('');

        loadingMoreRef.current =
          false;

        await loadMovies(
          categoryId,
          moviesLimit,
        );
      },
      [moviesLimit],
    );

  /*
   * ---------------------------------------------------------------
   * ERREUR IMAGE
   * ---------------------------------------------------------------
   */

  const handleImageError =
    useCallback(
      (
        streamId: number,
      ) => {
        setFailedImages(
          previous => {
            if (
              previous.includes(
                streamId,
              )
            ) {
              return previous;
            }

            return [
              ...previous,
              streamId,
            ];
          },
        );
      },
      [],
    );

  /*
   * ---------------------------------------------------------------
   * OUVERTURE FILM
   * ---------------------------------------------------------------
   */

  const handleMoviePress =
    useCallback(
      (
        streamId: number,
      ) => {
        router.push({
          pathname:
            '/movie/[id]',
          params: {
            id: String(
              streamId,
            ),
          },
        });
      },
      [],
    );

  /*
   * ---------------------------------------------------------------
   * RENDU FILM
   * ---------------------------------------------------------------
   */

  const renderMovie =
    useCallback(
      ({
        item,
      }: {
        item: Movie;
      }) => {
        const imageFailed =
          failedImages.includes(
            item.stream_id,
          );

        return (
          <MovieCard
            item={item}
            imageFailed={
              imageFailed
            }
            onImageError={
              handleImageError
            }
            onPress={
              handleMoviePress
            }
          />
        );
      },
      [
        failedImages,
        handleImageError,
        handleMoviePress,
      ],
    );

  /*
   * ---------------------------------------------------------------
   * CATÉGORIES
   * ---------------------------------------------------------------
   */

  const categoryItems =
    categories.map(
      category => ({
        id:
          category.category_id,
        name:
          category.category_name,
      }),
    );

  const categoryName =
    categories.find(
      category =>
        category.category_id ===
        activeCategory,
    )?.category_name ||
    'Films';

  /*
   * ---------------------------------------------------------------
   * TEXTE SYNCHRONISATION
   * ---------------------------------------------------------------
   */

  const getSyncText =
    () => {
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
            syncProgress.total >
            0
          ) {
            return `Synchronisation : ${syncProgress.current}/${syncProgress.total}`;
          }

          return 'Synchronisation des films...';

        case 'deleting':
          return `Nettoyage : ${syncProgress.current}/${syncProgress.total}`;

        case 'done':
          if (
            syncProgress.added >
              0 ||
            syncProgress.updated >
              0 ||
            syncProgress.deleted >
              0
          ) {
            return 'Catalogue mis à jour';
          }

          return 'Catalogue déjà à jour';

        default:
          return 'Synchronisation...';
      }
    };

  /*
   * ---------------------------------------------------------------
   * FOOTER
   * ---------------------------------------------------------------
   */

  const renderFooter =
    () => {
      if (loadingMore) {
        return (
          <View
            style={
              styles.footer
            }
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
        !hasMore &&
        movies.length > 0
      ) {
        return (
          <View
            style={
              styles.footer
            }
          >
            <Text
              style={
                styles.endText
              }
            >
              Tous les films sont chargés
            </Text>
          </View>
        );
      }

      return null;
    };

  /*
   * ---------------------------------------------------------------
   * CHARGEMENT INITIAL
   * ---------------------------------------------------------------
   */

  if (
    loadingCategories &&
    categories.length === 0
  ) {
    return (
      <SafeAreaView
        style={
          styles.container
        }
      >
        <View
          style={
            styles.loadingScreen
          }
        >
          <ActivityIndicator
            size="large"
            color="#E50914"
          />

          <Text
            style={
              styles.loadingText
            }
          >
            Vérification des accès...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  /*
   * ---------------------------------------------------------------
   * ACCÈS REFUSÉ
   * ---------------------------------------------------------------
   */

  if (
    accessChecked &&
    moviesLimit <= 0
  ) {
    return (
      <SafeAreaView
        style={
          styles.container
        }
      >
        <View
          style={
            styles.loadingScreen
          }
        >
          <Text
            style={
              styles.emptyIcon
            }
          >
            🔒
          </Text>

          <Text
            style={
              styles.emptyTitle
            }
          >
            Accès aux films indisponible
          </Text>

          <Text
            style={
              styles.emptyText
            }
          >
            Votre abonnement ne permet pas
            actuellement d'accéder aux films.
          </Text>

          <Pressable
            style={{
              marginTop: 20,
              backgroundColor:
                '#E50914',
              paddingHorizontal: 24,
              paddingVertical: 12,
              borderRadius: 10,
            }}
            onPress={() =>
              router.back()
            }
          >
            <Text
              style={{
                color: '#FFFFFF',
                fontWeight: '700',
              }}
            >
              Retour
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  /*
   * ---------------------------------------------------------------
   * INTERFACE
   * ---------------------------------------------------------------
   */

  return (
    <SafeAreaView
      style={
        styles.container
      }
    >
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
            FILMS
          </Text>

          <Text
            style={styles.subtitle}
          >
            {categoryName}
          </Text>
        </View>

        <View
          style={
            styles.headerSpacer
          }
        />
      </View>

      {/*
       * -----------------------------------------------------------
       * BARRE SYNCHRONISATION
       * -----------------------------------------------------------
       */}

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
            syncProgress.total >
              0 ? (
              <View
                style={[
                  styles.progressBar,
                  {
                    width: `${Math.min(
                      100,
                      Math.round(
                        (syncProgress.current /
                          syncProgress.total) *
                          100,
                      ),
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
          syncProgress.total >
            0 ? (
            <Text
              style={
                styles.syncPercentage
              }
            >
              {Math.round(
                (syncProgress.current /
                  syncProgress.total) *
                  100,
              )}
              %
            </Text>
          ) : null}
        </View>
      ) : null}

      {/*
       * -----------------------------------------------------------
       * RECHERCHE
       * -----------------------------------------------------------
       */}

      <View
        style={
          styles.searchContainer
        }
      >
        <TextInput
          style={
            styles.searchInput
          }
          placeholder="Rechercher un film..."
          placeholderTextColor="#666666"
          value={searchText}
          onChangeText={
            setSearchText
          }
          autoCapitalize="none"
          autoCorrect={false}
        />

        {searchText.length >
        0 ? (
          <Pressable
            style={
              styles.clearSearch
            }
            onPress={() => {
              searchRequestRef.current++;

              setSearchText('');
            }}
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

      <CategoryBar
        categories={
          categoryItems
        }
        activeCategory={
          activeCategory
        }
        onSelect={
          handleCategorySelect
        }
      />

      {/*
       * -----------------------------------------------------------
       * INFORMATIONS
       * -----------------------------------------------------------
       */}

      <View
        style={
          styles.infoRow
        }
      >
        <Text
          style={
            styles.resultCount
          }
        >
          {searchText.trim() !== ''
            ? `${totalMovies} résultat${
                totalMovies > 1
                  ? 's'
                  : ''
              }`
            : `${totalMovies} films`}
        </Text>

        {loadingMovies ? (
          <ActivityIndicator
            size="small"
            color="#E50914"
          />
        ) : null}
      </View>

      {/*
       * -----------------------------------------------------------
       * ERREUR
       * -----------------------------------------------------------
       */}

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

      {/*
       * -----------------------------------------------------------
       * LISTE
       * -----------------------------------------------------------
       */}

      <FlatList
        data={movies}
        renderItem={
          renderMovie
        }
        keyExtractor={item =>
          String(
            item.stream_id,
          )
        }
        numColumns={2}
        columnWrapperStyle={
          styles.row
        }
        contentContainerStyle={[
          styles.movieList,
          movies.length ===
            0 &&
            styles.movieListEmpty,
        ]}
        removeClippedSubviews
        initialNumToRender={10}
        maxToRenderPerBatch={8}
        windowSize={5}
        updateCellsBatchingPeriod={
          50
        }
        onEndReached={
          loadMoreMovies
        }
        onEndReachedThreshold={
          0.5
        }
        ListFooterComponent={
          renderFooter
        }
        ListEmptyComponent={
          !loadingMovies ? (
            <View
              style={
                styles.emptyContainer
              }
            >
              <Text
                style={
                  styles.emptyIcon
                }
              >
                🎬
              </Text>

              <Text
                style={
                  styles.emptyTitle
                }
              >
                Aucun film trouvé
              </Text>

              <Text
                style={
                  styles.emptyText
                }
              >
                {searchText.trim() !==
                ''
                  ? 'Aucun film ne correspond à votre recherche.'
                  : 'Cette catégorie ne contient aucun film.'}
              </Text>
            </View>
          ) : null
        }
      />
    </SafeAreaView>
  );
}