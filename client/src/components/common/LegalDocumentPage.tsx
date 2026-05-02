import React, { useEffect, useState } from 'react';
import { Alert, Container, Link, Paper, Typography } from '@mui/material';

interface LegalDocumentPageProps {
  title: string;
  textUrl: string;
  downloadUrl: string;
}

const LegalDocumentPage: React.FC<LegalDocumentPageProps> = ({ title, textUrl, downloadUrl }) => {
  const [content, setContent] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let isMounted = true;
    fetch(textUrl)
      .then((res) => {
        if (!res.ok) {
          throw new Error(`Не удалось загрузить документ (${res.status})`);
        }
        return res.text();
      })
      .then((text) => {
        if (isMounted) {
          setContent(text);
        }
      })
      .catch((e: unknown) => {
        if (isMounted) {
          setError(e instanceof Error ? e.message : 'Не удалось загрузить документ');
        }
      });

    return () => {
      isMounted = false;
    };
  }, [textUrl]);

  return (
    <Container maxWidth="md" sx={{ py: 6 }}>
      <Paper sx={{ p: 4 }}>
        <Typography variant="h4" gutterBottom>
          {title}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Актуальная редакция документа размещена на этой странице.
          {' '}
          <Link href={downloadUrl} target="_blank" rel="noopener noreferrer">
            Скачать .docx
          </Link>
        </Typography>
        {error ? (
          <Alert severity="error">{error}</Alert>
        ) : (
          <Typography variant="body2" sx={{ whiteSpace: 'pre-line' }}>
            {content}
          </Typography>
        )}
      </Paper>
    </Container>
  );
};

export default LegalDocumentPage;
