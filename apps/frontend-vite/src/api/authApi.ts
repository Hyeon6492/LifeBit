import axiosInstance from '@/utils/axios';
import { setToken, setUserInfo } from '@/utils/auth';
import { useMutation, useQueryClient } from '@tanstack/react-query';

// ============================================================================
// 로그인 관련 타입들
// ============================================================================

interface LoginResponse {
  access_token: string;
  user_id: string;
  email: string;
  nickname: string;
  role: string;
  provider: string;
}

interface LoginRequest {
  email: string;
  password: string;
  rememberMe?: boolean;
}

// ============================================================================
// 건강 기록 관련 타입들
// ============================================================================

// 건강 기록 데이터 타입
export interface HealthRecord {
  health_record_id: number;
  uuid: string;
  user_id: number;
  weight?: number;
  height?: number;
  bmi?: number;
  record_date: string;
  created_at: string;
}

// 건강 기록 생성 요청 타입
export interface HealthRecordCreateRequest {
  weight?: number;
  height?: number;
  record_date?: string; // YYYY-MM-DD 형식, 없으면 오늘 날짜
}

// 건강 기록 수정 요청 타입
export interface HealthRecordUpdateRequest {
  weight?: number;
  height?: number;
  record_date?: string; // YYYY-MM-DD 형식
}

// API 응답 타입
export interface HealthRecordResponse {
  health_record_id: number;
  uuid: string;
  user_id: number;
  weight?: number;
  height?: number;
  bmi?: number;
  record_date: string;
  created_at: string;
}

// 에러 응답 타입
interface ErrorResponse {
  error: string;
  message: string;
}

// ============================================================================
// 식단 기록 관련 타입들
// ============================================================================

// 식단 기록 데이터 타입 (Note.tsx의 DietLogDTO 기반)
export interface DietRecord {
  id: number;
  userId: number;
  foodItemId: number;
  foodName: string;
  quantity: number;
  calories: number;
  carbs: number;
  protein: number;
  fat: number;
  logDate: string;
  unit: string;
  mealTime?: string; // ENUM: breakfast, lunch, dinner, snack
  inputSource?: string; // ENUM: VOICE, TYPING
  confidenceScore?: number;
  originalAudioPath?: string;
  validationStatus?: string; // ENUM: PENDING, VALIDATED, REJECTED
  validationNotes?: string;
  createdAt?: string;
}

// 식단 기록 생성 요청 타입
export interface DietRecordCreateRequest {
  food_item_id: number;
  quantity: number;
  meal_time?: string;
  input_source?: string;
  confidence_score?: number;
  original_audio_path?: string;
  validation_status?: string;
  validation_notes?: string;
  created_at?: string;
}

// 식단 기록 수정 요청 타입
export interface DietRecordUpdateRequest {
  quantity?: number;
  meal_time?: string;
  input_source?: string;
  confidence_score?: number;
  original_audio_path?: string;
  validation_status?: string;
  validation_notes?: string;
}

// 식품 아이템 타입
export interface FoodItem {
  foodItemId: number;
  name: string;
  calories: number;
  carbs: number;
  protein: number;
  fat: number;
  servingSize: number;
}

// ============================================================================
// 운동 세션 관련 타입들
// ============================================================================

// 운동 세션 데이터 타입 (auth.ts의 ExerciseSession 기반)
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

// 운동 세션 생성 요청 타입
export interface ExerciseSessionCreateRequest {
  exercise_catalog_id: number;
  duration_minutes: number;
  calories_burned?: number;
  notes?: string;
  exercise_date?: string; // YYYY-MM-DD 형식, 없으면 오늘 날짜
  sets?: number;
  reps?: number;
  weight?: number;
}

// 운동 세션 수정 요청 타입
export interface ExerciseSessionUpdateRequest {
  exercise_catalog_id?: number;
  duration_minutes?: number;
  calories_burned?: number;
  notes?: string;
  exercise_date?: string; // YYYY-MM-DD 형식
  sets?: number;
  reps?: number;
  weight?: number;
}

