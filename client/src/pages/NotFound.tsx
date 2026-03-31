import React from 'react';
import { Box, Button, Paper, Typography } from '@mui/material';

const NotFound: React.FC = () => {
  return (
    <Box sx={{ p: 3, display: 'flex', justifyContent: 'center' }}>
      <Paper sx={{ p: 4, width: '100%', maxWidth: 520, textAlign: 'center' }}>
        <Typography variant="h4" sx={{ mb: 1 }}>Страница не найдена</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Проверьте адрес или вернитесь на главную.
        </Typography>
        <Button href="/" variant="contained">На главную</Button>
      </Paper>
    </Box>
  );
};

export default NotFound;


