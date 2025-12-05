# backend/api/endpoints/websocket.py
"""
WebSocket endpoint for real-time device updates.

This module provides real-time notifications to connected clients
when device data changes (scans, facts refresh, cache updates, etc.)
"""

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from typing import Set
import asyncio
import json

from core.logger import setup_logger

logger = setup_logger("cmt.websocket")

router = APIRouter()

# Store active WebSocket connections
class ConnectionManager:
    """Manages WebSocket connections and broadcasts."""
    
    def __init__(self):
        self.active_connections: Set[WebSocket] = set()
        self._lock = asyncio.Lock()
    
    async def connect(self, websocket: WebSocket):
        """Accept and store a new WebSocket connection."""
        await websocket.accept()
        async with self._lock:
            self.active_connections.add(websocket)
        logger.info(f"WebSocket connected. Total connections: {len(self.active_connections)}")
    
    async def disconnect(self, websocket: WebSocket):
        """Remove a WebSocket connection."""
        async with self._lock:
            self.active_connections.discard(websocket)
        logger.info(f"WebSocket disconnected. Total connections: {len(self.active_connections)}")
    
    async def broadcast(self, message: dict):
        """Send a message to all connected clients."""
        if not self.active_connections:
            return
        
        message_json = json.dumps(message)
        disconnected = set()
        
        async with self._lock:
            for connection in self.active_connections:
                try:
                    await connection.send_text(message_json)
                except Exception as e:
                    logger.warning(f"Failed to send to websocket: {e}")
                    disconnected.add(connection)
            
            # Clean up disconnected clients
            self.active_connections -= disconnected
    
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


# Global connection manager instance
manager = ConnectionManager()


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


# Helper function to broadcast from other modules
async def notify_device_change(event_type: str, device_id: int = None, data: dict = None):
    """Helper function to notify all clients of a device change."""
    await manager.send_device_update(event_type, device_id, data)


async def notify_bulk_change(event_type: str, device_ids: list = None, data: dict = None):
    """Helper function to notify all clients of a bulk change."""
    await manager.send_bulk_update(event_type, device_ids, data)


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