// 운동 카탈로그 타입
export interface ExerciseCatalog {
  exercise_catalog_id: number;
  name: string;
  category: string;
  target_body_part: string;
  calories_per_minute: number;
  description?: string;
}

// ============================================================================
// 사용자 목표 관련 타입들
// ============================================================================

// 사용자 목표 데이터 타입 (auth.ts의 UserGoal 기반)
export interface UserGoal {
  user_goal_id: number;
  uuid: string;
  user_id: number;
  weekly_workout_target: number;
  daily_carbs_target: number;
  daily_protein_target: number;
  daily_fat_target: number;
  daily_calories_target?: number;
  target_weight?: number;
  created_at: string;
  updated_at: string;
}

// 사용자 목표 생성 요청 타입
export interface UserGoalCreateRequest {
  weekly_workout_target: number;
  daily_carbs_target: number;
  daily_protein_target: number;
  daily_fat_target: number;
  daily_calories_target?: number;
  target_weight?: number;
}

// 사용자 목표 수정 요청 타입
export interface UserGoalUpdateRequest {
  weekly_workout_target?: number;
  daily_carbs_target?: number;
  daily_protein_target?: number;
  daily_fat_target?: number;
  daily_calories_target?: number;
  target_weight?: number;
}

// ============================================================================
// 로그인 API
// ============================================================================

export const login = async (credentials: LoginRequest): Promise<LoginResponse> => {
  try {
    const response = await axiosInstance.post<LoginResponse>('/api/auth/login', credentials);
    const { access_token, ...userInfo } = response.data;
    
    // 토큰 저장
    setToken(access_token);
    
    // 사용자 정보 저장
    setUserInfo({
      userId: userInfo.user_id,
      email: userInfo.email,
      nickname: userInfo.nickname,
      role: userInfo.role
    });
    
    return response.data;
  } catch (error: unknown) {
    if (error instanceof Error && 'response' in error) {
      const axiosError = error as { response?: { data?: { message?: string } } };
      if (axiosError.response?.data?.message) {
        throw new Error(axiosError.response.data.message);
      }
    }
    throw new Error('로그인 중 오류가 발생했습니다.');
  }
}; 

// ============================================================================
// 건강 기록 CRUD API 함수들
// ============================================================================

/**
 * 건강 기록 생성
 * @param data 건강 기록 생성 데이터 (체중, 키, 날짜)
 * @returns 생성된 건강 기록 정보
 */
export const createHealthRecord = async (data: HealthRecordCreateRequest): Promise<HealthRecordResponse> => {
  try {
    console.log('🏥 [API] 건강 기록 생성 요청:', data);
    
    const response = await axiosInstance.post<HealthRecordResponse>('/api/health-records', data);
    
    console.log('✅ [API] 건강 기록 생성 성공:', response.data);
    return response.data;
  } catch (error: unknown) {
    console.error('❌ [API] 건강 기록 생성 실패:', error);
    
    if (error instanceof Error && 'response' in error) {
      const axiosError = error as { response?: { data?: ErrorResponse } };
      if (axiosError.response?.data?.message) {
        throw new Error(axiosError.response.data.message);
      }
    }
    throw new Error('건강 기록 생성 중 오류가 발생했습니다.');
  }
};

/**
 * 건강 기록 수정
 * @param recordId 수정할 건강 기록 ID
 * @param data 수정할 데이터
 * @returns 수정된 건강 기록 정보
 */
export const updateHealthRecord = async (
  recordId: number, 
  data: HealthRecordUpdateRequest
): Promise<HealthRecordResponse> => {
  try {
    console.log('🏥 [API] 건강 기록 수정 요청:', { recordId, data });
    
    const response = await axiosInstance.put<HealthRecordResponse>(`/api/health-records/${recordId}`, data);
    
    console.log('✅ [API] 건강 기록 수정 성공:', response.data);
    return response.data;
  } catch (error: unknown) {
    console.error('❌ [API] 건강 기록 수정 실패:', error);
    
    if (error instanceof Error && 'response' in error) {
      const axiosError = error as { response?: { data?: ErrorResponse } };
      if (axiosError.response?.data?.message) {
        throw new Error(axiosError.response.data.message);
      }
    }
    throw new Error('건강 기록 수정 중 오류가 발생했습니다.');
  }
};

