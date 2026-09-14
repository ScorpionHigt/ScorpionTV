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
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { router } from 'expo-router';

import { Channel } from '../types/live';
import { setZappingChannels } from '../store/liveZappingStore';
import { XtreamClient } from '../api/xtreamClient';
import { xtreamConfig } from '../api/config';

import {
  getCachedLiveIcon,
  getLiveCategoriesFromDatabase,
  getLiveChannelsCount,
  getLiveChannelsFromDatabase,
  getSearchLiveChannelsCount,
  searchLiveChannelsFromDatabase,
  syncLiveTVIfNeeded,
  LiveSyncProgress,
} from '../database/liveRepository';

type Category = {
  id: string;
  name: string;
};

const PAGE_SIZE = 100;

/* ============================================================
   CARTE D'UNE CHAÎNE
============================================================ */

const ChannelCard = memo(
  ({
    channel,
    onPress,
    iconCacheVersion,
  }: {
    channel: Channel;
    onPress: (channel: Channel) => void;
    iconCacheVersion: number;
  }) => {
    // Force le composant à se mettre à jour lorsque le cache change.
    void iconCacheVersion;

    const icon = getCachedLiveIcon(channel.stream_id);

    const [imageError, setImageError] = useState(false);

    useEffect(() => {
      setImageError(false);
    }, [icon]);

    const showDefaultLogo = !icon || imageError;

    return (
      <Pressable
        style={({ pressed }) => [
          styles.channelCard,
          pressed && styles.channelCardPressed,
        ]}
        onPress={() => onPress(channel)}
      >
        <View style={styles.logoContainer}>
          {showDefaultLogo ? (
            <View style={styles.defaultLogo}>
              <Text style={styles.defaultLogoText}>TV</Text>
            </View>
          ) : (
            <Image
              source={{ uri: icon }}
              style={styles.channelLogo}
              resizeMode="contain"
              onError={() => {
                setImageError(true);
                console.log('LOGO INDISPONIBLE :', channel.name);
              }}
            />
          )}
        </View>

        <Text style={styles.channelName} numberOfLines={2}>
          {channel.name}
        </Text>
      </Pressable>
    );
  },
);

/* ============================================================
   ÉCRAN LIVE TV
============================================================ */

