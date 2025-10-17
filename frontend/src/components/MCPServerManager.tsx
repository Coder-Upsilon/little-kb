import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Grid,
  IconButton,
  Alert,
  Snackbar,
  Switch,
  FormControlLabel,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Tooltip,
  Paper,
  Tabs,
  Tab
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  PlayArrow as StartIcon,
  Stop as StopIcon,
  ExpandMore as ExpandMoreIcon,
  ContentCopy as CopyIcon,
  Settings as SettingsIcon
} from '@mui/icons-material';
import api from '../services/api';

interface KnowledgeBase {
  id: string;
  name: string;
  description: string;
}

interface MCPServer {
  id: string;
  server_name: string;
  description: string;
  instructions: string;
  created_date: string;
  enabled: boolean;
  port: number;
  base_url: string;
  kb_id?: string;
  kb_name?: string;
  kb_ids?: string[];
  kb_names?: string[];
  type?: string;
  status?: string;
  error_message?: string;
}

interface MCPServerConfig {
  server_name: string;
  configs: {
    claude: {
      command: string;
      args: string[];
      disabled: boolean;
      autoApprove: string[];
    };
    cline: {
      url: string;
      disabled: boolean;
      autoApprove: string[];
    };
  };
  instructions: string;
  tool_descriptions: Record<string, string>;
  default_tool_descriptions: Record<string, string>;
  base_url: string;
}

