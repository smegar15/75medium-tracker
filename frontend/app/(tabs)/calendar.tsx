import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, ScrollView, ActivityIndicator, Dimensions } from 'react-native';
import Constants from 'expo-constants';
import { SafeAreaView } from 'react-native-safe-area-context';

const BACKEND_URL = Constants.expoConfig?.extra?.backendUrl || process.env.EXPO_PUBLIC_BACKEND_URL || "";
const API_URL = `${BACKEND_URL}/api`;

const COLORS = {
  primary: '#000000',
  accent: '#4ADE80',
  danger: '#EF4444',
  background: '#F5F5F5',
  card: '#FFFFFF',
  text: '#1F2937',
  textLight: '#6B7280',
};

export default function CalendarScreen() {
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      const response = await fetch(`${API_URL}/history`);
      const data = await response.json();
      setHistory(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <ActivityIndicator size="large" color={COLORS.primary} style={styles.center} />;
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>History</Text>
      <ScrollView contentContainerStyle={styles.grid}>
        {history.map((day) => (
          <View 
            key={day.date} 
            style={[
              styles.dayCard, 
              day.is_completed ? styles.completedDay : styles.pendingDay
            ]}
          >
            <Text style={[
              styles.dayNumber,
              day.is_completed ? styles.textWhite : styles.textDark
            ]}>
              Day {day.day_number}
            </Text>
            <Text style={[
              styles.dateText,
              day.is_completed ? styles.textWhite : styles.textDark
            ]}>
              {day.date.slice(5)}
            </Text>
          </View>
        ))}
        {history.length === 0 && (
          <Text style={styles.emptyText}>No days logged yet.</Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    padding: 20,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 20,
    color: COLORS.text,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  dayCard: {
    width: '31%', // 3 columns
    aspectRatio: 1,
    borderRadius: 12,
    marginBottom: 10,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  completedDay: {
    backgroundColor: COLORS.accent,
  },
  pendingDay: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  dayNumber: {
    fontWeight: '800',
    fontSize: 16,
  },
  dateText: {
    fontSize: 12,
    marginTop: 4,
  },
  textWhite: {
    color: 'white',
  },
  textDark: {
    color: COLORS.text,
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 50,
    color: COLORS.textLight,
  }
});
