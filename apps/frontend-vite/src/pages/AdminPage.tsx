import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { isLoggedIn, getUserInfo, getToken } from '@/utils/auth';
import { useWebSocketConnection } from '@/hooks/useWebSocketConnection';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Layout } from "../components/Layout";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import axiosInstance from '@/utils/axios';

// 새로운 컴포넌트들 import
import AdminHeader from '@/components/admin/AdminHeader';
import StatsPeriodSelector from '@/components/admin/StatsPeriodSelector';
import DashboardKPICards from '@/components/admin/DashboardKPICards';
import AdminDashboardCharts from '@/components/admin/AdminDashboardCharts';
import { useAllAnalytics } from '@/api/analyticsApi';

interface User {
  id: string;
  password: string;
  email: string;
  nickname: string;
  role: string;
  createdAt?: string;
  lastVisited?: string;
}

interface CatalogItem {
  exerciseCatalogId: number;
  name: string;
  bodyPart: string;
  exerciseType: string | null;
  intensity: string;
  createdAt: string;
}

interface FoodCatalogItem {
  foodItemId: number;
  name: string;
  servingSize: number;
  calories: number;
  carbs: number;
  protein: number;
  fat: number;
  createdAt: string;
}

interface EditingCatalog {
  exerciseCatalogId: number;
  name: string;
  bodyPart: string;
  exerciseType: string;
  intensity: string;
}

interface EditingFoodCatalog {
  foodItemId: number;
  name: string;
  servingSize: number;
  calories: number;
  carbs: number;
  protein: number;
  fat: number;
}

