import { useEffect, useRef, useState } from 'react';
import {
ActivityIndicator,
Pressable,
StyleSheet,
Text,
View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { VideoView, useVideoPlayer } from 'expo-video';
import ArrowLeft from '../assets/icons/arrow-left.svg';
import ArrowRight from '../assets/icons/arrow-right.svg';
import {
getNextChannel,
getPreviousChannel,
} from '../store/liveZappingStore';

import { XtreamClient } from '../api/xtreamClient';
import { xtreamConfig } from '../api/config';

export default function PlayerScreen() {
const { url, title } = useLocalSearchParams<{
url: string;
title: string;
}>();

const videoUrl = Array.isArray(url) ? url[0] : url;
const initialTitle = Array.isArray(title) ? title[0] : title;

const [status, setStatus] = useState('loading');
const [isReconnecting, setIsReconnecting] = useState(false);
const [retryCount, setRetryCount] = useState(0);

const [currentUrl, setCurrentUrl] = useState(videoUrl);
const [currentTitle, setCurrentTitle] = useState(initialTitle);

const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
const retryCountRef = useRef(0);
const reconnectAttemptRunningRef = useRef(false);
const mountedRef = useRef(true);
const hasPlayedRef = useRef(false);

const currentUrlRef = useRef(videoUrl);
console.log('URL INITIALE :', currentUrl);
const player = useVideoPlayer(currentUrl || '', (player) => {
player.loop = false;
});

useEffect(() => {
mountedRef.current = true;

return () => {
  mountedRef.current = false;

  if (retryTimerRef.current) {
    clearTimeout(retryTimerRef.current);
    retryTimerRef.current = null;
  }
};

}, []);

const changeChannel = async (
direction: 'previous' | 'next'
) => {
const channel =
direction === 'next'
? getNextChannel()
: getPreviousChannel();

if (!channel) {
  return;
}

const client = new XtreamClient(xtreamConfig);

const newUrl =
  channel.direct_source ||
  client.getLiveStreamUrl(channel.stream_id);

try {
  setCurrentUrl(newUrl);
  currentUrlRef.current = newUrl;

  setCurrentTitle(channel.name);

  retryCountRef.current = 0;
  setRetryCount(0);

  setIsReconnecting(false);

  hasPlayedRef.current = false;
  reconnectAttemptRunningRef.current = false;

  if (retryTimerRef.current) {
    clearTimeout(retryTimerRef.current);
    retryTimerRef.current = null;
  }

  console.log('ZAPPING URL :', newUrl);
  await player.replaceAsync(newUrl);

  if (!mountedRef.current) {
    return;
  }

  player.play();
} catch (error) {
  console.log('ERREUR ZAPPING :', error);
}

};

const scheduleReconnect = () => {
if (
!mountedRef.current ||
!currentUrlRef.current
) {
return;
}

if (retryTimerRef.current) {
  return;
}

if (reconnectAttemptRunningRef.current) {
  return;
}

setIsReconnecting(true);

const delays = [
  2000,
  4000,
  6000,
  10000,
  15000,
];

const retryIndex = Math.min(
  retryCountRef.current,
  delays.length - 1
);

const delay = delays[retryIndex];
const nextAttempt = retryCountRef.current + 1;

console.log(
  `RECONNEXION DANS ${delay / 1000}s — TENTATIVE ${nextAttempt}`
);

retryTimerRef.current = setTimeout(
  async () => {
    retryTimerRef.current = null;

    if (
      !mountedRef.current ||
      !currentUrlRef.current
    ) {
      return;
    }

    reconnectAttemptRunningRef.current = true;

    retryCountRef.current = nextAttempt;
    setRetryCount(nextAttempt);

    console.log(
      `TENTATIVE DE RECONNEXION ${nextAttempt}`
    );

    try {
      await player.replaceAsync(
        currentUrlRef.current
      );

      if (!mountedRef.current) {
        return;
      }

      player.play();

      console.log(
        'RECONNEXION — LECTURE DEMANDÉE'
      );
    } catch (error) {
      console.error(
        'ERREUR RECONNEXION :',
        error
      );

      reconnectAttemptRunningRef.current = false;

      scheduleReconnect();

      return;
    }

    reconnectAttemptRunningRef.current = false;
  },
  delay
);

};

useEffect(() => {
if (!videoUrl) {
return;
}

const subscription = player.addListener(
  'statusChange',
  (event) => {
    if (!mountedRef.current) {
      return;
    }

    const newStatus = event.status;

    setStatus(newStatus);

    console.log(
      'STATUT VIDÉO :',
      newStatus
    );

    if (newStatus === 'readyToPlay') {
      hasPlayedRef.current = true;

      reconnectAttemptRunningRef.current = false;

      retryCountRef.current = 0;

      setRetryCount(0);
      setIsReconnecting(false);

      if (retryTimerRef.current) {
        clearTimeout(
          retryTimerRef.current
        );

        retryTimerRef.current = null;
      }

      player.play();

      return;
    }

    if (newStatus === 'error') {
      const message =
        event.error?.message ||
        'Erreur vidéo inconnue';

      console.error(
        'ERREUR VIDÉO :',
        message
      );

      reconnectAttemptRunningRef.current = false;

      scheduleReconnect();

      return;
    }

    if (newStatus === 'idle') {
      if (hasPlayedRef.current) {
        reconnectAttemptRunningRef.current = false;

        scheduleReconnect();
      }
    }
  }
);

return () => {
  subscription.remove();

  if (retryTimerRef.current) {
    clearTimeout(
      retryTimerRef.current
    );

    retryTimerRef.current = null;
  }
};

}, [player, videoUrl]);

if (!videoUrl) {
return (
<SafeAreaView style={styles.container}>
<View style={styles.errorContainer}>
<Text style={styles.errorTitle}>
Flux introuvable
</Text>

      <Text style={styles.errorText}>
        L'URL de la chaîne vidéo est absente.
      </Text>

      <Pressable
        style={styles.backButtonError}
        onPress={() => router.back()}
      >
        <Text style={styles.backButtonErrorText}>
          Retour
        </Text>
      </Pressable>
    </View>
  </SafeAreaView>
);

}

return (
<SafeAreaView
style={styles.container}
edges={['top', 'bottom']}
>
<View style={styles.header}>
<Pressable
style={styles.backButton}
onPress={() => router.back()}
>
<Text style={styles.backText}>
‹ Retour
</Text>
</Pressable>

    <Text
      style={styles.title}
      numberOfLines={1}
    >
      {currentTitle || 'Lecture en direct'}
    </Text>
  </View>

  <View style={styles.videoContainer}>
    <VideoView
      player={player}
      style={styles.video}
      contentFit="contain"
      nativeControls
      fullscreenOptions={{
        enable: true,
      }}
    />

    <View style={styles.zappingControls}> <Pressable style={styles.zappingButton} onPress={() => changeChannel('previous')} > <ArrowLeft width={24} height={24} /> </Pressable> <Text style={styles.zappingTitle} numberOfLines={1} > {currentTitle} </Text> <Pressable style={styles.zappingButton} onPress={() => changeChannel('next')} > <ArrowRight width={24} height={24} /> </Pressable> </View>
        

    {isReconnecting && (
      <View style={styles.reconnectBadge}>
        <ActivityIndicator
          size="small"
          color="#FFB000"
        />

        <View style={styles.reconnectInfo}>
          <Text style={styles.reconnectTitle}>
            Connexion instable
          </Text>

          <Text style={styles.reconnectText}>
            Reconnexion automatique • tentative{' '}
            {retryCount}
          </Text>
        </View>
      </View>
    )}
  </View>

  <Text style={styles.statusText}>
    État : {status}
  </Text>
</SafeAreaView>

);
}

const styles = StyleSheet.create({
container: {
flex: 1,
backgroundColor: '#080808',
},

header: {
paddingHorizontal: 20,
paddingTop: 10,
paddingBottom: 15,
},

backButton: {
alignSelf: 'flex-start',
paddingVertical: 6,
marginBottom: 8,
},

backText: {
color: '#FFFFFF',
fontSize: 16,
fontWeight: '600',
},

title: {
color: '#FFFFFF',
fontSize: 20,
fontWeight: '800',
},

videoContainer: {
width: '100%',
aspectRatio: 16 / 9,
backgroundColor: '#000000',
position: 'relative',
},

video: {
width: '100%',
height: '100%',
},

zappingControls: {
flexDirection: 'row',
alignItems: 'center',
justifyContent: 'space-between',
paddingHorizontal: 20,
paddingVertical: 12,
backgroundColor: '#111111',
},

zappingButton: {
width: 50,
height: 45,
borderRadius: 8,
backgroundColor: '#222222',
alignItems: 'center',
justifyContent: 'center',
},

zappingButtonText: {
color: '#FFFFFF',
fontSize: 22,
fontWeight: 'bold',
},

zappingTitle: {
flex: 1,
color: '#FFFFFF',
fontSize: 16,
fontWeight: '600',
textAlign: 'center',
marginHorizontal: 15,
},

loadingOverlay: {
position: 'absolute',
top: 0,
left: 0,
right: 0,
bottom: 0,
alignItems: 'center',
justifyContent: 'center',
backgroundColor: '#000000',
},

loadingText: {
color: '#AAAAAA',
fontSize: 14,
marginTop: 12,
},

reconnectBadge: {
position: 'absolute',
left: 15,
right: 15,
bottom: 15,
flexDirection: 'row',
alignItems: 'center',
paddingHorizontal: 14,
paddingVertical: 10,
borderRadius: 8,
backgroundColor: 'rgba(20, 20, 20, 0.92)',
},

reconnectInfo: {
marginLeft: 10,
},

reconnectTitle: {
color: '#FFB000',
fontSize: 14,
fontWeight: '700',
},

reconnectText: {
color: '#AAAAAA',
fontSize: 12,
marginTop: 2,
},

statusText: {
color: '#666666',
fontSize: 12,
paddingHorizontal: 20,
paddingTop: 10,
},

errorContainer: {
flex: 1,
alignItems: 'center',
justifyContent: 'center',
paddingHorizontal: 30,
},

errorTitle: {
color: '#FFFFFF',
fontSize: 22,
fontWeight: '800',
marginBottom: 10,
},

errorText: {
color: '#888888',
fontSize: 14,
textAlign: 'center',
marginBottom: 25,
},

backButtonError: {
paddingHorizontal: 20,
paddingVertical: 10,
borderRadius: 8,
backgroundColor: '#222222',
},

backButtonErrorText: {
color: '#FFFFFF',
fontSize: 14,
fontWeight: '600',
},
});