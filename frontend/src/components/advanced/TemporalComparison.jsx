/**
 * 📈 Temporal Comparison & Trends System
 * CMT v2.5 - Sistema de análisis temporal y comparación de tendencias
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  ButtonGroup,
  Chip,
  Alert,
  Divider,
  Tooltip,
  IconButton,
  Switch,
  FormControlLabel,
  Collapse,
  Stack
} from '@mui/material';
import {
  TrendingUp,
  TrendingDown,
  TrendingFlat,
  Compare,
  Timeline,
  CalendarMonth,
  Analytics,
  Warning,
  Info,
  KeyboardArrowDown,
  KeyboardArrowUp,
  Refresh,
  Download,
  Settings,
  Visibility,
  VisibilityOff
} from '@mui/icons-material';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  ComposedChart,
  ReferenceLine,
  ReferenceArea
} from 'recharts';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { es } from 'date-fns/locale';

/**
 * 🎨 Configuración de colores para tendencias
 */
const TREND_COLORS = {
  positive: '#4caf50',
  negative: '#f44336',
  neutral: '#ff9800',
  primary: '#1976d2',
  secondary: '#424242',
  background: '#f5f5f5'
};

/**
 * 📊 Métricas de tendencias disponibles
 */
const TREND_METRICS = {
  certificates: {
    label: 'Certificados',
    metrics: [
      { key: 'total_certificates', label: 'Total Certificados', format: 'number' },
      { key: 'expiring_soon', label: 'Próximos a Expirar', format: 'number' },
      { key: 'expired', label: 'Expirados', format: 'number' },
      { key: 'new_certificates', label: 'Nuevos Certificados', format: 'number' },
      { key: 'average_validity_days', label: 'Días Validez Promedio', format: 'days' }
    ]
  },
  devices: {
    label: 'Dispositivos',
    metrics: [
      { key: 'total_devices', label: 'Total Dispositivos', format: 'number' },
      { key: 'online_devices', label: 'Dispositivos Online', format: 'number' },
      { key: 'offline_devices', label: 'Dispositivos Offline', format: 'number' },
      { key: 'devices_with_issues', label: 'Dispositivos con Problemas', format: 'number' }
    ]
  },
  security: {
    label: 'Seguridad',
    metrics: [
      { key: 'security_score', label: 'Puntuación Seguridad', format: 'percentage' },
      { key: 'vulnerabilities', label: 'Vulnerabilidades', format: 'number' },
      { key: 'compliance_score', label: 'Cumplimiento', format: 'percentage' },
      { key: 'alerts_generated', label: 'Alertas Generadas', format: 'number' }
    ]
  }
};

/**
 * 📅 Períodos de comparación predefinidos
 */
const COMPARISON_PERIODS = [
  { value: '7d', label: 'Últimos 7 días', days: 7 },
  { value: '30d', label: 'Últimos 30 días', days: 30 },
  { value: '90d', label: 'Últimos 90 días', days: 90 },
  { value: '1y', label: 'Último año', days: 365 },
  { value: 'custom', label: 'Período personalizado', days: null }
];

/**
 * 📈 Temporal Comparison Component
 */
