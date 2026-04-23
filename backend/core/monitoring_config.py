"""
Monitoring Configuration following Microsoft Best Practices
for Network Infrastructure Monitoring Automation

Based on Microsoft Operations Manager recommendations:
- Full Discovery: Weekly (7 days) with daily option for high-change environments  
- Delta Discovery: Every 6 hours for incremental changes
- Health Monitoring: Every 5 minutes for basic connectivity
- Performance Metrics: Every 1 minute for critical metrics
"""

from datetime import timedelta
from typing import Dict, Any
from pydantic import BaseModel
import os

class MonitoringIntervals(BaseModel):
    """Microsoft recommended monitoring intervals for network infrastructure"""
    
    # Discovery Operations (following Microsoft Operations Manager patterns)
    full_discovery: int = 24 * 60 * 60          # 24 hours - Complete discovery daily
    delta_discovery: int = 6 * 60 * 60           # 6 hours - Incremental changes  
    cluster_discovery: int = 12 * 60 * 60        # 12 hours - Cluster topology changes
    
    # Health and Performance Monitoring
    health_check: int = 5 * 60                   # 5 minutes - Basic connectivity
    performance_metrics: int = 60                # 1 minute - Critical metrics
    certificate_check: int = 60 * 60             # 1 hour - Certificate monitoring
    
    # Connection and Timeout Settings
    discovery_timeout: int = 300                 # 5 minutes per device discovery
    health_timeout: int = 30                     # 30 seconds per health check
    max_concurrent_operations: int = 5           # Concurrent F5 connections
    
    # Retry and Error Handling
    max_retries: int = 3                         # Max retry attempts
    retry_backoff: int = 60                      # Initial backoff in seconds
    
    class Config:
        env_prefix = "CMT_MONITORING_"

class MonitoringConfig:
    """
    Centralized monitoring configuration following Microsoft best practices
    for network device discovery and monitoring automation.
    """
    
    def __init__(self):
        self.intervals = MonitoringIntervals()
        self._load_environment_overrides()
    
    def _load_environment_overrides(self):
        """Load configuration overrides from environment variables"""
        
        # Full Discovery interval (default: 24 hours)
        if full_discovery := os.getenv('CMT_MONITORING_FULL_DISCOVERY'):
            self.intervals.full_discovery = int(full_discovery)
            
        # Delta Discovery interval (default: 6 hours) 
        if delta_discovery := os.getenv('CMT_MONITORING_DELTA_DISCOVERY'):
            self.intervals.delta_discovery = int(delta_discovery)
            
        # Health Check interval (default: 5 minutes)
        if health_check := os.getenv('CMT_MONITORING_HEALTH_CHECK'):
            self.intervals.health_check = int(health_check)
            
        # Max concurrent operations (default: 5)
        if max_concurrent := os.getenv('CMT_MONITORING_MAX_CONCURRENT'):
            self.intervals.max_concurrent_operations = int(max_concurrent)
    
    def get_interval_seconds(self, operation_type: str) -> int:
        """Get monitoring interval in seconds for specified operation type"""
        
        interval_map = {
            'full': self.intervals.full_discovery,
            'delta': self.intervals.delta_discovery, 
            'cluster': self.intervals.cluster_discovery,
            'health': self.intervals.health_check,
            'performance': self.intervals.performance_metrics,
            'certificates': self.intervals.certificate_check
        }
        
        return interval_map.get(operation_type, self.intervals.full_discovery)
    
    def get_interval_timedelta(self, operation_type: str) -> timedelta:
        """Get monitoring interval as timedelta object"""
        seconds = self.get_interval_seconds(operation_type)
        return timedelta(seconds=seconds)
    
    def should_run_discovery(self, last_run_time, operation_type: str) -> bool:
        """
        Determine if discovery operation should run based on Microsoft best practices
        
        Args:
            last_run_time: datetime of last operation
            operation_type: Type of operation ('full', 'delta', 'health', etc.)
            
        Returns:
            bool: True if operation should run
        """
        if not last_run_time:
            return True
            
        from datetime import datetime
        interval = self.get_interval_timedelta(operation_type)
        return datetime.utcnow() - last_run_time >= interval
    
    def get_recommended_schedule(self) -> Dict[str, Dict[str, Any]]:
        """
        Get recommended monitoring schedule following Microsoft best practices
        
        Returns scheduling information for Celery Beat or similar schedulers
        """
        return {
            'full_discovery': {
                'schedule_type': 'crontab',
                'hour': 2,  # 2:00 AM daily
                'minute': 0,
                'description': 'Complete device discovery (facts + clusters)',
                'interval_hours': 24,
                'microsoft_recommendation': 'Daily full discovery for network infrastructure'
            },
            'delta_discovery': {
                'schedule_type': 'crontab', 
                'minute': 0,
                'hour': '*/6',  # Every 6 hours
                'description': 'Incremental facts discovery',
                'interval_hours': 6,
                'microsoft_recommendation': 'Delta discovery for frequent changes'
            },
            'health_monitoring': {
                'schedule_type': 'crontab',
                'minute': '*/5',  # Every 5 minutes
                'description': 'Basic connectivity and health checks',
                'interval_minutes': 5,
                'microsoft_recommendation': 'Regular health monitoring for early detection'
            },
            'performance_monitoring': {
                'schedule_type': 'crontab',
                'minute': '*',  # Every minute 
                'description': 'Critical performance metrics collection',
                'interval_minutes': 1,
                'microsoft_recommendation': 'Frequent performance monitoring for critical systems'
            }
        }
    
    def get_discovery_strategy_info(self) -> Dict[str, str]:
        """Get information about Microsoft discovery strategy recommendations"""
        return {
            'strategy': 'Explicit + Recursive Discovery with Scheduled Intervals',
            'full_discovery': 'Complete topology scan with device-trust queries',
            'delta_discovery': 'Incremental changes detection via facts comparison', 
            'recursive_depth': 'Single-hop peer discovery via F5 device-trust',
            'protocol_priority': 'HTTPS/REST API preferred over SNMP for F5 devices',
            'error_handling': 'Exponential backoff with max 3 retries per device',
            'concurrency': 'Limited concurrent operations to prevent device overload',
            'best_practice_source': 'Microsoft Operations Manager Network Monitoring Guidelines'
        }
    
    def export_config(self) -> Dict[str, Any]:
        """Export current configuration for API responses or debugging"""
        return {
            'intervals': self.intervals.dict(),
            'schedule': self.get_recommended_schedule(),
            'strategy': self.get_discovery_strategy_info(),
            'microsoft_compliance': True,
            'version': 'CMT v2.5'
        }

# Global configuration instance
monitoring_config = MonitoringConfig()