package com.lifebit.coreapi.service;

import com.lifebit.coreapi.dto.DietCalendarDTO;
import com.lifebit.coreapi.dto.DietLogDTO;
import com.lifebit.coreapi.dto.DietNutritionDTO;
import com.lifebit.coreapi.entity.*;
import com.lifebit.coreapi.repository.FoodItemRepository;
import com.lifebit.coreapi.repository.MealLogRepository;
import com.lifebit.coreapi.repository.UserGoalRepository;
import com.lifebit.coreapi.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.YearMonth;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.stream.Collectors;
import com.lifebit.coreapi.entity.enums.AchievementType;

@Slf4j
@Service
@Transactional(readOnly = true)
@RequiredArgsConstructor
public class DietService {
    private final MealLogRepository mealLogRepository;
    private final FoodItemRepository foodItemRepository;
    private final UserRepository userRepository;
    private final UserGoalRepository userGoalRepository;
    private final UserGoalService userGoalService;
    private final AchievementService achievementService;

    public List<DietLogDTO> getDailyDietRecords(LocalDate date, Long userId) {
        User user = userRepository.findById(userId)
            .orElseThrow(() -> new RuntimeException("User not found"));
        
        log.info("🔍 [DietService] 일일 식단 기록 조회 시작 - 사용자: {}, 날짜: {}", userId, date);
        
        // 디버깅: SQL로 직접 확인
        log.info("🔍 [DietService] SQL 확인 - SELECT * FROM meal_logs WHERE user_id = {} AND log_date = '{}'", userId, date);
        log.info("🔍 [DietService] SQL 확인 - SELECT * FROM food_items WHERE food_item_id = 53");
        
        List<MealLog> mealLogs = mealLogRepository.findByUserAndLogDateOrderByLogDateDescCreatedAtDesc(user, date);
        
        log.info("📊 [DietService] 조회된 MealLog 수: {}", mealLogs.size());
        
        // 각 MealLog의 상세 정보 로깅
        for (int i = 0; i < mealLogs.size(); i++) {
            MealLog mealLog = mealLogs.get(i);
            FoodItem foodItem = mealLog.getFoodItem();
            
            log.info("🍽️ [DietService] MealLog[{}]: ID={}, FoodItem={}, Quantity={}", 
                i, mealLog.getMealLogId(), 
                foodItem != null ? "존재(ID:" + foodItem.getFoodItemId() + ")" : "NULL",
                mealLog.getQuantity());
                
            // FoodItem이 null인 경우 추가 조사
            if (foodItem == null) {
                log.warn("❌ [DietService] FoodItem이 null - MealLogId: {}, 직접 조회 시도", mealLog.getMealLogId());
                
                // 직접 FoodItem 조회 시도 (디버깅용)
                try {
                    // MealLog에서 food_item_id를 직접 확인할 수 없으므로 Repository로 재조회
                    MealLog reloadedMealLog = mealLogRepository.findById(mealLog.getMealLogId()).orElse(null);
                    if (reloadedMealLog != null && reloadedMealLog.getFoodItem() != null) {
                        log.info("✅ [DietService] 재조회 성공 - FoodItemId: {}", reloadedMealLog.getFoodItem().getFoodItemId());
                    } else {
                        log.error("❌ [DietService] 재조회도 실패 - MealLogId: {}", mealLog.getMealLogId());
                    }
                } catch (Exception e) {
                    log.error("❌ [DietService] FoodItem 재조회 중 오류: {}", e.getMessage());
                }
            }
        }
        
        List<DietLogDTO> result = mealLogs.stream()
            .map(this::convertToDietLogDTO)
            .collect(Collectors.toList());
            
        log.info("✅ [DietService] 변환 완료된 DietLogDTO 수: {}", result.size());
        
        return result;
    }

