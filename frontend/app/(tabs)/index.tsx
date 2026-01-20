import React, { useEffect, useState, useCallback } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  ScrollView, 
  TouchableOpacity, 
  Alert, 
  ActivityIndicator, 
  Image,
  RefreshControl,
  SafeAreaView,
  Platform,
  Modal
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as ImagePicker from 'expo-image-picker';
import Svg, { Circle } from 'react-native-svg';
import { Check, Camera, RotateCcw, AlertTriangle } from 'lucide-react-native';
import Constants from 'expo-constants';

// Backend URL Setup
const BACKEND_URL = Constants.expoConfig?.extra?.backendUrl || process.env.EXPO_PUBLIC_BACKEND_URL || "";
const API_URL = `${BACKEND_URL}/api`;

const COLORS = {
  primary: '#000000',
  secondary: '#333333',
  accent: '#4ADE80', // Green
  danger: '#EF4444',
  background: '#F5F5F5',
  card: '#FFFFFF',
  text: '#1F2937',
  textLight: '#6B7280',
  border: '#E5E7EB'
};

const TASKS_CONFIG = [
  { id: 'diet', label: 'Follow Diet', sub: 'No cheat meals' },
  { id: 'workout_1', label: 'Workout 1', sub: '45 mins (Indoor/Outdoor)' },
  { id: 'workout_2', label: 'Workout 2', sub: '45 mins (Must be different)' },
  { id: 'water', label: 'Drink Water', sub: '1 Gallon' },
  { id: 'reading', label: 'Read 10 Pages', sub: 'Non-fiction only' },
  { id: 'no_alcohol', label: 'No Alcohol', sub: 'Zero tolerance' },
];

