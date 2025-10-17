import React from 'react';
import { Box, Typography, LinearProgress, CircularProgress } from '@mui/material';

interface LoadingScreenProps {
  percent: number;
  message: string;
}

const LoadingScreen: React.FC<LoadingScreenProps> = ({ percent, message }) => {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        width: '100vw',
        backgroundColor: '#f5f5f5',
      }}
    >
      <Box
        sx={{
          textAlign: 'center',
          maxWidth: 500,
          width: '80%',
        }}
      >
        <Typography variant="h4" component="h1" gutterBottom sx={{ mb: 4, color: '#1976d2' }}>
          Little KB
        </Typography>
        
        <Box sx={{ mb: 3 }}>
          <CircularProgress
            variant="determinate"
            value={percent}
            size={80}
            thickness={4}
            sx={{ color: '#1976d2' }}
          />
        </Box>
        
        <Typography variant="h6" gutterBottom sx={{ mb: 2, color: '#666' }}>
          {percent}%
        </Typography>
        
        <Box sx={{ width: '100%', mb: 2 }}>
          <LinearProgress
            variant="determinate"
            value={percent}
            sx={{
              height: 8,
              borderRadius: 4,
              backgroundColor: '#e0e0e0',
              '& .MuiLinearProgress-bar': {
                backgroundColor: '#1976d2',
                borderRadius: 4,
              },
            }}
          />
        </Box>
        
        <Typography variant="body1" color="text.secondary" sx={{ mt: 2 }}>
          {message}
        </Typography>
      </Box>
    </Box>
  );
};

export default LoadingScreen;