    public List<DietNutritionDTO> getNutritionGoals(LocalDate date, Long userId) {
        // 사용자별 목표 가져오기 - 최신 목표만 가져오도록 수정
        UserGoal userGoal = userGoalRepository.findTopByUserIdOrderByCreatedAtDesc(userId)
            .orElse(userGoalService.getDefaultDietGoalByGender(userId));

        // 해당 날짜의 실제 섭취량 계산 (직접 엔티티 조회)
        User user = userRepository.findById(userId)
            .orElseThrow(() -> new RuntimeException("User not found"));
        
        List<MealLog> dailyMealLogs = mealLogRepository.findByUserAndLogDateOrderByLogDateDescCreatedAtDesc(user, date);

        double totalCalories = 0.0;
        double totalCarbs = 0.0;
        double totalProtein = 0.0;
        double totalFat = 0.0;

        for (MealLog mealLog : dailyMealLogs) {
            FoodItem foodItem = mealLog.getFoodItem();
            if (foodItem == null) {
                continue; // 음식이 없는 기록은 건너뛰기
            }
            BigDecimal quantity = mealLog.getQuantity();
            
            if (foodItem.getCalories() != null) {
                totalCalories += foodItem.getCalories().multiply(quantity).divide(new BigDecimal(100)).doubleValue();
            }
            if (foodItem.getCarbs() != null) {
                totalCarbs += foodItem.getCarbs().multiply(quantity).divide(new BigDecimal(100)).doubleValue();
            }
            if (foodItem.getProtein() != null) {
                totalProtein += foodItem.getProtein().multiply(quantity).divide(new BigDecimal(100)).doubleValue();
            }
            if (foodItem.getFat() != null) {
                totalFat += foodItem.getFat().multiply(quantity).divide(new BigDecimal(100)).doubleValue();
            }
        }

        // 목표 대비 백분율 계산 (Integer -> double 변환)
        return List.of(
            new DietNutritionDTO("칼로리", userGoal.getDailyCaloriesTarget() != null ? userGoal.getDailyCaloriesTarget().doubleValue() : 1500.0, totalCalories, "kcal", 
                calculatePercentage(totalCalories, userGoal.getDailyCaloriesTarget() != null ? userGoal.getDailyCaloriesTarget().doubleValue() : 1500.0)),
            new DietNutritionDTO("탄수화물", userGoal.getDailyCarbsTarget().doubleValue(), totalCarbs, "g", 
                calculatePercentage(totalCarbs, userGoal.getDailyCarbsTarget().doubleValue())),
            new DietNutritionDTO("단백질", userGoal.getDailyProteinTarget().doubleValue(), totalProtein, "g", 
                calculatePercentage(totalProtein, userGoal.getDailyProteinTarget().doubleValue())),
            new DietNutritionDTO("지방", userGoal.getDailyFatTarget().doubleValue(), totalFat, "g", 
                calculatePercentage(totalFat, userGoal.getDailyFatTarget().doubleValue()))
        );
    }

    public Map<String, DietCalendarDTO> getCalendarRecords(Long userId, int year, int month) {
        User user = userRepository.findById(userId)
            .orElseThrow(() -> new RuntimeException("User not found"));
        
        YearMonth yearMonth = YearMonth.of(year, month);
        LocalDate startDate = yearMonth.atDay(1);
        LocalDate endDate = yearMonth.atEndOfMonth();
        
        Map<String, DietCalendarDTO> calendarData = new HashMap<>();
        
        // 해당 월의 식단 기록 가져오기 (운동은 제외)
        List<MealLog> dietRecords = mealLogRepository.findByUserAndLogDateBetweenOrderByLogDateDesc(user, startDate, endDate);
        
        // 식단 기록 처리
        for (MealLog mealLog : dietRecords) {
            String dateStr = mealLog.getLogDate().toString();
            
            DietCalendarDTO dto = calendarData.getOrDefault(dateStr, new DietCalendarDTO());
            dto.setHasDiet(true);
            dto.setDietCount(dto.getDietCount() + 1);
            calendarData.put(dateStr, dto);
        }
        
        return calendarData;
    }

