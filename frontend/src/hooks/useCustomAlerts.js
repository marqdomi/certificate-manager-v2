/**
 * 🚨 Custom Hook para sistema de alertas personalizables
 * CMT v2.5 - Lógica de gestión de alertas, evaluación de condiciones y notificaciones
 */

import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * 🎯 Hook principal para alertas personalizables
 */
export const useCustomAlerts = (data = [], config = {}) => {
  const [alerts, setAlerts] = useState([]);
  const [alertHistory, setAlertHistory] = useState([]);
  const [activeAlerts, setActiveAlerts] = useState([]);
  const [evaluationState, setEvaluationState] = useState({});
  const intervalRef = useRef(null);

  const {
    evaluationInterval = 60000, // 1 minuto por defecto
    maxHistorySize = 1000,
    enableNotifications = true,
    onAlertTriggered,
    onAlertResolved
  } = config;

  /**
   * 🔄 Cargar alertas guardadas
   */
  useEffect(() => {
    loadSavedAlerts();
    loadAlertHistory();
  }, []);

  /**
   * ⚡ Iniciar evaluación automática
   */
  useEffect(() => {
    if (alerts.length > 0 && data.length > 0) {
      startEvaluation();
    } else {
      stopEvaluation();
    }

    return () => stopEvaluation();
  }, [alerts, data]);

  const loadSavedAlerts = () => {
    try {
      const saved = localStorage.getItem('cmt_custom_alerts');
      if (saved) {
        const parsedAlerts = JSON.parse(saved);
        setAlerts(parsedAlerts);
      }
    } catch (error) {
      console.error('Error loading alerts:', error);
    }
  };

  const loadAlertHistory = () => {
    try {
      const saved = localStorage.getItem('cmt_alert_history');
      if (saved) {
        const parsedHistory = JSON.parse(saved);
        setAlertHistory(parsedHistory);
      }
    } catch (error) {
      console.error('Error loading alert history:', error);
    }
  };

  /**
   * ⏰ Iniciar evaluación periódica
   */
  const startEvaluation = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    // Evaluación inicial
    evaluateAllAlerts();

    // Evaluación periódica
    intervalRef.current = setInterval(() => {
      evaluateAllAlerts();
    }, evaluationInterval);
  }, [alerts, data, evaluationInterval]);

  /**
   * ⏹️ Detener evaluación
   */
  const stopEvaluation = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  /**
   * 🧮 Evaluar todas las alertas
   */
  const evaluateAllAlerts = useCallback(async () => {
    const enabledAlerts = alerts.filter(alert => alert.enabled);
    const evaluationResults = [];

    for (const alert of enabledAlerts) {
      try {
        const result = await evaluateAlert(alert, data);
        evaluationResults.push({ alert, result });

        if (result.triggered && !isAlertActive(alert.id)) {
          await triggerAlert(alert, result);
        } else if (!result.triggered && isAlertActive(alert.id)) {
          await resolveAlert(alert);
        }
      } catch (error) {
        console.error(`Error evaluating alert ${alert.id}:`, error);
      }
    }

    // Actualizar estado de evaluación
    const newEvaluationState = {};
    evaluationResults.forEach(({ alert, result }) => {
      newEvaluationState[alert.id] = {
        lastEvaluation: new Date().toISOString(),
        result,
        nextEvaluation: new Date(Date.now() + evaluationInterval).toISOString()
      };
    });
    setEvaluationState(newEvaluationState);
  }, [alerts, data, evaluationInterval]);

  /**
   * 🔍 Evaluar una alerta específica
   */
  const evaluateAlert = async (alert, currentData) => {
    if (!currentData.length) {
      return { triggered: false, reason: 'No data available' };
    }

    // Verificar horario activo
    if (!isWithinActiveSchedule(alert)) {
      return { triggered: false, reason: 'Outside active schedule' };
    }

    // Evaluar cada condición
    const conditionResults = [];
    for (const condition of alert.conditions) {
      const result = await evaluateCondition(condition, currentData, alert);
      conditionResults.push(result);
    }

    // Determinar si la alerta debe activarse (todas las condiciones deben cumplirse)
    const allConditionsMet = conditionResults.every(result => result.met);
    
    return {
      triggered: allConditionsMet,
      conditions: conditionResults,
      reason: allConditionsMet ? 'All conditions met' : 'Conditions not met',
      value: conditionResults[0]?.value,
      timestamp: new Date().toISOString()
    };
  };

  /**
   * 🎯 Evaluar condición específica
   */
  const evaluateCondition = async (condition, currentData, alert) => {
    const { metric, type, operator, value: thresholdValue, timeWindow = 5 } = condition;
    
    // Obtener datos recientes basados en la ventana de tiempo
    const cutoffTime = Date.now() - (timeWindow * 60 * 1000);
    const recentData = currentData.filter(d => 
      new Date(d.timestamp || d.date).getTime() > cutoffTime
    );

    if (!recentData.length) {
      return { met: false, reason: 'No recent data', value: null };
    }

    const currentValue = getCurrentValue(recentData, metric, type);
    
    let conditionMet = false;
    let reason = '';

    switch (type) {
      case 'threshold':
        conditionMet = evaluateThresholdCondition(currentValue, operator, thresholdValue);
        reason = `${metric} ${operator} ${thresholdValue} (current: ${currentValue})`;
        break;

      case 'change':
        const changeResult = evaluateChangeCondition(recentData, metric, operator, thresholdValue);
        conditionMet = changeResult.met;
        reason = changeResult.reason;
        break;

      case 'pattern':
        const patternResult = evaluatePatternCondition(recentData, metric, operator, thresholdValue);
        conditionMet = patternResult.met;
        reason = patternResult.reason;
        break;

      case 'anomaly':
        const anomalyResult = evaluateAnomalyCondition(recentData, metric, operator);
        conditionMet = anomalyResult.met;
        reason = anomalyResult.reason;
        break;

      default:
        conditionMet = false;
        reason = 'Unknown condition type';
    }

    return {
      met: conditionMet,
      reason,
      value: currentValue,
      metric,
      operator,
      threshold: thresholdValue
    };
  };

  /**
   * 📊 Obtener valor actual según el tipo de condición
   */
  const getCurrentValue = (data, metric, type) => {
    const values = data.map(d => d[metric] || 0).filter(v => v !== null && v !== undefined);
    
    if (!values.length) return 0;

    switch (type) {
      case 'threshold':
      case 'anomaly':
        return values[values.length - 1]; // Último valor
      
      case 'change':
        if (values.length < 2) return 0;
        return ((values[values.length - 1] - values[0]) / values[0]) * 100;
      
      case 'pattern':
        return values[values.length - 1];
      
      default:
        return values[values.length - 1];
    }
  };

  /**
   * 🎯 Evaluar condición de umbral
   */
  const evaluateThresholdCondition = (currentValue, operator, threshold) => {
    const numThreshold = parseFloat(threshold);
    const numValue = parseFloat(currentValue);

    switch (operator) {
      case 'gt': return numValue > numThreshold;
      case 'gte': return numValue >= numThreshold;
      case 'lt': return numValue < numThreshold;
      case 'lte': return numValue <= numThreshold;
      case 'eq': return numValue === numThreshold;
      case 'neq': return numValue !== numThreshold;
      default: return false;
    }
  };

  /**
   * 📈 Evaluar condición de cambio
   */
  const evaluateChangeCondition = (data, metric, operator, threshold) => {
    const values = data.map(d => d[metric] || 0);
    
    if (values.length < 2) {
      return { met: false, reason: 'Insufficient data for change calculation' };
    }

    const firstValue = values[0];
    const lastValue = values[values.length - 1];
    const changePercent = firstValue !== 0 ? ((lastValue - firstValue) / firstValue) * 100 : 0;
    const absChange = Math.abs(changePercent);
    const numThreshold = parseFloat(threshold);

    let met = false;
    switch (operator) {
      case 'increase':
        met = changePercent > 0 && changePercent > numThreshold;
        break;
      case 'decrease':
        met = changePercent < 0 && Math.abs(changePercent) > numThreshold;
        break;
      case 'change':
        met = absChange > numThreshold;
        break;
    }

    return {
      met,
      reason: `${metric} changed ${changePercent.toFixed(2)}% (threshold: ${threshold}%)`
    };
  };

  /**
   * 🔄 Evaluar condición de patrón
   */
  const evaluatePatternCondition = (data, metric, operator, threshold) => {
    const values = data.map(d => d[metric] || 0);
    const numThreshold = parseFloat(threshold);

    switch (operator) {
      case 'consecutive_above':
        const consecutiveAbove = getConsecutiveCount(values, v => v > numThreshold);
        return {
          met: consecutiveAbove >= 3, // Mínimo 3 consecutivos
          reason: `${consecutiveAbove} consecutive values above ${threshold}`
        };

      case 'consecutive_below':
        const consecutiveBelow = getConsecutiveCount(values, v => v < numThreshold);
        return {
          met: consecutiveBelow >= 3,
          reason: `${consecutiveBelow} consecutive values below ${threshold}`
        };

      case 'pattern_match':
        // Patrón simple: tendencia creciente sostenida
        const isIncreasing = values.every((val, i) => 
          i === 0 || val >= values[i - 1]
        );
        return {
          met: isIncreasing && values.length >= 3,
          reason: isIncreasing ? 'Increasing pattern detected' : 'No pattern match'
        };

      default:
        return { met: false, reason: 'Unknown pattern operator' };
    }
  };

  /**
   * 🚨 Evaluar condición de anomalía
   */
  const evaluateAnomalyCondition = (data, metric, operator) => {
    const values = data.map(d => d[metric] || 0);
    
    if (values.length < 10) {
      return { met: false, reason: 'Insufficient data for anomaly detection' };
    }

    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const stdDev = Math.sqrt(
      values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length
    );

    const currentValue = values[values.length - 1];
    const zScore = stdDev !== 0 ? Math.abs((currentValue - mean) / stdDev) : 0;

    switch (operator) {
      case 'statistical_outlier':
        return {
          met: zScore > 2, // Más de 2 desviaciones estándar
          reason: `Z-score: ${zScore.toFixed(2)} (threshold: 2.0)`
        };

      case 'trend_break':
        // Simplificado: detectar cambio brusco
        const recentAvg = values.slice(-3).reduce((sum, val) => sum + val, 0) / 3;
        const historicalAvg = values.slice(0, -3).reduce((sum, val) => sum + val, 0) / (values.length - 3);
        const trendBreak = Math.abs((recentAvg - historicalAvg) / historicalAvg) > 0.3;
        
        return {
          met: trendBreak,
          reason: `Trend break detected: ${((recentAvg - historicalAvg) / historicalAvg * 100).toFixed(2)}% change`
        };

      case 'volatility_spike':
        const changes = values.slice(1).map((val, i) => Math.abs(val - values[i]));
        const avgChange = changes.reduce((sum, val) => sum + val, 0) / changes.length;
        const recentChange = changes[changes.length - 1];
        const volatilitySpike = recentChange > avgChange * 2;

        return {
          met: volatilitySpike,
          reason: `Volatility spike: current change ${recentChange.toFixed(2)} vs avg ${avgChange.toFixed(2)}`
        };

      default:
        return { met: false, reason: 'Unknown anomaly operator' };
    }
  };

  /**
   * 🔢 Obtener conteo consecutivo
   */
  const getConsecutiveCount = (values, condition) => {
    let count = 0;
    for (let i = values.length - 1; i >= 0; i--) {
      if (condition(values[i])) {
        count++;
      } else {
        break;
      }
    }
    return count;
  };

  /**
   * 📅 Verificar si está dentro del horario activo
   */
  const isWithinActiveSchedule = (alert) => {
    if (!alert.schedule?.enabled) return true;

    const now = new Date();
    const currentDay = now.getDay();
    const currentTime = now.getHours() * 60 + now.getMinutes();

    // Verificar día activo
    if (!alert.schedule.active_days.includes(currentDay)) {
      return false;
    }

    // Verificar hora activa
    const [startHour, startMin] = alert.schedule.active_hours.start.split(':').map(Number);
    const [endHour, endMin] = alert.schedule.active_hours.end.split(':').map(Number);
    const startTime = startHour * 60 + startMin;
    const endTime = endHour * 60 + endMin;

    return currentTime >= startTime && currentTime <= endTime;
  };

  /**
   * 🚨 Activar alerta
   */
  const triggerAlert = async (alert, evaluationResult) => {
    const alertEvent = {
      id: Date.now(),
      alert_id: alert.id,
      alert_name: alert.name,
      severity: alert.severity,
      triggered_at: new Date().toISOString(),
      conditions: evaluationResult.conditions,
      value: evaluationResult.value,
      is_test: false
    };

    // Agregar a alertas activas
    setActiveAlerts(prev => [...prev, alertEvent]);

    // Agregar al historial
    const newHistory = [alertEvent, ...alertHistory].slice(0, maxHistorySize);
    setAlertHistory(newHistory);
    localStorage.setItem('cmt_alert_history', JSON.stringify(newHistory));

    // Actualizar contador de activaciones
    const updatedAlerts = alerts.map(a => 
      a.id === alert.id 
        ? { 
            ...a, 
            triggered_count: (a.triggered_count || 0) + 1,
            last_triggered: alertEvent.triggered_at
          }
        : a
    );
    setAlerts(updatedAlerts);
    localStorage.setItem('cmt_custom_alerts', JSON.stringify(updatedAlerts));

    // Enviar notificaciones
    if (enableNotifications) {
      await sendNotifications(alert, alertEvent);
    }

    // Callback externo
    if (onAlertTriggered) {
      onAlertTriggered(alertEvent);
    }

    console.log(`🚨 Alert triggered: ${alert.name}`, alertEvent);
  };

  /**
   * ✅ Resolver alerta
   */
  const resolveAlert = async (alert) => {
    // Remover de alertas activas
    setActiveAlerts(prev => prev.filter(a => a.alert_id !== alert.id));

    if (onAlertResolved) {
      onAlertResolved(alert);
    }

    console.log(`✅ Alert resolved: ${alert.name}`);
  };

  /**
   * 📧 Enviar notificaciones
   */
  const sendNotifications = async (alert, event) => {
    const { channels, templates } = alert.notifications;

    for (const channel of channels) {
      try {
        switch (channel) {
          case 'email':
            await sendEmailNotification(alert, event, templates.email);
            break;
          case 'sms':
            await sendSmsNotification(alert, event);
            break;
          case 'webhook':
            await sendWebhookNotification(alert, event);
            break;
          case 'slack':
            await sendSlackNotification(alert, event);
            break;
        }
      } catch (error) {
        console.error(`Error sending ${channel} notification:`, error);
      }
    }
  };

  /**
   * 📧 Enviar notificación por email (simulado)
   */
  const sendEmailNotification = async (alert, event, template) => {
    const subject = replaceTemplateVariables(template.subject, alert, event);
    const body = replaceTemplateVariables(template.body, alert, event);

    console.log(`📧 Email notification:`, { subject, body });
    
    // En producción, aquí se integraría con un servicio de email real
    return Promise.resolve();
  };

  /**
   * 📱 Enviar notificación SMS (simulado)
   */
  const sendSmsNotification = async (alert, event) => {
    const message = `Alerta CMT: ${alert.name} - ${event.conditions[0]?.reason || 'Condición activada'}`;
    console.log(`📱 SMS notification:`, message);
    return Promise.resolve();
  };

  /**
   * 🔗 Enviar webhook (simulado)
   */
  const sendWebhookNotification = async (alert, event) => {
    const payload = {
      alert_id: alert.id,
      alert_name: alert.name,
      severity: alert.severity,
      triggered_at: event.triggered_at,
      conditions: event.conditions,
      value: event.value
    };

    console.log(`🔗 Webhook notification:`, payload);
    return Promise.resolve();
  };

  /**
   * 💬 Enviar notificación Slack (simulado)
   */
  const sendSlackNotification = async (alert, event) => {
    const message = {
      text: `🚨 Alert: ${alert.name}`,
      attachments: [{
        color: alert.severity === 'critical' ? 'danger' : 'warning',
        fields: [
          { title: 'Severity', value: alert.severity, short: true },
          { title: 'Triggered', value: event.triggered_at, short: true },
          { title: 'Condition', value: event.conditions[0]?.reason || 'N/A', short: false }
        ]
      }]
    };

    console.log(`💬 Slack notification:`, message);
    return Promise.resolve();
  };

  /**
   * 🔄 Reemplazar variables en plantillas
   */
  const replaceTemplateVariables = (template, alert, event) => {
    return template
      .replace(/\{\{alert_name\}\}/g, alert.name)
      .replace(/\{\{condition_description\}\}/g, event.conditions[0]?.reason || 'N/A')
      .replace(/\{\{value\}\}/g, event.value || 'N/A')
      .replace(/\{\{timestamp\}\}/g, new Date(event.triggered_at).toLocaleString());
  };

  /**
   * ❓ Verificar si alerta está activa
   */
  const isAlertActive = (alertId) => {
    return activeAlerts.some(alert => alert.alert_id === alertId);
  };

  /**
   * 🧪 Probar alerta manualmente
   */
  const testAlert = useCallback(async (alert) => {
    const testEvent = {
      id: Date.now(),
      alert_id: alert.id,
      alert_name: alert.name,
      severity: alert.severity,
      triggered_at: new Date().toISOString(),
      conditions: [{ reason: 'Manual test', met: true }],
      value: 'Test value',
      is_test: true
    };

    // Agregar al historial
    const newHistory = [testEvent, ...alertHistory].slice(0, maxHistorySize);
    setAlertHistory(newHistory);
    localStorage.setItem('cmt_alert_history', JSON.stringify(newHistory));

    // Enviar notificaciones de prueba
    if (enableNotifications) {
      await sendNotifications(alert, testEvent);
    }

    if (onAlertTriggered) {
      onAlertTriggered(testEvent);
    }

    return testEvent;
  }, [alertHistory, enableNotifications, onAlertTriggered]);

  return {
    alerts,
    setAlerts,
    alertHistory,
    activeAlerts,
    evaluationState,
    evaluateAlert,
    testAlert,
    startEvaluation,
    stopEvaluation,
    isAlertActive
  };
};

/**
 * 📊 Hook para estadísticas de alertas
 */
export const useAlertStatistics = (alerts, history) => {
  const stats = {
    totalAlerts: alerts.length,
    activeAlerts: alerts.filter(a => a.enabled).length,
    totalTriggers: history.length,
    triggersToday: history.filter(h => 
      new Date(h.triggered_at).toDateString() === new Date().toDateString()
    ).length,
    severityBreakdown: alerts.reduce((acc, alert) => {
      acc[alert.severity] = (acc[alert.severity] || 0) + 1;
      return acc;
    }, {}),
    mostTriggeredAlert: alerts.reduce((most, alert) => 
      (alert.triggered_count || 0) > (most?.triggered_count || 0) ? alert : most, null
    ),
    averageTriggersPerAlert: alerts.length > 0 
      ? alerts.reduce((sum, alert) => sum + (alert.triggered_count || 0), 0) / alerts.length 
      : 0
  };

  return stats;
};

export default { useCustomAlerts, useAlertStatistics };