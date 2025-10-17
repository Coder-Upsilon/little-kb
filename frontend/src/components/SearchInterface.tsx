import React, { useState, useEffect } from 'react';
import {
  Container,
  Box,
  Typography,
  TextField,
  Button,
  Card,
  CardContent,
  List,
  ListItem,
  Chip,
  Alert,
  CircularProgress,
  InputAdornment,
  Slider,
  Divider,
} from '@mui/material';
import {
  Search as SearchIcon,
  Clear as ClearIcon,
  InsertDriveFile as FileIcon,
} from '@mui/icons-material';
import { searchApi, KnowledgeBase, SearchResponse, SearchResult } from '../services/api';

interface Props {
  knowledgeBase: KnowledgeBase;
  onBack: () => void;
  embedded?: boolean;
}

const SearchInterface: React.FC<Props> = ({ knowledgeBase, onBack, embedded = false }) => {
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [limit, setLimit] = useState(10);
  const [searchStats, setSearchStats] = useState<any>(null);

  useEffect(() => {
    loadSearchStats();
  }, [knowledgeBase.id]);

  const loadSearchStats = async () => {
    try {
      const stats = await searchApi.getStats(knowledgeBase.id);
      setSearchStats(stats);
    } catch (err) {
      console.error('Error loading search stats:', err);
    }
  };

  const handleSearch = async () => {
    if (!query.trim()) return;

    try {
      setLoading(true);
      setError(null);
      
      const results = await searchApi.search(knowledgeBase.id, {
        query: query.trim(),
        kb_id: knowledgeBase.id,
        limit,
      });
      
      setSearchResults(results);
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || 'Search failed');
      console.error('Search error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const handleClear = () => {
    setQuery('');
    setSearchResults(null);
    setError(null);
  };

  const formatSimilarityScore = (score: number) => {
    return (score * 100).toFixed(1) + '%';
  };

  const getScoreColor = (score: number) => {
    if (score >= 0.8) return 'success';
    if (score >= 0.6) return 'warning';
    return 'default';
  };

  const highlightText = (text: string, query: string) => {
    if (!query.trim()) return text;
    
    const words = query.trim().split(/\s+/);
    let highlightedText = text;
    
    words.forEach(word => {
      // Escape special regex characters
      const escapedWord = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`(${escapedWord})`, 'gi');
      highlightedText = highlightedText.replace(regex, '<mark>$1</mark>');
    });
    
    return highlightedText;
  };

  return (
    <Container maxWidth="lg">
      <Box sx={{ mt: embedded ? 0 : 4, mb: embedded ? 0 : 4 }}>
        {!embedded && (
          <>
            <Typography variant="h4" component="h1" gutterBottom>
              Search in {knowledgeBase.name}
            </Typography>

            {knowledgeBase.description && (
              <Typography variant="body1" color="text.secondary" paragraph>
                {knowledgeBase.description}
              </Typography>
            )}

            {/* Search Stats */}
            {searchStats && (
              <Card sx={{ mb: 3 }}>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Search Statistics
                  </Typography>
                  <Box display="flex" gap={4} flexWrap="wrap">
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        Total Documents
                      </Typography>
                      <Typography variant="h6">
                        {searchStats.total_documents || 0}
                      </Typography>
                    </Box>
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        Searchable Chunks
                      </Typography>
                      <Typography variant="h6">
                        {searchStats.total_chunks || 0}
                      </Typography>
                    </Box>
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        Status
                      </Typography>
                      <Chip
                        label={searchStats.searchable ? 'Ready' : 'Not Ready'}
                        color={searchStats.searchable ? 'success' : 'error'}
                        size="small"
                      />
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            )}
          </>
        )}

        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* Search Input */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Box display="flex" gap={2} alignItems="flex-start">
              <TextField
                fullWidth
                label="Search query"
                placeholder="Enter your search query..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyPress={handleKeyPress}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon />
                    </InputAdornment>
                  ),
                  endAdornment: query && (
                    <InputAdornment position="end">
                      <Button
                        size="small"
                        onClick={handleClear}
                        startIcon={<ClearIcon />}
                      >
                        Clear
                      </Button>
                    </InputAdornment>
                  ),
                }}
              />
              <Button
                variant="contained"
                onClick={handleSearch}
                disabled={!query.trim() || loading}
                sx={{ minWidth: 120, height: 56 }}
              >
                {loading ? <CircularProgress size={20} /> : 'Search'}
              </Button>
            </Box>

            {/* Search Options */}
            <Box sx={{ mt: 2, display: 'flex', gap: 2, alignItems: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                Max Results:
              </Typography>
              <Box sx={{ width: 200 }}>
                <Slider
                  value={limit}
                  onChange={(_, value) => setLimit(value as number)}
                  min={5}
                  max={50}
                  step={5}
                  marks={[
                    { value: 5, label: '5' },
                    { value: 25, label: '25' },
                    { value: 50, label: '50' },
                  ]}
                  valueLabelDisplay="auto"
                />
              </Box>
            </Box>
          </CardContent>
        </Card>

        {/* Search Results */}
        {searchResults && (
          <Card>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="h6">
                  Search Results ({searchResults.total_results})
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Found in {searchResults.processing_time}s
                </Typography>
              </Box>

              {searchResults.total_results === 0 ? (
                <Box textAlign="center" py={4}>
                  <Typography variant="body1" color="text.secondary" gutterBottom>
                    No results found for "{searchResults.query}"
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Try different keywords or check your spelling
                  </Typography>
                </Box>
              ) : (
                <List>
                  {searchResults.results.map((result, index) => (
                    <React.Fragment key={index}>
                      <ListItem alignItems="flex-start" sx={{ px: 0 }}>
                        <Box sx={{ width: '100%' }}>
                          <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={1}>
                            <Box display="flex" alignItems="center" gap={1}>
                              <FileIcon color="primary" />
                              <Typography variant="subtitle1" fontWeight="medium">
                                {result.filename}
                              </Typography>
                              <Chip
                                label={result.file_type.toUpperCase()}
                                size="small"
                                variant="outlined"
                              />
                            </Box>
                            <Chip
                              label={formatSimilarityScore(result.similarity_score)}
                              size="small"
                              color={getScoreColor(result.similarity_score) as any}
                            />
                          </Box>
                          
                          <Typography
                            variant="body2"
                            color="text.secondary"
                            sx={{
                              mb: 1,
                              '& mark': {
                                backgroundColor: 'yellow',
                                padding: '0 2px',
                                borderRadius: '2px',
                              },
                            }}
                            dangerouslySetInnerHTML={{
                              __html: highlightText(result.content, query),
                            }}
                          />
                          
                          <Typography variant="caption" color="text.secondary">
                            Chunk {result.chunk_index + 1} • Similarity: {formatSimilarityScore(result.similarity_score)}
                          </Typography>
                        </Box>
                      </ListItem>
                      {index < searchResults.results.length - 1 && <Divider />}
                    </React.Fragment>
                  ))}
                </List>
              )}
            </CardContent>
          </Card>
        )}

        {/* Search Tips */}
        {!searchResults && (
          <Card sx={{ mt: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Search Tips
              </Typography>
              <Typography variant="body2" component="div">
                • Use natural language queries for best results
              </Typography>
              <Typography variant="body2" component="div">
                • Try different phrasings if you don't find what you're looking for
              </Typography>
              <Typography variant="body2" component="div">
                • Search is semantic - it understands meaning, not just keywords
              </Typography>
              <Typography variant="body2" component="div">
                • Results are ranked by relevance and similarity
              </Typography>
            </CardContent>
          </Card>
        )}
      </Box>
    </Container>
  );
};

export default SearchInterface;
