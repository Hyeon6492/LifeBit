import { Layout } from '@/components/Layout';
import { useToast } from '@/hooks/use-toast';
import { useState, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Activity, Heart } from 'lucide-react';
import { ChatInterface } from '@/components/ChatInterface';
import { sendChatMessage, Message, ChatResponse } from '@/api/chatApi';
import {
  convertTimeToMealType,
  hasTimeInformation,
  getCurrentMealType,
  getMealTimeDescription,
  type MealTimeType
} from '@/utils/mealTimeMapping';
import { safeConvertMealTime } from '../utils/mealTimeConverter';
import { getUserIdFromToken, getToken } from '@/utils/auth';
import { useAuth } from '@/AuthContext';
import { useNavigate } from 'react-router-dom';
import { estimateGramsWithGPT } from '@/utils/nutritionUtils';
import axios from '@/utils/axios';
import { createAiAxiosInstance } from '@/utils/axios';

type DietData = {
  food_item_id?: number;
  foodItemId?: number;
  food_name: string;
  amount: number | string;
  meal_time?: string;
  input_source?: string;
  confidence_score?: number;
  original_audio_path?: string;
  validation_status?: string;
  validation_notes?: string;
  created_at?: string;
  log_date?: string;
  // nutrition 필드 제거: Spring Boot CRUD API 사용으로 영양성분 계산 불필요
};

type SimpleDietData = Omit<DietData, 'amount'> & { amount: string };

// 🕐 현재 시간대 판단 함수 (DB ENUM에 맞춤)
const getCurrentTimePeriod = (): string => {
  const hour = new Date().getHours();
  if (hour >= 4 && hour < 8) return 'dawn';      // 새벽 4-8시
  if (hour >= 8 && hour < 12) return 'morning';   // 오전 8-12시
  if (hour >= 12 && hour < 18) return 'afternoon'; // 오후 12-18시
  if (hour >= 18 && hour < 22) return 'evening';   // 저녁 18-22시
  return 'night'; // 밤 22-4시
};

// 운동 부위 한글→영문 ENUM 변환 함수 추가
const bodyPartToEnum = (kor: string): string | null => {
  switch (kor.trim()) {
    case '가슴': return 'chest';
    case '등': return 'back';
    case '하체': case '다리': return 'legs';
    case '어깨': return 'shoulders';
    case '팔': return 'arms';
    case '복근': return 'abs';
    case '유산소': case '유산소운동': case 'cardio': return 'cardio';
    default:
      return null;
  }
};

