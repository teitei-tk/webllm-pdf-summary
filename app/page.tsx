'use client';

import { useState } from 'react';
import {
  Container,
  Typography,
  Card,
  CardContent,
  Button,
  Box,
  Alert,
  CircularProgress,
  Paper,
  Chip,
  Divider,
} from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import DescriptionIcon from '@mui/icons-material/Description';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile && selectedFile.type === 'application/pdf') {
      setFile(selectedFile);
      setError(null);
    } else {
      setError('PDFファイルを選択してください');
      setFile(null);
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('pdf', file);

      const response = await fetch('/api/parse-pdf', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('PDFの解析に失敗しました');
      }

      const data = await response.json();
      setResult(data.text || '解析結果が空でした');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'エラーが発生しました');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!result) return;
    await navigator.clipboard.writeText(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Typography
        variant="h1"
        component="h1"
        textAlign="center"
        gutterBottom
        sx={{ mb: 4 }}
      >
        📄 PDF要約アプリ
      </Typography>

      <Typography
        variant="body1"
        textAlign="center"
        color="text.secondary"
        sx={{ mb: 4 }}
      >
        PDFファイルをアップロードして、AIによる自動要約を行います
      </Typography>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {/* ファイル選択カード */}
        <Card>
          <CardContent>
            <Box
              sx={{
                border: '2px dashed',
                borderColor: file ? 'primary.main' : 'grey.300',
                borderRadius: 2,
                p: 4,
                textAlign: 'center',
                bgcolor: file ? 'primary.50' : 'background.paper',
                transition: 'all 0.3s',
                '&:hover': {
                  borderColor: 'primary.main',
                  bgcolor: 'primary.50',
                },
              }}
            >
              <input
                type="file"
                accept="application/pdf"
                onChange={handleFileChange}
                style={{ display: 'none' }}
                id="pdf-upload"
                data-testid="pdf-file-input"
              />
              <label htmlFor="pdf-upload" style={{ cursor: 'pointer' }}>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <CloudUploadIcon
                    sx={{ fontSize: 48, color: 'primary.main', mx: 'auto' }}
                  />
                  <Typography variant="h6" color="text.primary">
                    PDFファイルを選択してください
                  </Typography>
                  <Button
                    variant="contained"
                    component="span"
                    startIcon={<DescriptionIcon />}
                    sx={{ mx: 'auto', maxWidth: 200 }}
                  >
                    ファイルを選択
                  </Button>
                </Box>
              </label>

              {file && (
                <Box sx={{ mt: 3 }}>
                  <Chip
                    icon={<CheckCircleIcon />}
                    label={`選択中: ${file.name}`}
                    color="primary"
                    variant="outlined"
                  />
                </Box>
              )}
            </Box>
          </CardContent>
        </Card>

        {/* アップロードボタン */}
        {file && (
          <Button
            variant="contained"
            size="large"
            onClick={handleUpload}
            disabled={isLoading}
            startIcon={
              isLoading ? <CircularProgress size={20} /> : <CloudUploadIcon />
            }
            sx={{ py: 2 }}
          >
            {isLoading ? '解析中...' : 'PDFを解析する'}
          </Button>
        )}

        {/* エラー表示 */}
        {error && (
          <Alert severity="error" sx={{ borderRadius: 2 }}>
            {error}
          </Alert>
        )}

        {/* 結果表示 */}
        {result && (
          <Card>
            <CardContent>
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  mb: 2,
                }}
              >
                <Typography variant="h5" component="h2">
                  解析結果
                </Typography>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={handleCopy}
                  startIcon={copied ? <CheckCircleIcon /> : <ContentCopyIcon />}
                  color={copied ? 'success' : 'primary'}
                >
                  {copied ? 'コピー完了' : 'コピー'}
                </Button>
              </Box>
              <Divider sx={{ mb: 2 }} />
              <Paper
                variant="outlined"
                sx={{
                  p: 2,
                  bgcolor: 'background.default',
                  maxHeight: 400,
                  overflow: 'auto',
                }}
              >
                <Typography
                  variant="body2"
                  component="pre"
                  sx={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}
                >
                  {result}
                </Typography>
              </Paper>
            </CardContent>
          </Card>
        )}
      </Box>
    </Container>
  );
}