/**
 * 건강 기록 삭제
 * @param recordId 삭제할 건강 기록 ID
 * @returns 삭제 성공 여부
 */
export const deleteHealthRecord = async (recordId: number): Promise<{ success: boolean; message: string }> => {
  try {
    console.log('🏥 [API] 건강 기록 삭제 요청:', recordId);
    
    await axiosInstance.delete(`/api/health-records/${recordId}`);
    
    console.log('✅ [API] 건강 기록 삭제 성공:', recordId);
    return { success: true, message: '건강 기록이 성공적으로 삭제되었습니다.' };
  } catch (error: unknown) {
    console.error('❌ [API] 건강 기록 삭제 실패:', error);
    
    if (error instanceof Error && 'response' in error) {
      const axiosError = error as { response?: { data?: ErrorResponse } };
      if (axiosError.response?.data?.message) {
        throw new Error(axiosError.response.data.message);
      }
    }
    throw new Error('건강 기록 삭제 중 오류가 발생했습니다.');
  }
};

/**
 * 특정 건강 기록 조회
 * @param recordId 조회할 건강 기록 ID
 * @returns 건강 기록 정보
 */
export const getHealthRecord = async (recordId: number): Promise<HealthRecordResponse> => {
  try {
    console.log('🏥 [API] 건강 기록 조회 요청:', recordId);
    
    const response = await axiosInstance.get<HealthRecordResponse>(`/api/health-records/record/${recordId}`);
    
    console.log('✅ [API] 건강 기록 조회 성공:', response.data);
    return response.data;
  } catch (error: unknown) {
    console.error('❌ [API] 건강 기록 조회 실패:', error);
    
    if (error instanceof Error && 'response' in error) {
      const axiosError = error as { response?: { data?: ErrorResponse } };
      if (axiosError.response?.data?.message) {
        throw new Error(axiosError.response.data.message);
      }
    }
    throw new Error('건강 기록 조회 중 오류가 발생했습니다.');
  }
};

// ============================================================================
// React Query Hooks - 건강 기록 CRUD
// ============================================================================

/**
 * 건강 기록 생성 Hook
 * @returns 건강 기록 생성 mutation
 */
export const useCreateHealthRecord = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: createHealthRecord,
    onSuccess: (data) => {
      console.log('🎉 건강 기록 생성 성공:', data);
      
      // 관련 캐시 무효화하여 최신 데이터 반영
      queryClient.invalidateQueries({ queryKey: ['health-records'] });
      queryClient.invalidateQueries({ queryKey: ['health-statistics'] });
    },
    onError: (error) => {
      console.error('💥 건강 기록 생성 실패:', error);
    }
  });
};

/**
 * 건강 기록 수정 Hook
 * @returns 건강 기록 수정 mutation
 */
export const useUpdateHealthRecord = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ recordId, data }: { recordId: number; data: HealthRecordUpdateRequest }) => 
      updateHealthRecord(recordId, data),
    onSuccess: (data) => {
      console.log('🎉 건강 기록 수정 성공:', data);
      
      // 관련 캐시 무효화하여 최신 데이터 반영
      queryClient.invalidateQueries({ queryKey: ['health-records'] });
      queryClient.invalidateQueries({ queryKey: ['health-statistics'] });
    },
    onError: (error) => {
      console.error('💥 건강 기록 수정 실패:', error);
    }
  });
};

/**
 * 건강 기록 삭제 Hook
 * @returns 건강 기록 삭제 mutation
 */
export const useDeleteHealthRecord = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: deleteHealthRecord,
    onSuccess: (data) => {
      console.log('🎉 건강 기록 삭제 성공:', data);
      
      // 관련 캐시 무효화하여 최신 데이터 반영
      queryClient.invalidateQueries({ queryKey: ['health-records'] });
      queryClient.invalidateQueries({ queryKey: ['health-statistics'] });
    },
    onError: (error) => {
      console.error('💥 건강 기록 삭제 실패:', error);
    }
  });
};

