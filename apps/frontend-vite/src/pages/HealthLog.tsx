import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { StatisticsCharts } from '../components/health/StatisticsCharts';
import { PythonAnalyticsCharts } from '../components/health/PythonAnalyticsCharts';
import { EnhancedHealthDashboard } from '../components/health/EnhancedHealthDashboard';
import { RecommendationPanel } from '../components/health/RecommendationPanel';
import { GoalProgress } from '../components/health/GoalProgress';
import { PeriodSelector } from '../components/health/PeriodSelector';
import { ChatInterface } from '../components/ChatInterface';
import { AIFeedbackComponent } from '../components/AIFeedback';
import { useAuth } from '../AuthContext';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { 
  BarChart3, 
  MessageSquare, 
  Activity,
  TrendingUp,
  Brain,
  Zap,
  Smartphone,
  Heart
} from 'lucide-react';
import { useHealthStatistics } from '@/api/auth';
import { getToken, getUserInfo, isLoggedIn, getUserIdFromToken } from '@/utils/auth';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Layout } from '@/components/Layout';
import { useRealTimeUpdates } from '../hooks/useRealTimeUpdates';
import ErrorBoundary from '../components/ErrorBoundary';
import { useToast } from '../components/ui/use-toast';
import { Message } from '@/api/chatApi';
import { sendChatMessage } from '@/api/chatApi';
import { saveExerciseRecord } from '@/api/chatApi';
import { createDietRecord, searchFoodItems } from '@/api/authApi';

interface HealthStatistics {
  currentWeight: number;
  weightChange: number;
  currentBMI: number;
  bmiChange: number;
  weeklyWorkouts: number;
  workoutGoal: number;
  goalAchievementRate: number;
  goalChange: number;
  totalCaloriesBurned: number;
  averageDailyCalories: number;
  streak: number;
  totalWorkoutDays: number;
}

