/**
 * 🔧 Report Export Service
 * CMT v2.5 - Servicio para generación y exportación de reportes
 */

import jsPDF from 'jspdf';
import 'jspdf-autotable';
import * as XLSX from 'xlsx';

/**
 * 📊 Report Generator Class
 */
export class ReportGenerator {
  constructor() {
    this.defaultSettings = {
      pageSize: 'a4',
      orientation: 'portrait',
      margins: { top: 20, right: 20, bottom: 20, left: 20 },
      fontSize: 12,
      fontFamily: 'helvetica',
      colors: {
        primary: '#1976d2',
        secondary: '#424242',
        accent: '#ff9800',
        background: '#f5f5f5'
      }
    };
  }

  /**
   * 📄 Generar reporte PDF
   */
  async generatePDF(data, config) {
    const doc = new jsPDF({
      orientation: config.pageOrientation || 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    let yPosition = 30;

    // Header del documento
    this.addPDFHeader(doc, config, pageWidth);
    yPosition += 20;

    // Resumen ejecutivo
    if (config.includeSummary) {
      yPosition = this.addPDFSummary(doc, data, config, yPosition, pageWidth);
    }

    // Tabla de datos
    yPosition = this.addPDFTable(doc, data, config, yPosition);

    // Gráficos (si están habilitados)
    if (config.includeCharts && config.charts) {
      yPosition = await this.addPDFCharts(doc, config.charts, yPosition, pageWidth);
    }

    // Footer
    this.addPDFFooter(doc, config, pageWidth, pageHeight);

    // Generar y descargar
    const fileName = `${config.title.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(fileName);

    return {
      success: true,
      fileName,
      fileSize: this.calculatePDFSize(doc),
      recordCount: data.length
    };
  }

  /**
   * 📊 Generar archivo Excel
   */
  async generateExcel(data, config) {
    const workbook = XLSX.utils.book_new();

    // Hoja principal con datos
    const worksheet = XLSX.utils.json_to_sheet(
      data.map(item => {
        const filteredItem = {};
        config.fields.forEach(field => {
          filteredItem[field.label] = this.formatCellValue(item[field.key], field.type);
        });
        return filteredItem;
      })
    );

    // Aplicar estilos y formato
    this.applyExcelFormatting(worksheet, config);

    XLSX.utils.book_append_sheet(workbook, worksheet, 'Datos');

    // Hoja de resumen (si está habilitada)
    if (config.includeSummary) {
      const summarySheet = this.createExcelSummary(data, config);
      XLSX.utils.book_append_sheet(workbook, summarySheet, 'Resumen');
    }

    // Hoja de gráficos (si están habilitados)
    if (config.includeCharts) {
      const chartsSheet = this.createExcelCharts(data, config);
      XLSX.utils.book_append_sheet(workbook, chartsSheet, 'Gráficos');
    }

    // Generar y descargar
    const fileName = `${config.title.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(workbook, fileName);

    return {
      success: true,
      fileName,
      fileSize: this.calculateExcelSize(workbook),
      recordCount: data.length
    };
  }

  /**
   * 📋 Generar archivo CSV
   */
  async generateCSV(data, config) {
    const headers = config.fields.map(field => field.label);
    const csvContent = [
      // Header con metadatos
      [`# ${config.title}`],
      [`# Generado: ${new Date().toLocaleString()}`],
      [`# Registros: ${data.length}`],
      [''], // Línea vacía
      // Headers de columnas
      headers,
      // Datos
      ...data.map(item => 
        config.fields.map(field => 
          this.formatCSVValue(item[field.key], field.type)
        )
      )
    ].map(row => row.join(',')).join('\n');

    // Crear y descargar archivo
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const fileName = `${config.title.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`;
    
    link.href = URL.createObjectURL(blob);
    link.download = fileName;
    link.click();

    return {
      success: true,
      fileName,
      fileSize: this.formatFileSize(blob.size),
      recordCount: data.length
    };
  }

  /**
   * 🎨 Agregar header al PDF
   */
  addPDFHeader(doc, config, pageWidth) {
    // Título principal
    doc.setFontSize(20);
    doc.setTextColor(this.defaultSettings.colors.primary);
    doc.text(config.title, pageWidth / 2, 20, { align: 'center' });

    // Subtítulo con fecha
    doc.setFontSize(12);
    doc.setTextColor(this.defaultSettings.colors.secondary);
    doc.text(
      `Generado el ${new Date().toLocaleDateString()} a las ${new Date().toLocaleTimeString()}`,
      pageWidth / 2,
      30,
      { align: 'center' }
    );

    // Línea separadora
    doc.setDrawColor(this.defaultSettings.colors.primary);
    doc.line(20, 35, pageWidth - 20, 35);
  }

  /**
   * 📈 Agregar resumen ejecutivo al PDF
   */
  addPDFSummary(doc, data, config, yPosition, pageWidth) {
    doc.setFontSize(16);
    doc.setTextColor(this.defaultSettings.colors.primary);
    doc.text('Resumen Ejecutivo', 20, yPosition);
    yPosition += 10;

    // Estadísticas básicas
    doc.setFontSize(12);
    doc.setTextColor(this.defaultSettings.colors.secondary);
    
    const stats = this.calculateSummaryStats(data, config);
    const summaryText = [
      `Total de registros: ${stats.totalRecords}`,
      `Período analizado: ${stats.period}`,
      `Última actualización: ${stats.lastUpdate}`
    ];

    summaryText.forEach((text, index) => {
      doc.text(text, 20, yPosition + (index * 6));
    });

    return yPosition + (summaryText.length * 6) + 10;
  }

  /**
   * 📊 Agregar tabla de datos al PDF
   */
  addPDFTable(doc, data, config, yPosition) {
    const headers = config.fields.map(field => field.label);
    const rows = data.slice(0, 1000).map(item => // Limitar a 1000 registros para PDF
      config.fields.map(field => 
        this.formatCellValue(item[field.key], field.type)
      )
    );

    doc.autoTable({
      head: [headers],
      body: rows,
      startY: yPosition,
      theme: 'grid',
      headStyles: {
        fillColor: this.hexToRgb(this.defaultSettings.colors.primary),
        textColor: 255,
        fontSize: 10,
        fontStyle: 'bold'
      },
      bodyStyles: {
        fontSize: 9,
        textColor: this.hexToRgb(this.defaultSettings.colors.secondary)
      },
      alternateRowStyles: {
        fillColor: this.hexToRgb(this.defaultSettings.colors.background)
      },
      margin: { left: 20, right: 20 }
    });

    return doc.lastAutoTable.finalY + 10;
  }

  /**
   * 🎨 Aplicar formato a Excel
   */
  applyExcelFormatting(worksheet, config) {
    const range = XLSX.utils.decode_range(worksheet['!ref']);
    
    // Formato de headers
    for (let col = range.s.c; col <= range.e.c; col++) {
      const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col });
      if (!worksheet[cellAddress]) continue;
      
      worksheet[cellAddress].s = {
        font: { bold: true, color: { rgb: "FFFFFF" } },
        fill: { fgColor: { rgb: "1976D2" } },
        alignment: { horizontal: "center", vertical: "center" }
      };
    }

    // Auto-ajustar ancho de columnas
    const columnWidths = config.fields.map(field => ({
      wch: Math.max(field.label.length, 15)
    }));
    worksheet['!cols'] = columnWidths;
  }

  /**
   * 📊 Crear hoja de resumen para Excel
   */
  createExcelSummary(data, config) {
    const stats = this.calculateSummaryStats(data, config);
    
    const summaryData = [
      ['Métrica', 'Valor'],
      ['Total de registros', stats.totalRecords],
      ['Período analizado', stats.period],
      ['Última actualización', stats.lastUpdate],
      ['Campos exportados', config.fields.length]
    ];

    return XLSX.utils.aoa_to_sheet(summaryData);
  }

  /**
   * 📈 Calcular estadísticas del resumen
   */
  calculateSummaryStats(data, config) {
    return {
      totalRecords: data.length,
      period: `${new Date().getFullYear()}`,
      lastUpdate: new Date().toLocaleString(),
      exportDate: new Date().toISOString()
    };
  }

  /**
   * 🔧 Formatear valor de celda
   */
  formatCellValue(value, type) {
    if (value === null || value === undefined) return '';
    
    switch (type) {
      case 'date':
        return new Date(value).toLocaleDateString();
      case 'datetime':
        return new Date(value).toLocaleString();
      case 'number':
        return Number(value).toLocaleString();
      case 'currency':
        return new Intl.NumberFormat('es-ES', {
          style: 'currency',
          currency: 'EUR'
        }).format(value);
      case 'percentage':
        return `${(Number(value) * 100).toFixed(2)}%`;
      case 'boolean':
        return value ? 'Sí' : 'No';
      default:
        return String(value);
    }
  }

  /**
   * 📋 Formatear valor para CSV
   */
  formatCSVValue(value, type) {
    const formatted = this.formatCellValue(value, type);
    // Escapar comillas y comas
    if (formatted.includes(',') || formatted.includes('"') || formatted.includes('\n')) {
      return `"${formatted.replace(/"/g, '""')}"`;
    }
    return formatted;
  }

  /**
   * 📏 Calcular tamaño de archivo
   */
  formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * 🎨 Convertir hex a RGB
   */
  hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? [
      parseInt(result[1], 16),
      parseInt(result[2], 16),
      parseInt(result[3], 16)
    ] : [0, 0, 0];
  }

