'use client';

import { useState, useEffect, useRef } from 'react';
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
  ThemeProvider,
  createTheme,
  CssBaseline,
  LinearProgress,
  Tabs,
  Tab,
} from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import DescriptionIcon from '@mui/icons-material/Description';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import { useWebLLM } from './hooks/useWebLLM';

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#dc004e',
    },
  },
  typography: {
    fontFamily: [
      '-apple-system',
      'BlinkMacSystemFont',
      '"Segoe UI"',
      'Roboto',
      '"Helvetica Neue"',
      'Arial',
      'sans-serif',
    ].join(','),
  },
});

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [extractedText, setExtractedText] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState(0);

  const {
    isInitializing,
    isInitialized,
    isSummarizing,
    error: llmError,
    initProgress,
    initializeEngine,
    summarizeText,
    resetEngine,
  } = useWebLLM();

  // Track if initialization has been attempted
  const initAttempted = useRef(false);

  // Initialize WebLLM on component mount (only once)
  useEffect(() => {
    if (!initAttempted.current) {
      initAttempted.current = true;
      initializeEngine();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty dependency array to run only once

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile && selectedFile.type === 'application/pdf') {
      setFile(selectedFile);
      setError(null);
      setExtractedText(null);
      setSummary(null);
      setActiveTab(0);
    } else {
      setError('PDFファイルを選択してください');
      setFile(null);
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setIsLoading(true);
    setError(null);
    setExtractedText(null);
    setSummary(null);

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
      const text = data.text || '解析結果が空でした';
      setExtractedText(text);

      // Automatically generate summary if WebLLM is ready
      if (isInitialized && text.trim().length > 0) {
        try {
          const summaryResult = await summarizeText(text, {
            language: 'ja',
            maxLength: 500,
          });
          setSummary(summaryResult);
          setActiveTab(1); // Switch to summary tab
        } catch (summaryError) {
          console.error('Summary generation failed:', summaryError);
          // Don't throw here, just show the extracted text
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'エラーが発生しました');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateSummary = async () => {
    if (!extractedText || !isInitialized) return;

    try {
      const summaryResult = await summarizeText(extractedText, {
        language: 'ja',
        maxLength: 500,
      });
      setSummary(summaryResult);
      setActiveTab(1);
    } catch (err) {
      setError(err instanceof Error ? err.message : '要約の生成に失敗しました');
    }
  };

  const handleCopy = async () => {
    const textToCopy = activeTab === 0 ? extractedText : summary;
    if (!textToCopy) return;
    await navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
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
          sx={{ mb: 2 }}
        >
          PDFファイルをアップロードして、AIによる自動要約を行います
        </Typography>

        {/* WebLLM初期化状態 */}
        {isInitializing && (
          <Box sx={{ mb: 3 }}>
            <Alert severity="info" sx={{ borderRadius: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <CircularProgress size={20} />
                <Typography variant="body2">{initProgress}</Typography>
              </Box>
              <LinearProgress sx={{ mt: 1 }} />
            </Alert>
          </Box>
        )}

        {isInitialized && !isInitializing && (
          <Box sx={{ mb: 3 }}>
            <Alert severity="success" sx={{ borderRadius: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <SmartToyIcon />
                <Typography variant="body2">
                  AI モデルが準備完了しました
                </Typography>
              </Box>
            </Alert>
          </Box>
        )}

        {llmError && (
          <Box sx={{ mb: 3 }}>
            <Alert
              severity="warning"
              sx={{ borderRadius: 2 }}
              action={
                <Button
                  color="inherit"
                  size="small"
                  onClick={() => {
                    resetEngine();
                    initAttempted.current = false;
                    setTimeout(() => initializeEngine(), 100);
                  }}
                >
                  再試行
                </Button>
              }
            >
              AI初期化エラー: {llmError}
            </Alert>
          </Box>
        )}

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
                  <Box
                    sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}
                  >
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
            <Box sx={{ display: 'flex', gap: 2 }}>
              <Button
                variant="contained"
                size="large"
                onClick={handleUpload}
                disabled={isLoading || isSummarizing}
                startIcon={
                  isLoading ? (
                    <CircularProgress size={20} />
                  ) : (
                    <CloudUploadIcon />
                  )
                }
                sx={{ py: 2, flexGrow: 1 }}
              >
                {isLoading ? '解析中...' : 'PDFを解析・要約する'}
              </Button>

              {extractedText && !summary && isInitialized && (
                <Button
                  variant="outlined"
                  size="large"
                  onClick={handleGenerateSummary}
                  disabled={isSummarizing}
                  startIcon={
                    isSummarizing ? (
                      <CircularProgress size={20} />
                    ) : (
                      <SmartToyIcon />
                    )
                  }
                  sx={{ py: 2 }}
                >
                  {isSummarizing ? '要約中...' : '要約生成'}
                </Button>
              )}
            </Box>
          )}

          {/* エラー表示 */}
          {error && (
            <Alert severity="error" sx={{ borderRadius: 2 }}>
              {error}
            </Alert>
          )}

          {/* 結果表示 */}
          {(extractedText || summary) && (
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
                    結果
                  </Typography>
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={handleCopy}
                    startIcon={
                      copied ? <CheckCircleIcon /> : <ContentCopyIcon />
                    }
                    color={copied ? 'success' : 'primary'}
                  >
                    {copied ? 'コピー完了' : 'コピー'}
                  </Button>
                </Box>

                {/* タブ */}
                <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
                  <Tabs value={activeTab} onChange={handleTabChange}>
                    <Tab label="抽出テキスト" />
                    <Tab
                      label={
                        <Box
                          sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
                        >
                          <SmartToyIcon fontSize="small" />
                          AI要約
                          {isSummarizing && <CircularProgress size={16} />}
                        </Box>
                      }
                      disabled={!summary && !isSummarizing}
                    />
                  </Tabs>
                </Box>

                {/* タブコンテンツ */}
                <Paper
                  variant="outlined"
                  sx={{
                    p: 2,
                    bgcolor: 'background.default',
                    maxHeight: 400,
                    overflow: 'auto',
                  }}
                >
                  {activeTab === 0 && extractedText && (
                    <Typography
                      variant="body2"
                      component="pre"
                      sx={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}
                    >
                      {extractedText}
                    </Typography>
                  )}

                  {activeTab === 1 && (
                    <>
                      {isSummarizing && (
                        <Box sx={{ textAlign: 'center', py: 4 }}>
                          <CircularProgress />
                          <Typography variant="body2" sx={{ mt: 2 }}>
                            {initProgress || 'AIが要約を生成しています...'}
                          </Typography>
                          {initProgress && initProgress.includes('パート') && (
                            <LinearProgress
                              sx={{ mt: 2, width: '80%', mx: 'auto' }}
                            />
                          )}
                        </Box>
                      )}

                      {summary && !isSummarizing && (
                        <Typography
                          variant="body1"
                          sx={{
                            whiteSpace: 'pre-wrap',
                            lineHeight: 1.7,
                            fontSize: '1.1rem',
                          }}
                        >
                          {summary}
                        </Typography>
                      )}

                      {!summary && !isSummarizing && extractedText && (
                        <Box sx={{ textAlign: 'center', py: 4 }}>
                          <Typography variant="body2" color="text.secondary">
                            要約を生成するには「要約生成」ボタンをクリックしてください
                          </Typography>
                        </Box>
                      )}
                    </>
                  )}
                </Paper>
              </CardContent>
            </Card>
          )}
        </Box>
      </Container>
    </ThemeProvider>
  );
}
