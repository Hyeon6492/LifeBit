import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axiosInstance from '@/utils/axios';
// import { supabase } from '../lib/supabase'; // TODO: Supabase 설정 후 주석 해제

// ============================================================================
// 타입 정의 (TypeScript 인터페이스)
// ============================================================================

// 건강 기록 관련 타입
export interface HealthRecord {
  health_record_id: number;
  uuid: string;
  user_id: number;
  weight: number;
  bmi: number;
  record_date: string;
  created_at: string;
}

// 사용자 목표 관련 타입
export interface UserGoal {
  user_goal_id: number;
  uuid: string;
  user_id: number;
  weekly_workout_target: number;
  daily_carbs_target: number;
  daily_protein_target: number;
  daily_fat_target: number;
  created_at: string;
  updated_at: string;
}

// 운동 세션 관련 타입
export interface ExerciseSession {
  exercise_session_id: number;
  uuid: string;
  user_id: number;
  exercise_catalog_id: number;
  duration_minutes: number;
  calories_burned: number;
  notes: string;
  exercise_date: string;
  created_at: string;
}

// 식단 기록 관련 타입
export interface MealLog {
  meal_log_id: number;
  uuid: string;
  user_id: number;
  food_item_id: number;
  quantity: number;
  log_date: string;
  created_at: string;
}

// 건강 통계 관련 타입
export interface HealthStatistics {
  total_records: number;
  average_weight: number;
  average_bmi: number;
  weight_trend: 'increasing' | 'decreasing' | 'stable';
  bmi_category: '저체중' | '정상' | '과체중' | '비만';
  goal_completion_rate: number;
}

// 추천 관련 타입
export interface Recommendation {
  recommendation_id: number;
  uuid: string;
  user_id: number;
  recommendation_data: {
    exercise_recommendations: Array<{
      type: string;
      duration: number;
      intensity: string;
      reason: string;
    }>;
    nutrition_recommendations: Array<{
      type: string;
      food: string;
      amount: string;
      reason: string;
    }>;
    health_tips: Array<{
      tip: string;
      priority: 'high' | 'medium' | 'low';
    }>;
  };
  created_at: string;
}

// API 요청 데이터 타입
export interface CreateHealthRecordData {
  user_id: number;
  weight: number;
  bmi: number;
  record_date: string;
}

export interface UpdateGoalData {
  weekly_workout_target?: number;
  daily_carbs_target?: number;
  daily_protein_target?: number;
  daily_fat_target?: number;
}

export interface CreateExerciseData {
  user_id: number;
  exercise_catalog_id: number;
  duration_minutes: number;
  calories_burned: number;
  notes?: string;
  exercise_date: string;
}

export interface CreateMealData {
  user_id: number;
  food_item_id: number;
  quantity: number;
  log_date: string;
}

export interface FeedbackData {
  feedback_type: string;
  feedback_data: Record<string, unknown>;
}

// ExerciseState 인터페이스 추가 (최상단에 추가)
interface ExerciseState {
  exercise?: string;
  category?: string;
  subcategory?: string;
  time_period?: string;
  weight?: number;
  sets?: number;
  reps?: number;
  duration_min?: number;
}

// ============================================================================
// API 함수들 (백엔드와 통신하는 함수들)
// ============================================================================

// API 호출을 위한 헬퍼 함수의 옵션 타입 정의 추가
interface ApiCallOptions {
  method?: string;
  data?: unknown;
  params?: Record<string, string | number | boolean | undefined>;
}

// API 호출을 위한 헬퍼 함수 수정
const apiCall = async (endpoint: string, options: ApiCallOptions = {}) => {
  const { method = 'GET', data, params } = options;
  
  try {
    const response = await axiosInstance({
      url: endpoint,
      method,
      data,
      params, // params 추가
    });
    
    return response.data;
  } catch (error: unknown) {
    const axiosError = error as { response?: { status?: number; statusText?: string }; message?: string };
    console.error('🚨 API Call Error:', {
      endpoint,
      method,
      status: axiosError.response?.status,
      message: axiosError.message
    });
    throw new Error(`API 호출 실패: ${axiosError.response?.status || 'Unknown'} ${axiosError.response?.statusText || axiosError.message}`);
  }
};

