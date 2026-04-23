/**
 * 🎯 Drag & Drop Interactions System - CMT v2.5
 * Sistema completo de interacciones drag & drop con feedback visual y gestión avanzada
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box,
  Paper,
  Typography,
  Card,
  CardContent,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  IconButton,
  Chip,
  Alert,
  Fade,
  Zoom,
  Grid,
  Button,
  LinearProgress,
  CircularProgress,
  Tooltip,
  Snackbar,
  useTheme,
  alpha,
  styled
} from '@mui/material';

import {
  DragIndicator as DragIcon,
  CloudUpload as UploadIcon,
  InsertDriveFile as FileIcon,
  Folder as FolderIcon,
  Image as ImageIcon,
  Description as DocumentIcon,
  Security as CertificateIcon,
  Delete as DeleteIcon,
  CheckCircle as CheckIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
  Reorder as ReorderIcon,
  ViewModule as GridViewIcon,
  ViewList as ListViewIcon
} from '@mui/icons-material';

/**
 * 🎯 Componente principal del sistema Drag & Drop
 */
export const DragDropSystem = ({ 
  onFileUpload,
  onItemReorder,
  onItemMove,
  acceptedFileTypes = [],
  maxFileSize = 10 * 1024 * 1024, // 10MB
  maxFiles = 10,
  enableReordering = true,
  enableFileUpload = true,
  disabled = false
}) => {
  const theme = useTheme();
  const [dragState, setDragState] = useState({
    isDragging: false,
    draggedItem: null,
    dropZone: null,
    dragType: null
  });
  const [uploadQueue, setUploadQueue] = useState([]);
  const [notifications, setNotifications] = useState([]);

  return (
    <DragDropProvider value={{ dragState, setDragState }}>
      <Box sx={{ position: 'relative' }}>
        {/* File Upload Drop Zone */}
        {enableFileUpload && (
          <FileUploadDropZone
            onFileUpload={onFileUpload}
            acceptedFileTypes={acceptedFileTypes}
            maxFileSize={maxFileSize}
            maxFiles={maxFiles}
            disabled={disabled}
            uploadQueue={uploadQueue}
            setUploadQueue={setUploadQueue}
            onNotification={addNotification}
          />
        )}

        {/* Reorderable List Example */}
        {enableReordering && (
          <ReorderableList
            onItemReorder={onItemReorder}
            disabled={disabled}
          />
        )}

        {/* File Organization System */}
        <FileOrganizationSystem
          onItemMove={onItemMove}
          disabled={disabled}
        />

        {/* Upload Progress Panel */}
        <UploadProgressPanel
          uploadQueue={uploadQueue}
          setUploadQueue={setUploadQueue}
        />

        {/* Drag Overlay */}
        <DragOverlay dragState={dragState} />

        {/* Notifications */}
        <NotificationSystem
          notifications={notifications}
          onClose={removeNotification}
        />
      </Box>
    </DragDropProvider>
  );

  function addNotification(notification) {
    setNotifications(prev => [...prev, { ...notification, id: Date.now() }]);
  }

  function removeNotification(notificationId) {
    setNotifications(prev => prev.filter(n => n.id !== notificationId));
  }
};

/**
 * 📁 Zona de subida de archivos con drag & drop
 */