    @Transactional
    public DietLogDTO recordDiet(DietLogDTO request) {
        User user = userRepository.findById(request.getUserId())
            .orElseThrow(() -> new RuntimeException("User not found"));
        
        FoodItem foodItem = foodItemRepository.findById(request.getFoodItemId())
            .orElseThrow(() -> new RuntimeException("Food item not found"));

        MealLog mealLog = new MealLog();
        mealLog.setUuid(UUID.randomUUID());
        mealLog.setUser(user);
        mealLog.setFoodItem(foodItem);
        mealLog.setQuantity(BigDecimal.valueOf(request.getQuantity()));
        mealLog.setLogDate(LocalDate.parse(request.getLogDate()));
        mealLog.setCreatedAt(LocalDateTime.now());

        // 추가: DTO의 필드를 Entity에 안전하게 매핑
        mealLog.setMealTime(convertMealTimeWithFallback(request.getMealTime()));
        
        if (request.getInputSource() != null) {
            try {
                mealLog.setInputSource(InputSourceType.valueOf(request.getInputSource().toUpperCase()));
            } catch (IllegalArgumentException e) {
                System.err.println("Invalid inputSource value received: " + request.getInputSource() + ", using default: TYPING");
                mealLog.setInputSource(InputSourceType.TYPING);
            }
        } else {
            mealLog.setInputSource(InputSourceType.TYPING); // 기본값
        }
        
        if (request.getConfidenceScore() != null) {
            mealLog.setConfidenceScore(BigDecimal.valueOf(request.getConfidenceScore()));
        }
        if (request.getOriginalAudioPath() != null) {
            mealLog.setOriginalAudioPath(request.getOriginalAudioPath());
        }
        
        if (request.getValidationStatus() != null) {
            try {
                mealLog.setValidationStatus(ValidationStatusType.valueOf(request.getValidationStatus().toUpperCase()));
            } catch (IllegalArgumentException e) {
                System.err.println("Invalid validationStatus value received: " + request.getValidationStatus() + ", using default: VALIDATED");
                mealLog.setValidationStatus(ValidationStatusType.VALIDATED);
            }
        } else {
            mealLog.setValidationStatus(ValidationStatusType.VALIDATED); // 기본값
        }
        
        if (request.getValidationNotes() != null) {
            mealLog.setValidationNotes(request.getValidationNotes());
        }
        // createdAt은 이미 위에서 설정

        MealLog savedMealLog = mealLogRepository.save(mealLog);
        
        // ✅ 업적 체크 및 업데이트
        try {
            log.info("🟣 [DietService] 업적 업데이트 시작 - 사용자: {}", request.getUserId());
            
            // 사용자 업적 초기화 (없으면 생성)
            achievementService.initializeUserAchievements(request.getUserId());
            
            // 첫 식단 기록 업적 업데이트
            int totalMealRecords = getTotalMealRecords(request.getUserId());
            log.info("🟣 [DietService] 총 식단 기록 수: {}", totalMealRecords);
            achievementService.updateUserAchievementProgress(request.getUserId(), 
                AchievementType.FIRST_MEAL.getTitle(), totalMealRecords);
            
            // 연속 식단 기록 업적 업데이트 (설정 기반)
            int consecutiveMealDays = getConsecutiveMealDays(request.getUserId());
            log.info("🟣 [DietService] 연속 식단 기록 일수: {}", consecutiveMealDays);
            achievementService.updateUserAchievementProgress(request.getUserId(), 
                AchievementType.CONSECUTIVE_MEAL_7.getTitle(), consecutiveMealDays);
            achievementService.updateUserAchievementProgress(request.getUserId(), 
                AchievementType.CONSECUTIVE_MEAL_14.getTitle(), consecutiveMealDays);
            achievementService.updateUserAchievementProgress(request.getUserId(), 
                AchievementType.CONSECUTIVE_MEAL_30.getTitle(), consecutiveMealDays);
            achievementService.updateUserAchievementProgress(request.getUserId(), 
                AchievementType.CONSECUTIVE_MEAL_60.getTitle(), consecutiveMealDays);
            
            log.info("✅ [DietService] 업적 업데이트 완료 - 사용자: {}", request.getUserId());
            
        } catch (Exception e) {
            // 업적 업데이트 실패 시 로그만 남기고 계속 진행
            log.error("❌ [DietService] 업적 업데이트 실패 - 사용자: {}, 오류: {}", request.getUserId(), e.getMessage(), e);
        }
        
        return convertToDietLogDTO(savedMealLog);
    }

