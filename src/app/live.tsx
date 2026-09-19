import React, {
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
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
import {
  getUserAccess,
  UserAccessError,
} from '../api/accessApi';

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

import {
  getLocalProtection,
  verifyLocalProtection,
} from '../storage/localProtectionStorage';

type Category = {
  id: string;
  name: string;
};

type LiveAccess = {
  tv_channels: number;
  adult: boolean;
};

type XtreamAccess = {
  server_url: string;
  username: string;
  password: string;
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
    void iconCacheVersion;

    const icon = getCachedLiveIcon(channel.stream_id);

    const [imageError, setImageError] =
      useState(false);

    useEffect(() => {
      setImageError(false);
    }, [icon]);

    const showDefaultLogo =
      !icon || imageError;

    return (
      <Pressable
        style={({ pressed }) => [
          styles.channelCard,
          pressed &&
            styles.channelCardPressed,
        ]}
        onPress={() => onPress(channel)}
      >
        <View
          style={styles.logoContainer}
        >
          {showDefaultLogo ? (
            <View
              style={styles.defaultLogo}
            >
              <Text
                style={
                  styles.defaultLogoText
                }
              >
                TV
              </Text>
            </View>
          ) : (
            <Image
              source={{ uri: icon }}
              style={styles.channelLogo}
              resizeMode="contain"
              onError={() => {
                setImageError(true);

                console.log(
                  'LOGO INDISPONIBLE :',
                  channel.name,
                );
              }}
            />
          )}
        </View>

        <Text
          style={styles.channelName}
          numberOfLines={2}
        >
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
  const [categories, setCategories] =
    useState<Category[]>([]);

  const [activeCategory, setActiveCategory] =
    useState('all');

  const [syncProgress, setSyncProgress] =
    useState<LiveSyncProgress>({
      phase: 'categories',
      current: 0,
      total: 0,
    });

  const [channels, setChannels] =
    useState<Channel[]>([]);

  const [totalChannels, setTotalChannels] =
    useState(0);

  const [loading, setLoading] =
    useState(true);

  const [loadingMore, setLoadingMore] =
    useState(false);

  const [syncing, setSyncing] =
    useState(false);

  const [iconCacheVersion, setIconCacheVersion] =
    useState(0);

  const [searchText, setSearchText] =
    useState('');

  const [searching, setSearching] =
    useState(false);

  /* ============================================================
     ACCÈS ABONNEMENT
  ============================================================ */

  const [access, setAccess] =
    useState<LiveAccess | null>(null);

  const [xtreamAccess, setXtreamAccess] =
    useState<XtreamAccess | null>(null);

  const [accessChecked, setAccessChecked] =
    useState(false);

  /* ============================================================
     PROTECTION CATÉGORIE ADULTE
  ============================================================ */

  const [
    adultPasswordModalVisible,
    setAdultPasswordModalVisible,
  ] = useState(false);

  const [adultPassword, setAdultPassword] =
    useState('');

  const [showAdultPassword, setShowAdultPassword] =
    useState(false);

  const [
    checkingAdultPassword,
    setCheckingAdultPassword,
  ] = useState(false);

  const [adultPasswordError, setAdultPasswordError] =
    useState('');

  const [
    pendingAdultCategory,
    setPendingAdultCategory,
  ] = useState<Category | null>(null);

  const searchRequestRef =
    useRef(0);

  const currentOffsetRef =
    useRef(0);

  const loadingMoreRef =
    useRef(false);

  const lastRequestedOffsetRef =
    useRef<number | null>(null);

  const mountedRef =
    useRef(true);

  const initialLoadDoneRef =
    useRef(false);

  const activeCategoryRef =
    useRef('all');

  const searchTextRef =
    useRef('');

  useEffect(() => {
    searchTextRef.current =
      searchText;
  }, [searchText]);

  /* ============================================================
     IDENTIFICATION DE LA CATÉGORIE ADULTE
  ============================================================ */

  const isAdultCategory =
    useCallback(
      (category: Category) => {
        const normalizedName =
          category.name
            .trim()
            .toLocaleLowerCase('fr-FR')
            .normalize('NFD')
            .replace(
              /[\u0300-\u036f]/g,
              '',
            );

        return (
          normalizedName === 'adult' ||
          normalizedName === 'adulte' ||
          normalizedName.includes('adult')
        );
      },
      [],
    );

  /* ============================================================
     VÉRIFICATION DE L'ACCÈS UTILISATEUR
  ============================================================ */

  const loadUserAccess =
    useCallback(async () => {
      try {
        console.log(
          'VÉRIFICATION ACCÈS LIVE TV...',
        );

        const result =
          await getUserAccess();

        if (!mountedRef.current) {
          return false;
        }

        if (
          !result.subscription ||
          !result.limits
        ) {
          console.log(
            'AUCUN ABONNEMENT ACTIF POUR LE LIVE TV',
          );

          setAccess(null);
          setXtreamAccess(null);
          setAccessChecked(true);

          return false;
        }

        const liveAccess: LiveAccess = {
          tv_channels:
            Math.max(
              0,
              Number(
                result.limits.tv_channels,
              ),
            ),

          adult:
            Boolean(
              result.limits.adult,
            ),
        };

        setAccess(liveAccess);

        setXtreamAccess(
          result.xtream
            ? {
                server_url:
                  result.xtream.server_url,
                username:
                  result.xtream.username,
                password:
                  result.xtream.password,
              }
            : null,
        );

        setAccessChecked(true);

        console.log(
          'ACCÈS LIVE TV AUTORISÉ :',
          liveAccess,
        );

        console.log(
          'ACCÈS ADULTE :',
          liveAccess.adult,
        );

        console.log(
          'LIMITE CHAÎNES LIVE :',
          liveAccess.tv_channels,
        );

        return true;
      } catch (error) {
        console.error(
          'ERREUR VÉRIFICATION ACCÈS LIVE TV :',
          error,
        );

        if (
          error instanceof UserAccessError &&
          (error.status === 401 ||
            error.status === 403)
        ) {
          router.replace('/login');

          return false;
        }

        if (mountedRef.current) {
          setAccessChecked(true);
        }

        return false;
      }
    }, []);

  /* ============================================================
     FILTRAGE DES CATÉGORIES
  ============================================================ */

  const filterCategories =
    useCallback(
      (
        rows: any[],
        allowAdult: boolean,
      ): Category[] => {
        const filteredRows =
          rows.filter(
            (category: any) => {
              const categoryObject: Category =
                {
                  id: String(
                    category.category_id,
                  ),
                  name:
                    category.category_name,
                };

              if (
                !allowAdult &&
                isAdultCategory(
                  categoryObject,
                )
              ) {
                console.log(
                  'CATÉGORIE ADULTE MASQUÉE :',
                  categoryObject.name,
                );

                return false;
              }

              return true;
            },
          );

        return [
          {
            id: 'all',
            name: 'Toutes',
          },
          ...filteredRows.map(
            (category: any) => ({
              id: String(
                category.category_id,
              ),
              name:
                category.category_name,
            }),
          ),
        ];
      },
      [isAdultCategory],
    );

  /* ============================================================
     LIMITATION DES CHAÎNES SELON L'ABONNEMENT
  ============================================================ */

  const applyChannelLimit =
    useCallback(
      (
        rows: Channel[],
        offset: number,
      ): Channel[] => {
        const limit =
          access?.tv_channels ?? 0;

        if (limit <= 0) {
          return [];
        }

        if (offset >= limit) {
          return [];
        }

        const remaining =
          limit - offset;

        return rows.slice(
          0,
          Math.min(
            rows.length,
            remaining,
          ),
        );
      },
      [access],
    );

  /* ============================================================
     LECTURE DES CATÉGORIES DEPUIS SQLITE
  ============================================================ */

  const loadCategories =
    useCallback(async () => {
      try {
        const rows =
          await getLiveCategoriesFromDatabase();

        if (!mountedRef.current) {
          return;
        }

        const formattedCategories =
          filterCategories(
            rows,
            access?.adult ?? false,
          );

        setCategories(
          formattedCategories,
        );

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
    }, [
      access?.adult,
      filterCategories,
    ]);

  /* ============================================================
     LECTURE DES CHAÎNES DEPUIS SQLITE
  ============================================================ */

  const loadChannels =
    useCallback(
      async (categoryId: string) => {
        try {
          const category =
            categories.find(
              item =>
                item.id === categoryId,
            );

          if (
            category &&
            !access?.adult &&
            isAdultCategory(category)
          ) {
            console.log(
              'ACCÈS CATÉGORIE ADULTE REFUSÉ :',
              category.name,
            );

            return;
          }

          const dbCategoryId =
            categoryId === 'all'
              ? undefined
              : categoryId;

          const [
            rows,
            count,
          ] = await Promise.all([
            getLiveChannelsFromDatabase(
              dbCategoryId,
              PAGE_SIZE,
              0,
            ),
            getLiveChannelsCount(
              dbCategoryId,
            ),
          ]);

          if (!mountedRef.current) {
            return;
          }

          const limitedRows =
            applyChannelLimit(
              rows,
              0,
            );

          const limitedCount =
            Math.min(
              count,
              access?.tv_channels ?? 0,
            );

          setChannels(
            limitedRows,
          );

          setTotalChannels(
            limitedCount,
          );

          currentOffsetRef.current =
            limitedRows.length;

          lastRequestedOffsetRef.current =
            null;

          console.log(
            'CHAÎNES LIVE LUES DEPUIS SQLITE :',
            limitedRows.length,
            '| OFFSET : 0 | LIMIT :',
            PAGE_SIZE,
            '| LIMITE ABONNEMENT :',
            access?.tv_channels ?? 0,
            '| CATÉGORIE :',
            categoryId,
          );
        } catch (error) {
          console.error(
            'ERREUR LECTURE CHAÎNES LIVE SQLITE :',
            error,
          );
        }
      },
      [
        access?.tv_channels,
        access?.adult,
        applyChannelLimit,
        categories,
        isAdultCategory,
      ],
    );

  /* ============================================================
     RECHERCHE DANS SQLITE
  ============================================================ */

  const searchChannels =
    useCallback(
      async (
        text: string,
        categoryId: string,
      ) => {
        const requestId =
          ++searchRequestRef.current;

        const search =
          text.trim();

        const category =
          categories.find(
            item =>
              item.id === categoryId,
          );

        if (
          category &&
          !access?.adult &&
          isAdultCategory(category)
        ) {
          console.log(
            'RECHERCHE ADULTE BLOQUÉE :',
            category.name,
          );

          if (
            mountedRef.current &&
            requestId ===
              searchRequestRef.current
          ) {
            setChannels([]);
            setTotalChannels(0);
            setSearching(false);
          }

          return;
        }

        if (!search) {
          await loadChannels(
            categoryId,
          );

          if (
            mountedRef.current &&
            requestId ===
              searchRequestRef.current
          ) {
            setSearching(false);
          }

          return;
        }

        setSearching(true);

        try {
          const dbCategoryId =
            categoryId === 'all'
              ? undefined
              : categoryId;

          const [
            rows,
            count,
          ] = await Promise.all([
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
            requestId !==
              searchRequestRef.current
          ) {
            return;
          }

          const limitedRows =
            applyChannelLimit(
              rows,
              0,
            );

          const limitedCount =
            Math.min(
              count,
              access?.tv_channels ?? 0,
            );

          setChannels(
            limitedRows,
          );

          setTotalChannels(
            limitedCount,
          );

          currentOffsetRef.current =
            limitedRows.length;

          lastRequestedOffsetRef.current =
            null;

          console.log(
            'RECHERCHE LIVE SQLITE :',
            search,
            '| RÉSULTATS :',
            limitedCount,
            '| LIMITE ABONNEMENT :',
            access?.tv_channels ?? 0,
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
            requestId ===
              searchRequestRef.current
          ) {
            setSearching(false);
          }
        }
      },
      [
        access?.adult,
        access?.tv_channels,
        applyChannelLimit,
        categories,
        isAdultCategory,
        loadChannels,
      ],
    );

  /* ============================================================
     PAGINATION
  ============================================================ */

  const loadMoreChannels =
    useCallback(async () => {
      if (loadingMoreRef.current) {
        return;
      }

      if (
        channels.length >=
        totalChannels
      ) {
        return;
      }

      const accessLimit =
        access?.tv_channels ?? 0;

      if (
        currentOffsetRef.current >=
        accessLimit
      ) {
        return;
      }

      const category =
        categories.find(
          item =>
            item.id === activeCategory,
        );

      if (
        category &&
        !access?.adult &&
        isAdultCategory(category)
      ) {
        console.log(
          'PAGINATION ADULTE BLOQUÉE :',
          category.name,
        );

        return;
      }

      const offset =
        currentOffsetRef.current;

      if (
        lastRequestedOffsetRef.current ===
        offset
      ) {
        return;
      }

      loadingMoreRef.current =
        true;

      lastRequestedOffsetRef.current =
        offset;

      setLoadingMore(true);

      try {
        const dbCategoryId =
          activeCategory === 'all'
            ? undefined
            : activeCategory;

        const search =
          searchText.trim();

        const remaining =
          Math.min(
            PAGE_SIZE,
            accessLimit - offset,
          );

        if (remaining <= 0) {
          return;
        }

        const nextChannels =
          search
            ? await searchLiveChannelsFromDatabase(
                search,
                dbCategoryId,
                remaining,
                offset,
              )
            : await getLiveChannelsFromDatabase(
                dbCategoryId,
                remaining,
                offset,
              );

        if (!mountedRef.current) {
          return;
        }

        const limitedNextChannels =
          applyChannelLimit(
            nextChannels,
            offset,
          );

        if (
          limitedNextChannels.length > 0
        ) {
          setChannels(previous => {
            const existingIds =
              new Set(
                previous.map(
                  channel =>
                    channel.stream_id,
                ),
              );

            const uniqueChannels =
              limitedNextChannels.filter(
                channel =>
                  !existingIds.has(
                    channel.stream_id,
                  ),
              );

            return [
              ...previous,
              ...uniqueChannels,
            ];
          });

          currentOffsetRef.current +=
            limitedNextChannels.length;

          console.log(
            'CHAÎNES LIVE AJOUTÉES :',
            limitedNextChannels.length,
            '| OFFSET :',
            offset,
            '| LIMITE :',
            accessLimit,
          );
        }
      } catch (error) {
        console.error(
          'ERREUR PAGINATION CHAÎNES LIVE :',
          error,
        );

        lastRequestedOffsetRef.current =
          null;
      } finally {
        if (mountedRef.current) {
          loadingMoreRef.current =
            false;

          setLoadingMore(false);
        }
      }
    }, [
      access?.adult,
      access?.tv_channels,
      activeCategory,
      applyChannelLimit,
      categories,
      channels.length,
      isAdultCategory,
      searchText,
      totalChannels,
    ]);

  /* ============================================================
     INITIALISATION

     1. Vérification abonnement
     2. Affichage immédiat de SQLite
     3. Comparaison serveur / SQLite
     4. Synchronisation uniquement si nécessaire
  ============================================================ */

  useEffect(() => {
    mountedRef.current = true;

    const initialize =
      async () => {
        try {
          /* ----------------------------------------------------
             VÉRIFICATION ACCÈS UTILISATEUR
          ---------------------------------------------------- */

          const hasAccess =
            await loadUserAccess();

          if (
            !mountedRef.current
          ) {
            return;
          }

          if (!hasAccess) {
            setLoading(false);

            return;
          }

          /* ----------------------------------------------------
             VÉRIFICATION LIMITE LIVE
          ---------------------------------------------------- */

          if (
            (access?.tv_channels ?? 0) <=
            0
          ) {
            console.log(
              'AUCUNE CHAÎNE AUTORISÉE PAR L’ABONNEMENT',
            );

            setCategories([
              {
                id: 'all',
                name: 'Toutes',
              },
            ]);

            setChannels([]);
            setTotalChannels(0);
            setLoading(false);

            return;
          }

          /* ----------------------------------------------------
             AFFICHAGE IMMÉDIAT DE SQLITE
          ---------------------------------------------------- */

          const dbCategories =
            await getLiveCategoriesFromDatabase();

          const [
            dbChannels,
            dbCount,
          ] = await Promise.all([
            getLiveChannelsFromDatabase(
              undefined,
              PAGE_SIZE,
              0,
            ),
            getLiveChannelsCount(
              undefined,
            ),
          ]);

          if (
            !mountedRef.current
          ) {
            return;
          }

          const formattedCategories =
            filterCategories(
              dbCategories,
              access?.adult ?? false,
            );

          const limitedDbChannels =
            applyChannelLimit(
              dbChannels,
              0,
            );

          const limitedDbCount =
            Math.min(
              dbCount,
              access?.tv_channels ?? 0,
            );

          setCategories(
            formattedCategories,
          );

          setChannels(
            limitedDbChannels,
          );

          setTotalChannels(
            limitedDbCount,
          );

          currentOffsetRef.current =
            limitedDbChannels.length;

          initialLoadDoneRef.current =
            true;

          console.log(
            '================================',
          );

          console.log(
            'AFFICHAGE SQLITE IMMÉDIAT',
          );

          console.log(
            'CATÉGORIES :',
            formattedCategories.length,
          );

          console.log(
            'CHAÎNES :',
            limitedDbChannels.length,
          );

          console.log(
            'LIMITE ABONNEMENT :',
            access?.tv_channels ?? 0,
          );

          console.log(
            'ACCÈS ADULTE :',
            access?.adult ?? false,
          );

          console.log(
            '================================',
          );

          setLoading(false);

          /* ----------------------------------------------------
             VÉRIFICATION SERVEUR / SQLITE
          ---------------------------------------------------- */

          const result =
            await syncLiveTVIfNeeded(
              progress => {
                if (
                  !mountedRef.current
                ) {
                  return;
                }

                setSyncing(true);

                setSyncProgress(
                  progress,
                );
              },
            );

          if (
            !mountedRef.current
          ) {
            return;
          }

          console.log(
            'VÉRIFICATION LIVE TERMINÉE :',
            result,
          );

          /* ----------------------------------------------------
             UNE SYNCHRONISATION A EU LIEU
          ---------------------------------------------------- */

          if (
            result.synchronized
          ) {
            await loadCategories();

            if (
              !mountedRef.current
            ) {
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
            /* --------------------------------------------------
               AUCUNE SYNCHRONISATION

               Les logos ont été mis à jour
               dans le cache.
            -------------------------------------------------- */

            console.log(
              'LIVE TV DÉJÀ À JOUR — AUCUN UPSERT',
            );

            setIconCacheVersion(
              version =>
                version + 1,
            );
          }

          if (
            mountedRef.current
          ) {
            setSyncing(false);
          }
        } catch (error) {
          console.error(
            'ERREUR INITIALISATION LIVE TV :',
            error,
          );

          if (
            !mountedRef.current
          ) {
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
    access?.adult,
    access?.tv_channels,
    applyChannelLimit,
    filterCategories,
    loadCategories,
    loadChannels,
    loadUserAccess,
    searchChannels,
  ]);

  /* ============================================================
     EFFET DE RECHERCHE AVEC DÉLAI DE 300 MS
  ============================================================ */

  useEffect(() => {
    if (
      !initialLoadDoneRef.current
    ) {
      return;
    }

    const timer =
      setTimeout(() => {
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
     OUVERTURE DE LA CATÉGORIE ADULTE
  ============================================================ */

  const requestAdultCategoryAccess =
    useCallback(
      async (
        category: Category,
      ) => {
        console.log(
          '🔐 CLIC CATÉGORIE ADULTE :',
          category.name,
        );

        /*
         * IMPORTANT :
         * Si l'abonnement n'autorise pas
         * l'adulte, la catégorie est totalement
         * inaccessible.
         */

        if (!access?.adult) {
          console.log(
            '🔒 ACCÈS ADULTE REFUSÉ PAR L’ABONNEMENT',
          );

          return;
        }

        try {
          const protection =
            await getLocalProtection();

          /* --------------------------------------------------
             AUCUNE PROTECTION CONFIGURÉE
          -------------------------------------------------- */

          if (!protection) {
            Alert.alert(
              'Catégorie protégée',
              'La catégorie Adulte nécessite un mot de passe local. Configure d’abord une protection dans Paramètres → Sécurité.',
              [
                {
                  text: 'Annuler',
                  style: 'cancel',
                },
                {
                  text: 'Configurer maintenant',
                  onPress: () => {
                    router.push(
                      '/security',
                    );
                  },
                },
              ],
            );

            return;
          }

          /* --------------------------------------------------
             PROTECTION CONFIGURÉE

             On ouvre la fenêtre de mot de passe.
          -------------------------------------------------- */

          setPendingAdultCategory(
            category,
          );

          setAdultPassword('');

          setAdultPasswordError('');

          setShowAdultPassword(false);

          setAdultPasswordModalVisible(
            true,
          );
        } catch (error) {
          console.error(
            'ERREUR VÉRIFICATION PROTECTION ADULTE :',
            error,
          );

          Alert.alert(
            'Erreur',
            'Impossible de vérifier la protection de la catégorie Adulte.',
          );
        }
      },
      [access?.adult],
    );

  /* ============================================================
     VALIDATION DU MOT DE PASSE ADULTE
  ============================================================ */

  const handleAdultPasswordSubmit =
    useCallback(async () => {
      if (
        checkingAdultPassword
      ) {
        return;
      }

      /*
       * Double sécurité :
       * même si la modale était déjà ouverte,
       * on revalide le droit adulte.
       */

      if (!access?.adult) {
        setAdultPasswordModalVisible(
          false,
        );

        setAdultPassword('');

        setPendingAdultCategory(
          null,
        );

        console.log(
          '🔒 VALIDATION ADULTE REFUSÉE : ABONNEMENT SANS ACCÈS ADULTE',
        );

        return;
      }

      if (!adultPassword) {
        setAdultPasswordError(
          'Entre ton mot de passe.',
        );

        return;
      }

      try {
        setCheckingAdultPassword(
          true,
        );

        const valid =
          await verifyLocalProtection(
            adultPassword,
          );

        if (!valid) {
          setAdultPasswordError(
            'Mot de passe incorrect.',
          );

          setAdultPassword('');

          return;
        }

        /* --------------------------------------------------
           MOT DE PASSE CORRECT
        -------------------------------------------------- */

        const category =
          pendingAdultCategory;

        setAdultPassword('');

        setAdultPasswordError('');

        setAdultPasswordModalVisible(
          false,
        );

        setPendingAdultCategory(
          null,
        );

        if (!category) {
          return;
        }

        activeCategoryRef.current =
          category.id;

        setActiveCategory(
          category.id,
        );

        console.log(
          'ACCÈS CATÉGORIE ADULTE AUTORISÉ',
        );
      } catch (error) {
        console.error(
          'ERREUR VÉRIFICATION MOT DE PASSE ADULTE :',
          error,
        );

        setAdultPasswordError(
          'Impossible de vérifier le mot de passe.',
        );
      } finally {
        setCheckingAdultPassword(
          false,
        );
      }
    }, [
      access?.adult,
      adultPassword,
      checkingAdultPassword,
      pendingAdultCategory,
    ]);

  /* ============================================================
     FERMETURE DE LA FENÊTRE ADULTE
  ============================================================ */

  const closeAdultPasswordModal =
    useCallback(() => {
      if (
        checkingAdultPassword
      ) {
        return;
      }

      setAdultPasswordModalVisible(
        false,
      );

      setAdultPassword('');

      setAdultPasswordError('');

      setPendingAdultCategory(
        null,
      );
    }, [checkingAdultPassword]);

  /* ============================================================
     CHANGEMENT DE CATÉGORIE
  ============================================================ */

  const handleCategoryPress =
    useCallback(
      (categoryId: string) => {
        if (
          categoryId ===
          activeCategory
        ) {
          return;
        }

        const category =
          categories.find(
            item =>
              item.id ===
              categoryId,
          );

        if (!category) {
          return;
        }

        /* --------------------------------------------------
           CATÉGORIE ADULTE
        -------------------------------------------------- */

        if (
          isAdultCategory(category)
        ) {
          /*
           * Si adult === false :
           * la catégorie ne devrait même pas
           * être présente, mais cette vérification
           * empêche également un accès forcé.
           */

          if (!access?.adult) {
            console.log(
              '🔒 CATÉGORIE ADULTE BLOQUÉE : ABONNEMENT SANS ACCÈS',
            );

            return;
          }

          requestAdultCategoryAccess(
            category,
          );

          return;
        }

        /* --------------------------------------------------
           CATÉGORIE NORMALE
        -------------------------------------------------- */

        activeCategoryRef.current =
          categoryId;

        setActiveCategory(
          categoryId,
        );
      },
      [
        access?.adult,
        activeCategory,
        categories,
        isAdultCategory,
        requestAdultCategoryAccess,
      ],
    );

  /* ============================================================
     OUVERTURE DU LECTEUR
  ============================================================ */

  const handleChannelPress =
    useCallback(
      (channel: Channel) => {
        /*
         * Sans configuration Xtream provenant
         * du serveur, on ne tente pas de lancer
         * le flux.
         */

        if (!xtreamAccess) {
          console.error(
            'CONFIGURATION XTREAM UTILISATEUR INDISPONIBLE',
          );

          Alert.alert(
            'Lecture impossible',
            'La configuration du serveur de streaming est indisponible.',
          );

          return;
        }

        setZappingChannels(
          channels,
          channel.stream_id,
        );

        const client =
          new XtreamClient({
            server:
              xtreamAccess.server_url,
            username:
              xtreamAccess.username,
            password:
              xtreamAccess.password,
          });

        const url =
          client.getLiveStreamUrl(
            channel.stream_id,
          );

        router.push({
          pathname: '/player',
          params: {
            url:
              channel.direct_source ||
              url,

            title:
              channel.name,

            icon:
              getCachedLiveIcon(
                channel.stream_id,
              ) || '',

            streamId:
              String(
                channel.stream_id,
              ),
          },
        });
      },
      [
        channels,
        xtreamAccess,
      ],
    );

  /* ============================================================
     RENDU DES CHAÎNES
  ============================================================ */

  const renderChannel =
    useCallback(
      ({
        item,
      }: {
        item: Channel;
      }) => (
        <ChannelCard
          channel={item}
          onPress={
            handleChannelPress
          }
          iconCacheVersion={
            iconCacheVersion
          }
        />
      ),
      [
        handleChannelPress,
        iconCacheVersion,
      ],
    );

  const keyExtractor =
    useCallback(
      (item: Channel) =>
        String(
          item.stream_id,
        ),
      [],
    );

  const renderFooter =
    useCallback(() => {
      if (!loadingMore) {
        return null;
      }

      return (
        <View
          style={
            styles.loadingMore
          }
        >
          <ActivityIndicator
            size="small"
            color="#E50914"
          />

          <Text
            style={
              styles.loadingMoreText
            }
          >
            Chargement...
          </Text>
        </View>
      );
    }, [loadingMore]);

  /* ============================================================
     AFFICHAGE
  ============================================================ */

  if (
    !accessChecked ||
    loading
  ) {
    return (
      <View
        style={styles.container}
      >
        <View
          style={
            styles.loadingContainer
          }
        >
          <ActivityIndicator
            size="large"
            color="#E50914"
          />

          <Text
            style={
              styles.loadingTitle
            }
          >
            Vérification de votre accès...
          </Text>
        </View>
      </View>
    );
  }

  if (!access) {
    return (
      <View
        style={styles.container}
      >
        <View
          style={
            styles.emptyContainer
          }
        >
          <Text
            style={styles.emptyIcon}
          >
            🔒
          </Text>

          <Text
            style={
              styles.emptyTitle
            }
          >
            Abonnement requis
          </Text>

          <Text
            style={styles.emptyText}
          >
            Aucun abonnement actif ne
            permet actuellement d'accéder
            au Live TV.
          </Text>

          <Pressable
            style={
              styles.subscriptionButton
            }
            onPress={() =>
              router.push(
                '/subscription',
              )
            }
          >
            <Text
              style={
                styles.subscriptionButtonText
              }
            >
              Voir les abonnements
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View
      style={styles.container}
    >
      <View
        style={styles.header}
      >
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
            ‹
          </Text>
        </Pressable>

        <View
          style={
            styles.headerTitleContainer
          }
        >
          <Text
            style={styles.title}
          >
            Live TV
          </Text>

          <Text
            style={
              styles.subtitle
            }
          >
            {totalChannels.toLocaleString(
              'fr-FR',
            )}{' '}
            chaînes
          </Text>
        </View>
      </View>

      <View
        style={
          styles.searchContainer
        }
      >
        <TextInput
          value={searchText}
          onChangeText={
            setSearchText
          }
          placeholder="Rechercher une chaîne..."
          placeholderTextColor="#666666"
          style={
            styles.searchInput
          }
          autoCorrect={false}
          autoCapitalize="none"
        />

        {searching && (
          <ActivityIndicator
            size="small"
            color="#E50914"
          />
        )}

        {searchText.length >
          0 &&
          !searching && (
            <Pressable
              onPress={() => {
                searchRequestRef.current++;

                setSearchText('');
              }}
              style={
                styles.clearSearch
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
          )}
      </View>

      {syncing &&
        syncProgress.phase !==
          'completed' && (
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
                Synchronisation du Live TV
              </Text>

              <Text
                style={
                  styles.syncPercent
                }
              >
                {syncProgress.total >
                0
                  ? `${Math.round(
                      (syncProgress.current /
                        syncProgress.total) *
                        100,
                    )}%`
                  : '0%'}
              </Text>
            </View>

            <View
              style={
                styles.progressBackground
              }
            >
              <View
                style={[
                  styles.progressBar,
                  {
                    width:
                      syncProgress.total >
                      0
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

            <View
              style={
                styles.syncDetails
              }
            >
              <Text
                style={
                  styles.syncCount
                }
              >
                {syncProgress.current.toLocaleString(
                  'fr-FR',
                )}{' '}
                /{' '}
                {syncProgress.total.toLocaleString(
                  'fr-FR',
                )}{' '}
                chaînes
              </Text>

              <Text
                style={
                  styles.syncPhase
                }
              >
                {syncProgress.phase ===
                'categories'
                  ? 'Catégories'
                  : 'Chaînes'}
              </Text>
            </View>
          </View>
        )}

      <View
        style={
          styles.categorySection
        }
      >
        <FlatList
          data={categories}
          horizontal
          showsHorizontalScrollIndicator={
            false
          }
          keyExtractor={item =>
            item.id
          }
          contentContainerStyle={
            styles.categoryList
          }
          renderItem={({
            item,
          }) => {
            const isActive =
              item.id ===
              activeCategory;

            return (
              <Pressable
                onPress={() =>
                  handleCategoryPress(
                    item.id,
                  )
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

      {channels.length ===
      0 ? (
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
            Aucune chaîne disponible
          </Text>

          {syncing && (
            <Text
              style={
                styles.emptyText
              }
            >
              Synchronisation des
              chaînes...
            </Text>
          )}
        </View>
      ) : (
        <FlatList
          data={channels}
          extraData={
            iconCacheVersion
          }
          keyExtractor={
            keyExtractor
          }
          renderItem={
            renderChannel
          }
          numColumns={3}
          contentContainerStyle={
            styles.channelsList
          }
          columnWrapperStyle={
            styles.columnWrapper
          }
          onEndReached={
            loadMoreChannels
          }
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            renderFooter
          }
          initialNumToRender={20}
          maxToRenderPerBatch={20}
          windowSize={7}
          removeClippedSubviews={
            true
          }
          showsVerticalScrollIndicator={
            false
          }
        />
      )}

      {/* ========================================================
         MODALE MOT DE PASSE ADULTE
      ======================================================== */}

      <Modal
        visible={
          adultPasswordModalVisible
        }
        transparent
        animationType="fade"
        onRequestClose={
          closeAdultPasswordModal
        }
      >
        <View
          style={
            styles.modalOverlay
          }
        >
          <View
            style={
              styles.passwordModal
            }
          >
            <View
              style={
                styles.passwordModalIcon
              }
            >
              <Text
                style={
                  styles.passwordModalIconText
                }
              >
                🔒
              </Text>
            </View>

            <Text
              style={
                styles.passwordModalTitle
              }
            >
              Contenu protégé
            </Text>

            <Text
              style={
                styles.passwordModalDescription
              }
            >
              La catégorie Adulte est
              protégée. Entre ton mot de
              passe pour continuer.
            </Text>

            <View
              style={
                styles.passwordModalInputContainer
              }
            >
              <TextInput
                value={
                  adultPassword
                }
                onChangeText={
                  value => {
                    setAdultPassword(
                      value,
                    );

                    if (
                      adultPasswordError
                    ) {
                      setAdultPasswordError(
                        '',
                      );
                    }
                  }
                }
                placeholder="Mot de passe"
                placeholderTextColor="#555555"
                secureTextEntry={
                  !showAdultPassword
                }
                style={
                  styles.passwordModalInput
                }
                autoCapitalize="none"
                autoCorrect={false}
                editable={
                  !checkingAdultPassword
                }
                autoFocus
                onSubmitEditing={
                  handleAdultPasswordSubmit
                }
              />

              <Pressable
                style={
                  styles.passwordEyeButton
                }
                onPress={() =>
                  setShowAdultPassword(
                    value =>
                      !value,
                  )
                }
                disabled={
                  checkingAdultPassword
                }
              >
                <Text
                  style={
                    styles.passwordEyeText
                  }
                >
                  {showAdultPassword
                    ? '🙈'
                    : '👁️'}
                </Text>
              </Pressable>
            </View>

            {adultPasswordError ? (
              <Text
                style={
                  styles.passwordError
                }
              >
                {adultPasswordError}
              </Text>
            ) : null}

            <Pressable
              style={[
                styles.passwordSubmitButton,
                checkingAdultPassword &&
                  styles.passwordSubmitButtonDisabled,
              ]}
              onPress={
                handleAdultPasswordSubmit
              }
              disabled={
                checkingAdultPassword
              }
            >
              {checkingAdultPassword ? (
                <View
                  style={
                    styles.passwordLoadingContent
                  }
                >
                  <ActivityIndicator
                    size="small"
                    color="#FFFFFF"
                  />

                  <Text
                    style={[
                      styles.passwordSubmitText,
                      styles.passwordLoadingText,
                    ]}
                  >
                    Vérification...
                  </Text>
                </View>
              ) : (
                <Text
                  style={
                    styles.passwordSubmitText
                  }
                >
                  Déverrouiller
                </Text>
              )}
            </Pressable>

            <Pressable
              style={
                styles.passwordCancelButton
              }
              onPress={
                closeAdultPasswordModal
              }
              disabled={
                checkingAdultPassword
              }
            >
              <Text
                style={
                  styles.passwordCancelText
                }
              >
                Annuler
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>
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
    textAlign: 'center',
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
    textAlign: 'center',
  },

  emptyText: {
    color: '#777777',
    fontSize: 13,
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 19,
  },

  subscriptionButton: {
    height: 46,
    paddingHorizontal: 22,
    borderRadius: 12,
    backgroundColor: '#E50914',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
  },

  subscriptionButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
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

  /* ==========================================================
     MODALE MOT DE PASSE ADULTE
  ========================================================== */

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.78)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 22,
  },

  passwordModal: {
    width: '100%',
    maxWidth: 390,
    backgroundColor: '#151515',
    borderRadius: 20,
    padding: 22,
    borderWidth: 1,
    borderColor:
      'rgba(255,255,255,0.08)',
  },

  passwordModalIcon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: '#0D0D0D',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 14,
  },

  passwordModalIconText: {
    fontSize: 27,
  },

  passwordModalTitle: {
    color: '#FFFFFF',
    fontSize: 21,
    fontWeight: '800',
    textAlign: 'center',
  },

  passwordModalDescription: {
    color: '#888888',
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 18,
  },

  passwordModalInputContainer: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0D0D0D',
    borderWidth: 1,
    borderColor:
      'rgba(255,255,255,0.09)',
    borderRadius: 12,
  },

  passwordModalInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },

  passwordEyeButton: {
    width: 46,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },

  passwordEyeText: {
    fontSize: 18,
  },

  passwordError: {
    color: '#FF5A60',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 8,
    marginLeft: 2,
  },

  passwordSubmitButton: {
    height: 48,
    borderRadius: 12,
    backgroundColor: '#E50914',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
  },

  passwordSubmitButtonDisabled: {
    opacity: 0.6,
  },

  passwordSubmitText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },

  passwordLoadingContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },

  passwordLoadingText: {
    marginLeft: 9,
  },

  passwordCancelButton: {
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },

  passwordCancelText: {
    color: '#888888',
    fontSize: 13,
    fontWeight: '600',
  },
});
