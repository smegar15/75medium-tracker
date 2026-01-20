import React, { useEffect, useState, useMemo } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  TouchableOpacity, 
  Modal, 
  ActivityIndicator, 
  Platform,
  Dimensions,
  ScrollView
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { 
  format, 
  addMonths, 
  subMonths, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  eachDayOfInterval, 
  isSameMonth, 
  isSameDay, 
  isAfter, 
  isBefore,
  startOfDay,
  subDays,
  parseISO
} from 'date-fns';
import { ChevronLeft, ChevronRight, X, Check, CircleX, RotateCcw, Calendar as CalendarIcon, Flame, Trophy, Activity } from 'lucide-react-native';
import Constants from 'expo-constants';

const BACKEND_URL = Constants.expoConfig?.extra?.backendUrl || process.env.EXPO_PUBLIC_BACKEND_URL || "";
const API_URL = `${BACKEND_URL}/api`;

const COLORS = {
  primary: '#000000',
  secondary: '#333333',
  accent: '#4ADE80', // Green
  danger: '#EF4444', // Red
  warning: '#F59E0B', // Orange
  info: '#3B82F6', // Blue
  background: '#F5F5F5',
  card: '#FFFFFF',
  text: '#1F2937',
  textLight: '#9CA3AF',
  border: '#E5E7EB',
  transparent: 'transparent'
};

const SCREEN_WIDTH = Dimensions.get('window').width;
const CELL_SIZE = (SCREEN_WIDTH - 40) / 7; // 7 days, 20px padding on each side

const TASKS_LABELS: Record<string, string> = {
  diet: 'Follow Diet',
  workout_1: 'Workout 1',
  workout_2: 'Workout 2',
  water: 'Drink Water',
  reading: 'Read 10 Pages',
  no_alcohol: 'No Alcohol',
  photo_logged: 'Progress Photo'
};