    @Transactional
    public DietLogDTO updateDietRecord(Long id, DietLogDTO request) {
        MealLog mealLog = mealLogRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("해당 ID의 식단 기록을 찾을 수 없습니다: " + id));

        FoodItem foodToLink;

        // foodItemId가 요청에 포함되어 있으면, 기존 FoodItem을 찾아 연결합니다.
        if (request.getFoodItemId() != null) {
            foodToLink = foodItemRepository.findById(request.getFoodItemId())
                    .orElseThrow(() -> new RuntimeException("Food item not found with id: " + request.getFoodItemId()));
        } else {
            // foodItemId가 없으면, 새로운 FoodItem을 생성합니다 (사용자 커스텀 음식).
            FoodItem newFoodItem = new FoodItem();
            newFoodItem.setUuid(UUID.randomUUID());
            newFoodItem.setCreatedAt(LocalDateTime.now());
            newFoodItem.setName(request.getFoodName());
            newFoodItem.setServingSize(BigDecimal.valueOf(100)); // 100g 기준
            newFoodItem.setCalories(BigDecimal.valueOf(request.getCalories()));
            newFoodItem.setCarbs(BigDecimal.valueOf(request.getCarbs()));
            newFoodItem.setProtein(BigDecimal.valueOf(request.getProtein()));
            newFoodItem.setFat(BigDecimal.valueOf(request.getFat()));

            foodToLink = foodItemRepository.save(newFoodItem);
        }
        
        // MealLog가 최종 FoodItem을 가리키도록 설정하고 섭취량 업데이트
        mealLog.setFoodItem(foodToLink);
        mealLog.setQuantity(BigDecimal.valueOf(request.getQuantity()));
        mealLog.setMealTime(convertMealTimeWithFallback(request.getMealTime()));
        