const FileUploadDropZone = ({
  onFileUpload,
  acceptedFileTypes,
  maxFileSize,
  maxFiles,
  disabled,
  uploadQueue,
  setUploadQueue,
  onNotification
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const dropZoneRef = useRef(null);
  const fileInputRef = useRef(null);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) {
      setIsDragOver(true);
    }
  }, [disabled]);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!dropZoneRef.current?.contains(e.relatedTarget)) {
      setIsDragOver(false);
    }
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    
    if (disabled) return;

    const files = Array.from(e.dataTransfer.files);
    processFiles(files);
  }, [disabled]);

  const handleFileSelect = useCallback((e) => {
    const files = Array.from(e.target.files);
    processFiles(files);
    e.target.value = ''; // Reset input
  }, []);

  const processFiles = useCallback((files) => {
    if (files.length > maxFiles) {
      onNotification({
        type: 'error',
        message: `Máximo ${maxFiles} archivos permitidos. Se seleccionaron ${files.length}.`
      });
      return;
    }

    const validFiles = [];
    const errors = [];

    files.forEach(file => {
      // Validar tipo de archivo
      if (acceptedFileTypes.length > 0 && !acceptedFileTypes.includes(file.type)) {
        errors.push(`${file.name}: Tipo de archivo no soportado`);
        return;
      }

      // Validar tamaño
      if (file.size > maxFileSize) {
        errors.push(`${file.name}: Archivo demasiado grande (máx: ${formatFileSize(maxFileSize)})`);
        return;
      }

      validFiles.push({
        id: `file_${Date.now()}_${Math.random()}`,
        file,
        name: file.name,
        size: file.size,
        type: file.type,
        progress: 0,
        status: 'pending',
        uploadedAt: null
      });
    });

    if (errors.length > 0) {
      onNotification({
        type: 'warning',
        message: `Algunos archivos no pudieron procesarse:\n${errors.join('\n')}`
      });
    }

    if (validFiles.length > 0) {
      setUploadQueue(prev => [...prev, ...validFiles]);
      uploadFiles(validFiles);
    }
  }, [acceptedFileTypes, maxFileSize, maxFiles, onNotification, setUploadQueue]);

  const uploadFiles = async (files) => {
    setIsUploading(true);

    for (const fileData of files) {
      try {
        await simulateFileUpload(fileData);
        
        setUploadQueue(prev => prev.map(f => 
          f.id === fileData.id 
            ? { ...f, status: 'completed', progress: 100, uploadedAt: new Date() }
            : f
        ));

        if (onFileUpload) {
          onFileUpload(fileData);
        }

        onNotification({
          type: 'success',
          message: `${fileData.name} subido exitosamente`
        });

      } catch (error) {
        setUploadQueue(prev => prev.map(f => 
          f.id === fileData.id 
            ? { ...f, status: 'error', progress: 0 }
            : f
        ));

        onNotification({
          type: 'error',
          message: `Error subiendo ${fileData.name}: ${error.message}`
        });
      }
    }

    setIsUploading(false);
  };

  const simulateFileUpload = (fileData) => {
    return new Promise((resolve, reject) => {
      let progress = 0;
      const interval = setInterval(() => {
        progress += Math.random() * 15;
        
        setUploadQueue(prev => prev.map(f => 
          f.id === fileData.id 
            ? { ...f, progress: Math.min(progress, 95) }
            : f
        ));

        if (progress >= 100) {
          clearInterval(interval);
          // Simular fallo ocasional
          if (Math.random() < 0.1) {
            reject(new Error('Error de red simulado'));
          } else {
            resolve();
          }
        }
      }, 200);
    });
  };

  useEffect(() => {
    const dropZone = dropZoneRef.current;
    if (!dropZone) return;

    dropZone.addEventListener('dragover', handleDragOver);
    dropZone.addEventListener('dragleave', handleDragLeave);
    dropZone.addEventListener('drop', handleDrop);

    return () => {
      dropZone.removeEventListener('dragover', handleDragOver);
      dropZone.removeEventListener('dragleave', handleDragLeave);
      dropZone.removeEventListener('drop', handleDrop);
    };
  }, [handleDragOver, handleDragLeave, handleDrop]);

  return (
    <StyledDropZone
      ref={dropZoneRef}
      isDragOver={isDragOver}
      disabled={disabled}
      onClick={() => !disabled && fileInputRef.current?.click()}
    >
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={acceptedFileTypes.join(',')}
        onChange={handleFileSelect}
        style={{ display: 'none' }}
      />

      <Box textAlign="center" p={3}>
        {isUploading ? (
          <CircularProgress size={48} color="primary" />
        ) : (
          <UploadIcon sx={{ fontSize: 48, color: 'primary.main', mb: 2 }} />
        )}

        <Typography variant="h6" gutterBottom>
          {isDragOver 
            ? '¡Suelta los archivos aquí!' 
            : 'Arrastra archivos aquí o haz clic para seleccionar'
          }
        </Typography>

        <Typography variant="body2" color="text.secondary" paragraph>
          {acceptedFileTypes.length > 0 && (
            <>Tipos soportados: {acceptedFileTypes.join(', ')}<br /></>
          )}
          Tamaño máximo: {formatFileSize(maxFileSize)} | 
          Máximo {maxFiles} archivos
        </Typography>

        {uploadQueue.filter(f => f.status === 'pending').length > 0 && (
          <Alert severity="info" sx={{ mt: 2 }}>
            {uploadQueue.filter(f => f.status === 'pending').length} archivos en cola
          </Alert>
        )}
      </Box>
    </StyledDropZone>
  );
};

/**
 * 📋 Lista reordenable con drag & drop
 */
