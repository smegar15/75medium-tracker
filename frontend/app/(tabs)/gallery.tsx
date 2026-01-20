import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, ScrollView, Image, ActivityIndicator, Dimensions } from 'react-native';
import Constants from 'expo-constants';
import { SafeAreaView } from 'react-native-safe-area-context';

const BACKEND_URL = Constants.expoConfig?.extra?.backendUrl || process.env.EXPO_PUBLIC_BACKEND_URL || "";
const API_URL = `${BACKEND_URL}/api`;

const COLORS = {
  primary: '#000000',
  background: '#F5F5F5',
  text: '#1F2937',
};

const { width } = Dimensions.get('window');
const IMAGE_SIZE = width / 3 - 10; // 3 columns with gap

export default function GalleryScreen() {
  const [photos, setPhotos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPhotos();
  }, []);

  const fetchPhotos = async () => {
    try {
      const response = await fetch(`${API_URL}/photos`);
      const data = await response.json();
      setPhotos(data);
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
      <Text style={styles.title}>Progress Gallery</Text>
      <ScrollView contentContainerStyle={styles.grid}>
        {photos.map((item, index) => (
          <View key={index} style={styles.imageContainer}>
            <Image 
              source={{ uri: `data:image/jpeg;base64,${item.photo_base64}` }} 
              style={styles.image} 
            />
            <View style={styles.labelBadge}>
              <Text style={styles.labelText}>Day {item.day_number}</Text>
            </View>
          </View>
        ))}
        {photos.length === 0 && (
           <Text style={styles.emptyText}>No photos uploaded yet.</Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    padding: 10,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    margin: 10,
    marginBottom: 20,
    color: COLORS.text,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  imageContainer: {
    width: IMAGE_SIZE,
    height: IMAGE_SIZE,
    margin: 5,
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#DDD',
  },
  image: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  labelBadge: {
    position: 'absolute',
    bottom: 5,
    right: 5,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  labelText: {
    color: 'white',
    fontSize: 10,
    fontWeight: '700',
  },
  emptyText: {
    width: '100%',
    textAlign: 'center',
    marginTop: 50,
    color: '#6B7280',
  }
});
