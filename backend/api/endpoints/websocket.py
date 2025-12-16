# backend/api/endpoints/websocket.py
"""
WebSocket endpoints for real-time updates.

This module provides real-time notifications to connected clients:
- Device updates (scans, facts refresh, cache updates)
- User notifications (certificates, deployments, system alerts)
"""

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from typing import Set, Dict, Optional
import asyncio
import json

from core.logger import setup_logger
from services.auth_service import SECRET_KEY, ALGORITHM
from jose import JWTError, jwt

logger = setup_logger("cmt.websocket")

router = APIRouter()


# ═══════════════════════════════════════════════════════════════════════════════
# CONNECTION MANAGER
# ═══════════════════════════════════════════════════════════════════════════════

class ConnectionManager:
    """Manages WebSocket connections and broadcasts."""
    
    def __init__(self):
        self.active_connections: Set[WebSocket] = set()
        # User-specific connections for targeted notifications
        self.user_connections: Dict[int, Set[WebSocket]] = {}
        self._lock = asyncio.Lock()
    
    async def connect(self, websocket: WebSocket, user_id: Optional[int] = None):
        """Accept and store a new WebSocket connection."""
        await websocket.accept()
        async with self._lock:
            self.active_connections.add(websocket)
            
            # Track user-specific connections
            if user_id:
                if user_id not in self.user_connections:
                    self.user_connections[user_id] = set()
                self.user_connections[user_id].add(websocket)
        
        logger.info(f"WebSocket connected (user_id={user_id}). Total: {len(self.active_connections)}")
    
    async def disconnect(self, websocket: WebSocket, user_id: Optional[int] = None):
        """Remove a WebSocket connection."""
        async with self._lock:
            self.active_connections.discard(websocket)
            
            # Remove from user-specific tracking
            if user_id and user_id in self.user_connections:
                self.user_connections[user_id].discard(websocket)
                if not self.user_connections[user_id]:
                    del self.user_connections[user_id]
        
        logger.info(f"WebSocket disconnected. Total: {len(self.active_connections)}")
    
    async def broadcast(self, message: dict):
        """Send a message to all connected clients."""
        if not self.active_connections:
            return
        
        # Check if message targets specific user(s)
        target_user_id = message.get("target_user_id")
        target_user_ids = message.get("target_user_ids", [])
        
        message_json = json.dumps(message)
        disconnected = set()
        
        async with self._lock:
            # Determine which connections to send to
            if target_user_id:
                # Send to specific user only
                connections = self.user_connections.get(target_user_id, set())
            elif target_user_ids:
                # Send to multiple specific users
                connections = set()
                for uid in target_user_ids:
                    connections.update(self.user_connections.get(uid, set()))
            else:
                # Broadcast to all
                connections = self.active_connections
            
            for connection in connections:
                try:
                    await connection.send_text(message_json)
                except Exception as e:
                    logger.warning(f"Failed to send to websocket: {e}")
                    disconnected.add(connection)
            
            # Clean up disconnected clients
            self.active_connections -= disconnected
            for user_id, conns in list(self.user_connections.items()):
                conns -= disconnected
                if not conns:
                    del self.user_connections[user_id]
    
    async def send_to_user(self, user_id: int, message: dict):
        """Send a message to a specific user's connections."""
        message["target_user_id"] = user_id
        await self.broadcast(message)
    
    async def send_device_update(self, event_type: str, device_id: int = None, data: dict = None):
        """
        Send a device-related update to all clients.
        
        event_type: 'device_added', 'device_updated', 'device_deleted', 
                   'scan_started', 'scan_completed', 'facts_updated', 'cache_updated'
        """
        message = {
            "type": event_type,
            "device_id": device_id,
            "data": data or {},
            "timestamp": asyncio.get_event_loop().time()
        }
        await self.broadcast(message)
    
    async def send_bulk_update(self, event_type: str, device_ids: list = None, data: dict = None):
        """Send a bulk update notification."""
        message = {
            "type": event_type,
            "device_ids": device_ids or [],
            "data": data or {},
            "timestamp": asyncio.get_event_loop().time()
        }
        await self.broadcast(message)
    
    def get_connection_stats(self) -> dict:
        """Get statistics about current connections."""
        return {
            "total_connections": len(self.active_connections),
            "authenticated_users": len(self.user_connections),
            "user_ids": list(self.user_connections.keys())
        }


# Global connection manager instance
manager = ConnectionManager()


# ═══════════════════════════════════════════════════════════════════════════════
# WEBSOCKET ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════════

