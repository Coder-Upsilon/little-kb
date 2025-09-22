import axios from 'axios';

const API_BASE_URL = 'http://localhost:8000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Knowledge Base Types
export interface KnowledgeBase {
  id: string;
  name: string;
  description?: string;
  created_date: string;
  file_count: number;
}

export interface KnowledgeBaseCreate {
  name: string;
  description?: string;
}

export interface Document {
  id: string;
  filename: string;
  file_path: string;
  kb_id: string;
  file_type: string;
  file_size: number;
  processed_date: string;
  chunk_count: number;
}

export interface SearchQuery {
  query: string;
  kb_id: string;
  limit?: number;
}

export interface SearchResult {
  content: string;
  filename: string;
  file_type: string;
  similarity_score: number;
  chunk_index: number;
}

export interface SearchResponse {
  query: string;
  results: SearchResult[];
  total_results: number;
  processing_time: number;
}

// Knowledge Base API
export const knowledgeBaseApi = {
  // List all knowledge bases
  list: async (): Promise<KnowledgeBase[]> => {
    const response = await api.get('/knowledge-bases/');
    return response.data;
  },

  // Create a new knowledge base
  create: async (data: KnowledgeBaseCreate): Promise<KnowledgeBase> => {
    const response = await api.post('/knowledge-bases/', data);
    return response.data;
  },

  // Get a specific knowledge base
  get: async (id: string): Promise<KnowledgeBase> => {
    const response = await api.get(`/knowledge-bases/${id}`);
    return response.data;
  },

  // Update a knowledge base
  update: async (id: string, data: Partial<KnowledgeBaseCreate>): Promise<KnowledgeBase> => {
    const response = await api.put(`/knowledge-bases/${id}`, data);
    return response.data;
  },

  // Delete a knowledge base
  delete: async (id: string): Promise<void> => {
    await api.delete(`/knowledge-bases/${id}`);
  },

  // Get knowledge base statistics
  getStats: async (id: string): Promise<any> => {
    const response = await api.get(`/knowledge-bases/${id}/stats`);
    return response.data;
  },

  // Reindex a knowledge base
  reindex: async (id: string): Promise<any> => {
    const response = await api.post(`/knowledge-bases/${id}/reindex`);
    return response.data;
  },
};

// Files API
export const filesApi = {
  // Upload a file to a knowledge base
  upload: async (kbId: string, file: File): Promise<Document> => {
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await api.post(`/files/${kbId}/upload`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  // List documents in a knowledge base
  list: async (kbId: string): Promise<Document[]> => {
    const response = await api.get(`/files/${kbId}/documents`);
    return response.data;
  },

  // Get a specific document
  get: async (documentId: string): Promise<Document> => {
    const response = await api.get(`/files/document/${documentId}`);
    return response.data;
  },

  // Delete a document
  delete: async (documentId: string): Promise<void> => {
    await api.delete(`/files/document/${documentId}`);
  },

  // Reprocess a document
  reprocess: async (documentId: string): Promise<any> => {
    const response = await api.post(`/files/document/${documentId}/reprocess`);
    return response.data;
  },

  // Get supported file formats
  getSupportedFormats: async (kbId: string): Promise<any> => {
    const response = await api.get(`/files/${kbId}/supported-formats`);
    return response.data;
  },
};

// Search API
export const searchApi = {
  // Search in a knowledge base
  search: async (kbId: string, query: SearchQuery): Promise<SearchResponse> => {
    const response = await api.post(`/search/${kbId}`, query);
    return response.data;
  },

  // Simple GET search
  searchGet: async (kbId: string, query: string, limit: number = 10): Promise<SearchResponse> => {
    const response = await api.get(`/search/${kbId}`, {
      params: { q: query, limit }
    });
    return response.data;
  },

  // Find similar documents
  findSimilar: async (kbId: string, documentId: string, limit: number = 5): Promise<any> => {
    const response = await api.get(`/search/${kbId}/similar/${documentId}`, {
      params: { limit }
    });
    return response.data;
  },

  // Get search statistics
  getStats: async (kbId: string): Promise<any> => {
    const response = await api.get(`/search/${kbId}/stats`);
    return response.data;
  },

  // Batch search
  batchSearch: async (kbId: string, queries: string[], limit: number = 10): Promise<any> => {
    const response = await api.post(`/search/${kbId}/batch-search`, queries, {
      params: { limit }
    });
    return response.data;
  },
};

export default api;
