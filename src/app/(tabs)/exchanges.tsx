import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';

import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
  useAudioPlayer,
  useAudioPlayerStatus,
} from 'expo-audio';

import NotificationBell from '../../components/NotificationBell';

import {
  ExchangeMessage as ApiExchangeMessage,
  getExchanges,
  sendExchangeMessage,
  sendExchangeAudio,
} from '../../api/exchangesApi';

type MessageType = 'text' | 'audio';

type ExchangeMessage = {
  id: number;
  sender: 'user' | 'admin';
  type: MessageType;
  message?: string;
  audioUri?: string;
  duration?: number;
  createdAt: string;
  isRead: boolean;
};

const WAVE_HEIGHTS = [
  18, 28, 14, 32, 22, 36, 20, 29, 16, 25, 19,
];

function formatDuration(seconds: number) {
  const safeSeconds = Math.max(
    0,
    Math.floor(seconds),
  );

  const minutes = Math.floor(
    safeSeconds / 60,
  );

  const remainingSeconds =
    safeSeconds % 60;

  return `${String(minutes).padStart(
    2,
    '0',
  )}:${String(remainingSeconds).padStart(
    2,
    '0',
  )}`;
}

function formatMessageTime(
  dateValue: string,
) {
  if (!dateValue) {
    return '';
  }

  try {
    const date = new Date(
      dateValue,
    );

    if (Number.isNaN(date.getTime())) {
      return dateValue;
    }

    return date.toLocaleTimeString(
      'fr-FR',
      {
        hour: '2-digit',
        minute: '2-digit',
      },
    );
  } catch {
    return dateValue;
  }
}

function mapApiMessage(
  message: ApiExchangeMessage,
): ExchangeMessage {
  return {
    id: message.id,

    sender:
      message.sender_type === 'admin'
        ? 'admin'
        : 'user',

    type:
      message.message_type === 'audio'
        ? 'audio'
        : 'text',

    message:
      message.message_text ??
      undefined,

    audioUri:
      message.audio_url ??
      undefined,

    duration:
      message.audio_duration ??
      undefined,

    createdAt:
      formatMessageTime(
        message.created_at,
      ),

    isRead: message.is_read,
  };
}

function AudioMessage({
  uri,
  duration = 0,
  isMine,
}: {
  uri: string;
  duration?: number;
  isMine: boolean;
}) {
  const player = useAudioPlayer(uri);
  const status =
    useAudioPlayerStatus(player);

  const isPlaying = status.playing;

  const handlePlay = useCallback(() => {
    try {
      if (isPlaying) {
        player.pause();
        return;
      }

      if (
        status.duration > 0 &&
        status.currentTime >=
          status.duration
      ) {
        player.seekTo(0);
      }

      player.play();
    } catch (error) {
      console.error(
        'ERREUR LECTURE AUDIO :',
        error,
      );
    }
  }, [
    isPlaying,
    player,
    status.currentTime,
    status.duration,
  ]);

  return (
    <View style={styles.audioMessage}>
      <Pressable
        style={[
          styles.audioPlayButton,
          isMine &&
            styles.audioPlayButtonMine,
        ]}
        onPress={handlePlay}
        accessibilityRole="button"
        accessibilityLabel={
          isPlaying
            ? 'Mettre en pause'
            : 'Lire le vocal'
        }
      >
        <Text
          style={[
            styles.audioPlayIcon,
            isMine &&
              styles.audioPlayIconMine,
          ]}
        >
          {isPlaying ? '❚❚' : '▶'}
        </Text>
      </Pressable>

      <View style={styles.audioContent}>
        <View style={styles.audioWave}>
          {WAVE_HEIGHTS.map(
            (height, index) => (
              <View
                key={index}
                style={[
                  styles.audioBar,
                  {
                    height,
                    opacity:
                      isPlaying &&
                      index % 3 === 0
                        ? 1
                        : 0.65,
                  },
                ]}
              />
            ),
          )}
        </View>

        <Text
          style={[
            styles.audioDuration,
            isMine &&
              styles.audioDurationMine,
          ]}
        >
          {formatDuration(duration)}
        </Text>
      </View>
    </View>
  );
}

