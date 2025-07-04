import { useEffect, useRef, useState } from 'react';
import { getToken } from '@/utils/auth';
import { API_CONFIG } from '@/config/env';

interface UseWebSocketConnectionProps {
  userId: string;
  enabled?: boolean;
  currentPage?: string; // 현재 페이지 정보
}

export const useWebSocketConnection = ({
  userId, enabled = true, currentPage = 'unknown' }
  : UseWebSocketConnectionProps) => {
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!enabled || !userId) {
      console.log('🔌 [WebSocket] 연결 비활성화:', { enabled, userId });
      return;
    }

    const token = getToken();
    if (!token) {
      console.error('❌ [WebSocket] 토큰이 없습니다');
      return;
    }

    // WebSocket URL 생성
    const wsUrl = `ws://${API_CONFIG.BASE_URL.replace('http://', '')}/ws/health/${userId}?token=${encodeURIComponent(token)}`;

    console.log('🔗 [WebSocket] 연결 시도:', { userId, wsUrl });

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('✅ [WebSocket] 연결 성공 - 사용자 ID:', userId);
        setIsConnected(true);

        // 연결 후 현재 페이지 정보 전송
        if (currentPage) {
          try {
            const pageMessage = JSON.stringify({
              type: 'page_change',
              page: currentPage
            });
            ws.send(pageMessage);
            console.log('📄 [WebSocket] 페이지 정보 전송:', currentPage);
          } catch (error) {
            console.error('❌ [WebSocket] 페이지 정보 전송 실패:', error);
          }
        }
      };

      ws.onmessage = (event) => {
        console.log('📨 [WebSocket] 메시지 수신:', event.data);
      };

      ws.onerror = (error) => {
        console.error('❌ [WebSocket] 연결 오류:', error);
        setIsConnected(false);
      };

      ws.onclose = (event) => {
        console.log('📡 [WebSocket] 연결 종료:', {
          code: event.code,
          reason: event.reason,
          wasClean: event.wasClean
        });
        setIsConnected(false);
      };

      // 주기적으로 ping 메시지 전송 (연결 유지)
      const pingInterval = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send('ping');
        }
      }, 30000); // 30초마다

      // 클린업
      return () => {
        clearInterval(pingInterval);
        if (ws.readyState === WebSocket.OPEN) {
          ws.close();
        }
        wsRef.current = null;
      };

    } catch (error) {
      console.error('❌ [WebSocket] 연결 초기화 실패:', error);
      setIsConnected(false);
    }
  }, [userId, enabled]);

  return {
    isConnected,
    disconnect: () => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.close();
      }
    }
  };
}; 