// ============================================================================
// 식단 기록 CRUD API 함수들
// ============================================================================

/**
 * 식단 기록 생성
 * @param data 식단 기록 생성 데이터
 * @returns 생성된 식단 기록 정보
 */
export const createDietRecord = async (data: DietRecordCreateRequest): Promise<DietRecord> => {
  try {
    console.log('🍽️ [API] 식단 기록 생성 요청:', data);
    
    const response = await axiosInstance.post<DietRecord>('/api/diet/record', data);
    
    console.log('✅ [API] 식단 기록 생성 성공:', response.data);
    return response.data;
  } catch (error: unknown) {
    console.error('❌ [API] 식단 기록 생성 실패:', error);
    
    if (error instanceof Error && 'response' in error) {
      const axiosError = error as { response?: { data?: ErrorResponse } };
      if (axiosError.response?.data?.message) {
        throw new Error(axiosError.response.data.message);
      }
    }
    throw new Error('식단 기록 생성 중 오류가 발생했습니다.');
  }
};

/**
 * 식단 기록 수정
 * @param recordId 수정할 식단 기록 ID
 * @param data 수정할 데이터
 * @returns 수정된 식단 기록 정보
 */
export const updateDietRecord = async (
  recordId: number, 
  data: DietRecordUpdateRequest
): Promise<DietRecord> => {
  try {
    console.log('🍽️ [API] 식단 기록 수정 요청:', { recordId, data });
    
    const response = await axiosInstance.put<DietRecord>(`/api/diet/record/${recordId}`, data);
    
    console.log('✅ [API] 식단 기록 수정 성공:', response.data);
    return response.data;
  } catch (error: unknown) {
    console.error('❌ [API] 식단 기록 수정 실패:', error);
    
    if (error instanceof Error && 'response' in error) {
      const axiosError = error as { response?: { data?: ErrorResponse } };
      if (axiosError.response?.data?.message) {
        throw new Error(axiosError.response.data.message);
      }
    }
    throw new Error('식단 기록 수정 중 오류가 발생했습니다.');
  }
};

/**
 * 식단 기록 삭제
 * @param recordId 삭제할 식단 기록 ID
 * @returns 삭제 성공 여부
 */
export const deleteDietRecord = async (recordId: number): Promise<{ success: boolean; message: string }> => {
  try {
    console.log('🍽️ [API] 식단 기록 삭제 요청:', recordId);
    
    await axiosInstance.delete(`/api/diet/record/${recordId}`);
    
    console.log('✅ [API] 식단 기록 삭제 성공:', recordId);
    return { success: true, message: '식단 기록이 성공적으로 삭제되었습니다.' };
  } catch (error: unknown) {
    console.error('❌ [API] 식단 기록 삭제 실패:', error);
    
    if (error instanceof Error && 'response' in error) {
      const axiosError = error as { response?: { data?: ErrorResponse } };
      if (axiosError.response?.data?.message) {
        throw new Error(axiosError.response.data.message);
      }
    }
    throw new Error('식단 기록 삭제 중 오류가 발생했습니다.');
  }
};

/**
 * 일별 식단 기록 조회
 * @param date 조회할 날짜 (YYYY-MM-DD)
 * @param userId 사용자 ID
 * @returns 일별 식단 기록 목록
 */
export const getDailyDietRecords = async (date: string, userId: number): Promise<DietRecord[]> => {
  try {
    console.log('🍽️ [API] 일별 식단 기록 조회 요청:', { date, userId });
    
    const response = await axiosInstance.get<DietRecord[]>(`/api/diet/daily-records/${date}`, {
      params: { userId }
    });
    
    console.log('✅ [API] 일별 식단 기록 조회 성공:', response.data);
    return response.data;
  } catch (error: unknown) {
    console.error('❌ [API] 일별 식단 기록 조회 실패:', error);
    
    if (error instanceof Error && 'response' in error) {
      const axiosError = error as { response?: { data?: ErrorResponse } };
      if (axiosError.response?.data?.message) {
        throw new Error(axiosError.response.data.message);
      }
    }
    throw new Error('일별 식단 기록 조회 중 오류가 발생했습니다.');
  }
};