// 건강 기록 관련 API 함수들
export const healthApi = {
  // 건강 기록 조회
  getHealthRecords: async (userId: string, period: string = 'month'): Promise<HealthRecord[]> => {
    return apiCall(`/api/health-records/${userId}?period=${period}`);
  },

  // 건강 기록 생성
  createHealthRecord: async (data: CreateHealthRecordData): Promise<HealthRecord> => {
    return apiCall('/api/health-records', {
      method: 'POST',
      data,
    });
  },

  // 사용자 목표 조회
  getUserGoals: async (userId: string): Promise<UserGoal> => {
    return apiCall(`/api/user-goals/${userId}`);
  },

  // 사용자 목표 업데이트
  updateUserGoals: async (userId: string, data: UpdateGoalData): Promise<UserGoal> => {
    return apiCall(`/api/user-goals/${userId}`, {
      method: 'PUT',
      data,
    });
  },

  // 운동 세션 조회
  getExerciseSessions: async (userId: string, period: string = 'month'): Promise<ExerciseSession[]> => {
    return apiCall(`/api/exercise-sessions/${userId}?period=${period}`);
  },

  // 운동 세션 생성
  createExerciseSession: async (data: CreateExerciseData): Promise<ExerciseSession> => {
    return apiCall('/api/exercise-sessions', {
      method: 'POST',
      data,
    });
  },

  // 식단 기록 조회
  getMealLogs: async (userId: string, period: string = 'month'): Promise<MealLog[]> => {
    return apiCall(`/api/meal-logs/${userId}?period=${period}`);
  },

  // 식단 기록 생성
  createMealLog: async (data: CreateMealData): Promise<MealLog> => {
    return apiCall('/api/meal-logs', {
      method: 'POST',
      data,
    });
  },

  // 건강 통계 조회
  getHealthStatistics: async (userId: string, period: string = 'month'): Promise<HealthStatistics> => {
    return apiCall(`/api/health-statistics/${userId}?period=${period}`);
  },

  // 추천 조회
  getRecommendations: async (userId: string): Promise<Recommendation[]> => {
    return apiCall(`/api/recommendations/${userId}`);
  },

  // 피드백 제출
  submitFeedback: async (recommendationId: string, feedback: FeedbackData): Promise<void> => {
    return apiCall(`/api/recommendations/${recommendationId}/feedback`, {
      method: 'POST',
      data: feedback,
    });
  },

  // 실시간 업데이트 구독 (임시 구현)
  subscribeToHealthUpdates: (userId: string, callback: (data: Record<string, unknown>) => void) => {
    // TODO: Supabase 설정 후 실제 구현으로 교체
    console.log('실시간 구독 시작:', userId);
    
    // 임시로 5초마다 더미 데이터 전송
    const interval = setInterval(() => {
      callback({
        type: 'health_update',
        timestamp: new Date().toISOString(),
        user_id: userId,
      });
    }, 5000);

    // 구독 해제 함수 반환
    return {
      unsubscribe: () => {
        clearInterval(interval);
        console.log('실시간 구독 해제:', userId);
      },
    };
  },
};

// ============================================================================
// React Query 훅들 (데이터 페칭 및 캐싱)
// ============================================================================

// 건강 기록 조회 훅
export const useHealthRecords = (userId: string, period: string = 'month') => {
  return useQuery({
    queryKey: ['healthRecords', userId, period],
    queryFn: () => healthApi.getHealthRecords(userId, period),
    staleTime: 5 * 60 * 1000, // 5분간 캐시 유지
    gcTime: 10 * 60 * 1000, // 10분간 가비지 컬렉션 지연
  });
};

// 사용자 목표 조회 훅
export const useUserGoals = (userId: string) => {
  return useQuery({
    queryKey: ['userGoals', userId],
    queryFn: () => healthApi.getUserGoals(userId),
    staleTime: 10 * 60 * 1000, // 10분간 캐시 유지
    gcTime: 30 * 60 * 1000, // 30분간 가비지 컬렉션 지연
  });
};

// 운동 세션 조회 훅
export const useExerciseSessions = (userId: string, period: string = 'month') => {
  return useQuery({
    queryKey: ['exerciseSessions', userId, period],
    queryFn: () => healthApi.getExerciseSessions(userId, period),
    staleTime: 5 * 60 * 1000, // 5분간 캐시 유지
    gcTime: 10 * 60 * 1000, // 10분간 가비지 컬렉션 지연
  });
};

// 식단 기록 조회 훅
export const useMealLogs = (userId: string, period: string = 'month') => {
  return useQuery({
    queryKey: ['mealLogs', userId, period],
    queryFn: () => healthApi.getMealLogs(userId, period),
    staleTime: 5 * 60 * 1000, // 5분간 캐시 유지
    gcTime: 10 * 60 * 1000, // 10분간 가비지 컬렉션 지연
  });
};

// 건강 통계 조회 훅
export const useHealthStatistics = (userId: string, period: string = 'month') => {
  return useQuery({
    queryKey: ['healthStatistics', userId, period],
    queryFn: () => healthApi.getHealthStatistics(userId, period),
    staleTime: 10 * 60 * 1000, // 10분간 캐시 유지
    gcTime: 30 * 60 * 1000, // 30분간 가비지 컬렉션 지연
  });
};

