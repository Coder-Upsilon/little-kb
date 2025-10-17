import React, { useState, useEffect } from 'react';
import {
  Container,
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  List,
  ListItemText,
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
  Tabs,
  Tab,
  Paper,
  TextField,
} from '@mui/material';
import {
  Upload as UploadIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
  InsertDriveFile as FileIcon,
  Search as SearchIcon,
  Settings as SettingsIcon,
  PlayArrow as PlayIcon,
  Stop as StopIcon,
  ContentCopy as CopyIcon,
  Folder as FolderIcon,
  FolderOpen as FolderOpenIcon,
} from '@mui/icons-material';
import { filesApi, knowledgeBaseApi, KnowledgeBase, Document } from '../services/api';
import api from '../services/api';
import FileUpload from './FileUpload';
import SearchInterface from './SearchInterface';

interface Props {
  knowledgeBase: KnowledgeBase;
  allKnowledgeBases: KnowledgeBase[];
  onBack: () => void;
  onNavigateToDocuments: () => void;
  onKBUpdated: (kb: KnowledgeBase) => void;
  onKBSelected: (kb: KnowledgeBase) => void;
}

const KnowledgeBaseDetail: React.FC<Props> = ({ 
  knowledgeBase, 
  allKnowledgeBases, 
  onBack, 
  onNavigateToDocuments, 
  onKBUpdated, 
  onKBSelected 
}) => {
  const [error, setError] = useState<string | null>(null);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [reindexing, setReindexing] = useState(false);
  const [stats, setStats] = useState<any>(null);
  const [mcpServer, setMcpServer] = useState<any>(null);
  const [mcpLoading, setMcpLoading] = useState(false);
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const [mcpConfig, setMcpConfig] = useState<any>(null);
  const [configTab, setConfigTab] = useState<'cline' | 'claude'>('cline');
  const [editingInstructions, setEditingInstructions] = useState(false);
  const [instructionsText, setInstructionsText] = useState('');
  const [editingToolDescriptions, setEditingToolDescriptions] = useState(false);
  const [toolDescriptions, setToolDescriptions] = useState<Record<string, string>>({});
  const [parameterDescriptions, setParameterDescriptions] = useState<Record<string, string>>({});
  const [kbConfigDialogOpen, setKbConfigDialogOpen] = useState(false);
  const [kbConfig, setKbConfig] = useState<any>(null);
  const [availableModels, setAvailableModels] = useState<any[]>([]);
  const [editingKbConfig, setEditingKbConfig] = useState(false);
  const [tempKbConfig, setTempKbConfig] = useState<any>(null);
  const [reindexProgress, setReindexProgress] = useState<any>(null);
  const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Clear progress from previous KB
    setReindexProgress(null);
    setReindexing(false);
    
    // Clear any polling from previous KB
    if (pollingInterval) {
      clearInterval(pollingInterval);
      setPollingInterval(null);
    }
    
    loadStats();
    loadMcpServer();
    loadKbConfig();
    
    // Cleanup polling on unmount
    return () => {
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
    };
  }, [knowledgeBase.id]);

  const startProgressPolling = async () => {
    // Set reindexing state
    setReindexing(true);
    
    // Clear any existing interval
    if (pollingInterval) {
      clearInterval(pollingInterval);
      setPollingInterval(null);
    }
    
    // Poll immediately first
    const pollProgress = async (intervalId: NodeJS.Timeout) => {
      try {
        const progress = await knowledgeBaseApi.getReindexProgress(knowledgeBase.id);
        
        if (progress.status === 'not_found' || progress.status === 'completed' || progress.status === 'error') {
          // Stop polling - use the passed interval ID
          clearInterval(intervalId);
          setPollingInterval(null);
          
          if (progress.status === 'completed') {
            setReindexProgress(null);
            setReindexing(false);
            await loadStats();
            setError(null);
          } else if (progress.status === 'error') {
            setReindexProgress(null);
            setReindexing(false);
            setError(`Reindex failed: ${progress.error || 'Unknown error'}`);
          } else {
            // not_found case
            setReindexProgress(null);
            setReindexing(false);
          }
          
          return true; // Signal to stop
        } else {
          // Still in progress
          setReindexProgress(progress);
          setReindexing(true);
          return false; // Continue polling
        }
      } catch (err) {
        console.error('Error polling progress:', err);
        return false; // Continue polling on error
      }
    };
    
    // Poll immediately
    const shouldStop = await pollProgress(null as any);
    
    if (!shouldStop) {
      // Then poll every 500ms for faster updates
      const interval = setInterval(async () => {
        const stop = await pollProgress(interval);
        // Interval will be cleared inside pollProgress if needed
      }, 500);
      setPollingInterval(interval);
    }
  };

  const loadKbConfig = async () => {
    try {
      const config = await knowledgeBaseApi.getConfig(knowledgeBase.id);
      setKbConfig(config);
    } catch (err) {
      console.error('Error loading KB config:', err);
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

  const loadMcpServer = async () => {
    try {
      setMcpLoading(true);
      const response = await api.get(`/knowledge-bases/${knowledgeBase.id}/mcp-server`);
      setMcpServer(response.data.mcp_server);
    } catch (err) {
      console.error('Error loading MCP server:', err);
      setMcpServer(null);
    } finally {
      setMcpLoading(false);
    }
  };

  const handleToggleMcpServer = async (enabled: boolean) => {
    if (!mcpServer) return;
    
    try {
      const endpoint = enabled ? 'start' : 'stop';
      await api.post(`/mcp/${mcpServer.id}/${endpoint}`);
      setMcpServer({ ...mcpServer, enabled });
      setError(null);
    } catch (err) {
      setError(`Failed to ${enabled ? 'start' : 'stop'} MCP server`);
      console.error('Error toggling MCP server:', err);
    }
  };

  const handleShowMcpConfig = async () => {
    if (!mcpServer) return;
    
    try {
      const response = await api.get(`/mcp/${mcpServer.id}/config`);
      setMcpConfig(response.data);
      setInstructionsText(response.data.instructions);
      setEditingInstructions(false);
      
      // Set tool descriptions (use custom if exists, otherwise use defaults)
      const descriptions = response.data.tool_descriptions || {};
      const defaults = response.data.default_tool_descriptions || {};
      setToolDescriptions({
        search_knowledge_base: descriptions.search_knowledge_base || defaults.search_knowledge_base || '',
        get_knowledge_base_info: descriptions.get_knowledge_base_info || defaults.get_knowledge_base_info || '',
        list_documents: descriptions.list_documents || defaults.list_documents || ''
      });
      setEditingToolDescriptions(false);
      
      // Set parameter descriptions (use custom if exists, otherwise use defaults)
      const paramDescs = response.data.parameter_descriptions || {};
      const defaultParams = response.data.default_parameter_descriptions || {};
      setParameterDescriptions({
        query: paramDescs.query || defaultParams.query || '',
        limit: paramDescs.limit || defaultParams.limit || ''
      });
      
      setConfigDialogOpen(true);
    } catch (err) {
      setError('Failed to get MCP server configuration');
      console.error('Error getting MCP config:', err);
    }
  };

  const handleSaveInstructions = async () => {
    if (!mcpServer) return;
    
    try {
      await api.put(`/mcp/${mcpServer.id}`, { instructions: instructionsText });
      setEditingInstructions(false);
      
      // Update the config in state
      if (mcpConfig) {
        setMcpConfig({
          ...mcpConfig,
          instructions: instructionsText
        });
      }
      
      // Reload MCP server data
      loadMcpServer();
      setError(null);
    } catch (err) {
      setError('Failed to update instructions');
      console.error('Error updating instructions:', err);
    }
  };

  const handleSaveToolDescriptions = async () => {
    if (!mcpServer) return;
    
    try {
      // Combine tool descriptions and parameter descriptions
      const combinedDescriptions: Record<string, any> = {
        ...toolDescriptions,
        search_knowledge_base_params: parameterDescriptions
      };
      
      await api.put(`/mcp/${mcpServer.id}/tool-descriptions`, { 
        tool_descriptions: combinedDescriptions 
      });
      setEditingToolDescriptions(false);
      
      // Update the config in state
      if (mcpConfig) {
        setMcpConfig({
          ...mcpConfig,
          tool_descriptions: combinedDescriptions
        });
      }
      
      // Reload MCP server data
      loadMcpServer();
      setError(null);
    } catch (err) {
      setError('Failed to update tool descriptions');
      console.error('Error updating tool descriptions:', err);
    }
  };

  const copyConfigToClipboard = () => {
    if (mcpConfig) {
      const config = configTab === 'cline' ? mcpConfig.configs.cline : mcpConfig.configs.claude;
      const configText = JSON.stringify({
        [mcpConfig.server_name]: config
      }, null, 2);
      navigator.clipboard.writeText(configText);
    }
  };


  const handleReindex = async () => {
    try {
      setReindexing(true);
      const result = await knowledgeBaseApi.reindex(knowledgeBase.id);
      
      // If reindex started successfully, start polling
      if (result.status === 'in_progress') {
        setReindexProgress({ 
          status: 'in_progress', 
          percentage: 0, 
          processed: 0, 
          total: result.total_documents 
        });
        startProgressPolling();
      } else {
        // No documents to reindex or already completed
        setReindexing(false);
        await loadStats();
      }
      
      setError(null);
    } catch (err) {
      setError('Failed to reindex knowledge base');
      console.error('Error reindexing:', err);
      setReindexing(false);
    }
  };

  const handleFileUploaded = (newDoc: Document) => {
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
          <Typography variant="h4" component="h1">
            {knowledgeBase.name}
          </Typography>
          <Box>
            <Button
              variant="outlined"
              startIcon={<FileIcon />}
              onClick={onNavigateToDocuments}
              sx={{ mr: 1 }}
            >
              View Documents
            </Button>
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
            <Button
              variant="outlined"
              startIcon={<SettingsIcon />}
              onClick={async () => {
                const models = await knowledgeBaseApi.getEmbeddingModels();
                setAvailableModels(models);
                setTempKbConfig(JSON.parse(JSON.stringify(kbConfig)));
                setEditingKbConfig(false);
                setKbConfigDialogOpen(true);
              }}
            >
              Configuration
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

        {/* Reindex Progress */}
        {reindexProgress && reindexProgress.status === 'in_progress' && (
          <Alert severity="info" sx={{ mb: 2 }}>
            <Box>
              <Typography variant="body2" gutterBottom>
                <strong>Reindexing in progress:</strong> {reindexProgress.processed} / {reindexProgress.total} documents ({reindexProgress.percentage}%)
              </Typography>
              <Box sx={{ width: '100%', mt: 1, mb: 2 }}>
                <Box sx={{ 
                  width: '100%', 
                  height: 8, 
                  bgcolor: 'grey.300', 
                  borderRadius: 1,
                  overflow: 'hidden'
                }}>
                  <Box sx={{ 
                    width: `${reindexProgress.percentage}%`, 
                    height: '100%', 
                    bgcolor: 'primary.main',
                    transition: 'width 0.3s ease'
                  }} />
                </Box>
              </Box>
              
              {/* Current File Progress */}
              {reindexProgress.current_file && (
                <Box sx={{ mt: 2, mb: 1 }}>
                  <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                    <strong>Current:</strong> {reindexProgress.current_file} ({reindexProgress.current_file_progress}%)
                  </Typography>
                  <Box sx={{ width: '100%', mt: 0.5 }}>
                    <Box sx={{ 
                      width: '100%', 
                      height: 4, 
                      bgcolor: 'grey.200', 
                      borderRadius: 1,
                      overflow: 'hidden'
                    }}>
                      <Box sx={{ 
                        width: `${reindexProgress.current_file_progress}%`, 
                        height: '100%', 
                        bgcolor: 'success.main',
                        transition: 'width 0.3s ease'
                      }} />
                    </Box>
                  </Box>
                </Box>
              )}
              
              {reindexProgress.succeeded > 0 && (
                <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
                  Succeeded: {reindexProgress.succeeded} | Failed: {reindexProgress.failed}
                </Typography>
              )}
            </Box>
          </Alert>
        )}

        {/* Statistics */}
        {stats && (
          <Box 
            display="grid" 
            gridTemplateColumns="repeat(auto-fit, minmax(250px, 1fr))" 
            gap={3} 
            sx={{ mb: 3 }}
          >
            <Card>
              <CardContent>
                <Typography color="text.secondary" gutterBottom>
                  Knowledge Base Stats
                </Typography>
                <Box sx={{ mt: 2 }}>
                  <Box display="flex" justifyContent="space-between" sx={{ mb: 1 }}>
                    <Typography variant="body2" color="text.secondary">
                      Total Files:
                    </Typography>
                    <Typography variant="body2" fontWeight="bold">
                      {stats.file_count || 0}
                    </Typography>
                  </Box>
                  <Box display="flex" justifyContent="space-between" sx={{ mb: 1 }}>
                    <Typography variant="body2" color="text.secondary">
                      Total Size:
                    </Typography>
                    <Typography variant="body2" fontWeight="bold">
                      {formatFileSize(stats.total_size || 0)}
                    </Typography>
                  </Box>
                  <Box display="flex" justifyContent="space-between" sx={{ mb: 1 }}>
                    <Typography variant="body2" color="text.secondary">
                      Text Chunks:
                    </Typography>
                    <Typography variant="body2" fontWeight="bold">
                      {stats.total_chunks || 0}
                    </Typography>
                  </Box>
                  <Box display="flex" justifyContent="space-between">
                    <Typography variant="body2" color="text.secondary">
                      Vector Embeddings:
                    </Typography>
                    <Typography variant="body2" fontWeight="bold">
                      {stats.vector_chunks || 0}
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
            
            {/* MCP Server Card */}
            <Card>
              <CardContent>
                <Typography color="text.secondary" gutterBottom>
                  MCP Server
                </Typography>
                {mcpLoading ? (
                  <Box display="flex" justifyContent="center" mt={1}>
                    <CircularProgress size={24} />
                  </Box>
                ) : mcpServer ? (
                  <Box>
                    <Box display="flex" alignItems="center" mb={1}>
                      <Chip
                        label={mcpServer.status === 'error' ? 'Error' : mcpServer.enabled ? 'Running' : 'Stopped'}
                        color={mcpServer.status === 'error' ? 'error' : mcpServer.enabled ? 'success' : 'default'}
                        size="small"
                        sx={{ mr: 1 }}
                      />
                      {mcpServer.server_name.endsWith(' - assigned') && (
                        <Chip
                          label="Default"
                          color="primary"
                          variant="outlined"
                          size="small"
                        />
                      )}
                    </Box>
                    
                    <Typography variant="body2" color="text.secondary" mb={1}>
                      Port {mcpServer.port}
                    </Typography>
                    
                    {mcpServer.error_message && (
                      <Alert severity="error" sx={{ mb: 1, fontSize: '0.75rem' }}>
                        {mcpServer.error_message}
                      </Alert>
                    )}
                    
                    <Box display="flex" gap={1}>
                      <IconButton
                        size="small"
                        onClick={() => handleToggleMcpServer(!mcpServer.enabled)}
                        color={mcpServer.enabled ? 'error' : 'success'}
                        title={mcpServer.enabled ? 'Stop MCP Server' : 'Start MCP Server'}
                      >
                        {mcpServer.enabled ? <StopIcon /> : <PlayIcon />}
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={handleShowMcpConfig}
                        title="Show Configuration"
                      >
                        <SettingsIcon />
                      </IconButton>
                    </Box>
                  </Box>
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    No MCP server
                  </Typography>
                )}
              </CardContent>
            </Card>
          </Box>
        )}


        {/* Search Interface */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Search Knowledge Base
            </Typography>
            <SearchInterface 
              knowledgeBase={knowledgeBase} 
              onBack={() => {}} // No back needed since it's embedded
              embedded={true}
            />
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

        {/* KB Configuration Dialog */}
        <Dialog 
          open={kbConfigDialogOpen} 
          onClose={() => setKbConfigDialogOpen(false)}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle>
            Knowledge Base Configuration
          </DialogTitle>
          <DialogContent>
            {kbConfig && tempKbConfig && (
              <Box sx={{ mt: 2 }}>
                <Alert severity="info" sx={{ mb: 3 }}>
                  Configure how this knowledge base processes documents and performs searches.
                  {editingKbConfig && ' Changes will apply to new documents and searches.'}
                </Alert>

                {!editingKbConfig ? (
                  <Box>
                    {/* Display current configuration */}
                    <Paper sx={{ p: 2, mb: 2 }}>
                      <Typography variant="subtitle1" gutterBottom>
                        Basic Information
                      </Typography>
                      <Typography variant="body2">
                        <strong>Name:</strong> {knowledgeBase.name}
                      </Typography>
                      <Typography variant="body2">
                        <strong>Description:</strong> {knowledgeBase.description || 'No description'}
                      </Typography>
                    </Paper>

                    <Paper sx={{ p: 2, mb: 2 }}>
                      <Typography variant="subtitle1" gutterBottom>
                        Embedding Model
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {availableModels.find(m => m.id === kbConfig.embedding_model)?.name || kbConfig.embedding_model}
                      </Typography>
                      <Typography variant="caption" display="block" sx={{ mt: 0.5 }}>
                        {availableModels.find(m => m.id === kbConfig.embedding_model)?.description}
                      </Typography>
                    </Paper>

                    <Paper sx={{ p: 2, mb: 2 }}>
                      <Typography variant="subtitle1" gutterBottom>
                        Chunking Settings
                      </Typography>
                      <Typography variant="body2">
                        <strong>Chunk Size:</strong> {kbConfig.chunking.chunk_size} tokens
                      </Typography>
                      <Typography variant="body2">
                        <strong>Chunk Overlap:</strong> {kbConfig.chunking.chunk_overlap} tokens
                      </Typography>
                      <Typography variant="body2">
                        <strong>Overlap Enabled:</strong> {kbConfig.chunking.overlap_enabled ? 'Yes' : 'No'}
                      </Typography>
                    </Paper>

                    <Paper sx={{ p: 2 }}>
                      <Typography variant="subtitle1" gutterBottom>
                        Search Settings
                      </Typography>
                      <Typography variant="body2">
                        <strong>Hybrid Search:</strong> {kbConfig.search.hybrid_search ? 'Enabled' : 'Disabled'}
                      </Typography>
                      {kbConfig.search.hybrid_search && (
                        <>
                          <Typography variant="body2">
                            <strong>Hybrid Alpha:</strong> {kbConfig.search.hybrid_alpha} (weight for vector search)
                          </Typography>
                          <Typography variant="body2">
                            <strong>BM25 k1:</strong> {kbConfig.search.bm25_k1}
                          </Typography>
                          <Typography variant="body2">
                            <strong>BM25 b:</strong> {kbConfig.search.bm25_b}
                          </Typography>
                        </>
                      )}
                    </Paper>
                  </Box>
                ) : (
                  <Box>
                    {/* Edit configuration */}
                    <Box sx={{ mb: 3 }}>
                      <Typography variant="subtitle2" gutterBottom>
                        Basic Information
                      </Typography>
                      <TextField
                        fullWidth
                        label="Knowledge Base Name"
                        value={tempKbConfig.name || knowledgeBase.name}
                        onChange={(e) => setTempKbConfig({
                          ...tempKbConfig,
                          name: e.target.value
                        })}
                        helperText="Display name for this knowledge base. Note: Changing the name will trigger an MCP server restart."
                        sx={{ mb: 2 }}
                      />
                      <TextField
                        fullWidth
                        label="Description"
                        value={tempKbConfig.description || knowledgeBase.description || ''}
                        onChange={(e) => setTempKbConfig({
                          ...tempKbConfig,
                          description: e.target.value
                        })}
                        multiline
                        rows={2}
                        helperText="Optional description of this knowledge base"
                      />
                    </Box>

                    <Box sx={{ mb: 3 }}>
                      <Typography variant="subtitle2" gutterBottom>
                        Embedding Model
                      </Typography>
                      <TextField
                        select
                        fullWidth
                        value={tempKbConfig.embedding_model}
                        onChange={(e) => setTempKbConfig({
                          ...tempKbConfig,
                          embedding_model: e.target.value
                        })}
                        SelectProps={{ native: true }}
                      >
                        {availableModels.map((model) => (
                          <option key={model.id} value={model.id}>
                            {model.name} ({model.dimensions}d, {model.size_mb}MB)
                          </option>
                        ))}
                      </TextField>
                      <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                        {availableModels.find(m => m.id === tempKbConfig.embedding_model)?.description}
                      </Typography>
                    </Box>

                    <Box sx={{ mb: 3 }}>
                      <Typography variant="subtitle2" gutterBottom>
                        Chunking Settings
                      </Typography>
                      <TextField
                        fullWidth
                        label="Chunk Size (tokens)"
                        type="number"
                        value={tempKbConfig.chunking.chunk_size}
                        onChange={(e) => setTempKbConfig({
                          ...tempKbConfig,
                          chunking: {
                            ...tempKbConfig.chunking,
                            chunk_size: parseInt(e.target.value)
                          }
                        })}
                        inputProps={{ min: 100, max: 2000 }}
                        helperText="Size of each text chunk (100-2000 tokens)"
                        sx={{ mb: 2 }}
                      />
                      <TextField
                        fullWidth
                        label="Chunk Overlap (tokens)"
                        type="number"
                        value={tempKbConfig.chunking.chunk_overlap}
                        onChange={(e) => setTempKbConfig({
                          ...tempKbConfig,
                          chunking: {
                            ...tempKbConfig.chunking,
                            chunk_overlap: parseInt(e.target.value)
                          }
                        })}
                        inputProps={{ min: 0, max: 500 }}
                        helperText="Overlap between consecutive chunks (0-500 tokens)"
                        sx={{ mb: 2 }}
                      />
                      <Box display="flex" alignItems="center">
                        <input
                          type="checkbox"
                          checked={tempKbConfig.chunking.overlap_enabled}
                          onChange={(e) => setTempKbConfig({
                            ...tempKbConfig,
                            chunking: {
                              ...tempKbConfig.chunking,
                              overlap_enabled: e.target.checked
                            }
                          })}
                          style={{ marginRight: 8 }}
                        />
                        <Typography variant="body2">
                          Enable chunk overlap
                        </Typography>
                      </Box>
                    </Box>

                    <Box>
                      <Typography variant="subtitle2" gutterBottom>
                        Search Settings
                      </Typography>
                      <Box display="flex" alignItems="center" sx={{ mb: 2 }}>
                        <input
                          type="checkbox"
                          checked={tempKbConfig.search.hybrid_search}
                          onChange={(e) => setTempKbConfig({
                            ...tempKbConfig,
                            search: {
                              ...tempKbConfig.search,
                              hybrid_search: e.target.checked
                            }
                          })}
                          style={{ marginRight: 8 }}
                        />
                        <Typography variant="body2">
                          Enable hybrid search (vector + keyword)
                        </Typography>
                      </Box>
                      
                      {tempKbConfig.search.hybrid_search && (
                        <>
                          <TextField
                            fullWidth
                            label="Hybrid Alpha"
                            type="number"
                            value={tempKbConfig.search.hybrid_alpha}
                            onChange={(e) => setTempKbConfig({
                              ...tempKbConfig,
                              search: {
                                ...tempKbConfig.search,
                                hybrid_alpha: parseFloat(e.target.value)
                              }
                            })}
                            inputProps={{ min: 0, max: 1, step: 0.1 }}
                            helperText="Weight for vector search: 1.0 = pure vector, 0.0 = pure keyword"
                            sx={{ mb: 2 }}
                          />
                          <TextField
                            fullWidth
                            label="BM25 k1"
                            type="number"
                            value={tempKbConfig.search.bm25_k1}
                            onChange={(e) => setTempKbConfig({
                              ...tempKbConfig,
                              search: {
                                ...tempKbConfig.search,
                                bm25_k1: parseFloat(e.target.value)
                              }
                            })}
                            inputProps={{ min: 0, max: 3, step: 0.1 }}
                            helperText="BM25 term frequency saturation parameter"
                            sx={{ mb: 2 }}
                          />
                          <TextField
                            fullWidth
                            label="BM25 b"
                            type="number"
                            value={tempKbConfig.search.bm25_b}
                            onChange={(e) => setTempKbConfig({
                              ...tempKbConfig,
                              search: {
                                ...tempKbConfig.search,
                                bm25_b: parseFloat(e.target.value)
                              }
                            })}
                            inputProps={{ min: 0, max: 1, step: 0.05 }}
                            helperText="BM25 length normalization parameter"
                          />
                        </>
                      )}
                    </Box>
                  </Box>
                )}
              </Box>
            )}
          </DialogContent>
          <DialogActions>
            {!editingKbConfig ? (
              <>
                <Button onClick={() => setKbConfigDialogOpen(false)}>
                  Close
                </Button>
                <Button 
                  variant="contained" 
                  onClick={() => setEditingKbConfig(true)}
                >
                  Edit Configuration
                </Button>
              </>
            ) : (
              <>
                <Button onClick={() => {
                  setTempKbConfig(JSON.parse(JSON.stringify(kbConfig)));
                  setEditingKbConfig(false);
                }}>
                  Cancel
                </Button>
                <Button 
                  variant="contained" 
                  onClick={async () => {
                    try {
                      setReindexing(true);
                      
                      // Update config
                      await knowledgeBaseApi.updateConfig(knowledgeBase.id, tempKbConfig);
                      setKbConfig(tempKbConfig);
                      
                      // Update name and description if changed
                      if (tempKbConfig.name !== knowledgeBase.name || 
                          tempKbConfig.description !== knowledgeBase.description) {
                        await knowledgeBaseApi.update(knowledgeBase.id, {
                          name: tempKbConfig.name || knowledgeBase.name,
                          description: tempKbConfig.description
                        });
                        // Update local KB object
                        const updatedKB = {
                          ...knowledgeBase,
                          name: tempKbConfig.name || knowledgeBase.name,
                          description: tempKbConfig.description
                        };
                        onKBUpdated(updatedKB);
                      }
                      
                      setEditingKbConfig(false);
                      
                      // Auto-trigger reindex after config change
                      const result = await knowledgeBaseApi.reindex(knowledgeBase.id);
                      
                      // Show that reindexing has started
                      if (result.status === 'in_progress') {
                        // Close dialog and start polling progress
                        setKbConfigDialogOpen(false);
                        setReindexProgress({ 
                          status: 'in_progress', 
                          percentage: 0, 
                          processed: 0, 
                          total: result.total_documents 
                        });
                        startProgressPolling();
                      } else {
                        setError(null);
                        setKbConfigDialogOpen(false);
                      }
                    } catch (err) {
                      setError('Failed to update configuration');
                      console.error('Error updating KB config:', err);
                    } finally {
                      setReindexing(false);
                    }
                  }}
                  disabled={reindexing}
                >
                  {reindexing ? (
                    <Box display="flex" alignItems="center" gap={1}>
                      <CircularProgress size={20} />
                      <span>Updating & Reindexing...</span>
                    </Box>
                  ) : (
                    'Save Changes & Reindex'
                  )}
                </Button>
              </>
            )}
          </DialogActions>
        </Dialog>

        {/* MCP Configuration Dialog */}
        <Dialog
          open={configDialogOpen} 
          onClose={() => setConfigDialogOpen(false)}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle>
            MCP Server Configuration
            <IconButton
              onClick={copyConfigToClipboard}
              sx={{ float: 'right' }}
              title="Copy current tab configuration"
            >
              <CopyIcon />
            </IconButton>
          </DialogTitle>
          <DialogContent>
            {mcpConfig && (
              <Box>
                <Alert severity="info" sx={{ mb: 2 }}>
                  Choose your client type and copy the configuration to your MCP settings.
                </Alert>
                
                <Tabs 
                  value={configTab} 
                  onChange={(_, newValue) => setConfigTab(newValue)}
                  sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}
                >
                  <Tab label="Cline" value="cline" />
                  <Tab label="Claude Desktop" value="claude" />
                </Tabs>

                {configTab === 'cline' ? (
                  <Box>
                    <Typography variant="subtitle2" sx={{ mb: 1 }}>
                      Cline Configuration (Direct URL)
                    </Typography>
                    <Paper sx={{ p: 2, bgcolor: 'grey.100', mb: 2 }}>
                      <pre style={{ margin: 0, fontSize: '0.875rem', overflow: 'auto' }}>
                        {JSON.stringify({
                          [mcpConfig.server_name]: mcpConfig.configs.cline
                        }, null, 2)}
                      </pre>
                    </Paper>
                  </Box>
                ) : (
                  <Box>
                    <Typography variant="subtitle2" sx={{ mb: 1 }}>
                      Claude Desktop Configuration (via mcp-remote-client)
                    </Typography>
                    <Paper sx={{ p: 2, bgcolor: 'grey.100', mb: 2 }}>
                      <pre style={{ margin: 0, fontSize: '0.875rem', overflow: 'auto' }}>
                        {JSON.stringify({
                          [mcpConfig.server_name]: mcpConfig.configs.claude
                        }, null, 2)}
                      </pre>
                    </Paper>
                  </Box>
                )}

                <Box 
                  sx={{ 
                    p: 2, 
                    bgcolor: 'grey.50', 
                    borderRadius: 1,
                    border: 1,
                    borderColor: 'divider',
                    mb: 2
                  }}
                >
                  <Typography variant="subtitle1" gutterBottom>
                    Server Details & Instructions
                  </Typography>
                  <Typography variant="body2" component="div" mb={2}>
                    <strong>Base URL:</strong> {mcpConfig.base_url}
                  </Typography>
                  
                  <Box>
                    <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                      <Typography variant="body2" component="div">
                        <strong>Instructions:</strong>
                      </Typography>
                      {!editingInstructions ? (
                        <Button
                          size="small"
                          onClick={() => setEditingInstructions(true)}
                        >
                          Edit
                        </Button>
                      ) : (
                        <Box>
                          <Button
                            size="small"
                            onClick={() => {
                              setInstructionsText(mcpConfig.instructions);
                              setEditingInstructions(false);
                            }}
                            sx={{ mr: 1 }}
                          >
                            Cancel
                          </Button>
                          <Button
                            size="small"
                            variant="contained"
                            onClick={handleSaveInstructions}
                          >
                            Save
                          </Button>
                        </Box>
                      )}
                    </Box>
                    
                    {editingInstructions ? (
                      <TextField
                        fullWidth
                        multiline
                        rows={4}
                        value={instructionsText}
                        onChange={(e) => setInstructionsText(e.target.value)}
                        variant="outlined"
                        size="small"
                      />
                    ) : (
                      <Paper sx={{ p: 2, bgcolor: 'white' }}>
                        <Typography variant="body2" style={{ whiteSpace: 'pre-wrap' }}>
                          {mcpConfig.instructions || 'No instructions provided'}
                        </Typography>
                      </Paper>
                    )}
                  </Box>
                </Box>

                <Box 
                  sx={{ 
                    p: 2, 
                    bgcolor: 'grey.50', 
                    borderRadius: 1,
                    border: 1,
                    borderColor: 'divider'
                  }}
                >
                  <Typography variant="subtitle1" gutterBottom>
                    Tool Descriptions
                  </Typography>
                  <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                    <Typography variant="body2" color="text.secondary">
                      Customize the descriptions of the MCP tools provided by this server
                    </Typography>
                    {!editingToolDescriptions ? (
                      <Button
                        size="small"
                        onClick={() => setEditingToolDescriptions(true)}
                      >
                        Edit
                      </Button>
                    ) : (
                      <Box>
                        <Button
                          size="small"
                          onClick={() => {
                            // Reset to current values
                            const descriptions = mcpConfig.tool_descriptions || {};
                            const defaults = mcpConfig.default_tool_descriptions || {};
                            setToolDescriptions({
                              search_knowledge_base: descriptions.search_knowledge_base || defaults.search_knowledge_base || '',
                              get_knowledge_base_info: descriptions.get_knowledge_base_info || defaults.get_knowledge_base_info || '',
                              list_documents: descriptions.list_documents || defaults.list_documents || ''
                            });
                            setEditingToolDescriptions(false);
                          }}
                          sx={{ mr: 1 }}
                        >
                          Cancel
                        </Button>
                        <Button
                          size="small"
                          variant="contained"
                          onClick={handleSaveToolDescriptions}
                        >
                          Save
                        </Button>
                      </Box>
                    )}
                  </Box>

                  {editingToolDescriptions ? (
                    <Box>
                      <Typography variant="subtitle2" sx={{ mb: 1, mt: 1 }}>
                        Tool Descriptions:
                      </Typography>
                      <TextField
                        fullWidth
                        label="search_knowledge_base"
                        value={toolDescriptions.search_knowledge_base || ''}
                        onChange={(e) => setToolDescriptions({
                          ...toolDescriptions,
                          search_knowledge_base: e.target.value
                        })}
                        multiline
                        rows={2}
                        variant="outlined"
                        size="small"
                        sx={{ mb: 2 }}
                        helperText="Description for the search tool"
                      />
                      <TextField
                        fullWidth
                        label="get_knowledge_base_info"
                        value={toolDescriptions.get_knowledge_base_info || ''}
                        onChange={(e) => setToolDescriptions({
                          ...toolDescriptions,
                          get_knowledge_base_info: e.target.value
                        })}
                        multiline
                        rows={2}
                        variant="outlined"
                        size="small"
                        sx={{ mb: 2 }}
                        helperText="Description for the info tool"
                      />
                      <TextField
                        fullWidth
                        label="list_documents"
                        value={toolDescriptions.list_documents || ''}
                        onChange={(e) => setToolDescriptions({
                          ...toolDescriptions,
                          list_documents: e.target.value
                        })}
                        multiline
                        rows={2}
                        variant="outlined"
                        size="small"
                        sx={{ mb: 3 }}
                        helperText="Description for the list documents tool"
                      />
                      
                      <Typography variant="subtitle2" sx={{ mb: 1 }}>
                        Parameter Descriptions (search_knowledge_base):
                      </Typography>
                      <TextField
                        fullWidth
                        label="query parameter"
                        value={parameterDescriptions.query || ''}
                        onChange={(e) => setParameterDescriptions({
                          ...parameterDescriptions,
                          query: e.target.value
                        })}
                        multiline
                        rows={1}
                        variant="outlined"
                        size="small"
                        sx={{ mb: 2 }}
                        helperText="Description for the query parameter"
                      />
                      <TextField
                        fullWidth
                        label="limit parameter"
                        value={parameterDescriptions.limit || ''}
                        onChange={(e) => setParameterDescriptions({
                          ...parameterDescriptions,
                          limit: e.target.value
                        })}
                        multiline
                        rows={1}
                        variant="outlined"
                        size="small"
                        helperText="Description for the limit parameter"
                      />
                    </Box>
                  ) : (
                    <Box>
                      <Typography variant="subtitle2" sx={{ mb: 1 }}>
                        Tool Descriptions:
                      </Typography>
                      <Paper sx={{ p: 2, bgcolor: 'white', mb: 1 }}>
                        <Typography variant="caption" color="text.secondary" display="block">
                          search_knowledge_base
                        </Typography>
                        <Typography variant="body2">
                          {toolDescriptions.search_knowledge_base || mcpConfig.default_tool_descriptions?.search_knowledge_base || 'No description'}
                        </Typography>
                      </Paper>
                      <Paper sx={{ p: 2, bgcolor: 'white', mb: 1 }}>
                        <Typography variant="caption" color="text.secondary" display="block">
                          get_knowledge_base_info
                        </Typography>
                        <Typography variant="body2">
                          {toolDescriptions.get_knowledge_base_info || mcpConfig.default_tool_descriptions?.get_knowledge_base_info || 'No description'}
                        </Typography>
                      </Paper>
                      <Paper sx={{ p: 2, bgcolor: 'white', mb: 2 }}>
                        <Typography variant="caption" color="text.secondary" display="block">
                          list_documents
                        </Typography>
                        <Typography variant="body2">
                          {toolDescriptions.list_documents || mcpConfig.default_tool_descriptions?.list_documents || 'No description'}
                        </Typography>
                      </Paper>
                      
                      <Typography variant="subtitle2" sx={{ mb: 1 }}>
                        Parameter Descriptions (search_knowledge_base):
                      </Typography>
                      <Paper sx={{ p: 2, bgcolor: 'white', mb: 1 }}>
                        <Typography variant="caption" color="text.secondary" display="block">
                          query parameter
                        </Typography>
                        <Typography variant="body2">
                          {parameterDescriptions.query || 'Search query to find relevant documents'}
                        </Typography>
                      </Paper>
                      <Paper sx={{ p: 2, bgcolor: 'white' }}>
                        <Typography variant="caption" color="text.secondary" display="block">
                          limit parameter
                        </Typography>
                        <Typography variant="body2">
                          {parameterDescriptions.limit || 'Maximum number of results to return (default: 5)'}
                        </Typography>
                      </Paper>
                    </Box>
                  )}
                </Box>
              </Box>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setConfigDialogOpen(false)}>
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

export default KnowledgeBaseDetail;
