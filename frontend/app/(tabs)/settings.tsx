import React, { useEffect, useState, useCallback } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  ScrollView, 
  TouchableOpacity, 
  Switch, 
  Modal, 
  TextInput, 
  ActivityIndicator,
  Alert,
  FlatList
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { 
  Plus, 
  Trash2, 
  X, 
  Utensils, 
  Dumbbell, 
  Droplets, 
  BookOpen, 
  Ban, 
  CircleCheck,
  Moon,
  Sun,
  Star,
  Heart,
  Music,
  Smile,
  Zap,
  Coffee,
  Briefcase
} from 'lucide-react-native';
import Constants from 'expo-constants';

const BACKEND_URL = Constants.expoConfig?.extra?.backendUrl || process.env.EXPO_PUBLIC_BACKEND_URL || "";
const API_URL = `${BACKEND_URL}/api`;

const COLORS = {
  primary: '#000000',
  secondary: '#333333',
  accent: '#4ADE80',
  danger: '#EF4444',
  background: '#F5F5F5',
  card: '#FFFFFF',
  text: '#1F2937',
  textLight: '#9CA3AF',
  border: '#E5E7EB',
};

// Available Icons for selection
const ICON_MAP: Record<string, any> = {
  Utensils, Dumbbell, Droplets, BookOpen, Ban, CircleCheck,
  Moon, Sun, Star, Heart, Music, Smile, Zap, Coffee, Briefcase
};

const AVAILABLE_ICONS = Object.keys(ICON_MAP);

export default function SettingsScreen() {
  const [challenges, setChallenges] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modal State
  const [modalVisible, setModalVisible] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newSubtitle, setNewSubtitle] = useState("");
  const [selectedIcon, setSelectedIcon] = useState("CircleCheck");

  useEffect(() => {
    fetchChallenges();
  }, []);

  const fetchChallenges = async () => {
    try {
      const response = await fetch(`${API_URL}/challenges`);
      const data = await response.json();
      setChallenges(data);
    } catch (error) {
      console.error(error);
      Alert.alert("Error", "Failed to load challenges");
    } finally {
      setLoading(false);
    }
  };

  const toggleChallenge = async (id: string, currentValue: boolean) => {
    // Optimistic update
    const updated = challenges.map(c => 
      c.id === id ? { ...c, is_active: !currentValue } : c
    );
    setChallenges(updated);

    try {
      await fetch(`${API_URL}/challenges/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !currentValue })
      });
    } catch (error) {
      console.error(error);
      Alert.alert("Error", "Failed to update challenge");
      // Revert
      fetchChallenges();
    }
  };

  const deleteChallenge = async (id: string) => {
    Alert.alert(
      "Delete Challenge",
      "Are you sure? This will remove it from your daily tracking.",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Delete", 
          style: "destructive",
          onPress: async () => {
            const updated = challenges.filter(c => c.id !== id);
            setChallenges(updated);
            try {
              await fetch(`${API_URL}/challenges/${id}`, { method: 'DELETE' });
            } catch (e) {
              fetchChallenges();
            }
          }
        }
      ]
    );
  };

  const addChallenge = async () => {
    if (!newTitle.trim()) {
      Alert.alert("Required", "Please enter a title");
      return;
    }

    const newChallenge = {
      label: newTitle,
      sub: newSubtitle,
      icon: selectedIcon,
      is_active: true
    };

    try {
      const response = await fetch(`${API_URL}/challenges`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newChallenge)
      });
      
      if (response.ok) {
        setModalVisible(false);
        setNewTitle("");
        setNewSubtitle("");
        setSelectedIcon("CircleCheck");
        fetchChallenges();
      } else {
        const err = await response.json();
        Alert.alert("Error", err.detail || "Failed to create");
      }
    } catch (error) {
      Alert.alert("Error", "Network error");
    }
  };

  const renderIcon = (iconName: string, size = 24, color = COLORS.text) => {
    const IconComponent = ICON_MAP[iconName] || CircleCheck;
    return <IconComponent size={size} color={color} />;
  };

  if (loading) {
    return <ActivityIndicator size="large" color={COLORS.primary} style={styles.center} />;
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Manage Challenges</Text>
        <TouchableOpacity style={styles.addButton} onPress={() => setModalVisible(true)}>
          <Plus color="white" size={24} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.list}>
        {challenges.map((item) => (
          <View key={item.id} style={styles.card}>
            <View style={styles.cardLeft}>
              <View style={styles.iconContainer}>
                {renderIcon(item.icon, 20, COLORS.primary)}
              </View>
              <View>
                <Text style={styles.cardTitle}>{item.label}</Text>
                {item.sub ? <Text style={styles.cardSub}>{item.sub}</Text> : null}
              </View>
            </View>
            <View style={styles.cardRight}>
              <Switch
                trackColor={{ false: '#E5E7EB', true: COLORS.accent }}
                thumbColor={'white'}
                onValueChange={() => toggleChallenge(item.id, item.is_active)}
                value={item.is_active}
              />
              <TouchableOpacity 
                onPress={() => deleteChallenge(item.id)}
                style={styles.deleteButton}
              >
                <Trash2 size={18} color={COLORS.textLight} />
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </ScrollView>

      {/* Add Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>New Challenge</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <X size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Title</Text>
              <TextInput 
                style={styles.input} 
                placeholder="e.g. Meditate" 
                value={newTitle}
                onChangeText={setNewTitle}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Subtitle (Optional)</Text>
              <TextInput 
                style={styles.input} 
                placeholder="e.g. 10 mins daily" 
                value={newSubtitle}
                onChangeText={setNewSubtitle}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Icon</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.iconSelector}>
                {AVAILABLE_ICONS.map(icon => (
                  <TouchableOpacity 
                    key={icon} 
                    style={[
                      styles.iconOption, 
                      selectedIcon === icon && styles.iconOptionSelected
                    ]}
                    onPress={() => setSelectedIcon(icon)}
                  >
                    {renderIcon(icon, 20, selectedIcon === icon ? 'white' : COLORS.text)}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            <TouchableOpacity style={styles.createButton} onPress={addChallenge}>
              <Text style={styles.createButtonText}>Create Challenge</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: COLORS.primary,
  },
  addButton: {
    backgroundColor: COLORS.primary,
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  list: {
    paddingBottom: 40,
  },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  cardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  cardRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 15,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
  },
  cardSub: {
    fontSize: 12,
    color: COLORS.textLight,
  },
  deleteButton: {
    padding: 5,
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.text,
  },
  formGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  iconSelector: {
    flexDirection: 'row',
    height: 50,
  },
  iconOption: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  iconOptionSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  createButton: {
    backgroundColor: COLORS.primary,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  createButtonText: {
    color: 'white',
    fontWeight: '700',
    fontSize: 16,
  },
});
