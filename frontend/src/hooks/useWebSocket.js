import { useEffect, useRef, useCallback } from 'react'

const WS_BASE = import.meta.env.VITE_NOTIF_WS_URL || 'ws://localhost:8004'

export function useWebSocket(userId, onMessage) {
    const wsRef = useRef(null)
    const reconnectTimer = useRef(null)

    const connect = useCallback(() => {
        if (!userId) return
        const ws = new WebSocket(`${WS_BASE}/ws/${userId}`)
        wsRef.current = ws

        ws.onopen = () => {
            console.log('[WS] Connected to notification service')
        }

        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data)
                onMessage(data)
            } catch (e) {
                console.warn('[WS] Invalid message', event.data)
            }
        }

        ws.onclose = () => {
            console.log('[WS] Disconnected — reconnecting in 3s…')
            reconnectTimer.current = setTimeout(connect, 3000)
        }

        ws.onerror = (err) => {
            console.error('[WS] Error', err)
            ws.close()
        }
    }, [userId, onMessage])

    useEffect(() => {
        connect()
        return () => {
            clearTimeout(reconnectTimer.current)
            wsRef.current?.close()
        }
    }, [connect])

    const send = (data) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify(data))
        }
    }

    return { send }
}
