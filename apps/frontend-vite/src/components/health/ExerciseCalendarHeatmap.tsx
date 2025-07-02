import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Calendar, Activity, Clock, Flame, Trophy, Zap, Target, Star } from 'lucide-react';
import { Tooltip } from '../ui/tooltip';

interface ExerciseCalendarHeatmapProps {
  exerciseSessions: Array<{
    exercise_date: string;
    duration_minutes: number;
    calories_burned: number;
    exercise_name?: string;
  }>;
  period: 'day' | 'week' | 'month' | 'year';
}

interface DayData {
  date: Date;
  dateString: string;
  workouts: number;
  totalMinutes: number;
  totalCalories: number;
  intensity: 'none' | 'low' | 'medium' | 'high' | 'very-high';
  isToday: boolean;
  isCurrentMonth: boolean;
  isWeekend: boolean;
  monthName: string;
  dayOfMonth: number;
}

export const ExerciseCalendarHeatmap: React.FC<ExerciseCalendarHeatmapProps> = ({
  exerciseSessions = [],
  period
}) => {
  // 현재 날짜와 기간 설정
  const today = new Date().toISOString().split('T')[0];
  const currentMonth = new Date(today).getMonth();
  const currentYear = new Date(today).getFullYear();

  const isDarkMode = typeof window !== 'undefined' && document.documentElement.classList.contains('dark');

  // 운동 데이터를 날짜별로 그룹핑
  const exerciseByDate = useMemo(() => {
    const grouped: Record<string, { workouts: number; totalMinutes: number; totalCalories: number }> = {};
    
    // 오늘 날짜의 데이터도 포함하도록 수정
    const todayStr = today;
    
    exerciseSessions.forEach(session => {
      const date = session.exercise_date;
      if (!grouped[date]) {
        grouped[date] = { workouts: 0, totalMinutes: 0, totalCalories: 0 };
      }
      grouped[date].workouts += 1;
      grouped[date].totalMinutes += session.duration_minutes || 0;
      grouped[date].totalCalories += session.calories_burned || 0;
    });

    return grouped;
  }, [exerciseSessions, today]);

  // 캘린더 데이터 생성 (완전한 5주 = 현재 주가 마지막에 오도록)
  const calendarData = useMemo(() => {
    const data: DayData[] = [];
    
    // 현재 주의 일요일을 찾기
    const currentSunday = new Date(today);
    const currentDayOfWeek = new Date(today).getDay(); // 0: 일요일, 1: 월요일, ..., 6: 토요일
    currentSunday.setDate(new Date(today).getDate() - currentDayOfWeek); // 이번 주 일요일로 이동
    
    // 4주 전 일요일부터 시작 (현재 주가 5주차가 되도록)
    const startDate = new Date(currentSunday);
    startDate.setDate(currentSunday.getDate() - 28); // 4주 전 일요일
    
    // 완전한 5주 = 35일 (5 * 7)
    for (let i = 0; i < 35; i++) {
      const currentDate = new Date(startDate);
      currentDate.setDate(startDate.getDate() + i);
      
      const dateString = currentDate.toISOString().split('T')[0];
      const dayData = exerciseByDate[dateString] || { workouts: 0, totalMinutes: 0, totalCalories: 0 };
      
      // 운동 강도 계산 (총 운동 시간 기준)
      let intensity: DayData['intensity'] = 'none';
      if (dayData.totalMinutes > 0) {
        if (dayData.totalMinutes < 15) intensity = 'low';
        else if (dayData.totalMinutes < 30) intensity = 'medium';
        else if (dayData.totalMinutes < 60) intensity = 'high';
        else intensity = 'very-high';
      }

      data.push({
        date: currentDate,
        dateString,
        workouts: dayData.workouts,
        totalMinutes: dayData.totalMinutes,
        totalCalories: dayData.totalCalories,
        intensity,
        isToday: dateString === today,
        isCurrentMonth: currentDate.getMonth() === currentMonth,
        isWeekend: currentDate.getDay() === 0 || currentDate.getDay() === 6,
        monthName: currentDate.toLocaleDateString('ko-KR', { month: 'short' }),
        dayOfMonth: currentDate.getDate()
      });
    }

    return data;
  }, [exerciseByDate, today, currentMonth]);

  // 색상 클래스 반환 - 더 생동감 있고 그라데이션 느낌
  const getIntensityColor = (intensity: DayData['intensity'], isToday: boolean, isWeekend: boolean) => {
    if (isToday) {
      return 'bg-gradient-to-br from-blue-400 to-blue-600 border-2 border-yellow-400 shadow-lg transform scale-110';
    }
    
    const baseClasses = 'transition-all duration-200 hover:transform hover:scale-110 hover:shadow-md';
    
    switch (intensity) {
      case 'none': 
        return `${baseClasses} ${isWeekend ? 'bg-gray-50' : 'bg-gray-100'} hover:bg-gray-200 border border-gray-200`;
      case 'low': 
        return `${baseClasses} bg-gradient-to-br from-green-200 to-green-300 hover:from-green-300 hover:to-green-400 border border-green-300`;
      case 'medium': 
        return `${baseClasses} bg-gradient-to-br from-green-400 to-green-500 hover:from-green-500 hover:to-green-600 border border-green-500`;
      case 'high': 
        return `${baseClasses} bg-gradient-to-br from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 border border-green-700`;
      case 'very-high': 
        return `${baseClasses} bg-gradient-to-br from-green-800 to-green-900 hover:from-green-900 hover:to-emerald-900 border border-green-800 shadow-md`;
      default: return `${baseClasses} bg-gray-100`;
    }
  };

  // 강도별 이모지 반환
  const getIntensityEmoji = (intensity: DayData['intensity']) => {
    switch (intensity) {
      case 'none': return '';
      case 'low': return '🌱';
      case 'medium': return '💪';
      case 'high': return '🔥';
      case 'very-high': return '⚡';
      default: return '';
    }
  };

  // 주별로 데이터 그룹핑 (완전한 주 단위)
  const weeklyData = useMemo(() => {
    if (calendarData.length === 0) return [];
    
    const weeks = [];
    // 정확히 35일(5주)이므로 7일씩 나누기만 하면 됨
    for (let i = 0; i < calendarData.length; i += 7) {
      weeks.push(calendarData.slice(i, i + 7));
    }
    
    return weeks;
  }, [calendarData]);

  // 주별 통계 계산
  const weeklyStats = useMemo(() => {
    return weeklyData.map(week => {
      const totalWorkouts = week.reduce((sum, day) => sum + day.workouts, 0);
      const totalMinutes = week.reduce((sum, day) => sum + day.totalMinutes, 0);
      const totalCalories = week.reduce((sum, day) => sum + day.totalCalories, 0);
      const activeDays = week.filter(day => day.workouts > 0).length;
      
      return {
        totalWorkouts,
        totalMinutes,
        totalCalories,
        activeDays,
        daysInWeek: 7 // 항상 7일
      };
    });
  }, [weeklyData]);

  // 통계 계산
  const stats = useMemo(() => {
    const totalWorkouts = calendarData.reduce((sum, day) => sum + day.workouts, 0);
    const totalMinutes = calendarData.reduce((sum, day) => sum + day.totalMinutes, 0);
    const totalCalories = calendarData.reduce((sum, day) => sum + day.totalCalories, 0);
    const activeDays = calendarData.filter(day => day.workouts > 0).length;

    return { totalWorkouts, totalMinutes, totalCalories, activeDays };
  }, [calendarData]);

  const todayExercise = exerciseSessions.filter(session =>
    session.exercise_date && session.exercise_date.slice(0, 10) === today
  );

  return (
    <Card className={
      (isDarkMode
        ? 'w-full bg-card !border-2 !border-[#7c3aed]'
        : 'w-full bg-gradient-to-br from-white to-green-50/30 border-none')
    }>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-green-500 to-green-600 rounded-lg shadow-md">
              <Calendar className="h-5 w-5 text-white" />
            </div>
            <div>
              <div className="text-xl font-bold text-gray-800 dark:text-white">🔥 운동 캘린더 히트맵</div>
              <div className="text-sm text-gray-600 font-normal">최근 5주간의 운동 기록</div>
            </div>
          </CardTitle>
          <div className="flex gap-2">
            <Badge className="bg-gradient-to-r from-green-500 to-green-600 text-white px-3 py-1">
              <Trophy className="h-3 w-3 mr-1" />
              레벨 {Math.floor(stats.activeDays / 10) + 1}
            </Badge>
            <Badge variant="outline" className="border-orange-300 text-orange-600">
              <Flame className="h-3 w-3 mr-1" />
              {stats.activeDays}일 활동
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* 월별 구분 히트맵 그리드 */}
        <div className={isDarkMode ? 'bg-card rounded-xl p-6 shadow-sm !border-2 !border-[#7c3aed]' : 'bg-white rounded-xl p-6 shadow-sm border-none'}>
          {/* 요일 라벨 */}
          <div className="flex items-center gap-3 text-sm font-medium text-gray-600 mb-4">
            <div className="w-24 flex items-center justify-center text-xs text-blue-600 font-semibold">
              주별 통계
            </div>
            <div className="flex gap-2">
              {['일', '월', '화', '수', '목', '금', '토'].map((day, index) => (
                <div key={index} className="w-8 h-8 flex items-center justify-center">
                  {day}
                </div>
              ))}
            </div>
          </div>

          {/* 히트맵 그리드 */}
          <div className="space-y-1">
            {weeklyData.map((week, weekIndex) => {
              const isFirstWeekOfMonth = week.some(day => day.dayOfMonth === 1);
              const monthName = week.find(day => day.dayOfMonth === 1)?.monthName;
              
              return (
                <div key={weekIndex}>
                  {/* 월 구분선 */}
                  {isFirstWeekOfMonth && weekIndex > 0 && (
                    <div className="flex items-center gap-2 my-2 px-2">
                      <div className="h-px bg-gradient-to-r from-green-200 to-transparent flex-1"></div>
                      <span className="text-xs font-semibold text-green-600 bg-green-50 px-2 py-1 rounded-full">
                        {monthName}
                      </span>
                      <div className="h-px bg-gradient-to-l from-green-200 to-transparent flex-1"></div>
                    </div>
                  )}
                  
                  <div className="flex gap-3 items-center">
                    {/* 주차 정보 박스 */}
                    <div className="w-24 bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg p-2 border border-blue-200 hover:shadow-md hover:scale-105 transition-all duration-200 cursor-pointer group relative">
                      <div className="text-xs font-bold text-blue-700 text-center mb-1">
                        {weekIndex + 1}주차
                      </div>
                      <div className="text-xs text-blue-600 text-center space-y-0.5">
                        <div>🏃 {weeklyStats[weekIndex]?.totalWorkouts || 0}회</div>
                        <div>⏱️ {weeklyStats[weekIndex]?.totalMinutes || 0}분</div>
                        <div className="text-blue-500">📈 {weeklyStats[weekIndex]?.activeDays || 0}/{weeklyStats[weekIndex]?.daysInWeek || 0}일</div>
                      </div>
                      
                      {/* 호버 시 상세 주별 정보 */}
                      <div className="opacity-0 group-hover:opacity-100 absolute -top-20 left-1/2 transform -translate-x-1/2 bg-blue-800 text-white text-xs rounded-lg px-3 py-2 pointer-events-none z-20 transition-opacity duration-200 whitespace-nowrap">
                        <div className="font-semibold text-center mb-1">{weekIndex + 1}주차 상세</div>
                        <div className="space-y-1">
                          <div>운동 횟수: {weeklyStats[weekIndex]?.totalWorkouts || 0}회</div>
                          <div>운동 시간: {weeklyStats[weekIndex]?.totalMinutes || 0}분</div>
                          <div>칼로리: {weeklyStats[weekIndex]?.totalCalories || 0}kcal</div>
                          <div>활동일: {weeklyStats[weekIndex]?.activeDays || 0}일</div>
                        </div>
                        <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-blue-800"></div>
                      </div>
                    </div>
                    
                    {/* 일별 히트맵 */}
                    <div className="flex gap-2">
                      {week.map((day, dayIndex) => (
                        <div
                          key={`${weekIndex}-${dayIndex}`}
                          className={`w-8 h-8 rounded-lg cursor-pointer relative group ${getIntensityColor(day.intensity, day.isToday, day.isWeekend)}`}
                          title={`${day.date.toLocaleDateString('ko-KR')} (${day.monthName} ${day.dayOfMonth}일)\n${day.workouts}회 운동 • ${day.totalMinutes}분 • ${day.totalCalories}kcal`}
                        >
                          {/* 강도별 이모지 */}
                          {day.intensity !== 'none' && (
                            <div className="absolute inset-0 flex items-center justify-center text-sm">
                              {getIntensityEmoji(day.intensity)}
                            </div>
                          )}
                          
                          {/* 오늘 표시 */}
                          {day.isToday && (
                            <div className="absolute -top-1 -right-1">
                              <Star className="h-4 w-4 text-yellow-400 fill-current" />
                            </div>
                          )}
                          
                          {/* 월초 날짜 표시 */}
                          {(day.dayOfMonth === 1 || (weekIndex === 0 && dayIndex === 0)) && (
                            <div className="absolute -top-5 left-0 text-sm font-semibold text-gray-600">
                              {day.dayOfMonth}
                            </div>
                          )}
                          
                          {/* 호버 시 상세 정보 */}
                          <div className="opacity-0 group-hover:opacity-100 absolute -top-16 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white text-xs rounded-lg px-2 py-1 pointer-events-none z-10 transition-opacity duration-200 whitespace-nowrap">
                            <div className="font-medium">{day.date.toLocaleDateString('ko-KR')}</div>
                            <div>{day.workouts}회 • {day.totalMinutes}분 • {day.totalCalories}kcal</div>
                            <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-800"></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* 개선된 범례 */}
          <div className="flex items-center justify-between mt-6 pt-4 border-t border-green-100">
            <div className="flex items-center gap-3 text-sm text-gray-600">
              <span className="font-semibold">운동 강도:</span>
              <div className="flex gap-2">
                <div className="w-4 h-4 rounded-lg bg-gray-100 border border-gray-200" title="운동 안함"></div>
                <div className="w-4 h-4 rounded-lg bg-gradient-to-br from-green-200 to-green-300 border border-green-300" title="가벼운 운동 (15분 미만)"></div>
                <div className="w-4 h-4 rounded-lg bg-gradient-to-br from-green-400 to-green-500 border border-green-500" title="보통 운동 (15-30분)"></div>
                <div className="w-4 h-4 rounded-lg bg-gradient-to-br from-green-600 to-green-700 border border-green-700" title="강한 운동 (30-60분)"></div>
                <div className="w-4 h-4 rounded-lg bg-gradient-to-br from-green-800 to-green-900 border border-green-800" title="매우 강한 운동 (60분 이상)"></div>
              </div>
            </div>
            <div className="text-sm text-gray-500 font-medium">
              💡 하루 운동 시간에 따라 색상이 달라져요
            </div>
          </div>
        </div>

        {/* 💎 개선된 통계 요약 */}
        <div className="grid grid-cols-4 gap-3">
          <div className={(isDarkMode
            ? 'flex flex-col items-center justify-center gap-1 bg-card !border-2 !border-[#7c3aed] rounded-2xl p-3 text-blue-400 min-w-0'
            : 'flex flex-col items-center justify-center gap-1 bg-blue-500 rounded-2xl p-3 text-white border-none min-w-0')}
          >
            <Activity className="w-5 h-5 mb-0.5" />
            <div className="text-xs font-semibold">총 운동 횟수</div>
            <div className="text-xl font-extrabold">{stats.totalWorkouts}</div>
            <div className={isDarkMode ? 'text-[10px] text-blue-300 mt-0.5' : 'text-[10px] text-blue-100 mt-0.5'}>
              🎯 목표 달성률 {Math.round((stats.totalWorkouts / 35) * 100)}%
            </div>
          </div>
          <div className={(isDarkMode
            ? 'flex flex-col items-center justify-center gap-1 bg-card !border-2 !border-[#7c3aed] rounded-2xl p-3 text-green-400 min-w-0'
            : 'flex flex-col items-center justify-center gap-1 bg-green-500 rounded-2xl p-3 text-white border-none min-w-0')}
          >
            <Clock className="w-5 h-5 mb-0.5" />
            <div className="text-xs font-semibold">총 운동 시간</div>
            <div className="text-xl font-extrabold">{stats.totalMinutes}</div>
            <div className={isDarkMode ? 'text-[10px] text-green-300 mt-0.5' : 'text-[10px] text-green-100 mt-0.5'}>
              ⏰ 평균 {Math.round(stats.totalMinutes / (stats.activeDays || 1))}분/일
            </div>
          </div>
          <div className={(isDarkMode
            ? 'flex flex-col items-center justify-center gap-1 bg-card !border-2 !border-[#7c3aed] rounded-2xl p-3 text-orange-400 min-w-0'
            : 'flex flex-col items-center justify-center gap-1 bg-orange-500 rounded-2xl p-3 text-white border-none min-w-0')}
          >
            <Flame className="w-5 h-5 mb-0.5" />
            <div className="text-xs font-semibold">소모 칼로리</div>
            <div className="text-xl font-extrabold">{stats.totalCalories.toLocaleString()}</div>
            <div className={isDarkMode ? 'text-[10px] text-orange-300 mt-0.5' : 'text-[10px] text-orange-100 mt-0.5'}>
              🔥 평균 {Math.round(stats.totalCalories / (stats.activeDays || 1))}kcal/일
            </div>
          </div>
          <div className={(isDarkMode
            ? 'flex flex-col items-center justify-center gap-1 bg-card !border-2 !border-[#7c3aed] rounded-2xl p-3 text-purple-400 min-w-0'
            : 'flex flex-col items-center justify-center gap-1 bg-purple-500 rounded-2xl p-3 text-white border-none min-w-0')}
          >
            <Target className="w-5 h-5 mb-0.5" />
            <div className="text-xs font-semibold">활동 일수</div>
            <div className="text-xl font-extrabold">{stats.activeDays}</div>
            <div className={isDarkMode ? 'text-[10px] text-purple-300 mt-0.5' : 'text-[10px] text-purple-100 mt-0.5'}>
              📈 연속성 {Math.round((stats.activeDays / 35) * 100)}%
            </div>
          </div>
        </div>

        {/* 🎉 성취감 있는 격려 메시지 */}

          {/* 배경 장식 */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-yellow-200/20 to-transparent rounded-full"></div>
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-gradient-to-tr from-green-200/20 to-transparent rounded-full"></div>
      </CardContent>
    </Card>
  );
}; 