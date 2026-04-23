/**
 * 📈 Custom Hook para manejo de datos de tendencias temporales
 * CMT v2.5 - Lógica de análisis temporal y comparación de períodos
 */

import { useState, useEffect, useCallback, useMemo } from 'react';

/**
 * 🎯 Hook principal para tendencias temporales
 */
export const useTemporalTrends = (initialConfig = {}) => {
  const [config, setConfig] = useState({
    category: 'certificates',
    metrics: ['total_certificates', 'expiring_soon'],
    period: '30d',
    comparison: 'previous_period',
    aggregation: 'daily',
    ...initialConfig
  });

  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);

  /**
   * 📊 Cargar datos desde la API
   */
  const fetchTrendData = useCallback(async (customConfig = null) => {
    const activeConfig = customConfig || config;
    setLoading(true);
    setError(null);

    try {
      // En producción, esto llamaría a la API real
      const response = await fetch('/api/trends', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(activeConfig)
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      setData(result.data || []);
      setLastUpdate(new Date());
    } catch (err) {
      console.error('Error fetching trend data:', err);
      // Para demostración, usar datos mock
      const mockData = generateMockData(activeConfig);
      setData(mockData);
      setLastUpdate(new Date());
    } finally {
      setLoading(false);
    }
  }, [config]);

  /**
   * 🔄 Actualizar configuración
   */
  const updateConfig = useCallback((newConfig) => {
    setConfig(prev => ({ ...prev, ...newConfig }));
  }, []);

  /**
   * 📊 Generar datos mock para demostración
   */
  const generateMockData = useCallback((activeConfig) => {
    const { period, category, metrics } = activeConfig;
    const days = getPeriodDays(period);
    const data = [];
    const today = new Date();

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      
      const dataPoint = {
        date: date.toISOString().split('T')[0],
        timestamp: date.getTime(),
        dayOfWeek: date.getDay(),
        weekOfYear: getWeekOfYear(date),
        month: date.getMonth(),
        quarter: Math.floor(date.getMonth() / 3)
      };

      // Generar valores para cada métrica
      metrics.forEach(metric => {
        dataPoint[metric] = generateMetricValue(metric, i, days, category);
      });

      data.push(dataPoint);
    }

    return data;
  }, []);

  /**
   * 📅 Obtener días del período
   */
  const getPeriodDays = (period) => {
    const periodMap = {
      '7d': 7,
      '30d': 30,
      '90d': 90,
      '1y': 365,
      'custom': 30
    };
    return periodMap[period] || 30;
  };

  /**
   * 📊 Generar valor para métrica específica
   */
  const generateMetricValue = (metric, dayIndex, totalDays, category) => {
    const baseValues = {
      // Certificados
      total_certificates: 150,
      expiring_soon: 15,
      expired: 5,
      new_certificates: 3,
      average_validity_days: 365,
      
      // Dispositivos
      total_devices: 120,
      online_devices: 110,
      offline_devices: 10,
      devices_with_issues: 8,
      
      // Seguridad
      security_score: 85,
      vulnerabilities: 3,
      compliance_score: 92,
      alerts_generated: 12
    };

    const baseValue = baseValues[metric] || 50;
    
    // Tendencias realistas
    const trends = {
      total_certificates: Math.sin((dayIndex / totalDays) * Math.PI) * 5,
      expiring_soon: Math.cos((dayIndex / totalDays) * Math.PI * 2) * 3,
      security_score: Math.sin((dayIndex / totalDays) * Math.PI * 0.5) * 2,
      vulnerabilities: Math.max(0, Math.sin((dayIndex / totalDays) * Math.PI * 3) * 2)
    };

    const trend = trends[metric] || 0;
    const noise = (Math.random() - 0.5) * (baseValue * 0.1);
    const value = baseValue + trend + noise;

    // Formatear según tipo de métrica
    if (metric.includes('score') || metric.includes('percentage')) {
      return Math.max(0, Math.min(100, value));
    } else if (metric.includes('days')) {
      return Math.max(1, value);
    } else {
      return Math.max(0, Math.floor(value));
    }
  };

  /**
   * 📅 Obtener semana del año
   */
  const getWeekOfYear = (date) => {
    const firstDay = new Date(date.getFullYear(), 0, 1);
    const days = Math.floor((date - firstDay) / (24 * 60 * 60 * 1000));
    return Math.ceil((days + firstDay.getDay() + 1) / 7);
  };

  // Auto-actualizar datos cuando cambia la configuración
  useEffect(() => {
    fetchTrendData();
  }, [fetchTrendData]);

  return {
    config,
    data,
    loading,
    error,
    lastUpdate,
    updateConfig,
    refreshData: fetchTrendData
  };
};