/**
 * 식품 검색
 * @param keyword 검색 키워드
 * @returns 검색된 식품 목록
 */
export const searchFoodItems = async (keyword: string): Promise<FoodItem[]> => {
  try {
    console.log('🔍 [API] 식품 검색 요청:', keyword);
    
    const response = await axiosInstance.get<FoodItem[]>('/api/diet/food-items/search', {
      params: { keyword }
    });
    
    console.log('✅ [API] 식품 검색 성공:', response.data);
    return response.data;
  } catch (error: unknown) {
    console.error('❌ [API] 식품 검색 실패:', error);
    
    if (error instanceof Error && 'response' in error) {
      const axiosError = error as { response?: { data?: ErrorResponse } };
      if (axiosError.response?.data?.message) {
        throw new Error(axiosError.response.data.message);
      }
    }
    throw new Error('식품 검색 중 오류가 발생했습니다.');
  }
};

// ============================================================================
// React Query Hooks - 식단 기록 CRUD
// ============================================================================

/**
 * 식단 기록 생성 Hook
 * @returns 식단 기록 생성 mutation
 */
export const useCreateDietRecord = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: createDietRecord,
    onSuccess: (data) => {
      console.log('🎉 식단 기록 생성 성공:', data);
      
      // 관련 캐시 무효화하여 최신 데이터 반영
      queryClient.invalidateQueries({ queryKey: ['diet-records'] });
      queryClient.invalidateQueries({ queryKey: ['health-statistics'] });
      queryClient.invalidateQueries({ queryKey: ['meal-logs'] });
    },
    onError: (error) => {
      console.error('💥 식단 기록 생성 실패:', error);
    }
  });
};

/**
 * 식단 기록 수정 Hook
 * @returns 식단 기록 수정 mutation
 */
export const useUpdateDietRecord = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ recordId, data }: { recordId: number; data: DietRecordUpdateRequest }) => 
      updateDietRecord(recordId, data),
    onSuccess: (data) => {
      console.log('🎉 식단 기록 수정 성공:', data);
      
      // 관련 캐시 무효화하여 최신 데이터 반영
      queryClient.invalidateQueries({ queryKey: ['diet-records'] });
      queryClient.invalidateQueries({ queryKey: ['health-statistics'] });
      queryClient.invalidateQueries({ queryKey: ['meal-logs'] });
    },
    onError: (error) => {
      console.error('💥 식단 기록 수정 실패:', error);
    }
  });
};

/**
 * 식단 기록 삭제 Hook
 * @returns 식단 기록 삭제 mutation
 */
export const useDeleteDietRecord = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: deleteDietRecord,
    onSuccess: (data) => {
      console.log('🎉 식단 기록 삭제 성공:', data);
      
      // 관련 캐시 무효화하여 최신 데이터 반영
      queryClient.invalidateQueries({ queryKey: ['diet-records'] });
      queryClient.invalidateQueries({ queryKey: ['health-statistics'] });
      queryClient.invalidateQueries({ queryKey: ['meal-logs'] });
    },
    onError: (error) => {
      console.error('💥 식단 기록 삭제 실패:', error);
    }
  });
};

// ============================================================================
// 운동 세션 CRUD API 함수들
// ============================================================================

/**
 * 운동 세션 생성
 * @param data 운동 세션 생성 데이터
 * @returns 생성된 운동 세션 정보
 */
export const createExerciseSession = async (data: ExerciseSessionCreateRequest): Promise<ExerciseSession> => {
  try {
    console.log('💪 [API] 운동 세션 생성 요청:', data);
    
    const response = await axiosInstance.post<ExerciseSession>('/api/exercise-sessions', data);
    
    console.log('✅ [API] 운동 세션 생성 성공:', response.data);
    return response.data;
  } catch (error: unknown) {
    console.error('❌ [API] 운동 세션 생성 실패:', error);
    
    if (error instanceof Error && 'response' in error) {
      const axiosError = error as { response?: { data?: ErrorResponse } };
      if (axiosError.response?.data?.message) {
        throw new Error(axiosError.response.data.message);
      }
    }
    throw new Error('운동 세션 생성 중 오류가 발생했습니다.');
  }
};