const HealthLog: React.FC = () => {
  // 🔧 모든 Hook을 최상단에 배치 (조건부 호출 금지!)
  const { user, isLoggedIn, isLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  // State hooks
  const [activeTab, setActiveTab] = useState<'enhanced' | 'react' | 'python'>('enhanced');
  const [selectedPeriod, setSelectedPeriod] = useState<'day' | 'week' | 'month'>('week');
  
  // 각 탭별 독립적인 기간 상태
  const [reactPeriod, setReactPeriod] = useState<'day' | 'week' | 'month'>('week');
  const [pythonPeriod, setPythonPeriod] = useState<'day' | 'week' | 'month'>('week');
  
  const [recordType, setRecordType] = useState<'exercise' | 'diet'>('exercise');
  const [showChat, setShowChat] = useState(false);
  const [showAIFeedback, setShowAIFeedback] = useState(false);
  const [parsedData, setParsedData] = useState<Record<string, unknown> | null>(null);
  const [conversationHistory, setConversationHistory] = useState<Message[]>([]);

  // ChatInterface 상태
  const [chatInputText, setChatInputText] = useState('');
  const [chatIsRecording, setChatIsRecording] = useState(false);
  const [chatIsProcessing, setChatIsProcessing] = useState(false);
  const [chatNetworkError, setChatNetworkError] = useState(false);
  const [chatAiFeedback, setChatAiFeedback] = useState<Record<string, unknown> | null>(null);
  const [chatStructuredData, setChatStructuredData] = useState<Record<string, unknown> | null>(null);

  // 🔧 userId를 안전하게 계산하는 로직 (useMemo로 메모화)
  const userId = useMemo(() => {
    // 토큰에서 사용자 ID 추출 시도
    const tokenUserId = getUserIdFromToken();
    if (tokenUserId) {
      console.log('✅ [HealthLog] 토큰에서 사용자 ID 사용:', tokenUserId);
      return tokenUserId;
    }
    // 토큰에서 가져올 수 없는 경우 user 객체에서 가져오기
    const userUserId = user?.userId ? parseInt(user.userId) : null;
    console.log('🔍 [HealthLog] user 객체에서 사용자 ID:', userUserId);
    return userUserId;
  }, [user]);

  // 🔧 실시간 업데이트 Hook을 항상 호출 (조건부 호출 금지!)
  const { isConnected, refreshData, requestNotificationPermission } = useRealTimeUpdates({
    userId: userId?.toString() || '',
    enabled: true // 폴링 방식으로 활성화
  });

  // ✅ React Query Hook으로 건강 통계 조회
  const { 
    data: healthStats, 
    isLoading: healthStatsLoading, 
    error: healthStatsError,
    refetch: refetchHealthStats
  } = useHealthStatistics(userId?.toString() || '', selectedPeriod);

  const handleCloseAIFeedback = useCallback(() => {
    setShowAIFeedback(false);
    setParsedData(null);
  }, []);

  // 인증 상태 확인 (새로고침 시 토큰 재검증)
  useEffect(() => {
    // 로딩 중이면 대기
    if (isLoading) {
      console.log('⏳ [HealthLog] AuthContext 로딩 중...');
      return;
    }
    
    console.log('🔍 [HealthLog] 인증 상태 확인:', { 
      isLoggedIn, 
      user: !!user, 
      token: !!getToken(),
      userInfo: !!getUserInfo(),
      isLoading
    });
    
    // 토큰과 사용자 정보 재검증
    const token = getToken();
    const userInfo = getUserInfo();
    
    if (!token || !userInfo || !isLoggedIn) {
      console.warn('🚨 [HealthLog] 인증 정보 부족으로 로그인 페이지로 이동');
      navigate('/login');
      return;
    }
    
    console.log('✅ [HealthLog] 인증 상태 확인 완료');
  }, [navigate, isLoggedIn, user, isLoading]);

  // React Query로 데이터 조회하므로 기존 useEffect 제거
  // healthStats가 변경되면 자동으로 리렌더링됨

  // 에러 처리
  useEffect(() => {
    if (healthStatsError) {
      console.error('Failed to fetch health statistics:', healthStatsError);
        toast({
          title: "오류",
          description: "건강 데이터를 불러오는데 실패했습니다.",
          variant: "destructive"
        });
      }
  }, [healthStatsError, toast]);

  React.useEffect(() => {
    console.log('[ChatInterface 전달] recordType:', recordType);
  }, [recordType]);

  // 🔧 조건부 렌더링을 Hook 호출 이후로 이동
  if (isLoading || healthStatsLoading) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle className="text-center">로딩 중...</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-center text-gray-600">
                {isLoading ? '사용자 정보를 확인하고 있습니다.' : '건강 데이터를 불러오고 있습니다.'}
              </p>
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  if (!user || !userId) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle className="text-center">
                {!user ? '로그인이 필요합니다' : '사용자 정보 로딩 중...'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-center text-gray-600">
                {!user 
                  ? '건강 로그를 확인하려면 로그인해주세요.'
                  : '사용자 정보를 불러오는 중입니다.'
                }
              </p>
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }
  const handleHealthLogSendMessage = async () => {
    console.log('📌 [HealthLog] handleHealthLogSendMessage 진입');
    console.log('[DEBUG] 저장 시점 recordType:', recordType);
    if (!chatInputText.trim()) return;
    try {
      setChatIsProcessing(true);
      setChatNetworkError(false);
      const updatedHistory: Message[] = [
        ...conversationHistory,
        { role: 'user', content: chatInputText }
      ];
      const response = await sendChatMessage(
        chatInputText,
        updatedHistory,
        recordType
      );
      console.log('📦 AI 응답:', response);
      if (response?.parsed_data) {
        setChatStructuredData(response.parsed_data);
        setParsedData(response.parsed_data);
        // ✅ 응답 직후 저장 키워드가 있는지 검사하여 저장
        const lowered = chatInputText.toLowerCase();
        const saveKeywords = /저장해줘|기록해줘|완료|끝|등록해줘|저장|기록|등록/;
        if (saveKeywords.test(lowered)) {
          console.log('💾 [자동 저장 조건 충족] 저장 시작');
          try {
            console.log('[저장 함수 진입] recordType:', recordType, 'chatInputText:', chatInputText);
            if (recordType === 'exercise') {
              console.log('[운동기록 저장] payload:', response.parsed_data);
              await saveExerciseRecord({
                ...response.parsed_data,
                exercise_date: new Date().toISOString().slice(0, 10),
              });
              toast({
                title: "운동 기록 저장 완료",
                description: "AI 분석된 데이터를 성공적으로 저장했습니다.",
              });
            } else if (recordType === 'diet') {
              console.log('[식단기록 저장] payload:', response.parsed_data);
              type DietData = {
                food_item_id?: number;
                foodItemId?: number;
                foodItemID?: number;
                food_name?: string;
                amount?: number | string;
                quantity?: number | string;
                meal_time?: string;
                mealTime?: string;
                input_source?: string;
                confidence_score?: number;
                original_audio_path?: string;
                validation_status?: string;
                validation_notes?: string;
                created_at?: string;
              };
              const dietData: DietData = response.parsed_data;
              console.log('[식단기록] 저장 시도:', dietData);
              let foodItemId = dietData.food_item_id || dietData.foodItemId || dietData.foodItemID;
              const quantity = dietData.amount || dietData.quantity;
              if (!foodItemId && dietData.food_name) {
                const searchResults = await searchFoodItems(dietData.food_name);
                foodItemId = searchResults[0]?.foodItemId;
                console.log('[식단기록] foodItemId 검색 결과:', searchResults);
              }
              if (!foodItemId || !quantity) {
                toast({
                  title: "식단 기록 저장 실패",
                  description: "음식 정보 또는 섭취량이 부족합니다. 다시 시도해주세요.",
                  variant: "destructive",
                });
                console.error('[식단기록] 저장 실패: 음식 정보 또는 섭취량 부족', { foodItemId, quantity });
              } else {
                try {
                  const result = await createDietRecord({
                    food_item_id: foodItemId as number,
                    quantity: Number(quantity),
                    meal_time: (dietData.meal_time || dietData.mealTime || 'breakfast') as string,
                    input_source: (dietData.input_source || undefined) as string | undefined,
                    confidence_score: (dietData.confidence_score || undefined) as number | undefined,
                    original_audio_path: (dietData.original_audio_path || undefined) as string | undefined,
                    validation_status: (dietData.validation_status || undefined) as string | undefined,
                    validation_notes: (dietData.validation_notes || undefined) as string | undefined,
                    created_at: (dietData.created_at || undefined) as string | undefined,
                  });
                  console.log(`[${recordType === 'exercise' ? '운동' : '식단'} 기록 저장 성공]`, result);
                  toast({
                    title: "식단 기록 저장 완료",
                    description: "AI 분석된 데이터를 성공적으로 저장했습니다.",
                  });
                  // 그래프/식단 기록 새로고침
                  if (typeof refetchHealthStats === 'function') await refetchHealthStats();
                } catch (err) {
                  console.error(`[${recordType === 'exercise' ? '운동' : '식단'} 기록 저장 실패]`, err);
                  toast({
                    title: "식단 기록 저장 실패",
                    description: "서버에 데이터를 저장하는 데 실패했습니다.",
                    variant: "destructive",
                  });
                }
              }
            } else {
              console.warn('[방어] recordType이 diet/exercise가 아님:', recordType, response.parsed_data);
            }
            setChatStructuredData(null);
            setParsedData(null);
          } catch (err) {
            console.error('❌ 저장 실패:', err);
            toast({
              title: "저장 실패",
              description: "서버에 데이터를 저장하는 데 실패했습니다.",
              variant: "destructive",
            });
          }
        }
      }
      setConversationHistory([
        ...updatedHistory,
        { role: 'assistant', content: response.message }
      ]);
    } catch (error) {
      console.error('AI 응답 실패:', error);
      setChatNetworkError(true);
      toast({
        title: 'AI 응답 실패',
        description: '메시지 처리 중 오류가 발생했습니다.',
        variant: 'destructive'
      });
    } finally {
      setChatIsProcessing(false);
    }
  };
  
  return (
    <Layout>
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
        <div className="container mx-auto px-4 py-6 md:py-8">
          {/* 헤더 */}
          <div className="mb-6 md:mb-8">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-gray-900 flex items-center gap-2">
                  <Activity className="h-6 w-6 md:h-8 md:w-8 text-blue-600" />
                  건강 로그
                </h1>
                <p className="text-sm md:text-base text-gray-600 mt-1">
                  나의 건강 데이터를 한눈에 확인하고 분석해보세요
                </p>
              </div>
              
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="text-xs">
                  사용자 ID: {userId}
                </Badge>
                <Badge 
                  variant={isConnected ? "default" : "secondary"} 
                  className="text-xs flex items-center gap-1"
                >
                  <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-gray-400'}`}></div>
                  {isConnected ? '자동 새로고침 활성' : '비활성'}
                </Badge>
                {/* 운동/식단 기록 타입 선택 버튼 */}
                <Button
                  variant={recordType === 'exercise' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => {
                    setRecordType('exercise');
                    console.log('[DEBUG] recordType set to exercise');
                  }}
                  className="flex items-center gap-1"
                >
                  💪 운동 기록
                </Button>
                <Button
                  variant={recordType === 'diet' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => {
                    setRecordType('diet');
                    console.log('[DEBUG] recordType set to diet');
                  }}
                  className="flex items-center gap-1"
                >
                  🍽️ 식단 기록
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowChat(!showChat)}
                  className="flex items-center gap-1"
                >
                  <MessageSquare className="h-4 w-4" />
                  AI 채팅
                </Button>
              </div>
            </div>
          </div>

          {/* 기간 선택 제거 */}
          {/* 
          <div className="mb-6">
            <PeriodSelector
              selectedPeriod={selectedPeriod}
              onPeriodChange={setSelectedPeriod}
            />
          </div>
          */}

          {/* 차트 분석 탭 */}
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'enhanced' | 'react' | 'python')} className="mb-6">
            <TabsList className="grid w-full grid-cols-3 max-w-2xl">
              <TabsTrigger value="enhanced" className="flex items-center gap-2">
                <Smartphone className="h-4 w-4" />
                나의활동
              </TabsTrigger>
              <TabsTrigger value="react" className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                기본 차트
              </TabsTrigger>
              <TabsTrigger value="python" className="flex items-center gap-2">
                <Brain className="h-4 w-4" />
                AI분석
              </TabsTrigger>
            </TabsList>

            {/* 향상된 UI 탭 */}
            <TabsContent value="enhanced" className="mt-6">
              <div className="bg-white rounded-xl shadow-sm border p-1 mb-4">
                <div className="flex items-center gap-2 text-sm text-blue-600 bg-blue-50 rounded-lg p-3">
                  <Heart className="h-4 w-4" />
                  <span className="font-medium">사용자 제공 UI를 반영한 향상된 건강 대시보드</span>
                </div>
              </div>
              
              <ErrorBoundary>
                <EnhancedHealthDashboard 
                  userId={userId?.toString() || ''} 
                  period={selectedPeriod}
                />
              </ErrorBoundary>
            </TabsContent>

            <TabsContent value="react" className="mt-6">
              {/* 기간 선택 - 기본 차트용 */}
              <div className="mb-6">
                <PeriodSelector
                  selectedPeriod={reactPeriod}
                  onPeriodChange={setReactPeriod}
                />
              </div>
              
              {/* 기존 React 차트 */}
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 md:gap-6 mb-6 md:mb-8">
                {/* 왼쪽: 통계 차트 (모바일에서는 전체 너비, 데스크톱에서는 2/3) */}
                <div className="xl:col-span-2">
                  <ErrorBoundary>
                    <StatisticsCharts 
                      userId={userId?.toString() || ''} 
                      period={reactPeriod}
                    />
                  </ErrorBoundary>
                </div>
                
                {/* 오른쪽: 추천 패널 (모바일에서는 전체 너비, 데스크톱에서는 1/3) */}
                <div className="xl:col-span-1">
                  <ErrorBoundary>
                    <RecommendationPanel 
                      userId={userId?.toString() || ''}
                    />
                  </ErrorBoundary>
                </div>
              </div>
              
              {/* 하단: 목표 진행률 */}
              <div>
                <ErrorBoundary>
                  <GoalProgress 
                    userId={userId?.toString() || ''}
                    period={reactPeriod}
                  />
                </ErrorBoundary>
              </div>
            </TabsContent>

            <TabsContent value="python" className="mt-6">
              {/* 기간 선택 - AI분석용 */}
              <div className="mb-6">
                <PeriodSelector
                  selectedPeriod={pythonPeriod}
                  onPeriodChange={setPythonPeriod}
                />
              </div>
              
              {/* AI 고급 분석 차트 */}
              <div className="bg-white rounded-xl shadow-sm border p-1 mb-4">
                <div className="flex items-center gap-2 text-sm text-purple-600 bg-purple-50 rounded-lg p-3">
                  <Zap className="h-4 w-4" />
                  <span className="font-medium">AI 기반 고급 데이터 분석 및 인사이트</span>
                </div>
              </div>
              
              <ErrorBoundary>
                <PythonAnalyticsCharts 
                  userId={userId || 0} 
                  period={pythonPeriod}
                />
              </ErrorBoundary>
            </TabsContent>
          </Tabs>

          {/* 채팅 인터페이스 */}
          {showChat && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-lg w-full max-w-2xl h-96 flex flex-col">
                <div className="flex items-center justify-between p-4 border-b">
                  <h3 className="text-lg font-semibold">AI 건강 상담</h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowChat(false)}
                  >
                    ✕
                  </Button>
                </div>
                <div className="flex-1">
                  <ChatInterface 
                    recordType={recordType}
                    inputText={chatInputText}
                    setInputText={setChatInputText}
                    isRecording={chatIsRecording}
                    isProcessing={chatIsProcessing}
                    networkError={chatNetworkError}
                    onVoiceToggle={() => setChatIsRecording(!chatIsRecording)}
                    onSendMessage={handleHealthLogSendMessage}
                    onRetry={() => setChatNetworkError(false)}
                    aiFeedback={null}
                    onSaveRecord={async () => {
                      console.log('💾 [onSaveRecord] 실행됨');
                      console.log('💾 [전송 데이터] ', chatStructuredData);
                      if (!chatStructuredData) return;
                    
                      try {
                        if (recordType === 'exercise') {
                          await saveExerciseRecord({
                            ...chatStructuredData,
                            exercise_date: new Date().toISOString().slice(0, 10),
                          });
                          toast({
                            title: "운동 기록 저장 완료",
                            description: "AI 분석된 데이터를 성공적으로 저장했습니다."
                          });
                        } else if (recordType === 'diet') {
                          type DietData = {
                            food_item_id?: number;
                            foodItemId?: number;
                            foodItemID?: number;
                            food_name?: string;
                            amount?: number | string;
                            quantity?: number | string;
                            meal_time?: string;
                            mealTime?: string;
                            input_source?: string;
                            confidence_score?: number;
                            original_audio_path?: string;
                            validation_status?: string;
                            validation_notes?: string;
                            created_at?: string;
                          };
                          const dietData: DietData = chatStructuredData;
                          console.log('[식단기록] 저장 시도:', dietData);
                          let foodItemId = dietData.food_item_id || dietData.foodItemId || dietData.foodItemID;
                          const quantity = dietData.amount || dietData.quantity;
                          if (!foodItemId && dietData.food_name) {
                            const searchResults = await searchFoodItems(dietData.food_name);
                            foodItemId = searchResults[0]?.foodItemId;
                            console.log('[식단기록] foodItemId 검색 결과:', searchResults);
                          }
                          if (!foodItemId || !quantity) {
                            toast({
                              title: "식단 기록 저장 실패",
                              description: "음식 정보 또는 섭취량이 부족합니다. 다시 시도해주세요.",
                              variant: "destructive"
                            });
                            console.error('[식단기록] 저장 실패: 음식 정보 또는 섭취량 부족', { foodItemId, quantity });
                          } else {
                            try {
                              const result = await createDietRecord({
                                food_item_id: foodItemId as number,
                                quantity: Number(quantity),
                                meal_time: (dietData.meal_time || dietData.mealTime || 'breakfast') as string,
                                input_source: (dietData.input_source || undefined) as string | undefined,
                                confidence_score: (dietData.confidence_score || undefined) as number | undefined,
                                original_audio_path: (dietData.original_audio_path || undefined) as string | undefined,
                                validation_status: (dietData.validation_status || undefined) as string | undefined,
                                validation_notes: (dietData.validation_notes || undefined) as string | undefined,
                                created_at: (dietData.created_at || undefined) as string | undefined,
                              });
                              console.log(`[${recordType === 'exercise' ? '운동' : '식단'} 기록 저장 성공]`, result);
                              toast({
                                title: "식단 기록 저장 완료",
                                description: "AI 분석된 데이터를 성공적으로 저장했습니다.",
                              });
                              // 그래프/식단 기록 새로고침
                              if (typeof refetchHealthStats === 'function') await refetchHealthStats();
                            } catch (err) {
                              console.error(`[${recordType === 'exercise' ? '운동' : '식단'} 기록 저장 실패]`, err);
                              toast({
                                title: "식단 기록 저장 실패",
                                description: "서버에 데이터를 저장하는 데 실패했습니다.",
                                variant: "destructive",
                              });
                            }
                          }
                        } else {
                          console.warn('[방어] recordType이 diet/exercise가 아님:', recordType, chatStructuredData);
                        }
                        setChatStructuredData(null);
                        setParsedData(null);
                      } catch (error) {
                        console.error('저장 오류:', error);
                        toast({
                          title: "저장 실패",
                          description: "서버에 데이터를 저장하는 데 실패했습니다.",
                          variant: "destructive"
                        });
                      }
                    }}
                    structuredData={chatStructuredData}
                    conversationHistory={conversationHistory}
                  />
                </div>
              </div>
            </div>
          )}

          {/* AI 피드백 */}
          {showAIFeedback && parsedData && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-lg w-full max-w-2xl max-h-96 overflow-y-auto">
                <div className="p-4">
                  <h3 className="text-lg font-semibold mb-2">AI 피드백</h3>
                  <p>데이터가 성공적으로 처리되었습니다.</p>
                  <Button onClick={handleCloseAIFeedback} className="mt-4">
                    닫기
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* 구조화된 데이터 미리보기 */}
          {parsedData && (
            <div className="mt-6">
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-medium mb-2">데이터 처리 결과</h3>
                <pre className="text-sm whitespace-pre-wrap">
                  {JSON.stringify(parsedData, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default HealthLog;
