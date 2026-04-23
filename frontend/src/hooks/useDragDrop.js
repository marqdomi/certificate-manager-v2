/**
 * 🎯 Hook personalizado para Drag & Drop - CMT v2.5
 * Sistema avanzado con gestión de estado, validaciones y feedback
 */

import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * 🚀 Hook principal para drag & drop
 */
export const useDragDrop = (options = {}) => {
  const {
    onDrop,
    onDragOver,
    onDragLeave,
    acceptedTypes = [],
    maxFiles = 10,
    maxFileSize = 10 * 1024 * 1024, // 10MB
    validateFile,
    disabled = false,
    multiple = true,
    autoProcess = true
  } = options;

  const [dragState, setDragState] = useState({
    isDragging: false,
    isOver: false,
    draggedItems: [],
    dropTarget: null,
    dragType: null
  });

  const [errors, setErrors] = useState([]);
  const dragCountRef = useRef(0);

  // Handlers para eventos de drag
  const handleDragEnter = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (disabled) return;

    dragCountRef.current++;
    
    if (dragCountRef.current === 1) {
      setDragState(prev => ({
        ...prev,
        isDragging: true,
        isOver: true
      }));
    }
  }, [disabled]);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    
    dragCountRef.current--;
    
    if (dragCountRef.current === 0) {
      setDragState(prev => ({
        ...prev,
        isDragging: false,
        isOver: false
      }));
      
      if (onDragLeave) onDragLeave(e);
    }
  }, [onDragLeave]);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (disabled) return;

    e.dataTransfer.dropEffect = 'copy';
    
    if (onDragOver) onDragOver(e);
  }, [disabled, onDragOver]);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    
    dragCountRef.current = 0;
    
    setDragState(prev => ({
      ...prev,
      isDragging: false,
      isOver: false
    }));
    
    if (disabled) return;

    const files = Array.from(e.dataTransfer.files);
    
    if (autoProcess) {
      processFiles(files);
    }
    
    if (onDrop) onDrop(files, e);
  }, [disabled, autoProcess, onDrop]);

  // Procesar archivos con validaciones
  const processFiles = useCallback((files) => {
    const validFiles = [];
    const fileErrors = [];

    // Validar número de archivos
    if (!multiple && files.length > 1) {
      fileErrors.push('Solo se permite un archivo a la vez');
      setErrors(fileErrors);
      return { validFiles: [], errors: fileErrors };
    }

    if (files.length > maxFiles) {
      fileErrors.push(`Máximo ${maxFiles} archivos permitidos`);
      setErrors(fileErrors);
      return { validFiles: [], errors: fileErrors };
    }

    // Validar cada archivo
    files.forEach((file, index) => {
      const fileError = validateSingleFile(file);
      if (fileError) {
        fileErrors.push(`${file.name}: ${fileError}`);
      } else {
        validFiles.push({
          id: `file_${Date.now()}_${index}`,
          file,
          name: file.name,
          size: file.size,
          type: file.type,
          lastModified: file.lastModified
        });
      }
    });

    setErrors(fileErrors);
    return { validFiles, errors: fileErrors };
  }, [multiple, maxFiles]);

  // Validar archivo individual
  const validateSingleFile = useCallback((file) => {
    // Validar tamaño
    if (file.size > maxFileSize) {
      return `Archivo demasiado grande (máx: ${formatFileSize(maxFileSize)})`;
    }

    // Validar tipo
    if (acceptedTypes.length > 0) {
      const isValidType = acceptedTypes.some(type => {
        if (type.startsWith('.')) {
          return file.name.toLowerCase().endsWith(type.toLowerCase());
        }
        return file.type === type || file.type.startsWith(type.split('/')[0] + '/');
      });

      if (!isValidType) {
        return `Tipo de archivo no soportado. Permitidos: ${acceptedTypes.join(', ')}`;
      }
    }

    // Validación personalizada
    if (validateFile) {
      const customError = validateFile(file);
      if (customError) return customError;
    }

    return null;
  }, [acceptedTypes, maxFileSize, validateFile]);

  // Limpiar errores
  const clearErrors = useCallback(() => {
    setErrors([]);
  }, []);

  // Reset estado
  const reset = useCallback(() => {
    setDragState({
      isDragging: false,
      isOver: false,
      draggedItems: [],
      dropTarget: null,
      dragType: null
    });
    setErrors([]);
    dragCountRef.current = 0;
  }, []);

  return {
    // Estado
    dragState,
    errors,
    hasErrors: errors.length > 0,
    
    // Handlers
    handleDragEnter,
    handleDragLeave,
    handleDragOver,
    handleDrop,
    
    // Utilidades
    processFiles,
    clearErrors,
    reset,
    
    // Props para el drop zone
    dropZoneProps: {
      onDragEnter: handleDragEnter,
      onDragLeave: handleDragLeave,
      onDragOver: handleDragOver,
      onDrop: handleDrop
    }
  };
};