/**
 * 운동 세션 수정
 * @param sessionId 수정할 운동 세션 ID
 * @param data 수정할 데이터
 * @returns 수정된 운동 세션 정보
 */
export const updateExerciseSession = async (
  sessionId: number, 
  data: ExerciseSessionUpdateRequest
): Promise<ExerciseSession> => {
  try {
    console.log('💪 [API] 운동 세션 수정 요청:', { sessionId, data });
    
    const response = await axiosInstance.put<ExerciseSession>(`/api/exercise-sessions/${sessionId}`, data);
    
    console.log('✅ [API] 운동 세션 수정 성공:', response.data);
    return response.data;
  } catch (error: unknown) {
    console.error('❌ [API] 운동 세션 수정 실패:', error);
    
    if (error instanceof Error && 'response' in error) {
      const axiosError = error as { response?: { data?: ErrorResponse } };
      if (axiosError.response?.data?.message) {
        throw new Error(axiosError.response.data.message);
      }
    }
    throw new Error('운동 세션 수정 중 오류가 발생했습니다.');
  }
};

/**
 * 운동 세션 삭제
 * @param sessionId 삭제할 운동 세션 ID
 * @returns 삭제 성공 여부
 */
export const deleteExerciseSession = async (sessionId: number): Promise<{ success: boolean; message: string }> => {
  try {
    console.log('💪 [API] 운동 세션 삭제 요청:', sessionId);
    
    await axiosInstance.delete(`/api/exercise-sessions/${sessionId}`);
    
    console.log('✅ [API] 운동 세션 삭제 성공:', sessionId);
    return { success: true, message: '운동 세션이 성공적으로 삭제되었습니다.' };
  } catch (error: unknown) {
    console.error('❌ [API] 운동 세션 삭제 실패:', error);
    
    if (error instanceof Error && 'response' in error) {
      const axiosError = error as { response?: { data?: ErrorResponse } };
      if (axiosError.response?.data?.message) {
        throw new Error(axiosError.response.data.message);
      }
    }
    throw new Error('운동 세션 삭제 중 오류가 발생했습니다.');
  }
};

/**
 * 특정 운동 세션 조회
 * @param sessionId 조회할 운동 세션 ID
 * @returns 운동 세션 정보
 */
export const getExerciseSession = async (sessionId: number): Promise<ExerciseSession> => {
  try {
    console.log('💪 [API] 운동 세션 조회 요청:', sessionId);
    
    const response = await axiosInstance.get<ExerciseSession>(`/api/exercise-sessions/session/${sessionId}`);
    
    console.log('✅ [API] 운동 세션 조회 성공:', response.data);
    return response.data;
  } catch (error: unknown) {
    console.error('❌ [API] 운동 세션 조회 실패:', error);
    
    if (error instanceof Error && 'response' in error) {
      const axiosError = error as { response?: { data?: ErrorResponse } };
      if (axiosError.response?.data?.message) {
        throw new Error(axiosError.response.data.message);
      }
    }
    throw new Error('운동 세션 조회 중 오류가 발생했습니다.');
  }
};

/**
 * 운동 카탈로그 조회
 * @returns 운동 카탈로그 목록
 */
export const getExerciseCatalog = async (): Promise<ExerciseCatalog[]> => {
  try {
    console.log('💪 [API] 운동 카탈로그 조회 요청');
    
    const response = await axiosInstance.get<ExerciseCatalog[]>('/api/exercise-catalog');
    
    console.log('✅ [API] 운동 카탈로그 조회 성공:', response.data);
    return response.data;
  } catch (error: unknown) {
    console.error('❌ [API] 운동 카탈로그 조회 실패:', error);
    
    if (error instanceof Error && 'response' in error) {
      const axiosError = error as { response?: { data?: ErrorResponse } };
      if (axiosError.response?.data?.message) {
        throw new Error(axiosError.response.data.message);
      }
    }
    throw new Error('운동 카탈로그 조회 중 오류가 발생했습니다.');
  }
};

