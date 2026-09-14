import React, {
  useCallback,
  useEffect,
  useState,
} from 'react';

import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { router } from 'expo-router';

import {
  getSeriesCategoriesFromDatabase,
  getSeriesFromDatabase,
  getSeriesCountFromDatabase,
  searchSeriesFromDatabase,
  getSearchSeriesCountFromDatabase,
  syncSeriesTV,
  Series,
  SeriesCategory,
} from '../database/seriesRepository';

const PAGE_SIZE = 100;

export default function SeriesScreen() {
  const [categories, setCategories] =
    useState<SeriesCategory[]>([]);

  const [activeCategory, setActiveCategory] =
    useState<string>('all');

  const [series, setSeries] =
    useState<Series[]>([]);

  const [search, setSearch] =
    useState('');

  const [loading, setLoading] =
    useState(true);

  const [syncing, setSyncing] =
    useState(false);

  const [total, setTotal] =
    useState(0);

  const [offset, setOffset] =
    useState(0);

  const loadCategories = useCallback(async () => {
    const result =
      await getSeriesCategoriesFromDatabase();

    setCategories(result);
  }, []);

  const loadSeries = useCallback(
    async (
      categoryId: string,
      reset = true
    ) => {
      const currentOffset = reset ? 0 : offset;

      const [result, count] =
        await Promise.all([
          getSeriesFromDatabase(
            categoryId,
            PAGE_SIZE,
            currentOffset
          ),
          getSeriesCountFromDatabase(
            categoryId
          ),
        ]);

      if (reset) {
        setSeries(result);
        setOffset(PAGE_SIZE);
      } else {
        setSeries(previous => [
          ...previous,
          ...result.filter(
            item =>
              !previous.some(
                existing =>
                  existing.series_id ===
                  item.series_id
              )
          ),
        ]);

        setOffset(
          currentOffset + PAGE_SIZE
        );
      }

      setTotal(count);
    },
    [offset]
  );

  const searchSeries = useCallback(
    async (text: string) => {
      const term = text.trim();

      if (!term) {
        await loadSeries(
          activeCategory,
          true
        );
        return;
      }

      const [result, count] =
        await Promise.all([
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

      setSeries(result);
      setTotal(count);
      setOffset(PAGE_SIZE);
    },
    [activeCategory, loadSeries]
  );

  const initialize = useCallback(
      async () => {
        try {
          console.log('SERIES : début initialize');

          console.log('SERIES : chargement catégories...');
          await loadCategories();
          console.log('SERIES : catégories chargées');

          console.log('SERIES : chargement séries...');
          const initialSeries = await getSeriesFromDatabase(
            'all',
            PAGE_SIZE,
            0
          );

          console.log(
            'SERIES : séries chargées :',
            initialSeries.length
          );

          console.log('SERIES : comptage séries...');
          const total = await getSeriesCountFromDatabase('all');

          console.log(
            'SERIES : nombre total :',
            total
          );

          setSeries(initialSeries);
          
        } catch (error) {
          console.error(
            'ERREUR INITIALISATION SERIES :',
            error
          );
        }
      },
      [loadCategories]
    );

  useEffect(() => {
    initialize();
  }, [initialize]);

  const handleSearch = useCallback(
    (text: string) => {
      setSearch(text);

      void searchSeries(text);
    },
    [searchSeries]
  );

  const handleCategory = useCallback(
    async (categoryId: string) => {
      setActiveCategory(categoryId);
      setSearch('');

      const [result, count] =
        await Promise.all([
          getSeriesFromDatabase(
            categoryId,
            PAGE_SIZE,
            0
          ),
          getSeriesCountFromDatabase(
            categoryId
          ),
        ]);

      setSeries(result);
      setTotal(count);
      setOffset(PAGE_SIZE);
    },
    []
  );

  const handleSync = useCallback(
    async () => {
      if (syncing) {
        return;
      }

      try {
        setSyncing(true);

        await syncSeriesTV();

        await loadCategories();

        const [result, count] =
          await Promise.all([
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
      } finally {
        setSyncing(false);
      }
    },
    [
      syncing,
      activeCategory,
      loadCategories,
    ]
  );

  const loadMore = useCallback(async () => {
    if (
      loading ||
      syncing ||
      series.length >= total
    ) {
      return;
    }

    const result = search.trim()
      ? await searchSeriesFromDatabase(
          search,
          activeCategory,
          PAGE_SIZE,
          offset
        )
      : await getSeriesFromDatabase(
          activeCategory,
          PAGE_SIZE,
          offset
        );

    if (result.length === 0) {
      return;
    }

    setSeries(previous => [
      ...previous,
      ...result.filter(
        item =>
          !previous.some(
            existing =>
              existing.series_id ===
              item.series_id
          )
      ),
    ]);

    setOffset(
      previous => previous + PAGE_SIZE
    );
  }, [
    loading,
    syncing,
    series.length,
    total,
    search,
    activeCategory,
    offset,
  ]);

  const renderSeries = ({
    item,
  }: {
    item: Series;
  }) => {
    const image =
      item.backdrop_path
        ? (() => {
            try {
              const paths =
                JSON.parse(
                  item.backdrop_path
                );

              if (
                Array.isArray(paths) &&
                paths.length > 0
              ) {
                return paths[0];
              }
            } catch {
              return null;
            }

            return null;
          })()
        : null;

    return (
      <Pressable
        style={styles.card}
        onPress={() =>
          router.push({
          pathname: '/series/[id]',
          params: {
            id: String(item.series_id),
          },
        })
        }
      >
        {image ? (
          <Image
            source={{ uri: image }}
            style={styles.poster}
          />
        ) : (
          <View
            style={[
              styles.poster,
              styles.posterPlaceholder,
            ]}
          >
            <Text style={styles.placeholderText}>
              SERIES
            </Text>
          </View>
        )}

        <Text
          style={styles.title}
          numberOfLines={2}
        >
          {item.name}
        </Text>

        {item.rating ? (
          <Text style={styles.rating}>
            ★ {item.rating}
          </Text>
        ) : null}
      </Pressable>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <ActivityIndicator size="large" />
          <Text style={styles.loadingText}>
            Chargement des séries...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
        >
          <Text style={styles.back}>
            ‹ Retour
          </Text>
        </Pressable>

        <Text style={styles.headerTitle}>
          Séries
        </Text>

        <Pressable
          onPress={() => void handleSync()}
          disabled={syncing}
        >
          <Text style={styles.sync}>
            {syncing
              ? '...'
              : 'Synchroniser'}
          </Text>
        </Pressable>
      </View>

      <TextInput
        value={search}
        onChangeText={handleSearch}
        placeholder="Rechercher une série..."
        placeholderTextColor="#888"
        style={styles.search}
      />

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
        keyExtractor={item =>
          item.category_id
        }
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={
          styles.categories
        }
        renderItem={({ item }) => (
          <Pressable
            style={[
              styles.category,
              activeCategory ===
                item.category_id &&
                styles.categoryActive,
            ]}
            onPress={() =>
              void handleCategory(
                item.category_id
              )
            }
          >
            <Text
              style={[
                styles.categoryText,
                activeCategory ===
                  item.category_id &&
                  styles.categoryTextActive,
              ]}
              numberOfLines={1}
            >
              {item.category_name}
            </Text>
          </Pressable>
        )}
      />

      <View style={styles.counter}>
        <Text style={styles.counterText}>
          {series.length} / {total} séries
        </Text>
      </View>

      <FlatList
        data={series}
        keyExtractor={item =>
          String(item.series_id)
        }
        numColumns={3}
        renderItem={renderSeries}
        contentContainerStyle={
          styles.grid
        }
        columnWrapperStyle={
          styles.row
        }
        onEndReached={() =>
          void loadMore()
        }
        onEndReachedThreshold={0.5}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>
              Aucune série trouvée.
            </Text>
          </View>
        }
        ListFooterComponent={
          series.length > 0 &&
          series.length < total ? (
            <ActivityIndicator
              style={styles.footer}
            />
          ) : null
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0b0b0b',
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },

  back: {
    color: '#ffffff',
    fontSize: 16,
  },

  headerTitle: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '700',
  },

  sync: {
    color: '#4da6ff',
    fontSize: 14,
    fontWeight: '600',
  },

  search: {
    marginHorizontal: 16,
    marginBottom: 10,
    paddingHorizontal: 14,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#1a1a1a',
    color: '#ffffff',
    borderWidth: 1,
    borderColor: '#292929',
  },

  categories: {
    paddingHorizontal: 12,
    paddingBottom: 10,
  },

  category: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginHorizontal: 4,
    borderRadius: 18,
    backgroundColor: '#1b1b1b',
  },

  categoryActive: {
    backgroundColor: '#ffffff',
  },

  categoryText: {
    color: '#bbbbbb',
    fontSize: 13,
  },

  categoryTextActive: {
    color: '#000000',
    fontWeight: '700',
  },

  counter: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },

  counterText: {
    color: '#888888',
    fontSize: 12,
  },

  grid: {
    paddingHorizontal: 10,
    paddingBottom: 30,
  },

  row: {
    justifyContent: 'space-between',
  },

  card: {
    width: '31%',
    marginBottom: 18,
  },

  poster: {
    width: '100%',
    aspectRatio: 0.68,
    borderRadius: 8,
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

  title: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 6,
  },

  rating: {
    color: '#bbbbbb',
    fontSize: 11,
    marginTop: 3,
  },

  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  loadingText: {
    color: '#ffffff',
    marginTop: 12,
  },

  empty: {
    width: '100%',
    alignItems: 'center',
    paddingTop: 50,
  },

  emptyText: {
    color: '#888888',
    fontSize: 15,
  },

  footer: {
    marginVertical: 20,
  },
});