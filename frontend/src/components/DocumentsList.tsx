import React, { useState, useEffect } from 'react';
import {
  Container,
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Chip,
  Alert,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Drawer,
  ListItemButton,
  ListItemIcon,
} from '@mui/material';
import {
  Upload as UploadIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
  InsertDriveFile as FileIcon,
  ArrowBack as ArrowBackIcon,
  Folder as FolderIcon,
  FolderOpen as FolderOpenIcon,
} from '@mui/icons-material';
import { filesApi, KnowledgeBase, Document } from '../services/api';
import FileUpload from './FileUpload';

interface Props {
  knowledgeBase: KnowledgeBase;
  allKnowledgeBases: KnowledgeBase[];
  onBack: () => void;
  onKBUpdated: (kb: KnowledgeBase) => void;
  onKBSelected: (kb: KnowledgeBase) => void;
}

const DocumentsList: React.FC<Props> = ({ 
  knowledgeBase, 
  allKnowledgeBases, 
  onBack, 
  onKBUpdated, 
  onKBSelected 
}) => {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);

  useEffect(() => {
    loadDocuments();
  }, [knowledgeBase.id]);

  const loadDocuments = async () => {
    try {
      setLoading(true);
      const docs = await filesApi.list(knowledgeBase.id);
      setDocuments(docs);
      setError(null);
    } catch (err) {
      setError('Failed to load documents');
      console.error('Error loading documents:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteDocument = async (doc: Document) => {
    if (!window.confirm(`Are you sure you want to delete "${doc.filename}"?`)) {
      return;
    }

    try {
      await filesApi.delete(doc.id);
      setDocuments(documents.filter(d => d.id !== doc.id));
      
      // Update knowledge base file count
      const updatedKB = { ...knowledgeBase, file_count: knowledgeBase.file_count - 1 };
      onKBUpdated(updatedKB);
      
      setError(null);
    } catch (err) {
      setError('Failed to delete document');
      console.error('Error deleting document:', err);
    }
  };

  const handleFileUploaded = (newDoc: Document) => {
    setDocuments([newDoc, ...documents]);
    
    // Update knowledge base file count
    const updatedKB = { ...knowledgeBase, file_count: knowledgeBase.file_count + 1 };
    onKBUpdated(updatedKB);
    
    setUploadDialogOpen(false);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileTypeColor = (fileType: string) => {
    switch (fileType) {
      case 'pdf': return 'error';
      case 'docx': return 'primary';
      case 'epub': return 'secondary';
      case 'image': return 'success';
      case 'text': return 'default';
      default: return 'default';
    }
  };

  const drawerWidth = 280;

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const renderKnowledgeBaseSidebar = () => (
    <Box>
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Typography variant="h6" color="primary">
          Knowledge Bases
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {allKnowledgeBases.length} total
        </Typography>
      </Box>
      
      <List sx={{ pt: 0 }}>
        {allKnowledgeBases.map((kb) => (
          <ListItemButton
            key={kb.id}
            selected={kb.id === knowledgeBase.id}
            onClick={() => onKBSelected(kb)}
            sx={{
              py: 1.5,
              px: 2,
              '&.Mui-selected': {
                backgroundColor: 'primary.main',
                color: 'primary.contrastText',
                '&:hover': {
                  backgroundColor: 'primary.dark',
                },
                '& .MuiListItemIcon-root': {
                  color: 'primary.contrastText',
                },
                '& .MuiChip-root': {
                  backgroundColor: 'primary.contrastText',
                  color: 'primary.main',
                },
              },
            }}
          >
            <ListItemIcon sx={{ minWidth: 40 }}>
              {kb.id === knowledgeBase.id ? <FolderOpenIcon /> : <FolderIcon />}
            </ListItemIcon>
            
            <ListItemText
              primary={
                <Typography variant="body2" noWrap>
                  {kb.name}
                </Typography>
              }
              secondary={
                <Box sx={{ mt: 0.5 }}>
                  <Chip
                    label={`${kb.file_count} files`}
                    size="small"
                    variant="outlined"
                    sx={{ 
                      fontSize: '0.7rem', 
                      height: 20,
                      '& .MuiChip-label': { px: 1 }
                    }}
                  />
                  {kb.description && (
                    <Typography 
                      variant="caption" 
                      display="block" 
                      sx={{ mt: 0.5, opacity: 0.8 }}
                      noWrap
                    >
                      {kb.description}
                    </Typography>
                  )}
                </Box>
              }
            />
          </ListItemButton>
        ))}
      </List>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex' }}>
      {/* Sidebar */}
      <Drawer
        variant="permanent"
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: drawerWidth,
            boxSizing: 'border-box',
            position: 'relative',
            height: 'calc(100vh - 64px)', // Account for AppBar height
            top: 0,
          },
        }}
      >
        {renderKnowledgeBaseSidebar()}
      </Drawer>

      {/* Main content */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          width: `calc(100% - ${drawerWidth}px)`,
        }}
      >
        <Container maxWidth="lg">
          <Box sx={{ mt: 4, mb: 4 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Box display="flex" alignItems="center">
            <IconButton onClick={onBack} sx={{ mr: 1 }}>
              <ArrowBackIcon />
            </IconButton>
            <Typography variant="h4" component="h1">
              Documents - {knowledgeBase.name}
            </Typography>
          </Box>
          <Box>
            <Button
              variant="contained"
              startIcon={<UploadIcon />}
              onClick={() => setUploadDialogOpen(true)}
              sx={{ mr: 1 }}
            >
              Upload Files
            </Button>
            <Button
              variant="outlined"
              startIcon={<RefreshIcon />}
              onClick={loadDocuments}
            >
              Refresh
            </Button>
          </Box>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* Documents List */}
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              All Documents ({documents.length})
            </Typography>
            
            {loading ? (
              <Box display="flex" justifyContent="center" mt={2}>
                <CircularProgress />
              </Box>
            ) : documents.length === 0 ? (
              <Box textAlign="center" py={4}>
                <Typography variant="body1" color="text.secondary" gutterBottom>
                  No documents uploaded yet
                </Typography>
                <Typography variant="body2" color="text.secondary" mb={3}>
                  Upload your first document to get started
                </Typography>
                <Button
                  variant="contained"
                  startIcon={<UploadIcon />}
                  onClick={() => setUploadDialogOpen(true)}
                >
                  Upload Files
                </Button>
              </Box>
            ) : (
              <List>
                {documents.map((doc) => (
                  <ListItem key={doc.id} divider>
                    <FileIcon sx={{ mr: 2, color: 'text.secondary' }} />
                    <ListItemText
                      primary={doc.filename}
                      secondary={
                        <Box>
                          <Typography variant="body2" color="text.secondary">
                            {formatFileSize(doc.file_size)} • {doc.chunk_count} chunks • 
                            Processed {formatDate(doc.processed_date)}
                          </Typography>
                        </Box>
                      }
                    />
                    <Box sx={{ mr: 2 }}>
                      <Chip
                        label={doc.file_type.toUpperCase()}
                        size="small"
                        color={getFileTypeColor(doc.file_type) as any}
                        variant="outlined"
                      />
                    </Box>
                    <ListItemSecondaryAction>
                      <IconButton
                        edge="end"
                        onClick={() => handleDeleteDocument(doc)}
                        color="error"
                      >
                        <DeleteIcon />
                      </IconButton>
                    </ListItemSecondaryAction>
                  </ListItem>
                ))}
              </List>
            )}
          </CardContent>
        </Card>

        {/* Upload Dialog */}
        <Dialog 
          open={uploadDialogOpen} 
          onClose={() => setUploadDialogOpen(false)}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle>Upload Files to {knowledgeBase.name}</DialogTitle>
          <DialogContent>
            <FileUpload
              knowledgeBaseId={knowledgeBase.id}
              onFileUploaded={handleFileUploaded}
              onError={(error) => setError(error)}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setUploadDialogOpen(false)}>
              Close
            </Button>
          </DialogActions>
        </Dialog>
          </Box>
        </Container>
      </Box>
    </Box>
  );
};

export default DocumentsList;
