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
  Modal,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';

import { liveStyles as styles } from '../styles/liveStyles';
import { router } from 'expo-router';

import { Channel } from '../types/live';
import { setZappingChannels } from '../store/liveZappingStore';
import { XtreamClient } from '../api/xtreamClient';

import {
  getCachedUserAccess,
  UserAccessError,
} from '../api/accessApi';

import {
  getCachedLiveIcon,
  getLiveCategoriesFromDatabase,
  getLiveChannelsFromDatabase,
  searchLiveChannelsFromDatabase,
  syncLiveTVIfNeeded,
  LiveSyncProgress,
} from '../database/liveRepository';

import {
  getLocalProtection,
  verifyLocalProtection,
} from '../storage/localProtectionStorage';

import {
  useDialog,
} from '../components/dialogs/DialogProvider';

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

const DB_BATCH_SIZE = 500;

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

    const icon = getCachedLiveIcon(
      channel.stream_id,
    );

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
  const { showDialog } =
    useDialog();

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
     PROTECTION ADULTE
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

  const [adultUnlocked, setAdultUnlocked] =
    useState(false);

  /* ============================================================
     REFS
  ============================================================ */

  const searchRequestRef =
    useRef(0);

  const mountedRef =
    useRef(true);

  const initialLoadDoneRef =
    useRef(false);

  const initializedRef =
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
     IDENTIFICATION CATÉGORIE ADULTE
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
     IDENTIFICATION CHAÎNE ADULTE
  ============================================================ */

  const isAdultChannel =
    useCallback(
      (
        channel: Channel,
        adultCategoryIds: Set<string>,
      ) => {
        const categoryId =
          channel.category_id !== null &&
          channel.category_id !== undefined
            ? String(channel.category_id)
            : '';

        if (
          categoryId &&
          adultCategoryIds.has(categoryId)
        ) {
          return true;
        }

        const adultValue =
          String(
            channel.is_adult ?? '',
          )
            .trim()
            .toLocaleLowerCase('fr-FR');

        if (
          adultValue === '1' ||
          adultValue === 'true' ||
          adultValue === 'yes' ||
          adultValue === 'oui'
        ) {
          return true;
        }

        const normalizedName =
          String(
            channel.name ?? '',
          )
            .trim()
            .toLocaleLowerCase('fr-FR')
            .normalize('NFD')
            .replace(
              /[\u0300-\u036f]/g,
              '',
            );

        return (
          normalizedName.includes('adult') ||
          normalizedName.includes('xxx') ||
          normalizedName.includes('porn')
        );
      },
      [],
    );

  /* ============================================================
     LECTURE USER ACCESS
     
     IMPORTANT :
     Cette fonction ne fait PLUS de requête réseau.

     HomeScreen charge UserAccess au démarrage de
     l'application avec getUserAccess().

     LiveScreen récupère ensuite directement les données
     depuis le cache mémoire global.
  ============================================================ */

  const loadUserAccess =
    useCallback(() => {
      try {
        console.log(
          'VÉRIFICATION ACCÈS LIVE TV DEPUIS LE CACHE MÉMOIRE...',
        );

        const result =
          getCachedUserAccess();

        /*
         * Le cache doit normalement être déjà rempli
         * par HomeScreen.
         */
        if (!result) {
          console.error(
            'USER ACCESS : cache mémoire indisponible pour Live TV.',
          );

          if (mountedRef.current) {
            setAccess(null);
            setXtreamAccess(null);
            setAccessChecked(true);
          }

          return null;
        }

        if (
          !result.subscription ||
          !result.limits
        ) {
          console.log(
            'AUCUN ABONNEMENT ACTIF POUR LE LIVE TV',
          );

          if (mountedRef.current) {
            setAccess(null);
            setXtreamAccess(null);
            setAccessChecked(true);
          }

          return null;
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

        const serverAccess =
          result.xtream
            ? {
                server_url:
                  result.xtream.server_url,
                username:
                  result.xtream.username,
                password:
                  result.xtream.password,
              }
            : null;

        if (mountedRef.current) {
          setAccess(liveAccess);
          setXtreamAccess(
            serverAccess,
          );
          setAccessChecked(true);
        }

        console.log(
          'ACCÈS LIVE TV RÉCUPÉRÉ DU CACHE :',
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

        return {
          liveAccess,
          serverAccess,
        };
      } catch (error) {
        console.error(
          'ERREUR LECTURE ACCÈS LIVE TV :',
          error,
        );

        if (
          error instanceof UserAccessError &&
          (error.status === 401 ||
            error.status === 403)
        ) {
          router.replace('/login');
          return null;
        }

        if (mountedRef.current) {
          setAccessChecked(true);
        }

        return null;
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
      const normalCategories: Category[] = [];
      const adultCategories: Category[] = [];

      rows.forEach((category: any) => {
        const categoryObject: Category = {
          id: String(category.category_id),
          name: String(
            category.category_name ?? '',
          ),
        };

        if (
          isAdultCategory(categoryObject)
        ) {
          if (allowAdult) {
            adultCategories.push(
              categoryObject,
            );
          } else {
            console.log(
              'CATÉGORIE ADULTE MASQUÉE :',
              categoryObject.name,
            );
          }

          return;
        }

        normalCategories.push(
          categoryObject,
        );
      });

      return [
        {
          id: 'all',
          name: 'Toutes',
        },
        ...normalCategories,
        ...adultCategories,
      ];
    },
    [isAdultCategory],
  );
  /* ============================================================
     IDS DES CATÉGORIES ADULTES
  ============================================================ */

  const getAdultCategoryIds =
    useCallback(
      (
        rows: Category[],
      ) => {
        return new Set(
          rows
            .filter(
              category =>
                isAdultCategory(
                  category,
                ),
            )
            .map(
              category =>
                String(
                  category.id,
                ),
            ),
        );
      },
      [isAdultCategory],
    );

  /* ============================================================
     LECTURE DE TOUTES LES CHAÎNES D'UNE CATÉGORIE
  ============================================================ */

  const getAllCategoryChannels =
    useCallback(
      async (
        categoryId: string,
        search: string,
      ): Promise<Channel[]> => {
        const result: Channel[] = [];

        let offset = 0;

        while (true) {
          const batch =
            search
              ? await searchLiveChannelsFromDatabase(
                  search,
                  categoryId,
                  DB_BATCH_SIZE,
                  offset,
                )
              : await getLiveChannelsFromDatabase(
                  categoryId,
                  DB_BATCH_SIZE,
                  offset,
                );

          if (
            batch.length === 0
          ) {
            break;
          }

          result.push(
            ...batch,
          );

          offset +=
            batch.length;

          if (
            batch.length <
            DB_BATCH_SIZE
          ) {
            break;
          }
        }

        return result;
      },
      [],
    );

  /* ============================================================
     CONSTRUCTION DE LA LISTE "TOUTES"
  ============================================================ */

  const getAllAccessibleChannels =
    useCallback(
      async (
        dbCategories: Category[],
        liveAccess: LiveAccess,
        unlockedAdult: boolean,
        search = '',
      ): Promise<Channel[]> => {
        const adultCategoryIds =
          getAdultCategoryIds(
            dbCategories,
          );

        const normalChannels: Channel[] =
          [];

        const adultChannels: Channel[] =
          [];

        const adultIds =
          new Set<number>();

        /*
         * ------------------------------------------------------
         * 1. CHAÎNES NORMALES
         * ------------------------------------------------------
         */

        let offset = 0;

        while (
          normalChannels.length <
          liveAccess.tv_channels
        ) {
          const batch =
            search
              ? await searchLiveChannelsFromDatabase(
                  search,
                  undefined,
                  DB_BATCH_SIZE,
                  offset,
                )
              : await getLiveChannelsFromDatabase(
                  undefined,
                  DB_BATCH_SIZE,
                  offset,
                );

          if (
            batch.length === 0
          ) {
            break;
          }

          for (
            const channel of batch
          ) {
            const adult =
              isAdultChannel(
                channel,
                adultCategoryIds,
              );

            if (adult) {
              continue;
            }

            if (
              normalChannels.length <
              liveAccess.tv_channels
            ) {
              normalChannels.push(
                channel,
              );
            }
          }

          offset +=
            batch.length;

          if (
            batch.length <
            DB_BATCH_SIZE
          ) {
            break;
          }
        }

        /*
         * ------------------------------------------------------
         * 2. CHAÎNES ADULTES
         * ------------------------------------------------------
         */

        if (
          liveAccess.adult &&
          unlockedAdult
        ) {
          const adultCategories =
            dbCategories.filter(
              category =>
                isAdultCategory(
                  category,
                ),
            );

          for (
            const category of adultCategories
          ) {
            const categoryChannels =
              await getAllCategoryChannels(
                category.id,
                search,
              );

            for (
              const channel of categoryChannels
            ) {
              if (
                adultIds.has(
                  channel.stream_id,
                )
              ) {
                continue;
              }

              if (
                !isAdultChannel(
                  channel,
                  adultCategoryIds,
                )
              ) {
                continue;
              }

              adultIds.add(
                channel.stream_id,
              );

              adultChannels.push(
                channel,
              );
            }
          }

          /*
           * Certaines chaînes adultes peuvent être
           * dans une catégorie normale.
           */
          let adultScanOffset = 0;

          while (true) {
            const batch =
              search
                ? await searchLiveChannelsFromDatabase(
                    search,
                    undefined,
                    DB_BATCH_SIZE,
                    adultScanOffset,
                  )
                : await getLiveChannelsFromDatabase(
                    undefined,
                    DB_BATCH_SIZE,
                    adultScanOffset,
                  );

            if (
              batch.length === 0
            ) {
              break;
            }

            for (
              const channel of batch
            ) {
              if (
                adultIds.has(
                  channel.stream_id,
                )
              ) {
                continue;
              }

              if (
                isAdultChannel(
                  channel,
                  adultCategoryIds,
                )
              ) {
                adultIds.add(
                  channel.stream_id,
                );

                adultChannels.push(
                  channel,
                );
              }
            }

            adultScanOffset +=
              batch.length;

            if (
              batch.length <
              DB_BATCH_SIZE
            ) {
              break;
            }
          }
        }

        const finalChannels = [
          ...normalChannels,
          ...adultChannels,
        ];

        console.log(
          'LISTE LIVE ACCESSIBLE CONSTRUITE :',
        );

        console.log(
          'CHAÎNES NORMALES :',
          normalChannels.length,
        );

        console.log(
          'CHAÎNES ADULTES :',
          adultChannels.length,
        );

        console.log(
          'TOTAL FINAL :',
          finalChannels.length,
        );

        console.log(
          'QUOTA NORMAL :',
          liveAccess.tv_channels,
        );

        console.log(
          'ACCÈS ADULTE :',
          liveAccess.adult,
        );

        console.log(
          'ADULTE DÉVERROUILLÉ :',
          unlockedAdult,
        );

        return finalChannels;
      },
      [
        getAdultCategoryIds,
        getAllCategoryChannels,
        isAdultCategory,
        isAdultChannel,
      ],
    );

  /* ============================================================
     CHARGEMENT DES CHAÎNES
  ============================================================ */

  const loadChannels =
    useCallback(
      async (
        categoryId: string,
        overrideAdultUnlocked?: boolean,
      ) => {
        if (!access) {
          return;
        }

        const unlockedAdult =
          overrideAdultUnlocked ??
          adultUnlocked;

        try {
          const category =
            categories.find(
              item =>
                item.id === categoryId,
            );

          if (
            category &&
            isAdultCategory(category) &&
            !access.adult
          ) {
            console.log(
              'ACCÈS CATÉGORIE ADULTE REFUSÉ :',
              category.name,
            );

            return;
          }

          if (
            access.tv_channels <= 0
          ) {
            setChannels([]);
            setTotalChannels(0);
            return;
          }

          const dbCategories =
            categories.filter(
              categoryItem =>
                categoryItem.id !==
                'all',
            );

          let result: Channel[] = [];

          /*
           * TOUTES
           */

          if (
            categoryId === 'all'
          ) {
            result =
              await getAllAccessibleChannels(
                dbCategories,
                access,
                unlockedAdult,
              );
          }

          /*
           * CATÉGORIE ADULTE
           */

          else if (
            category &&
            isAdultCategory(
              category,
            )
          ) {
            if (
              !access.adult ||
              !unlockedAdult
            ) {
              setChannels([]);
              setTotalChannels(0);
              return;
            }

            result =
              await getAllCategoryChannels(
                categoryId,
                '',
              );
          }

          /*
           * CATÉGORIE NORMALE
           */

          else {
            result =
              await getLiveChannelsFromDatabase(
                categoryId,
                access.tv_channels,
                0,
              );

            result =
              result
                .filter(
                  channel =>
                    !isAdultChannel(
                      channel,
                      getAdultCategoryIds(
                        dbCategories,
                      ),
                    ),
                )
                .slice(
                  0,
                  access.tv_channels,
                );
          }

          if (
            !mountedRef.current
          ) {
            return;
          }

          setChannels(result);
          setTotalChannels(
            result.length,
          );

          console.log(
            'CHAÎNES LIVE LUES DEPUIS SQLITE :',
            result.length,
            '| CATÉGORIE :',
            categoryId,
            '| QUOTA NORMAL :',
            access.tv_channels,
            '| ADULTE :',
            access.adult,
            '| ADULTE DÉVERROUILLÉ :',
            unlockedAdult,
          );
        } catch (error) {
          console.error(
            'ERREUR LECTURE CHAÎNES LIVE SQLITE :',
            error,
          );
        }
      },
      [
        access,
        adultUnlocked,
        categories,
        getAdultCategoryIds,
        getAllAccessibleChannels,
        getAllCategoryChannels,
        isAdultCategory,
        isAdultChannel,
      ],
    );

  /* ============================================================
     RECHERCHE
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
          isAdultCategory(category) &&
          (
            !access?.adult ||
            !adultUnlocked
          )
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
          if (!access) {
            return;
          }

          const dbCategories =
            categories.filter(
              categoryItem =>
                categoryItem.id !==
                'all',
            );

          let result: Channel[] = [];

          /*
           * TOUTES
           */

          if (
            categoryId === 'all'
          ) {
            result =
              await getAllAccessibleChannels(
                dbCategories,
                access,
                adultUnlocked,
                search,
              );
          }

          /*
           * ADULTE
           */

          else if (
            category &&
            isAdultCategory(
              category,
            )
          ) {
            result =
              await getAllCategoryChannels(
                categoryId,
                search,
              );
          }

          /*
           * NORMALE
           */

          else {
            result =
              await searchLiveChannelsFromDatabase(
                search,
                categoryId,
                access.tv_channels,
                0,
              );

            const adultCategoryIds =
              getAdultCategoryIds(
                dbCategories,
              );

            result =
              result
                .filter(
                  channel =>
                    !isAdultChannel(
                      channel,
                      adultCategoryIds,
                    ),
                )
                .slice(
                  0,
                  access.tv_channels,
                );
          }

          if (
            !mountedRef.current ||
            requestId !==
              searchRequestRef.current
          ) {
            return;
          }

          setChannels(result);
          setTotalChannels(
            result.length,
          );

          console.log(
            'RECHERCHE LIVE SQLITE :',
            search,
            '| RÉSULTATS :',
            result.length,
            '| QUOTA NORMAL :',
            access.tv_channels,
            '| ADULTE :',
            access.adult,
            '| DÉVERROUILLÉ :',
            adultUnlocked,
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
        access,
        adultUnlocked,
        categories,
        getAdultCategoryIds,
        getAllAccessibleChannels,
        getAllCategoryChannels,
        isAdultCategory,
        isAdultChannel,
        loadChannels,
      ],
    );

  /* ============================================================
     INITIALISATION
  ============================================================ */

  useEffect(() => {
    mountedRef.current = true;

    if (initializedRef.current) {
      return;
    }

    initializedRef.current = true;

    const initialize =
      async () => {
        try {
          /*
           * ------------------------------------------------------
           * 1. ACCÈS
           *
           * Lecture directe du cache mémoire.
           * AUCUNE requête API ici.
           * ------------------------------------------------------
           */

          const accessResult =
            loadUserAccess();

          if (
            !mountedRef.current
          ) {
            return;
          }

          if (!accessResult) {
            setLoading(false);
            return;
          }

          const {
            liveAccess,
          } = accessResult;

          /*
           * ------------------------------------------------------
           * 2. AUCUNE CHAÎNE AUTORISÉE
           * ------------------------------------------------------
           */

          if (
            liveAccess.tv_channels <= 0
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

            initialLoadDoneRef.current =
              true;

            return;
          }

          /*
           * ------------------------------------------------------
           * 3. CATÉGORIES SQLITE
           * ------------------------------------------------------
           */

          const dbCategories =
            await getLiveCategoriesFromDatabase();

          const formattedCategories =
            filterCategories(
              dbCategories,
              liveAccess.adult,
            );

          /*
           * ------------------------------------------------------
           * 4. AFFICHAGE SQLITE IMMÉDIAT
           * ------------------------------------------------------
           */

          const categoryObjects =
              dbCategories.map(
                (row: any) => ({
                  id: String(
                    row.category_id,
                  ),
                  name: String(
                    row.category_name ??
                      '',
                  ),
                }),
              );

            /*
             * ------------------------------------------------------
             * CHARGEMENT INITIAL RAPIDE
             *
             * On lit uniquement le premier lot SQLite.
             * La synchronisation Xtream viendra ensuite.
             * ------------------------------------------------------
             */

            const initialBatch =
              await getLiveChannelsFromDatabase(
                undefined,
                Math.min(
                  liveAccess.tv_channels,
                  DB_BATCH_SIZE,
                ),
                0,
              );

            const adultCategoryIds =
              getAdultCategoryIds(
                categoryObjects,
              );

            const initialChannels =
              initialBatch
                .filter(
                  channel =>
                    !isAdultChannel(
                      channel,
                      adultCategoryIds,
                    ),
                )
                .slice(
                  0,
                  liveAccess.tv_channels,
                );

          if (
            !mountedRef.current
          ) {
            return;
          }

          setCategories(
            formattedCategories,
          );

          setChannels(
            initialChannels,
          );

          setTotalChannels(
            initialChannels.length,
          );

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
            'CHAÎNES NORMALES AFFICHÉES :',
            initialChannels.length,
          );

          console.log(
            'LIMITE ABONNEMENT :',
            liveAccess.tv_channels,
          );

          console.log(
            'ACCÈS ADULTE :',
            liveAccess.adult,
          );

          console.log(
            '================================',
          );

          setLoading(false);

          /*
           * ------------------------------------------------------
           * 5. SMART SYNC EN ARRIÈRE-PLAN
           * ------------------------------------------------------
           */

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

          /*
           * ------------------------------------------------------
           * 6. APRÈS SYNCHRONISATION
           * ------------------------------------------------------
           */

          if (
            result.synchronized
          ) {
            const refreshedCategories =
              await getLiveCategoriesFromDatabase();

            if (
              !mountedRef.current
            ) {
              return;
            }

            const formatted =
              filterCategories(
                refreshedCategories,
                liveAccess.adult,
              );

            setCategories(
              formatted,
            );

            const categoryObjects =
              refreshedCategories.map(
                (row: any) => ({
                  id: String(
                    row.category_id,
                  ),
                  name: String(
                    row.category_name ??
                      '',
                  ),
                }),
              );

            const refreshedChannels =
              await getAllAccessibleChannels(
                categoryObjects,
                liveAccess,
                adultUnlocked,
                searchTextRef.current.trim(),
              );

            if (
              !mountedRef.current
            ) {
              return;
            }

            setChannels(
              refreshedChannels,
            );

            setTotalChannels(
              refreshedChannels.length,
            );

            console.log(
              'LIVE TV RECHARGÉ APRÈS SYNCHRONISATION :',
              refreshedChannels.length,
            );
          } else {
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
    filterCategories,
    getAllAccessibleChannels,
    loadUserAccess,
  ]);

  /* ============================================================
     RECHARGER APRÈS DÉVERROUILLAGE ADULTE
  ============================================================ */

  useEffect(() => {
    if (
      !adultUnlocked ||
      !initialLoadDoneRef.current
    ) {
      return;
    }

    const reloadAfterAdultUnlock =
      async () => {
        if (
          searchTextRef.current.trim()
        ) {
          await searchChannels(
            searchTextRef.current,
            activeCategoryRef.current,
          );
        } else {
          await loadChannels(
            activeCategoryRef.current,
            true,
          );
        }
      };

    reloadAfterAdultUnlock();
  }, [
    adultUnlocked,
    loadChannels,
    searchChannels,
  ]);

  /* ============================================================
     RECHERCHE AVEC DÉLAI 300 MS
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
     OUVERTURE CATÉGORIE ADULTE
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

        if (!access?.adult) {
          console.log(
            '🔒 ACCÈS ADULTE REFUSÉ PAR L’ABONNEMENT',
          );

          return;
        }

        try {
          const protection =
            await getLocalProtection();

          if (!protection) {
            showDialog({
              title:
                'Catégorie protégée',
              message:
                'La catégorie Adulte nécessite un mot de passe local. Configure d’abord une protection dans Paramètres → Sécurité.',
              icon: '🔒',
              buttons: [
                {
                  label: 'Annuler',
                  variant:
                    'secondary',
                },
                {
                  label:
                    'Configurer maintenant',
                  variant:
                    'primary',
                  onPress: () => {
                    router.push(
                      '/security',
                    );
                  },
                },
              ],
            });

            return;
          }

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

          showDialog({
            title: 'Erreur',
            message:
              'Impossible de vérifier la protection de la catégorie Adulte.',
            icon: '⚠️',
            buttons: [
              {
                label: 'Fermer',
                variant:
                  'secondary',
              },
            ],
          });
        }
      },
      [
        access?.adult,
        showDialog,
      ],
    );

  /* ============================================================
     VALIDATION MOT DE PASSE ADULTE
  ============================================================ */

  const handleAdultPasswordSubmit =
    useCallback(async () => {
      if (
        checkingAdultPassword
      ) {
        return;
      }

      if (!access?.adult) {
        setAdultPasswordModalVisible(
          false,
        );

        setAdultPassword('');
        setPendingAdultCategory(null);

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

        setAdultUnlocked(true);

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
     FERMETURE MODALE ADULTE
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
      setPendingAdultCategory(null);
    }, [
      checkingAdultPassword,
    ]);

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

        if (
          isAdultCategory(category)
        ) {
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
     OUVERTURE LECTEUR
  ============================================================ */

  const handleChannelPress =
    useCallback(
      (channel: Channel) => {
        if (!xtreamAccess) {
          console.error(
            'CONFIGURATION XTREAM UTILISATEUR INDISPONIBLE',
          );

          showDialog({
            title:
              'Lecture impossible',
            message:
              'La configuration du serveur de streaming est indisponible.',
            icon: '⚠️',
            buttons: [
              {
                label: 'Fermer',
                variant:
                  'secondary',
              },
            ],
          });

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
        showDialog,
        xtreamAccess,
      ],
    );

  /* ============================================================
     RENDU CHAÎNE
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
      {/* ======================================================
         HEADER
      ====================================================== */}

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

      {/* ======================================================
         RECHERCHE
      ====================================================== */}

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

      {/* ======================================================
         SYNCHRONISATION
      ====================================================== */}

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

      {/* ======================================================
         CATÉGORIES
      ====================================================== */}

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

      {/* ======================================================
         CHAÎNES
      ====================================================== */}

      {channels.length === 0 ? (
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
              Synchronisation des chaînes...
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

      {/* ======================================================
         MODALE MOT DE PASSE ADULTE
      ====================================================== */}

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
                🔞
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
                    ? '🔒'
                    : '🔓'}
                </Text>
              </Pressable>
            </View>

            {adultPasswordError ? (
              <Text
                style={
                  styles.passwordError
                }
              >
                {
                  adultPasswordError
                }
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