/**
 * 🔄 Hook para elementos reordenables
 */
export const useReorderable = (initialItems = [], options = {}) => {
  const {
    onReorder,
    disabled = false,
    animationDuration = 200
  } = options;

  const [items, setItems] = useState(initialItems);
  const [draggedItem, setDraggedItem] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);

  // Actualizar items cuando cambie el prop inicial
  useEffect(() => {
    setItems(initialItems);
  }, [initialItems]);

  const handleDragStart = useCallback((e, item, index) => {
    if (disabled) return;
    
    setDraggedItem({ item, index });
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', JSON.stringify({ item, index }));
    
    // Agregar clase CSS para animación
    e.target.style.opacity = '0.5';
  }, [disabled]);

  const handleDragEnd = useCallback((e) => {
    e.target.style.opacity = '';
    setDraggedItem(null);
    setDragOverIndex(null);
  }, []);

  const handleDragOver = useCallback((e, index) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverIndex(index);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOverIndex(null);
  }, []);

  const handleDrop = useCallback((e, dropIndex) => {
    e.preventDefault();
    
    if (!draggedItem || draggedItem.index === dropIndex) {
      setDraggedItem(null);
      setDragOverIndex(null);
      return;
    }

    const newItems = [...items];
    const [removed] = newItems.splice(draggedItem.index, 1);
    newItems.splice(dropIndex, 0, removed);

    setItems(newItems);
    
    if (onReorder) {
      onReorder(newItems, draggedItem.item, dropIndex);
    }

    setDraggedItem(null);
    setDragOverIndex(null);
  }, [items, draggedItem, onReorder]);

  const moveItem = useCallback((fromIndex, toIndex) => {
    if (fromIndex === toIndex) return;
    
    const newItems = [...items];
    const [removed] = newItems.splice(fromIndex, 1);
    newItems.splice(toIndex, 0, removed);
    
    setItems(newItems);
    
    if (onReorder) {
      onReorder(newItems, removed, toIndex);
    }
  }, [items, onReorder]);

  const insertItem = useCallback((item, index = items.length) => {
    const newItems = [...items];
    newItems.splice(index, 0, item);
    setItems(newItems);
    
    if (onReorder) {
      onReorder(newItems, item, index);
    }
  }, [items, onReorder]);

  const removeItem = useCallback((index) => {
    const newItems = [...items];
    const [removed] = newItems.splice(index, 1);
    setItems(newItems);
    
    if (onReorder) {
      onReorder(newItems, removed, -1);
    }
  }, [items, onReorder]);

  return {
    // Estado
    items,
    draggedItem,
    dragOverIndex,
    
    // Handlers
    handleDragStart,
    handleDragEnd,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    
    // Utilidades
    moveItem,
    insertItem,
    removeItem,
    setItems
  };
};

/**
 * 📁 Hook para upload de archivos
 */