export default function TodayScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [log, setLog] = useState<any>(null);
  const [dayNumber, setDayNumber] = useState(1);
  const [isCompleted, setIsCompleted] = useState(false);
  
  // Custom Modal State
  const [showResetModal, setShowResetModal] = useState(false);

  const fetchTodayLog = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/today`);
      const data = await response.json();
      setLog(data);
      setDayNumber(data.day_number);
      setIsCompleted(data.is_completed);
    } catch (error) {
      console.error("Error fetching log:", error);
      Alert.alert("Error", "Failed to load today's log. Check connection.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchTodayLog();
  }, [fetchTodayLog]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchTodayLog();
  }, [fetchTodayLog]);

  const toggleTask = async (taskId: string) => {
    if (!log) return;
    if (isCompleted) return; 

    const currentVal = log.tasks[taskId];
    const newVal = !currentVal;

    // Optimistic Update
    const newTasks = { ...log.tasks, [taskId]: newVal };
    setLog({ ...log, tasks: newTasks });

    try {
      await fetch(`${API_URL}/log/task`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task_id: taskId, completed: newVal }),
      });
    } catch (error) {
      console.error("Error updating task:", error);
      setLog({ ...log, tasks: { ...log.tasks, [taskId]: currentVal } });
      Alert.alert("Error", "Failed to update task.");
    }
  };

  const pickImage = async () => {
    if (isCompleted) return;

    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [3, 4],
      quality: 0.5,
      base64: true,
    });

    if (!result.canceled && result.assets && result.assets[0].base64) {
      const base64Img = result.assets[0].base64;
      
      setLog({ 
        ...log, 
        photo_base64: base64Img, 
        tasks: { ...log.tasks, photo_logged: true } 
      });

      try {
        await fetch(`${API_URL}/log/photo`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image_base64: base64Img }),
        });
      } catch (error) {
        console.error("Upload error:", error);
        Alert.alert("Error", "Failed to upload photo.");
      }
    }
  };

  const completeDay = async () => {
    try {
      const response = await fetch(`${API_URL}/complete_day`, {
        method: 'POST',
      });
      const res = await response.json();
      
      if (response.ok) {
        setIsCompleted(true);
        Alert.alert("CONGRATULATIONS!", `Day ${dayNumber} Complete!`);
      } else {
        Alert.alert("Incomplete", res.detail || "Finish all tasks first!");
      }
    } catch (error) {
      Alert.alert("Error", "Failed to complete day.");
    }
  };

  // --- FIXED RESET LOGIC ---
  const confirmReset = async () => {
    try {
      await fetch(`${API_URL}/reset`, { method: 'POST' });
      fetchTodayLog(); 
      setShowResetModal(false);
      
      if (Platform.OS === 'web') {
        window.alert("Challenge has been reset to Day 1.");
      } else {
        Alert.alert("Reset Complete", "Challenge has been reset to Day 1.");
      }
    } catch (e) {
      console.error("Reset error:", e);
      Alert.alert("Error", "Could not reset.");
    }
  };

  const handleResetPress = () => {
    setShowResetModal(true);
  };

  const allTasksDone = log && 
    TASKS_CONFIG.every(t => log.tasks[t.id]) && 
    log.tasks.photo_logged;

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>75 HARD</Text>
          <Text style={styles.subtitle}>TRACKER</Text>
        </View>

        {/* Progress Ring */}
        <View style={styles.ringContainer}>
          <Svg height="200" width="200" viewBox="0 0 200 200">
            <Circle
              cx="100"
              cy="100"
              r="80"
              stroke="#E5E7EB"
              strokeWidth="15"
              fill="none"
            />
            <Circle
              cx="100"
              cy="100"
              r="80"
              stroke={COLORS.primary}
              strokeWidth="15"
              fill="none"
              strokeDasharray={`${2 * Math.PI * 80}`}
              strokeDashoffset={`${2 * Math.PI * 80 * (1 - dayNumber / 75)}`}
              strokeLinecap="round"
              rotation="-90"
              origin="100, 100"
            />
          </Svg>
          <View style={styles.ringTextContainer}>
            <Text style={styles.dayLabel}>DAY</Text>
            <Text style={styles.dayNumber}>{dayNumber}</Text>
            <Text style={styles.dayTotal}>of 75</Text>
          </View>
        </View>

        {/* Status Banner */}
        {isCompleted && (
          <View style={styles.completedBanner}>
            <Check color="white" size={24} />
            <Text style={styles.completedText}>DAY COMPLETE</Text>
          </View>
        )}

        {/* Checklist */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>DAILY TASKS</Text>
          {TASKS_CONFIG.map((task) => {
            const isDone = log?.tasks[task.id];
            return (
              <TouchableOpacity 
                key={task.id} 
                style={[styles.taskRow, isDone && styles.taskRowDone]} 
                onPress={() => toggleTask(task.id)}
                disabled={isCompleted}
              >
                <View style={[styles.checkbox, isDone && styles.checkboxChecked]}>
                  {isDone && <Check size={16} color="white" />}
                </View>
                <View style={styles.taskTextContainer}>
                  <Text style={[styles.taskLabel, isDone && styles.taskLabelDone]}>{task.label}</Text>
                  <Text style={styles.taskSub}>{task.sub}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Reset Modal Implementation */}
        <Modal
          animationType="fade"
          transparent={true}
          visible={showResetModal}
          onRequestClose={() => setShowResetModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <AlertTriangle color={COLORS.danger} size={32} />
                <Text style={styles.modalTitle}>Reset Challenge?</Text>
              </View>
              <Text style={styles.modalText}>
                This will set you back to Day 1. Are you sure you failed?
              </Text>
              <View style={styles.modalButtons}>
                <TouchableOpacity 
                  style={[styles.modalButton, styles.cancelButton]}
                  onPress={() => setShowResetModal(false)}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.modalButton, styles.confirmButton]}
                  onPress={confirmReset}
                >
                  <Text style={styles.confirmButtonText}>Yes, I Failed</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Photo Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>PROGRESS PHOTO</Text>
          <TouchableOpacity 
            style={styles.photoContainer} 
            onPress={pickImage}
            disabled={isCompleted}
          >
            {log?.photo_base64 ? (
              <Image 
                source={{ uri: `data:image/jpeg;base64,${log.photo_base64}` }} 
                style={styles.photo} 
              />
            ) : (
              <View style={styles.photoPlaceholder}>
                <Camera size={40} color={COLORS.textLight} />
                <Text style={styles.photoText}>Tap to Upload</Text>
              </View>
            )}
            {log?.tasks?.photo_logged && !isCompleted && (
               <View style={styles.retakeBadge}>
                 <Text style={styles.retakeText}>Tap to Retake</Text>
               </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Complete Button */}
        <TouchableOpacity 
          style={[
            styles.completeButton, 
            (!allTasksDone || isCompleted) && styles.completeButtonDisabled
          ]}
          onPress={completeDay}
          disabled={!allTasksDone || isCompleted}
        >
          <Text style={styles.completeButtonText}>
            {isCompleted ? "COMPLETED" : "COMPLETE DAY"}
          </Text>
        </TouchableOpacity>

        {/* Reset Button */}
        <TouchableOpacity style={styles.resetButton} onPress={handleResetPress}>
          <RotateCcw size={16} color={COLORS.danger} style={{marginRight: 6}} />
          <Text style={styles.resetText}>Reset Challenge</Text>
        </TouchableOpacity>

        <View style={{height: 40}} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    padding: 20,
    paddingTop: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 30,
  },
  title: {
    fontSize: 32,
    fontWeight: '900',
    color: COLORS.primary,
    letterSpacing: 2,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textLight,
    letterSpacing: 4,
  },
  ringContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 40,
  },
  ringTextContainer: {
    position: 'absolute',
    alignItems: 'center',
  },
  dayLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textLight,
  },
  dayNumber: {
    fontSize: 48,
    fontWeight: '900',
    color: COLORS.primary,
  },
  dayTotal: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textLight,
  },
  section: {
    marginBottom: 30,
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: 15,
    letterSpacing: 1,
  },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  taskRowDone: {
    opacity: 0.5,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: COLORS.textLight,
    marginRight: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: COLORS.accent,
    borderColor: COLORS.accent,
  },
  taskTextContainer: {
    flex: 1,
  },
  taskLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  taskLabelDone: {
    textDecorationLine: 'line-through',
  },
  taskSub: {
    fontSize: 12,
    color: COLORS.textLight,
    marginTop: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '80%',
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 25,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: 15,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.text,
    marginTop: 10,
    textAlign: 'center',
  },
  modalText: {
    fontSize: 16,
    color: COLORS.textLight,
    textAlign: 'center',
    marginBottom: 25,
    lineHeight: 22,
  },
  modalButtons: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'space-between',
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: COLORS.background,
    marginRight: 10,
  },
  confirmButton: {
    backgroundColor: COLORS.danger,
    marginLeft: 10,
  },
  cancelButtonText: {
    color: COLORS.text,
    fontWeight: '600',
    fontSize: 16,
  },
  confirmButtonText: {
    color: 'white',
    fontWeight: '700',
    fontSize: 16,
  },
  photoContainer: {
    height: 200,
    backgroundColor: COLORS.background,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: COLORS.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  photoPlaceholder: {
    alignItems: 'center',
  },
  photoText: {
    marginTop: 10,
    color: COLORS.textLight,
    fontWeight: '600',
  },
  photo: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  retakeBadge: {
    position: 'absolute',
    bottom: 10,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  retakeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  completeButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },
  completeButtonDisabled: {
    backgroundColor: COLORS.textLight,
    opacity: 0.7,
    shadowOpacity: 0,
  },
  completeButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 1,
  },
  completedBanner: {
    backgroundColor: COLORS.accent,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 15,
    borderRadius: 12,
    marginBottom: 30,
  },
  completedText: {
    color: 'white',
    fontWeight: '800',
    marginLeft: 10,
    fontSize: 16,
  },
  resetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
  },
  resetText: {
    color: COLORS.danger,
    fontWeight: '600',
  },
});