// ============================================================================
// React Query Hooks - 운동 세션 CRUD
// ============================================================================

/**
 * 운동 세션 생성 Hook
 * @returns 운동 세션 생성 mutation
 */
export const useCreateExerciseSession = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: createExerciseSession,
    onSuccess: (data) => {
      console.log('🎉 운동 세션 생성 성공:', data);
      
      // 관련 캐시 무효화하여 최신 데이터 반영
      queryClient.invalidateQueries({ queryKey: ['exercise-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['health-statistics'] });
    },
    onError: (error) => {
      console.error('💥 운동 세션 생성 실패:', error);
    }
  });
};

/**
 * 운동 세션 수정 Hook
 * @returns 운동 세션 수정 mutation
 */
export const useUpdateExerciseSession = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ sessionId, data }: { sessionId: number; data: ExerciseSessionUpdateRequest }) => 
      updateExerciseSession(sessionId, data),
    onSuccess: (data) => {
      console.log('🎉 운동 세션 수정 성공:', data);
      
      // 관련 캐시 무효화하여 최신 데이터 반영
      queryClient.invalidateQueries({ queryKey: ['exercise-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['health-statistics'] });
    },
    onError: (error) => {
      console.error('💥 운동 세션 수정 실패:', error);
    }
  });
};

/**
 * 운동 세션 삭제 Hook
 * @returns 운동 세션 삭제 mutation
 */
export const useDeleteExerciseSession = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: deleteExerciseSession,
    onSuccess: (data) => {
      console.log('🎉 운동 세션 삭제 성공:', data);
      
      // 관련 캐시 무효화하여 최신 데이터 반영
      queryClient.invalidateQueries({ queryKey: ['exercise-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['health-statistics'] });
    },
    onError: (error) => {
      console.error('💥 운동 세션 삭제 실패:', error);
    }
  });
};

// ============================================================================
// 사용자 목표 CRUD API 함수들
// ============================================================================

/**
 * 사용자 목표 생성
 * @param data 사용자 목표 생성 데이터
 * @returns 생성된 사용자 목표 정보
 */
export const createUserGoal = async (data: UserGoalCreateRequest): Promise<UserGoal> => {
  try {
    console.log('🎯 [API] 사용자 목표 생성 요청:', data);
    
    const response = await axiosInstance.post<UserGoal>('/api/user-goals', data);
    
    console.log('✅ [API] 사용자 목표 생성 성공:', response.data);
    return response.data;
  } catch (error: unknown) {
    console.error('❌ [API] 사용자 목표 생성 실패:', error);
    
    if (error instanceof Error && 'response' in error) {
      const axiosError = error as { response?: { data?: ErrorResponse } };
      if (axiosError.response?.data?.message) {
        throw new Error(axiosError.response.data.message);
      }
    }
    throw new Error('사용자 목표 생성 중 오류가 발생했습니다.');
  }
};

/**
 * 사용자 목표 수정
 * @param goalId 수정할 사용자 목표 ID
 * @param data 수정할 데이터
 * @returns 수정된 사용자 목표 정보
 */
export const updateUserGoal = async (
  goalId: number, 
  data: UserGoalUpdateRequest
): Promise<UserGoal> => {
  try {
    console.log('🎯 [API] 사용자 목표 수정 요청:', { goalId, data });
    
    const response = await axiosInstance.put<UserGoal>(`/api/user-goals/${goalId}`, data);
    
    console.log('✅ [API] 사용자 목표 수정 성공:', response.data);
    return response.data;
  } catch (error: unknown) {
    console.error('❌ [API] 사용자 목표 수정 실패:', error);
    
    if (error instanceof Error && 'response' in error) {
      const axiosError = error as { response?: { data?: ErrorResponse } };
      if (axiosError.response?.data?.message) {
        throw new Error(axiosError.response.data.message);
      }
    }
    throw new Error('사용자 목표 수정 중 오류가 발생했습니다.');
  }
};