// 추천 조회 훅
export const useRecommendations = (userId: string) => {
  return useQuery({
    queryKey: ['recommendations', userId],
    queryFn: () => healthApi.getRecommendations(userId),
    staleTime: 30 * 60 * 1000, // 30분간 캐시 유지
    gcTime: 60 * 60 * 1000, // 1시간간 가비지 컬렉션 지연
  });
};

// ============================================================================
// 뮤테이션 훅들 (데이터 수정)
// ============================================================================

// 건강 기록 생성 뮤테이션
export const useCreateHealthRecord = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: healthApi.createHealthRecord,
    onSuccess: (data) => {
      // 관련 쿼리 무효화하여 데이터 새로고침
      queryClient.invalidateQueries({
        queryKey: ['healthRecords', data.user_id],
      });
      queryClient.invalidateQueries({
        queryKey: ['healthStatistics', data.user_id],
      });
    },
    onError: (error) => {
      console.error('건강 기록 생성 실패:', error);
    },
  });
};

// 사용자 목표 업데이트 뮤테이션
export const useUpdateUserGoals = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userId, data }: { userId: string; data: UpdateGoalData }) =>
      healthApi.updateUserGoals(userId, data),
    onSuccess: (data, variables) => {
      // 관련 쿼리 무효화
      queryClient.invalidateQueries({
        queryKey: ['userGoals', variables.userId],
      });
      queryClient.invalidateQueries({
        queryKey: ['healthStatistics', variables.userId],
      });
    },
    onError: (error) => {
      console.error('사용자 목표 업데이트 실패:', error);
    },
  });
};

// 운동 세션 생성 뮤테이션
export const useCreateExerciseSession = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: healthApi.createExerciseSession,
    onSuccess: (data) => {
      // 관련 쿼리 무효화
      queryClient.invalidateQueries({
        queryKey: ['exerciseSessions', data.user_id],
      });
      queryClient.invalidateQueries({
        queryKey: ['healthStatistics', data.user_id],
      });
    },
    onError: (error) => {
      console.error('운동 세션 생성 실패:', error);
    },
  });
};

// 식단 기록 생성 뮤테이션
export const useCreateMealLog = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: healthApi.createMealLog,
    onSuccess: (data) => {
      // 관련 쿼리 무효화
      queryClient.invalidateQueries({
        queryKey: ['mealLogs', data.user_id],
      });
      queryClient.invalidateQueries({
        queryKey: ['healthStatistics', data.user_id],
      });
    },
    onError: (error) => {
      console.error('식단 기록 생성 실패:', error);
    },
  });
};

// 피드백 제출 뮤테이션
export const useSubmitFeedback = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ recommendationId, feedback }: { recommendationId: string; feedback: FeedbackData }) =>
      healthApi.submitFeedback(recommendationId, feedback),
    onSuccess: (data, variables) => {
      // 추천 관련 쿼리 무효화
      queryClient.invalidateQueries({
        queryKey: ['recommendations'],
      });
    },
    onError: (error) => {
      console.error('피드백 제출 실패:', error);
    },
  });
};

// ============================================================================
// 실시간 업데이트 훅
// ============================================================================

// 실시간 건강 데이터 업데이트 구독 훅
export const useHealthRealtime = (userId: string) => {
  const queryClient = useQueryClient();

  React.useEffect(() => {
    const subscription = healthApi.subscribeToHealthUpdates(userId, (data) => {
      console.log('실시간 데이터 업데이트:', data);
      
      // 실시간 데이터 업데이트 시 관련 쿼리들 무효화
      queryClient.invalidateQueries({
        queryKey: ['healthRecords', userId],
      });
      queryClient.invalidateQueries({
        queryKey: ['userGoals', userId],
      });
      queryClient.invalidateQueries({
        queryKey: ['recommendations', userId],
      });
      queryClient.invalidateQueries({
        queryKey: ['healthStatistics', userId],
      });
    });

    // 컴포넌트 언마운트 시 구독 해제
    return () => {
      subscription.unsubscribe();
    };
  }, [userId, queryClient]);
};

// ============================================================================
// 유틸리티 함수들
// ============================================================================

// BMI 계산 함수
export const calculateBMI = (weight: number, height: number): number => {
  const heightInMeters = height / 100;
  return Number((weight / (heightInMeters * heightInMeters)).toFixed(2));
};

// BMI 카테고리 판정 함수
export const getBMICategory = (bmi: number): string => {
  if (bmi < 18.5) return '저체중';
  if (bmi < 25) return '정상';
  if (bmi < 30) return '과체중';
  return '비만';
};