  /**
   * 📊 Calcular tamaño estimado del PDF
   */
  calculatePDFSize(doc) {
    // Estimación aproximada basada en el contenido
    return this.formatFileSize(doc.internal.pages.length * 50000); // ~50KB por página
  }

  /**
   * 📈 Calcular tamaño estimado del Excel
   */
  calculateExcelSize(workbook) {
    // Estimación aproximada
    const sheets = Object.keys(workbook.Sheets).length;
    return this.formatFileSize(sheets * 100000); // ~100KB por hoja
  }
}

/**
 * 📅 Scheduled Export Manager
 */
export class ScheduledExportManager {
  constructor() {
    this.schedules = this.loadSchedules();
    this.generator = new ReportGenerator();
  }

  /**
   * 📝 Agregar programación
   */
  addSchedule(config) {
    const schedule = {
      id: Date.now(),
      ...config,
      createdAt: new Date().toISOString(),
      lastRun: null,
      nextRun: this.calculateNextRun(config)
    };

    this.schedules.push(schedule);
    this.saveSchedules();
    return schedule;
  }

  /**
   * 🗑️ Remover programación
   */
  removeSchedule(id) {
    this.schedules = this.schedules.filter(s => s.id !== id);
    this.saveSchedules();
  }

  /**
   * ⏰ Calcular próxima ejecución
   */
  calculateNextRun(config) {
    const now = new Date();
    const [hours, minutes] = config.time.split(':').map(Number);
    
    let nextRun = new Date();
    nextRun.setHours(hours, minutes, 0, 0);

    switch (config.frequency) {
      case 'daily':
        if (nextRun <= now) {
          nextRun.setDate(nextRun.getDate() + 1);
        }
        break;
      case 'weekly':
        const dayDiff = config.dayOfWeek - nextRun.getDay();
        if (dayDiff <= 0 || (dayDiff === 0 && nextRun <= now)) {
          nextRun.setDate(nextRun.getDate() + 7 + dayDiff);
        } else {
          nextRun.setDate(nextRun.getDate() + dayDiff);
        }
        break;
      case 'monthly':
        if (nextRun <= now) {
          nextRun.setMonth(nextRun.getMonth() + 1);
        }
        break;
    }

    return nextRun.toISOString();
  }

