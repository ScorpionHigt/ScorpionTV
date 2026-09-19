import {
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import NotificationBell from '../../components/NotificationBell';

export default function ExchangesScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>
          Échanges
        </Text>

        <NotificationBell />
      </View>

      <View style={styles.content}>
        <Text style={styles.icon}>
          ⇄
        </Text>

        <Text style={styles.title}>
          Échanges
        </Text>

        <Text style={styles.description}>
          Votre espace d'échanges arrivera bientôt.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#080808',
  },

  header: {
    height: 64,

    paddingHorizontal: 20,

    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  headerTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
  },

  content: {
    flex: 1,

    justifyContent: 'center',
    alignItems: 'center',

    paddingHorizontal: 30,
  },

  icon: {
    fontSize: 50,
    marginBottom: 20,
  },

  title: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '800',
  },

  description: {
    color: '#777777',
    fontSize: 15,
    textAlign: 'center',
    marginTop: 10,
  },
});