const MCPServerManager: React.FC = () => {
  const [servers, setServers] = useState<MCPServer[]>([]);
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const [selectedConfig, setSelectedConfig] = useState<MCPServerConfig | null>(null);
  const [configTab, setConfigTab] = useState<'cline' | 'claude'>('cline');
  const [serverType, setServerType] = useState<'single' | 'multi'>('single');
  const [editingInstructions, setEditingInstructions] = useState(false);
  const [instructionsText, setInstructionsText] = useState('');
  const [editingToolDescriptions, setEditingToolDescriptions] = useState(false);
  const [toolDescriptions, setToolDescriptions] = useState<Record<string, string>>({});
  const [parameterDescriptions, setParameterDescriptions] = useState<Record<string, string>>({});
  const [selectedServerId, setSelectedServerId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    kb_id: '',
    kb_ids: [] as string[],
    server_name: '',
    description: '',
    instructions: '',
    port: ''
  });
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success' as 'success' | 'error'
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [serversResponse, kbResponse] = await Promise.all([
        api.get('/mcp/'),
        api.get('/knowledge-bases/')
      ]);
      setServers(serversResponse.data);
      setKnowledgeBases(kbResponse.data);
    } catch (error) {
      console.error('Error loading data:', error);
      showSnackbar('Failed to load data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const showSnackbar = (message: string, severity: 'success' | 'error') => {
    setSnackbar({ open: true, message, severity });
  };

  const handleCreateServer = async () => {
    try {
      const endpoint = serverType === 'single' ? '/mcp/single-kb' : '/mcp/multi-kb';
      const payload = serverType === 'single' 
        ? {
            kb_id: formData.kb_id,
            server_name: formData.server_name,
            description: formData.description,
            instructions: formData.instructions,
            port: formData.port ? parseInt(formData.port) : undefined
          }
        : {
            kb_ids: formData.kb_ids,
            server_name: formData.server_name,
            description: formData.description,
            instructions: formData.instructions,
            port: formData.port ? parseInt(formData.port) : undefined
          };

      await api.post(endpoint, payload);
      showSnackbar('MCP server created successfully', 'success');
      setCreateDialogOpen(false);
      resetForm();
      loadData();
    } catch (error) {
      console.error('Error creating server:', error);
      showSnackbar('Failed to create MCP server', 'error');
    }
  };

  const handleDeleteServer = async (serverId: string) => {
    if (!window.confirm('Are you sure you want to delete this MCP server?')) {
      return;
    }

    try {
      await api.delete(`/mcp/${serverId}`);
      showSnackbar('MCP server deleted successfully', 'success');
      loadData();
    } catch (error) {
      console.error('Error deleting server:', error);
      showSnackbar('Failed to delete MCP server', 'error');
    }
  };

  const handleToggleServer = async (serverId: string, enabled: boolean) => {
    try {
      const endpoint = enabled ? 'start' : 'stop';
      await api.post(`/mcp/${serverId}/${endpoint}`);
      showSnackbar(`MCP server ${enabled ? 'started' : 'stopped'} successfully`, 'success');
      loadData();
    } catch (error) {
      console.error('Error toggling server:', error);
      showSnackbar(`Failed to ${enabled ? 'start' : 'stop'} MCP server`, 'error');
    }
  };

  const handleShowConfig = async (serverId: string) => {
    try {
      const response = await api.get(`/mcp/${serverId}/config`);
      setSelectedConfig(response.data);
      setSelectedServerId(serverId);
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
    } catch (error) {
      console.error('Error getting server config:', error);
      showSnackbar('Failed to get server configuration', 'error');
    }
  };

  const handleSaveInstructions = async () => {
    if (!selectedServerId) return;
    
    try {
      await api.put(`/mcp/${selectedServerId}`, { instructions: instructionsText });
      showSnackbar('Instructions updated successfully', 'success');
      setEditingInstructions(false);
      
      // Update the config in state
      if (selectedConfig) {
        setSelectedConfig({
          ...selectedConfig,
          instructions: instructionsText
        });
      }
      
      // Reload data to refresh the list
      loadData();
    } catch (error) {
      console.error('Error updating instructions:', error);
      showSnackbar('Failed to update instructions', 'error');
    }
  };

  const handleSaveToolDescriptions = async () => {
    if (!selectedServerId) return;
    
    try {
      // Combine tool descriptions and parameter descriptions
      const combinedDescriptions: Record<string, any> = {
        ...toolDescriptions,
        search_knowledge_base_params: parameterDescriptions
      };
      
      await api.put(`/mcp/${selectedServerId}/tool-descriptions`, { 
        tool_descriptions: combinedDescriptions 
      });
      showSnackbar('Tool descriptions updated successfully', 'success');
      setEditingToolDescriptions(false);
      
      // Update the config in state
      if (selectedConfig) {
        setSelectedConfig({
          ...selectedConfig,
          tool_descriptions: combinedDescriptions
        });
      }
      
      // Reload data to refresh the list
      loadData();
    } catch (error) {
      console.error('Error updating tool descriptions:', error);
      showSnackbar('Failed to update tool descriptions', 'error');
    }
  };

  const copyConfigToClipboard = () => {
    if (selectedConfig) {
      const config = configTab === 'cline' ? selectedConfig.configs.cline : selectedConfig.configs.claude;
      const configText = JSON.stringify({
        [selectedConfig.server_name]: config
      }, null, 2);
      navigator.clipboard.writeText(configText);
      showSnackbar('Configuration copied to clipboard', 'success');
    }
  };

  const resetForm = () => {
    setFormData({
      kb_id: '',
      kb_ids: [],
      server_name: '',
      description: '',
      instructions: '',
      port: ''
    });
    setServerType('single');
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <Typography>Loading MCP servers...</Typography>
      </Box>
    );
  }

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" component="h1">
          MCP Server Management
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setCreateDialogOpen(true)}
        >
          Create MCP Server
        </Button>
      </Box>

      <Typography variant="body1" color="text.secondary" mb={3}>
        Create and manage MCP (Model Context Protocol) servers for your knowledge bases. 
        These servers can be used with Cline and other MCP-compatible tools to query your knowledge bases.
      </Typography>

      {servers.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="h6" color="text.secondary" mb={2}>
            No MCP servers configured
          </Typography>
          <Typography variant="body2" color="text.secondary" mb={3}>
            Create your first MCP server to enable external access to your knowledge bases.
          </Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setCreateDialogOpen(true)}
          >
            Create MCP Server
          </Button>
        </Paper>
      ) : (
        <Box 
          display="grid" 
          gridTemplateColumns="repeat(auto-fill, minmax(350px, 1fr))" 
          gap={3}
        >
          {servers.map((server) => (
            <Card key={server.id}>
              <CardContent>
                <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
                  <Typography variant="h6" component="h2">
                    {server.server_name}
                  </Typography>
                  <Box>
                    <Tooltip title="Show Configuration">
                      <IconButton
                        size="small"
                        onClick={() => handleShowConfig(server.id)}
                      >
                        <SettingsIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title={server.server_name.endsWith(' - assigned') ? 'Cannot delete default assigned server' : 'Delete Server'}>
                      <span>
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => handleDeleteServer(server.id)}
                          disabled={server.server_name.endsWith(' - assigned')}
                        >
                          <DeleteIcon />
                        </IconButton>
                      </span>
                    </Tooltip>
                  </Box>
                </Box>

                <Typography variant="body2" color="text.secondary" mb={2}>
                  {server.description}
                </Typography>

                <Box mb={2}>
                  <Chip
                    label={server.status === 'error' ? 'Error' : server.enabled ? 'Running' : 'Stopped'}
                    color={server.status === 'error' ? 'error' : server.enabled ? 'success' : 'default'}
                    size="small"
                    sx={{ mr: 1 }}
                  />
                  <Chip
                    label={`Port ${server.port}`}
                    variant="outlined"
                    size="small"
                    sx={{ mr: 1 }}
                  />
                  {server.type === 'multi_kb' && (
                    <Chip
                      label="Multi-KB"
                      color="primary"
                      variant="outlined"
                      size="small"
                      sx={{ mr: 1 }}
                    />
                  )}
                  {server.server_name.endsWith(' - assigned') && (
                    <Chip
                      label="Default"
                      color="primary"
                      variant="outlined"
                      size="small"
                    />
                  )}
                </Box>

                {server.error_message && (
                  <Alert severity="error" sx={{ mb: 2, fontSize: '0.75rem' }}>
                    {server.error_message}
                  </Alert>
                )}

                <Box mb={2}>
                  <Typography variant="caption" color="text.secondary">
                    Knowledge Bases:
                  </Typography>
                  <Box mt={1}>
                    {server.type === 'multi_kb' ? (
                      server.kb_names?.map((name, index) => {
                        const kbId = server.kb_ids?.[index];
                        const kb = knowledgeBases.find(k => k.id === kbId);
                        return (
                          <Chip
                            key={index}
                            label={name}
                            size="small"
                            variant="outlined"
                            clickable={!!kb}
                            onClick={() => {
                              if (kb) {
                                // Navigate to knowledge base detail page
                                window.location.href = `/#/knowledge-base/${kb.id}`;
                              }
                            }}
                            sx={{ 
                              mr: 0.5, 
                              mb: 0.5,
                              cursor: kb ? 'pointer' : 'default',
                              '&:hover': kb ? {
                                backgroundColor: 'action.hover'
                              } : {}
                            }}
                          />
                        );
                      })
                    ) : (
                      <Chip
                        label={server.kb_name || 'Unknown'}
                        size="small"
                        variant="outlined"
                        clickable={!!server.kb_id}
                        onClick={() => {
                          if (server.kb_id) {
                            // Navigate to knowledge base detail page
                            window.location.href = `/#/knowledge-base/${server.kb_id}`;
                          }
                        }}
                        sx={{
                          cursor: server.kb_id ? 'pointer' : 'default',
                          '&:hover': server.kb_id ? {
                            backgroundColor: 'action.hover'
                          } : {}
                        }}
                      />
                    )}
                  </Box>
                </Box>

                <Typography variant="caption" color="text.secondary" display="block" mb={2}>
                  Created: {formatDate(server.created_date)}
                </Typography>

                <Box display="flex" justifyContent="space-between" alignItems="center">
                  <FormControlLabel
                    control={
                      <Switch
                        checked={server.enabled}
                        onChange={(e) => handleToggleServer(server.id, e.target.checked)}
                        size="small"
                      />
                    }
                    label={server.enabled ? 'Running' : 'Stopped'}
                  />
                  <Typography variant="caption" color="text.secondary">
                    {server.base_url}
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          ))}
        </Box>
      )}

      {/* Create Server Dialog */}
      <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Create MCP Server</DialogTitle>
        <DialogContent>
          <Box mb={3}>
            <FormControl fullWidth margin="normal">
              <InputLabel>Server Type</InputLabel>
              <Select
                value={serverType}
                onChange={(e) => setServerType(e.target.value as 'single' | 'multi')}
                label="Server Type"
              >
                <MenuItem value="single">Single Knowledge Base</MenuItem>
                <MenuItem value="multi">Multiple Knowledge Bases</MenuItem>
              </Select>
            </FormControl>
          </Box>

          {serverType === 'single' ? (
            <FormControl fullWidth margin="normal">
              <InputLabel>Knowledge Base</InputLabel>
              <Select
                value={formData.kb_id}
                onChange={(e) => setFormData({ ...formData, kb_id: e.target.value })}
                label="Knowledge Base"
              >
                {knowledgeBases.map((kb) => (
                  <MenuItem key={kb.id} value={kb.id}>
                    {kb.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          ) : (
            <FormControl fullWidth margin="normal">
              <InputLabel>Knowledge Bases</InputLabel>
              <Select
                multiple
                value={formData.kb_ids}
                onChange={(e) => setFormData({ ...formData, kb_ids: e.target.value as string[] })}
                label="Knowledge Bases"
                renderValue={(selected) => (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {(selected as string[]).map((value) => {
                      const kb = knowledgeBases.find(k => k.id === value);
                      return <Chip key={value} label={kb?.name || value} size="small" />;
                    })}
                  </Box>
                )}
              >
                {knowledgeBases.map((kb) => (
                  <MenuItem key={kb.id} value={kb.id}>
                    {kb.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}

          <TextField
            fullWidth
            margin="normal"
            label="Server Name"
            value={formData.server_name}
            onChange={(e) => setFormData({ ...formData, server_name: e.target.value })}
            required
          />

          <TextField
            fullWidth
            margin="normal"
            label="Description"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            multiline
            rows={2}
          />

          <TextField
            fullWidth
            margin="normal"
            label="Instructions"
            value={formData.instructions}
            onChange={(e) => setFormData({ ...formData, instructions: e.target.value })}
            multiline
            rows={3}
            helperText="Instructions for how to use this MCP server"
          />

          <TextField
            fullWidth
            margin="normal"
            label="Port (optional)"
            value={formData.port}
            onChange={(e) => setFormData({ ...formData, port: e.target.value })}
            type="number"
            helperText="Leave empty to auto-assign a port"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleCreateServer}
            variant="contained"
            disabled={
              !formData.server_name ||
              (serverType === 'single' && !formData.kb_id) ||
              (serverType === 'multi' && formData.kb_ids.length === 0)
            }
          >
            Create Server
          </Button>
        </DialogActions>
      </Dialog>

      {/* Configuration Dialog */}
      <Dialog open={configDialogOpen} onClose={() => setConfigDialogOpen(false)} maxWidth="md" fullWidth>
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
          {selectedConfig && (
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
                        [selectedConfig.server_name]: selectedConfig.configs.cline
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
                        [selectedConfig.server_name]: selectedConfig.configs.claude
                      }, null, 2)}
                    </pre>
                  </Paper>
                </Box>
              )}

              <Accordion>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography variant="subtitle1">Server Details & Instructions</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Box>
                    <Typography variant="body2" component="div" mb={2}>
                      <strong>Base URL:</strong> {selectedConfig.base_url}
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
                                setInstructionsText(selectedConfig.instructions);
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
                        <Paper sx={{ p: 2, bgcolor: 'grey.50' }}>
                          <Typography variant="body2" style={{ whiteSpace: 'pre-wrap' }}>
                            {selectedConfig.instructions || 'No instructions provided'}
                          </Typography>
                        </Paper>
                      )}
                    </Box>
                  </Box>
                </AccordionDetails>
              </Accordion>

              <Accordion>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography variant="subtitle1">Tool Descriptions</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Box>
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
                              const descriptions = selectedConfig.tool_descriptions || {};
                              const defaults = selectedConfig.default_tool_descriptions || {};
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
                        <Paper sx={{ p: 2, bgcolor: 'grey.50', mb: 1 }}>
                          <Typography variant="caption" color="text.secondary" display="block">
                            search_knowledge_base
                          </Typography>
                          <Typography variant="body2">
                            {toolDescriptions.search_knowledge_base || selectedConfig.default_tool_descriptions?.search_knowledge_base || 'No description'}
                          </Typography>
                        </Paper>
                        <Paper sx={{ p: 2, bgcolor: 'grey.50', mb: 1 }}>
                          <Typography variant="caption" color="text.secondary" display="block">
                            get_knowledge_base_info
                          </Typography>
                          <Typography variant="body2">
                            {toolDescriptions.get_knowledge_base_info || selectedConfig.default_tool_descriptions?.get_knowledge_base_info || 'No description'}
                          </Typography>
                        </Paper>
                        <Paper sx={{ p: 2, bgcolor: 'grey.50', mb: 2 }}>
                          <Typography variant="caption" color="text.secondary" display="block">
                            list_documents
                          </Typography>
                          <Typography variant="body2">
                            {toolDescriptions.list_documents || selectedConfig.default_tool_descriptions?.list_documents || 'No description'}
                          </Typography>
                        </Paper>
                        
                        <Typography variant="subtitle2" sx={{ mb: 1 }}>
                          Parameter Descriptions (search_knowledge_base):
                        </Typography>
                        <Paper sx={{ p: 2, bgcolor: 'grey.50', mb: 1 }}>
                          <Typography variant="caption" color="text.secondary" display="block">
                            query parameter
                          </Typography>
                          <Typography variant="body2">
                            {parameterDescriptions.query || 'Search query to find relevant documents'}
                          </Typography>
                        </Paper>
                        <Paper sx={{ p: 2, bgcolor: 'grey.50' }}>
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
                </AccordionDetails>
              </Accordion>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfigDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default MCPServerManager;
