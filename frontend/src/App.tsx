import React, { useState, useEffect } from 'react';
import {
  AppBar,
  Toolbar,
  Typography,
  Container,
  Box,
  Card,
  CardContent,
  CardActions,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Fab,
  IconButton,
  Chip,
  Alert,
  CircularProgress,
} from '@mui/material';
import {
  Add as AddIcon,
  Folder as FolderIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
  Settings as SettingsIcon,
} from '@mui/icons-material';
import { knowledgeBaseApi, KnowledgeBase } from './services/api';
import KnowledgeBaseDetail from './components/KnowledgeBaseDetail';
import DocumentsList from './components/DocumentsList';
import MCPServerManager from './components/MCPServerManager';

function App() {
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([]);
  const [selectedKB, setSelectedKB] = useState<KnowledgeBase | null>(null);
  const [currentView, setCurrentView] = useState<'list' | 'detail' | 'documents' | 'mcp'>('list');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Dialog states
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newKBName, setNewKBName] = useState('');
  const [newKBDescription, setNewKBDescription] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    loadKnowledgeBases();
  }, []);

  const loadKnowledgeBases = async () => {
    try {
      setLoading(true);
      const kbs = await knowledgeBaseApi.list();
      setKnowledgeBases(kbs);
      setError(null);
    } catch (err) {
      setError('Failed to load knowledge bases');
      console.error('Error loading knowledge bases:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateKB = async () => {
    if (!newKBName.trim()) return;
    
    try {
      setCreating(true);
      const newKB = await knowledgeBaseApi.create({
        name: newKBName.trim(),
        description: newKBDescription.trim() || undefined,
      });
      
      setKnowledgeBases([...knowledgeBases, newKB]);
      setCreateDialogOpen(false);
      setNewKBName('');
      setNewKBDescription('');
      setError(null);
    } catch (err) {
      setError('Failed to create knowledge base');
      console.error('Error creating knowledge base:', err);
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteKB = async (kb: KnowledgeBase) => {
    if (!window.confirm(`Are you sure you want to delete "${kb.name}"? This will delete all files and cannot be undone.`)) {
      return;
    }

    try {
      await knowledgeBaseApi.delete(kb.id);
      setKnowledgeBases(knowledgeBases.filter(k => k.id !== kb.id));
      if (selectedKB?.id === kb.id) {
        setSelectedKB(null);
        setCurrentView('list');
      }
      setError(null);
    } catch (err) {
      setError('Failed to delete knowledge base');
      console.error('Error deleting knowledge base:', err);
    }
  };

  const handleSelectKB = (kb: KnowledgeBase) => {
    setSelectedKB(kb);
    setCurrentView('detail');
  };

  const handleBackToList = () => {
    setSelectedKB(null);
    setCurrentView('list');
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const renderKnowledgeBaseList = () => (
    <Container maxWidth="lg">
      <Box sx={{ mt: 4, mb: 4 }}>
          <Typography variant="h4" component="h1" gutterBottom>
            little-kb - Knowledge Base Manager
          </Typography>
        
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {loading ? (
          <Box display="flex" justifyContent="center" mt={4}>
            <CircularProgress />
          </Box>
        ) : (
          <>
            <Box 
              display="grid" 
              gridTemplateColumns="repeat(auto-fill, minmax(300px, 1fr))" 
              gap={3}
            >
              {knowledgeBases.map((kb) => (
                <Card 
                  key={kb.id}
                  sx={{ 
                    cursor: 'pointer',
                    transition: 'all 0.2s ease-in-out',
                    '&:hover': {
                      transform: 'translateY(-2px)',
                      boxShadow: 4
                    }
                  }}
                  onClick={() => handleSelectKB(kb)}
                >
                  <CardContent>
                    <Box display="flex" alignItems="center" mb={1}>
                      <FolderIcon color="primary" sx={{ mr: 1 }} />
                      <Typography variant="h6" component="h2">
                        {kb.name}
                      </Typography>
                    </Box>
                    
                    {kb.description && (
                      <Typography variant="body2" color="text.secondary" paragraph>
                        {kb.description}
                      </Typography>
                    )}
                    
                    <Box display="flex" justifyContent="space-between" alignItems="center">
                      <Chip 
                        label={`${kb.file_count} files`} 
                        size="small" 
                        color="primary" 
                        variant="outlined" 
                      />
                      <Typography variant="caption" color="text.secondary">
                        Created {formatDate(kb.created_date)}
                      </Typography>
                    </Box>
                  </CardContent>
                  
                  <CardActions>
                    <IconButton 
                      size="small" 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteKB(kb);
                      }}
                      color="error"
                    >
                      <DeleteIcon />
                    </IconButton>
                  </CardActions>
                </Card>
              ))}
            </Box>

            {knowledgeBases.length === 0 && (
              <Box textAlign="center" mt={4}>
                <Typography variant="h6" color="text.secondary" gutterBottom>
                  No knowledge bases yet
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Create your first knowledge base to get started
                </Typography>
              </Box>
            )}
          </>
        )}

        <Fab
          color="primary"
          aria-label="add"
          sx={{ position: 'fixed', bottom: 16, right: 16 }}
          onClick={() => setCreateDialogOpen(true)}
        >
          <AddIcon />
        </Fab>
      </Box>

      {/* Create Knowledge Base Dialog */}
      <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create New Knowledge Base</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Name"
            fullWidth
            variant="outlined"
            value={newKBName}
            onChange={(e) => setNewKBName(e.target.value)}
            sx={{ mb: 2 }}
          />
          <TextField
            margin="dense"
            label="Description (optional)"
            fullWidth
            multiline
            rows={3}
            variant="outlined"
            value={newKBDescription}
            onChange={(e) => setNewKBDescription(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
          <Button 
            onClick={handleCreateKB} 
            variant="contained"
            disabled={!newKBName.trim() || creating}
          >
            {creating ? <CircularProgress size={20} /> : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );

  return (
    <Box sx={{ flexGrow: 1 }}>
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            little-kb - Knowledge Base Manager
          </Typography>
          {currentView !== 'list' && (
            <Button color="inherit" onClick={handleBackToList}>
              Back to List
            </Button>
          )}
          <Button 
            color="inherit" 
            startIcon={<SettingsIcon />}
            onClick={() => setCurrentView('mcp')}
          >
            MCP Servers
          </Button>
          <IconButton color="inherit" onClick={loadKnowledgeBases}>
            <RefreshIcon />
          </IconButton>
        </Toolbar>
      </AppBar>

      {currentView === 'list' && renderKnowledgeBaseList()}
      
      {currentView === 'detail' && selectedKB && (
        <KnowledgeBaseDetail 
          knowledgeBase={selectedKB}
          allKnowledgeBases={knowledgeBases}
          onBack={handleBackToList}
          onNavigateToDocuments={() => setCurrentView('documents')}
          onKBUpdated={(updatedKB) => {
            setKnowledgeBases(kbs => kbs.map(kb => kb.id === updatedKB.id ? updatedKB : kb));
            setSelectedKB(updatedKB);
          }}
          onKBSelected={(kb) => {
            setSelectedKB(kb);
            // Stay on detail view but switch to the new KB
          }}
        />
      )}
      
      {currentView === 'documents' && selectedKB && (
        <DocumentsList 
          knowledgeBase={selectedKB}
          allKnowledgeBases={knowledgeBases}
          onBack={() => setCurrentView('detail')}
          onKBUpdated={(updatedKB) => {
            setKnowledgeBases(kbs => kbs.map(kb => kb.id === updatedKB.id ? updatedKB : kb));
            setSelectedKB(updatedKB);
          }}
          onKBSelected={(kb) => {
            setSelectedKB(kb);
            setCurrentView('detail'); // Navigate back to detail view when switching KBs
          }}
        />
      )}
      
      
      {currentView === 'mcp' && (
        <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
          <MCPServerManager />
        </Container>
      )}
    </Box>
  );
}

export default App;