        MealLog updatedMealLog = mealLogRepository.save(mealLog);
        return convertToDietLogDTO(updatedMealLog);
    }

    @Transactional
    public void deleteDietRecord(Long id) {
        mealLogRepository.deleteById(id);
    }

    /**
     * 식품 검색
     */
    public List<Map<String, Object>> searchFoodItems(String keyword) {
        List<FoodItem> foodItems = foodItemRepository.findByNameContainingIgnoreCase(keyword);
        
        return foodItems.stream()
            .map(this::convertFoodItemToMap)
            .collect(Collectors.toList());
    }

    private Map<String, Object> convertFoodItemToMap(FoodItem foodItem) {
        Map<String, Object> map = new HashMap<>();
        map.put("foodItemId", foodItem.getFoodItemId());
        map.put("name", foodItem.getName());
        map.put("calories", foodItem.getCalories() != null ? foodItem.getCalories().doubleValue() : 0.0);
        map.put("carbs", foodItem.getCarbs() != null ? foodItem.getCarbs().doubleValue() : 0.0);
        map.put("protein", foodItem.getProtein() != null ? foodItem.getProtein().doubleValue() : 0.0);
        map.put("fat", foodItem.getFat() != null ? foodItem.getFat().doubleValue() : 0.0);
        map.put("servingSize", foodItem.getServingSize() != null ? foodItem.getServingSize().doubleValue() : 100.0);
        return map;
    }

    // ===== 관리자 페이지 음식 카탈로그 관리 메서드 =====
    
    /**
     * 모든 음식 카탈로그 조회 (관리자용)
     */
    public List<Map<String, Object>> getAllFoodCatalog() {
        List<FoodItem> foodItems = foodItemRepository.findAll();
        
        return foodItems.stream()
            .map(foodItem -> {
                Map<String, Object> map = new HashMap<>();
                map.put("foodItemId", foodItem.getFoodItemId());
                map.put("name", foodItem.getName());
                map.put("servingSize", foodItem.getServingSize() != null ? foodItem.getServingSize().doubleValue() : 100.0);
                map.put("calories", foodItem.getCalories() != null ? foodItem.getCalories().doubleValue() : 0.0);
                map.put("carbs", foodItem.getCarbs() != null ? foodItem.getCarbs().doubleValue() : 0.0);
                map.put("protein", foodItem.getProtein() != null ? foodItem.getProtein().doubleValue() : 0.0);
                map.put("fat", foodItem.getFat() != null ? foodItem.getFat().doubleValue() : 0.0);
                map.put("createdAt", foodItem.getCreatedAt() != null ? foodItem.getCreatedAt().toString() : null);
                return map;
            })
            .collect(Collectors.toList());
    }

    /**
     * 음식 카탈로그 수정 (관리자용)
     */
    @Transactional
    public Map<String, Object> updateFoodCatalog(Long id, String name, Double calories, Double carbs, Double protein, Double fat, Double servingSize) {
        FoodItem foodItem = foodItemRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Food item not found with id: " + id));
        
        // 필드 업데이트
        if (name != null) {
            foodItem.setName(name);
        }
        if (calories != null) {
            foodItem.setCalories(BigDecimal.valueOf(calories));
        }
        if (carbs != null) {
            foodItem.setCarbs(BigDecimal.valueOf(carbs));
        }
        if (protein != null) {
            foodItem.setProtein(BigDecimal.valueOf(protein));
        }
        if (fat != null) {
            foodItem.setFat(BigDecimal.valueOf(fat));
        }
        if (servingSize != null) {
            foodItem.setServingSize(BigDecimal.valueOf(servingSize));
        }
        
        FoodItem updatedFoodItem = foodItemRepository.save(foodItem);
        
        // 응답 데이터 구성
        Map<String, Object> response = new HashMap<>();
        response.put("foodItemId", updatedFoodItem.getFoodItemId());
        response.put("name", updatedFoodItem.getName());
        response.put("servingSize", updatedFoodItem.getServingSize() != null ? updatedFoodItem.getServingSize().doubleValue() : 100.0);
        response.put("calories", updatedFoodItem.getCalories() != null ? updatedFoodItem.getCalories().doubleValue() : 0.0);
        response.put("carbs", updatedFoodItem.getCarbs() != null ? updatedFoodItem.getCarbs().doubleValue() : 0.0);
        response.put("protein", updatedFoodItem.getProtein() != null ? updatedFoodItem.getProtein().doubleValue() : 0.0);
        response.put("fat", updatedFoodItem.getFat() != null ? updatedFoodItem.getFat().doubleValue() : 0.0);
        response.put("createdAt", updatedFoodItem.getCreatedAt() != null ? updatedFoodItem.getCreatedAt().toString() : null);
        
        return response;
    }

    /**
     * 음식 카탈로그 삭제 (관리자용)
     */
    @Transactional
    public void deleteFoodCatalog(Long id) {
        if (!foodItemRepository.existsById(id)) {
            throw new RuntimeException("Food item not found with id: " + id);
        }
        foodItemRepository.deleteById(id);
    }

    private DietLogDTO convertToDietLogDTO(MealLog mealLog) {
        FoodItem foodItem = mealLog.getFoodItem();

        log.debug("🔄 [DietService] convertToDietLogDTO 시작 - MealLogId: {}, FoodItem: {}", 
            mealLog.getMealLogId(), foodItem != null ? foodItem.getFoodItemId() : "NULL");

        DietLogDTO dto = new DietLogDTO();
        dto.setId(mealLog.getMealLogId());
        dto.setQuantity(mealLog.getQuantity().doubleValue());
        dto.setMealTime(mealLog.getMealTime().name());
        dto.setUnit("g"); // 기본 단위 설정
        dto.setLogDate(mealLog.getLogDate().toString());
        dto.setCreatedAt(mealLog.getCreatedAt().toString());

        if (foodItem == null) {
            log.warn("⚠️ [DietService] FoodItem이 null입니다 - MealLogId: {}, 기본값으로 설정", mealLog.getMealLogId());
            
            // FoodItem이 null이어도 기본 정보는 반환
            dto.setFoodItemId(null);
            dto.setFoodName("알 수 없는 음식");
            dto.setCalories(0.0);
            dto.setCarbs(0.0);
            dto.setProtein(0.0);
            dto.setFat(0.0);
            
            return dto;
        }

        // FoodItem이 존재하는 경우 정상 처리
        dto.setFoodItemId(foodItem.getFoodItemId());
        dto.setFoodName(foodItem.getName());

        BigDecimal quantity = mealLog.getQuantity();
        BigDecimal HUNDRED = new BigDecimal("100.0");

        dto.setCalories(foodItem.getCalories() != null ? foodItem.getCalories().multiply(quantity).divide(HUNDRED, 2, RoundingMode.HALF_UP).doubleValue() : 0.0);
        dto.setCarbs(foodItem.getCarbs() != null ? foodItem.getCarbs().multiply(quantity).divide(HUNDRED, 2, RoundingMode.HALF_UP).doubleValue() : 0.0);
        dto.setProtein(foodItem.getProtein() != null ? foodItem.getProtein().multiply(quantity).divide(HUNDRED, 2, RoundingMode.HALF_UP).doubleValue() : 0.0);
        dto.setFat(foodItem.getFat() != null ? foodItem.getFat().multiply(quantity).divide(HUNDRED, 2, RoundingMode.HALF_UP).doubleValue() : 0.0);

        log.debug("✅ [DietService] convertToDietLogDTO 완료 - MealLogId: {}, FoodName: {}", 
            mealLog.getMealLogId(), dto.getFoodName());

        return dto;
    }

    private double calculatePercentage(double current, double target) {
        if (target == 0) return 0;
        return Math.min((current / target) * 100, 100);
    }

    /**
     * 식사시간 변환 with 지능적 fallback
     * 한글 → 영어 변환 및 시간대 기반 추론
     */
    private MealTimeType convertMealTimeWithFallback(String mealTime) {
        if (mealTime == null || mealTime.trim().isEmpty()) {
            return MealTimeType.breakfast; // 기본값
        }

        String normalized = mealTime.trim().toLowerCase();

        // 한글 → 영어 매핑
        if (normalized.contains("아침") || normalized.contains("조식") || normalized.contains("breakfast")) {
            return MealTimeType.breakfast;
        } else if (normalized.contains("점심") || normalized.contains("중식") || normalized.contains("lunch")) {
            return MealTimeType.lunch;
        } else if (normalized.contains("저녁") || normalized.contains("석식") || normalized.contains("dinner")) {
            return MealTimeType.dinner;
        } else if (normalized.contains("간식") || normalized.contains("snack")) {
            return MealTimeType.snack;
        }

        // 시간대 기반 추론 (현재 시간 기준)
        LocalDateTime now = LocalDateTime.now();
        int hour = now.getHour();

        if (hour >= 5 && hour < 11) {
            return MealTimeType.breakfast;
        } else if (hour >= 11 && hour < 17) {
            return MealTimeType.lunch;
        } else if (hour >= 17 && hour < 22) {
            return MealTimeType.dinner;
        } else {
            return MealTimeType.snack;
        }
    }
    
    /**
     * 총 식단 기록 수 계산
     */
    private int getTotalMealRecords(Long userId) {
        User user = new User();
        user.setUserId(userId);
        List<MealLog> mealLogs = mealLogRepository.findByUserAndLogDateBetweenOrderByLogDateDesc(
            user, LocalDate.now().minusDays(365), LocalDate.now());
        
        int totalRecords = mealLogs.size();
        log.info("🟣 [DietService] 총 식단 기록 수 계산 - 사용자: {}, 총 기록 수: {}", userId, totalRecords);
        return totalRecords;
    }
    
    /**
     * 연속 식단 기록 일수 계산
     */
    private int getConsecutiveMealDays(Long userId) {
        User user = new User();
        user.setUserId(userId);
        List<MealLog> mealLogs = mealLogRepository.findByUserAndLogDateBetweenOrderByLogDateDesc(
            user, LocalDate.now().minusDays(365), LocalDate.now());
        
        // 날짜별 내림차순 정렬 (최근 → 과거)
        mealLogs.sort(java.util.Comparator.comparing(MealLog::getLogDate).reversed());
        
        if (mealLogs.isEmpty()) {
            log.info("🟣 [DietService] 식단 기록 없음 - 사용자: {}", userId);
            return 0;
        }

        int streak = 0;
        LocalDate currentDate = LocalDate.now();
        
        // 오늘부터 역순으로 연속 식단 기록 일수 계산
        for (int i = 0; i < mealLogs.size(); i++) {
            MealLog mealLog = mealLogs.get(i);
            LocalDate logDate = mealLog.getLogDate();
            
            // 현재 확인하려는 날짜와 로그 날짜가 일치하는지 확인
            if (logDate.equals(currentDate)) {
                streak++;
                currentDate = currentDate.minusDays(1);
                log.debug("🟣 [DietService] 연속 식단 기록 일수 증가 - 날짜: {}, 현재 연속: {}", logDate, streak);
            } else if (logDate.isBefore(currentDate)) {
                // 연속이 끊어짐 - 더 이상 확인할 필요 없음
                log.debug("🟣 [DietService] 연속 식단 기록 끊어짐 - 날짜: {}, 현재 연속: {}", logDate, streak);
                break;
            }
        }
        
        log.info("🟣 [DietService] 연속 식단 기록 일수 계산 완료 - 사용자: {}, 연속 일수: {}", userId, streak);
        return streak;
    }

    @Transactional
    public Long createCustomFoodItem(String name, Double calories, Double carbs, Double protein, Double fat) {
        FoodItem foodItem = new FoodItem();
        foodItem.setUuid(UUID.randomUUID());
        foodItem.setName(name);
        foodItem.setServingSize(BigDecimal.valueOf(100));
        foodItem.setCalories(BigDecimal.valueOf(calories));
        foodItem.setCarbs(BigDecimal.valueOf(carbs));
        foodItem.setProtein(BigDecimal.valueOf(protein));
        foodItem.setFat(BigDecimal.valueOf(fat));
        foodItem.setCreatedAt(LocalDateTime.now());
        FoodItem saved = foodItemRepository.save(foodItem);
        return saved.getFoodItemId();
    }

    @Transactional
    public Map<String, Object> updateFoodItem(Long id, Double calories, Double carbs, Double protein, Double fat) {
        FoodItem foodItem = foodItemRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Food item not found with id: " + id));
        
        if (calories != null) {
            foodItem.setCalories(BigDecimal.valueOf(calories));
        }
        if (carbs != null) {
            foodItem.setCarbs(BigDecimal.valueOf(carbs));
        }
        if (protein != null) {
            foodItem.setProtein(BigDecimal.valueOf(protein));
        }
        if (fat != null) {
            foodItem.setFat(BigDecimal.valueOf(fat));
        }
        
        FoodItem updatedFoodItem = foodItemRepository.save(foodItem);
        return convertFoodItemToMap(updatedFoodItem);
    }
} 