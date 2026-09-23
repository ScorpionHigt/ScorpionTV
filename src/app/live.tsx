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

const PAGE_SIZE = 100;
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

  /*
   * L'accès adulte de l'abonnement ne suffit pas.
   * Le mot de passe local doit également avoir
   * été validé pour afficher les chaînes adultes.
   */
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

        /*
         * Une chaîne est adulte si elle appartient
         * à une catégorie adulte.
         */
        if (
          categoryId &&
          adultCategoryIds.has(categoryId)
        ) {
          return true;
        }

        /*
         * Vérification du marqueur is_adult.
         *
         * Dans le type Channel, is_adult est
         * string | null.
         */
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

        /*
         * Dernière sécurité :
         * certaines listes Xtream mettent directement
         * des mots-clés adultes dans le nom de la chaîne.
         */
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
     VÉRIFICATION ACCÈS UTILISATEUR
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
          return null;
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

        setAccess(liveAccess);
        setXtreamAccess(
          serverAccess,
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

        /*
         * IMPORTANT :
         * On retourne directement les données.
         * On ne dépend donc pas du délai de setAccess().
         */
        return {
          liveAccess,
          serverAccess,
        };
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
        const filteredRows =
          rows.filter(
            (category: any) => {
              const categoryObject: Category =
                {
                  id: String(
                    category.category_id,
                  ),
                  name:
                    String(
                      category.category_name ??
                        '',
                    ),
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
                String(
                  category.category_name ??
                    '',
                ),
            }),
          ),
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

     RÈGLE :
     - tv_channels = quota des chaînes normales
     - adulte autorisé + déverrouillé :
       toutes les chaînes adultes sont ajoutées
     - adulte non autorisé :
       aucune chaîne adulte
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
         * 1. PARCOURS SQLITE DANS L'ORDRE
         *
         * On continue jusqu'à avoir obtenu
         * suffisamment de chaînes normales.
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
              /*
               * Les adultes ne consomment PAS
               * le quota des chaînes normales.
               *
               * Ils seront récupérés séparément
               * dans les catégories adultes.
               */
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
         *
         * Si l'abonnement autorise l'adulte
         * ET que la protection locale a été validée,
         * on récupère TOUTES les chaînes adultes.
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
           * Certaines bases peuvent avoir une chaîne
           * marquée adulte mais rangée dans une catégorie
           * non adulte.
           *
           * On la récupère également sans dépasser
           * le contenu déjà chargé.
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
           * ------------------------------------------------------
           * TOUTES
           *
           * 200 normales + toutes les adultes.
           * ------------------------------------------------------
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
           * ------------------------------------------------------
           * CATÉGORIE ADULTE
           *
           * Toutes les chaînes de la catégorie.
           * Le quota normal ne s'applique PAS.
           * ------------------------------------------------------
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
           * ------------------------------------------------------
           * CATÉGORIE NORMALE
           *
           * Le quota de l'abonnement s'applique.
           * ------------------------------------------------------
           */

          else {
            result =
              await getLiveChannelsFromDatabase(
                categoryId,
                access.tv_channels,
                0,
              );

            result =
              result.filter(
                channel =>
                  !isAdultChannel(
                    channel,
                    getAdultCategoryIds(
                      dbCategories,
                    ),
                  ),
              ).slice(
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
           * TOUTES :
           * 200 normales + tous les adultes
           * correspondant à la recherche.
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
           * ADULTE :
           * toutes les chaînes adultes correspondant
           * à la recherche.
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
           * NORMALE :
           * maximum quota de l'abonnement.
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
           * ------------------------------------------------------
           */

          const accessResult =
            await loadUserAccess();

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
           *
           * Important :
           * on utilise liveAccess directement,
           * pas le state access.
           * ------------------------------------------------------
           */

          let initialChannels: Channel[] =
            [];

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

          initialChannels =
            await getAllAccessibleChannels(
              categoryObjects,
              liveAccess,
              false,
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

          /*
           * ------------------------------------------------------
           * AUCUNE PROTECTION CONFIGURÉE
           *
           * Utilisation du DialogProvider,
           * et non Alert.alert.
           * ------------------------------------------------------
           */

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

          /*
           * ------------------------------------------------------
           * PROTECTION CONFIGURÉE
           * ------------------------------------------------------
           */

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

        /*
         * Le mot de passe local est maintenant
         * validé pour cette session Live.
         */
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

        /*
         * ------------------------------------------------------
         * CATÉGORIE ADULTE
         * ------------------------------------------------------
         */

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

        /*
         * ------------------------------------------------------
         * CATÉGORIE NORMALE
         * ------------------------------------------------------
         */

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
          initialNumToRender={20}
          maxToRenderPerBatch={20}
          windowSize={7}
          removeClippedSubviews={true}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* ======================================================
         MODALE MOT DE PASSE ADULTE
      ====================================================== */
      }

      <Modal
        visible={adultPasswordModalVisible}
        transparent
        animationType="fade"
        onRequestClose={
          closeAdultPasswordModal
        }
      >
        <View style={styles.modalOverlay}>
          <View style={styles.passwordModal}>
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
                value={adultPassword}
                onChangeText={value => {
                  setAdultPassword(value);

                  if (adultPasswordError) {
                    setAdultPasswordError('');
                  }
                }}
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
                    value => !value,
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