const Index = () => {
  const { toast } = useToast();
  const [recordType, setRecordType] = useState<'exercise' | 'diet' | null>(null);
  const [showChat, setShowChat] = useState(false);
  const [chatInputText, setChatInputText] = useState('');
  const [chatIsRecording, setChatIsRecording] = useState(false);
  const [chatIsProcessing, setChatIsProcessing] = useState(false);
  const [chatNetworkError, setChatNetworkError] = useState(false);
  const [chatAiFeedback, setChatAiFeedback] = useState<ChatResponse | null>(null);
  const [chatStructuredData, setChatStructuredData] = useState<ChatResponse['parsed_data'] | null>(null);
  const [conversationHistory, setConversationHistory] = useState<Message[]>([]);
  const [chatStep, setChatStep] = useState<'extraction' | 'validation' | 'confirmation'>('extraction');

  // 식단 기록용 추가 상태들
  const [currentMealFoods, setCurrentMealFoods] = useState<SimpleDietData[]>([]);
  const [isAddingMoreFood, setIsAddingMoreFood] = useState(false);
  const [currentMealTime, setCurrentMealTime] = useState<MealTimeType | null>(null);

  const navigate = useNavigate();

  const [hasSaved, setHasSaved] = useState(false);

  const aiAxiosInstance = createAiAxiosInstance();

  /**
   * 식단 데이터의 완성도를 검증하는 함수
   */
  const validateDietData = (data: any): { isComplete: boolean; missingInfo: string[] } => {
    const missing: string[] = [];
    if (!data?.food_name && !data?.name) missing.push('음식명');
    if (!data?.amount && !data?.quantity && !data?.quantity_g) missing.push('섭취량');
    if (!data?.meal_time) missing.push('식사시간');
    return {
      isComplete: missing.length === 0,
      missingInfo: missing
    };
  };

  /**
   * 사용자 입력에서 시간 정보를 추출하고 식사 카테고리로 변환
   */
  const processMealTime = (userInput: string, currentMealTime?: string): { mealTime: MealTimeType; needsTimeConfirmation: boolean } => {
    // 이미 유효한 식사 카테고리가 있는 경우
    if (currentMealTime && ['아침', '점심', '저녁', '야식', '간식'].includes(currentMealTime)) {
      return { mealTime: currentMealTime as MealTimeType, needsTimeConfirmation: false };
    }

    // 사용자 입력에서 시간 정보 추출
    if (hasTimeInformation(userInput)) {
      const convertedTime = convertTimeToMealType(userInput);
      if (convertedTime) {
        return { mealTime: convertedTime, needsTimeConfirmation: false };
      }
    }

    // 시간 정보가 없으면 현재 시간 기준으로 추천
    const currentMeal = getCurrentMealType();
    return { mealTime: currentMeal, needsTimeConfirmation: true };
  };

  /**
   * 식단 확인 메시지를 일관된 스타일로 생성
   */
  const generateDietConfirmationMessage = (data: ChatResponse['parsed_data']): string => {
    if (!data?.food_name) return '식단 정보를 확인해주세요.';

    const foodName = data.food_name;
    const amount = data.amount || '적당량';
    const mealTime = data.meal_time || '식사';

    return `${foodName} ${amount}을(를) ${mealTime}에 드신 것이 맞나요? 영양 정보를 확인해보세요! 🍽️`;
  };

  const handleDummySend = () => {
    console.log('🧪 Index에서 onSendMessage 실행됨');
    // 최소한의 테스트 메시지 → 나중에 자동저장 로직이 완성되면 제거 가능
  };

  const handleSendMessage = async (retryCount = 0, transcript?: string) => {
    const maxRetries = 2;
    const messageToSend = transcript ?? chatInputText;
    if (!messageToSend.trim() || !recordType) return;

    // ✅ 저장 키워드 감지 로직 추가
    const lowered = messageToSend.toLowerCase();
    const saveKeywords = /^(저장|기록|완료|끝|등록|저장해|저장해줘|기록해|기록해줘|등록해|등록해줘)$/;

    let structuredData = chatStructuredData;
    let userId = getUserIdFromToken();

    if (saveKeywords.test(lowered) && !hasSaved) {
      console.log('\ud83d\udcbe [Index] \uc800\uc7a5 \ud0a4\uc6cc\ub4dc \uac10\uc9c0');

      // \ud544\uc218 \uc815\ubcf4 \uccb4\ud06c
      if (!structuredData) {
        // 직전 AI 응답에서 복구 시도
        if (chatAiFeedback?.parsed_data) {
          // ✅ system_message.data 구조도 지원
          if (chatAiFeedback.parsed_data.system_message && chatAiFeedback.parsed_data.system_message.data) {
            structuredData = chatAiFeedback.parsed_data.system_message.data;
            setChatStructuredData(structuredData);
          }
          // ✅ 단일 객체(운동) 구조도 지원
          else if (chatAiFeedback.parsed_data.exercise) {
            structuredData = chatAiFeedback.parsed_data;
            setChatStructuredData(chatAiFeedback.parsed_data);
          } else {
            structuredData = chatAiFeedback.parsed_data;
            setChatStructuredData(chatAiFeedback.parsed_data);
          }
        } else if (chatAiFeedback?.data) {
          structuredData = chatAiFeedback.data;
          setChatStructuredData(chatAiFeedback.data);
        }
        if (!structuredData) {
          console.log('\u26a0\ufe0f [Index] chatStructuredData \uc5c6\uc74c, \ub370\uc774\ud130 \ubd80\uc871 \uba54\uc2dc\uc9c0 \ud45c\uc2dc');
          return;
        }
      }
      // userId도 복구 시도
      if (!userId && structuredData?.user_id) {
        userId = structuredData.user_id;
      }
      if (!userId) {
        const updatedHistory: Message[] = [
          ...conversationHistory,
          { role: 'user', content: messageToSend }
        ];
        setConversationHistory(updatedHistory);
        const noUserMsg = '사용자 정보가 확인되지 않습니다. 다시 로그인해 주세요.';
        const finalHistory: Message[] = [
          ...updatedHistory,
          { role: 'assistant', content: noUserMsg }
        ];
        setConversationHistory(finalHistory);
        setChatInputText('');
        return;
      }
      if (recordType === 'exercise') {
        // 운동명, 부위, ENUM 변환 체크
        const exerciseName = structuredData.exercise || '';
        let korBodyPart = structuredData.subcategory || structuredData.bodyPart || structuredData.category || '';
        // 유산소 운동인 경우 처리
        const isCardio = structuredData.category === '유산소' || 
                         structuredData.subcategory === '유산소' || 
                         structuredData.category === 'cardio';
        
        if (!korBodyPart && isCardio) {
          korBodyPart = '유산소';
        }
        const bodyPartEnum = bodyPartToEnum(korBodyPart);
        console.log('[운동 저장] korBodyPart:', korBodyPart, 'bodyPartEnum:', bodyPartEnum);
        // 유산소 운동은 부위 정보 없이도 저장 가능
        if (!exerciseName || (!korBodyPart && !isCardio) || (!bodyPartEnum && !isCardio)) {
          const updatedHistory: Message[] = [
            ...conversationHistory,
            { role: 'user', content: messageToSend }
          ];
          setConversationHistory(updatedHistory);
          let msg = '운동명, 운동 부위 정보가 부족합니다. 예시: "벤치프레스 30kg 10회 3세트 했어요"';
          if (!exerciseName) msg = '운동명이 누락되었습니다. 운동명을 포함해 입력해 주세요.';
          else if (!korBodyPart && !isCardio) msg = '운동 부위 정보가 누락되었습니다. 예시: "벤치프레스(가슴) 30kg 10회 3세트"';
          else if (!bodyPartEnum && !isCardio) msg = `운동 부위(${korBodyPart})를 저장할 수 없습니다. 정확한 부위를 입력해 주세요.`;
          const finalHistory: Message[] = [
            ...updatedHistory,
            { role: 'assistant', content: msg }
          ];
          setConversationHistory(finalHistory);
          setChatInputText('');
          return;
        }
      }
      // ... 기존 코드 ...
      setHasSaved(true);
      setChatInputText(''); // 입력창 초기화
      await handleRecordSubmit(recordType, JSON.stringify(structuredData));
      return; // 저장 후 함수 종료
    }

    // Clear the input box immediately after sending
    setChatInputText('');

    try {
      console.log(`📤 [Index handleSendMessage] 시작 (시도: ${retryCount + 1}/${maxRetries + 1})`);
      setChatIsProcessing(true);
      setChatNetworkError(false);

      // 기존 히스토리에 사용자 메시지 추가
      const updatedHistory: Message[] = [
        ...conversationHistory,
        { role: 'user', content: messageToSend }
      ];

      // 백엔드에 메시지 전송
      const response = await sendChatMessage(
        messageToSend,
        updatedHistory,
        recordType,
        chatStep,
        structuredData,
        userId
      );

      // ✅ AI 응답이 JSON(객체)로 보이면 콘솔에만 출력, 사용자에겐 자연어만 노출
      let displayMessage = response.message;
      try {
        // JSON 문자열이거나 객체라면 콘솔에만 출력
        if (typeof response.message === 'string' && response.message.trim().startsWith('{') && response.message.trim().endsWith('}')) {
          console.log('[AI 응답 JSON]', response.message);
          // recordType별 안내 분기
          if (recordType === 'diet') {
            if (response.parsed_data && response.parsed_data.food_name) {
              displayMessage = `${response.parsed_data.food_name}을(를) 드신 것으로 기록할까요?`;
            } else {
              displayMessage = '식단 정보를 확인해주세요.';
            }
          } else if (recordType === 'exercise') {
            if (response.parsed_data && response.parsed_data.exercise) {
              displayMessage = `${response.parsed_data.exercise} 운동 정보를 확인할까요?`;
            } else {
              displayMessage = '운동 정보를 확인해주세요.';
            }
          }
        }
        
        // parsed_data가 있고 user_message.text가 있으면 그것을 사용
        if (response.parsed_data && response.parsed_data.user_message && response.parsed_data.user_message.text) {
          displayMessage = response.parsed_data.user_message.text;
        }
      } catch (e) {
        // 무시
      }

      // AI 응답을 히스토리에 추가 (자연어만)
      const newHistory: Message[] = [
        ...updatedHistory,
        { role: 'assistant', content: displayMessage }
      ];
      setConversationHistory(newHistory);
      setChatAiFeedback(response);

      // 파싱된 데이터가 있는 경우 처리
      if (response.parsed_data) {
        // system_message.data 구조를 확인
        let dataToUse = response.parsed_data;
        if (response.parsed_data.system_message && response.parsed_data.system_message.data) {
          dataToUse = response.parsed_data.system_message.data;
        }
        
        setChatStructuredData(dataToUse);

        if (recordType === 'diet' && dataToUse.meal_time) {
          setCurrentMealTime(dataToUse.meal_time as MealTimeType);
        }
      } else if (response.data) {
        setChatStructuredData(response.data);
      }

      console.log('✅ [Index handleSendMessage] 성공');

      // 단계별 처리 로직 수정
      if (response.type === 'incomplete') {
        setChatStep('extraction');
      } else if (response.type === 'complete') {
        setChatStep('confirmation');
      }
    } catch (error) {
      console.error(`❌ [Index handleSendMessage] 실패 (시도: ${retryCount + 1}):`, error);

      // 재시도 가능한 오류인지 확인
      const isRetryableError = error instanceof Error && (
        error.message.includes('Failed to fetch') ||
        error.message.includes('Network Error') ||
        error.message.includes('ERR_CONNECTION_REFUSED') ||
        error.message.includes('서버 연결에 실패')
      );

      // 재시도 횟수가 남아있고 재시도 가능한 오류인 경우
      if (retryCount < maxRetries && isRetryableError) {
        console.log(`🔄 [Index handleSendMessage] 재시도 중... (${retryCount + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, 1000)); // 1초 대기
        return handleSendMessage(retryCount + 1, transcript);
      }

      // 최대 재시도 횟수 초과 또는 재시도 불가능한 오류
      console.log('❌ [Index handleSendMessage] 재시도 중단');
      setChatNetworkError(true);
      setChatAiFeedback({
        type: 'error',
        message: retryCount >= maxRetries ?
          '서버 연결에 실패했습니다. 잠시 후 다시 시도해주세요.' :
          '메시지 전송 중 오류가 발생했습니다.'
      });
    } finally {
      setChatIsProcessing(false);
    }
  };

  /**
   * 음식 추가 기능
   */
  const handleAddMoreFood = () => {
    if (chatStructuredData && chatStructuredData.food_name && chatStructuredData.amount) {
      // 현재 음식을 리스트에 추가 (타입 변환)
      const foodToAdd = {
        food_name: chatStructuredData.food_name,
        amount: chatStructuredData.amount,
        meal_time: chatStructuredData.meal_time,
        nutrition: chatStructuredData.nutrition
      };

      setCurrentMealFoods(prev => [...prev, foodToAdd]);
      setChatStructuredData(null);
      setIsAddingMoreFood(true);
      setChatStep('extraction');

      // 추가 음식 입력 안내 메시지
      const addFoodMessage = `좋아요! ${currentMealTime} 식사에 추가로 드신 음식이 있나요? 🍽️\n\n현재 기록된 음식:\n${currentMealFoods.map((food, idx) => `${idx + 1}. ${food.food_name} ${food.amount}`).join('\n')}\n\n추가 음식을 입력하거나 "완료"라고 말씀해 주세요!`;

      const newHistory: Message[] = [
        ...conversationHistory,
        { role: 'assistant', content: addFoodMessage }
      ];
      setConversationHistory(newHistory);
      setChatAiFeedback({ type: 'initial', message: addFoodMessage });
    }
  };

  const deduplicateFoods = (foods) => {
    const seen = new Set();
    return foods.filter(food => {
      const key = `${food.food_name}|${food.amount}|${food.meal_time}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };

  const handleRecordSubmit = useCallback(async (type: 'exercise' | 'diet', content: string) => {
    if (!chatStructuredData) return;
    const userId = getUserIdFromToken();
    const token = getToken();
    if (!userId) {
      toast({
        title: '사용자 정보 없음',
        description: '로그인 정보가 없습니다. 다시 로그인해 주세요.',
        variant: 'destructive'
      });
      return;
    }
    if (type === 'exercise') {
      const exerciseName = chatStructuredData.exercise || '';
      let korBodyPart = chatStructuredData.subcategory || chatStructuredData.bodyPart || chatStructuredData.category || '';
      // 유산소 운동인 경우 처리
      const isCardio = chatStructuredData.category === '유산소' || 
                       chatStructuredData.subcategory === '유산소' || 
                       chatStructuredData.category === 'cardio';
      
      if (!korBodyPart && isCardio) {
        korBodyPart = '유산소';
      }
      const bodyPartEnum = bodyPartToEnum(korBodyPart);
      
      // 유산소 운동은 부위 정보 없이도 저장 가능
      if (!exerciseName || (!korBodyPart && !isCardio) || (!bodyPartEnum && !isCardio)) {
        toast({
          title: '운동 정보 부족',
          description: !exerciseName ? '운동명이 누락되었습니다.' : !korBodyPart ? '운동 부위 정보가 누락되었습니다.' : `운동 부위(${korBodyPart})를 저장할 수 없습니다.`,
          variant: 'destructive'
        });
        return;
      }
      const exerciseDescription = `${exerciseName} 운동`;
      try {
        // 1. 카탈로그 찾기/생성
        const catalogRes = await axios.post('/api/exercises/find-or-create', {
          name: exerciseName,
          bodyPart: bodyPartEnum, // 반드시 ENUM(영문) 값
          description: exerciseDescription
        }, { headers: { Authorization: `Bearer ${token}` } });
        if (!catalogRes.data || !catalogRes.data.exerciseCatalogId) {
          toast({
            title: '운동 카탈로그 생성 실패',
            description: '운동명/부위를 다시 확인해 주세요.',
            variant: 'destructive'
          });
          return;
        }
        const catalogId = catalogRes.data.exerciseCatalogId;
        // 2. 운동 기록 저장
        const sessionData: any = {
          user_id: userId,
          exercise_catalog_id: catalogId,
          notes: exerciseName,
          exercise_date: new Date().toISOString().split('T')[0],
          time_period: getCurrentTimePeriod(),
          input_source: 'TYPING',
          confidence_score: 1.0,
          validation_status: 'VALIDATED'
        };

        // 유산소 운동과 근력 운동 구분 처리
        if (isCardio) {
          // 유산소 운동: duration_minutes와 calories_burned만 설정
          sessionData.duration_minutes = chatStructuredData.duration_min || 30;
          sessionData.calories_burned = chatStructuredData.calories_burned || 0;
          sessionData.sets = null;
          sessionData.reps = null;
          sessionData.weight = null;
        } else {
          // 근력 운동: sets, reps, weight 설정
          sessionData.sets = chatStructuredData.sets || 0;
          sessionData.reps = chatStructuredData.reps || 0;
          sessionData.weight = chatStructuredData.weight || 0;
          sessionData.duration_minutes = chatStructuredData.duration_min || 0;
          sessionData.calories_burned = chatStructuredData.calories_burned || 0;
        }

        await axios.post('/api/exercise-sessions', sessionData, { 
          headers: { Authorization: `Bearer ${token}` } 
        });
        toast({ title: '운동 기록 저장 완료', description: '운동이 성공적으로 저장되었습니다.' });
        setHasSaved(true);
        setChatInputText('');
        setChatAiFeedback(null);
        setChatStructuredData(null);
        setShowChat(false);
        setRecordType(null);
        setConversationHistory([]);
        setChatStep('extraction');
        setCurrentMealFoods([]);
        setIsAddingMoreFood(false);
        setCurrentMealTime(null);
        navigate('/note');
      } catch (err) {
        console.error('💪 [Index 운동기록] Spring Boot API 저장 실패:', err);
        toast({
          title: '운동 저장 실패',
          description: '운동 저장 중 오류가 발생했습니다.',
          variant: 'destructive'
        });
      }
    } else if (type === 'diet') {
      // ✅ chatStructuredData가 배열이 아니고, system_message.data가 배열일 때도 반복 저장
      let foodsArray = null;
      if (Array.isArray(chatStructuredData)) {
        foodsArray = chatStructuredData;
      } else if (
        chatStructuredData &&
        chatStructuredData.system_message &&
        Array.isArray(chatStructuredData.system_message.data)
      ) {
        foodsArray = chatStructuredData.system_message.data;
      }
      if (foodsArray && foodsArray.length > 0) {
        let allSuccess = true;
        for (const item of foodsArray) {
          const foodName = item.food_name || item.name;
          const amount = item.amount || item.quantity || item.quantity_g;
          const mealTime = item.meal_time || '간식';
          if (!foodName || !amount || !mealTime) {
            allSuccess = false;
            toast({ title: '식단 정보 부족', description: `${foodName || '음식'} 정보가 부족합니다.`, variant: 'destructive' });
            continue;
          }
          try {
            let grams = 100;
            const amountStr = String(amount);
            if (!amountStr.includes('g') && !amountStr.includes('그램')) {
              grams = await estimateGramsWithGPT(foodName, amountStr);
            } else {
              grams = parseFloat(amountStr.replace(/[^0-9.]/g, '')) || 100;
            }
            const mealTimeMapping = {
              "아침": "breakfast",
              "점심": "lunch",
              "저녁": "dinner",
              "야식": "snack",
              "간식": "snack"
            };
            const mealTimeEng = mealTimeMapping[mealTime] || mealTime || 'snack';
            await aiAxiosInstance.post('/api/py/note/diet', {
              user_id: userId,
              food_name: foodName,
              quantity: grams,
              meal_time: mealTimeEng,
              log_date: new Date().toISOString().split('T')[0]
            });
          } catch (err) {
            allSuccess = false;
            toast({ title: '식단 저장 오류', description: `${foodName} 저장 실패`, variant: 'destructive' });
          }
        }
        if (allSuccess) {
          toast({ title: '식단 저장 완료', description: '모든 음식이 성공적으로 저장되었습니다.' });
          navigate('/note');
        }
        setHasSaved(true);
        setChatInputText('');
        return;
      }
      // 기존 단일 객체 저장 로직
      const { isComplete } = validateDietData(chatStructuredData);
      if (!isComplete) {
        toast({ title: '식단 정보 부족', description: '음식명, 섭취량, 식사시간이 필요합니다.', variant: 'destructive' });
        return;
      }
      // 단일 객체 저장
      const foodName = chatStructuredData.food_name || chatStructuredData.name;
      const amount = chatStructuredData.amount || chatStructuredData.quantity || chatStructuredData.quantity_g;
      const mealTime = chatStructuredData.meal_time || '간식';
      if (!foodName || !amount || !mealTime) {
        toast({ title: '식단 정보 부족', description: '음식명, 섭취량, 식사시간이 필요합니다.', variant: 'destructive' });
        return;
      }
      try {
        let grams = 100;
        const amountStr = String(amount);
        if (!amountStr.includes('g') && !amountStr.includes('그램')) {
          grams = await estimateGramsWithGPT(foodName, amountStr);
        } else {
          grams = parseFloat(amountStr.replace(/[^0-9.]/g, '')) || 100;
        }
        const mealTimeMapping = {
          "아침": "breakfast",
          "점심": "lunch",
          "저녁": "dinner",
          "야식": "snack",
          "간식": "snack"
        };
        const mealTimeEng = mealTimeMapping[mealTime] || mealTime || 'snack';
        await aiAxiosInstance.post('/api/py/note/diet', {
          user_id: userId,
          food_name: foodName,
          quantity: grams,
          meal_time: mealTimeEng,
          log_date: new Date().toISOString().split('T')[0]
        });
        toast({ title: '식단 저장 완료', description: `${foodName} 저장 성공` });
      } catch (err) {
        toast({ title: '식단 저장 오류', description: `${foodName} 저장 실패`, variant: 'destructive' });
      }
      setHasSaved(true);
      setChatInputText('');
      return;
    } else {
      console.warn('[기록 저장] 알 수 없는 recordType:', type, chatStructuredData);
    }
  }, [chatStructuredData, getUserIdFromToken, getToken, toast, navigate]);

  const { user } = useAuth();

  // Only reset hasSaved when a new chat session starts (e.g., when recordType changes)
  useEffect(() => {
    setHasSaved(false);
  }, [recordType]);

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 pb-24">
        <div className="text-center mb-8 animate-fade-in">
          <h1 className="text-2xl font-bold mb-4 text-foreground">
            AI와 함께하는 건강 관리
          </h1>
          <p className="text-muted-foreground">
            운동과 식단을 간편하게 기록하고 맞춤형 피드백을 받아보세요
          </p>
        </div>

        <div className="flex justify-center gap-4 mb-8">
          <Button
            variant={recordType === 'exercise' ? 'default' : 'outline'}
            size="lg"
            onClick={() => {
              setRecordType('exercise');
              setShowChat(true);
              setChatInputText('');
              setChatStructuredData(null);
              setConversationHistory([]);
              setChatAiFeedback({ type: 'initial', message: '안녕하세요! 💪 오늘 어떤 운동을 하셨나요?\n\n운동 이름, 무게, 세트 수, 회수를 알려주세요!\n\n예시:\n"조깅 40분 동안 했어요"\n"벤치프레스 30kg 10회 3세트 했어요"' });
              setChatStep('extraction');
            }}
            className={`flex items-center gap-2 ${recordType === 'exercise' ? 'bg-purple-600 hover:bg-purple-700 text-white' : ''
              }`}
          >
            <Activity className="h-5 w-5" />
            운동 기록
          </Button>
          <Button
            variant={recordType === 'diet' ? 'default' : 'outline'}
            size="lg"
            onClick={() => {
              setRecordType('diet');
              setShowChat(true);
              setChatInputText('');
              setChatStructuredData(null);
              setConversationHistory([]);
              setCurrentMealFoods([]);
              setIsAddingMoreFood(false);
              setCurrentMealTime(null);
              setChatAiFeedback({
                type: 'initial',
                message: '안녕하세요! 😊 오늘 어떤 음식을 드셨나요?\n\n언제, 무엇을, 얼마나 드셨는지 자유롭게 말씀해 주세요!\n\n예시: "아침에 계란후라이 2개랑 식빵 1개 먹었어요"'
              });
              setChatStep('extraction');
            }}
            className={`flex items-center gap-2 ${recordType === 'diet' ? 'bg-purple-600 hover:bg-purple-700 text-white' : ''
              }`}
          >
            <Heart className="h-5 w-5" />
            식단 기록
          </Button>
        </div>

        {showChat && recordType ? (
          <ChatInterface
            recordType={recordType}
            inputText={chatInputText}
            setInputText={setChatInputText}
            isRecording={chatIsRecording}
            isProcessing={chatIsProcessing}
            networkError={chatNetworkError}
            onVoiceToggle={() => setChatIsRecording(!chatIsRecording)}

            // Fix: Wrap handleSendMessage to match expected signature
            onSendMessage={(transcript?: string) => {
              handleSendMessage(0, transcript);
            }}

            onRetry={() => {
              setChatNetworkError(false);
              handleSendMessage(0); // 재시도 시 카운터 초기화
            }}
            aiFeedback={chatAiFeedback}
            onSaveRecord={() => handleRecordSubmit(recordType!, chatInputText)}
            structuredData={chatStructuredData}
            conversationHistory={conversationHistory}
            currentMealFoods={currentMealFoods}
            onAddMoreFood={handleAddMoreFood}
            isAddingMoreFood={isAddingMoreFood}
            hasSaved={hasSaved}
            setHasSaved={setHasSaved}
          />
        ) : (
          <div className="text-center p-8 bg-white dark:bg-[#232946] border border-gray-200 dark:border-[#3a3a5a] rounded-lg">
            <div className="text-lg font-medium text-gray-800 dark:text-[#e0e6f8] mb-2">운동 또는 식단 기록을 시작하려면</div>
            <div className="text-gray-600 dark:text-[#b3b8d8]">상단의 '운동 기록' 또는 '식단 기록' 버튼을 클릭해주세요.</div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default Index;