export default function CalendarScreen() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modal State
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

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

  // Convert history array to map for O(1) lookup
  const historyMap = useMemo(() => {
    const map: Record<string, any> = {};
    history.forEach(log => {
      map[log.date] = log;
    });
    return map;
  }, [history]);

  // Calculate Stats
  const stats = useMemo(() => {
    if (!history.length) return { streak: 0, totalWins: 0, successRate: 0 };

    // Total Wins
    const totalWins = history.filter(day => day.is_completed).length;
    
    // Success Rate
    const daysLogged = history.length;
    const successRate = daysLogged > 0 ? Math.round((totalWins / daysLogged) * 100) : 0;

    // Streak Calculation
    // Create a Set of completed dates strings for O(1) lookup
    const completedDates = new Set(
      history.filter(d => d.is_completed).map(d => d.date)
    );

    let streak = 0;
    const today = new Date();
    // Check up to 75 days back (max challenge length) or just generous amount
    for (let i = 0; i < 365; i++) {
      const dateToCheck = subDays(today, i);
      const dateStr = format(dateToCheck, 'yyyy-MM-dd');
      
      if (completedDates.has(dateStr)) {
        streak++;
      } else {
        // If it's Today and not complete, don't break streak yet (it's pending)
        // If it's Yesterday or before and not complete, break streak
        if (i === 0) {
          // Today is not complete, continue to check yesterday
          continue; 
        } else {
          // Past day incomplete -> streak over
          break;
        }
      }
    }

    return { streak, totalWins, successRate };
  }, [history, historyMap]);

  // Calendar Logic
  const generateCalendarDays = () => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart, { weekStartsOn: 1 }); // Monday start
    const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });

    return eachDayOfInterval({ start: startDate, end: endDate });
  };

  const calendarDays = generateCalendarDays();
  const today = startOfDay(new Date());

  const handleDayPress = (day: Date) => {
    setSelectedDate(day);
    setModalVisible(true);
  };

  const getDayStatus = (day: Date) => {
    const dateKey = format(day, 'yyyy-MM-dd');
    const log = historyMap[dateKey];
    const isFuture = isAfter(day, today);
    const isToday = isSameDay(day, today);

    if (isFuture) return 'future';
    if (log?.is_completed) return 'success';
    // If it's today and not complete, it's pending (neutral)
    if (isToday) return 'pending';
    // If it's past and not complete (or no log), it's failed
    return 'failed';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success': return COLORS.accent;
      case 'failed': return COLORS.danger;
      case 'pending': return COLORS.card; // With border
      default: return COLORS.transparent;
    }
  };

  const renderTaskDetails = () => {
    if (!selectedDate) return null;
    const dateKey = format(selectedDate, 'yyyy-MM-dd');
    const log = historyMap[dateKey];
    const isFuture = isAfter(selectedDate, today);

    if (isFuture) {
      return <Text style={styles.emptyStateText}>Cannot predict the future!</Text>;
    }

    if (!log) {
      return (
        <View style={styles.emptyStateContainer}>
          <CircleX size={48} color={COLORS.textLight} />
          <Text style={styles.emptyStateText}>No activity recorded for this day.</Text>
        </View>
      );
    }

    return (
      <View style={styles.taskList}>
        {Object.entries(TASKS_LABELS).map(([key, label]) => {
          const isDone = log.tasks[key];
          
          return (
            <View key={key} style={styles.taskItem}>
              <View style={[styles.taskIcon, isDone ? styles.taskIconSuccess : styles.taskIconFail]}>
                {isDone ? <Check size={14} color="white" /> : <X size={14} color="white" />}
              </View>
              <Text style={styles.taskLabel}>{label}</Text>
            </View>
          );
        })}
        
        <View style={[styles.summaryBox, log.is_completed ? styles.summarySuccess : styles.summaryFail]}>
          <Text style={styles.summaryText}>
            {log.is_completed ? "DAY COMPLETED" : "DAY FAILED"}
          </Text>
        </View>
      </View>
    );
  };

  if (loading) {
    return <ActivityIndicator size="large" color={COLORS.primary} style={styles.center} />;
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>History</Text>
        <TouchableOpacity onPress={fetchHistory} style={styles.refreshButton}>
          <RotateCcw size={20} color={COLORS.primary} />
        </TouchableOpacity>
      </View>

      {/* Stats Dashboard */}
      <View style={styles.statsContainer}>
        {/* Streak Card */}
        <View style={styles.statCard}>
          <View style={styles.statHeader}>
            <Flame size={16} color={COLORS.warning} fill={COLORS.warning} />
            <Text style={styles.statLabel}>Streak</Text>
          </View>
          <Text style={styles.statValue}>{stats.streak}</Text>
        </View>

        {/* Total Wins Card */}
        <View style={styles.statCard}>
          <View style={styles.statHeader}>
            <Trophy size={16} color="#EAB308" fill="#EAB308" />
            <Text style={styles.statLabel}>Wins</Text>
          </View>
          <Text style={styles.statValue}>{stats.totalWins}</Text>
        </View>

        {/* Success Rate Card */}
        <View style={styles.statCard}>
          <View style={styles.statHeader}>
            <Activity size={16} color={COLORS.info} />
            <Text style={styles.statLabel}>Success</Text>
          </View>
          <Text style={styles.statValue}>{stats.successRate}%</Text>
        </View>
      </View>

      {/* Calendar Card */}
      <View style={styles.calendarCard}>
        {/* Month Navigation */}
        <View style={styles.monthHeader}>
          <TouchableOpacity onPress={() => setCurrentMonth(subMonths(currentMonth, 1))}>
            <ChevronLeft size={24} color={COLORS.primary} />
          </TouchableOpacity>
          <Text style={styles.monthTitle}>{format(currentMonth, 'MMMM yyyy')}</Text>
          <TouchableOpacity onPress={() => setCurrentMonth(addMonths(currentMonth, 1))}>
            <ChevronRight size={24} color={COLORS.primary} />
          </TouchableOpacity>
        </View>

        {/* Week Days Header */}
        <View style={styles.weekHeader}>
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
            <Text key={day} style={styles.weekDayText}>{day}</Text>
          ))}
        </View>

        {/* Days Grid */}
        <View style={styles.daysGrid}>
          {calendarDays.map((day, index) => {
            const isCurrentMonth = isSameMonth(day, currentMonth);
            const status = getDayStatus(day);
            const statusColor = getStatusColor(status);
            const isToday = isSameDay(day, today);

            return (
              <TouchableOpacity
                key={index}
                style={[
                  styles.dayCell,
                  { backgroundColor: isCurrentMonth ? statusColor : COLORS.background },
                  status === 'pending' && isCurrentMonth && styles.dayCellPending,
                  !isCurrentMonth && styles.dayCellDisabled
                ]}
                onPress={() => handleDayPress(day)}
                disabled={!isCurrentMonth}
              >
                <Text style={[
                  styles.dayText,
                  (status === 'success' || status === 'failed') && isCurrentMonth ? styles.textWhite : styles.textDark,
                  !isCurrentMonth && styles.textLight
                ]}>
                  {format(day, 'd')}
                </Text>
                
                {isToday && isCurrentMonth && <View style={styles.todayDot} />}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Legend */}
      <View style={styles.legendContainer}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: COLORS.accent }]} />
          <Text style={styles.legendText}>Completed</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: COLORS.danger }]} />
          <Text style={styles.legendText}>Failed/Missed</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border }]} />
          <Text style={styles.legendText}>Pending</Text>
        </View>
      </View>

      {/* Details Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay} 
          activeOpacity={1} 
          onPress={() => setModalVisible(false)}
        >
          <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalDate}>
                  {selectedDate ? format(selectedDate, 'MMMM d, yyyy') : ''}
                </Text>
                <Text style={styles.modalDay}>
                  {selectedDate ? format(selectedDate, 'EEEE') : ''}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.closeButton}>
                <X size={20} color={COLORS.text} />
              </TouchableOpacity>
            </View>
            
            <View style={styles.modalBody}>
              {renderTaskDetails()}
            </View>
          </View>
        </TouchableOpacity>
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
  refreshButton: {
    padding: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    color: COLORS.primary,
  },
  // Stats Styles
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    gap: 10,
  },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  statHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    gap: 4,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textLight,
    textTransform: 'uppercase',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.text,
  },
  calendarCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 15,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  monthHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  monthTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.primary,
  },
  weekHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  weekDayText: {
    width: CELL_SIZE,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textLight,
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start', // Changed from space-between to align with grid
  },
  dayCell: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 5,
    borderRadius: CELL_SIZE / 2,
  },
  dayCellPending: {
    borderWidth: 2,
    borderColor: COLORS.primary,
  },
  dayCellDisabled: {
    opacity: 0.3,
  },
  dayText: {
    fontSize: 14,
    fontWeight: '600',
  },
  textWhite: {
    color: 'white',
  },
  textDark: {
    color: COLORS.text,
  },
  textLight: {
    color: COLORS.textLight,
  },
  todayDot: {
    position: 'absolute',
    bottom: 4,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.primary,
  },
  legendContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 20,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 6,
  },
  legendText: {
    fontSize: 12,
    color: COLORS.text,
    fontWeight: '500',
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    minHeight: 400,
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  modalDate: {
    fontSize: 24,
    fontWeight: '800',
    color: COLORS.primary,
  },
  modalDay: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textLight,
    marginTop: 4,
  },
  closeButton: {
    padding: 8,
    backgroundColor: COLORS.background,
    borderRadius: 20,
  },
  modalBody: {
    flex: 1,
  },
  emptyStateContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyStateText: {
    marginTop: 16,
    fontSize: 16,
    color: COLORS.textLight,
    textAlign: 'center',
  },
  taskList: {
    gap: 12,
  },
  taskItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.background,
  },
  taskIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  taskIconSuccess: {
    backgroundColor: COLORS.accent,
  },
  taskIconFail: {
    backgroundColor: COLORS.danger,
    opacity: 0.3,
  },
  taskLabel: {
    fontSize: 16,
    color: COLORS.text,
    fontWeight: '500',
  },
  summaryBox: {
    marginTop: 20,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  summarySuccess: {
    backgroundColor: 'rgba(74, 222, 128, 0.15)',
  },
  summaryFail: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
  },
  summaryText: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 1,
    color: COLORS.text,
  },
  // Helper for layout
  row: {
    flexDirection: 'row',
  },
});