export default function ExchangesScreen() {
  const insets =
    useSafeAreaInsets();

  const [message, setMessage] =
    useState('');

  const [messages, setMessages] =
    useState<ExchangeMessage[]>([]);

  const [
    isLoadingMessages,
    setIsLoadingMessages,
  ] = useState(true);

  const [
    isSending,
    setIsSending,
  ] = useState(false);

  const [
    recordingUri,
    setRecordingUri,
  ] = useState<string | null>(null);

  const [
    recordingDuration,
    setRecordingDuration,
  ] = useState(0);

  const [
    isPreparingRecording,
    setIsPreparingRecording,
  ] = useState(false);

  const [
    microphoneAvailable,
    setMicrophoneAvailable,
  ] = useState(true);

  const scrollViewRef =
    useRef<ScrollView>(null);

  const recorder = useAudioRecorder(
    RecordingPresets.HIGH_QUALITY,
  );

  const recorderState =
    useAudioRecorderState(recorder);

  const isRecording =
    recorderState.isRecording;

  const bottomTabSpace =
    64 +
    Math.max(insets.bottom, 8) +
    12;

  // ===================================================
  // CHARGEMENT DES ÉCHANGES
  // ===================================================

  const loadMessages =
    useCallback(async () => {
      try {
        setIsLoadingMessages(true);

        console.log(
          '💬 RÉCUPÉRATION DES ÉCHANGES...',
        );

        const response =
          await getExchanges();

        const loadedMessages =
          response.messages.map(
            mapApiMessage,
          );

        setMessages(
          loadedMessages,
        );

        console.log(
          '💬 ÉCHANGES RÉCUPÉRÉS :',
          loadedMessages.length,
        );
      } catch (error) {
        console.error(
          'ERREUR RÉCUPÉRATION ÉCHANGES :',
          error,
        );

        setMessages([]);
      } finally {
        setIsLoadingMessages(false);
      }
    }, []);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  // ===================================================
  // CONFIGURATION AUDIO
  // ===================================================

  useEffect(() => {
    let mounted = true;

    const configureAudio =
      async () => {
        try {
          const permission =
            await AudioModule.getRecordingPermissionsAsync();

          if (!mounted) {
            return;
          }

          setMicrophoneAvailable(
            permission.granted,
          );

          await setAudioModeAsync({
            playsInSilentMode: true,
            allowsRecording: true,
          });

          console.log(
            'AUDIO CONFIGURÉ',
          );
        } catch (error) {
          console.error(
            'ERREUR CONFIGURATION AUDIO :',
            error,
          );
        }
      };

    configureAudio();

    return () => {
      mounted = false;
    };
  }, []);

  // ===================================================
  // DURÉE ENREGISTREMENT
  // ===================================================

  useEffect(() => {
    if (!isRecording) {
      return;
    }

    setRecordingDuration(
      Math.max(
        0,
        Math.floor(
          recorderState.durationMillis /
            1000,
        ),
      ),
    );
  }, [
    isRecording,
    recorderState.durationMillis,
  ]);

  // ===================================================
  // SCROLL AUTOMATIQUE
  // ===================================================

  useEffect(() => {
    const timeout =
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd(
          {
            animated: true,
          },
        );
      }, 100);

    return () =>
      clearTimeout(timeout);
  }, [messages.length]);

  // ===================================================
  // PERMISSION MICRO
  // ===================================================

  const ensureMicrophonePermission =
    useCallback(async () => {
      try {
        const current =
          await AudioModule.getRecordingPermissionsAsync();

        if (current.granted) {
          setMicrophoneAvailable(
            true,
          );

          return true;
        }

        const requested =
          await AudioModule.requestRecordingPermissionsAsync();

        setMicrophoneAvailable(
          requested.granted,
        );

        if (!requested.granted) {
          console.log(
            'PERMISSION MICRO REFUSÉE :',
            requested.status,
          );

          return false;
        }

        return true;
      } catch (error) {
        console.error(
          'ERREUR PERMISSION MICRO :',
          error,
        );

        setMicrophoneAvailable(
          false,
        );

        return false;
      }
    }, []);

  // ===================================================
  // DÉMARRER ENREGISTREMENT
  // ===================================================

  const startRecording =
    useCallback(async () => {
      if (
        isRecording ||
        isPreparingRecording ||
        isSending
      ) {
        return;
      }

      try {
        setIsPreparingRecording(
          true,
        );

        setRecordingUri(null);
        setRecordingDuration(0);

        const permitted =
          await ensureMicrophonePermission();

        if (!permitted) {
          console.log(
            '🎙️ ENREGISTREMENT IMPOSSIBLE : MICRO REFUSÉ',
          );

          return;
        }

        await setAudioModeAsync({
          playsInSilentMode: true,
          allowsRecording: true,
        });

        await recorder.prepareToRecordAsync();

        recorder.record();

        console.log(
          '🎙️ ENREGISTREMENT DÉMARRÉ',
        );
      } catch (error) {
        console.error(
          'ERREUR DÉMARRAGE ENREGISTREMENT :',
          error,
        );
      } finally {
        setIsPreparingRecording(
          false,
        );
      }
    }, [
      ensureMicrophonePermission,
      isPreparingRecording,
      isRecording,
      isSending,
      recorder,
    ]);

  // ===================================================
  // ARRÊTER ENREGISTREMENT
  // ===================================================

  const stopRecording =
    useCallback(async () => {
      if (!isRecording) {
        return;
      }

      try {
        const finalDuration =
          Math.max(
            1,
            Math.round(
              recorder.currentTime,
            ),
          );

        await recorder.stop();

        const uri = recorder.uri;

        console.log(
          '🎙️ ENREGISTREMENT TERMINÉ :',
          uri,
        );

        if (!uri) {
          console.error(
            '❌ AUCUNE URI AUDIO RÉCUPÉRÉE',
          );

          setRecordingDuration(0);

          return;
        }

        setRecordingUri(uri);

        setRecordingDuration(
          finalDuration,
        );

        console.log(
          '🎙️ AUDIO PRÊT À ÊTRE ENVOYÉ',
        );
      } catch (error) {
        console.error(
          'ERREUR ARRÊT ENREGISTREMENT :',
          error,
        );
      }
    }, [
      isRecording,
      recorder,
    ]);

  // ===================================================
  // ANNULER ENREGISTREMENT
  // ===================================================

  const cancelRecording =
    useCallback(async () => {
      try {
        if (isRecording) {
          await recorder.stop();
        }
      } catch (error) {
        console.error(
          'ERREUR ANNULATION ENREGISTREMENT :',
          error,
        );
      } finally {
        setRecordingUri(null);
        setRecordingDuration(0);

        console.log(
          '🎙️ VOCAL ANNULÉ',
        );
      }
    }, [
      isRecording,
      recorder,
    ]);

  // ===================================================
  // SUPPRIMER APERÇU VOCAL
  // ===================================================

  const deleteRecordingPreview =
    useCallback(() => {
      setRecordingUri(null);
      setRecordingDuration(0);

      console.log(
        '🎙️ APERÇU VOCAL SUPPRIMÉ',
      );
    }, []);

  // ===================================================
  // ENVOYER MESSAGE TEXTE
  // ===================================================

  const handleSendMessage =
    useCallback(async () => {
      const trimmedMessage =
        message.trim();

      if (
        !trimmedMessage ||
        isSending ||
        isRecording ||
        recordingUri
      ) {
        return;
      }

      try {
        setIsSending(true);

        console.log(
          '💬 ENVOI MESSAGE TEXTE :',
          trimmedMessage,
        );

        const response =
          await sendExchangeMessage(
            trimmedMessage,
          );

        const newMessage =
          mapApiMessage(
            response.message,
          );

        setMessages(
          (previous) => [
            ...previous,
            newMessage,
          ],
        );

        setMessage('');

        console.log(
          '💬 MESSAGE TEXTE ENREGISTRÉ :',
          newMessage.id,
        );
      } catch (error) {
        console.error(
          'ERREUR ENVOI MESSAGE :',
          error,
        );
      } finally {
        setIsSending(false);
      }
    }, [
      isRecording,
      isSending,
      message,
      recordingUri,
    ]);

  // ===================================================
  // ENVOYER VOCAL
  // ===================================================
  const sendRecording = useCallback(async () => {
      if (
        isRecording ||
        isSending ||
        !recordingUri
      ) {
        return;
      }

      try {
        setIsSending(true);

        console.log(
          '🎙️ ENVOI MESSAGE VOCAL :',
          {
            uri: recordingUri,
            duration: recordingDuration,
          },
        );

        await sendExchangeAudio(
          recordingUri,
          Math.max(1, recordingDuration),
        );

        await loadMessages();

        setRecordingUri(null);
        setRecordingDuration(0);

        console.log(
          '✅ MESSAGE VOCAL ENVOYÉ',
        );
      } catch (error) {
        console.error(
          'ERREUR ENVOI VOCAL :',
          error,
        );
      } finally {
        setIsSending(false);
      }
    }, [
      isRecording,
      isSending,
      recordingDuration,
      recordingUri,
      loadMessages,
    ]);
  // ===================================================
  // AFFICHAGE MESSAGE
  // ===================================================

  const renderMessage = (
    item: ExchangeMessage,
  ) => {
    const isMine =
      item.sender === 'user';

    return (
      <View
        key={item.id}
        style={[
          styles.messageRow,
          isMine
            ? styles.messageRowMine
            : styles.messageRowAdmin,
        ]}
      >
        <View
          style={[
            styles.messageBubble,
            isMine
              ? styles.messageBubbleMine
              : styles.messageBubbleAdmin,
          ]}
        >
          {item.type === 'text' && (
            <Text
              style={[
                styles.messageText,
                isMine
                  ? styles.messageTextMine
                  : styles.messageTextAdmin,
              ]}
            >
              {item.message}
            </Text>
          )}

          {item.type === 'audio' &&
            item.audioUri && (
              <AudioMessage
                uri={item.audioUri}
                duration={
                  item.duration
                }
                isMine={isMine}
              />
            )}

          <Text
            style={[
              styles.messageTime,
              isMine
                ? styles.messageTimeMine
                : styles.messageTimeAdmin,
            ]}
          >
            {item.createdAt}
          </Text>
        </View>
      </View>
    );
  };

  // ===================================================
  // ZONE DE SAISIE
  // ===================================================

  const renderInputArea = () => {
    if (isRecording) {
      return (
        <View
          style={
            styles.recordingBar
          }
        >
          <View
            style={
              styles.recordingLeft
            }
          >
            <View
              style={
                styles.recordingIndicator
              }
            />

            <Text
              style={
                styles.recordingText
              }
            >
              Enregistrement...
            </Text>

            <Text
              style={
                styles.recordingDuration
              }
            >
              {formatDuration(
                recordingDuration,
              )}
            </Text>
          </View>

          <View
            style={
              styles.recordingActions
            }
          >
            <Pressable
              style={
                styles.cancelRecordingButton
              }
              onPress={
                cancelRecording
              }
              disabled={isSending}
            >
              <Text
                style={
                  styles.cancelRecordingText
                }
              >
                Annuler
              </Text>
            </Pressable>

            <Pressable
              style={
                styles.stopRecordingButton
              }
              onPress={
                stopRecording
              }
              disabled={isSending}
              accessibilityRole="button"
              accessibilityLabel="Terminer le vocal"
            >
              <View
                style={
                  styles.stopRecordingSquare
                }
              />
            </Pressable>
          </View>
        </View>
      );
    }

    if (recordingUri) {
      return (
        <View
          style={
            styles.voicePreview
          }
        >
          <View
            style={
              styles.previewAudio
            }
          >
            <AudioMessage
              uri={recordingUri}
              duration={
                recordingDuration
              }
              isMine
            />
          </View>

          <View
            style={
              styles.voicePreviewActions
            }
          >
            <Pressable
              style={
                styles.deleteVoiceButton
              }
              onPress={
                deleteRecordingPreview
              }
              disabled={isSending}
              accessibilityRole="button"
              accessibilityLabel="Supprimer le vocal"
            >
              <Text
                style={
                  styles.deleteVoiceText
                }
              >
                🗑
              </Text>
            </Pressable>

            <Pressable
              style={[
                styles.sendVoiceButton,
                isSending &&
                  styles.buttonDisabled,
              ]}
              onPress={
                sendRecording
              }
              disabled={isSending}
              accessibilityRole="button"
              accessibilityLabel="Envoyer le vocal"
            >
              {isSending ? (
                <ActivityIndicator
                  size="small"
                  color="#FFFFFF"
                />
              ) : (
                <Text
                  style={
                    styles.sendVoiceIcon
                  }
                >
                  ➤
                </Text>
              )}
            </Pressable>
          </View>
        </View>
      );
    }

    return (
      <View
        style={styles.inputWrapper}
      >
        <TextInput
          style={styles.input}
          value={message}
          onChangeText={
            setMessage
          }
          placeholder="Écrire un message..."
          placeholderTextColor="#777777"
          multiline
          maxLength={2000}
          textAlignVertical="center"
          editable={!isSending}
          onSubmitEditing={() => {
            if (
              Platform.OS === 'ios'
            ) {
              handleSendMessage();
            }
          }}
        />

        <Pressable
          style={[
            styles.microphoneButton,
            !microphoneAvailable &&
              styles.microphoneButtonWarning,
            isPreparingRecording &&
              styles.buttonDisabled,
          ]}
          onPress={
            startRecording
          }
          disabled={
            isSending ||
            isPreparingRecording
          }
          hitSlop={5}
          accessibilityRole="button"
          accessibilityLabel="Enregistrer un message vocal"
        >
          {isPreparingRecording ? (
            <ActivityIndicator
              size="small"
              color="#FFFFFF"
            />
          ) : (
            <Text
              style={
                styles.microphoneIcon
              }
            >
              🎙️
            </Text>
          )}
        </Pressable>

        <Pressable
          style={[
            styles.sendButton,
            (!message.trim() ||
              isSending) &&
              styles.sendButtonDisabled,
          ]}
          onPress={
            handleSendMessage
          }
          disabled={
            !message.trim() ||
            isSending
          }
          hitSlop={5}
          accessibilityRole="button"
          accessibilityLabel="Envoyer le message"
        >
          {isSending ? (
            <ActivityIndicator
              size="small"
              color="#FFFFFF"
            />
          ) : (
            <Text
              style={
                styles.sendIcon
              }
            >
              ➤
            </Text>
          )}
        </Pressable>
      </View>
    );
  };

  // ===================================================
  // INTERFACE
  // ===================================================

  return (
    <SafeAreaView
      style={styles.safeArea}
      edges={['top']}
    >
      <KeyboardAvoidingView
        style={
          styles.keyboardContainer
        }
        behavior={
          Platform.OS === 'ios'
            ? 'padding'
            : 'height'
        }
        keyboardVerticalOffset={
          Platform.OS === 'ios'
            ? 10
            : 0
        }
      >
        <View
          style={styles.header}
        >
          <View
            style={
              styles.headerLeft
            }
          >
            <View
              style={
                styles.headerIcon
              }
            >
              <Text
                style={
                  styles.headerIconText
                }
              >
                💬
              </Text>
            </View>

            <View>
              <Text
                style={
                  styles.headerTitle
                }
              >
                Échanges
              </Text>

              <Text
                style={
                  styles.headerSubtitle
                }
              >
                Assistance ScorpionTV
              </Text>
            </View>
          </View>

          <View
            style={
              styles.headerRight
            }
          >
            <NotificationBell />

            <Pressable
              style={
                styles.menuButton
              }
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Options des échanges"
              onPress={() => {
                console.log(
                  'OPTIONS ÉCHANGES : À CONFIGURER',
                );
              }}
            >
              <Text
                style={
                  styles.menuIcon
                }
              >
                ⋮
              </Text>
            </Pressable>
          </View>
        </View>

        <ScrollView
          ref={scrollViewRef}
          style={
            styles.messagesContainer
          }
          contentContainerStyle={[
            styles.messagesContent,
            {
              paddingBottom:
                bottomTabSpace + 20,
            },
          ]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={
            Platform.OS === 'ios'
              ? 'interactive'
              : 'on-drag'
          }
          showsVerticalScrollIndicator={
            false
          }
        >
          {isLoadingMessages ? (
            <View
              style={
                styles.loadingState
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
                Chargement des échanges...
              </Text>
            </View>
          ) : messages.length ===
            0 ? (
            <View
              style={
                styles.emptyState
              }
            >
              <View
                style={
                  styles.emptyIconCircle
                }
              >
                <Text
                  style={
                    styles.emptyIcon
                  }
                >
                  ⇄
                </Text>
              </View>

              <Text
                style={
                  styles.emptyTitle
                }
              >
                Échanges
              </Text>

              <Text
                style={
                  styles.emptyDescription
                }
              >
                Envoyez-nous un message.
                {'\n'}
                Notre équipe vous répondra ici.
              </Text>
            </View>
          ) : (
            <View
              style={
                styles.messagesList
              }
            >
              <View
                style={
                  styles.conversationInfo
                }
              >
                <View
                  style={
                    styles.supportIcon
                  }
                >
                  <Text
                    style={
                      styles.supportIconText
                    }
                  >
                    S
                  </Text>
                </View>

                <View
                  style={
                    styles.supportInfo
                  }
                >
                  <Text
                    style={
                      styles.supportTitle
                    }
                  >
                    Équipe ScorpionTV
                  </Text>

                  <Text
                    style={
                      styles.supportSubtitle
                    }
                  >
                    Assistance ScorpionTV
                  </Text>
                </View>
              </View>

              {messages.map(
                renderMessage,
              )}
            </View>
          )}
        </ScrollView>

        <View
          style={[
            styles.inputArea,
            {
              marginBottom:
                bottomTabSpace,
            },
          ]}
        >
          {renderInputArea()}

          {isPreparingRecording && (
            <View
              style={
                styles.preparingOverlay
              }
            >
              <ActivityIndicator
                size="small"
                color="#E50914"
              />

              <Text
                style={
                  styles.preparingText
                }
              >
                Préparation du microphone...
              </Text>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#080808',
  },

  keyboardContainer: {
    flex: 1,
    backgroundColor: '#080808',
  },

  header: {
    height: 68,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#151515',
  },

  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },

  headerIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#151515',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 11,
  },

  headerIconText: {
    fontSize: 20,
  },

  headerTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
  },

  headerSubtitle: {
    color: '#777777',
    fontSize: 12,
    marginTop: 2,
  },

  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  menuButton: {
    width: 40,
    height: 42,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 5,
  },

  menuIcon: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '700',
    lineHeight: 32,
  },

  messagesContainer: {
    flex: 1,
  },

  messagesContent: {
    flexGrow: 1,
    paddingHorizontal: 14,
  },

  loadingState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 30,
  },

  loadingText: {
    color: '#777777',
    fontSize: 14,
    marginTop: 12,
  },

  messagesList: {
    paddingTop: 14,
  },

  conversationInfo: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 8,
    paddingBottom: 20,
  },

  supportIcon: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#E50914',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },

  supportIconText: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '900',
  },

  supportInfo: {
    alignItems: 'center',
  },

  supportTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },

  supportSubtitle: {
    color: '#777777',
    fontSize: 12,
    marginTop: 3,
  },

  messageRow: {
    width: '100%',
    marginBottom: 10,
    flexDirection: 'row',
  },

  messageRowMine: {
    justifyContent: 'flex-end',
  },

  messageRowAdmin: {
    justifyContent: 'flex-start',
  },

  messageBubble: {
    maxWidth: '82%',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingTop: 11,
    paddingBottom: 7,
  },

  messageBubbleMine: {
    backgroundColor: '#E50914',
    borderBottomRightRadius: 5,
  },

  messageBubbleAdmin: {
    backgroundColor: '#171717',
    borderWidth: 1,
    borderColor: '#292929',
    borderBottomLeftRadius: 5,
  },

  messageText: {
    fontSize: 15,
    lineHeight: 21,
  },

  messageTextMine: {
    color: '#FFFFFF',
  },

  messageTextAdmin: {
    color: '#EEEEEE',
  },

  messageTime: {
    fontSize: 10,
    marginTop: 5,
    alignSelf: 'flex-end',
  },

  messageTimeMine: {
    color: 'rgba(255,255,255,0.7)',
  },

  messageTimeAdmin: {
    color: '#777777',
  },

  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 30,
  },

  emptyIconCircle: {
    width: 82,
    height: 82,
    borderRadius: 41,
    backgroundColor: '#151515',
    borderWidth: 1,
    borderColor: '#292929',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 18,
  },

  emptyIcon: {
    color: '#E50914',
    fontSize: 42,
    fontWeight: '600',
  },

  emptyTitle: {
    color: '#FFFFFF',
    fontSize: 25,
    fontWeight: '800',
  },

  emptyDescription: {
    color: '#777777',
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginTop: 10,
  },

  inputArea: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 10,
    backgroundColor: '#080808',
    borderTopWidth: 1,
    borderTopColor: '#151515',
  },

  inputWrapper: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: '#151515',
    borderWidth: 1,
    borderColor: '#292929',
    borderRadius: 27,
    paddingLeft: 16,
    paddingRight: 6,
    paddingVertical: 5,
  },

  input: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 15,
    minHeight: 42,
    maxHeight: 110,
    paddingTop: 9,
    paddingBottom: 9,
    paddingRight: 6,
  },

  microphoneButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 2,
  },

  microphoneButtonWarning: {
    borderWidth: 1,
    borderColor: '#555555',
  },

  microphoneIcon: {
    fontSize: 21,
  },

  sendButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#E50914',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 3,
  },

  sendButtonDisabled: {
    opacity: 0.35,
  },

  sendIcon: {
    color: '#FFFFFF',
    fontSize: 21,
    fontWeight: '800',
    marginLeft: -2,
    marginTop: -1,
  },

  buttonDisabled: {
    opacity: 0.5,
  },

  recordingBar: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#151515',
    borderWidth: 1,
    borderColor: '#E50914',
    borderRadius: 27,
    paddingHorizontal: 12,
  },

  recordingLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 0,
  },

  recordingIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#E50914',
    marginRight: 9,
  },

  recordingText: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },

  recordingDuration: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    marginLeft: 8,
    marginRight: 5,
    fontVariant: ['tabular-nums'],
  },

  recordingActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },

  cancelRecordingButton: {
    paddingVertical: 7,
    paddingHorizontal: 5,
  },

  cancelRecordingText: {
    color: '#E50914',
    fontSize: 12,
    fontWeight: '700',
  },

  stopRecordingButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E50914',
    justifyContent: 'center',
    alignItems: 'center',
  },

  stopRecordingSquare: {
    width: 14,
    height: 14,
    borderRadius: 3,
    backgroundColor: '#FFFFFF',
  },

  voicePreview: {
    backgroundColor: '#151515',
    borderWidth: 1,
    borderColor: '#292929',
    borderRadius: 20,
    padding: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },

  previewAudio: {
    flex: 1,
    minWidth: 0,
  },

  voicePreviewActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
  },

  deleteVoiceButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#242424',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 6,
  },

  deleteVoiceText: {
    fontSize: 17,
  },

  sendVoiceButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#E50914',
    justifyContent: 'center',
    alignItems: 'center',
  },

  sendVoiceIcon: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
    marginLeft: -2,
  },

  audioMessage: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 0,
  },

  audioPlayButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#E50914',
    justifyContent: 'center',
    alignItems: 'center',
  },

  audioPlayButtonMine: {
    backgroundColor: '#FFFFFF',
  },

  audioPlayIcon: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
  },

  audioPlayIconMine: {
    color: '#E50914',
  },

  audioContent: {
    flex: 1,
    marginLeft: 10,
    minWidth: 0,
  },

  audioWave: {
    height: 38,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },

  audioBar: {
    width: 3,
    borderRadius: 2,
    backgroundColor: '#AAAAAA',
  },

  audioDuration: {
    color: '#999999',
    fontSize: 10,
    marginTop: 2,
  },

  audioDurationMine: {
    color: 'rgba(255,255,255,0.75)',
  },

  preparingOverlay: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 7,
  },

  preparingText: {
    color: '#777777',
    fontSize: 12,
    marginLeft: 8,
  },
});
