export type XtreamConfig = {
  server: string;
  username: string;
  password: string;
};

export type XtreamCategory = {
  category_id: string;
  category_name: string;
  icon?: string | null;
  is_adult: number;
  parent_id: number;
  stream_count: number;
};

export type XtreamMovie = {
  num: number;
  name: string;
  stream_type: string;
  stream_id: number;
  stream_icon: string | null;
  rating: string;
  rating_5based: number;
  added: string;
  is_adult: string;
  container_extension: string;
  custom_sid: string;
  direct_source: string;
  category_id: string;
};

export type XtreamLiveCategory = {
  category_id: string;
  category_name: string;
  parent_id: number;
};

export type XtreamLiveChannel = {
  num: number;
  name: string;
  stream_type: string;
  stream_id: number;
  stream_icon?: string | null;
  epg_channel_id?: string | null;
  added?: string | null;
  is_adult?: string | null;
  category_id?: string | null;
  custom_sid?: string | null;
  tv_archive?: number;
  direct_source?: string | null;
  tv_archive_duration?: number;
};

/*
============================================================
SÉRIES
============================================================
*/

export type XtreamSeriesCategory = {
  category_id: string;
  category_name: string;
  parent_id: number;
};

export type XtreamSeries = {
  num: number;
  name: string;
  series_id: number;
  cover: string | null;
  plot: string | null;
  cast: string | null;
  director: string | null;
  genre: string | null;
  releaseDate: string | null;
  rating: string | null;
  rating_5based: number | null;
  backdrop_path: string[] | null;
  youtube_trailer: string | null;
  episode_run_time: number | null;
  category_id: string;
};

export type XtreamSeriesInfo = {
  info?: {
    name?: string;
    cover?: string | null;
    plot?: string | null;
    cast?: string | null;
    director?: string | null;
    genre?: string | null;
    releaseDate?: string | null;
    rating?: string | null;
    rating_5based?: number | null;
    backdrop_path?: string[] | null;
    youtube_trailer?: string | null;
    episode_run_time?: number | null;
  };

  seasons?: Array<{
    season_number: number;
    name?: string;
    episode_count?: number;
    cover?: string | null;
    cover_big?: string | null;
    air_date?: string | null;
  }>;

  episodes?: Record<
    string,
    Array<{
      id: string | number;
      episode_num: number;
      title: string;
      container_extension: string;

      info?: {
        plot?: string | null;
        rating?: string | null;
        rating_5based?: number | null;
        duration?: string | null;
        duration_secs?: number | null;
        movie_image?: string | null;
        tmdb_id?: string | number | null;
      };

      custom_sid?: string | null;
      added?: string | null;
      season?: number;
      direct_source?: string | null;
    }>
  >;
};

export class XtreamClient {
  private server: string;
  private username: string;
  private password: string;

  constructor(config: XtreamConfig) {
    this.server = config.server.replace(/\/$/, '');
    this.username = config.username;
    this.password = config.password;
  }

  private async request(
      action?: string,
      extraParams: Record<string, string> = {}
    ) {
      const params = new URLSearchParams({
        username: this.username,
        password: this.password,
        ...extraParams,
      });

      if (action) {
        params.append('action', action);
      }

      const url =
        this.server +
        '/player_api.php?' +
        params.toString();

      const response =
        await fetch(url);

      const responseText =
        await response.text();

      console.log(
        'XTREAM REQUÊTE :',
        action ?? 'authenticate',
        'HTTP :',
        response.status,
        'TAILLE :',
        responseText.length
      );

      if (!response.ok) {
        throw new Error(
          'Erreur HTTP ' +
            response.status +
            ' — action : ' +
            (action ?? 'authenticate')
        );
      }

      if (!responseText.trim()) {
        throw new Error(
          'Réponse Xtream vide — action : ' +
            (action ?? 'authenticate')
        );
      }

      try {
        return JSON.parse(responseText);
      } catch (error) {
        console.error(
          'RÉPONSE XTREAM NON JSON :',
          action ?? 'authenticate',
          'TAILLE :',
          responseText.length,
          'DÉBUT :',
          responseText.slice(0, 200)
        );

        throw new Error(
          'Réponse Xtream invalide — action : ' +
            (action ?? 'authenticate')
        );
      }
    }

  /*
  ============================================================
  AUTHENTIFICATION
  ============================================================
  */

  async authenticate() {
    return this.request();
  }

  /*
  ============================================================
  VOD / FILMS
  ============================================================
  */

  async getVodCategories(): Promise<XtreamCategory[]> {
    return this.request('get_vod_categories');
  }

  async getVodStreams(
    categoryId?: string
  ): Promise<XtreamMovie[]> {
    const params: Record<string, string> = {};

    if (categoryId) {
      params.category_id = categoryId;
    }

    return this.request(
      'get_vod_streams',
      params
    );
  }

  async getVodInfo(vodId: string) {
    return this.request(
      'get_vod_info',
      {
        vod_id: vodId,
      }
    );
  }

  getMovieUrl(
    streamId: string,
    extension: string
  ) {
    return (
      this.server +
      '/movie/' +
      this.username +
      '/' +
      this.password +
      '/' +
      streamId +
      '.' +
      extension
    );
  }

  /*
  ============================================================
  LIVE TV
  ============================================================
  */

  async getLiveCategories(): Promise<
    XtreamLiveCategory[]
  > {
    return this.request(
      'get_live_categories'
    );
  }

  async getLiveStreams(
    categoryId?: string
  ): Promise<XtreamLiveChannel[]> {
    const params: Record<string, string> = {};

    if (categoryId) {
      params.category_id = categoryId;
    }

    return this.request(
      'get_live_streams',
      params
    );
  }

  getLiveStreamUrl(
    streamId: number
  ): string {
    return (
      this.server +
      '/live/' +
      this.username +
      '/' +
      this.password +
      '/' +
      streamId +
      '.ts'
    );
  }

  /*
  ============================================================
  SÉRIES
  ============================================================
  */

  async getSeriesCategories(): Promise<
    XtreamSeriesCategory[]
  > {
    return this.request(
      'get_series_categories'
    );
  }

  async getSeries(
    categoryId?: string
  ): Promise<XtreamSeries[]> {
    const params: Record<string, string> = {};

    if (categoryId) {
      params.category_id = categoryId;
    }

    return this.request(
      'get_series',
      params
    );
  }

  async getSeriesInfo(
    seriesId: string
  ): Promise<XtreamSeriesInfo> {
    return this.request(
      'get_series_info',
      {
        series_id: seriesId,
      }
    );
  }



  getSeriesEpisodeUrl(
    episodeId: number | string,
    extension: string
  ): string {
    return (
      this.server +
      '/series/' +
      this.username +
      '/' +
      this.password +
      '/' +
      episodeId +
      '.' +
      extension
    );
  }
}