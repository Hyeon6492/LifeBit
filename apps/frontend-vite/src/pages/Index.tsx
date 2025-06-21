import { Layout } from '@/components/Layout';
import { useToast } from '@/hooks/use-toast';
import { useState } from 'react';
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
import { getUserIdFromToken, getTokenFromStorage } from '@/utils/auth'; // 또는 정확한 경로

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
  const [currentMealFoods, setCurrentMealFoods] = useState<Array<any>>([]);
  const [isAddingMoreFood, setIsAddingMoreFood] = useState(false);
  const [currentMealTime, setCurrentMealTime] = useState<MealTimeType | null>(null);


  /**
   * 식단 데이터의 완성도를 검증하는 함수
   */
  const validateDietData = (data: ChatResponse['parsed_data']): { isComplete: boolean; missingInfo: string[] } => {
    const missing: string[] = [];

    if (!data?.food_name) {
      missing.push('음식명');
    }

    if (!data?.amount) {
      missing.push('섭취량');
    }

    if (!data?.meal_time) {
      missing.push('섭취시간');
    }

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

  const handleSendMessage = async () => {
    if (!chatInputText.trim() || !recordType) return;

    try {
      setChatIsProcessing(true);
      setChatNetworkError(false);

      // 기존 히스토리에 사용자 메시지 추가
      const updatedHistory: Message[] = [
        ...conversationHistory,
        { role: 'user', content: chatInputText }
      ];

      // 백엔드에 메시지 전송
      const response = await sendChatMessage(
        chatInputText,
        updatedHistory,
        recordType,
        chatStep
      );

      // AI 응답을 히스토리에 추가 (백엔드 메시지 그대로 사용)
      const newHistory: Message[] = [
        ...updatedHistory,
        { role: 'assistant', content: response.message }
      ];
      setConversationHistory(newHistory);
      setChatAiFeedback(response);

      // 파싱된 데이터가 있는 경우 처리
      if (response.parsed_data) {
        setChatStructuredData(response.parsed_data);

        if (recordType === 'diet' && response.parsed_data.meal_time) {
          setCurrentMealTime(response.parsed_data.meal_time as MealTimeType);
        }
      }

      // 단계별 처리 로직 수정
      if (response.type === 'incomplete' || response.missingFields?.length) {
        // 정보가 누락된 경우: 검증 → 확인 → 저장
        setChatStep('validation');
      } else if (response.type === 'success' || response.type === 'confirmation') {
        // 완벽한 정보 제공 또는 확인 단계: 확인 → 저장
        setChatStep('confirmation');
      }

    } catch (error) {
      console.error('Failed to process message:', error);
      setChatNetworkError(true);
      toast({
        title: '오류 발생',
        description: '메시지 처리 중 오류가 발생했습니다. 다시 시도해주세요.',
        variant: 'destructive'
      });
    } finally {
      setChatIsProcessing(false);
      setChatInputText('');
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

  const handleRecordSubmit = async (type: 'exercise' | 'diet', content: string) => {
    if (!chatStructuredData) return;
    console.log('[🔍 chatStructuredData]', chatStructuredData);

    const userId = getUserIdFromToken();
    const token = getTokenFromStorage();  // ✅ 이 줄 추가
    console.log('[✅ token 확인]', token);
    console.log('[✅ userId 확인]', userId);


    if (!userId) {
      console.warn('[⚠️ 유저 ID 없음] 토큰에서 사용자 정보를 가져올 수 없습니다.');
      return;
    }

    const isCardio = chatStructuredData.category === '유산소';

     // ✅ 여기에 콘솔 로그 추가
     const payload = {
      user_id: Number(userId),
      name: chatStructuredData.exercise || '운동기록',
      weight: isCardio ? null : (chatStructuredData.weight ?? 0),
      sets: isCardio ? null : (chatStructuredData.sets ?? 0),
      reps: isCardio ? null : (chatStructuredData.reps ?? 0),
      duration_minutes: chatStructuredData.duration_min ?? 0,
      calories_burned: chatStructuredData.calories_burned ?? 0,
      exercise_date: new Date().toISOString().split('T')[0]
    };
      console.log('[📦 POST 데이터]', payload);

    try {
      const response = await fetch('/api/py/note/exercise', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` // ← 이 줄이 꼭 있어야 함

        },
        body: JSON.stringify(
          payload
        )
      });

      if (!response.ok) {
        throw new Error('저장 실패');
      }

      toast({
        title: '기록 완료',
        description: `${type === 'exercise' ? '운동' : '식단'} 기록이 저장되었습니다.`
      });

    } catch (err) {
      console.error('[🚨 저장 실패]', err);
      toast({
        title: '저장 오류',
        description: '데이터를 저장하지 못했습니다.',
        variant: 'destructive'
      });
    }

    // 초기화
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
  };

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
              setChatAiFeedback({ type: 'initial', message: '안녕하세요! 💪 오늘 어떤 운동을 하셨나요?\n\n운동 이름, 무게, 세트수, 회수, 운동시간을 알려주세요!\n\n예시:\n"조깅 40분 동안 했어요"\n"벤치프레스 30kg 10회 3세트 했어요"' });
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
                message: '안녕하세요! 😊 오늘 어떤 음식을 드셨나요?\n\n언제, 무엇을, 얼마나 드셨는지 자유롭게 말씀해 주세요!\n\n예시: "아침에 계란 2개랑 토스트 1개 먹었어요"'
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

            // 👇 handleSendMessage 안쓰도록 더미 함수 연결
            onSendMessage={handleSendMessage}

            onRetry={() => {
              setChatNetworkError(false);
              handleSendMessage(); // 오류 재시도 시에도 전송함
            }}
            aiFeedback={chatAiFeedback}
            onSaveRecord={() => handleRecordSubmit(recordType!, chatInputText)}
            structuredData={chatStructuredData}
            conversationHistory={conversationHistory}
            currentMealFoods={currentMealFoods}
            onAddMoreFood={handleAddMoreFood}
            isAddingMoreFood={isAddingMoreFood}
          />
        ) : (
          <div className="text-center text-gray-600 p-8 bg-gray-50 rounded-lg">
            <div className="text-lg font-medium mb-2">운동 또는 식단 기록을 시작하려면</div>
            <div>상단의 '운동 기록' 또는 '식단 기록' 버튼을 클릭해주세요.</div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default Index;
