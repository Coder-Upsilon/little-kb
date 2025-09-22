import React, { useState, useCallback } from 'react';
import {
  Box,
  Typography,
  Button,
  LinearProgress,
  Alert,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Chip,
  Paper,
} from '@mui/material';
import {
  CloudUpload as UploadIcon,
  InsertDriveFile as FileIcon,
  CheckCircle as SuccessIcon,
  Error as ErrorIcon,
} from '@mui/icons-material';
import { filesApi, Document } from '../services/api';

interface Props {
  knowledgeBaseId: string;
  onFileUploaded: (document: Document) => void;
  onError: (error: string) => void;
}

interface UploadFile {
  file: File;
  status: 'pending' | 'uploading' | 'success' | 'error';
  progress: number;
  error?: string;
  document?: Document;
}

const FileUpload: React.FC<Props> = ({ knowledgeBaseId, onFileUploaded, onError }) => {
  const [uploadFiles, setUploadFiles] = useState<UploadFile[]>([]);
  const [dragOver, setDragOver] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    
    const files = Array.from(e.dataTransfer.files);
    addFiles(files);
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      addFiles(files);
    }
  }, []);

  const addFiles = (files: File[]) => {
    const newUploadFiles: UploadFile[] = files.map(file => ({
      file,
      status: 'pending',
      progress: 0,
    }));
    
    setUploadFiles(prev => [...prev, ...newUploadFiles]);
  };

  const uploadFile = async (uploadFile: UploadFile, index: number) => {
    try {
      // Update status to uploading
      setUploadFiles(prev => prev.map((uf, i) => 
        i === index ? { ...uf, status: 'uploading', progress: 0 } : uf
      ));

      // Simulate progress updates (since we can't track real progress easily)
      const progressInterval = setInterval(() => {
        setUploadFiles(prev => prev.map((uf, i) => 
          i === index && uf.status === 'uploading' 
            ? { ...uf, progress: Math.min(uf.progress + 10, 90) } 
            : uf
        ));
      }, 200);

      // Upload the file
      const document = await filesApi.upload(knowledgeBaseId, uploadFile.file);

      // Clear progress interval
      clearInterval(progressInterval);

      // Update status to success
      setUploadFiles(prev => prev.map((uf, i) => 
        i === index ? { 
          ...uf, 
          status: 'success', 
          progress: 100, 
          document 
        } : uf
      ));

      // Notify parent component
      onFileUploaded(document);

    } catch (error: any) {
      // Update status to error
      setUploadFiles(prev => prev.map((uf, i) => 
        i === index ? { 
          ...uf, 
          status: 'error', 
          progress: 0,
          error: error.response?.data?.detail || error.message || 'Upload failed'
        } : uf
      ));

      onError(`Failed to upload ${uploadFile.file.name}: ${error.response?.data?.detail || error.message}`);
    }
  };

  const handleUploadAll = async () => {
    const pendingFiles = uploadFiles
      .map((uf, index) => ({ uploadFile: uf, index }))
      .filter(({ uploadFile }) => uploadFile.status === 'pending');

    // Upload files sequentially to avoid overwhelming the server
    for (const { uploadFile: fileToUpload, index } of pendingFiles) {
      await uploadFile(fileToUpload, index);
    }
  };

  const handleClearCompleted = () => {
    setUploadFiles(prev => prev.filter(uf => uf.status === 'pending' || uf.status === 'uploading'));
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <SuccessIcon color="success" />;
      case 'error':
        return <ErrorIcon color="error" />;
      default:
        return <FileIcon />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':
        return 'success';
      case 'error':
        return 'error';
      case 'uploading':
        return 'primary';
      default:
        return 'default';
    }
  };

  const pendingCount = uploadFiles.filter(uf => uf.status === 'pending').length;
  const uploadingCount = uploadFiles.filter(uf => uf.status === 'uploading').length;

  return (
    <Box>
      {/* Drop Zone */}
      <Paper
        sx={{
          border: '2px dashed',
          borderColor: dragOver ? 'primary.main' : 'grey.300',
          borderRadius: 2,
          p: 4,
          textAlign: 'center',
          bgcolor: dragOver ? 'action.hover' : 'background.paper',
          cursor: 'pointer',
          transition: 'all 0.2s ease-in-out',
          mb: 2,
        }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => document.getElementById('file-input')?.click()}
      >
        <UploadIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
        <Typography variant="h6" gutterBottom>
          Drop files here or click to browse
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Supports: PDF, DOCX, images, and text files (max 50MB each)
        </Typography>
        
        <input
          id="file-input"
          type="file"
          multiple
          accept=".pdf,.docx,.doc,.txt,.md,.py,.js,.html,.css,.json,.xml,.jpg,.jpeg,.png,.bmp,.tiff,.gif"
          style={{ display: 'none' }}
          onChange={handleFileSelect}
        />
      </Paper>

      {/* Upload Controls */}
      {uploadFiles.length > 0 && (
        <Box sx={{ mb: 2, display: 'flex', gap: 1 }}>
          <Button
            variant="contained"
            onClick={handleUploadAll}
            disabled={pendingCount === 0 || uploadingCount > 0}
            startIcon={<UploadIcon />}
          >
            Upload {pendingCount > 0 ? `${pendingCount} Files` : 'All'}
          </Button>
          <Button
            variant="outlined"
            onClick={handleClearCompleted}
            disabled={uploadFiles.filter(uf => uf.status === 'success' || uf.status === 'error').length === 0}
          >
            Clear Completed
          </Button>
        </Box>
      )}

      {/* File List */}
      {uploadFiles.length > 0 && (
        <List>
          {uploadFiles.map((uploadFile, index) => (
            <ListItem key={index} divider>
              <ListItemIcon>
                {getStatusIcon(uploadFile.status)}
              </ListItemIcon>
              <ListItemText
                primary={uploadFile.file.name}
                secondary={
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      {formatFileSize(uploadFile.file.size)}
                      {uploadFile.error && ` • ${uploadFile.error}`}
                    </Typography>
                    {uploadFile.status === 'uploading' && (
                      <LinearProgress 
                        variant="determinate" 
                        value={uploadFile.progress} 
                        sx={{ mt: 1 }}
                      />
                    )}
                  </Box>
                }
              />
              <Chip
                label={uploadFile.status.toUpperCase()}
                size="small"
                color={getStatusColor(uploadFile.status) as any}
                variant="outlined"
              />
            </ListItem>
          ))}
        </List>
      )}

      {/* Help Text */}
      <Alert severity="info" sx={{ mt: 2 }}>
        <Typography variant="body2">
          <strong>Supported formats:</strong>
        </Typography>
        <Typography variant="body2" component="div">
          • <strong>Text:</strong> .txt, .md, .py, .js, .html, .css, .json, .xml
        </Typography>
        <Typography variant="body2" component="div">
          • <strong>Documents:</strong> .pdf, .docx
        </Typography>
        <Typography variant="body2" component="div">
          • <strong>Images:</strong> .jpg, .jpeg, .png, .bmp, .tiff, .gif (OCR)
        </Typography>
      </Alert>
    </Box>
  );
};

export default FileUpload;