const ReorderableList = ({ onItemReorder, disabled }) => {
  const [items, setItems] = useState([
    { id: '1', label: 'Certificado SSL Servidor Web', type: 'certificate', priority: 'high' },
    { id: '2', label: 'Certificado Cliente VPN', type: 'certificate', priority: 'medium' },
    { id: '3', label: 'Certificado API Gateway', type: 'certificate', priority: 'high' },
    { id: '4', label: 'Certificado Base de Datos', type: 'certificate', priority: 'low' },
    { id: '5', label: 'Certificado Microservicio', type: 'certificate', priority: 'medium' }
  ]);

  const [draggedItem, setDraggedItem] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);

  const handleDragStart = (e, item, index) => {
    if (disabled) return;
    
    setDraggedItem({ item, index });
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', item.id);
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverIndex(index);
  };

  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  const handleDrop = (e, dropIndex) => {
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
    
    if (onItemReorder) {
      onItemReorder(newItems, draggedItem.item, dropIndex);
    }

    setDraggedItem(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
    setDragOverIndex(null);
  };

  return (
    <Card sx={{ mb: 3 }}>
      <CardContent>
        <Box display="flex" alignItems="center" gap={1} mb={2}>
          <ReorderIcon color="primary" />
          <Typography variant="h6">Lista Reordenable</Typography>
          <Chip label="Arrastra para reordenar" size="small" variant="outlined" />
        </Box>

        <List>
          {items.map((item, index) => (
            <DraggableListItem
              key={item.id}
              item={item}
              index={index}
              isDragged={draggedItem?.item.id === item.id}
              isDropTarget={dragOverIndex === index}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onDragEnd={handleDragEnd}
              disabled={disabled}
            />
          ))}
        </List>
      </CardContent>
    </Card>
  );
};

/**
 * 📄 Item de lista arrastrable
 */
const DraggableListItem = ({
  item,
  index,
  isDragged,
  isDropTarget,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragEnd,
  disabled
}) => {
  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'high': return 'error';
      case 'medium': return 'warning';
      case 'low': return 'success';
      default: return 'default';
    }
  };

  return (
    <StyledListItem
      draggable={!disabled}
      isDragged={isDragged}
      isDropTarget={isDropTarget}
      onDragStart={(e) => onDragStart(e, item, index)}
      onDragOver={(e) => onDragOver(e, index)}
      onDragLeave={onDragLeave}
      onDrop={(e) => onDrop(e, index)}
      onDragEnd={onDragEnd}
    >
      <ListItemIcon>
        <DragIcon color={disabled ? 'disabled' : 'action'} />
      </ListItemIcon>

      <ListItemIcon>
        <CertificateIcon color="primary" />
      </ListItemIcon>

      <ListItemText
        primary={item.label}
        secondary={`Tipo: ${item.type}`}
      />

      <Chip
        label={item.priority}
        size="small"
        color={getPriorityColor(item.priority)}
        variant="outlined"
      />
    </StyledListItem>
  );
};

/**
 * 🗂️ Sistema de organización de archivos
 */
