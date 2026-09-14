import React, {
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

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
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import CategoryBar from '../components/CategoryBar';

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
  }
);

MovieCard.displayName = 'MovieCard';

export default function MoviesScreen() {
  const [categories, setCategories] = useState<Category[]>(
    []
  );

  const [movies, setMovies] = useState<Movie[]>([]);

  const [searchText, setSearchText] = useState('');

  const [failedImages, setFailedImages] = useState<
    number[]
  >([]);

  const [activeCategory, setActiveCategory] =
    useState('');

  const [totalMovies, setTotalMovies] = useState(0);

  const [loadingCategories, setLoadingCategories] =
    useState(true);

  const [loadingMovies, setLoadingMovies] =
    useState(false);

  const [loadingMore, setLoadingMore] =
    useState(false);

  const [hasMore, setHasMore] = useState(true);

  const [error, setError] = useState<string | null>(
    null
  );

  /*
   * Synchronisation Xtream
   */
  const [syncing, setSyncing] = useState(false);

  const [syncProgress, setSyncProgress] =
    useState<MovieSyncProgress | null>(null);

  /*
   * Permet de savoir si l'initialisation
   * complète de l'écran est terminée.
   */
  const initializedRef = useRef(false);

  /*
   * Empêche plusieurs synchronisations
   * simultanées.
   */
  const syncRunningRef = useRef(false);

  /*
   * Verrou indépendant du state.
   */
  const loadingMoreRef = useRef(false);

  /*
   * Numéro de la dernière recherche.
   */
  const searchRequestRef = useRef(0);

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
       * 1. Charger immédiatement le cache SQLite
       * -----------------------------------------------------------
       */

      console.log(
        'FILMS : chargement du cache SQLite...'
      );

      const cachedCategories =
        await getCategoriesFromDatabase();

      setCategories(cachedCategories);

      let firstCategory = '';

      if (cachedCategories.length > 0) {
        firstCategory =
          cachedCategories[0].category_id;

        setActiveCategory(firstCategory);

        await loadMovies(firstCategory);
      } else {
        /*
         * SQLite vide :
         * on ne peut pas encore afficher de films.
         */
        setMovies([]);
        setTotalMovies(0);
        setHasMore(false);
      }

      /*
       * L'écran peut maintenant fonctionner avec le cache.
       */
      initializedRef.current = true;

      /*
       * -----------------------------------------------------------
       * 2. Synchronisation Xtream
       * -----------------------------------------------------------
       */

      await synchronizeCatalog();

      /*
       * -----------------------------------------------------------
       * 3. Relire SQLite après synchronisation
       * -----------------------------------------------------------
       */

      const updatedCategories =
        await getCategoriesFromDatabase();

      setCategories(updatedCategories);

      let categoryToLoad = activeCategory;

      /*
       * Si la catégorie actuelle n'existe plus,
       * on prend la première catégorie disponible.
       */
      const currentCategoryExists =
        updatedCategories.some(
          category =>
            category.category_id ===
            categoryToLoad
        );

      if (
        !currentCategoryExists &&
        updatedCategories.length > 0
      ) {
        categoryToLoad =
          updatedCategories[0].category_id;

        setActiveCategory(categoryToLoad);
      }

      if (updatedCategories.length > 0) {
        await loadMovies(categoryToLoad);
      } else {
        setMovies([]);
        setTotalMovies(0);
        setHasMore(false);
      }
    } catch (err) {
      console.error(
        'Erreur initialisation films :',
        err
      );

      setError(
        'Impossible de charger les films.'
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

  const synchronizeCatalog = async () => {
    if (syncRunningRef.current) {
      return;
    }

    syncRunningRef.current = true;

    try {
      setSyncing(true);
      setError(null);

      console.log(
        'FILMS : début synchronisation Xtream...'
      );

      /*
       * Synchronisation des catégories.
       */
      console.log(
        'CATÉGORIES FILMS : synchronisation...'
      );

      await syncCategories();

      /*
       * Synchronisation intelligente des films.
       */
      console.log(
        'FILMS : synchronisation intelligente...'
      );

      const result =
        await syncMoviesWithProgress(
          progress => {
            setSyncProgress(progress);
          }
        );

      console.log(
        'FILMS : synchronisation terminée',
        result
      );

      /*
       * Recharger les catégories après synchronisation.
       */
      const updatedCategories =
        await getCategoriesFromDatabase();

      setCategories(updatedCategories);

      /*
       * Si aucune catégorie n'était sélectionnée,
       * prendre la première.
       */
      if (
        activeCategory === '' &&
        updatedCategories.length > 0
      ) {
        setActiveCategory(
          updatedCategories[0].category_id
        );
      }
    } catch (err) {
      console.error(
        'Erreur synchronisation films :',
        err
      );

      /*
       * Important :
       * si SQLite contient déjà des films,
       * on ne vide pas l'écran.
       *
       * La synchronisation est secondaire.
       */
      setError(
        'Synchronisation impossible. Les données locales sont utilisées.'
      );
    } finally {
      setSyncing(false);
      syncRunningRef.current = false;
    }
  };

  /*
   * ---------------------------------------------------------------
   * RECHERCHE
   * ---------------------------------------------------------------
   */

  useEffect(() => {
    /*
     * Avant la fin de l'initialisation,
     * on ne lance pas de recherche automatique.
     */
    if (!initializedRef.current) {
      return;
    }

    const timer = setTimeout(() => {
      if (searchText.trim() !== '') {
        searchMovies(searchText);
      } else {
        /*
         * Invalide immédiatement toute recherche
         * encore en cours.
         */
        searchRequestRef.current++;

        loadMovies(activeCategory);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchText]);

  /*
   * ---------------------------------------------------------------
   * RECHERCHE SQLITE
   * ---------------------------------------------------------------
   */

  const searchMovies = async (
    text: string
  ) => {
    const requestId =
      ++searchRequestRef.current;

    const search = text.trim();

    if (search === '') {
      await loadMovies(activeCategory);
      return;
    }

    try {
      setLoadingMovies(true);
      setError(null);

      const [result, count] =
        await Promise.all([
          searchMoviesFromDatabase(
            search,
            activeCategory,
            SEARCH_PAGE_SIZE,
            0
          ),

          getSearchMoviesCountFromDatabase(
            search,
            activeCategory
          ),
        ]);

      /*
       * Une recherche plus récente existe :
       * on ignore ce résultat.
       */
      if (
        requestId !==
        searchRequestRef.current
      ) {
        return;
      }

      setMovies(result);
      setTotalMovies(count);
      setFailedImages([]);

      setHasMore(
        result.length < count
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
        err
      );

      setMovies([]);
      setTotalMovies(0);
      setHasMore(false);

      setError(
        'Erreur pendant la recherche.'
      );
    } finally {
      if (
        requestId ===
        searchRequestRef.current
      ) {
        setLoadingMovies(false);
      }
    }
  };

  /*
   * ---------------------------------------------------------------
   * CHARGEMENT SQLITE
   * ---------------------------------------------------------------
   */

  const loadMovies = async (
    categoryId?: string
  ) => {
    try {
      setLoadingMovies(true);
      setError(null);

      const [result, count] =
        await Promise.all([
          getMoviesFromDatabase(
            categoryId,
            PAGE_SIZE,
            0
          ),

          getMoviesCountFromDatabase(
            categoryId
          ),
        ]);

      setMovies(result);
      setTotalMovies(count);
      setFailedImages([]);

      setHasMore(
        result.length < count
      );
    } catch (err) {
      console.error(
        'Erreur chargement films :',
        err
      );

      setMovies([]);
      setTotalMovies(0);
      setHasMore(false);

      setError(
        'Impossible de charger les films.'
      );
    } finally {
      setLoadingMovies(false);
    }
  };

  /*
   * ---------------------------------------------------------------
   * PAGINATION
   * ---------------------------------------------------------------
   */

  const loadMoreMovies = useCallback(
    async () => {
      if (loadingMoreRef.current) {
        return;
      }

      if (
        loadingMore ||
        loadingMovies ||
        !hasMore
      ) {
        return;
      }

      loadingMoreRef.current = true;
      setLoadingMore(true);

      try {
        const offset = movies.length;

        let result: Movie[] = [];

        if (
          searchText.trim() !== ''
        ) {
          result =
            await searchMoviesFromDatabase(
              searchText,
              activeCategory,
              SEARCH_PAGE_SIZE,
              offset
            );
        } else {
          result =
            await getMoviesFromDatabase(
              activeCategory,
              PAGE_SIZE,
              offset
            );
        }

        if (result.length === 0) {
          setHasMore(false);
          return;
        }

        setMovies(previous => {
          const existingIds = new Set(
            previous.map(
              movie =>
                movie.stream_id
            )
          );

          const newMovies =
            result.filter(
              movie =>
                !existingIds.has(
                  movie.stream_id
                )
            );

          return [
            ...previous,
            ...newMovies,
          ];
        });

        const newTotal =
          movies.length +
          result.length;

        setHasMore(
          newTotal < totalMovies
        );
      } catch (err) {
        console.error(
          'Erreur chargement page suivante :',
          err
        );
      } finally {
        loadingMoreRef.current = false;
        setLoadingMore(false);
      }
    },
    [
      loadingMore,
      loadingMovies,
      hasMore,
      movies.length,
      activeCategory,
      totalMovies,
      searchText,
    ]
  );

  /*
   * ---------------------------------------------------------------
   * CHANGEMENT CATÉGORIE
   * ---------------------------------------------------------------
   */

  const handleCategorySelect =
    useCallback(
      async (
        categoryId: string
      ) => {
        searchRequestRef.current++;

        setActiveCategory(
          categoryId
        );

        setSearchText('');

        loadingMoreRef.current = false;

        await loadMovies(categoryId);
      },
      []
    );

  /*
   * ---------------------------------------------------------------
   * ERREUR IMAGE
   * ---------------------------------------------------------------
   */

  const handleImageError =
    useCallback(
      (streamId: number) => {
        setFailedImages(
          previous => {
            if (
              previous.includes(
                streamId
              )
            ) {
              return previous;
            }

            return [
              ...previous,
              streamId,
            ];
          }
        );
      },
      []
    );

  /*
   * ---------------------------------------------------------------
   * OUVERTURE FILM
   * ---------------------------------------------------------------
   */

  const handleMoviePress =
    useCallback(
      (streamId: number) => {
        router.push({
          pathname:
            '/movie/[id]',
          params: {
            id: String(streamId),
          },
        });
      },
      []
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
            item.stream_id
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
      ]
    );

  const categoryItems =
    categories.map(category => ({
      id: category.category_id,
      name: category.category_name,
    }));

  const categoryName =
    categories.find(
      category =>
        category.category_id ===
        activeCategory
    )?.category_name ||
    'Films';

  /*
   * ---------------------------------------------------------------
   * TEXTE SYNCHRONISATION
   * ---------------------------------------------------------------
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

        return 'Synchronisation des films...';

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
   * ---------------------------------------------------------------
   * FOOTER PAGINATION
   * ---------------------------------------------------------------
   */

  const renderFooter = () => {
    if (loadingMore) {
      return (
        <View
          style={styles.footer}
        >
          <ActivityIndicator
            size="small"
            color="#E50914"
          />

          <Text
            style={styles.footerText}
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
          style={styles.footer}
        >
          <Text
            style={styles.endText}
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
   * ÉCRAN DE CHARGEMENT INITIAL
   * ---------------------------------------------------------------
   */

  if (
    loadingCategories &&
    categories.length === 0
  ) {
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
            Chargement des catégories...
          </Text>
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
      style={styles.container}
    >
      <View style={styles.header}>
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
       * BARRE DE SYNCHRONISATION
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

      <View
        style={styles.infoRow}
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

      <FlatList
        data={movies}
        renderItem={
          renderMovie
        }
        keyExtractor={item =>
          String(
            item.stream_id
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

/*
|--------------------------------------------------------------------------
| STYLES
|--------------------------------------------------------------------------
*/

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#080808',
  },

  header: {
    height: 70,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
  },

  backButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#171717',
    alignItems: 'center',
    justifyContent: 'center',
  },

  backButtonText: {
    color: '#FFFFFF',
    fontSize: 34,
    lineHeight: 38,
    marginTop: -4,
  },

  headerTextContainer: {
    flex: 1,
    alignItems: 'center',
  },

  title: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 1,
  },

  subtitle: {
    color: '#777777',
    fontSize: 12,
    marginTop: 2,
  },

  headerSpacer: {
    width: 42,
  },

  /*
   * Synchronisation
   */

  syncContainer: {
    marginHorizontal: 20,
    marginBottom: 12,
    padding: 12,
    backgroundColor: '#121212',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#242424',
  },

  syncHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },

  syncTitle: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },

  syncText: {
    color: '#888888',
    fontSize: 11,
    flexShrink: 1,
    marginLeft: 10,
  },

  progressBackground: {
    height: 6,
    backgroundColor: '#292929',
    borderRadius: 3,
    overflow: 'hidden',
  },

  progressBar: {
    height: '100%',
    backgroundColor: '#E50914',
    borderRadius: 3,
  },

  progressIndeterminate: {
    width: '35%',
    height: '100%',
    backgroundColor: '#E50914',
    borderRadius: 3,
  },

  syncPercentage: {
    color: '#777777',
    fontSize: 10,
    textAlign: 'right',
    marginTop: 5,
  },

  searchContainer: {
    marginHorizontal: 20,
    marginBottom: 14,
    position: 'relative',
  },

  searchInput: {
    height: 48,
    backgroundColor: '#151515',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#292929',
    color: '#FFFFFF',
    paddingHorizontal: 18,
    paddingRight: 50,
    fontSize: 15,
  },

  clearSearch: {
    position: 'absolute',
    right: 8,
    top: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#292929',
    alignItems: 'center',
    justifyContent: 'center',
  },

  clearSearchText: {
    color: '#FFFFFF',
    fontSize: 24,
    lineHeight: 27,
  },

  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 10,
  },

  resultCount: {
    color: '#777777',
    fontSize: 13,
  },

  movieList: {
    paddingHorizontal: 12,
    paddingBottom: 30,
  },

  movieListEmpty: {
    flexGrow: 1,
  },

  row: {
    justifyContent: 'space-between',
  },

  movieCard: {
    width: '48%',
    marginBottom: 18,
  },

  movieCardPressed: {
    opacity: 0.7,
    transform: [
      {
        scale: 0.98,
      },
    ],
  },

  posterContainer: {
    width: '100%',
    aspectRatio: 0.67,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#151515',
    position: 'relative',
  },

  poster: {
    width: '100%',
    height: '100%',
  },

  posterFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#171717',
  },

  posterFallbackIcon: {
    fontSize: 42,
  },

  ratingBadge: {
    position: 'absolute',
    right: 7,
    top: 7,
    backgroundColor: 'rgba(0,0,0,0.8)',
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 6,
  },

  ratingText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },

  movieTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 8,
    lineHeight: 19,
  },

  extension: {
    color: '#666666',
    fontSize: 10,
    fontWeight: '600',
    marginTop: 3,
  },

  footer: {
    height: 70,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },

  footerText: {
    color: '#777777',
    fontSize: 12,
  },

  endText: {
    color: '#555555',
    fontSize: 12,
  },

  loadingScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  loadingText: {
    color: '#777777',
    marginTop: 12,
    fontSize: 14,
  },

  errorContainer: {
    marginHorizontal: 20,
    marginBottom: 10,
    padding: 12,
    backgroundColor: '#2A0D0D',
    borderRadius: 8,
  },

  errorText: {
    color: '#FF6B6B',
    fontSize: 13,
    textAlign: 'center',
  },

  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 30,
  },

  emptyIcon: {
    fontSize: 50,
    marginBottom: 15,
  },

  emptyTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },

  emptyText: {
    color: '#666666',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
  },
});