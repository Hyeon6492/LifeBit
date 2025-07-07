/*헬스로그 개발

 * AI 기반 고급 건강 데이터 분석 차트 컴포넌트
 * - 전문적인 통계 분석 및 시각화
 * - 일/주/월별 운동, 식단, 체중, BMI 목표치와 성취도 표시
 * - Plotly 기반 인터랙티브 차트
 * - AI 기반 개인화된 인사이트
 */

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useHealthRecords, useMealLogs, useExerciseSessions, useUserGoals, useHealthStatistics, useHealthLogStatistics, updateAchievementScore, type ExerciseSession, type MealLog, type HealthRecord } from '../../api/auth';

// ✅ 조인된 식단 데이터를 위한 확장 타입
interface MealLogWithFoodItem extends MealLog {
  food_item?: {
    calories?: number;
    carbs?: number;
    protein?: number;
    fat?: number;
  };
}
import { useHealthAnalyticsReport, useAIHealthInsights } from '../../api/analyticsApi';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { BodyPartFrequencyChart } from './BodyPartFrequencyChart';
import { Progress } from '../ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { 
  TrendingUp, 
  TrendingDown, 
  Activity, 
  Weight, 
  Brain,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  Target,
  Lightbulb,
  Info,
  BarChart3,
  LineChart,
  PieChart as PieChartIcon,
  Calendar,
  Timer,
  Flame,
  Heart,
  Utensils,
  Dumbbell,
  X
} from 'lucide-react';
import { Skeleton } from '../ui/skeleton';
import { 
  ComposedChart, 
  LineChart as RechartsLineChart,
  Line, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  RadialBarChart,
  RadialBar,
  BarChart
} from 'recharts';
import { getToken, getUserInfo, debugToken, isTokenValid } from '../../utils/auth';

interface PythonAnalyticsChartsProps {
  userId: number;
  period: 'day' | 'week' | 'month' | 'year';
  useHealthLogData?: boolean; // 건강로그 전용 데이터 사용 여부
}

// 색상 팔레트
const COLORS = {
  primary: '#3b82f6',
  secondary: '#10b981',
  accent: '#f59e0b',
  danger: '#ef4444',
  purple: '#8b5cf6',
  indigo: '#6366f1',
  pink: '#ec4899'
};

const PIE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#6366f1'];

interface NutritionData {
  carbs: { percentage: number };
  protein: { percentage: number };
  fat: { percentage: number };
}

interface GoalAchievements {
  nutrition: NutritionData;
}