const FileOrganizationSystem = ({ onItemMove, disabled }) => {
  const [folders] = useState([
    { id: 'certificates', name: 'Certificados', icon: CertificateIcon, items: [] },
    { id: 'documents', name: 'Documentos', icon: DocumentIcon, items: [] },
    { id: 'images', name: 'Imágenes', icon: ImageIcon, items: [] },
    { id: 'archive', name: 'Archivo', icon: FolderIcon, items: [] }
  ]);

  const [draggedFile, setDraggedFile] = useState(null);
  const [dropTarget, setDropTarget] = useState(null);

  const sampleFiles = [
    { id: 'f1', name: 'server.crt', type: 'certificate', size: '2.1 KB' },
    { id: 'f2', name: 'client.key', type: 'certificate', size: '1.8 KB' },
    { id: 'f3', name: 'documentation.pdf', type: 'document', size: '245 KB' },
    { id: 'f4', name: 'logo.png', type: 'image', size: '89 KB' }
  ];

  const handleFileDragStart = (e, file) => {
    if (disabled) return;
    setDraggedFile(file);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleFolderDragOver = (e, folderId) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDropTarget(folderId);
  };

  const handleFolderDragLeave = () => {
    setDropTarget(null);
  };

  const handleFolderDrop = (e, folderId) => {
    e.preventDefault();
    
    if (draggedFile && onItemMove) {
      onItemMove(draggedFile, folderId);
    }

    setDraggedFile(null);
    setDropTarget(null);
  };

  return (
    <Card sx={{ mb: 3 }}>
      <CardContent>
        <Box display="flex" alignItems="center" gap={1} mb={2}>
          <FolderIcon color="primary" />
          <Typography variant="h6">Organización de Archivos</Typography>
        </Box>

        <Grid container spacing={2}>
          {/* Files Panel */}
          <Grid item xs={12} md={6}>
            <Typography variant="subtitle1" gutterBottom>
              Archivos
            </Typography>
            <Box>
              {sampleFiles.map(file => (
                <StyledFileItem
                  key={file.id}
                  draggable={!disabled}
                  isDragged={draggedFile?.id === file.id}
                  onDragStart={(e) => handleFileDragStart(e, file)}
                  onDragEnd={() => setDraggedFile(null)}
                >
                  <Box display="flex" alignItems="center" gap={1} p={1}>
                    <FileIcon fontSize="small" />
                    <Box flex={1}>
                      <Typography variant="body2">{file.name}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {file.size}
                      </Typography>
                    </Box>
                    <DragIcon fontSize="small" color="action" />
                  </Box>
                </StyledFileItem>
              ))}
            </Box>
          </Grid>

          {/* Folders Panel */}
          <Grid item xs={12} md={6}>
            <Typography variant="subtitle1" gutterBottom>
              Carpetas de Destino
            </Typography>
            <Box>
              {folders.map(folder => (
                <StyledFolderItem
                  key={folder.id}
                  isDropTarget={dropTarget === folder.id}
                  onDragOver={(e) => handleFolderDragOver(e, folder.id)}
                  onDragLeave={handleFolderDragLeave}
                  onDrop={(e) => handleFolderDrop(e, folder.id)}
                >
                  <Box display="flex" alignItems="center" gap={1} p={2}>
                    <folder.icon color="primary" />
                    <Typography variant="body1">{folder.name}</Typography>
                  </Box>
                </StyledFolderItem>
              ))}
            </Box>
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  );
};

/**
 * 📊 Panel de progreso de subidas
 */
const UploadProgressPanel = ({ uploadQueue, setUploadQueue }) => {
  const completedUploads = uploadQueue.filter(f => f.status === 'completed');
  const errorUploads = uploadQueue.filter(f => f.status === 'error');
  const pendingUploads = uploadQueue.filter(f => f.status === 'pending');

  const clearCompleted = () => {
    setUploadQueue(prev => prev.filter(f => f.status !== 'completed'));
  };

  const retryFailed = () => {
    setUploadQueue(prev => prev.map(f => 
      f.status === 'error' ? { ...f, status: 'pending', progress: 0 } : f
    ));
  };

  if (uploadQueue.length === 0) return null;

  return (
    <Card sx={{ mb: 3 }}>
      <CardContent>
        <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
          <Box display="flex" alignItems="center" gap={1}>
            <UploadIcon color="primary" />
            <Typography variant="h6">Estado de Subidas</Typography>
          </Box>
          
          <Box display="flex" gap={1}>
            {completedUploads.length > 0 && (
              <Button size="small" onClick={clearCompleted}>
                Limpiar Completados
              </Button>
            )}
            {errorUploads.length > 0 && (
              <Button size="small" color="error" onClick={retryFailed}>
                Reintentar Fallidos
              </Button>
            )}
          </Box>
        </Box>

        <Box display="flex" gap={2} mb={2}>
          <Chip 
            icon={<CheckIcon />} 
            label={`${completedUploads.length} Completados`} 
            color="success" 
            variant="outlined" 
          />
          <Chip 
            icon={<ErrorIcon />} 
            label={`${errorUploads.length} Errores`} 
            color="error" 
            variant="outlined" 
          />
          <Chip 
            icon={<InfoIcon />} 
            label={`${pendingUploads.length} Pendientes`} 
            color="info" 
            variant="outlined" 
          />
        </Box>

        <List dense>
          {uploadQueue.map(fileData => (
            <ListItem key={fileData.id}>
              <ListItemIcon>
                {fileData.status === 'completed' && <CheckIcon color="success" />}
                {fileData.status === 'error' && <ErrorIcon color="error" />}
                {fileData.status === 'pending' && <CircularProgress size={20} />}
              </ListItemIcon>
              
              <ListItemText
                primary={fileData.name}
                secondary={
                  <Box>
                    <Typography variant="caption">
                      {formatFileSize(fileData.size)} • {fileData.status}
                    </Typography>
                    {fileData.status === 'pending' && (
                      <LinearProgress 
                        variant="determinate" 
                        value={fileData.progress} 
                        sx={{ mt: 0.5 }}
                      />
                    )}
                  </Box>
                }
              />

              {fileData.status === 'error' && (
                <IconButton size="small" color="error">
                  <DeleteIcon />
                </IconButton>
              )}
            </ListItem>
          ))}
        </List>
      </CardContent>
    </Card>
  );
};

