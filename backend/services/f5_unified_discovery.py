"""
F5 Unified Discovery Service

Combines facts scanning and cluster discovery into a single optimized operation
following Microsoft best practices for network monitoring automation.

This service reduces F5 device load by performing multiple operations in a single connection,
improves data consistency, and provides better user experience.
"""

import asyncio
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple, Any
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_

from core.config import settings
from db.models import Device
from services.f5_service_logic import F5ServiceLogic
from services.f5_facts import F5FactsService
from services.f5_cluster_discovery import F5ClusterDiscoveryService
from services.encryption_service import EncryptionService

logger = logging.getLogger(__name__)

class F5UnifiedDiscoveryService:
    """
    Unified service that combines F5 facts scanning and cluster discovery
    in a single optimized operation following Microsoft monitoring best practices.
    """
    
    def __init__(self):
        self.f5_service = F5ServiceLogic()
        self.facts_service = F5FactsService()
        self.cluster_service = F5ClusterDiscoveryService()
        self.encryption_service = EncryptionService()
        
        # Monitoring intervals following Microsoft best practices
        self.monitoring_intervals = {
            'full_discovery': timedelta(days=1),      # Complete discovery daily
            'delta_discovery': timedelta(hours=6),    # Incremental every 6 hours  
            'health_check': timedelta(minutes=5),     # Health monitoring every 5 minutes
            'performance_metrics': timedelta(minutes=1)  # Critical metrics every minute
        }
    
    async def unified_discovery_operation(
        self, 
        device_id: int, 
        db: Session,
        discovery_type: str = "full",
        include_performance: bool = False
    ) -> Dict[str, Any]:
        """
        Perform unified discovery operation combining facts and cluster discovery.
        
        Args:
            device_id: ID of the F5 device
            db: Database session
            discovery_type: Type of discovery ('full', 'delta', 'health')
            include_performance: Whether to include performance metrics
            
        Returns:
            Dictionary with operation results and metadata
        """
        start_time = datetime.utcnow()
        operation_log = {
            'device_id': device_id,
            'discovery_type': discovery_type,
            'start_time': start_time,
            'operations_performed': [],
            'success': False,
            'errors': [],
            'data_updated': {}
        }
        
        try:
            # Get device from database
            device = db.query(Device).filter(Device.id == device_id).first()
            if not device:
                raise ValueError(f"Device with ID {device_id} not found")
            
            logger.info(f"Starting unified discovery for device {device.name} (ID: {device_id})")
            
            # Establish single F5 connection for all operations
            f5_client = None
            try:
                f5_client = await self._establish_f5_connection(device)
                operation_log['operations_performed'].append('connection_established')
                
                # Determine which operations to perform based on discovery type
                operations_to_perform = self._determine_operations(device, discovery_type)
                
                # Perform facts scanning if needed
                facts_result = None
                if 'facts' in operations_to_perform:
                    facts_result = await self._perform_facts_scanning(
                        f5_client, device, db
                    )
                    operation_log['operations_performed'].append('facts_scanning')
                    operation_log['data_updated']['facts'] = facts_result.get('updated_fields', [])
                
                # Perform cluster discovery if needed
                cluster_result = None
                if 'cluster' in operations_to_perform:
                    cluster_result = await self._perform_cluster_discovery(
                        f5_client, device, db
                    )
                    operation_log['operations_performed'].append('cluster_discovery')
                    operation_log['data_updated']['cluster'] = cluster_result.get('cluster_info', {})
                
                # Perform health monitoring if needed
                health_result = None
                if 'health' in operations_to_perform:
                    health_result = await self._perform_health_monitoring(
                        f5_client, device, db
                    )
                    operation_log['operations_performed'].append('health_monitoring')
                    operation_log['data_updated']['health'] = health_result.get('health_status', {})
                
                # Perform performance metrics if requested
                performance_result = None
                if include_performance:
                    performance_result = await self._perform_performance_monitoring(
                        f5_client, device, db
                    )
                    operation_log['operations_performed'].append('performance_monitoring')
                    operation_log['data_updated']['performance'] = performance_result.get('metrics', {})
                
                # Update device last discovery timestamp
                device.last_unified_discovery = datetime.utcnow()
                if 'facts' in operations_to_perform:
                    device.last_facts_scan = datetime.utcnow()
                if 'cluster' in operations_to_perform:
                    device.last_cluster_discovery = datetime.utcnow()
                
                db.commit()
                operation_log['success'] = True
                
                logger.info(f"Unified discovery completed for device {device.name}")
                
            finally:
                # Always close F5 connection
                if f5_client:
                    try:
                        await f5_client.close()
                    except Exception as e:
                        logger.warning(f"Error closing F5 connection: {e}")
                        
        except Exception as e:
            logger.error(f"Unified discovery failed for device {device_id}: {e}")
            operation_log['errors'].append(str(e))
            db.rollback()
            
        operation_log['end_time'] = datetime.utcnow()
        operation_log['duration'] = (operation_log['end_time'] - start_time).total_seconds()
        
        return operation_log
    
    async def bulk_unified_discovery(
        self, 
        device_ids: List[int], 
        db: Session,
        discovery_type: str = "full",
        max_concurrent: int = 5
    ) -> Dict[str, Any]:
        """
        Perform unified discovery on multiple devices concurrently.
        
        Args:
            device_ids: List of device IDs to process
            db: Database session
            discovery_type: Type of discovery to perform
            max_concurrent: Maximum concurrent operations
            
        Returns:
            Summary of bulk operation results
        """
        start_time = datetime.utcnow()
        
        # Create semaphore to limit concurrent operations
        semaphore = asyncio.Semaphore(max_concurrent)
        
        async def process_device(device_id: int) -> Dict[str, Any]:
            async with semaphore:
                return await self.unified_discovery_operation(
                    device_id, db, discovery_type
                )
        
        # Execute discovery operations concurrently
        tasks = [process_device(device_id) for device_id in device_ids]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Process results
        successful_operations = []
        failed_operations = []
        
        for i, result in enumerate(results):
            if isinstance(result, Exception):
                failed_operations.append({
                    'device_id': device_ids[i],
                    'error': str(result)
                })
            elif result.get('success'):
                successful_operations.append(result)
            else:
                failed_operations.append(result)
        
        end_time = datetime.utcnow()
        
        return {
            'operation': 'bulk_unified_discovery',
            'discovery_type': discovery_type,
            'start_time': start_time,
            'end_time': end_time,
            'duration': (end_time - start_time).total_seconds(),
            'total_devices': len(device_ids),
            'successful': len(successful_operations),
            'failed': len(failed_operations),
            'success_rate': len(successful_operations) / len(device_ids) * 100,
            'successful_operations': successful_operations,
            'failed_operations': failed_operations
        }
    
    def should_perform_discovery(
        self, 
        device: Device, 
        discovery_type: str
    ) -> bool:
        """
        Determine if discovery should be performed based on last discovery time
        and configured intervals (Microsoft best practices).
        """
        now = datetime.utcnow()
        
        if discovery_type == "full":
            if not device.last_unified_discovery:
                return True
            return now - device.last_unified_discovery >= self.monitoring_intervals['full_discovery']
        
        elif discovery_type == "delta":
            if not device.last_facts_scan:
                return True
            return now - device.last_facts_scan >= self.monitoring_intervals['delta_discovery']
        
        elif discovery_type == "health":
            if not device.last_health_check:
                return True
            return now - device.last_health_check >= self.monitoring_intervals['health_check']
        
        return True  # Default to performing discovery
    
    def _determine_operations(self, device: Device, discovery_type: str) -> List[str]:
        """Determine which operations to perform based on discovery type and device state."""
        operations = []
        
        if discovery_type == "full":
            operations.extend(['facts', 'cluster', 'health'])
        elif discovery_type == "delta":
            operations.append('facts')  # Only facts for delta discovery
        elif discovery_type == "health":
            operations.append('health')  # Only health monitoring
        elif discovery_type == "cluster":
            operations.append('cluster')  # Only cluster discovery
        
        return operations
    
    async def _establish_f5_connection(self, device: Device):
        """Establish connection to F5 device with proper authentication."""
        try:
            # Decrypt credentials
            decrypted_username = self.encryption_service.decrypt(device.username)
            decrypted_password = self.encryption_service.decrypt(device.password)
            
            # Create F5 client connection
            f5_client = await self.f5_service.create_f5_client(
                host=device.ip_address,
                username=decrypted_username,
                password=decrypted_password
            )
            
            return f5_client
            
        except Exception as e:
            logger.error(f"Failed to establish F5 connection to {device.ip_address}: {e}")
            raise
    
    async def _perform_facts_scanning(
        self, 
        f5_client, 
        device: Device, 
        db: Session
    ) -> Dict[str, Any]:
        """Perform F5 facts scanning using existing service."""
        try:
            facts_result = await self.facts_service.scan_device_facts(
                f5_client, device, db
            )
            return facts_result
        except Exception as e:
            logger.error(f"Facts scanning failed for device {device.name}: {e}")
            raise
    
    async def _perform_cluster_discovery(
        self, 
        f5_client, 
        device: Device, 
        db: Session
    ) -> Dict[str, Any]:
        """Perform F5 cluster discovery using existing service."""
        try:
            cluster_result = await self.cluster_service.discover_cluster_from_f5(
                device, db
            )
            return cluster_result
        except Exception as e:
            logger.error(f"Cluster discovery failed for device {device.name}: {e}")
            raise
    
    async def _perform_health_monitoring(
        self, 
        f5_client, 
        device: Device, 
        db: Session
    ) -> Dict[str, Any]:
        """Perform basic health monitoring checks."""
        try:
            # Basic connectivity and version check
            system_info = await f5_client.tm.sys.version.load()
            
            health_status = {
                'connectivity': 'healthy',
                'api_response_time': datetime.utcnow(),
                'system_version': getattr(system_info, 'product_version', 'unknown'),
                'last_health_check': datetime.utcnow()
            }
            
            # Update device health timestamp
            device.last_health_check = datetime.utcnow()
            
            return {'health_status': health_status}
            
        except Exception as e:
            logger.error(f"Health monitoring failed for device {device.name}: {e}")
            return {
                'health_status': {
                    'connectivity': 'unhealthy',
                    'error': str(e),
                    'last_health_check': datetime.utcnow()
                }
            }
    
    async def _perform_performance_monitoring(
        self, 
        f5_client, 
        device: Device, 
        db: Session
    ) -> Dict[str, Any]:
        """Perform performance metrics collection."""
        try:
            # Basic performance metrics
            stats = await f5_client.tm.sys.performance.stats.load()
            
            performance_metrics = {
                'cpu_usage': getattr(stats.entries, 'cpu_usage', 0),
                'memory_usage': getattr(stats.entries, 'memory_usage', 0),
                'connection_count': getattr(stats.entries, 'connection_count', 0),
                'timestamp': datetime.utcnow()
            }
            
            return {'metrics': performance_metrics}
            
        except Exception as e:
            logger.warning(f"Performance monitoring failed for device {device.name}: {e}")
            return {'metrics': {}}

# Singleton instance
unified_discovery_service = F5UnifiedDiscoveryService()