export default function LiveScreen() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeCategory, setActiveCategory] = useState('all');

  const [syncProgress, setSyncProgress] = useState<LiveSyncProgress>({
    phase: 'categories',
    current: 0,
    total: 0,
  });

  const [channels, setChannels] = useState<Channel[]>([]);
  const [totalChannels, setTotalChannels] = useState(0);

  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const [iconCacheVersion, setIconCacheVersion] = useState(0);

  const [searchText, setSearchText] = useState('');
  const [searching, setSearching] = useState(false);

  const searchRequestRef = useRef(0);
  const currentOffsetRef = useRef(0);
  const loadingMoreRef = useRef(false);
  const lastRequestedOffsetRef = useRef<number | null>(null);

  const mountedRef = useRef(true);
  const initialLoadDoneRef = useRef(false);

  const activeCategoryRef = useRef('all');
  const searchTextRef = useRef('');

  useEffect(() => {
    searchTextRef.current = searchText;
  }, [searchText]);

  /* ============================================================
     LECTURE DES CATÉGORIES DEPUIS SQLITE
  ============================================================ */

  const loadCategories = useCallback(async () => {
    try {
      const rows = await getLiveCategoriesFromDatabase();

      if (!mountedRef.current) {
        return;
      }

      const formattedCategories: Category[] = [
        {
          id: 'all',
          name: 'Toutes',
        },
        ...rows.map((category: any) => ({
          id: String(category.category_id),
          name: category.category_name,
        })),
      ];

      setCategories(formattedCategories);

      console.log(
        'CATÉGORIES LIVE LUES DEPUIS SQLITE :',
        formattedCategories.length,
      );
    } catch (error) {
      console.error(
        'ERREUR LECTURE CATÉGORIES LIVE SQLITE :',
        error,
      );
    }
  }, []);

  /* ============================================================
     LECTURE DES CHAÎNES DEPUIS SQLITE
  ============================================================ */

  const loadChannels = useCallback(async (categoryId: string) => {
    try {
      const dbCategoryId =
        categoryId === 'all' ? undefined : categoryId;

      const [rows, count] = await Promise.all([
        getLiveChannelsFromDatabase(
          dbCategoryId,
          PAGE_SIZE,
          0,
        ),
        getLiveChannelsCount(dbCategoryId),
      ]);

      if (!mountedRef.current) {
        return;
      }

      setChannels(rows);
      setTotalChannels(count);

      currentOffsetRef.current = rows.length;
      lastRequestedOffsetRef.current = null;

      console.log(
        'CHAÎNES LIVE LUES DEPUIS SQLITE :',
        rows.length,
        '| OFFSET : 0 | LIMIT :',
        PAGE_SIZE,
        '| CATÉGORIE :',
        categoryId,
      );
    } catch (error) {
      console.error(
        'ERREUR LECTURE CHAÎNES LIVE SQLITE :',
        error,
      );
    }
  }, []);

  /* ============================================================
     RECHERCHE DANS SQLITE
  ============================================================ */

  const searchChannels = useCallback(
    async (text: string, categoryId: string) => {
      const requestId = ++searchRequestRef.current;
      const search = text.trim();

      if (!search) {
        await loadChannels(categoryId);

        if (
          mountedRef.current &&
          requestId === searchRequestRef.current
        ) {
          setSearching(false);
        }

        return;
      }

      setSearching(true);

      try {
        const dbCategoryId =
          categoryId === 'all' ? undefined : categoryId;

        const [rows, count] = await Promise.all([
          searchLiveChannelsFromDatabase(
            search,
            dbCategoryId,
            PAGE_SIZE,
            0,
          ),
          getSearchLiveChannelsCount(
            search,
            dbCategoryId,
          ),
        ]);

        if (
          !mountedRef.current ||
          requestId !== searchRequestRef.current
        ) {
          return;
        }

        setChannels(rows);
        setTotalChannels(count);

        currentOffsetRef.current = rows.length;
        lastRequestedOffsetRef.current = null;

        console.log(
          'RECHERCHE LIVE SQLITE :',
          search,
          '| RÉSULTATS :',
          count,
          '| CATÉGORIE :',
          categoryId,
        );
      } catch (error) {
        console.error(
          'ERREUR RECHERCHE LIVE SQLITE :',
          error,
        );
      } finally {
        if (
          mountedRef.current &&
          requestId === searchRequestRef.current
        ) {
          setSearching(false);
        }
      }
    },
    [loadChannels],
  );

  /* ============================================================
     PAGINATION
  ============================================================ */

  const loadMoreChannels = useCallback(async () => {
    if (loadingMoreRef.current) {
      return;
    }

    if (channels.length >= totalChannels) {
      return;
    }

    const offset = currentOffsetRef.current;

    if (lastRequestedOffsetRef.current === offset) {
      return;
    }

    loadingMoreRef.current = true;
    lastRequestedOffsetRef.current = offset;

    setLoadingMore(true);

    try {
      const dbCategoryId =
        activeCategory === 'all'
          ? undefined
          : activeCategory;

      const search = searchText.trim();

      const nextChannels = search
        ? await searchLiveChannelsFromDatabase(
            search,
            dbCategoryId,
            PAGE_SIZE,
            offset,
          )
        : await getLiveChannelsFromDatabase(
            dbCategoryId,
            PAGE_SIZE,
            offset,
          );

      if (!mountedRef.current) {
        return;
      }

      if (nextChannels.length > 0) {
        setChannels(previous => {
          const existingIds = new Set(
            previous.map(channel => channel.stream_id),
          );

          const uniqueChannels = nextChannels.filter(
            channel => !existingIds.has(channel.stream_id),
          );

          return [
            ...previous,
            ...uniqueChannels,
          ];
        });

        currentOffsetRef.current += nextChannels.length;

        console.log(
          'CHAÎNES LIVE AJOUTÉES :',
          nextChannels.length,
          '| OFFSET :',
          offset,
        );
      }
    } catch (error) {
      console.error(
        'ERREUR PAGINATION CHAÎNES LIVE :',
        error,
      );

      lastRequestedOffsetRef.current = null;
    } finally {
      if (mountedRef.current) {
        loadingMoreRef.current = false;
        setLoadingMore(false);
      }
    }
  }, [
    activeCategory,
    channels.length,
    totalChannels,
    searchText,
  ]);

  /* ============================================================
     INITIALISATION

     1. Affichage immédiat de SQLite
     2. Comparaison serveur / SQLite
     3. Synchronisation uniquement si nécessaire
  ============================================================ */

  useEffect(() => {
    mountedRef.current = true;

    const initialize = async () => {
      try {
        /* ------------------------------------------------------
           AFFICHAGE IMMÉDIAT DE SQLITE
        ------------------------------------------------------ */

        const dbCategories =
          await getLiveCategoriesFromDatabase();

        const [dbChannels, dbCount] = await Promise.all([
          getLiveChannelsFromDatabase(
            undefined,
            PAGE_SIZE,
            0,
          ),
          getLiveChannelsCount(undefined),
        ]);

        if (!mountedRef.current) {
          return;
        }

        const formattedCategories: Category[] = [
          {
            id: 'all',
            name: 'Toutes',
          },
          ...dbCategories.map((category: any) => ({
            id: String(category.category_id),
            name: category.category_name,
          })),
        ];

        setCategories(formattedCategories);
        setChannels(dbChannels);
        setTotalChannels(dbCount);

        currentOffsetRef.current = dbChannels.length;
        initialLoadDoneRef.current = true;

        console.log('================================');
        console.log('AFFICHAGE SQLITE IMMÉDIAT');
        console.log(
          'CATÉGORIES :',
          formattedCategories.length,
        );
        console.log('CHAÎNES :', dbChannels.length);
        console.log('================================');

        setLoading(false);

        /* ------------------------------------------------------
           VÉRIFICATION SERVEUR / SQLITE
        ------------------------------------------------------ */

        const result = await syncLiveTVIfNeeded(progress => {
          if (!mountedRef.current) {
            return;
          }

          setSyncing(true);
          setSyncProgress(progress);
        });

        if (!mountedRef.current) {
          return;
        }

        console.log(
          'VÉRIFICATION LIVE TERMINÉE :',
          result,
        );

        /* ------------------------------------------------------
           UNE SYNCHRONISATION A EU LIEU
        ------------------------------------------------------ */

        if (result.synchronized) {
          await loadCategories();

          if (!mountedRef.current) {
            return;
          }

          const currentSearch =
            searchTextRef.current.trim();

          if (currentSearch) {
            await searchChannels(
              currentSearch,
              activeCategoryRef.current,
            );
          } else {
            await loadChannels(
              activeCategoryRef.current,
            );
          }
        } else {
          /* ----------------------------------------------------
             AUCUNE SYNCHRONISATION

             Les logos ont été mis à jour dans le cache.
             On force donc le rafraîchissement des cartes.
          ---------------------------------------------------- */

          console.log(
            'LIVE TV DÉJÀ À JOUR — AUCUN UPSERT',
          );

          setIconCacheVersion(version => version + 1);
        }

        if (mountedRef.current) {
          setSyncing(false);
        }
      } catch (error) {
        console.error(
          'ERREUR INITIALISATION LIVE TV :',
          error,
        );

        if (!mountedRef.current) {
          return;
        }

        setLoading(false);
        setSyncing(false);
      }
    };

    initialize();

    return () => {
      mountedRef.current = false;
    };
  }, [
    loadCategories,
    loadChannels,
    searchChannels,
  ]);

  /* ============================================================
     EFFET DE RECHERCHE AVEC DÉLAI DE 300 MS
  ============================================================ */

  useEffect(() => {
    if (!initialLoadDoneRef.current) {
      return;
    }

    const timer = setTimeout(() => {
      searchChannels(
        searchText,
        activeCategory,
      );
    }, 300);

    return () => {
      clearTimeout(timer);
    };
  }, [
    searchText,
    activeCategory,
    searchChannels,
  ]);

  /* ============================================================
     CHANGEMENT DE CATÉGORIE
  ============================================================ */

  const handleCategoryPress = useCallback(
    (categoryId: string) => {
      if (categoryId === activeCategory) {
        return;
      }

      activeCategoryRef.current = categoryId;
      setActiveCategory(categoryId);
    },
    [activeCategory],
  );

  /* ============================================================
     OUVERTURE DU LECTEUR
  ============================================================ */

  const handleChannelPress = useCallback(
    (channel: Channel) => {
      setZappingChannels(
        channels,
        channel.stream_id,
      );

      const client = new XtreamClient(xtreamConfig);

      const url = client.getLiveStreamUrl(
        channel.stream_id,
      );

      router.push({
        pathname: '/player',
        params: {
          url: channel.direct_source || url,
          title: channel.name,
          icon:
            getCachedLiveIcon(channel.stream_id) || '',
          streamId: String(channel.stream_id),
        },
      });
    },
    [channels],
  );

  /* ============================================================
     RENDU DES CHAÎNES
  ============================================================ */

  const renderChannel = useCallback(
    ({ item }: { item: Channel }) => (
      <ChannelCard
        channel={item}
        onPress={handleChannelPress}
        iconCacheVersion={iconCacheVersion}
      />
    ),
    [
      handleChannelPress,
      iconCacheVersion,
    ],
  );

  const keyExtractor = useCallback(
    (item: Channel) => String(item.stream_id),
    [],
  );

  const renderFooter = useCallback(() => {
    if (!loadingMore) {
      return null;
    }

    return (
      <View style={styles.loadingMore}>
        <ActivityIndicator
          size="small"
          color="#E50914"
        />

        <Text style={styles.loadingMoreText}>
          Chargement...
        </Text>
      </View>
    );
  }, [loadingMore]);

  /* ============================================================
     AFFICHAGE
  ============================================================ */

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Text style={styles.backButtonText}>
            ‹
          </Text>
        </Pressable>

        <View style={styles.headerTitleContainer}>
          <Text style={styles.title}>
            Live TV
          </Text>

          <Text style={styles.subtitle}>
            {totalChannels.toLocaleString()} chaînes
          </Text>
        </View>
      </View>

      <View style={styles.searchContainer}>
        <TextInput
          value={searchText}
          onChangeText={setSearchText}
          placeholder="Rechercher une chaîne..."
          placeholderTextColor="#666666"
          style={styles.searchInput}
          autoCorrect={false}
          autoCapitalize="none"
        />

        {searching && (
          <ActivityIndicator
            size="small"
            color="#E50914"
          />
        )}

        {searchText.length > 0 && !searching && (
          <Pressable
            onPress={() => {
              searchRequestRef.current++;
              setSearchText('');
            }}
            style={styles.clearSearch}
          >
            <Text style={styles.clearSearchText}>
              ×
            </Text>
          </Pressable>
        )}
      </View>

      {syncing &&
        syncProgress.phase !== 'completed' && (
          <View style={styles.syncContainer}>
            <View style={styles.syncHeader}>
              <Text style={styles.syncTitle}>
                Synchronisation du Live TV
              </Text>

              <Text style={styles.syncPercent}>
                {syncProgress.total > 0
                  ? `${Math.round(
                      (syncProgress.current /
                        syncProgress.total) *
                        100,
                    )}%`
                  : '0%'}
              </Text>
            </View>

            <View style={styles.progressBackground}>
              <View
                style={[
                  styles.progressBar,
                  {
                    width:
                      syncProgress.total > 0
                        ? `${Math.min(
                            100,
                            (syncProgress.current /
                              syncProgress.total) *
                              100,
                          )}%`
                        : '0%',
                  },
                ]}
              />
            </View>

            <View style={styles.syncDetails}>
              <Text style={styles.syncCount}>
                {syncProgress.current.toLocaleString()} /{' '}
                {syncProgress.total.toLocaleString()} chaînes
              </Text>

              <Text style={styles.syncPhase}>
                {syncProgress.phase === 'categories'
                  ? 'Catégories'
                  : 'Chaînes'}
              </Text>
            </View>
          </View>
        )}

      <View style={styles.categorySection}>
        <FlatList
          data={categories}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.categoryList}
          renderItem={({ item }) => {
            const isActive =
              item.id === activeCategory;

            return (
              <Pressable
                onPress={() =>
                  handleCategoryPress(item.id)
                }
                style={[
                  styles.categoryItem,
                  isActive &&
                    styles.categoryItemActive,
                ]}
              >
                <Text
                  style={[
                    styles.categoryText,
                    isActive &&
                      styles.categoryTextActive,
                  ]}
                  numberOfLines={1}
                >
                  {item.name}
                </Text>
              </Pressable>
            );
          }}
        />
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator
            size="large"
            color="#E50914"
          />

          <Text style={styles.loadingTitle}>
            Chargement du Live TV
          </Text>
        </View>
      ) : channels.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>
            📺
          </Text>

          <Text style={styles.emptyTitle}>
            Aucune chaîne disponible
          </Text>

          {syncing && (
            <Text style={styles.emptyText}>
              Synchronisation des chaînes...
            </Text>
          )}
        </View>
      ) : (
        <FlatList
          data={channels}
          extraData={iconCacheVersion}
          keyExtractor={keyExtractor}
          renderItem={renderChannel}
          numColumns={3}
          contentContainerStyle={styles.channelsList}
          columnWrapperStyle={styles.columnWrapper}
          onEndReached={loadMoreChannels}
          onEndReachedThreshold={0.5}
          ListFooterComponent={renderFooter}
          initialNumToRender={20}
          maxToRenderPerBatch={20}
          windowSize={7}
          removeClippedSubviews={true}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

/* ============================================================
   STYLES
============================================================ */

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B0B0B',
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
  },

  backButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#1A1A1A',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },

  backButtonText: {
    color: '#FFFFFF',
    fontSize: 34,
    lineHeight: 38,
    marginTop: -4,
  },

  headerTitleContainer: {
    flex: 1,
  },

  title: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '700',
  },

  subtitle: {
    color: '#888888',
    fontSize: 13,
    marginTop: 2,
  },

  categorySection: {
    borderBottomWidth: 1,
    borderBottomColor: '#202020',
    marginBottom: 8,
  },

  categoryList: {
    paddingHorizontal: 12,
    paddingVertical: 10,
  },

  categoryItem: {
    backgroundColor: '#181818',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 9,
    marginHorizontal: 4,
    maxWidth: 180,
  },

  categoryItemActive: {
    backgroundColor: '#E50914',
  },

  categoryText: {
    color: '#BBBBBB',
    fontSize: 13,
    fontWeight: '600',
  },

  categoryTextActive: {
    color: '#FFFFFF',
  },

  channelsList: {
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 30,
  },

  columnWrapper: {
    justifyContent: 'space-between',
  },

  channelCard: {
    width: '31.5%',
    backgroundColor: '#151515',
    borderRadius: 10,
    marginBottom: 12,
    padding: 8,
    alignItems: 'center',
  },

  channelCardPressed: {
    opacity: 0.7,
  },

  logoContainer: {
    width: '100%',
    height: 75,
    borderRadius: 7,
    backgroundColor: '#0F0F0F',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },

  channelLogo: {
    width: '90%',
    height: '90%',
  },

  defaultLogo: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#222222',
    alignItems: 'center',
    justifyContent: 'center',
  },

  defaultLogoText: {
    color: '#777777',
    fontSize: 14,
    fontWeight: '700',
  },

  channelName: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 8,
    minHeight: 30,
  },

  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  loadingTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    marginTop: 18,
  },

  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 30,
  },

  emptyIcon: {
    fontSize: 42,
    marginBottom: 12,
  },

  emptyTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },

  emptyText: {
    color: '#777777',
    fontSize: 13,
    marginTop: 8,
  },

  loadingMore: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
  },

  loadingMoreText: {
    color: '#777777',
    fontSize: 12,
    marginLeft: 8,
  },

  syncContainer: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#111111',
    borderBottomWidth: 1,
    borderBottomColor: '#202020',
  },

  syncHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 7,
  },

  syncTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },

  syncPercent: {
    color: '#E50914',
    fontSize: 13,
    fontWeight: '700',
  },

  progressBackground: {
    height: 6,
    width: '100%',
    backgroundColor: '#292929',
    borderRadius: 3,
    overflow: 'hidden',
  },

  progressBar: {
    height: '100%',
    backgroundColor: '#E50914',
    borderRadius: 3,
  },

  syncDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
  },

  syncCount: {
    color: '#888888',
    fontSize: 11,
  },

  syncPhase: {
    color: '#666666',
    fontSize: 11,
  },

  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 8,
    paddingHorizontal: 12,
    height: 46,
    backgroundColor: '#181818',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#252525',
  },

  searchInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 14,
    paddingVertical: 0,
  },

  clearSearch: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },

  clearSearchText: {
    color: '#888888',
    fontSize: 25,
    lineHeight: 28,
  },
});