import { AUTH_CONFIG } from '@/config/env';
import { jwtDecode } from 'jwt-decode';

export interface UserInfo {
  userId: string;
  email: string;
  nickname: string;
  role?: string;
}

export interface JwtPayload {
  sub: string;
  userId: number;
  email: string;
  nickname: string;
  role: string;
  exp: number;
  iat: number;
}

// ✅ AUTH_CONFIG에서 토큰 키 통일 관리

// 토큰 저장
export const setToken = (token: string) => {
  if (token) {
    localStorage.setItem(AUTH_CONFIG.TOKEN_KEY, token);
    // 로컬 스토리지 변경 이벤트 발생
    window.dispatchEvent(new Event('storage'));
  }
};

// 토큰 가져오기
export const getToken = () => {
  return localStorage.getItem(AUTH_CONFIG.TOKEN_KEY);
};

// 토큰 삭제
export const removeToken = () => {
  localStorage.removeItem(AUTH_CONFIG.TOKEN_KEY);
  localStorage.removeItem(AUTH_CONFIG.USER_KEY);
  localStorage.removeItem('nickname');
  localStorage.removeItem('role');
  // 로컬 스토리지 변경 이벤트 발생
  window.dispatchEvent(new Event('storage'));
};

// 사용자 정보 저장
export const setUserInfo = (user: UserInfo) => {
  if (user) {
    localStorage.setItem(AUTH_CONFIG.USER_KEY, JSON.stringify(user));
    // 로컬 스토리지 변경 이벤트 발생
    window.dispatchEvent(new Event('storage'));
  }
};

// 사용자 정보 가져오기
export const getUserInfo = () => {
  const userStr = localStorage.getItem(AUTH_CONFIG.USER_KEY);
  if (!userStr) return null;
  try {
    return JSON.parse(userStr);
  } catch (error) {
    console.error('Failed to parse user info:', error);
    return null;
  }
};

// 관리자 권한 확인
export const isAdmin = () => {
  const userInfo = getUserInfo();
  return userInfo && userInfo.role === 'ADMIN';
};

// 로그인 상태 확인
export const isLoggedIn = () => {
  const token = getToken();
  const userInfo = getUserInfo();
  return !!(token && userInfo);
};

// 🔧 새로 추가: 토큰 유효성 검사
export const isTokenValid = (): boolean => {
  const token = getToken();
  if (!token) {
    console.warn('🚨 [isTokenValid] 토큰이 없습니다.');
    return false;
  }

  try {
    const decoded = jwtDecode<JwtPayload>(token);
    const currentTime = Date.now() / 1000;
    
    if (decoded.exp < currentTime) {
      console.warn('🚨 [isTokenValid] 토큰이 만료되었습니다.', {
        exp: decoded.exp,
        current: currentTime,
        expired: currentTime - decoded.exp
      });
      return false;
    }
    
    console.log('✅ [isTokenValid] 토큰이 유효합니다.', {
      userId: decoded.userId,
      email: decoded.email,
      expiresIn: decoded.exp - currentTime
    });
    
    return true;
  } catch (error) {
    console.error('❌ [isTokenValid] 토큰 디코딩 실패:', error);
    return false;
  }
};

// 🔧 새로 추가: 토큰에서 사용자 ID 추출
export const getUserIdFromToken = (): number | null => {
  const token = getToken();
  if (!token) return null;

  try {
    const decoded = jwtDecode<JwtPayload>(token);
    return decoded.userId;
  } catch (error) {
    console.error('❌ [getUserIdFromToken] 토큰에서 사용자 ID 추출 실패:', error);
    return null;
  }
};

export const isAuthenticated = (): boolean => {
  return isTokenValid();
}; 