export const useFileUpload = (options = {}) => {
  const {
    onUpload,
    onProgress,
    onError,
    onComplete,
    autoUpload = true,
    chunkSize = 1024 * 1024, // 1MB chunks
    maxConcurrentUploads = 3
  } = options;

  const [uploadQueue, setUploadQueue] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [activeUploads, setActiveUploads] = useState(0);

  // Agregar archivos a la cola
  const addFiles = useCallback((files) => {
    const fileItems = files.map(file => ({
      id: `upload_${Date.now()}_${Math.random()}`,
      file,
      name: file.name,
      size: file.size,
      type: file.type,
      progress: 0,
      status: 'pending', // pending, uploading, completed, error
      error: null,
      startTime: null,
      endTime: null
    }));

    setUploadQueue(prev => [...prev, ...fileItems]);

    if (autoUpload) {
      processUploadQueue([...uploadQueue, ...fileItems]);
    }

    return fileItems;
  }, [uploadQueue, autoUpload]);

  // Procesar cola de upload
  const processUploadQueue = useCallback(async (queue = uploadQueue) => {
    if (isUploading || activeUploads >= maxConcurrentUploads) return;

    const pendingFiles = queue.filter(f => f.status === 'pending');
    if (pendingFiles.length === 0) return;

    setIsUploading(true);

    const filesToProcess = pendingFiles.slice(0, maxConcurrentUploads - activeUploads);
    
    for (const fileItem of filesToProcess) {
      uploadFile(fileItem);
    }
  }, [uploadQueue, isUploading, activeUploads, maxConcurrentUploads]);

  // Upload individual de archivo
  const uploadFile = useCallback(async (fileItem) => {
    setActiveUploads(prev => prev + 1);
    
    setUploadQueue(prev => prev.map(f => 
      f.id === fileItem.id 
        ? { ...f, status: 'uploading', startTime: Date.now() }
        : f
    ));

    try {
      if (onUpload) {
        await simulateUpload(fileItem);
      }

      setUploadQueue(prev => prev.map(f => 
        f.id === fileItem.id 
          ? { ...f, status: 'completed', progress: 100, endTime: Date.now() }
          : f
      ));

      if (onComplete) onComplete(fileItem);

    } catch (error) {
      setUploadQueue(prev => prev.map(f => 
        f.id === fileItem.id 
          ? { ...f, status: 'error', error: error.message }
          : f
      ));

      if (onError) onError(fileItem, error);
    } finally {
      setActiveUploads(prev => prev - 1);
    }
  }, [onUpload, onComplete, onError]);

  // Simular upload con progreso
  const simulateUpload = useCallback((fileItem) => {
    return new Promise((resolve, reject) => {
      let progress = 0;
      const increment = Math.random() * 10 + 5;
      
      const interval = setInterval(() => {
        progress += increment;
        
        setUploadQueue(prev => prev.map(f => 
          f.id === fileItem.id 
            ? { ...f, progress: Math.min(progress, 95) }
            : f
        ));

        if (onProgress) {
          onProgress(fileItem, Math.min(progress, 95));
        }

        if (progress >= 100) {
          clearInterval(interval);
          
          // Simular fallo ocasional
          if (Math.random() < 0.1) {
            reject(new Error('Error de red simulado'));
          } else {
            resolve();
          }
        }
      }, 100);
    });
  }, [onProgress]);

  // Reintentar upload fallido
  const retryUpload = useCallback((fileId) => {
    setUploadQueue(prev => prev.map(f => 
      f.id === fileId 
        ? { ...f, status: 'pending', progress: 0, error: null }
        : f
    ));

    processUploadQueue();
  }, [processUploadQueue]);

  // Cancelar upload
  const cancelUpload = useCallback((fileId) => {
    setUploadQueue(prev => prev.filter(f => f.id !== fileId));
  }, []);

  // Limpiar completados
  const clearCompleted = useCallback(() => {
    setUploadQueue(prev => prev.filter(f => f.status !== 'completed'));
  }, []);

  // Pausar/reanudar uploads
  const pauseUploads = useCallback(() => {
    setIsUploading(false);
  }, []);

  const resumeUploads = useCallback(() => {
    processUploadQueue();
  }, [processUploadQueue]);

  // Estadísticas
  const stats = {
    total: uploadQueue.length,
    pending: uploadQueue.filter(f => f.status === 'pending').length,
    uploading: uploadQueue.filter(f => f.status === 'uploading').length,
    completed: uploadQueue.filter(f => f.status === 'completed').length,
    errors: uploadQueue.filter(f => f.status === 'error').length,
    totalSize: uploadQueue.reduce((sum, f) => sum + f.size, 0),
    uploadedSize: uploadQueue
      .filter(f => f.status === 'completed')
      .reduce((sum, f) => sum + f.size, 0)
  };

  return {
    // Estado
    uploadQueue,
    isUploading,
    stats,
    
    // Acciones
    addFiles,
    retryUpload,
    cancelUpload,
    clearCompleted,
    pauseUploads,
    resumeUploads,
    
    // Utilidades
    processUploadQueue
  };
};

/**
 * 🎯 Hook para drop zones múltiples
 */
export const useMultiDropZones = (zones = {}) => {
  const [activeZone, setActiveZone] = useState(null);
  const [draggedData, setDraggedData] = useState(null);

  const registerZone = useCallback((zoneId, config) => {
    // Registrar nueva zona
    return {
      onDragEnter: (e) => {
        e.preventDefault();
        setActiveZone(zoneId);
        if (config.onDragEnter) config.onDragEnter(e);
      },
      onDragLeave: (e) => {
        e.preventDefault();
        setActiveZone(null);
        if (config.onDragLeave) config.onDragLeave(e);
      },
      onDragOver: (e) => {
        e.preventDefault();
        if (config.onDragOver) config.onDragOver(e);
      },
      onDrop: (e) => {
        e.preventDefault();
        setActiveZone(null);
        if (config.onDrop) config.onDrop(e, zoneId);
      }
    };
  }, []);

  return {
    activeZone,
    registerZone,
    setDraggedData,
    draggedData
  };
};

/**
 * 🔧 Funciones auxiliares
 */
const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export default useDragDrop;