/**
 * 🔄 Hook para comparación de períodos
 */
export const usePeriodComparison = (data, config) => {
  return useMemo(() => {
    if (!data.length || data.length < 2) return null;

    const comparisonData = {};
    const midPoint = Math.floor(data.length / 2);
    const firstPeriod = data.slice(0, midPoint);
    const secondPeriod = data.slice(midPoint);

    config.metrics.forEach(metric => {
      const firstAvg = calculateAverage(firstPeriod, metric);
      const secondAvg = calculateAverage(secondPeriod, metric);
      const change = secondAvg - firstAvg;
      const changePercent = firstAvg !== 0 ? (change / firstAvg) * 100 : 0;

      comparisonData[metric] = {
        current: secondAvg,
        previous: firstAvg,
        change,
        changePercent,
        trend: determineTrend(change, changePercent),
        significance: determineSignificance(changePercent)
      };
    });

    return comparisonData;
  }, [data, config.metrics]);
};

/**
 * 📊 Hook para insights automáticos
 */
export const useInsightGeneration = (data, comparison, config) => {
  return useMemo(() => {
    const insights = [];

    if (!data.length || !comparison) return insights;

    // Insight general sobre tendencias
    const trends = Object.values(comparison);
    const positiveTrends = trends.filter(t => t.trend === 'positive').length;
    const negativeTrends = trends.filter(t => t.trend === 'negative').length;

    if (positiveTrends > negativeTrends) {
      insights.push({
        id: 'general_positive',
        type: 'positive',
        title: 'Tendencia General Positiva',
        description: `${positiveTrends} de ${trends.length} métricas muestran mejora`,
        severity: 'success',
        priority: 'medium',
        category: 'trend_analysis'
      });
    } else if (negativeTrends > positiveTrends) {
      insights.push({
        id: 'general_negative',
        type: 'warning',
        title: 'Atención: Tendencia Negativa',
        description: `${negativeTrends} de ${trends.length} métricas requieren atención`,
        severity: 'warning',
        priority: 'high',
        category: 'trend_analysis'
      });
    }

    // Insights específicos por métrica
    Object.entries(comparison).forEach(([metric, metricData]) => {
      // Cambios significativos
      if (metricData.significance === 'high') {
        insights.push({
          id: `${metric}_significant_change`,
          type: metricData.trend,
          title: `Cambio Significativo: ${getMetricLabel(metric)}`,
          description: `${metricData.changePercent > 0 ? 'Incremento' : 'Decremento'} del ${Math.abs(metricData.changePercent).toFixed(1)}%`,
          severity: metricData.trend === 'negative' ? 'error' : 'info',
          priority: 'high',
          category: 'significant_change',
          metric
        });
      }

      // Insights específicos por tipo de métrica
      if (metric === 'expiring_soon' && metricData.trend === 'positive') {
        insights.push({
          id: 'expiring_certificates_alert',
          type: 'warning',
          title: 'Aumento en Certificados por Expirar',
          description: 'Se recomienda revisar y renovar certificados próximos a expirar',
          severity: 'warning',
          priority: 'high',
          category: 'action_required',
          metric
        });
      }

      if (metric === 'security_score' && metricData.trend === 'negative') {
        insights.push({
          id: 'security_score_decline',
          type: 'critical',
          title: 'Declive en Puntuación de Seguridad',
          description: 'Se requiere acción inmediata para mejorar la seguridad',
          severity: 'error',
          priority: 'critical',
          category: 'security_alert',
          metric
        });
      }
    });

    // Predicciones basadas en tendencias
    const predictions = generatePredictions(data, config);
    insights.push(...predictions);

    // Anomalías detectadas
    const anomalies = detectAnomalies(data, config);
    insights.push(...anomalies);

    return insights.sort((a, b) => {
      const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  }, [data, comparison, config]);
};

/**
 * 📈 Hook para predicciones
 */
export const usePredictions = (data, config) => {
  return useMemo(() => {
    if (!data.length || data.length < 7) return [];

    const predictions = [];
    const recentData = data.slice(-7); // Últimos 7 días

    config.metrics.forEach(metric => {
      const values = recentData.map(d => d[metric] || 0);
      const trend = calculateLinearTrend(values);
      
      if (Math.abs(trend.slope) > 0.1) {
        const futureValue = trend.slope * 7 + trend.intercept; // Predicción a 7 días
        const currentValue = values[values.length - 1];
        const change = ((futureValue - currentValue) / currentValue) * 100;

        predictions.push({
          metric,
          currentValue,
          predictedValue: futureValue,
          change,
          confidence: trend.correlation > 0.7 ? 'high' : trend.correlation > 0.4 ? 'medium' : 'low',
          trend: trend.slope > 0 ? 'increasing' : 'decreasing'
        });
      }
    });

    return predictions;
  }, [data, config.metrics]);
};

/**
 * 🔧 Funciones auxiliares
 */

const calculateAverage = (data, metric) => {
  const values = data.map(item => item[metric] || 0);
  return values.reduce((sum, val) => sum + val, 0) / values.length;
};

const determineTrend = (change, changePercent) => {
  if (Math.abs(changePercent) < 1) return 'neutral';
  return change > 0 ? 'positive' : 'negative';
};

const determineSignificance = (changePercent) => {
  const absChange = Math.abs(changePercent);
  if (absChange > 50) return 'high';
  if (absChange > 20) return 'medium';
  return 'low';
};

const getMetricLabel = (metric) => {
  const labels = {
    total_certificates: 'Total Certificados',
    expiring_soon: 'Próximos a Expirar',
    expired: 'Expirados',
    new_certificates: 'Nuevos Certificados',
    security_score: 'Puntuación Seguridad',
    vulnerabilities: 'Vulnerabilidades'
  };
  return labels[metric] || metric;
};

const generatePredictions = (data, config) => {
  const predictions = [];
  
  if (data.length < 14) return predictions;

  // Predicción simple basada en tendencia lineal
  const recentData = data.slice(-14);
  
  config.metrics.forEach(metric => {
    const values = recentData.map(d => d[metric] || 0);
    const trend = calculateLinearTrend(values);
    
    if (trend.correlation > 0.6) {
      const days = 7;
      const prediction = trend.slope * (values.length + days) + trend.intercept;
      const current = values[values.length - 1];
      const change = ((prediction - current) / current) * 100;
      
      if (Math.abs(change) > 10) {
        predictions.push({
          id: `prediction_${metric}`,
          type: 'prediction',
          title: `Predicción: ${getMetricLabel(metric)}`,
          description: `Se proyecta un ${change > 0 ? 'incremento' : 'decremento'} del ${Math.abs(change).toFixed(1)}% en 7 días`,
          severity: 'info',
          priority: 'medium',
          category: 'prediction',
          confidence: trend.correlation > 0.8 ? 'alta' : 'media'
        });
      }
    }
  });

  return predictions;
};

const detectAnomalies = (data, config) => {
  const anomalies = [];
  
  if (data.length < 30) return anomalies;

  config.metrics.forEach(metric => {
    const values = data.map(d => d[metric] || 0);
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const stdDev = Math.sqrt(
      values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length
    );

    // Detectar valores fuera de 2 desviaciones estándar
    const recentValue = values[values.length - 1];
    const zScore = Math.abs((recentValue - mean) / stdDev);

    if (zScore > 2) {
      anomalies.push({
        id: `anomaly_${metric}`,
        type: 'anomaly',
        title: `Anomalía Detectada: ${getMetricLabel(metric)}`,
        description: `Valor actual (${recentValue.toFixed(1)}) está fuera del rango normal`,
        severity: 'warning',
        priority: 'high',
        category: 'anomaly',
        zScore: zScore.toFixed(2)
      });
    }
  });

  return anomalies;
};

const calculateLinearTrend = (values) => {
  const n = values.length;
  const x = Array.from({ length: n }, (_, i) => i);
  const y = values;

  const sumX = x.reduce((sum, val) => sum + val, 0);
  const sumY = y.reduce((sum, val) => sum + val, 0);
  const sumXY = x.reduce((sum, val, i) => sum + val * y[i], 0);
  const sumXX = x.reduce((sum, val) => sum + val * val, 0);

  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;

  // Calcular coeficiente de correlación
  const meanX = sumX / n;
  const meanY = sumY / n;
  const numerator = x.reduce((sum, val, i) => sum + (val - meanX) * (y[i] - meanY), 0);
  const denomX = Math.sqrt(x.reduce((sum, val) => sum + Math.pow(val - meanX, 2), 0));
  const denomY = Math.sqrt(y.reduce((sum, val) => sum + Math.pow(val - meanY, 2), 0));
  const correlation = numerator / (denomX * denomY);

  return { slope, intercept, correlation };
};

export default {
  useTemporalTrends,
  usePeriodComparison,
  useInsightGeneration,
  usePredictions
};