export const PythonAnalyticsCharts: React.FC<PythonAnalyticsChartsProps> = ({
  userId,
  period,
  useHealthLogData = false
}) => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'exercise' | 'nutrition'>('exercise');
  // ✅ 목표 달성률 기간 선택 상태 추가
  const [goalPeriod, setGoalPeriod] = useState<'day' | 'week' | 'month'>('day');
  
  // 🔧 인증 상태 디버깅
  useEffect(() => {
    console.group('🔐 [PythonAnalyticsCharts] 인증 상태 디버깅');
    console.log('📝 Props userId:', userId);
    console.log('📝 Props period:', period);
    
    const token = getToken();
    const userInfo = getUserInfo();
    const tokenValid = isTokenValid();
    
    console.log('🔑 토큰 존재:', !!token);
    console.log('👤 사용자 정보:', userInfo);
    console.log('✅ 토큰 유효성:', tokenValid);
    
    if (token) {
      console.log('🔍 토큰 미리보기:', token.substring(0, 50) + '...');
      debugToken(); // 상세 토큰 정보 출력
    }
    
    console.log('현재 사용자:', localStorage.getItem('userInfo'));
    console.log('토큰:', localStorage.getItem('access_token'));
    
    console.groupEnd();
  }, [userId, period]);
  
  // 실제 건강 데이터 조회
  const { 
    data: healthRecords, 
    isLoading: isHealthLoading, 
    error: healthError,
    refetch: refetchHealth 
  } = useHealthRecords(userId.toString(), period);

  const { 
    data: mealLogs, 
    isLoading: isMealLoading, 
    error: mealError,
    refetch: refetchMeals 
  } = useMealLogs(userId.toString(), period);

  const { 
    data: exerciseSessions, 
    isLoading: isExerciseLoading,
    error: exerciseError,
    refetch: refetchExercise 
  } = useExerciseSessions(userId.toString(), period);

  const { 
    data: userGoals, 
    isLoading: isGoalsLoading,
    error: goalsError,
    refetch: refetchGoals 
  } = useUserGoals(userId.toString());

  // 건강로그 페이지에서는 건강로그 전용 API 사용, 다른 페이지에서는 일반 API 사용
  const { 
    data: healthStats, 
    isLoading: isHealthStatsLoading,
    error: healthStatsError,
    refetch: refetchHealthStats 
  } = useHealthLogData 
    ? useHealthLogStatistics(userId.toString())
    : useHealthStatistics(userId.toString(), 'week');

  // ✅ 실제 영양소 통계를 위한 day period 호출 추가
  const { 
    data: nutritionStats, 
    isLoading: isNutritionStatsLoading,
    error: nutritionStatsError,
    refetch: refetchNutritionStats 
  } = useHealthStatistics(userId.toString(), 'day');

  // 🚀 Python AI Analytics API 호출
  const { 
    data: pythonAnalytics, 
    isLoading: isPythonAnalyticsLoading,
    error: pythonAnalyticsError
  } = useHealthAnalyticsReport(userId, period);

  const { 
    data: aiInsights, 
    isLoading: isAIInsightsLoading,
    error: aiInsightsError
  } = useAIHealthInsights(userId, period);
  
  // 🚀 주간 총 운동 횟수/세트 (모드에 따라 분기)
  const weeklyWorkoutCurrent = useHealthLogData
    ? (healthStats?.weeklyTotalCounts_healthloguse || 0)
    : (healthStats?.weeklyTotalSets || 0);
  
  // 로딩 상태
  const isLoading = isHealthLoading || isMealLoading || isExerciseLoading || isGoalsLoading || isHealthStatsLoading || isNutritionStatsLoading || isPythonAnalyticsLoading || isAIInsightsLoading;
  
  // 오류 상태  
  const hasError = healthError || mealError || exerciseError || goalsError || healthStatsError || nutritionStatsError;

  // 🐛 디버그 로그 추가
  console.log('🔍 [PythonAnalyticsCharts] 데이터 확인:', {
    healthRecords: healthRecords,
    exerciseSessions: exerciseSessions,
    healthRecordsType: typeof healthRecords,
    exerciseSessionsType: typeof exerciseSessions,
    healthRecordsIsArray: Array.isArray(healthRecords),
    exerciseSessionsIsArray: Array.isArray(exerciseSessions),
    healthRecordsLength: Array.isArray(healthRecords) ? healthRecords.length : 'not array',
    exerciseSessionsLength: Array.isArray(exerciseSessions) ? exerciseSessions.length : 'not array',
    period,
    userId,
    healthRecordsSample: Array.isArray(healthRecords) ? healthRecords.slice(0, 2) : 'no data',
    exerciseSessionsSample: Array.isArray(exerciseSessions) ? exerciseSessions.slice(0, 2) : 'no data',
    healthError,
    exerciseError,
    isHealthLoading,
    isExerciseLoading,
    // 🔧 에러 상세 정보 추가
    healthErrorMessage: healthError?.message || 'Unknown error',
    exerciseErrorMessage: exerciseError?.message || 'Unknown error'
  });

  // 차트 데이터 준비 (Forward Fill 방식으로 자연스러운 트렌드 생성)
  const chartData = useMemo(() => {
    // API 응답이 직접 배열인 경우와 data 속성을 가진 경우 모두 처리
    const healthRecordsData = Array.isArray(healthRecords) 
      ? healthRecords 
      : (healthRecords?.data && Array.isArray(healthRecords.data) ? healthRecords.data : []);
    
    const exerciseSessionsData = Array.isArray(exerciseSessions) 
      ? exerciseSessions 
      : (exerciseSessions?.data && Array.isArray(exerciseSessions.data) ? exerciseSessions.data : []);
    
    const mealLogsData = Array.isArray(mealLogs) 
      ? mealLogs 
      : (mealLogs?.data && Array.isArray(mealLogs.data) ? mealLogs.data : []);
    
    const goalsData = userGoals?.data || userGoals;

    // 기간별 데이터 그룹화를 위한 헬퍼 함수
    const getDateKey = (dateStr: string, period: string): string => {
      const date = new Date(dateStr);
      switch (period) {
        case 'day':
          return dateStr; // YYYY-MM-DD 그대로 사용
        case 'week': {
          // 일요일 기준 주의 시작 날짜 반환
          const dayOfWeek = date.getDay();
          const weekStart = new Date(date);
          weekStart.setDate(date.getDate() - dayOfWeek);
          const result = weekStart.toISOString().split('T')[0];
          
          // 디버깅용 로그
          if (period === 'week') {
            console.log(`🔧 주별 키 생성:`, {
              originalDate: dateStr,
              dayOfWeek,
              weekStart: result
            });
          }
          
          return result;
        }
        case 'month':
          return dateStr.substring(0, 7); // YYYY-MM
        default:
          return dateStr;
      }
    };

    // 기간별 라벨 생성 함수
    const generatePeriodLabel = (baseDate: Date, period: string, index: number): string => {
      switch (period) {
        case 'day':
          return baseDate.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
        case 'week': {
          const weekEnd = new Date(baseDate);
          weekEnd.setDate(baseDate.getDate() + 6);
          return `${baseDate.getMonth() + 1}/${baseDate.getDate()}~${weekEnd.getMonth() + 1}/${weekEnd.getDate()}`;
        }
        case 'month':
          return baseDate.toLocaleDateString('ko-KR', { year: '2-digit', month: 'short' });
        default:
          return baseDate.toLocaleDateString('ko-KR');
      }
    };

    // 🔧 확장된 기간 설정 (3개월 전 데이터까지 포함하여 Forward Fill 적용)
    const getExtendedPeriod = () => {
      const now = new Date();
      const extendedData: { [key: string]: {
      label: string;
      date: string;
        weightValues: number[];
        bmiValues: number[];
      exerciseMinutes: number;
      exerciseCalories: number;
      mealCalories: number;
      mealCount: number;
        isDisplayPeriod: boolean; // 실제 표시할 기간인지 구분
    } } = {};
    
    if (period === 'day') {
        // 표시할 최근 7일 + 3개월 전 데이터 (97일)
        for (let i = 96; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        const key = date.toISOString().split('T')[0];
          const label = generatePeriodLabel(date, period, i);
          extendedData[key] = {
          label,
          date: key,
            weightValues: [],
            bmiValues: [],
          exerciseMinutes: 0,
          exerciseCalories: 0,
          mealCalories: 0,
            mealCount: 0,
            isDisplayPeriod: i <= 6 // 최근 7일만 표시
        };
      }
    } else if (period === 'week') {
        // 표시할 최근 8주 + 3개월 전 데이터 (20주)
        for (let i = 19; i >= 0; i--) {
          // 현재 주의 일요일 기준으로 i주 전 계산
          const currentWeekStart = new Date(now);
          const currentDayOfWeek = now.getDay();
          currentWeekStart.setDate(now.getDate() - currentDayOfWeek);
          
          // i주 전의 주 시작일 계산
          const weekStart = new Date(currentWeekStart);
          weekStart.setDate(currentWeekStart.getDate() - (i * 7));
          
          const key = weekStart.toISOString().split('T')[0];
          const label = generatePeriodLabel(weekStart, period, i);
          
          console.log(`🔧 [week] 주별 그룹 생성:`, {
            i,
            currentWeekStart: currentWeekStart.toISOString().split('T')[0],
            weekStart: key,
            label,
            isDisplayPeriod: i <= 7
          });
          
          extendedData[key] = {
          label,
          date: key,
            weightValues: [],
            bmiValues: [],
          exerciseMinutes: 0,
          exerciseCalories: 0,
          mealCalories: 0,
            mealCount: 0,
            isDisplayPeriod: i <= 7 // 최근 8주만 표시
        };
      }
    } else {
        // 표시할 최근 12개월 + 3개월 전 데이터 (15개월)
        for (let i = 14; i >= 0; i--) {
        const date = new Date(now);
        date.setMonth(date.getMonth() - i);
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          const label = generatePeriodLabel(date, period, i);
          extendedData[key] = {
          label,
          date: key,
            weightValues: [],
            bmiValues: [],
          exerciseMinutes: 0,
          exerciseCalories: 0,
          mealCalories: 0,
            mealCount: 0,
            isDisplayPeriod: i <= 11 // 최근 12개월만 표시
        };
      }
    }

      return extendedData;
    };

    const groupedData = getExtendedPeriod();

    // 건강 기록 데이터 매핑 (3개월 전 데이터까지 포함)
    if (Array.isArray(healthRecordsData)) {
      console.log(`🔧 [${period}] 건강 기록 데이터 매핑 시작:`, healthRecordsData.length);
      
      healthRecordsData.forEach(record => {
        const dateKey = getDateKey(record.record_date, period);
        
        console.log(`🔧 [${period}] 매핑 시도:`, {
          record_date: record.record_date,
          dateKey,
          hasGroup: !!groupedData[dateKey],
          weight: record.weight,
          bmi: record.bmi
        });
        
        if (groupedData[dateKey]) {
          if (record.weight) {
            groupedData[dateKey].weightValues.push(record.weight);
            console.log(`✅ [${period}] 체중 데이터 추가:`, dateKey, record.weight);
          }
          if (record.bmi) {
            groupedData[dateKey].bmiValues.push(record.bmi);
            console.log(`✅ [${period}] BMI 데이터 추가:`, dateKey, record.bmi);
          }
        } else {
          // 🔧 정확한 키가 없으면 가장 가까운 주별 그룹 찾기
          if (period === 'week') {
            const recordDate = new Date(record.record_date);
            const availableKeys = Object.keys(groupedData).sort();
            
            // 기록 날짜가 포함되는 주를 찾기
            let targetKey = null;
            for (const key of availableKeys) {
              const weekStart = new Date(key);
              const weekEnd = new Date(weekStart);
              weekEnd.setDate(weekStart.getDate() + 6);
              
              if (recordDate >= weekStart && recordDate <= weekEnd) {
                targetKey = key;
                break;
              }
            }
            
            if (targetKey && groupedData[targetKey]) {
              if (record.weight) {
                groupedData[targetKey].weightValues.push(record.weight);
                console.log(`✅ [${period}] 대체 체중 매핑:`, {
                  original: dateKey,
                  target: targetKey,
                  record_date: record.record_date,
                  weight: record.weight
                });
              }
              if (record.bmi) {
                groupedData[targetKey].bmiValues.push(record.bmi);
                console.log(`✅ [${period}] 대체 BMI 매핑:`, {
                  original: dateKey,
                  target: targetKey,
                  record_date: record.record_date,
                  bmi: record.bmi
                });
              }
            } else {
              console.log(`❌ [${period}] 매핑 실패:`, {
                dateKey,
                record_date: record.record_date,
                availableKeys: availableKeys.slice(0, 5)
              });
            }
          } else {
            console.log(`❌ [${period}] 그룹 없음:`, dateKey, '사용 가능한 키:', Object.keys(groupedData).slice(0, 5));
          }
        }
      });
    }

    // 운동 세션 데이터 매핑 (3개월 전 데이터까지 포함)
    if (Array.isArray(exerciseSessionsData)) {
      console.log(`🔧 [${period}] 운동 세션 데이터 매핑 시작:`, exerciseSessionsData.length);
      
      exerciseSessionsData.forEach(session => {
        const dateKey = getDateKey(session.exercise_date, period);
        
        console.log(`🔧 [${period}] 운동 매핑 시도:`, {
          exercise_date: session.exercise_date,
          dateKey,
          hasGroup: !!groupedData[dateKey],
          duration_minutes: session.duration_minutes,
          calories_burned: session.calories_burned
        });
        
        if (groupedData[dateKey]) {
          groupedData[dateKey].exerciseMinutes += session.duration_minutes || 0;
          groupedData[dateKey].exerciseCalories += session.calories_burned || 0;
          console.log(`✅ [${period}] 운동 데이터 추가:`, dateKey, `${session.duration_minutes}분, ${session.calories_burned}kcal`);
        } else {
          // 🔧 정확한 키가 없으면 가장 가까운 주별 그룹 찾기
          if (period === 'week') {
            const exerciseDate = new Date(session.exercise_date);
            const availableKeys = Object.keys(groupedData).sort();
            
            // 운동 날짜가 포함되는 주를 찾기
            let targetKey = null;
            for (const key of availableKeys) {
              const weekStart = new Date(key);
              const weekEnd = new Date(weekStart);
              weekEnd.setDate(weekStart.getDate() + 6);
              
              if (exerciseDate >= weekStart && exerciseDate <= weekEnd) {
                targetKey = key;
                break;
              }
            }
            
            if (targetKey && groupedData[targetKey]) {
              groupedData[targetKey].exerciseMinutes += session.duration_minutes || 0;
              groupedData[targetKey].exerciseCalories += session.calories_burned || 0;
              console.log(`✅ [${period}] 대체 운동 매핑:`, {
                original: dateKey,
                target: targetKey,
                exercise_date: session.exercise_date,
                duration: session.duration_minutes,
                calories: session.calories_burned
              });
            } else {
              console.log(`❌ [${period}] 운동 매핑 실패:`, {
                dateKey,
                exercise_date: session.exercise_date,
                availableKeys: availableKeys.slice(0, 5)
              });
            }
          } else {
            console.log(`❌ [${period}] 운동 그룹 없음:`, dateKey, '사용 가능한 키:', Object.keys(groupedData).slice(0, 5));
          }
        }
      });
    }

    // 식단 데이터 매핑
    if (Array.isArray(mealLogsData)) {
      mealLogsData.forEach(meal => {
        const dateKey = getDateKey(meal.log_date, period);
        
        if (groupedData[dateKey]) {
          // ✅ 실제 API 응답 구조에 맞게 수정
          const mealCalories = meal.food_item ? 
            (meal.food_item.calories * (meal.quantity || 100) / 100) : 
            200;
          groupedData[dateKey].mealCalories += mealCalories;
          groupedData[dateKey].mealCount += 1;
        }
      });
    }

    // 🔧 Forward Fill 방식으로 자연스러운 데이터 처리
    const sortedKeys = Object.keys(groupedData).sort();
    let lastValidWeight: number | null = null;
    let lastValidBmi: number | null = null;

    // 🔧 먼저 전체 데이터에서 가장 최근 유효값을 찾기 (시드 데이터)
    const allHealthData = Array.isArray(healthRecordsData) ? healthRecordsData : [];
    if (allHealthData.length > 0) {
      // 날짜순 정렬하여 가장 최근 데이터 사용
      const sortedHealthData = allHealthData.sort((a, b) => 
        new Date(b.record_date).getTime() - new Date(a.record_date).getTime()
      );
      
      const latestRecord = sortedHealthData[0];
      if (latestRecord.weight) lastValidWeight = latestRecord.weight;
      if (latestRecord.bmi) lastValidBmi = latestRecord.bmi;
      
      console.log(`🔧 [${period}] 시드 데이터 설정:`, {
        latestRecord: latestRecord.record_date,
        seedWeight: lastValidWeight,
        seedBmi: lastValidBmi
      });
    }

    const processedData = sortedKeys.map(key => {
      const group = groupedData[key];
      
      // 현재 기간의 평균값 계산
      let currentWeight = group.weightValues.length > 0 ? 
        Math.round((group.weightValues.reduce((sum, val) => sum + val, 0) / group.weightValues.length) * 10) / 10 : null;
      
      let currentBmi = group.bmiValues.length > 0 ? 
        Math.round((group.bmiValues.reduce((sum, val) => sum + val, 0) / group.bmiValues.length) * 10) / 10 : null;

      // Forward Fill 적용: 데이터가 없으면 이전 유효값 사용
      if (currentWeight !== null) {
        lastValidWeight = currentWeight;
      } else if (lastValidWeight !== null) {
        currentWeight = lastValidWeight;
      }

      if (currentBmi !== null) {
        lastValidBmi = currentBmi;
      } else if (lastValidBmi !== null) {
        currentBmi = lastValidBmi;
      }

      return {
        label: group.label,
        date: group.date,
        // 🔧 차트 연결을 위해 Forward Fill 값 또는 null 사용
        weight: currentWeight,
        bmi: currentBmi,
        exerciseMinutes: group.exerciseMinutes,
        exerciseCalories: group.exerciseCalories,
        mealCalories: Math.round(group.mealCalories),
        mealCount: group.mealCount,
        isDisplayPeriod: group.isDisplayPeriod,
        // 🔧 데이터 존재 여부 표시 (점선/실선 구분용)
        hasWeightData: group.weightValues.length > 0,
        hasBmiData: group.bmiValues.length > 0,
        hasExerciseData: group.exerciseMinutes > 0
      };
    });

    // 표시할 기간만 필터링하여 반환
    const displayData = processedData.filter(item => item.isDisplayPeriod);
    
    // 🔧 상세 로그로 데이터 확인
    console.log(`📊 [${period}] 원본 건강 데이터 개수:`, allHealthData.length);
    console.log(`📊 [${period}] 그룹핑된 데이터 키:`, Object.keys(groupedData));
    console.log(`📊 [${period}] 처리된 차트 데이터:`, displayData.map(d => ({
      label: d.label,
      weight: d.weight,
      bmi: d.bmi,
      exerciseMinutes: d.exerciseMinutes,
      hasWeightData: d.hasWeightData,
      hasBmiData: d.hasBmiData,
      isDisplayPeriod: d.isDisplayPeriod
    })));

    return displayData;
  }, [healthRecords, exerciseSessions, mealLogs, period, userGoals]);

  // ✅ 목표 데이터 전처리 (컴포넌트 레벨에서 정의)
  const goalsData = useMemo(() => {
    let base: any = null;
    if (userGoals?.success && userGoals?.data) {
      base = userGoals.data;
    } else if (userGoals && typeof userGoals === 'object' && !userGoals.success) {
      base = userGoals;
    }
    if (!base) return null;

    if (useHealthLogData) {
      // 건강로그 모드: 부위별 목표를 합산하여 weekly_workout_target을 계산
      const sumTargets = (
        (base.weekly_chest || 0) +
        (base.weekly_back || 0) +
        (base.weekly_legs || 0) +
        (base.weekly_shoulders || 0) +
        (base.weekly_arms || 0) +
        (base.weekly_abs || 0) +
        (base.weekly_cardio || 0)
      );
      return { ...base, weekly_workout_target: sumTargets };
    }
    return base;
  }, [userGoals, useHealthLogData]);

  // 목표 달성률 계산 (기간별 지원)
  const goalAchievements = useMemo(() => {
    const exerciseData = exerciseSessions?.success && exerciseSessions?.data ? exerciseSessions.data : [];
    const mealData = mealLogs?.success && mealLogs?.data ? mealLogs.data : [];
    
    // ✅ 기간별 영양소 통계 데이터 활용
    const actualNutrition = nutritionStats?.data || nutritionStats || null;
    
    // 🔍 디버깅: 상세 데이터 구조 확인 (강화)
    console.group('🔍 [goalAchievements] 상세 디버깅');
    console.log('📊 Raw userGoals:', userGoals);
    console.log('📊 Processed goalsData:', goalsData);
    console.log('📊 userGoals type:', typeof userGoals);
    console.log('📊 userGoals.success:', userGoals?.success);
    console.log('📊 userGoals.data:', userGoals?.data);
    console.log('📊 Has weekly_workout_target?', goalsData?.weekly_workout_target);
    console.log('📊 Has daily_carbs_target?', goalsData?.daily_carbs_target);
    console.log('📊 goalPeriod:', goalPeriod);
    console.log('📊 actualNutrition:', actualNutrition);
    console.log('📊 exerciseData length:', exerciseData?.length || 0);
    console.log('📊 mealData length:', mealData?.length || 0);
    console.groupEnd();
    
    // ✅ 기간별 날짜 범위 계산
    const getDateRange = (period: 'day' | 'week' | 'month') => {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      
      switch (period) {
        case 'day': {
          return {
            start: today.toISOString().split('T')[0],
            end: today.toISOString().split('T')[0]
          };
        }
        case 'week': {
          const startOfWeek = new Date(today);
          startOfWeek.setDate(today.getDate() - today.getDay()); // 일요일부터
          const endOfWeek = new Date(startOfWeek);
          endOfWeek.setDate(startOfWeek.getDate() + 6);
          return {
            start: startOfWeek.toISOString().split('T')[0],
            end: endOfWeek.toISOString().split('T')[0]
          };
        }
        case 'month': {
          const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
          const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
          return {
            start: startOfMonth.toISOString().split('T')[0],
            end: endOfMonth.toISOString().split('T')[0]
          };
        }
        default:
          return { start: today.toISOString().split('T')[0], end: today.toISOString().split('T')[0] };
      }
    };

    const dateRange = getDateRange(goalPeriod);
    
    // ✅ 기간별 운동 데이터 필터링
    const periodExercise = Array.isArray(exerciseData) 
      ? exerciseData.filter((session: ExerciseSession) => {
          const sessionDate = session.exercise_date;
          return sessionDate >= dateRange.start && sessionDate <= dateRange.end;
        })
      : [];
    
    // ✅ 기간별 식단 데이터 필터링
    const periodMeals = Array.isArray(mealData)
      ? mealData.filter((meal: MealLog) => {
          const mealDate = meal.log_date;
          return mealDate >= dateRange.start && mealDate <= dateRange.end;
        })
      : [];

    // ✅ 기간별 운동 시간 계산
    const exerciseMinutes = periodExercise.reduce((sum: number, session: ExerciseSession) => 
      sum + (session.duration_minutes || 0), 0);
    
    // ✅ 실제 DB 목표 데이터 기반 운동 목표 계산 (하드코딩 제거)
    const weeklyWorkoutTarget = goalsData?.weekly_workout_target;
    const getExerciseTarget = (period: 'day' | 'week' | 'month') => {
      if (!weeklyWorkoutTarget) return null; // DB에 목표가 없으면 null 반환
      
      switch (period) {
        case 'day': {
          return Math.round(weeklyWorkoutTarget / 7); // 하루 목표
        }
        case 'week': {
          return weeklyWorkoutTarget; // 주간 목표
        }
        case 'month': {
          return weeklyWorkoutTarget * 4; // 월간 목표 (주간 × 4)
        }
        default:
          return weeklyWorkoutTarget;
      }
    };
    
    const exerciseTarget = getExerciseTarget(goalPeriod);

    // ✅ 기간별 영양소 데이터 계산 (실제 섭취량)
    let periodCalories = 0;
    let periodCarbs = 0;
    let periodProtein = 0;
    let periodFat = 0;

    // 기간이 'day'인 경우 실제 영양소 통계를 우선 사용
    if (goalPeriod === 'day' && actualNutrition) {
      periodCalories = actualNutrition.dailyCalories || 0;
      periodCarbs = actualNutrition.dailyCarbs || 0;
      periodProtein = actualNutrition.dailyProtein || 0;
      periodFat = actualNutrition.dailyFat || 0;
    } else {
      // 주간/월간의 경우 meal_logs에서 직접 계산
      periodMeals.forEach((meal: MealLogWithFoodItem) => {
        // API 응답에서 조인된 food_item 데이터가 포함될 수 있음
        const foodItem = meal.food_item;
        if (foodItem && meal.quantity) {
          const quantity = meal.quantity / 100; // 100g 기준으로 변환
          periodCalories += (foodItem.calories || 0) * quantity;
          periodCarbs += (foodItem.carbs || 0) * quantity;
          periodProtein += (foodItem.protein || 0) * quantity;
          periodFat += (foodItem.fat || 0) * quantity;
        }
      });
    }

    // ✅ 실제 DB 목표 데이터 기반 영양소 목표 계산 (하드코딩 제거)
    const carbsTargetDaily = goalsData?.daily_carbs_target;
    const proteinTargetDaily = goalsData?.daily_protein_target;
    const fatTargetDaily = goalsData?.daily_fat_target;
    const caloriesTargetDaily = goalsData?.daily_calories_target;

    const getNutritionTarget = (dailyTarget: number | undefined, period: 'day' | 'week' | 'month') => {
      if (!dailyTarget) return null; // DB에 목표가 없으면 null 반환
      
      switch (period) {
        case 'day': {
          return dailyTarget;
        }
        case 'week': {
          return dailyTarget * 7;
        }
        case 'month': {
          return dailyTarget * 30; // 월간 목표 (일간 × 30)
        }
        default:
          return dailyTarget;
      }
    };

    const carbsTarget = getNutritionTarget(carbsTargetDaily, goalPeriod);
    const proteinTarget = getNutritionTarget(proteinTargetDaily, goalPeriod);
    const fatTarget = getNutritionTarget(fatTargetDaily, goalPeriod);
    const caloriesTarget = getNutritionTarget(caloriesTargetDaily, goalPeriod);

    // ✅ 운동 부위별 주간 목표 및 실제 수행 횟수 계산
    const bodyPartTargets = {
      chest: goalsData?.weekly_chest,
      back: goalsData?.weekly_back,
      legs: goalsData?.weekly_legs,
      shoulders: goalsData?.weekly_shoulders,
      arms: goalsData?.weekly_arms,
      abs: goalsData?.weekly_abs,
      cardio: goalsData?.weekly_cardio
    };

    // 운동 부위별 실제 수행 횟수 계산 (주간 데이터에서 가져오기)
    const calculateBodyPartCounts = () => {
      const bodyPartCounts = {
        chest: 0,
        back: 0,
        legs: 0,
        shoulders: 0,
        arms: 0,
        abs: 0,
        cardio: 0
      };

      // 주간 운동 통계에서 운동 횟수 데이터 가져오기
      if (goalPeriod === 'week' && healthStats?.data) {
        bodyPartCounts.chest = healthStats.data.weeklyChestCount || 0;
        bodyPartCounts.back = healthStats.data.weeklyBackCount || 0;
        bodyPartCounts.legs = healthStats.data.weeklyLegsCount || 0;
        bodyPartCounts.shoulders = healthStats.data.weeklyShouldersCount || 0;
        bodyPartCounts.arms = healthStats.data.weeklyArmsCount || 0;
        bodyPartCounts.abs = healthStats.data.weeklyAbsCount || 0;
        bodyPartCounts.cardio = healthStats.data.weeklyCardioCount || 0;
      }

      return bodyPartCounts;
    };

    const bodyPartActual = calculateBodyPartCounts();

    // 🔍 디버깅: 최종 계산 값 확인
    console.log('🔍 [goalAchievements] 최종 계산:', {
      goalPeriod,
      dateRange,
      운동시간: exerciseMinutes,
      운동목표: exerciseTarget,
      칼로리: Math.round(periodCalories),
      칼로리목표: caloriesTarget,
      탄수화물: Math.round(periodCarbs * 10) / 10,
      탄수화물목표: carbsTarget,
      단백질: Math.round(periodProtein * 10) / 10,
      단백질목표: proteinTarget,
      지방: Math.round(periodFat * 10) / 10,
      지방목표: fatTarget,
      periodExerciseCount: periodExercise.length,
      periodMealsCount: periodMeals.length
    });

    return {
      period: goalPeriod,
      dateRange,
      exercise: {
        current: exerciseMinutes,
        target: exerciseTarget,
        percentage: exerciseTarget ? Math.min((exerciseMinutes / exerciseTarget) * 100, 100) : 0,
        hasTarget: !!exerciseTarget
      },
      nutrition: {
        carbs: {
          current: Math.round(periodCarbs * 10) / 10,
          target: carbsTarget,
          percentage: carbsTarget ? Math.min((periodCarbs / carbsTarget) * 100, 100) : 0,
          hasTarget: !!carbsTarget
        },
        protein: {
          current: Math.round(periodProtein * 10) / 10,
          target: proteinTarget,
          percentage: proteinTarget ? Math.min((periodProtein / proteinTarget) * 100, 100) : 0,
          hasTarget: !!proteinTarget
        },
        fat: {
          current: Math.round(periodFat * 10) / 10,
          target: fatTarget,
          percentage: fatTarget ? Math.min((periodFat / fatTarget) * 100, 100) : 0,
          hasTarget: !!fatTarget
        },
        calories: {
          current: Math.round(periodCalories),
          target: caloriesTarget,
          percentage: caloriesTarget ? Math.min((periodCalories / caloriesTarget) * 100, 100) : 0,
          hasTarget: !!caloriesTarget
        }
      },
      // ✅ 운동 부위별 목표 달성률 (주간만)
      bodyParts: goalPeriod === 'week' ? {
        chest: {
          current: Math.round(bodyPartActual.chest),
          target: bodyPartTargets.chest,
          percentage: bodyPartTargets.chest ? Math.min((bodyPartActual.chest / bodyPartTargets.chest) * 100, 100) : 0,
          hasTarget: !!bodyPartTargets.chest
        },
        back: {
          current: Math.round(bodyPartActual.back),
          target: bodyPartTargets.back,
          percentage: bodyPartTargets.back ? Math.min((bodyPartActual.back / bodyPartTargets.back) * 100, 100) : 0,
          hasTarget: !!bodyPartTargets.back
        },
        legs: {
          current: Math.round(bodyPartActual.legs),
          target: bodyPartTargets.legs,
          percentage: bodyPartTargets.legs ? Math.min((bodyPartActual.legs / bodyPartTargets.legs) * 100, 100) : 0,
          hasTarget: !!bodyPartTargets.legs
        },
        shoulders: {
          current: Math.round(bodyPartActual.shoulders),
          target: bodyPartTargets.shoulders,
          percentage: bodyPartTargets.shoulders ? Math.min((bodyPartActual.shoulders / bodyPartTargets.shoulders) * 100, 100) : 0,
          hasTarget: !!bodyPartTargets.shoulders
        },
        arms: {
          current: Math.round(bodyPartActual.arms),
          target: bodyPartTargets.arms,
          percentage: bodyPartTargets.arms ? Math.min((bodyPartActual.arms / bodyPartTargets.arms) * 100, 100) : 0,
          hasTarget: !!bodyPartTargets.arms
        },
        abs: {
          current: Math.round(bodyPartActual.abs),
          target: bodyPartTargets.abs,
          percentage: bodyPartTargets.abs ? Math.min((bodyPartActual.abs / bodyPartTargets.abs) * 100, 100) : 0,
          hasTarget: !!bodyPartTargets.abs
        },
        cardio: {
          current: Math.round(bodyPartActual.cardio),
          target: bodyPartTargets.cardio,
          percentage: bodyPartTargets.cardio ? Math.min((bodyPartActual.cardio / bodyPartTargets.cardio) * 100, 100) : 0,
          hasTarget: !!bodyPartTargets.cardio
        }
      } : null,
      // ✅ 운동 부위별 상세 목표 달성률 (주간 기준)
      exerciseDetails: goalPeriod === 'week' ? {
        chest: {
          current: Math.round(bodyPartActual.chest),
          target: bodyPartTargets.chest,
          percentage: bodyPartTargets.chest ? Math.min((bodyPartActual.chest / bodyPartTargets.chest) * 100, 100) : 0,
          hasTarget: !!bodyPartTargets.chest
        },
        back: {
          current: Math.round(bodyPartActual.back),
          target: bodyPartTargets.back,
          percentage: bodyPartTargets.back ? Math.min((bodyPartActual.back / bodyPartTargets.back) * 100, 100) : 0,
          hasTarget: !!bodyPartTargets.back
        },
        legs: {
          current: Math.round(bodyPartActual.legs),
          target: bodyPartTargets.legs,
          percentage: bodyPartTargets.legs ? Math.min((bodyPartActual.legs / bodyPartTargets.legs) * 100, 100) : 0,
          hasTarget: !!bodyPartTargets.legs
        },
        shoulders: {
          current: Math.round(bodyPartActual.shoulders),
          target: bodyPartTargets.shoulders,
          percentage: bodyPartTargets.shoulders ? Math.min((bodyPartActual.shoulders / bodyPartTargets.shoulders) * 100, 100) : 0,
          hasTarget: !!bodyPartTargets.shoulders
        },
        arms: {
          current: Math.round(bodyPartActual.arms),
          target: bodyPartTargets.arms,
          percentage: bodyPartTargets.arms ? Math.min((bodyPartActual.arms / bodyPartTargets.arms) * 100, 100) : 0,
          hasTarget: !!bodyPartTargets.arms
        },
        abs: {
          current: Math.round(bodyPartActual.abs),
          target: bodyPartTargets.abs,
          percentage: bodyPartTargets.abs ? Math.min((bodyPartActual.abs / bodyPartTargets.abs) * 100, 100) : 0,
          hasTarget: !!bodyPartTargets.abs
        },
        cardio: {
          current: Math.round(bodyPartActual.cardio),
          target: bodyPartTargets.cardio,
          percentage: bodyPartTargets.cardio ? Math.min((bodyPartActual.cardio / bodyPartTargets.cardio) * 100, 100) : 0,
          hasTarget: !!bodyPartTargets.cardio
        }
      } : null,
      // ✅ 전체 목표 설정 여부 확인
      hasAnyTargets: !!(exerciseTarget || carbsTarget || proteinTarget || fatTarget || caloriesTarget)
    };
  }, [exerciseSessions, mealLogs, goalsData, nutritionStats, goalPeriod, isNutritionStatsLoading, nutritionStatsError]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    Promise.all([
      refetchHealth(), 
      refetchMeals(), 
      refetchExercise(), 
      refetchGoals(),
      refetchNutritionStats() // ✅ 영양소 통계 새로고침 추가
    ]).finally(() => setIsRefreshing(false));
  };

  // 목표 달성률 점수 업데이트 핸들러
  const handleUpdateAchievementScore = async () => {
    try {
      await updateAchievementScore();
      console.log('목표 달성률 점수 업데이트 완료');
      // 성공 알림 또는 UI 업데이트
    } catch (error) {
      console.error('목표 달성률 점수 업데이트 실패:', error);
    }
  };

  // 🔧 디버깅용 테스트 함수
  const handleDebugTest = async () => {
    console.log('=== 디버깅 테스트 시작 ===');
    console.log('1. userGoals:', userGoals);
    console.log('2. nutritionStats:', nutritionStats);
    console.log('3. exerciseSessions:', exerciseSessions);
    console.log('4. mealLogs:', mealLogs);
    
    // 영양소 통계 강제 새로고침
    const result = await refetchNutritionStats();
    console.log('5. 강제 새로고침 결과:', result);
    console.log('=== 디버깅 테스트 완료 ===');
    console.log('테스트 성공!');
  };

  const getPeriodLabel = () => {
    switch (period) {
      case 'day': return '일간';
      case 'week': return '주간';
      case 'month': return '월간';
      case 'year': return '연간';
      default: return '기간';
    }
  };

  // 운동 점수 계산 함수 (주별 최대 7점)
  const calculateExerciseScore = () => {
    const totalCurrent = useHealthLogData 
      ? (healthStats?.weeklyTotalCounts_healthloguse || 0)
      : (healthStats?.weeklyTotalSets || 0);
      
    if (!goalsData?.weekly_workout_target || !totalCurrent) {
      return 0;
    }
    const achievementRate = Math.min(totalCurrent / goalsData.weekly_workout_target, 1.0);
    return Math.round(achievementRate * 7);
  };

  // 식단 점수 계산 함수 (주별 최대 7점)
  const calculateNutritionScore = useCallback(() => {
    // 현재 일일 영양소 달성률을 기준으로 계산
    const carbsAchieved = goalAchievements.nutrition.carbs.percentage >= 100;
    const proteinAchieved = goalAchievements.nutrition.protein.percentage >= 100;
    const fatAchieved = goalAchievements.nutrition.fat.percentage >= 100;
    
    // 모든 영양소가 100% 이상 달성되면 1점 부여
    const todayScore = (carbsAchieved && proteinAchieved && fatAchieved) ? 1 : 0;
    
    return todayScore;
  }, [goalAchievements]);

  // 점수 상태 업데이트
  useEffect(() => {
    const score = calculateNutritionScore();
    // 점수가 1점이면 실시간으로 백엔드에 반영
    if (score === 1) {
      void updateAchievementScore();
    }
  }, [calculateNutritionScore]);

  // 운동 부위별 데이터 계산 (건강로그 모드에서는 횟수, 일반 모드에서는 세트)
  const calculateDetailedExerciseData = () => {
    const exerciseDetails = {
      chest: {
        current: useHealthLogData 
          ? (healthStats?.weeklyChestCounts_healthloguse || 0)
          : (healthStats?.weeklyChestSets || 0),
        target: goalsData?.weekly_chest || 0,
        hasTarget: (goalsData?.weekly_chest || 0) > 0,
        percentage: (goalsData?.weekly_chest || 0) > 0 
          ? Math.min(((useHealthLogData 
              ? (healthStats?.weeklyChestCounts_healthloguse || 0)
              : (healthStats?.weeklyChestSets || 0)
            ) / goalsData.weekly_chest) * 100, 100)
          : 0
      },
      back: {
        current: useHealthLogData 
          ? (healthStats?.weeklyBackCounts_healthloguse || 0)
          : (healthStats?.weeklyBackSets || 0),
        target: goalsData?.weekly_back || 0,
        hasTarget: (goalsData?.weekly_back || 0) > 0,
        percentage: (goalsData?.weekly_back || 0) > 0 
          ? Math.min(((useHealthLogData 
              ? (healthStats?.weeklyBackCounts_healthloguse || 0)
              : (healthStats?.weeklyBackSets || 0)
            ) / goalsData.weekly_back) * 100, 100)
          : 0
      },
      legs: {
        current: useHealthLogData 
          ? (healthStats?.weeklyLegsCounts_healthloguse || 0)
          : (healthStats?.weeklyLegsSets || 0),
        target: goalsData?.weekly_legs || 0,
        hasTarget: (goalsData?.weekly_legs || 0) > 0,
        percentage: (goalsData?.weekly_legs || 0) > 0 
          ? Math.min(((useHealthLogData 
              ? (healthStats?.weeklyLegsCounts_healthloguse || 0)
              : (healthStats?.weeklyLegsSets || 0)
            ) / goalsData.weekly_legs) * 100, 100)
          : 0
      },
      shoulders: {
        current: useHealthLogData 
          ? (healthStats?.weeklyShouldersCounts_healthloguse || 0)
          : (healthStats?.weeklyShouldersSets || 0),
        target: goalsData?.weekly_shoulders || 0,
        hasTarget: (goalsData?.weekly_shoulders || 0) > 0,
        percentage: (goalsData?.weekly_shoulders || 0) > 0 
          ? Math.min(((useHealthLogData 
              ? (healthStats?.weeklyShouldersCounts_healthloguse || 0)
              : (healthStats?.weeklyShouldersSets || 0)
            ) / goalsData.weekly_shoulders) * 100, 100)
          : 0
      },
      arms: {
        current: useHealthLogData 
          ? (healthStats?.weeklyArmsCounts_healthloguse || 0)
          : (healthStats?.weeklyArmsSets || 0),
        target: goalsData?.weekly_arms || 0,
        hasTarget: (goalsData?.weekly_arms || 0) > 0,
        percentage: (goalsData?.weekly_arms || 0) > 0 
          ? Math.min(((useHealthLogData 
              ? (healthStats?.weeklyArmsCounts_healthloguse || 0)
              : (healthStats?.weeklyArmsSets || 0)
            ) / goalsData.weekly_arms) * 100, 100)
          : 0
      },
      abs: {
        current: useHealthLogData 
          ? (healthStats?.weeklyAbsCounts_healthloguse || 0)
          : (healthStats?.weeklyAbsSets || 0),
        target: goalsData?.weekly_abs || 0,
        hasTarget: (goalsData?.weekly_abs || 0) > 0,
        percentage: (goalsData?.weekly_abs || 0) > 0 
          ? Math.min(((useHealthLogData 
              ? (healthStats?.weeklyAbsCounts_healthloguse || 0)
              : (healthStats?.weeklyAbsSets || 0)
            ) / goalsData.weekly_abs) * 100, 100)
          : 0
      },
      cardio: {
        current: useHealthLogData 
          ? (healthStats?.weeklyCardioCounts_healthloguse || 0)
          : (healthStats?.weeklyCardioSets || 0),
        target: goalsData?.weekly_cardio || 0,
        hasTarget: (goalsData?.weekly_cardio || 0) > 0,
        percentage: (goalsData?.weekly_cardio || 0) > 0 
          ? Math.min(((useHealthLogData 
              ? (healthStats?.weeklyCardioCounts_healthloguse || 0)
              : (healthStats?.weeklyCardioSets || 0)
            ) / goalsData.weekly_cardio) * 100, 100)
          : 0
      }
    };

    return exerciseDetails;
  };

  // 로딩 중일 때 표시할 컴포넌트
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">AI 스마트 분석</h2>
            <p className="text-gray-600 mt-2">데이터를 불러오는 중입니다...</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <div className="h-8 w-8 bg-gray-200 rounded animate-pulse" />
                  <div className="ml-4">
                    <div className="h-4 w-20 bg-gray-200 rounded animate-pulse mb-2" />
                    <div className="h-6 w-16 bg-gray-200 rounded animate-pulse" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  // 에러 상태일 때 표시할 컴포넌트
  if (hasError) {
    return (
      <div className="space-y-6">
        <div className="text-center py-16">
          <div className="text-6xl mb-4">⚠️</div>
          <h3 className="text-xl font-semibold mb-2">데이터를 불러올 수 없습니다</h3>
          <p className="text-muted-foreground mb-6">
            네트워크 연결을 확인하거나 잠시 후 다시 시도해주세요.
          </p>
          <Button onClick={handleRefresh} disabled={isRefreshing}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            새로고침
          </Button>
          <Button onClick={handleDebugTest} variant="outline" className="ml-2">
            🔧 디버깅
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">AI 스마트 분석</h2>
          <p className="text-gray-600 mt-2">
            {getPeriodLabel()} 건강 데이터를 종합 분석하여 맞춤형 인사이트를 제공합니다.
          </p>
        </div>
        <Button onClick={handleRefresh} disabled={isRefreshing} style={{ display: 'none' }}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
          새로고침
        </Button>
      </div>

      {/* 탭 네비게이션 */}
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'exercise' | 'nutrition')}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="exercise" className="flex items-center gap-2">
            <Dumbbell className="h-4 w-4" />
            운동
          </TabsTrigger>
          <TabsTrigger value="nutrition" className="flex items-center gap-2">
            <Utensils className="h-4 w-4" />
            영양
          </TabsTrigger>
        </TabsList>





        {/* 운동 분석 탭 */}
        <TabsContent value="exercise" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 운동 시간 트렌드 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Timer className="h-5 w-5 mr-2 text-green-600" />
                  운동 시간 추이
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="label" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="exerciseMinutes" fill={COLORS.secondary} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* 칼로리 소모 트렌드 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Flame className="h-5 w-5 mr-2 text-orange-600" />
                  칼로리 소모량
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="label" />
                    <YAxis />
                    <Tooltip />
                    <Area 
                      type="monotone" 
                      dataKey="exerciseCalories" 
                      stroke={COLORS.accent} 
                      fill={COLORS.accent} 
                      fillOpacity={0.6} 
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* 운동 분석 상세 */}
          <Card>
            <CardHeader>
              <CardTitle>운동 분석 상세</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <p className="text-2xl font-bold text-green-600">
                    {chartData.reduce((sum, item) => sum + (item.exerciseMinutes > 0 ? 1 : 0), 0)}회
                  </p>
                  <p className="text-sm text-gray-600">운동 일수</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-blue-600">
                    {chartData.length > 0 
                      ? Math.round(chartData.reduce((sum, item) => sum + item.exerciseMinutes, 0) / chartData.filter(item => item.exerciseMinutes > 0).length || 0)
                      : 0
                    }분
                  </p>
                  <p className="text-sm text-gray-600">평균 운동시간</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-orange-600">
                    {chartData.reduce((sum, item) => sum + item.exerciseCalories, 0)}
                  </p>
                  <p className="text-sm text-gray-600">총 칼로리</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-purple-600">
                    {chartData.reduce((streak, item, index) => {
                      if (item.exerciseMinutes > 0) {
                        return index === chartData.length - 1 || chartData[index + 1]?.exerciseMinutes === 0 ? streak + 1 : streak + 1;
                      }
                      return 0;
                    }, 0)}일
                  </p>
                  <p className="text-sm text-gray-600">최근 연속기록</p>
                </div>
              </div>
            </CardContent>
          </Card>

        </TabsContent>

        {/* 영양 분석 탭 */}
        <TabsContent value="nutrition" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 칼로리 섭취 트렌드 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Utensils className="h-5 w-5 mr-2 text-purple-600" />
                  칼로리 섭취 추이
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="label" />
                    <YAxis />
                    <Tooltip />
                    <Area 
                      type="monotone" 
                      dataKey="mealCalories" 
                      stroke={COLORS.purple} 
                      fill={COLORS.purple} 
                      fillOpacity={0.6} 
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* 식사 횟수 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Calendar className="h-5 w-5 mr-2 text-indigo-600" />
                  식사 횟수
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="label" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="mealCount" fill={COLORS.indigo} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* 목표 달성률 탭 */}
        <TabsContent value="goals" className="space-y-6">
          {/* ✅ 기간 선택 탭 추가 */}
          <Card className="bg-gradient-to-r from-blue-50 to-purple-50 border-2 border-blue-200">
            <CardHeader className="text-center">
              <CardTitle className="flex items-center justify-center text-2xl">
                <Target className="h-6 w-6 mr-2 text-blue-600" />
                목표 달성률
              </CardTitle>
              <div className="text-sm text-gray-600 mb-4">
                {goalPeriod === 'day' && new Date().toLocaleDateString('ko-KR', { 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric',
                  weekday: 'long'
                })}
                {goalPeriod === 'week' && `이번 주 (${goalAchievements.dateRange.start} ~ ${goalAchievements.dateRange.end})`}
                {goalPeriod === 'month' && `이번 달 (${new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long' })})`}
              </div>
              
              {/* ✅ 일/주/월 선택 탭 */}
              <Tabs value={goalPeriod} onValueChange={(value) => setGoalPeriod(value as 'day' | 'week' | 'month')} className="w-full">
                <TabsList className="grid w-full grid-cols-3 mb-6">
                  <TabsTrigger value="day" className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    일
                  </TabsTrigger>
                  <TabsTrigger value="week" className="flex items-center gap-2">
                    <Timer className="h-4 w-4" />
                    주
                  </TabsTrigger>
                  <TabsTrigger value="month" className="flex items-center gap-2">
                    <BarChart3 className="h-4 w-4" />
                    월
                  </TabsTrigger>
                </TabsList>
              </Tabs>
              
              {/* 점수 업데이트 버튼 */}
              <div className="text-center mb-4">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleUpdateAchievementScore}
                  className="bg-gradient-to-r from-yellow-400 to-orange-500 text-white hover:from-yellow-500 hover:to-orange-600"
                >
                  🏆 랭킹 점수 업데이트
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* 운동 그룹 */}
                <div className="p-6 bg-white rounded-xl shadow-sm border">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                    <span className="mr-2">💪</span>
                    운동 목표 달성률 (주간)
                  </h3>
                  
                  <div className="text-center mb-4">
                    <div className="relative w-24 h-24 mx-auto mb-3">
                      <svg className="w-24 h-24 transform -rotate-90" viewBox="0 0 100 100">
                        <circle cx="50" cy="50" r="40" fill="none" stroke="#e5e7eb" strokeWidth="8"/>
                        <circle 
                          cx="50" cy="50" r="40" fill="none" 
                          stroke={
                            !goalsData?.weekly_workout_target ? "#d1d5db" :
                            weeklyWorkoutCurrent >= goalsData.weekly_workout_target ? "#10b981" : 
                            weeklyWorkoutCurrent >= goalsData.weekly_workout_target * 0.5 ? "#f59e0b" : "#ef4444"
                          }
                          strokeWidth="8"
                          strokeLinecap="round"
                          strokeDasharray={`${2 * Math.PI * 40 * Math.min(((weeklyWorkoutCurrent) / (goalsData?.weekly_workout_target || 1)) * 100, 100) / 100} ${2 * Math.PI * 40}`}
                          className="transition-all duration-1000 ease-out"
                        />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-xl font-bold text-gray-800">
                          {goalsData?.weekly_workout_target 
                            ? Math.round(((weeklyWorkoutCurrent) / goalsData.weekly_workout_target) * 100)
                            : 0}%
                        </span>
                      </div>
                    </div>
                    
                    <p className="text-sm text-gray-600 mb-2">
                      {goalsData?.weekly_workout_target 
                                ? useHealthLogData 
          ? `${healthStats?.weeklyTotalCounts_healthloguse || 0}회 / ${goalsData.weekly_workout_target}회`
          : `${healthStats?.weeklyTotalSets || 0}세트 / ${goalsData.weekly_workout_target}세트`
        : useHealthLogData
          ? `${healthStats?.weeklyTotalCounts_healthloguse || 0}회 / 목표 미설정`
          : `${healthStats?.weeklyTotalSets || 0}세트 / 목표 미설정`
                      }
                    </p>
                    
                    <Badge 
                      variant={
                        !goalsData?.weekly_workout_target ? "outline" :
                        weeklyWorkoutCurrent >= goalsData.weekly_workout_target ? "default" : "secondary"
                      }
                      className="mb-3"
                    >
                      {!goalsData?.weekly_workout_target ? "목표 미설정" :
                       weeklyWorkoutCurrent >= goalsData.weekly_workout_target ? "달성!" : "진행중"}
                    </Badge>
                  </div>
                  
                  <div className="text-center">
                    <p className="text-xs text-gray-500 mb-2">주간 운동 달성 시 최대 7점</p>
                    <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                      <div 
                        className="bg-blue-500 h-2 rounded-full transition-all duration-500"
                        style={{ 
                          width: `${goalsData?.weekly_workout_target 
                            ? Math.min(((weeklyWorkoutCurrent) / goalsData.weekly_workout_target) * 100, 100)
                            : 0}%` 
                        }}
                      />
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-gray-500">현재 획득 점수</span>
                      <span className="text-sm font-bold text-blue-600">
                        {calculateExerciseScore()}점 / 7점
                      </span>
                    </div>
                  </div>
                </div>

                {/* 식단 그룹 */}
                <div className="p-6 bg-white rounded-xl shadow-sm border">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                    <span className="mr-2">🍽️</span>
                    식단 목표 달성률 (일간)
                  </h3>
                  
                  <div className="grid grid-cols-3 gap-3 mb-4">
                    {/* 탄수화물 */}
                    <div className="text-center">
                      <div className="relative w-16 h-16 mx-auto mb-2">
                        <svg className="w-16 h-16 transform -rotate-90" viewBox="0 0 100 100">
                          <circle cx="50" cy="50" r="35" fill="none" stroke="#e5e7eb" strokeWidth="8"/>
                          <circle 
                            cx="50" cy="50" r="35" fill="none" 
                            stroke={
                              !goalAchievements.nutrition.carbs.hasTarget ? "#d1d5db" :
                              goalAchievements.nutrition.carbs.percentage >= 100 ? "#10b981" : 
                              goalAchievements.nutrition.carbs.percentage >= 50 ? "#3b82f6" : "#f59e0b"
                            }
                            strokeWidth="8"
                            strokeLinecap="round"
                            strokeDasharray={`${2 * Math.PI * 35 * Math.min(goalAchievements.nutrition.carbs.percentage, 100) / 100} ${2 * Math.PI * 35}`}
                            className="transition-all duration-1000 ease-out"
                          />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="text-xs font-bold text-gray-800">
                            {Math.round(goalAchievements.nutrition.carbs.percentage)}%
                          </span>
                        </div>
                      </div>
                      <p className="text-xs text-gray-600 font-medium">탄수화물</p>
                    </div>

                    {/* 단백질 */}
                    <div className="text-center">
                      <div className="relative w-16 h-16 mx-auto mb-2">
                        <svg className="w-16 h-16 transform -rotate-90" viewBox="0 0 100 100">
                          <circle cx="50" cy="50" r="35" fill="none" stroke="#e5e7eb" strokeWidth="8"/>
                          <circle 
                            cx="50" cy="50" r="35" fill="none" 
                            stroke={
                              !goalAchievements.nutrition.protein.hasTarget ? "#d1d5db" :
                              goalAchievements.nutrition.protein.percentage >= 100 ? "#10b981" : 
                              goalAchievements.nutrition.protein.percentage >= 50 ? "#8b5cf6" : "#f59e0b"
                            }
                            strokeWidth="8"
                            strokeLinecap="round"
                            strokeDasharray={`${2 * Math.PI * 35 * Math.min(goalAchievements.nutrition.protein.percentage, 100) / 100} ${2 * Math.PI * 35}`}
                            className="transition-all duration-1000 ease-out"
                          />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="text-xs font-bold text-gray-800">
                            {Math.round(goalAchievements.nutrition.protein.percentage)}%
                          </span>
                        </div>
                      </div>
                      <p className="text-xs text-gray-600 font-medium">단백질</p>
                    </div>

                    {/* 지방 */}
                    <div className="text-center">
                      <div className="relative w-16 h-16 mx-auto mb-2">
                        <svg className="w-16 h-16 transform -rotate-90" viewBox="0 0 100 100">
                          <circle cx="50" cy="50" r="35" fill="none" stroke="#e5e7eb" strokeWidth="8"/>
                          <circle 
                            cx="50" cy="50" r="35" fill="none" 
                            stroke={
                              !goalAchievements.nutrition.fat.hasTarget ? "#d1d5db" :
                              goalAchievements.nutrition.fat.percentage >= 100 ? "#10b981" : 
                              goalAchievements.nutrition.fat.percentage >= 50 ? "#ec4899" : "#f59e0b"
                            }
                            strokeWidth="8"
                            strokeLinecap="round"
                            strokeDasharray={`${2 * Math.PI * 35 * Math.min(goalAchievements.nutrition.fat.percentage, 100) / 100} ${2 * Math.PI * 35}`}
                            className="transition-all duration-1000 ease-out"
                          />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="text-xs font-bold text-gray-800">
                            {Math.round(goalAchievements.nutrition.fat.percentage)}%
                          </span>
                        </div>
                      </div>
                      <p className="text-xs text-gray-600 font-medium">지방</p>
                    </div>
                  </div>
                  
                  <div className="text-center">
                    <p className="text-xs text-gray-500 mb-2">일일 식단 100% 달성 시 1점 (주간 최대 7점)</p>
                    <div className="text-sm text-gray-600 mb-3">
                      모든 영양소 100% 달성 시 해당 날짜 1점 획득
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-gray-500">오늘 획득 점수</span>
                      <span className="text-sm font-bold text-green-600">
                        {calculateNutritionScore()}점 / 1점
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* ✅ 기간별 목표 달성률 요약 정보 */}
              <div className="mt-6 p-4 bg-white rounded-lg border">
                <div className="text-center">
                  <h4 className="font-semibold text-gray-800 mb-2">
                    {goalPeriod === 'day' && '오늘의'}
                    {goalPeriod === 'week' && '이번 주'}
                    {goalPeriod === 'month' && '이번 달'} 
                    전체 목표 달성률
                  </h4>
                  
                  {/* ✅ 기본값인지 실제 설정된 목표인지 구분 표시 */}
                  {goalsData && goalsData.user_goal_id ? (
                    <div className="mb-3 p-2 bg-green-50 rounded-lg border border-green-200">
                      <p className="text-xs text-green-700">
                        ✅ 설정된 목표로 계산 중 (설정일: {new Date(goalsData.created_at).toLocaleDateString('ko-KR')})
                      </p>
                    </div>
                  ) : (
                    <div className="mb-3 p-2 bg-blue-50 rounded-lg border border-blue-200">
                      <p className="text-xs text-blue-700">
                        📋 기본 목표로 계산 중 (프로필에서 개인 목표를 설정하세요)
                      </p>
                    </div>
                  )}
                  
                  {goalAchievements.hasAnyTargets ? (
                    <>
                      <div className="text-3xl font-bold text-blue-600 mb-2">
                        {Math.round((
                          (goalAchievements.exercise.hasTarget ? goalAchievements.exercise.percentage : 0) +
                          (goalAchievements.nutrition.carbs.hasTarget ? goalAchievements.nutrition.carbs.percentage : 0) +
                          (goalAchievements.nutrition.protein.hasTarget ? goalAchievements.nutrition.protein.percentage : 0) +
                          (goalAchievements.nutrition.fat.hasTarget ? goalAchievements.nutrition.fat.percentage : 0)
                        ) / [
                          goalAchievements.exercise.hasTarget,
                          goalAchievements.nutrition.carbs.hasTarget,
                          goalAchievements.nutrition.protein.hasTarget,
                          goalAchievements.nutrition.fat.hasTarget
                        ].filter(Boolean).length)}%
                      </div>
                      <p className="text-sm text-gray-600">
                        {[
                          goalAchievements.exercise.hasTarget,
                          goalAchievements.nutrition.carbs.hasTarget,
                          goalAchievements.nutrition.protein.hasTarget,
                          goalAchievements.nutrition.fat.hasTarget
                        ].filter(Boolean).length}개 목표 중 {[
                          goalAchievements.exercise.hasTarget && goalAchievements.exercise.percentage >= 100 ? 1 : 0,
                          goalAchievements.nutrition.carbs.hasTarget && goalAchievements.nutrition.carbs.percentage >= 100 ? 1 : 0,
                          goalAchievements.nutrition.protein.hasTarget && goalAchievements.nutrition.protein.percentage >= 100 ? 1 : 0,
                          goalAchievements.nutrition.fat.hasTarget && goalAchievements.nutrition.fat.percentage >= 100 ? 1 : 0
                        ].reduce((a, b) => a + b, 0)}개 달성 완료
                      </p>
                    </>
                  ) : (
                    <>
                      <div className="text-2xl font-bold text-gray-400 mb-2">
                        데이터 로딩 중...
                      </div>
                      <p className="text-sm text-gray-500">
                        목표 정보를 불러오고 있습니다
                      </p>
                    </>
                  )}
                </div>
              </div>

              {/* ✅ 테스트 버튼들 */}
              <div className="mt-4 flex gap-2">
                <button
                  onClick={handleUpdateAchievementScore}
                  className="px-3 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                >
                  점수 업데이트
                </button>
                <button
                  onClick={() => {}} // Removed for clean UI
                  className="px-3 py-1 text-xs bg-green-500 text-white rounded hover:bg-green-600 transition-colors"
                >
                  순위 업데이트
                </button>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 📊 상세 운동 목표 달성률 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Activity className="h-5 w-5 mr-2 text-green-600" />
                  상세 운동 목표 달성률 (주간)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {/* 전체 운동 목표 */}
                  <div className="relative">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-medium">{useHealthLogData ? '주간 총 운동 횟수' : '주간 총 운동 세트 수'}</span>
                      <span className="text-2xl font-bold text-green-600">
                        {useHealthLogData 
                          ? `${healthStats?.weeklyTotalCounts_healthloguse || 0}회`
                          : `${healthStats?.weeklyTotalSets || 0}세트`
                        }
                    </span>
                  </div>
                    <div className="relative">
                      <Progress value={goalsData?.weekly_workout_target 
                        ? Math.min(((useHealthLogData ? (healthStats?.weeklyTotalCounts_healthloguse || 0) : (healthStats?.weeklyTotalSets || 0)) / goalsData.weekly_workout_target) * 100, 100)
                        : 0} className="h-4" />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-xs font-semibold text-white drop-shadow">
                          {goalsData?.weekly_workout_target 
                            ? Math.round(((useHealthLogData ? (healthStats?.weeklyTotalCounts_healthloguse || 0) : (healthStats?.weeklyTotalSets || 0)) / goalsData.weekly_workout_target) * 100)
                            : 0}%
                        </span>
                      </div>
                    </div>
                    <div className="flex justify-between text-sm text-gray-600 mt-1">
                                    <span>{useHealthLogData ? '0회' : '0세트'}</span>
              <span>목표: {goalsData?.weekly_workout_target || 0}{useHealthLogData ? '회' : '세트'}</span>
                    </div>
                  </div>

                  {/* 운동 부위별 목표 달성률 */}
                  {(() => {
                    const exerciseDetails = calculateDetailedExerciseData();
                    const hasAnyTarget = Object.values(exerciseDetails).some(detail => detail.hasTarget);
                    return hasAnyTarget && (
                      <div className="space-y-4">
                        <h4 className="font-medium text-gray-900">운동 부위별 달성률 ({useHealthLogData ? '횟수' : '세트 수'} 기준)</h4>
                      
                        {/* 가슴 운동 */}
                        {exerciseDetails.chest.hasTarget && (
                          <div className="bg-red-50 rounded-lg p-3">
                            <div className="flex justify-between items-center mb-2">
                              <span className="text-sm font-medium">💪 가슴 운동</span>
                              <span className="text-sm font-bold text-red-600">
                                {exerciseDetails.chest.current}{useHealthLogData ? '회' : '세트'} / {exerciseDetails.chest.target}{useHealthLogData ? '회' : '세트'}
                              </span>
                            </div>
                            <Progress value={exerciseDetails.chest.percentage} className="h-2" />
                            <div className="text-xs text-red-600 mt-1 text-center">
                              {Math.round(exerciseDetails.chest.percentage)}% 달성
                            </div>
                          </div>
                        )}

                        {/* 등 운동 */}
                        {exerciseDetails.back.hasTarget && (
                          <div className="bg-green-50 rounded-lg p-3">
                            <div className="flex justify-between items-center mb-2">
                              <span className="text-sm font-medium">🏋️‍♂️ 등 운동</span>
                              <span className="text-sm font-bold text-green-600">
                                {exerciseDetails.back.current}{useHealthLogData ? '회' : '세트'} / {exerciseDetails.back.target}{useHealthLogData ? '회' : '세트'}
                              </span>
                            </div>
                            <Progress value={exerciseDetails.back.percentage} className="h-2" />
                            <div className="text-xs text-green-600 mt-1 text-center">
                              {Math.round(exerciseDetails.back.percentage)}% 달성
                            </div>
                          </div>
                        )}

                        {/* 다리 운동 */}
                        {exerciseDetails.legs.hasTarget && (
                          <div className="bg-purple-50 rounded-lg p-3">
                            <div className="flex justify-between items-center mb-2">
                              <span className="text-sm font-medium">🦵 다리 운동</span>
                              <span className="text-sm font-bold text-purple-600">
                                {exerciseDetails.legs.current}{useHealthLogData ? '회' : '세트'} / {exerciseDetails.legs.target}{useHealthLogData ? '회' : '세트'}
                              </span>
                            </div>
                            <Progress value={exerciseDetails.legs.percentage} className="h-2" />
                            <div className="text-xs text-purple-600 mt-1 text-center">
                              {Math.round(exerciseDetails.legs.percentage)}% 달성
                            </div>
                          </div>
                        )}

                        {/* 어깨 운동 */}
                        {exerciseDetails.shoulders.hasTarget && (
                          <div className="bg-orange-50 rounded-lg p-3">
                            <div className="flex justify-between items-center mb-2">
                              <span className="text-sm font-medium">🤸‍♂️ 어깨 운동</span>
                              <span className="text-sm font-bold text-orange-600">
                                {exerciseDetails.shoulders.current}{useHealthLogData ? '회' : '세트'} / {exerciseDetails.shoulders.target}{useHealthLogData ? '회' : '세트'}
                              </span>
                            </div>
                            <Progress value={exerciseDetails.shoulders.percentage} className="h-2" />
                            <div className="text-xs text-orange-600 mt-1 text-center">
                              {Math.round(exerciseDetails.shoulders.percentage)}% 달성
                            </div>
                          </div>
                        )}

                        {/* 팔 운동 */}
                        {exerciseDetails.arms.hasTarget && (
                          <div className="bg-pink-50 rounded-lg p-3">
                            <div className="flex justify-between items-center mb-2">
                              <span className="text-sm font-medium">💪 팔 운동</span>
                              <span className="text-sm font-bold text-pink-600">
                                {exerciseDetails.arms.current}{useHealthLogData ? '회' : '세트'} / {exerciseDetails.arms.target}{useHealthLogData ? '회' : '세트'}
                              </span>
                            </div>
                            <Progress value={exerciseDetails.arms.percentage} className="h-2" />
                            <div className="text-xs text-pink-600 mt-1 text-center">
                              {Math.round(exerciseDetails.arms.percentage)}% 달성
                            </div>
                          </div>
                        )}

                        {/* 복근 운동 */}
                        {exerciseDetails.abs.hasTarget && (
                          <div className="bg-yellow-50 rounded-lg p-3">
                            <div className="flex justify-between items-center mb-2">
                              <span className="text-sm font-medium">🏃‍♀️ 복근 운동</span>
                              <span className="text-sm font-bold text-yellow-600">
                                {exerciseDetails.abs.current}{useHealthLogData ? '회' : '세트'} / {exerciseDetails.abs.target}{useHealthLogData ? '회' : '세트'}
                              </span>
                            </div>
                            <Progress value={exerciseDetails.abs.percentage} className="h-2" />
                            <div className="text-xs text-yellow-600 mt-1 text-center">
                              {Math.round(exerciseDetails.abs.percentage)}% 달성
                            </div>
                          </div>
                        )}

                        {/* 유산소 운동 */}
                        {exerciseDetails.cardio.hasTarget && (
                          <div className="bg-cyan-50 rounded-lg p-3">
                            <div className="flex justify-between items-center mb-2">
                              <span className="text-sm font-medium">🏃 유산소 운동</span>
                              <span className="text-sm font-bold text-cyan-600">
                                {exerciseDetails.cardio.current}{useHealthLogData ? '회' : '세트'} / {exerciseDetails.cardio.target}{useHealthLogData ? '회' : '세트'}
                              </span>
                            </div>
                            <Progress value={exerciseDetails.cardio.percentage} className="h-2" />
                            <div className="text-xs text-cyan-600 mt-1 text-center">
                              {Math.round(exerciseDetails.cardio.percentage)}% 달성
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* 운동 상태 메시지 */}
                  <div className={`p-4 rounded-lg border-l-4 ${
                    goalsData?.weekly_workout_target && ((useHealthLogData ? (healthStats?.weeklyTotalCounts_healthloguse || 0) : (healthStats?.weeklyTotalSets || 0)) >= goalsData.weekly_workout_target)
                      ? 'bg-green-50 border-green-500 text-green-700'
                      : goalsData?.weekly_workout_target && ((useHealthLogData ? (healthStats?.weeklyTotalCounts_healthloguse || 0) : (healthStats?.weeklyTotalSets || 0)) >= goalsData.weekly_workout_target * 0.5)
                      ? 'bg-yellow-50 border-yellow-500 text-yellow-700'
                      : 'bg-red-50 border-red-500 text-red-700'
                  }`}>
                    <div className="flex items-center">
                      {goalsData?.weekly_workout_target && ((useHealthLogData ? (healthStats?.weeklyTotalCounts_healthloguse || 0) : (healthStats?.weeklyTotalSets || 0)) >= goalsData.weekly_workout_target) ? (
                        <CheckCircle className="h-5 w-5 mr-2" />
                      ) : goalsData?.weekly_workout_target && ((useHealthLogData ? (healthStats?.weeklyTotalCounts_healthloguse || 0) : (healthStats?.weeklyTotalSets || 0)) >= goalsData.weekly_workout_target * 0.5) ? (
                        <AlertTriangle className="h-5 w-5 mr-2" />
                      ) : (
                        <X className="h-5 w-5 mr-2" />
                      )}
                      <span className="font-medium">
                        {goalsData?.weekly_workout_target && ((useHealthLogData ? (healthStats?.weeklyTotalCounts_healthloguse || 0) : (healthStats?.weeklyTotalSets || 0)) >= goalsData.weekly_workout_target)
                          ? '🎉 주간 운동 목표를 달성했습니다!'
                          : goalsData?.weekly_workout_target && ((useHealthLogData ? (healthStats?.weeklyTotalCounts_healthloguse || 0) : (healthStats?.weeklyTotalSets || 0)) >= goalsData.weekly_workout_target * 0.5)
                          ? `💪 조금만 더! ${goalsData.weekly_workout_target - (useHealthLogData ? (healthStats?.weeklyTotalCounts_healthloguse || 0) : (healthStats?.weeklyTotalSets || 0))}${useHealthLogData ? '회' : '세트'} 더 운동하면 목표 달성!`
                          : goalsData?.weekly_workout_target
                          ? `🔥 화이팅! ${goalsData.weekly_workout_target - (useHealthLogData ? (healthStats?.weeklyTotalCounts_healthloguse || 0) : (healthStats?.weeklyTotalSets || 0))}${useHealthLogData ? '회' : '세트'} 운동으로 목표를 달성해보세요!`
                          : '🎯 프로필에서 주간 운동 목표를 설정해보세요!'
                        }
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 🍎 상세 영양소 목표 달성률 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Utensils className="h-5 w-5 mr-2 text-blue-600" />
                  상세 영양소 목표 달성률 (일간)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* 탄수화물 */}
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="font-medium flex items-center">
                        🍞 탄수화물
                      </span>
                      <span className="font-bold text-blue-600">
                        {goalAchievements.nutrition.carbs.current}g / {goalAchievements.nutrition.carbs.target}g
                      </span>
                    </div>
                    <div className="relative">
                      <Progress value={goalAchievements.nutrition.carbs.percentage} className="h-3" />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-xs font-semibold text-white drop-shadow">
                          {Math.round(goalAchievements.nutrition.carbs.percentage)}%
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  {/* 단백질 */}
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="font-medium flex items-center">
                        🥩 단백질
                      </span>
                      <span className="font-bold text-purple-600">
                        {goalAchievements.nutrition.protein.current}g / {goalAchievements.nutrition.protein.target}g
                      </span>
                    </div>
                    <div className="relative">
                      <Progress value={goalAchievements.nutrition.protein.percentage} className="h-3" />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-xs font-semibold text-white drop-shadow">
                          {Math.round(goalAchievements.nutrition.protein.percentage)}%
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  {/* 지방 */}
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="font-medium flex items-center">
                        🥑 지방
                      </span>
                      <span className="font-bold text-pink-600">
                        {goalAchievements.nutrition.fat.current}g / {goalAchievements.nutrition.fat.target}g
                      </span>
                    </div>
                    <div className="relative">
                      <Progress value={goalAchievements.nutrition.fat.percentage} className="h-3" />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-xs font-semibold text-white drop-shadow">
                          {Math.round(goalAchievements.nutrition.fat.percentage)}%
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* 영양소 상태 요약 */}
                  <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                    <h4 className="font-medium text-gray-800 mb-2">📈 영양소 섭취 현황</h4>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className={`p-2 rounded ${goalAchievements.nutrition.carbs.percentage >= 80 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                        <div className="text-xs">탄수화물</div>
                        <div className="font-bold">{Math.round(goalAchievements.nutrition.carbs.percentage)}%</div>
                      </div>
                      <div className={`p-2 rounded ${goalAchievements.nutrition.protein.percentage >= 80 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                        <div className="text-xs">단백질</div>
                        <div className="font-bold">{Math.round(goalAchievements.nutrition.protein.percentage)}%</div>
                      </div>
                      <div className={`p-2 rounded ${goalAchievements.nutrition.fat.percentage >= 80 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                        <div className="text-xs">지방</div>
                        <div className="font-bold">{Math.round(goalAchievements.nutrition.fat.percentage)}%</div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
        </div>

          {/* ✅ 운동 부위별 목표 달성률 (주간만 표시) */}
          {goalPeriod === 'week' && goalAchievements.bodyParts && (
          <Card>
            <CardHeader>
                <CardTitle className="flex items-center">
                  <Dumbbell className="h-5 w-5 mr-2 text-orange-600" />
                  주간 운동 부위별 목표 달성률
                </CardTitle>
                <p className="text-sm text-gray-600">
                  이번 주 각 부위별 운동 목표 진행 현황
                </p>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
                  {/* 가슴 */}
                  <div className="text-center p-3 bg-gray-50 rounded-lg">
                    <div className="text-2xl mb-2">💪</div>
                    <h4 className="font-medium text-sm text-gray-800 mb-2">가슴</h4>
                    <div className="relative w-12 h-12 mx-auto mb-2">
                      <svg className="w-12 h-12 transform -rotate-90" viewBox="0 0 100 100">
                        <circle cx="50" cy="50" r="40" fill="none" stroke="#e5e7eb" strokeWidth="12"/>
                        <circle 
                          cx="50" cy="50" r="40" fill="none" 
                          stroke={
                            !goalAchievements.bodyParts.chest.hasTarget ? "#d1d5db" :
                            goalAchievements.bodyParts.chest.percentage >= 100 ? "#10b981" : 
                            goalAchievements.bodyParts.chest.percentage >= 50 ? "#f59e0b" : "#ef4444"
                          }
                          strokeWidth="12"
                          strokeLinecap="round"
                          strokeDasharray={`${2 * Math.PI * 40 * Math.min(goalAchievements.bodyParts.chest.percentage, 100) / 100} ${2 * Math.PI * 40}`}
                          className="transition-all duration-1000 ease-out"
                        />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-xs font-bold text-gray-800">
                          {Math.round(goalAchievements.bodyParts.chest.percentage)}%
                        </span>
                      </div>
                    </div>
                    <p className="text-xs text-gray-600">
                      {goalAchievements.bodyParts.chest.hasTarget 
                        ? `${goalAchievements.bodyParts.chest.current}분 / ${goalAchievements.bodyParts.chest.target}분`
                        : `${goalAchievements.bodyParts.chest.current}분 / 미설정`
                      }
                    </p>
                  </div>

                  {/* 등 */}
                  <div className="text-center p-3 bg-gray-50 rounded-lg">
                    <div className="text-2xl mb-2">🏋️</div>
                    <h4 className="font-medium text-sm text-gray-800 mb-2">등</h4>
                    <div className="relative w-12 h-12 mx-auto mb-2">
                      <svg className="w-12 h-12 transform -rotate-90" viewBox="0 0 100 100">
                        <circle cx="50" cy="50" r="40" fill="none" stroke="#e5e7eb" strokeWidth="12"/>
                        <circle 
                          cx="50" cy="50" r="40" fill="none" 
                          stroke={
                            !goalAchievements.bodyParts.back.hasTarget ? "#d1d5db" :
                            goalAchievements.bodyParts.back.percentage >= 100 ? "#10b981" : 
                            goalAchievements.bodyParts.back.percentage >= 50 ? "#f59e0b" : "#ef4444"
                          }
                          strokeWidth="12"
                          strokeLinecap="round"
                          strokeDasharray={`${2 * Math.PI * 40 * Math.min(goalAchievements.bodyParts.back.percentage, 100) / 100} ${2 * Math.PI * 40}`}
                          className="transition-all duration-1000 ease-out"
                        />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-xs font-bold text-gray-800">
                          {Math.round(goalAchievements.bodyParts.back.percentage)}%
                        </span>
                      </div>
                    </div>
                    <p className="text-xs text-gray-600">
                      {goalAchievements.bodyParts.back.hasTarget 
                        ? `${goalAchievements.bodyParts.back.current}분 / ${goalAchievements.bodyParts.back.target}분`
                        : `${goalAchievements.bodyParts.back.current}분 / 미설정`
                      }
                    </p>
                  </div>

                  {/* 다리 */}
                  <div className="text-center p-3 bg-gray-50 rounded-lg">
                    <div className="text-2xl mb-2">🦵</div>
                    <h4 className="font-medium text-sm text-gray-800 mb-2">다리</h4>
                    <div className="relative w-12 h-12 mx-auto mb-2">
                      <svg className="w-12 h-12 transform -rotate-90" viewBox="0 0 100 100">
                        <circle cx="50" cy="50" r="40" fill="none" stroke="#e5e7eb" strokeWidth="12"/>
                        <circle 
                          cx="50" cy="50" r="40" fill="none" 
                          stroke={
                            !goalAchievements.bodyParts.legs.hasTarget ? "#d1d5db" :
                            goalAchievements.bodyParts.legs.percentage >= 100 ? "#10b981" : 
                            goalAchievements.bodyParts.legs.percentage >= 50 ? "#f59e0b" : "#ef4444"
                          }
                          strokeWidth="12"
                          strokeLinecap="round"
                          strokeDasharray={`${2 * Math.PI * 40 * Math.min(goalAchievements.bodyParts.legs.percentage, 100) / 100} ${2 * Math.PI * 40}`}
                          className="transition-all duration-1000 ease-out"
                        />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-xs font-bold text-gray-800">
                          {Math.round(goalAchievements.bodyParts.legs.percentage)}%
                        </span>
                      </div>
                    </div>
                    <p className="text-xs text-gray-600">
                      {goalAchievements.bodyParts.legs.hasTarget 
                        ? `${goalAchievements.bodyParts.legs.current}분 / ${goalAchievements.bodyParts.legs.target}분`
                        : `${goalAchievements.bodyParts.legs.current}분 / 미설정`
                      }
                    </p>
                  </div>

                  {/* 어깨 */}
                  <div className="text-center p-3 bg-gray-50 rounded-lg">
                    <div className="text-2xl mb-2">🤲</div>
                    <h4 className="font-medium text-sm text-gray-800 mb-2">어깨</h4>
                    <div className="relative w-12 h-12 mx-auto mb-2">
                      <svg className="w-12 h-12 transform -rotate-90" viewBox="0 0 100 100">
                        <circle cx="50" cy="50" r="40" fill="none" stroke="#e5e7eb" strokeWidth="12"/>
                        <circle 
                          cx="50" cy="50" r="40" fill="none" 
                          stroke={
                            !goalAchievements.bodyParts.shoulders.hasTarget ? "#d1d5db" :
                            goalAchievements.bodyParts.shoulders.percentage >= 100 ? "#10b981" : 
                            goalAchievements.bodyParts.shoulders.percentage >= 50 ? "#f59e0b" : "#ef4444"
                          }
                          strokeWidth="12"
                          strokeLinecap="round"
                          strokeDasharray={`${2 * Math.PI * 40 * Math.min(goalAchievements.bodyParts.shoulders.percentage, 100) / 100} ${2 * Math.PI * 40}`}
                          className="transition-all duration-1000 ease-out"
                        />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-xs font-bold text-gray-800">
                          {Math.round(goalAchievements.bodyParts.shoulders.percentage)}%
                        </span>
                      </div>
                    </div>
                    <p className="text-xs text-gray-600">
                      {goalAchievements.bodyParts.shoulders.hasTarget 
                        ? `${goalAchievements.bodyParts.shoulders.current}분 / ${goalAchievements.bodyParts.shoulders.target}분`
                        : `${goalAchievements.bodyParts.shoulders.current}분 / 미설정`
                      }
                    </p>
                  </div>

                  {/* 팔 */}
                  <div className="text-center p-3 bg-gray-50 rounded-lg">
                    <div className="text-2xl mb-2">💪</div>
                    <h4 className="font-medium text-sm text-gray-800 mb-2">팔</h4>
                    <div className="relative w-12 h-12 mx-auto mb-2">
                      <svg className="w-12 h-12 transform -rotate-90" viewBox="0 0 100 100">
                        <circle cx="50" cy="50" r="40" fill="none" stroke="#e5e7eb" strokeWidth="12"/>
                        <circle 
                          cx="50" cy="50" r="40" fill="none" 
                          stroke={
                            !goalAchievements.bodyParts.arms.hasTarget ? "#d1d5db" :
                            goalAchievements.bodyParts.arms.percentage >= 100 ? "#10b981" : 
                            goalAchievements.bodyParts.arms.percentage >= 50 ? "#f59e0b" : "#ef4444"
                          }
                          strokeWidth="12"
                          strokeLinecap="round"
                          strokeDasharray={`${2 * Math.PI * 40 * Math.min(goalAchievements.bodyParts.arms.percentage, 100) / 100} ${2 * Math.PI * 40}`}
                          className="transition-all duration-1000 ease-out"
                        />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-xs font-bold text-gray-800">
                          {Math.round(goalAchievements.bodyParts.arms.percentage)}%
                        </span>
                      </div>
                    </div>
                    <p className="text-xs text-gray-600">
                      {goalAchievements.bodyParts.arms.hasTarget 
                        ? `${goalAchievements.bodyParts.arms.current}분 / ${goalAchievements.bodyParts.arms.target}분`
                        : `${goalAchievements.bodyParts.arms.current}분 / 미설정`
                      }
                    </p>
                  </div>

                  {/* 복근 */}
                  <div className="text-center p-3 bg-gray-50 rounded-lg">
                    <div className="text-2xl mb-2">🎯</div>
                    <h4 className="font-medium text-sm text-gray-800 mb-2">복근</h4>
                    <div className="relative w-12 h-12 mx-auto mb-2">
                      <svg className="w-12 h-12 transform -rotate-90" viewBox="0 0 100 100">
                        <circle cx="50" cy="50" r="40" fill="none" stroke="#e5e7eb" strokeWidth="12"/>
                        <circle 
                          cx="50" cy="50" r="40" fill="none" 
                          stroke={
                            !goalAchievements.bodyParts.abs.hasTarget ? "#d1d5db" :
                            goalAchievements.bodyParts.abs.percentage >= 100 ? "#10b981" : 
                            goalAchievements.bodyParts.abs.percentage >= 50 ? "#f59e0b" : "#ef4444"
                          }
                          strokeWidth="12"
                          strokeLinecap="round"
                          strokeDasharray={`${2 * Math.PI * 40 * Math.min(goalAchievements.bodyParts.abs.percentage, 100) / 100} ${2 * Math.PI * 40}`}
                          className="transition-all duration-1000 ease-out"
                        />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-xs font-bold text-gray-800">
                          {Math.round(goalAchievements.bodyParts.abs.percentage)}%
                        </span>
                      </div>
                    </div>
                    <p className="text-xs text-gray-600">
                      {goalAchievements.bodyParts.abs.hasTarget 
                        ? `${goalAchievements.bodyParts.abs.current}분 / ${goalAchievements.bodyParts.abs.target}분`
                        : `${goalAchievements.bodyParts.abs.current}분 / 미설정`
                      }
                    </p>
                  </div>

                  {/* 유산소 */}
                  <div className="text-center p-3 bg-gray-50 rounded-lg">
                    <div className="text-2xl mb-2">🏃</div>
                    <h4 className="font-medium text-sm text-gray-800 mb-2">유산소</h4>
                    <div className="relative w-12 h-12 mx-auto mb-2">
                      <svg className="w-12 h-12 transform -rotate-90" viewBox="0 0 100 100">
                        <circle cx="50" cy="50" r="40" fill="none" stroke="#e5e7eb" strokeWidth="12"/>
                        <circle 
                          cx="50" cy="50" r="40" fill="none" 
                          stroke={
                            !goalAchievements.bodyParts.cardio.hasTarget ? "#d1d5db" :
                            goalAchievements.bodyParts.cardio.percentage >= 100 ? "#10b981" : 
                            goalAchievements.bodyParts.cardio.percentage >= 50 ? "#f59e0b" : "#ef4444"
                          }
                          strokeWidth="12"
                          strokeLinecap="round"
                          strokeDasharray={`${2 * Math.PI * 40 * Math.min(goalAchievements.bodyParts.cardio.percentage, 100) / 100} ${2 * Math.PI * 40}`}
                          className="transition-all duration-1000 ease-out"
                        />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-xs font-bold text-gray-800">
                          {Math.round(goalAchievements.bodyParts.cardio.percentage)}%
                        </span>
                      </div>
                    </div>
                    <p className="text-xs text-gray-600">
                      {goalAchievements.bodyParts.cardio.hasTarget 
                        ? `${goalAchievements.bodyParts.cardio.current}분 / ${goalAchievements.bodyParts.cardio.target}분`
                        : `${goalAchievements.bodyParts.cardio.current}분 / 미설정`
                      }
                    </p>
                  </div>
                </div>

                {/* 부위별 목표 설정 안내 */}
                <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="flex items-center text-sm text-blue-700">
                    <Info className="h-4 w-4 mr-2" />
                    <span>
                      운동 부위별 목표는 주간 단위로 설정됩니다. 
                      exercise_catalog 테이블의 target_body_part 정보를 기반으로 계산됩니다.
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

    


    </div>
  );
}; 