/**
 * 사용자 목표 삭제
 * @param goalId 삭제할 사용자 목표 ID
 * @returns 삭제 성공 여부
 */
export const deleteUserGoal = async (goalId: number): Promise<{ success: boolean; message: string }> => {
  try {
    console.log('🎯 [API] 사용자 목표 삭제 요청:', goalId);
    
    await axiosInstance.delete(`/api/user-goals/${goalId}`);
    
    console.log('✅ [API] 사용자 목표 삭제 성공:', goalId);
    return { success: true, message: '사용자 목표가 성공적으로 삭제되었습니다.' };
  } catch (error: unknown) {
    console.error('❌ [API] 사용자 목표 삭제 실패:', error);
    
    if (error instanceof Error && 'response' in error) {
      const axiosError = error as { response?: { data?: ErrorResponse } };
      if (axiosError.response?.data?.message) {
        throw new Error(axiosError.response.data.message);
      }
    }
    throw new Error('사용자 목표 삭제 중 오류가 발생했습니다.');
  }
};

/**
 * 특정 사용자 목표 조회
 * @param goalId 조회할 사용자 목표 ID
 * @returns 사용자 목표 정보
 */
export const getUserGoal = async (goalId: number): Promise<UserGoal> => {
  try {
    console.log('🎯 [API] 사용자 목표 조회 요청:', goalId);
    
    const response = await axiosInstance.get<UserGoal>(`/api/user-goals/goal/${goalId}`);
    
    console.log('✅ [API] 사용자 목표 조회 성공:', response.data);
    return response.data;
  } catch (error: unknown) {
    console.error('❌ [API] 사용자 목표 조회 실패:', error);
    
    if (error instanceof Error && 'response' in error) {
      const axiosError = error as { response?: { data?: ErrorResponse } };
      if (axiosError.response?.data?.message) {
        throw new Error(axiosError.response.data.message);
      }
    }
    throw new Error('사용자 목표 조회 중 오류가 발생했습니다.');
  }
};

// ============================================================================
// React Query Hooks - 사용자 목표 CRUD
// ============================================================================

/**
 * 사용자 목표 생성 Hook
 * @returns 사용자 목표 생성 mutation
 */
export const useCreateUserGoal = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: createUserGoal,
    onSuccess: (data) => {
      console.log('🎉 사용자 목표 생성 성공:', data);
      
      // 관련 캐시 무효화하여 최신 데이터 반영
      queryClient.invalidateQueries({ queryKey: ['user-goals'] });
      queryClient.invalidateQueries({ queryKey: ['health-statistics'] });
    },
    onError: (error) => {
      console.error('💥 사용자 목표 생성 실패:', error);
    }
  });
};

/**
 * 사용자 목표 수정 Hook
 * @returns 사용자 목표 수정 mutation
 */
export const useUpdateUserGoal = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ goalId, data }: { goalId: number; data: UserGoalUpdateRequest }) => 
      updateUserGoal(goalId, data),
    onSuccess: (data) => {
      console.log('🎉 사용자 목표 수정 성공:', data);
      
      // 관련 캐시 무효화하여 최신 데이터 반영
      queryClient.invalidateQueries({ queryKey: ['user-goals'] });
      queryClient.invalidateQueries({ queryKey: ['health-statistics'] });
    },
    onError: (error) => {
      console.error('💥 사용자 목표 수정 실패:', error);
    }
  });
};

/**
 * 사용자 목표 삭제 Hook
 * @returns 사용자 목표 삭제 mutation
 */
export const useDeleteUserGoal = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: deleteUserGoal,
    onSuccess: (data) => {
      console.log('🎉 사용자 목표 삭제 성공:', data);
      
      // 관련 캐시 무효화하여 최신 데이터 반영
      queryClient.invalidateQueries({ queryKey: ['user-goals'] });
      queryClient.invalidateQueries({ queryKey: ['health-statistics'] });
    },
    onError: (error) => {
      console.error('💥 사용자 목표 삭제 실패:', error);
    }
  });
};