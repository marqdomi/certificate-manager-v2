/**
 * 🔮 Predictive Analytics Component
 * CMT v2.5 - Análisis predictivo y detección de anomalías
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Alert,
  Chip,
  LinearProgress,
  Button,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Tooltip,
  Badge,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material';
import {
  Psychology,
  TrendingUp,
  TrendingDown,
  Warning,
  Error,
  CheckCircle,
  Analytics,
  Timeline,
  Speed,
  ExpandMore,
  Info,
  Visibility,
  Schedule,
  NotificationImportant
} from '@mui/icons-material';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  ReferenceLine,
  Scatter,
  ScatterChart,
  Cell,
  PieChart,
  Pie,
  BarChart,
  Bar
} from 'recharts';

/**
 * 🎯 Configuración de predicciones
 */
const PREDICTION_MODELS = {
  linear: {
    name: 'Regresión Lineal',
    description: 'Predicción basada en tendencia lineal',
    accuracy: 'Media',
    timeframe: '7-30 días'
  },
  seasonal: {
    name: 'Análisis Estacional',
    description: 'Considera patrones estacionales',
    accuracy: 'Alta',
    timeframe: '30-90 días'
  },
  exponential: {
    name: 'Suavizado Exponencial',
    description: 'Pondera datos recientes',
    accuracy: 'Media-Alta',
    timeframe: '7-14 días'
  }
};

/**
 * 🚨 Tipos de anomalías
 */
const ANOMALY_TYPES = {
  spike: { name: 'Pico Anómalo', icon: TrendingUp, color: '#ff9800' },
  drop: { name: 'Caída Anómala', icon: TrendingDown, color: '#f44336' },
  plateau: { name: 'Meseta Inusual', icon: Timeline, color: '#2196f3' },
  volatility: { name: 'Alta Volatilidad', icon: Speed, color: '#9c27b0' }
};

/**
 * 🔮 Predictive Analytics Component
 */
