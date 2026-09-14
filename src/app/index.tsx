import { Pressable, StyleSheet, Text, ToastAndroid, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { initDatabase } from '../database/database';

export default function HomeScreen() {
useEffect(() => {
initDatabase()
.then(() => {
console.log('SQLite ScorpionTV OK');
})
.catch((error) => {
console.error('Erreur SQLite :', error);
});
}, []);

const handleM3U = () => {
ToastAndroid.show(
'La prise en charge des listes M3U sera bientôt disponible.',
ToastAndroid.SHORT
);
};

return (
<SafeAreaView style={styles.container}>
<View style={styles.header}>
<Text style={styles.logo}>SCORPION</Text>
<Text style={styles.subtitle}>TV</Text>
</View>

  <View style={styles.content}>
    <Text style={styles.welcome}>Bienvenue</Text>

    <Text style={styles.description}>
      Retrouvez tous vos contenus au même endroit
    </Text>

    <View style={styles.menu}>

      <Pressable
        style={({ pressed }) => [
          styles.card,
          pressed && styles.cardPressed,
        ]}
        onPress={() => router.push('/live')}
      >
        <Text style={styles.icon}>📺</Text>

        <Text style={styles.cardTitle}>
          Live TV
        </Text>

        <Text style={styles.cardDescription}>
          Regardez vos chaînes en direct
        </Text>
      </Pressable>

      <Pressable
        style={({ pressed }) => [
          styles.card,
          pressed && styles.cardPressed,
        ]}
        onPress={() => router.push('/movies')}
      >
        <Text style={styles.icon}>🎬</Text>

        <Text style={styles.cardTitle}>
          Films
        </Text>

        <Text style={styles.cardDescription}>
          Découvrez vos films préférés
        </Text>
      </Pressable>

      <Pressable
        style={({ pressed }) => [
          styles.card,
          pressed && styles.cardPressed,
        ]}
        onPress={() => router.push('/series')}
      >
        <Text style={styles.icon}>📚</Text>

        <Text style={styles.cardTitle}>
          Séries
        </Text>

        <Text style={styles.cardDescription}>
          Retrouvez vos séries et épisodes
        </Text>
      </Pressable>

      <Pressable
        style={({ pressed }) => [
          styles.card,
          styles.m3uCard,
          pressed && styles.cardPressed,
        ]}
        onPress={handleM3U}
      >
        <Text style={styles.icon}>📡</Text>

        <View style={styles.m3uTitleRow}>
          <Text style={styles.cardTitle}>
            M3U TV
          </Text>

          <View style={styles.comingSoon}>
            <Text style={styles.comingSoonText}>
              BIENTÔT
            </Text>
          </View>
        </View>

        <Text style={styles.cardDescription}>
          Ajoutez vos propres listes M3U
        </Text>
      </Pressable>

    </View>
  </View>

  <Text style={styles.email}>
    scorpionhigt@gmail.com
  </Text>

  <Text style={styles.version}>
    ScorpionTV • v2.8.5 © 2026
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
paddingHorizontal: 24,
paddingTop: 20,
alignItems: 'center',
},

logo: {
color: '#FFFFFF',
fontSize: 30,
fontWeight: '900',
letterSpacing: 3,
},

subtitle: {
color: '#E50914',
fontSize: 18,
fontWeight: '800',
letterSpacing: 5,
marginTop: -4,
},

content: {
flex: 1,
justifyContent: 'center',
paddingHorizontal: 24,
},

welcome: {
color: '#FFFFFF',
fontSize: 32,
fontWeight: '800',
textAlign: 'center',
},

description: {
color: '#999999',
fontSize: 16,
textAlign: 'center',
marginTop: 8,
marginBottom: 28,
},

menu: {
gap: 12,
},

card: {
backgroundColor: '#151515',
borderRadius: 16,
padding: 18,
minHeight: 100,
justifyContent: 'center',
borderWidth: 1,
borderColor: '#252525',
},

m3uCard: {
borderColor: '#333333',
},

cardPressed: {
opacity: 0.75,
transform: [{ scale: 0.98 }],
},

icon: {
fontSize: 28,
marginBottom: 6,
},

cardTitle: {
color: '#FFFFFF',
fontSize: 20,
fontWeight: '800',
},

cardDescription: {
color: '#888888',
fontSize: 13,
marginTop: 4,
},

m3uTitleRow: {
flexDirection: 'row',
alignItems: 'center',
gap: 10,
},

comingSoon: {
backgroundColor: '#252525',
borderRadius: 6,
paddingHorizontal: 7,
paddingVertical: 3,
},

comingSoonText: {
color: '#E50914',
fontSize: 9,
fontWeight: '900',
},

email: {
color: '#555555',
textAlign: 'center',
marginBottom: 5,
fontSize: 11,
},

version: {
color: '#444444',
textAlign: 'center',
marginBottom: 15,
fontSize: 12,
},
});