// 목표 달성률 계산 함수
export const calculateGoalCompletionRate = (
  current: number,
  target: number
): number => {
  if (target === 0) return 0;
  return Math.min(Math.round((current / target) * 100), 100);
};

// 날짜 포맷팅 함수
export const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

// 시간 포맷팅 함수
export const formatTime = (minutes: number): string => {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  
  if (hours > 0) {
    return `${hours}시간 ${mins}분`;
  }
  return `${mins}분`;
};

// 칼로리 포맷팅 함수
export const formatCalories = (calories: number): string => {
  return `${calories.toLocaleString()} kcal`;
};

console.log('=== 토큰 상태 확인 ===');
console.log('access_token:', localStorage.getItem('access_token'));
console.log('userInfo:', localStorage.getItem('userInfo'));
console.log('모든 localStorage 키:', Object.keys(localStorage));

// saveExerciseRecord 함수 수정
export const saveExerciseRecord = async (exerciseData: ExerciseState): Promise<ExerciseSession> => {
  try {
    // 사용자 정보 가져오기
    const userInfo = localStorage.getItem('userInfo');
    const userId = userInfo ? JSON.parse(userInfo).userId : null;

    if (!userId) {
      throw new Error('사용자 정보를 찾을 수 없습니다.');
    }

    // 1. 운동 카탈로그 검색
    const catalogResponse = await apiCall('/api/exercises/search', {
      method: 'GET',
      params: { keyword: exerciseData.exercise || '알 수 없는 운동' }
    });

    let catalogId;
    
    // 2. 카탈로그 생성 또는 검색
    if (Array.isArray(catalogResponse) && catalogResponse.length > 0) {
      catalogId = catalogResponse[0].exerciseCatalogId;
    } else {
      // 새로운 운동 종목 생성
      const newCatalog = await apiCall('/api/exercises/catalog', {
        method: 'POST',
        data: {
          name: exerciseData.exercise || '알 수 없는 운동',
          bodyPart: exerciseData.subcategory || '기타',
          description: `${exerciseData.category || '기타'} - ${exerciseData.subcategory || '기타'}`
        }
      });
      catalogId = newCatalog.exerciseCatalogId;
    }

    // 3. 운동 세션 생성
    const sessionData: CreateExerciseData = {
      user_id: userId,
      exercise_catalog_id: catalogId,
      duration_minutes: exerciseData.duration_min || calculateDurationMinutes(exerciseData),
      calories_burned: calculateCalories(exerciseData),
      notes: formatExerciseNotes(exerciseData),
      exercise_date: new Date().toISOString().split('T')[0]
    };

    const response = await apiCall('/api/exercises/record', {
      method: 'POST',
      data: sessionData
    });

    return response as ExerciseSession;
  } catch (error) {
    console.error('Exercise record save error:', error);
    throw new Error('운동 기록 저장 중 오류가 발생했습니다.');
  }
};

// 헬퍼 함수들 수정
const calculateDurationMinutes = (exerciseData: ExerciseState): number => {
  if (exerciseData.duration_min && exerciseData.duration_min > 0) {
    return exerciseData.duration_min;
  }
  // 근력운동의 경우 세트당 약 2분으로 계산
  if (exerciseData.category === '근력운동' && exerciseData.sets) {
    return exerciseData.sets * 2;
  }
  return 30; // 기본값
};

const formatExerciseNotes = (exerciseData: ExerciseState): string => {
  if (exerciseData.category === '근력운동') {
    const weight = exerciseData.weight || 0;
    const sets = exerciseData.sets || 0;
    const reps = exerciseData.reps || 0;
    return `${weight}kg x ${sets}세트 x ${reps}회 (${exerciseData.time_period || '시간 미지정'})`;
  }
  const duration = exerciseData.duration_min || calculateDurationMinutes(exerciseData);
  return `${duration}분 ${exerciseData.category || '운동'} (${exerciseData.time_period || '시간 미지정'})`;
};

const calculateCalories = (exerciseData: ExerciseState): number => {
  if (exerciseData.category === '유산소운동') {
    const duration = exerciseData.duration_min || 30;
    // 유산소 운동은 분당 8칼로리로 계산 (간단한 추정)
    return Math.round(duration * 8);
  }
  
  // 근력운동 칼로리 계산
  const weight = exerciseData.weight || 0;
  const sets = exerciseData.sets || 0;
  const reps = exerciseData.reps || 0;
  // 무게 * 세트 * 횟수 * 0.1의 공식으로 간단히 추정
  const baseCalories = weight * sets * reps * 0.1;
  return Math.round(Math.max(baseCalories, 50)); // 최소 50칼로리 보장
};

export default healthApi; 