/**
 * 🎭 Overlay de arrastre
 */
const DragOverlay = ({ dragState }) => {
  if (!dragState.isDragging) return null;

  return (
    <Box
      sx={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: alpha('#1976d2', 0.1),
        backdropFilter: 'blur(2px)',
        zIndex: 9999,
        pointerEvents: 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}
    >
      <Paper
        elevation={8}
        sx={{
          p: 3,
          textAlign: 'center',
          backgroundColor: 'primary.main',
          color: 'primary.contrastText'
        }}
      >
        <Typography variant="h5" gutterBottom>
          🎯 Soltando...
        </Typography>
        <Typography variant="body1">
          Suelta aquí para {dragState.dragType === 'file' ? 'subir archivo' : 'mover elemento'}
        </Typography>
      </Paper>
    </Box>
  );
};

/**
 * 🔔 Sistema de notificaciones
 */
const NotificationSystem = ({ notifications, onClose }) => {
  return (
    <>
      {notifications.map(notification => (
        <Snackbar
          key={notification.id}
          open={true}
          autoHideDuration={4000}
          onClose={() => onClose(notification.id)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        >
          <Alert 
            severity={notification.type} 
            onClose={() => onClose(notification.id)}
            sx={{ minWidth: 300 }}
          >
            {notification.message}
          </Alert>
        </Snackbar>
      ))}
    </>
  );
};

/**
 * 🎨 Componentes estilizados
 */
const StyledDropZone = styled(Paper)(({ theme, isDragOver, disabled }) => ({
  border: `2px dashed ${isDragOver ? theme.palette.primary.main : theme.palette.divider}`,
  borderRadius: theme.spacing(2),
  backgroundColor: isDragOver 
    ? alpha(theme.palette.primary.main, 0.1)
    : alpha(theme.palette.background.paper, 0.8),
  cursor: disabled ? 'not-allowed' : 'pointer',
  transition: 'all 0.2s ease-in-out',
  opacity: disabled ? 0.6 : 1,
  '&:hover': {
    borderColor: disabled ? theme.palette.divider : theme.palette.primary.light,
    backgroundColor: disabled 
      ? alpha(theme.palette.background.paper, 0.8)
      : alpha(theme.palette.primary.main, 0.05)
  }
}));

const StyledListItem = styled(ListItem)(({ theme, isDragged, isDropTarget }) => ({
  backgroundColor: isDragged 
    ? alpha(theme.palette.primary.main, 0.1)
    : isDropTarget 
      ? alpha(theme.palette.success.main, 0.1)
      : 'transparent',
  border: isDropTarget ? `2px dashed ${theme.palette.success.main}` : 'none',
  borderRadius: theme.spacing(1),
  margin: theme.spacing(0.5, 0),
  cursor: 'grab',
  transition: 'all 0.2s ease-in-out',
  '&:hover': {
    backgroundColor: alpha(theme.palette.action.hover, 0.1)
  },
  '&:active': {
    cursor: 'grabbing'
  }
}));

const StyledFileItem = styled(Paper)(({ theme, isDragged }) => ({
  marginBottom: theme.spacing(1),
  cursor: 'grab',
  opacity: isDragged ? 0.5 : 1,
  transform: isDragged ? 'rotate(5deg)' : 'none',
  transition: 'all 0.2s ease-in-out',
  '&:hover': {
    boxShadow: theme.shadows[4]
  },
  '&:active': {
    cursor: 'grabbing'
  }
}));

const StyledFolderItem = styled(Paper)(({ theme, isDropTarget }) => ({
  marginBottom: theme.spacing(1),
  backgroundColor: isDropTarget 
    ? alpha(theme.palette.primary.main, 0.1)
    : theme.palette.background.paper,
  border: isDropTarget ? `2px dashed ${theme.palette.primary.main}` : 'none',
  transition: 'all 0.2s ease-in-out',
  '&:hover': {
    backgroundColor: alpha(theme.palette.action.hover, 0.05)
  }
}));

/**
 * 🚀 Context Provider
 */
const DragDropContext = React.createContext();

const DragDropProvider = ({ children, value }) => (
  <DragDropContext.Provider value={value}>
    {children}
  </DragDropContext.Provider>
);

export { DragDropProvider };

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

export default DragDropSystem;