@router.websocket("/ws/devices")
async def websocket_devices(websocket: WebSocket):
    """
    WebSocket endpoint for real-time device updates.
    
    Clients connect to this endpoint to receive live notifications
    about device changes without polling.
    """
    await manager.connect(websocket)
    try:
        # Send initial connection confirmation
        await websocket.send_json({
            "type": "connected",
            "message": "Connected to device updates stream"
        })
        
        # Keep connection alive and handle incoming messages
        while True:
            try:
                # Wait for any message (ping/pong or commands)
                data = await asyncio.wait_for(
                    websocket.receive_text(),
                    timeout=30.0  # 30 second timeout for ping
                )
                
                # Handle ping messages
                if data == "ping":
                    await websocket.send_text("pong")
                
            except asyncio.TimeoutError:
                # Send ping to keep connection alive
                try:
                    await websocket.send_text("ping")
                except:
                    break
                    
    except WebSocketDisconnect:
        logger.info("WebSocket client disconnected normally")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
    finally:
        await manager.disconnect(websocket)


@router.websocket("/ws/notifications")
async def websocket_notifications(
    websocket: WebSocket,
    token: Optional[str] = Query(None)
):
    """
    Authenticated WebSocket endpoint for user notifications.
    
    Clients must provide JWT token as query parameter.
    Receives both targeted and broadcast notifications.
    
    Usage: ws://host/api/v1/ws/notifications?token=<jwt_token>
    """
    user_id = None
    
    # Validate JWT token
    if token:
        try:
            payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
            username = payload.get("sub") or payload.get("username")
            if username:
                # Import here to avoid circular imports
                from db.base import SessionLocal
                from db.models import User
                
                db = SessionLocal()
                try:
                    user = db.query(User).filter(User.username == username).first()
                    if user and user.is_active:
                        user_id = user.id
                finally:
                    db.close()
        except JWTError as e:
            logger.warning(f"Invalid WebSocket token: {e}")
    
    # Connect (with or without user_id)
    await manager.connect(websocket, user_id=user_id)
    
    try:
        # Send initial connection confirmation
        await websocket.send_json({
            "type": "connected",
            "message": "Connected to notifications stream",
            "authenticated": user_id is not None,
            "user_id": user_id
        })
        
        # Keep connection alive and handle incoming messages
        while True:
            try:
                data = await asyncio.wait_for(
                    websocket.receive_text(),
                    timeout=30.0
                )
                
                # Handle ping messages
                if data == "ping":
                    await websocket.send_text("pong")
                
                # Handle mark-as-read via WebSocket (optional)
                try:
                    msg = json.loads(data)
                    if msg.get("action") == "mark_read" and user_id:
                        notification_ids = msg.get("notification_ids", [])
                        if notification_ids:
                            # Could process mark-as-read here if needed
                            await websocket.send_json({
                                "type": "ack",
                                "action": "mark_read",
                                "notification_ids": notification_ids
                            })
                except json.JSONDecodeError:
                    pass
                
            except asyncio.TimeoutError:
                try:
                    await websocket.send_text("ping")
                except:
                    break
                    
    except WebSocketDisconnect:
        logger.info(f"Notification WebSocket disconnected (user_id={user_id})")
    except Exception as e:
        logger.error(f"Notification WebSocket error: {e}")
    finally:
        await manager.disconnect(websocket, user_id=user_id)


@router.get("/ws/stats")
async def websocket_stats():
    """Get WebSocket connection statistics (for monitoring)."""
    return manager.get_connection_stats()


# ═══════════════════════════════════════════════════════════════════════════════
# HELPER FUNCTIONS
# ═══════════════════════════════════════════════════════════════════════════════

async def notify_device_change(event_type: str, device_id: int = None, data: dict = None):
    """Helper function to notify all clients of a device change."""
    await manager.send_device_update(event_type, device_id, data)


async def notify_bulk_change(event_type: str, device_ids: list = None, data: dict = None):
    """Helper function to notify all clients of a bulk change."""
    await manager.send_bulk_update(event_type, device_ids, data)


async def notify_user(user_id: int, notification_type: str, payload: dict):
    """Send a notification to a specific user."""
    message = {
        "type": "notification",
        "notification_type": notification_type,
        "payload": payload
    }
    await manager.send_to_user(user_id, message)


# Synchronous wrapper for use in non-async contexts (like Celery tasks)
def sync_notify_device_change(event_type: str, device_id: int = None, data: dict = None):
    """Synchronous wrapper for notify_device_change."""
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            asyncio.create_task(notify_device_change(event_type, device_id, data))
        else:
            loop.run_until_complete(notify_device_change(event_type, device_id, data))
    except RuntimeError:
        # Create new loop if none exists
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        loop.run_until_complete(notify_device_change(event_type, device_id, data))