const PredictiveAnalytics = ({ 
  data = [], 
  metrics = [], 
  onPredictionGenerated,
  onAnomalyDetected 
}) => {
  const [predictions, setPredictions] = useState([]);
  const [anomalies, setAnomalies] = useState([]);
  const [modelResults, setModelResults] = useState({});
  const [loading, setLoading] = useState(false);
  const [selectedPrediction, setSelectedPrediction] = useState(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  /**
   * 🧮 Generar predicciones
   */
  useEffect(() => {
    if (data.length > 0 && metrics.length > 0) {
      generatePredictions();
      detectAnomalies();
    }
  }, [data, metrics]);

  const generatePredictions = async () => {
    setLoading(true);
    try {
      const newPredictions = [];
      const newModelResults = {};

      for (const metric of metrics) {
        const metricData = data.map(d => ({ x: d.timestamp, y: d[metric] || 0 }));
        
        // Aplicar diferentes modelos
        const linearResult = applyLinearModel(metricData);
        const seasonalResult = applySeasonalModel(metricData);
        const exponentialResult = applyExponentialModel(metricData);

        newModelResults[metric] = {
          linear: linearResult,
          seasonal: seasonalResult,
          exponential: exponentialResult
        };

        // Seleccionar mejor modelo basado en accuracy
        const bestModel = selectBestModel([linearResult, seasonalResult, exponentialResult]);
        
        if (bestModel) {
          newPredictions.push({
            id: `${metric}_prediction`,
            metric,
            model: bestModel.type,
            confidence: bestModel.confidence,
            predictions: bestModel.predictions,
            trend: bestModel.trend,
            risk_level: calculateRiskLevel(bestModel),
            recommendations: generateRecommendations(metric, bestModel)
          });
        }
      }

      setPredictions(newPredictions);
      setModelResults(newModelResults);
      
      if (onPredictionGenerated) {
        onPredictionGenerated(newPredictions);
      }
    } catch (error) {
      console.error('Error generating predictions:', error);
    } finally {
      setLoading(false);
    }
  };

  /**
   * 🔍 Detectar anomalías
   */
  const detectAnomalies = () => {
    const newAnomalies = [];

    metrics.forEach(metric => {
      const values = data.map(d => d[metric] || 0);
      const detected = detectMetricAnomalies(values, metric);
      newAnomalies.push(...detected);
    });

    setAnomalies(newAnomalies);
    
    if (onAnomalyDetected && newAnomalies.length > 0) {
      onAnomalyDetected(newAnomalies);
    }
  };

  /**
   * 📊 Aplicar modelo lineal
   */
  const applyLinearModel = (data) => {
    if (data.length < 3) return null;

    const n = data.length;
    const x = data.map(d => d.x);
    const y = data.map(d => d.y);

    const sumX = x.reduce((sum, val) => sum + val, 0);
    const sumY = y.reduce((sum, val) => sum + val, 0);
    const sumXY = x.reduce((sum, val, i) => sum + val * y[i], 0);
    const sumXX = x.reduce((sum, val) => sum + val * val, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // Generar predicciones futuras
    const lastTimestamp = x[x.length - 1];
    const predictions = [];
    for (let i = 1; i <= 7; i++) {
      const futureX = lastTimestamp + (i * 24 * 60 * 60 * 1000); // +1 día
      const futureY = slope * futureX + intercept;
      predictions.push({ x: futureX, y: Math.max(0, futureY) });
    }

    // Calcular confianza basada en R²
    const meanY = sumY / n;
    const ssRes = y.reduce((sum, val, i) => sum + Math.pow(val - (slope * x[i] + intercept), 2), 0);
    const ssTot = y.reduce((sum, val) => sum + Math.pow(val - meanY, 2), 0);
    const rSquared = 1 - (ssRes / ssTot);

    return {
      type: 'linear',
      confidence: Math.max(0, Math.min(1, rSquared)),
      predictions,
      trend: slope > 0 ? 'increasing' : slope < 0 ? 'decreasing' : 'stable',
      parameters: { slope, intercept, rSquared }
    };
  };

  /**
   * 🌊 Aplicar modelo estacional
   */
  const applySeasonalModel = (data) => {
    if (data.length < 14) return null;

    // Análisis estacional simple basado en día de la semana
    const dayPatterns = {};
    
    data.forEach(point => {
      const date = new Date(point.x);
      const dayOfWeek = date.getDay();
      
      if (!dayPatterns[dayOfWeek]) {
        dayPatterns[dayOfWeek] = [];
      }
      dayPatterns[dayOfWeek].push(point.y);
    });

    // Calcular promedios por día
    const dayAverages = {};
    Object.keys(dayPatterns).forEach(day => {
      const values = dayPatterns[day];
      dayAverages[day] = values.reduce((sum, val) => sum + val, 0) / values.length;
    });

    // Generar predicciones basadas en patrones
    const lastTimestamp = data[data.length - 1].x;
    const predictions = [];
    
    for (let i = 1; i <= 7; i++) {
      const futureDate = new Date(lastTimestamp + (i * 24 * 60 * 60 * 1000));
      const dayOfWeek = futureDate.getDay();
      const prediction = dayAverages[dayOfWeek] || 0;
      
      predictions.push({ 
        x: futureDate.getTime(), 
        y: Math.max(0, prediction) 
      });
    }

    // Calcular confianza basada en consistencia de patrones
    const variance = Object.values(dayPatterns).map(values => {
      const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
      return values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    });
    
    const avgVariance = variance.reduce((sum, val) => sum + val, 0) / variance.length;
    const confidence = Math.max(0, 1 - (avgVariance / 1000)); // Normalizar

    return {
      type: 'seasonal',
      confidence,
      predictions,
      trend: 'seasonal',
      parameters: { dayAverages, variance: avgVariance }
    };
  };

  /**
   * 📈 Aplicar suavizado exponencial
   */
  const applyExponentialModel = (data) => {
    if (data.length < 5) return null;

    const alpha = 0.3; // Factor de suavizado
    const values = data.map(d => d.y);
    let smoothed = values[0];
    const smoothedValues = [smoothed];

    // Aplicar suavizado exponencial
    for (let i = 1; i < values.length; i++) {
      smoothed = alpha * values[i] + (1 - alpha) * smoothed;
      smoothedValues.push(smoothed);
    }

    // Generar predicciones
    const lastSmoothed = smoothedValues[smoothedValues.length - 1];
    const trend = smoothedValues[smoothedValues.length - 1] - smoothedValues[smoothedValues.length - 2];
    const lastTimestamp = data[data.length - 1].x;
    
    const predictions = [];
    for (let i = 1; i <= 7; i++) {
      const futureX = lastTimestamp + (i * 24 * 60 * 60 * 1000);
      const futureY = lastSmoothed + (trend * i);
      predictions.push({ x: futureX, y: Math.max(0, futureY) });
    }

    // Calcular confianza basada en error medio
    const errors = values.map((val, i) => Math.abs(val - smoothedValues[i]));
    const meanError = errors.reduce((sum, val) => sum + val, 0) / errors.length;
    const confidence = Math.max(0, 1 - (meanError / Math.max(...values)));

    return {
      type: 'exponential',
      confidence,
      predictions,
      trend: trend > 0 ? 'increasing' : trend < 0 ? 'decreasing' : 'stable',
      parameters: { alpha, lastSmoothed, trend }
    };
  };

  /**
   * 🎯 Seleccionar mejor modelo
   */
  const selectBestModel = (models) => {
    const validModels = models.filter(m => m !== null);
    if (validModels.length === 0) return null;

    return validModels.reduce((best, current) => 
      current.confidence > best.confidence ? current : best
    );
  };

  /**
   * 🚨 Detectar anomalías en métrica
   */
  const detectMetricAnomalies = (values, metric) => {
    const anomalies = [];
    
    if (values.length < 10) return anomalies;

    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const stdDev = Math.sqrt(
      values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length
    );

    // Detectar outliers (Z-score > 2)
    values.forEach((value, index) => {
      const zScore = Math.abs((value - mean) / stdDev);
      
      if (zScore > 2) {
        const type = value > mean ? 'spike' : 'drop';
        anomalies.push({
          id: `${metric}_anomaly_${index}`,
          metric,
          type,
          value,
          expected: mean,
          deviation: zScore,
          timestamp: data[index]?.timestamp || Date.now(),
          severity: zScore > 3 ? 'high' : 'medium'
        });
      }
    });

    // Detectar alta volatilidad
    const changes = values.slice(1).map((val, i) => Math.abs(val - values[i]));
    const avgChange = changes.reduce((sum, val) => sum + val, 0) / changes.length;
    const volatility = avgChange / mean;

    if (volatility > 0.2) {
      anomalies.push({
        id: `${metric}_volatility`,
        metric,
        type: 'volatility',
        value: volatility,
        severity: volatility > 0.5 ? 'high' : 'medium',
        timestamp: Date.now()
      });
    }

    return anomalies;
  };

  /**
   * ⚠️ Calcular nivel de riesgo
   */
  const calculateRiskLevel = (model) => {
    if (model.confidence < 0.3) return 'high';
    if (model.confidence < 0.6) return 'medium';
    return 'low';
  };

  /**
   * 💡 Generar recomendaciones
   */
  const generateRecommendations = (metric, model) => {
    const recommendations = [];

    if (model.trend === 'increasing' && metric.includes('expired')) {
      recommendations.push('Renovar certificados expirados inmediatamente');
    }
    
    if (model.trend === 'increasing' && metric.includes('vulnerabilities')) {
      recommendations.push('Implementar medidas de seguridad adicionales');
    }

    if (model.confidence < 0.5) {
      recommendations.push('Recopilar más datos para mejorar predicciones');
    }

    return recommendations;
  };

  /**
   * 🎨 Renderizar gráfico de predicciones
   */
  const renderPredictionChart = (prediction) => {
    const historicalData = data.map(d => ({
      x: d.timestamp,
      y: d[prediction.metric] || 0,
      type: 'historical'
    }));

    const futureData = prediction.predictions.map(p => ({
      x: p.x,
      y: p.y,
      type: 'prediction'
    }));

    const combinedData = [...historicalData, ...futureData];

    return (
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={combinedData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis 
            dataKey="x"
            type="number"
            scale="time"
            domain={['dataMin', 'dataMax']}
            tickFormatter={(timestamp) => new Date(timestamp).toLocaleDateString()}
          />
          <YAxis />
          <RechartsTooltip
            labelFormatter={(timestamp) => new Date(timestamp).toLocaleString()}
            contentStyle={{ backgroundColor: '#fff', border: '1px solid #ccc' }}
          />
          <Line
            type="monotone"
            dataKey="y"
            stroke="#1976d2"
            strokeWidth={2}
            dot={(props) => {
              const { payload } = props;
              return payload.type === 'prediction' ? 
                <circle r={4} fill="#ff9800" stroke="#ff9800" /> : 
                <circle r={3} fill="#1976d2" stroke="#1976d2" />;
            }}
            strokeDasharray={(props) => {
              // Línea discontinua para predicciones
              return props.payload?.type === 'prediction' ? '5 5' : '0';
            }}
          />
          <ReferenceLine 
            x={data[data.length - 1]?.timestamp} 
            stroke="#666" 
            strokeDasharray="2 2" 
          />
        </LineChart>
      </ResponsiveContainer>
    );
  };

  /**
   * 🚨 Renderizar tabla de anomalías
   */
  const renderAnomaliesTable = () => (
    <TableContainer component={Paper} variant="outlined">
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Métrica</TableCell>
            <TableCell>Tipo</TableCell>
            <TableCell>Valor</TableCell>
            <TableCell>Severidad</TableCell>
            <TableCell>Fecha</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {anomalies.map((anomaly, index) => {
            const AnomalyIcon = ANOMALY_TYPES[anomaly.type]?.icon || Warning;
            return (
              <TableRow key={index}>
                <TableCell>{anomaly.metric}</TableCell>
                <TableCell>
                  <Box display="flex" alignItems="center" gap={1}>
                    <AnomalyIcon 
                      sx={{ 
                        color: ANOMALY_TYPES[anomaly.type]?.color,
                        fontSize: '1.2rem' 
                      }} 
                    />
                    {ANOMALY_TYPES[anomaly.type]?.name || anomaly.type}
                  </Box>
                </TableCell>
                <TableCell>{anomaly.value.toFixed(2)}</TableCell>
                <TableCell>
                  <Chip
                    label={anomaly.severity}
                    size="small"
                    color={anomaly.severity === 'high' ? 'error' : 'warning'}
                  />
                </TableCell>
                <TableCell>
                  {new Date(anomaly.timestamp).toLocaleString()}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );

  return (
    <Box>
      {/* 🔮 Resumen de predicciones */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            🔮 Análisis Predictivo
          </Typography>
          
          {loading && <LinearProgress sx={{ mb: 2 }} />}
          
          <Grid container spacing={2}>
            <Grid item xs={12} md={4}>
              <Box textAlign="center">
                <Psychology sx={{ fontSize: '3rem', color: '#1976d2', mb: 1 }} />
                <Typography variant="h4">{predictions.length}</Typography>
                <Typography variant="body2" color="textSecondary">
                  Predicciones Activas
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={12} md={4}>
              <Box textAlign="center">
                <Warning sx={{ fontSize: '3rem', color: '#ff9800', mb: 1 }} />
                <Typography variant="h4">{anomalies.length}</Typography>
                <Typography variant="body2" color="textSecondary">
                  Anomalías Detectadas
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={12} md={4}>
              <Box textAlign="center">
                <Analytics sx={{ fontSize: '3rem', color: '#4caf50', mb: 1 }} />
                <Typography variant="h4">
                  {predictions.length > 0 ? Math.round(predictions.reduce((sum, p) => sum + p.confidence, 0) / predictions.length * 100) : 0}%
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  Confianza Promedio
                </Typography>
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* 📊 Predicciones por métrica */}
      {predictions.map((prediction, index) => (
        <Accordion key={index} sx={{ mb: 2 }}>
          <AccordionSummary expandIcon={<ExpandMore />}>
            <Box display="flex" alignItems="center" gap={2} width="100%">
              <Typography variant="h6">
                📈 {prediction.metric}
              </Typography>
              <Chip
                label={`${(prediction.confidence * 100).toFixed(0)}% confianza`}
                size="small"
                color={prediction.confidence > 0.7 ? 'success' : prediction.confidence > 0.4 ? 'warning' : 'error'}
              />
              <Chip
                label={prediction.model}
                size="small"
                variant="outlined"
              />
              <Box flexGrow={1} />
              <IconButton
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedPrediction(prediction);
                  setDetailsOpen(true);
                }}
              >
                <Visibility />
              </IconButton>
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            <Grid container spacing={3}>
              <Grid item xs={12} md={8}>
                {renderPredictionChart(prediction)}
              </Grid>
              <Grid item xs={12} md={4}>
                <Typography variant="subtitle2" gutterBottom>
                  📊 Información del Modelo
                </Typography>
                <Typography variant="body2" paragraph>
                  <strong>Modelo:</strong> {PREDICTION_MODELS[prediction.model]?.name}
                </Typography>
                <Typography variant="body2" paragraph>
                  <strong>Tendencia:</strong> {prediction.trend}
                </Typography>
                <Typography variant="body2" paragraph>
                  <strong>Nivel de Riesgo:</strong> 
                  <Chip 
                    label={prediction.risk_level} 
                    size="small" 
                    color={
                      prediction.risk_level === 'low' ? 'success' :
                      prediction.risk_level === 'medium' ? 'warning' : 'error'
                    }
                    sx={{ ml: 1 }}
                  />
                </Typography>
                
                {prediction.recommendations.length > 0 && (
                  <Box mt={2}>
                    <Typography variant="subtitle2" gutterBottom>
                      💡 Recomendaciones
                    </Typography>
                    {prediction.recommendations.map((rec, i) => (
                      <Alert key={i} severity="info" sx={{ mb: 1 }}>
                        {rec}
                      </Alert>
                    ))}
                  </Box>
                )}
              </Grid>
            </Grid>
          </AccordionDetails>
        </Accordion>
      ))}

      {/* 🚨 Anomalías detectadas */}
      {anomalies.length > 0 && (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              🚨 Anomalías Detectadas
            </Typography>
            {renderAnomaliesTable()}
          </CardContent>
        </Card>
      )}

      {/* 📊 Dialog de detalles */}
      <Dialog 
        open={detailsOpen} 
        onClose={() => setDetailsOpen(false)}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle>
          📊 Detalles de Predicción - {selectedPrediction?.metric}
        </DialogTitle>
        <DialogContent>
          {selectedPrediction && (
            <Box>
              {renderPredictionChart(selectedPrediction)}
              <Grid container spacing={2} sx={{ mt: 2 }}>
                <Grid item xs={12} md={6}>
                  <Typography variant="h6" gutterBottom>
                    📈 Parámetros del Modelo
                  </Typography>
                  <pre style={{ backgroundColor: '#f5f5f5', padding: '1rem', borderRadius: '4px' }}>
                    {JSON.stringify(selectedPrediction.parameters, null, 2)}
                  </pre>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="h6" gutterBottom>
                    🎯 Métricas de Calidad
                  </Typography>
                  <Typography variant="body2" paragraph>
                    <strong>Confianza:</strong> {(selectedPrediction.confidence * 100).toFixed(1)}%
                  </Typography>
                  <Typography variant="body2" paragraph>
                    <strong>Horizonte:</strong> {PREDICTION_MODELS[selectedPrediction.model]?.timeframe}
                  </Typography>
                  <Typography variant="body2" paragraph>
                    <strong>Precisión Esperada:</strong> {PREDICTION_MODELS[selectedPrediction.model]?.accuracy}
                  </Typography>
                </Grid>
              </Grid>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailsOpen(false)}>
            Cerrar
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default PredictiveAnalytics;