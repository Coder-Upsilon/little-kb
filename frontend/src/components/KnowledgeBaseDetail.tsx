import React, { useState, useEffect } from 'react';
import {
  Container,
  Box,
  Typography,
  Grid,
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
  LinearProgress,
} from '@mui/material';
import {
  Upload as UploadIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
  InsertDriveFile as FileIcon,
  Search as SearchIcon,
} from '@mui/icons-material';
import { filesApi, knowledgeBaseApi, KnowledgeBase, Document } from '../services/api';
import FileUpload from './FileUpload';

interface Props {
  knowledgeBase: KnowledgeBase;
  onBack: () => void;
  onKBUpdated: (kb: KnowledgeBase) => void;
}

const KnowledgeBaseDetail: React.FC<Props> = ({ knowledgeBase, onBack, onKBUpdated }) => {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [reindexing, setReindexing] = useState(false);
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    loadDocuments();
    loadStats();
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

  const loadStats = async () => {
    try {
      const kbStats = await knowledgeBaseApi.getStats(knowledgeBase.id);
      setStats(kbStats);
    } catch (err) {
      console.error('Error loading stats:', err);
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
      
      // Reload stats
      loadStats();
      setError(null);
    } catch (err) {
      setError('Failed to delete document');
      console.error('Error deleting document:', err);
    }
  };

  const handleReindex = async () => {
    try {
      setReindexing(true);
      await knowledgeBaseApi.reindex(knowledgeBase.id);
      loadStats();
      setError(null);
    } catch (err) {
      setError('Failed to reindex knowledge base');
      console.error('Error reindexing:', err);
    } finally {
      setReindexing(false);
    }
  };

  const handleFileUploaded = (newDoc: Document) => {
    setDocuments([newDoc, ...documents]);
    
    // Update knowledge base file count
    const updatedKB = { ...knowledgeBase, file_count: knowledgeBase.file_count + 1 };
    onKBUpdated(updatedKB);
    
    // Reload stats
    loadStats();
    setUploadDialogOpen(false);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const getFileTypeColor = (fileType: string) => {
    switch (fileType) {
      case 'pdf': return 'error';
      case 'docx': return 'primary';
      case 'image': return 'success';
      case 'text': return 'default';
      default: return 'default';
    }
  };

  return (
    <Container maxWidth="lg">
      <Box sx={{ mt: 4, mb: 4 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Typography variant="h4" component="h1">
            {knowledgeBase.name}
          </Typography>
          <Box>
            <Button
              variant="outlined"
              startIcon={<UploadIcon />}
              onClick={() => setUploadDialogOpen(true)}
              sx={{ mr: 1 }}
            >
              Upload Files
            </Button>
            <Button
              variant="outlined"
              startIcon={<RefreshIcon />}
              onClick={handleReindex}
              disabled={reindexing}
              sx={{ mr: 1 }}
            >
              {reindexing ? <CircularProgress size={20} /> : 'Reindex'}
            </Button>
          </Box>
        </Box>

        {knowledgeBase.description && (
          <Typography variant="body1" color="text.secondary" paragraph>
            {knowledgeBase.description}
          </Typography>
        )}

        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* Statistics */}
        {stats && (
          <Box 
            display="grid" 
            gridTemplateColumns="repeat(auto-fit, minmax(200px, 1fr))" 
            gap={3} 
            sx={{ mb: 3 }}
          >
            <Card>
              <CardContent>
                <Typography color="text.secondary" gutterBottom>
                  Total Files
                </Typography>
                <Typography variant="h4">
                  {stats.file_count || 0}
                </Typography>
              </CardContent>
            </Card>
            <Card>
              <CardContent>
                <Typography color="text.secondary" gutterBottom>
                  Total Chunks
                </Typography>
                <Typography variant="h4">
                  {stats.total_chunks || 0}
                </Typography>
              </CardContent>
            </Card>
            <Card>
              <CardContent>
                <Typography color="text.secondary" gutterBottom>
                  Total Size
                </Typography>
                <Typography variant="h4">
                  {formatFileSize(stats.total_size || 0)}
                </Typography>
              </CardContent>
            </Card>
            <Card>
              <CardContent>
                <Typography color="text.secondary" gutterBottom>
                  Vector Chunks
                </Typography>
                <Typography variant="h4">
                  {stats.vector_chunks || 0}
                </Typography>
              </CardContent>
            </Card>
          </Box>
        )}

        {/* Documents List */}
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Documents ({documents.length})
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
                <Typography variant="body2" color="text.secondary">
                  Upload your first document to get started
                </Typography>
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
  );
};

export default KnowledgeBaseDetail;