export const AdminPage = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [deleteUserId, setDeleteUserId] = useState<string | null>(null);
  const [showDialog, setShowDialog] = useState(false);
  const [sortConfig, setSortConfig] = useState<{ key: keyof User; direction: 'asc' | 'desc' } | null>(null);
  const usersPerPage = 10;
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // 🔧 어드민 사용자 ID 가져오기
  const adminUserId = useMemo(() => {
    const userInfo = getUserInfo();
    return userInfo?.userId || null;
  }, []);

  // 🔧 어드민도 WebSocket에 연결하여 실시간 접속자에 포함
  const { isConnected } = useWebSocketConnection({
    userId: adminUserId?.toString() || '',
    enabled: !!adminUserId, // 어드민 사용자 ID가 있을 때만 활성화
    currentPage: 'admin' // 어드민 페이지임을 명시
  });

  // 👉 회원 관리 탭, 운동/음식 카탈로그 탭 전환 상태
  const [activeTab, setActiveTab] = useState<'catalog' | 'food' | 'users'>('catalog');
  const [catalogs, setCatalogs] = useState<CatalogItem[]>([]);
  const [foodCatalogs, setFoodCatalogs] = useState<FoodCatalogItem[]>([]);
  const [catalogCurrentPage, setCatalogCurrentPage] = useState(1);
  const [foodCurrentPage, setFoodCurrentPage] = useState(1);
  const [userCurrentPage, setUserCurrentPage] = useState(1);

  // 운동 카탈로그 수정 모달 관련 상태
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingCatalog, setEditingCatalog] = useState<EditingCatalog | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  
  // 운동 카탈로그 삭제 관련 상태
  const [deleteCatalogId, setDeleteCatalogId] = useState<number | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  
  // 음식 카탈로그 수정 모달 관련 상태
  const [showEditFoodModal, setShowEditFoodModal] = useState(false);
  const [editingFoodCatalog, setEditingFoodCatalog] = useState<EditingFoodCatalog | null>(null);
  const [isUpdatingFood, setIsUpdatingFood] = useState(false);
  
  // 음식 카탈로그 삭제 관련 상태
  const [deleteFoodCatalogId, setDeleteFoodCatalogId] = useState<number | null>(null);
  const [showDeleteFoodDialog, setShowDeleteFoodDialog] = useState(false);
  
  // 필터링 상태
  const [showUnsetIntensityOnly, setShowUnsetIntensityOnly] = useState(false);

  // 대시보드 통계 상태
  const [dashboardStats, setDashboardStats] = useState({
    totalUsers: 0,
    weeklyNewUsers: 0,
    monthlyNewUsers: 0,
    dailyActiveUsers: 0,
    weeklyActiveUsers: 0,
    monthlyActiveUsers: 0,
    dailyActiveRecorders: 0,
    weeklyActiveRecorders: 0,
    monthlyActiveRecorders: 0
  });

  // Add sort configs for catalog and food
  const [catalogSortConfig, setCatalogSortConfig] = useState<{ key: keyof CatalogItem; direction: 'asc' | 'desc' } | null>(null);
  const [foodSortConfig, setFoodSortConfig] = useState<{ key: keyof FoodCatalogItem; direction: 'asc' | 'desc' } | null>(null);

  // 영어 → 한글 변환 함수들
  const convertBodyPartToKorean = (english: string): string => {
    const mapping: Record<string, string> = {
      'chest': '가슴',
      'back': '등', 
      'legs': '다리',
      'shoulders': '어깨',
      'arms': '팔',
      'abs': '복근',
      'cardio': '유산소'
    };
    return mapping[english.toLowerCase()] || english;
  };

  const convertExerciseTypeToKorean = (english: string): string => {
    const mapping: Record<string, string> = {
      'strength': '근력',
      'aerobic': '유산소', 
    };
    return mapping[english.toLowerCase()] || english;
  };

  const convertIntensityToKorean = (english: string): string => {
    const mapping: Record<string, string> = {
      'low': '하',
      'medium': '중',
      'high': '상'
    };
    return mapping[english.toLowerCase()] || english;
  };

  // 한글 → 영어 변환 함수들 (API 요청용)
  const convertBodyPartToEnglish = (korean: string): string => {
    const mapping: Record<string, string> = {
      '가슴': 'chest',
      '등': 'back', 
      '다리': 'legs',
      '어깨': 'shoulders',
      '팔': 'arms',
      '복근': 'abs',
      '유산소': 'cardio'
    };
    return mapping[korean] || korean.toLowerCase();
  };

  const convertExerciseTypeToEnglish = (korean: string): string => {
    const mapping: Record<string, string> = {
      '근력': 'strength',
      '유산소': 'aerobic',
    };
    return mapping[korean] || korean.toLowerCase();
  };

  const convertIntensityToEnglish = (korean: string): string => {
    const mapping: Record<string, string> = {
      '하': 'low',
      '중': 'medium',
      '상': 'high'
    };
    return mapping[korean] || korean.toLowerCase();
  };

  // 대시보드 데이터 가져오기
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [selectedPeriod, setSelectedPeriod] = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>('daily');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // 🔧 Analytics 데이터 가져오기 (실제 요약 데이터 포함)
  const { data: analyticsData, isLoading: analyticsLoading, error: analyticsError } = useAllAnalytics(selectedPeriod);

  // 기간별 레이블 생성 함수
  const getPeriodLabel = () => {
    switch (selectedPeriod) {
      case 'daily': return '일일';
      case 'weekly': return '주간';
      case 'monthly': return '월간';
      case 'yearly': return '년간';
      default: return '일일';
    }
  };

  // 기간별 데이터 선택 함수
  const getPeriodData = (type: 'users' | 'activeUsers' | 'activeRecorders') => {
    switch (selectedPeriod) {
      case 'daily':
        return type === 'users' ? dashboardStats.totalUsers :
               type === 'activeUsers' ? dashboardStats.dailyActiveUsers :
               dashboardStats.dailyActiveRecorders;
      case 'weekly':
        return type === 'users' ? dashboardStats.totalUsers :
               type === 'activeUsers' ? dashboardStats.weeklyActiveUsers :
               dashboardStats.weeklyActiveRecorders;
      case 'monthly':
        return type === 'users' ? dashboardStats.totalUsers :
               type === 'activeUsers' ? dashboardStats.monthlyActiveUsers :
               dashboardStats.monthlyActiveRecorders;
      case 'yearly':
        return type === 'users' ? dashboardStats.totalUsers :
               type === 'activeUsers' ? dashboardStats.monthlyActiveUsers :
               dashboardStats.monthlyActiveRecorders;
      default:
        return type === 'users' ? dashboardStats.totalUsers :
               type === 'activeUsers' ? dashboardStats.dailyActiveUsers :
               dashboardStats.dailyActiveRecorders;
    }
  };

  const fetchDashboardData = async () => {
    try {
      setIsRefreshing(true);
      const res = await axiosInstance.get('/api/admin/dashboard');
      if (res.data) {
        setDashboardStats({
          totalUsers: res.data.totalUsers || 0,
          weeklyNewUsers: res.data.weeklyNewUsers || 0,
          monthlyNewUsers: res.data.monthlyNewUsers || 0,
          dailyActiveUsers: res.data.dailyActiveUsers || 0,
          weeklyActiveUsers: res.data.weeklyActiveUsers || 0,
          monthlyActiveUsers: res.data.monthlyActiveUsers || 0,
          dailyActiveRecorders: res.data.dailyActiveRecorders || 0,
          weeklyActiveRecorders: res.data.weeklyActiveRecorders || 0,
          monthlyActiveRecorders: res.data.monthlyActiveRecorders || 0
        });
        setLastUpdated(new Date());
      }
    } catch (err) {
      console.error('대시보드 데이터 fetch 오류:', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  // 전체 새로고침 함수 (수동 새로고침 버튼용)
  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    try {
      // 1. 대시보드 데이터 새로고침
      await fetchDashboardData();
      
      // 2. 관리자 차트 데이터 새로고침 (React Query 캐시 무효화)
      await queryClient.invalidateQueries({ 
        queryKey: ['adminAllAnalytics', selectedPeriod] 
      });
      await queryClient.invalidateQueries({ 
        queryKey: ['adminAccessStats', selectedPeriod] 
      });
      await queryClient.invalidateQueries({ 
        queryKey: ['adminUserActivity', selectedPeriod] 
      });
      await queryClient.invalidateQueries({ 
        queryKey: ['adminExerciseStats', selectedPeriod] 
      });
      await queryClient.invalidateQueries({ 
        queryKey: ['adminMealStats', selectedPeriod] 
      });
      
      // 3. 현재 활성 탭에 따른 데이터 새로고침
      if (activeTab === 'users') {
        await fetchUsers();
      } else if (activeTab === 'catalog') {
        await fetchCatalogs();
      } else if (activeTab === 'food') {
        await fetchFoodCatalogs();
      }
      
      console.log(`🔄 [수동 새로고침] 대시보드 + 차트 + ${activeTab} 탭 데이터 새로고침 완료`);
    } catch (err) {
      console.error('❌ [수동 새로고침] 실패:', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    // 초기 데이터 로드
    fetchDashboardData();
    
    // 10분마다 자동 새로고침
    const interval = setInterval(fetchDashboardData, 600000);
    
    return () => clearInterval(interval);
  }, []);

  // 기간 변경 시 데이터 새로고침
  useEffect(() => {
    fetchDashboardData();
  }, [selectedPeriod]);

  // 👉 사용자 목록을 서버에서 불러오는 함수
  const fetchUsers = async () => {
    try {
      const res = await axiosInstance.get('/api/admin/users');
      if (res.data) {
        setUsers(res.data);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
      toast({
        title: "오류",
        description: "사용자 정보를 불러오는데 실패했습니다.",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    const checkAdminAccess = async () => {
      if (!isLoggedIn()) {
        toast({
          title: "접근 거부",
          description: "로그인이 필요합니다.",
          variant: "destructive",
        });
        navigate('/login');
        return;
      }
      const userInfo = getUserInfo();
      if (userInfo?.role !== 'ADMIN') {
        toast({
          title: "접근 거부",
          description: "관리자 권한이 필요합니다.",
          variant: "destructive",
        });
        navigate('/');
        return;
      }
      
      // 초기 사용자 데이터 로드
      await fetchUsers();
      
      // 10분마다 사용자 목록 자동 새로고침
      const userInterval = setInterval(fetchUsers, 600000);
      
      return () => clearInterval(userInterval);
    };
    checkAdminAccess();
  }, [navigate, toast]);

  // 👉 운동 카탈로그를 서버에서 불러오는 함수
  const fetchCatalogs = async () => {
    try {
      const res = await axiosInstance.get('/api/exercises/admin/catalog');
      if (res.data) {
        console.log('🏋️ [AdminPage] 운동 카탈로그 API 응답:', res.data);
        setCatalogs(res.data);
      }
    } catch (err) {
      console.error('❌ [AdminPage] 운동 카탈로그 로딩 실패:', err);
      toast({ title: "오류", description: "운동 카탈로그 로딩 실패", variant: "destructive" });
    }
  };

  // 👉 음식 카탈로그를 서버에서 불러오는 함수
  const fetchFoodCatalogs = async () => {
    try {
      const res = await axiosInstance.get('/api/diet/admin/food-catalog');
      if (res.data) {
        console.log('🍽️ [AdminPage] 음식 카탈로그 API 응답:', res.data);
        setFoodCatalogs(res.data);
      }
    } catch (err) {
      console.error('❌ [AdminPage] 음식 카탈로그 로딩 실패:', err);
      toast({ title: "오류", description: "음식 카탈로그 로딩 실패", variant: "destructive" });
    }
  };

  useEffect(() => {
    if (activeTab === 'catalog') {
      fetchCatalogs();
      setCatalogCurrentPage(1);
      
      // 10분마다 운동 카탈로그 자동 새로고침
      const catalogInterval = setInterval(fetchCatalogs, 600000);
      return () => clearInterval(catalogInterval);
      
    } else if (activeTab === 'food') {
      fetchFoodCatalogs();
      setFoodCurrentPage(1);
      
      // 10분마다 음식 카탈로그 자동 새로고침
      const foodInterval = setInterval(fetchFoodCatalogs, 600000);
      return () => clearInterval(foodInterval);
      
    } else {
      setUserCurrentPage(1);
    }
  }, [activeTab, toast]);

  const handleDelete = async (userId: string) => {
    try {
      await axiosInstance.delete(`/api/admin/users/${userId}`);
      setUsers(prev => prev.filter(u => u.id !== userId));
      toast({ title: '삭제 성공', description: '사용자가 삭제되었습니다.' });
    } catch {
      toast({ title: '오류', description: '사용자 삭제 실패', variant: 'destructive' });
    } finally {
      setShowDialog(false);
      setDeleteUserId(null);
    }
  };

  // 👉 운동 카탈로그 수정 모달 열기 함수
  const handleEdit = (catalog: CatalogItem) => {
    setEditingCatalog({
      exerciseCatalogId: catalog.exerciseCatalogId,
      name: catalog.name,
      bodyPart: convertBodyPartToKorean(catalog.bodyPart),
      exerciseType: convertExerciseTypeToKorean(catalog.exerciseType || 'strength'),
      intensity: catalog.intensity ? convertIntensityToKorean(catalog.intensity) : ''
    });
    setShowEditModal(true);
  };

  // 👉 운동 카탈로그 삭제 함수
  const handleDeleteCatalog = async (catalogId: number) => {
    try {
      await axiosInstance.delete(`/api/exercises/admin/catalog/${catalogId}`);

      // 목록에서 삭제된 항목 제거
      setCatalogs(prev => prev.filter(catalog => catalog.exerciseCatalogId !== catalogId));
      
      toast({ 
        title: '삭제 완료', 
        description: '운동 카탈로그가 삭제되었습니다.' 
      });
      
    } catch (error) {
      console.error('❌ [AdminPage] 운동 카탈로그 삭제 실패:', error);
      toast({ 
        title: '삭제 실패', 
        description: '운동 카탈로그 삭제에 실패했습니다.', 
        variant: 'destructive' 
      });
    } finally {
      setShowDeleteDialog(false);
      setDeleteCatalogId(null);
    }
  };

  // 👉 운동 카탈로그 수정 처리 함수
  const handleUpdateCatalog = async () => {
    if (!editingCatalog) return;
    
    setIsUpdating(true);
    try {
      // 변환 과정 디버깅
      const requestData = {
        name: editingCatalog.name,
        bodyPart: convertBodyPartToEnglish(editingCatalog.bodyPart),
        exerciseType: convertExerciseTypeToEnglish(editingCatalog.exerciseType),
        intensity: editingCatalog.intensity ? convertIntensityToEnglish(editingCatalog.intensity) : null
      };
      
      console.log('🔧 [수정 요청] 원본 데이터:', editingCatalog);
      console.log('🔧 [수정 요청] 변환된 데이터:', requestData);
      
      const res = await axiosInstance.put(`/api/exercises/admin/catalog/${editingCatalog.exerciseCatalogId}`, requestData);

      if (res.data) {
        console.log('✅ [수정 성공] 응답 데이터:', res.data);
        console.log('✅ [수정 성공] bodyPart 필드:', res.data.bodyPart);
        console.log('✅ [수정 성공] 전체 필드:', Object.keys(res.data));
        
        // 목록을 다시 불러와서 최신 데이터 반영
        const refreshRes = await axiosInstance.get('/api/exercises/admin/catalog');
        if (refreshRes.data) {
          setCatalogs(refreshRes.data);
          console.log('🔄 [목록 새로고침] 완료');
        }
        
        toast({ title: '수정 완료', description: '운동 카탈로그가 수정되었습니다.' });
        setShowEditModal(false);
        setEditingCatalog(null);
      }
    } catch (error) {
      console.error('❌ [AdminPage] 운동 카탈로그 수정 실패:', error);
      toast({ 
        title: '수정 실패', 
        description: error instanceof Error ? error.message : '운동 카탈로그 수정에 실패했습니다.', 
        variant: 'destructive' 
      });
    } finally {
      setIsUpdating(false);
    }
  };

  // 👉 음식 카탈로그 수정 모달 열기 함수
  const handleEditFood = (food: FoodCatalogItem) => {
    setEditingFoodCatalog({
      foodItemId: food.foodItemId,
      name: food.name,
      servingSize: food.servingSize,
      calories: food.calories,
      carbs: food.carbs,
      protein: food.protein,
      fat: food.fat
    });
    setShowEditFoodModal(true);
  };

  // 👉 음식 카탈로그 수정 처리 함수
  const handleUpdateFoodCatalog = async () => {
    if (!editingFoodCatalog) return;
    
    setIsUpdatingFood(true);
    try {
      const requestData = {
        name: editingFoodCatalog.name,
        serving_size: editingFoodCatalog.servingSize,
        calories: editingFoodCatalog.calories,
        carbs: editingFoodCatalog.carbs,
        protein: editingFoodCatalog.protein,
        fat: editingFoodCatalog.fat
      };
      
      console.log('🔧 [음식 수정 요청] 데이터:', requestData);
      
      const res = await axiosInstance.put(`/api/diet/admin/food-catalog/${editingFoodCatalog.foodItemId}`, requestData);

      if (res.data) {
        console.log('✅ [음식 수정 성공] 응답 데이터:', res.data);
        
        // 목록을 다시 불러와서 최신 데이터 반영
        const refreshRes = await axiosInstance.get('/api/diet/admin/food-catalog');
        if (refreshRes.data) {
          setFoodCatalogs(refreshRes.data);
          console.log('🔄 [음식 목록 새로고침] 완료');
        }
        
        toast({ title: '수정 완료', description: '음식 카탈로그가 수정되었습니다.' });
        setShowEditFoodModal(false);
        setEditingFoodCatalog(null);
      }
    } catch (error) {
      console.error('❌ [AdminPage] 음식 카탈로그 수정 실패:', error);
      toast({ 
        title: '수정 실패', 
        description: error instanceof Error ? error.message : '음식 카탈로그 수정에 실패했습니다.', 
        variant: 'destructive' 
      });
    } finally {
      setIsUpdatingFood(false);
    }
  };

  // 👉 음식 카탈로그 삭제 함수
  const handleDeleteFoodCatalog = async (foodId: number) => {
    try {
      await axiosInstance.delete(`/api/diet/admin/food-catalog/${foodId}`);
      
      // 목록에서 삭제된 항목 제거
      setFoodCatalogs(prev => prev.filter(food => food.foodItemId !== foodId));
      
      toast({ 
        title: '삭제 완료', 
        description: '음식 카탈로그가 삭제되었습니다.' 
      });
      
    } catch (error) {
      console.error('❌ [AdminPage] 음식 카탈로그 삭제 실패:', error);
      toast({ 
        title: '삭제 실패', 
        description: '음식 카탈로그 삭제에 실패했습니다.', 
        variant: 'destructive' 
      });
    } finally {
      setShowDeleteFoodDialog(false);
      setDeleteFoodCatalogId(null);
    }
  };

  // 필터링된 카탈로그 목록
  const filteredCatalogs = showUnsetIntensityOnly 
    ? catalogs.filter(catalog => !catalog.intensity || catalog.intensity === null)
    : catalogs;
  
  const totalItems = activeTab === 'users' ? users.length : 
                     activeTab === 'food' ? foodCatalogs.length : 
                     filteredCatalogs.length;
  const totalPages = Math.ceil(totalItems / usersPerPage);
  const currentPage = activeTab === 'users' ? userCurrentPage : 
                      activeTab === 'food' ? foodCurrentPage : 
                      catalogCurrentPage;
  const setCurrentPage = activeTab === 'users' ? setUserCurrentPage : 
                         activeTab === 'food' ? setFoodCurrentPage : 
                         setCatalogCurrentPage;
  
  const indexOfLast = currentPage * usersPerPage;
  const indexOfFirst = indexOfLast - usersPerPage;
  // 👉 현재 탭에 따라 보여줄 목록을 계산하는 부분
  let currentList: User[] | FoodCatalogItem[] | CatalogItem[] = [];
  if (activeTab === 'users') {
    const sortedUsers = [...users];
    if (sortConfig) {
      sortedUsers.sort((a, b) => {
        const aValue = a[sortConfig.key];
        const bValue = b[sortConfig.key];
        if (sortConfig.key === 'createdAt' || sortConfig.key === 'lastVisited') {
          const aDate = aValue ? new Date(aValue) : new Date(0);
          const bDate = bValue ? new Date(bValue) : new Date(0);
          if (aDate < bDate) return sortConfig.direction === 'asc' ? -1 : 1;
          if (aDate > bDate) return sortConfig.direction === 'asc' ? 1 : -1;
          return 0;
        }
        if (aValue === undefined || aValue === null) return 1;
        if (bValue === undefined || bValue === null) return -1;
        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    currentList = sortedUsers.slice(indexOfFirst, indexOfLast);
  } else if (activeTab === 'food') {
    const sortedFoods = [...foodCatalogs];
    if (foodSortConfig) {
      sortedFoods.sort((a, b) => {
        const aValue = a[foodSortConfig.key];
        const bValue = b[foodSortConfig.key];
        if (foodSortConfig.key === 'createdAt') {
          const aDate = aValue ? new Date(aValue as string) : new Date(0);
          const bDate = bValue ? new Date(bValue as string) : new Date(0);
          if (aDate < bDate) return foodSortConfig.direction === 'asc' ? -1 : 1;
          if (aDate > bDate) return foodSortConfig.direction === 'asc' ? 1 : -1;
          return 0;
        }
        if (aValue === undefined || aValue === null) return 1;
        if (bValue === undefined || bValue === null) return -1;
        if (aValue < bValue) return foodSortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return foodSortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    currentList = sortedFoods.slice(indexOfFirst, indexOfLast);
  } else {
    const sortedCatalogs = [...filteredCatalogs];
    if (catalogSortConfig) {
      sortedCatalogs.sort((a, b) => {
        const aValue = a[catalogSortConfig.key];
        const bValue = b[catalogSortConfig.key];
        if (catalogSortConfig.key === 'createdAt') {
          const aDate = aValue ? new Date(aValue as string) : new Date(0);
          const bDate = bValue ? new Date(bValue as string) : new Date(0);
          if (aDate < bDate) return catalogSortConfig.direction === 'asc' ? -1 : 1;
          if (aDate > bDate) return catalogSortConfig.direction === 'asc' ? 1 : -1;
          return 0;
        }
        if (aValue === undefined || aValue === null) return 1;
        if (bValue === undefined || bValue === null) return -1;
        if (aValue < bValue) return catalogSortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return catalogSortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    currentList = sortedCatalogs.slice(indexOfFirst, indexOfLast);
  }

  // 👉 페이지네이션 관련 함수들
  const goToFirstPage = () => setCurrentPage(1);
  const goToLastPage = () => setCurrentPage(totalPages);
  const goToPreviousPage = () => setCurrentPage(prev => Math.max(prev - 1, 1));
  const goToNextPage = () => setCurrentPage(prev => Math.min(prev + 1, totalPages));

  const getPageNumbers = () => {
    if (totalPages <= 5) return Array.from({ length: totalPages }, (_, i) => i + 1);
    if (currentPage <= 3) return [1, 2, 3, 4, 5];
    if (currentPage > totalPages - 3) return [
      totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages
    ];
    return [currentPage - 2, currentPage - 1, currentPage, currentPage + 1, currentPage + 2];
  };

  // 👉 회원/운동/음식 테이블 정렬 함수들
  const handleSort = (key: keyof User) => {
    setSortConfig(prev => {
      if (prev && prev.key === key) {
        // Toggle direction
        return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { key, direction: 'asc' };
    });
  };

  const handleCatalogSort = (key: keyof CatalogItem) => {
    setCatalogSortConfig(prev => {
      if (prev && prev.key === key) {
        return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { key, direction: 'asc' };
    });
  };
  const handleFoodSort = (key: keyof FoodCatalogItem) => {
    setFoodSortConfig(prev => {
      if (prev && prev.key === key) {
        return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { key, direction: 'asc' };
    });
  };

  return (
    <Layout>
      <div className="container mx-auto py-8">
        {/* 1. 헤더 (관리자 대시보드 제목 + 실시간 접속자) */}
        <AdminHeader 
          onRefresh={handleManualRefresh}
          isRefreshing={isRefreshing}
          lastUpdated={lastUpdated}
        />
        
        {/* WebSocket 연결 상태 표시 (디버깅용) */}


        {/* 2. 접속자 통계 제목 + 기간 선택 버튼 */}
        <StatsPeriodSelector 
          selectedPeriod={selectedPeriod}
          onPeriodChange={setSelectedPeriod}
        />
        
        {/* 3. KPI 카드 3개 (총 회원수, 접속자, 활동자) */}
        <DashboardKPICards 
          totalUsers={analyticsData?.summary?.current.totalUsers || getPeriodData('users')}
          activeUsers={analyticsData?.summary?.current.activeUsers || getPeriodData('activeUsers')}
          recordingUsers={analyticsData?.summary?.current.recordingUsers || getPeriodData('activeRecorders')}
          period={selectedPeriod}
          summary={analyticsData?.summary} // 실제 요약 데이터 전달
        />

        {/* 4. 시각화 차트 (4개 메인 차트) */}
        <AdminDashboardCharts period={selectedPeriod} />

        {/* 5. 탭 버튼 (운동 카탈로그 | 음식 카탈로그 | 회원 관리) */}
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 mb-6">
          <Button 
            variant={activeTab === 'catalog' ? 'default' : 'outline'} 
            onClick={() => setActiveTab('catalog')}
            className="w-full sm:w-auto"
          >
            운동 카탈로그
          </Button>
          <Button 
            variant={activeTab === 'food' ? 'default' : 'outline'} 
            onClick={() => setActiveTab('food')}
            className="w-full sm:w-auto"
          >
            음식 카탈로그
          </Button>
          <Button 
            variant={activeTab === 'users' ? 'default' : 'outline'} 
            onClick={() => setActiveTab('users')}
            className="w-full sm:w-auto"
          >
            회원 관리
          </Button>
        </div>

        {/* 6. 선택된 탭에 따른 테이블 */}

        <Card className="bg-white text-gray-900 dark:bg-gray-900 dark:text-white transition-colors duration-300">
          <CardHeader>
            <CardTitle>
              <div className="flex justify-between items-center">
                <span>
                  {activeTab === 'catalog' ? '운동 카탈로그 관리' : 
                   activeTab === 'food' ? '음식 카탈로그 관리' : 
                   '회원 관리'}
                </span>
                {activeTab === 'catalog' && (
                  <Button 
                    variant={showUnsetIntensityOnly ? 'default' : 'outline'} 
                    size="sm"
                    onClick={() => setShowUnsetIntensityOnly(!showUnsetIntensityOnly)}
                  >
                    {showUnsetIntensityOnly ? '전체 보기' : '미설정 운동만 보기'}
                  </Button>
                )}
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 sm:p-6">
            <div className="overflow-x-auto">
              <Table className="bg-white dark:bg-gray-900">
              <TableHeader>
                <TableRow className="bg-gray-100 dark:bg-gray-800">
                  {activeTab === 'users' ? (
                    <>
                      <TableHead
                        className="cursor-pointer select-none"
                        onClick={() => handleSort('email')}
                      >
                        이메일 {sortConfig?.key === 'email' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : ''}
                      </TableHead>
                      <TableHead
                        className="cursor-pointer select-none"
                        onClick={() => handleSort('nickname')}
                      >
                        닉네임 {sortConfig?.key === 'nickname' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : ''}
                      </TableHead>
                      <TableHead
                        className="cursor-pointer select-none"
                        onClick={() => handleSort('createdAt')}
                      >
                        가입일 {sortConfig?.key === 'createdAt' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : ''}
                      </TableHead>
                      <TableHead
                        className="cursor-pointer select-none"
                        onClick={() => handleSort('lastVisited')}
                      >
                        마지막 접속 {sortConfig?.key === 'lastVisited' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : ''}
                      </TableHead>
                      <TableHead
                        className="cursor-pointer select-none"
                        onClick={() => handleSort('role')}
                      >
                        권한 {sortConfig?.key === 'role' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : ''}
                      </TableHead>
                      <TableHead></TableHead>
                    </>
                  ) : activeTab === 'food' ? (
                    <>
                      <TableHead
                        className="cursor-pointer select-none"
                        onClick={() => handleFoodSort('name')}
                      >
                        음식명 {foodSortConfig?.key === 'name' ? (foodSortConfig.direction === 'asc' ? '▲' : '▼') : ''}
                      </TableHead>
                      <TableHead
                        className="cursor-pointer select-none"
                        onClick={() => handleFoodSort('servingSize')}
                      >
                        기준량(g) {foodSortConfig?.key === 'servingSize' ? (foodSortConfig.direction === 'asc' ? '▲' : '▼') : ''}
                      </TableHead>
                      <TableHead
                        className="cursor-pointer select-none"
                        onClick={() => handleFoodSort('calories')}
                      >
                        칼로리(kcal) {foodSortConfig?.key === 'calories' ? (foodSortConfig.direction === 'asc' ? '▲' : '▼') : ''}
                      </TableHead>
                      <TableHead
                        className="cursor-pointer select-none"
                        onClick={() => handleFoodSort('carbs')}
                      >
                        탄수화물(g) {foodSortConfig?.key === 'carbs' ? (foodSortConfig.direction === 'asc' ? '▲' : '▼') : ''}
                      </TableHead>
                      <TableHead
                        className="cursor-pointer select-none"
                        onClick={() => handleFoodSort('protein')}
                      >
                        단백질(g) {foodSortConfig?.key === 'protein' ? (foodSortConfig.direction === 'asc' ? '▲' : '▼') : ''}
                      </TableHead>
                      <TableHead
                        className="cursor-pointer select-none"
                        onClick={() => handleFoodSort('fat')}
                      >
                        지방(g) {foodSortConfig?.key === 'fat' ? (foodSortConfig.direction === 'asc' ? '▲' : '▼') : ''}
                      </TableHead>
                      <TableHead
                        className="cursor-pointer select-none"
                        onClick={() => handleFoodSort('createdAt')}
                      >
                        생성일 {foodSortConfig?.key === 'createdAt' ? (foodSortConfig.direction === 'asc' ? '▲' : '▼') : ''}
                      </TableHead>
                      <TableHead></TableHead>
                    </>
                  ) : (
                    <>
                      <TableHead
                        className="cursor-pointer select-none"
                        onClick={() => handleCatalogSort('name')}
                      >
                        운동명 {catalogSortConfig?.key === 'name' ? (catalogSortConfig.direction === 'asc' ? '▲' : '▼') : ''}
                      </TableHead>
                      <TableHead
                        className="cursor-pointer select-none"
                        onClick={() => handleCatalogSort('bodyPart')}
                      >
                        운동 부위 {catalogSortConfig?.key === 'bodyPart' ? (catalogSortConfig.direction === 'asc' ? '▲' : '▼') : ''}
                      </TableHead>
                      <TableHead
                        className="cursor-pointer select-none"
                        onClick={() => handleCatalogSort('exerciseType')}
                      >
                        운동 타입 {catalogSortConfig?.key === 'exerciseType' ? (catalogSortConfig.direction === 'asc' ? '▲' : '▼') : ''}
                      </TableHead>
                      <TableHead
                        className="cursor-pointer select-none"
                        onClick={() => handleCatalogSort('intensity')}
                      >
                        강도 {catalogSortConfig?.key === 'intensity' ? (catalogSortConfig.direction === 'asc' ? '▲' : '▼') : ''}
                      </TableHead>
                      <TableHead
                        className="cursor-pointer select-none"
                        onClick={() => handleCatalogSort('createdAt')}
                      >
                        생성일 {catalogSortConfig?.key === 'createdAt' ? (catalogSortConfig.direction === 'asc' ? '▲' : '▼') : ''}
                      </TableHead>
                      <TableHead></TableHead>
                    </>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {currentList.length === 0 ? (
                  <TableRow className="bg-white dark:bg-gray-900">
                    <TableCell colSpan={8} className="text-center py-8 text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-900">
                      {activeTab === 'catalog' && showUnsetIntensityOnly 
                        ? '미설정 운동이 없습니다.' 
                        : activeTab === 'catalog' 
                          ? '등록된 운동이 없습니다.'
                          : activeTab === 'food'
                            ? '등록된 음식이 없습니다.'
                            : '등록된 사용자가 없습니다.'
                      }
                    </TableCell>
                  </TableRow>
                ) : (
                  (currentList as (User[] | FoodCatalogItem[] | CatalogItem[])).map((item, idx) => (
                    <TableRow key={`${activeTab === 'users' ? (item as User).id : activeTab === 'food' ? (item as FoodCatalogItem).foodItemId : (item as CatalogItem).exerciseCatalogId}`} className="bg-white dark:bg-gray-900">
                      {activeTab === 'users' ? (
                        <>
                          <TableCell className="text-gray-900 dark:text-white">{(item as User).email}</TableCell>
                          <TableCell className="text-gray-900 dark:text-white">{(item as User).nickname}</TableCell>
                          <TableCell className="text-gray-900 dark:text-white">{(item as User).createdAt ? new Date((item as User).createdAt!).toLocaleDateString('ko-KR') : '-'}</TableCell>
                          <TableCell className="text-gray-900 dark:text-white">{(item as User).lastVisited ? new Date((item as User).lastVisited!).toLocaleDateString('ko-KR') : '-'}</TableCell>
                          <TableCell className="text-gray-900 dark:text-white">{(item as User).role}</TableCell>
                          <TableCell>
                            {(item as User).role === 'USER' && (
                              <Button className="bg-red-100 hover:bg-red-200 text-red-700 border-red-200" size="sm" onClick={() => { setDeleteUserId((item as User).id); setShowDialog(true); }}>삭제</Button>
                            )}
                          </TableCell>
                        </>
                      ) : activeTab === 'food' ? (
                        <>
                          <TableCell className="text-gray-900 dark:text-white">{(item as FoodCatalogItem).name}</TableCell>
                          <TableCell className="text-gray-900 dark:text-white">{(item as FoodCatalogItem).servingSize}g</TableCell>
                          <TableCell className="text-gray-900 dark:text-white">{(item as FoodCatalogItem).calories.toFixed(1)}</TableCell>
                          <TableCell className="text-gray-900 dark:text-white">{(item as FoodCatalogItem).carbs.toFixed(1)}</TableCell>
                          <TableCell className="text-gray-900 dark:text-white">{(item as FoodCatalogItem).protein.toFixed(1)}</TableCell>
                          <TableCell className="text-gray-900 dark:text-white">{(item as FoodCatalogItem).fat.toFixed(1)}</TableCell>
                          <TableCell className="text-gray-900 dark:text-white">
                            {(item as FoodCatalogItem).createdAt ? 
                              new Date((item as FoodCatalogItem).createdAt).toLocaleDateString('ko-KR') : '-'
                            }
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button className="bg-gray-100 hover:bg-gray-200 text-gray-600 border-gray-200" size="sm" onClick={() => handleEditFood(item as FoodCatalogItem)}>수정</Button>
                              <Button 
                                className="bg-red-100 hover:bg-red-200 text-red-700 border-red-200" 
                                size="sm" 
                                onClick={() => { 
                                  setDeleteFoodCatalogId((item as FoodCatalogItem).foodItemId); 
                                  setShowDeleteFoodDialog(true); 
                                }}
                              >
                                삭제
                              </Button>
                            </div>
                          </TableCell>
                        </>
                      ) : (
                        <>
                          <TableCell className="text-gray-900 dark:text-white">{(item as CatalogItem).name}</TableCell>
                          <TableCell className="text-gray-900 dark:text-white">{convertBodyPartToKorean((item as CatalogItem).bodyPart)}</TableCell>
                          <TableCell className="text-gray-900 dark:text-white">{convertExerciseTypeToKorean((item as CatalogItem).exerciseType || 'strength')}</TableCell>
                          <TableCell className="text-gray-900 dark:text-white">
                            {(item as CatalogItem).intensity ? convertIntensityToKorean((item as CatalogItem).intensity) : '미설정'}
                          </TableCell>
                          <TableCell className="text-gray-900 dark:text-white">{(item as CatalogItem).createdAt ? new Date((item as CatalogItem).createdAt).toLocaleDateString('ko-KR') : '-'}</TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button className="bg-gray-100 hover:bg-gray-200 text-gray-600 border-gray-200" size="sm" onClick={() => handleEdit(item as CatalogItem)}>수정</Button>
                              <Button 
                                className="bg-red-100 hover:bg-red-200 text-red-700 border-red-200" 
                                size="sm" 
                                onClick={() => { 
                                  setDeleteCatalogId((item as CatalogItem).exerciseCatalogId); 
                                  setShowDeleteDialog(true); 
                                }}
                              >
                                삭제
                              </Button>
                            </div>
                          </TableCell>
                        </>
                      )}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            </div>

            {totalPages > 1 && (
              <div className="flex flex-col sm:flex-row items-center justify-between mt-4 gap-2 p-4 sm:p-0">
                <div className="text-sm text-gray-600 order-2 sm:order-1">
                  {indexOfFirst + 1}-{Math.min(indexOfLast, totalItems)} / {totalItems} {activeTab === 'users' ? '사용자' : activeTab === 'food' ? '음식' : '운동'}
                </div>
                <div className="flex items-center space-x-1 sm:space-x-2 order-1 sm:order-2">
                  <Button variant="outline" size="sm" onClick={goToFirstPage} disabled={currentPage === 1}><ChevronsLeft className="h-4 w-4" /></Button>
                  <Button variant="outline" size="sm" onClick={goToPreviousPage} disabled={currentPage === 1}><ChevronLeft className="h-4 w-4" /></Button>
                  {getPageNumbers().map((page) => (
                    <Button key={page} variant={currentPage === page ? 'default' : 'outline'} size="sm" onClick={() => setCurrentPage(page)}>{page}</Button>
                  ))}
                  <Button variant="outline" size="sm" onClick={goToNextPage} disabled={currentPage === totalPages}><ChevronRight className="h-4 w-4" /></Button>
                  <Button variant="outline" size="sm" onClick={goToLastPage} disabled={currentPage === totalPages}><ChevronsRight className="h-4 w-4" /></Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>사용자 삭제 확인</DialogTitle>
            </DialogHeader>
            <DialogDescription>정말로 이 사용자를 삭제하시겠습니까?</DialogDescription>
            <DialogFooter>
              <Button className="bg-red-100 hover:bg-red-200 text-red-700 border-red-200" onClick={() => handleDelete(deleteUserId!)}>삭제</Button>
              <Button variant="outline" onClick={() => setShowDialog(false)}>취소</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* 운동 카탈로그 삭제 확인 다이얼로그 */}
        <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>운동 카탈로그 삭제 확인</DialogTitle>
            </DialogHeader>
            <DialogDescription>
              정말로 이 운동을 카탈로그에서 삭제하시겠습니까? 
              이 작업은 되돌릴 수 없으며, 기존 운동 기록에는 영향을 주지 않습니다.
            </DialogDescription>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>취소</Button>
              <Button className="bg-red-100 hover:bg-red-200 text-red-700 border-red-200" onClick={() => handleDeleteCatalog(deleteCatalogId!)}>삭제</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* 음식 카탈로그 삭제 확인 다이얼로그 */}
        <Dialog open={showDeleteFoodDialog} onOpenChange={setShowDeleteFoodDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>음식 카탈로그 삭제 확인</DialogTitle>
            </DialogHeader>
            <DialogDescription>
              정말로 이 음식을 카탈로그에서 삭제하시겠습니까? 
              이 작업은 되돌릴 수 없으며, 기존 식단 기록에는 영향을 주지 않습니다.
            </DialogDescription>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowDeleteFoodDialog(false)}>취소</Button>
              <Button className="bg-red-100 hover:bg-red-200 text-red-700 border-red-200" onClick={() => handleDeleteFoodCatalog(deleteFoodCatalogId!)}>삭제</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* 운동 카탈로그 수정 모달 */}
        <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>운동 카탈로그 수정</DialogTitle>
              <DialogDescription>운동의 정보를 수정할 수 있습니다.</DialogDescription>
            </DialogHeader>
            {editingCatalog && (
              <div className="grid gap-4 py-4">
                {/* 운동명 */}
                <div className="grid gap-2">
                  <Label htmlFor="name">운동명</Label>
                  <Input
                    id="name"
                    value={editingCatalog.name}
                    onChange={(e) => setEditingCatalog(prev => 
                      prev ? { ...prev, name: e.target.value } : null
                    )}
                    placeholder="운동명을 입력하세요"
                  />
                </div>

                {/* 운동 부위 */}
                <div className="grid gap-2">
                  <Label htmlFor="bodyPart">운동 부위</Label>
                  <Select 
                    value={editingCatalog.bodyPart} 
                    onValueChange={(value) => setEditingCatalog(prev => 
                      prev ? { ...prev, bodyPart: value } : null
                    )}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="운동 부위 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="가슴">가슴</SelectItem>
                      <SelectItem value="등">등</SelectItem>
                      <SelectItem value="다리">다리</SelectItem>
                      <SelectItem value="어깨">어깨</SelectItem>
                      <SelectItem value="팔">팔</SelectItem>
                      <SelectItem value="복근">복근</SelectItem>
                      <SelectItem value="유산소">유산소</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* 운동 타입 */}
                <div className="grid gap-2">
                  <Label htmlFor="exerciseType">운동 타입</Label>
                  <Select 
                    value={editingCatalog.exerciseType} 
                    onValueChange={(value) => setEditingCatalog(prev => 
                      prev ? { ...prev, exerciseType: value } : null
                    )}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="운동 타입 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="근력">근력</SelectItem>
                      <SelectItem value="유산소">유산소</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* 강도 */}
                <div className="grid gap-2">
                  <Label htmlFor="intensity">강도</Label>
                  <Select 
                    value={editingCatalog.intensity} 
                    onValueChange={(value) => setEditingCatalog(prev => 
                      prev ? { ...prev, intensity: value } : null
                    )}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="강도를 선택하세요" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="하">하</SelectItem>
                      <SelectItem value="중">중</SelectItem>
                      <SelectItem value="상">상</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button 
                variant="outline" 
                onClick={() => {
                  setShowEditModal(false);
                  setEditingCatalog(null);
                }}
                disabled={isUpdating}
              >
                취소
              </Button>
              <Button 
                onClick={handleUpdateCatalog}
                disabled={isUpdating || !editingCatalog?.name.trim()}
              >
                {isUpdating ? '수정 중...' : '수정 완료'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* 음식 카탈로그 수정 모달 */}
        <Dialog open={showEditFoodModal} onOpenChange={setShowEditFoodModal}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>음식 카탈로그 수정</DialogTitle>
              <DialogDescription>음식의 영양 정보를 수정할 수 있습니다.</DialogDescription>
            </DialogHeader>
            {editingFoodCatalog && (
              <div className="grid gap-4 py-4">
                {/* 음식명 */}
                <div className="grid gap-2">
                  <Label htmlFor="foodName">음식명</Label>
                  <Input
                    id="foodName"
                    value={editingFoodCatalog.name}
                    onChange={(e) => setEditingFoodCatalog(prev => 
                      prev ? { ...prev, name: e.target.value } : null
                    )}
                    placeholder="음식명을 입력하세요"
                  />
                </div>

                {/* 기준량 */}
                <div className="grid gap-2">
                  <Label htmlFor="servingSize">기준량(g)</Label>
                  <Input
                    id="servingSize"
                    type="number"
                    value={editingFoodCatalog.servingSize}
                    onChange={(e) => setEditingFoodCatalog(prev => 
                      prev ? { ...prev, servingSize: Number(e.target.value) } : null
                    )}
                    placeholder="기준량을 입력하세요"
                  />
                </div>

                {/* 칼로리 */}
                <div className="grid gap-2">
                  <Label htmlFor="calories">칼로리(kcal)</Label>
                  <Input
                    id="calories"
                    type="number"
                    step="0.1"
                    value={editingFoodCatalog.calories}
                    onChange={(e) => setEditingFoodCatalog(prev => 
                      prev ? { ...prev, calories: Number(e.target.value) } : null
                    )}
                    placeholder="칼로리를 입력하세요"
                  />
                </div>

                {/* 탄수화물 */}
                <div className="grid gap-2">
                  <Label htmlFor="carbs">탄수화물(g)</Label>
                  <Input
                    id="carbs"
                    type="number"
                    step="0.1"
                    value={editingFoodCatalog.carbs}
                    onChange={(e) => setEditingFoodCatalog(prev => 
                      prev ? { ...prev, carbs: Number(e.target.value) } : null
                    )}
                    placeholder="탄수화물을 입력하세요"
                  />
                </div>

                {/* 단백질 */}
                <div className="grid gap-2">
                  <Label htmlFor="protein">단백질(g)</Label>
                  <Input
                    id="protein"
                    type="number"
                    step="0.1"
                    value={editingFoodCatalog.protein}
                    onChange={(e) => setEditingFoodCatalog(prev => 
                      prev ? { ...prev, protein: Number(e.target.value) } : null
                    )}
                    placeholder="단백질을 입력하세요"
                  />
                </div>

                {/* 지방 */}
                <div className="grid gap-2">
                  <Label htmlFor="fat">지방(g)</Label>
                  <Input
                    id="fat"
                    type="number"
                    step="0.1"
                    value={editingFoodCatalog.fat}
                    onChange={(e) => setEditingFoodCatalog(prev => 
                      prev ? { ...prev, fat: Number(e.target.value) } : null
                    )}
                    placeholder="지방을 입력하세요"
                  />
                </div>
              </div>
            )}
            <DialogFooter>
              <Button 
                variant="outline" 
                onClick={() => {
                  setShowEditFoodModal(false);
                  setEditingFoodCatalog(null);
                }}
                disabled={isUpdatingFood}
              >
                취소
              </Button>
              <Button 
                onClick={handleUpdateFoodCatalog}
                disabled={isUpdatingFood || !editingFoodCatalog?.name.trim()}
              >
                {isUpdatingFood ? '수정 중...' : '수정 완료'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};