const TemporalComparison = ({
  data = [],
  onDataRequest,
  onExport,
  initialConfig = {}
}) => {
  // Estados principales
  const [config, setConfig] = useState({
    category: 'certificates',
    metrics: ['total_certificates', 'expiring_soon'],
    period: '30d',
    comparison: 'previous_period',
    chartType: 'line',
    showTrend: true,
    showPrediction: false,
    customDateRange: {
      start: null,
      end: null
    },
    ...initialConfig
  });

  const [loading, setLoading] = useState(false);
  const [trendData, setTrendData] = useState([]);
  const [comparisonData, setComparisonData] = useState(null);
  const [insights, setInsights] = useState([]);
  const [expandedSections, setExpandedSections] = useState({
    insights: true,
    comparison: true,
    trends: true
  });

  /**
   * 🔄 Cargar datos de tendencias
   */
  useEffect(() => {
    loadTrendData();
  }, [config.category, config.period, config.metrics]);

  const loadTrendData = async () => {
    setLoading(true);
    try {
      // Simular carga de datos (en producción vendría de la API)
      const mockData = generateMockTrendData();
      setTrendData(mockData);
      
      // Calcular comparación
      const comparison = calculateComparison(mockData);
      setComparisonData(comparison);
      
      // Generar insights
      const generatedInsights = generateInsights(mockData, comparison);
      setInsights(generatedInsights);
      
      if (onDataRequest) {
        await onDataRequest(config);
      }
    } catch (error) {
      console.error('Error loading trend data:', error);
    } finally {
      setLoading(false);
    }
  };

  /**
   * 📊 Generar datos mock para demostración
   */
  const generateMockTrendData = () => {
    const days = config.period === 'custom' 
      ? 30 
      : COMPARISON_PERIODS.find(p => p.value === config.period)?.days || 30;
    
    const data = [];
    const today = new Date();
    
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      
      const baseValue = 100;
      const trend = Math.sin((i / days) * Math.PI * 2) * 10;
      const noise = (Math.random() - 0.5) * 20;
      
      data.push({
        date: date.toISOString().split('T')[0],
        timestamp: date.getTime(),
        total_certificates: Math.max(0, Math.floor(baseValue + trend + noise)),
        expiring_soon: Math.max(0, Math.floor((baseValue + trend + noise) * 0.1)),
        expired: Math.max(0, Math.floor((baseValue + trend + noise) * 0.05)),
        new_certificates: Math.max(0, Math.floor(Math.random() * 10)),
        total_devices: Math.max(0, Math.floor((baseValue + trend + noise) * 0.8)),
        online_devices: Math.max(0, Math.floor((baseValue + trend + noise) * 0.7)),
        security_score: Math.max(0, Math.min(100, 85 + trend + (noise * 0.1))),
        vulnerabilities: Math.max(0, Math.floor(Math.random() * 5))
      });
    }
    
    return data;
  };

  /**
   * 📊 Calcular comparación entre períodos
   */
  const calculateComparison = (data) => {
    if (data.length < 2) return null;
    
    const midPoint = Math.floor(data.length / 2);
    const firstPeriod = data.slice(0, midPoint);
    const secondPeriod = data.slice(midPoint);
    
    const comparison = {};
    
    config.metrics.forEach(metric => {
      const firstAvg = firstPeriod.reduce((sum, item) => sum + (item[metric] || 0), 0) / firstPeriod.length;
      const secondAvg = secondPeriod.reduce((sum, item) => sum + (item[metric] || 0), 0) / secondPeriod.length;
      
      const change = secondAvg - firstAvg;
      const changePercent = firstAvg !== 0 ? (change / firstAvg) * 100 : 0;
      
      comparison[metric] = {
        current: secondAvg,
        previous: firstAvg,
        change,
        changePercent,
        trend: change > 0 ? 'positive' : change < 0 ? 'negative' : 'neutral'
      };
    });
    
    return comparison;
  };

  /**
   * 🧠 Generar insights automáticos
   */
  const generateInsights = (data, comparison) => {
    const insights = [];
    
    if (!comparison) return insights;
    
    // Insight sobre tendencias generales
    const trends = Object.values(comparison);
    const positiveTrends = trends.filter(t => t.trend === 'positive').length;
    const negativeTrends = trends.filter(t => t.trend === 'negative').length;
    
    if (positiveTrends > negativeTrends) {
      insights.push({
        type: 'positive',
        title: 'Tendencia Positiva General',
        description: `${positiveTrends} de ${trends.length} métricas muestran una tendencia positiva.`,
        severity: 'info'
      });
    } else if (negativeTrends > positiveTrends) {
      insights.push({
        type: 'warning',
        title: 'Tendencia Negativa Detectada',
        description: `${negativeTrends} de ${trends.length} métricas muestran una tendencia negativa.`,
        severity: 'warning'
      });
    }
    
    // Insights específicos por métrica
    Object.entries(comparison).forEach(([metric, data]) => {
      if (Math.abs(data.changePercent) > 20) {
        const metricConfig = TREND_METRICS[config.category]?.metrics.find(m => m.key === metric);
        insights.push({
          type: data.trend,
          title: `Cambio Significativo: ${metricConfig?.label || metric}`,
          description: `${data.changePercent > 0 ? 'Incremento' : 'Decremento'} del ${Math.abs(data.changePercent).toFixed(1)}%`,
          severity: Math.abs(data.changePercent) > 50 ? 'error' : 'warning'
        });
      }
    });
    
    // Predicciones simples
    if (config.showPrediction) {
      const lastValues = data.slice(-7);
      config.metrics.forEach(metric => {
        const values = lastValues.map(d => d[metric] || 0);
        const trend = values[values.length - 1] - values[0];
        
        if (Math.abs(trend) > 5) {
          const metricConfig = TREND_METRICS[config.category]?.metrics.find(m => m.key === metric);
          insights.push({
            type: 'prediction',
            title: `Predicción: ${metricConfig?.label || metric}`,
            description: `Basado en la tendencia actual, se espera ${trend > 0 ? 'un incremento' : 'una disminución'} en los próximos días.`,
            severity: 'info'
          });
        }
      });
    }
    
    return insights;
  };

  /**
   * 🎨 Obtener color de tendencia
   */
  const getTrendColor = (trend) => {
    switch (trend) {
      case 'positive': return TREND_COLORS.positive;
      case 'negative': return TREND_COLORS.negative;
      case 'neutral': return TREND_COLORS.neutral;
      default: return TREND_COLORS.primary;
    }
  };

  /**
   * 📊 Renderizar gráfico de tendencias
   */
  const renderTrendChart = () => {
    if (!trendData.length) return null;
    
    const ChartComponent = {
      line: LineChart,
      area: AreaChart,
      bar: BarChart,
      composed: ComposedChart
    }[config.chartType] || LineChart;
    
    return (
      <ResponsiveContainer width="100%" height={400}>
        <ChartComponent data={trendData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
          <XAxis 
            dataKey="date" 
            stroke="#666"
            tick={{ fontSize: 12 }}
          />
          <YAxis stroke="#666" tick={{ fontSize: 12 }} />
          <RechartsTooltip 
            contentStyle={{
              backgroundColor: '#fff',
              border: '1px solid #ccc',
              borderRadius: '4px'
            }}
          />
          <Legend />
          
          {config.metrics.map((metric, index) => {
            const metricConfig = TREND_METRICS[config.category]?.metrics.find(m => m.key === metric);
            const color = Object.values(TREND_COLORS)[index % Object.values(TREND_COLORS).length];
            
            if (config.chartType === 'line') {
              return (
                <Line
                  key={metric}
                  type="monotone"
                  dataKey={metric}
                  stroke={color}
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  name={metricConfig?.label || metric}
                />
              );
            } else if (config.chartType === 'area') {
              return (
                <Area
                  key={metric}
                  type="monotone"
                  dataKey={metric}
                  stackId="1"
                  stroke={color}
                  fill={color}
                  fillOpacity={0.3}
                  name={metricConfig?.label || metric}
                />
              );
            } else {
              return (
                <Bar
                  key={metric}
                  dataKey={metric}
                  fill={color}
                  name={metricConfig?.label || metric}
                />
              );
            }
          })}
        </ChartComponent>
      </ResponsiveContainer>
    );
  };

  /**
   * 📈 Renderizar comparación de períodos
   */
  const renderPeriodComparison = () => {
    if (!comparisonData) return null;
    
    return (
      <Grid container spacing={2}>
        {Object.entries(comparisonData).map(([metric, data]) => {
          const metricConfig = TREND_METRICS[config.category]?.metrics.find(m => m.key === metric);
          const TrendIcon = data.trend === 'positive' ? TrendingUp : 
                          data.trend === 'negative' ? TrendingDown : TrendingFlat;
          
          return (
            <Grid item xs={12} sm={6} md={3} key={metric}>
              <Card variant="outlined">
                <CardContent>
                  <Box display="flex" alignItems="center" justifyContent="space-between">
                    <Typography variant="h6" color="textSecondary" fontSize="0.875rem">
                      {metricConfig?.label || metric}
                    </Typography>
                    <TrendIcon 
                      sx={{ 
                        color: getTrendColor(data.trend),
                        fontSize: '1.5rem'
                      }} 
                    />
                  </Box>
                  
                  <Typography variant="h4" sx={{ my: 1 }}>
                    {data.current.toFixed(0)}
                  </Typography>
                  
                  <Box display="flex" alignItems="center" gap={1}>
                    <Chip
                      label={`${data.changePercent > 0 ? '+' : ''}${data.changePercent.toFixed(1)}%`}
                      size="small"
                      sx={{
                        backgroundColor: getTrendColor(data.trend),
                        color: 'white',
                        fontSize: '0.75rem'
                      }}
                    />
                    <Typography variant="caption" color="textSecondary">
                      vs período anterior
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          );
        })}
      </Grid>
    );
  };

  /**
   * 💡 Renderizar insights
   */
  const renderInsights = () => {
    if (!insights.length) return null;
    
    return (
      <Stack spacing={2}>
        {insights.map((insight, index) => (
          <Alert 
            key={index}
            severity={insight.severity}
            icon={
              insight.type === 'prediction' ? <Analytics /> :
              insight.type === 'positive' ? <TrendingUp /> :
              insight.type === 'warning' ? <Warning /> : <Info />
            }
          >
            <Typography variant="subtitle2" fontWeight="bold">
              {insight.title}
            </Typography>
            <Typography variant="body2">
              {insight.description}
            </Typography>
          </Alert>
        ))}
      </Stack>
    );
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={es}>
      <Box>
        {/* 🛠️ Panel de configuración */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              📈 Análisis Temporal y Tendencias
            </Typography>
            
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} sm={6} md={2}>
                <FormControl fullWidth size="small">
                  <InputLabel>Categoría</InputLabel>
                  <Select
                    value={config.category}
                    label="Categoría"
                    onChange={(e) => setConfig(prev => ({ 
                      ...prev, 
                      category: e.target.value,
                      metrics: TREND_METRICS[e.target.value]?.metrics.slice(0, 2).map(m => m.key) || []
                    }))}
                  >
                    {Object.entries(TREND_METRICS).map(([key, category]) => (
                      <MenuItem key={key} value={key}>
                        {category.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              
              <Grid item xs={12} sm={6} md={2}>
                <FormControl fullWidth size="small">
                  <InputLabel>Período</InputLabel>
                  <Select
                    value={config.period}
                    label="Período"
                    onChange={(e) => setConfig(prev => ({ ...prev, period: e.target.value }))}
                  >
                    {COMPARISON_PERIODS.map(period => (
                      <MenuItem key={period.value} value={period.value}>
                        {period.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              
              <Grid item xs={12} sm={6} md={2}>
                <ButtonGroup size="small" variant="outlined">
                  {['line', 'area', 'bar'].map(type => (
                    <Button
                      key={type}
                      variant={config.chartType === type ? 'contained' : 'outlined'}
                      onClick={() => setConfig(prev => ({ ...prev, chartType: type }))}
                    >
                      {type.charAt(0).toUpperCase() + type.slice(1)}
                    </Button>
                  ))}
                </ButtonGroup>
              </Grid>
              
              <Grid item xs={12} sm={6} md={3}>
                <Stack direction="row" spacing={1}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={config.showTrend}
                        onChange={(e) => setConfig(prev => ({ ...prev, showTrend: e.target.checked }))}
                        size="small"
                      />
                    }
                    label="Tendencias"
                  />
                  <FormControlLabel
                    control={
                      <Switch
                        checked={config.showPrediction}
                        onChange={(e) => setConfig(prev => ({ ...prev, showPrediction: e.target.checked }))}
                        size="small"
                      />
                    }
                    label="Predicciones"
                  />
                </Stack>
              </Grid>
              
              <Grid item xs={12} sm={6} md={1}>
                <Stack direction="row" spacing={1}>
                  <IconButton onClick={loadTrendData} disabled={loading}>
                    <Refresh />
                  </IconButton>
                  <IconButton onClick={() => onExport?.(trendData, config)}>
                    <Download />
                  </IconButton>
                </Stack>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
        
        {/* 📊 Comparación de períodos */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
              <Typography variant="h6">
                📊 Comparación de Períodos
              </Typography>
              <IconButton
                onClick={() => setExpandedSections(prev => ({ 
                  ...prev, 
                  comparison: !prev.comparison 
                }))}
              >
                {expandedSections.comparison ? <KeyboardArrowUp /> : <KeyboardArrowDown />}
              </IconButton>
            </Box>
            
            <Collapse in={expandedSections.comparison}>
              {renderPeriodComparison()}
            </Collapse>
          </CardContent>
        </Card>
        
        {/* 📈 Gráfico de tendencias */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
              <Typography variant="h6">
                📈 Tendencias Temporales
              </Typography>
              <IconButton
                onClick={() => setExpandedSections(prev => ({ 
                  ...prev, 
                  trends: !prev.trends 
                }))}
              >
                {expandedSections.trends ? <KeyboardArrowUp /> : <KeyboardArrowDown />}
              </IconButton>
            </Box>
            
            <Collapse in={expandedSections.trends}>
              {loading ? (
                <Box display="flex" justifyContent="center" py={4}>
                  <Typography color="textSecondary">Cargando datos...</Typography>
                </Box>
              ) : (
                renderTrendChart()
              )}
            </Collapse>
          </CardContent>
        </Card>
        
        {/* 💡 Insights automáticos */}
        <Card>
          <CardContent>
            <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
              <Typography variant="h6">
                💡 Insights y Predicciones
              </Typography>
              <IconButton
                onClick={() => setExpandedSections(prev => ({ 
                  ...prev, 
                  insights: !prev.insights 
                }))}
              >
                {expandedSections.insights ? <KeyboardArrowUp /> : <KeyboardArrowDown />}
              </IconButton>
            </Box>
            
            <Collapse in={expandedSections.insights}>
              {renderInsights()}
            </Collapse>
          </CardContent>
        </Card>
      </Box>
    </LocalizationProvider>
  );
};

export default TemporalComparison;