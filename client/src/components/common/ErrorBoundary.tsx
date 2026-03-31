import React from 'react';
import { Box, Button, Paper, Typography } from '@mui/material';

type ErrorBoundaryState = { hasError: boolean; error?: any };

export class ErrorBoundary extends React.Component<React.PropsWithChildren<{}>, ErrorBoundaryState> {
  constructor(props: React.PropsWithChildren<{}>) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  handleReload = () => {
    try {
      window.location.reload();
    } catch {
      this.setState({ hasError: false, error: undefined });
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <Box sx={{ p: 3, display: 'flex', justifyContent: 'center' }}>
          <Paper sx={{ p: 4, maxWidth: 600, textAlign: 'center' }}>
            <Typography variant="h5" sx={{ mb: 1 }}>Что-то пошло не так</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Попробуйте обновить страницу. Если ошибка повторяется, сообщите нам.
            </Typography>
            <Button variant="contained" onClick={this.handleReload}>Обновить</Button>
          </Paper>
        </Box>
      );
    }
    return this.props.children as React.ReactElement;
  }
}