  /**
   * 💾 Guardar programaciones
   */
  saveSchedules() {
    localStorage.setItem('cmt_scheduled_exports', JSON.stringify(this.schedules));
  }

  /**
   * 📂 Cargar programaciones
   */
  loadSchedules() {
    try {
      const saved = localStorage.getItem('cmt_scheduled_exports');
      return saved ? JSON.parse(saved) : [];
    } catch (error) {
      console.error('Error loading scheduled exports:', error);
      return [];
    }
  }

  /**
   * 🏃 Ejecutar programaciones pendientes
   */
  runPendingSchedules() {
    const now = new Date();
    const pendingSchedules = this.schedules.filter(
      schedule => schedule.enabled && new Date(schedule.nextRun) <= now
    );

    pendingSchedules.forEach(async (schedule) => {
      try {
        // Aquí se ejecutaría la exportación real
        console.log('Running scheduled export:', schedule);
        
        // Actualizar próxima ejecución
        schedule.lastRun = now.toISOString();
        schedule.nextRun = this.calculateNextRun(schedule);
        
        this.saveSchedules();
      } catch (error) {
        console.error('Error running scheduled export:', error);
      }
    });
  }
}

// Instancia global del generador
export const reportGenerator = new ReportGenerator();
export const scheduledExportManager = new ScheduledExportManager();

// Verificar programaciones cada minuto
setInterval(() => {
  scheduledExportManager.runPendingSchedules();
}, 60000);

export default { ReportGenerator, ScheduledExportManager };