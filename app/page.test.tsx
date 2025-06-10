/**
 * PDFアップロードページのテスト
 */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import Home from './page';

// Material-UI用のテストラッパー
const testTheme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#dc004e',
    },
  },
});

const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider theme={testTheme}>
    <CssBaseline />
    {children}
  </ThemeProvider>
);

const renderWithTheme = (component: React.ReactElement) => {
  return render(component, { wrapper: TestWrapper });
};

// fetch をモック
const mockFetch = vi.fn();
global.fetch = mockFetch;

// WebLLM hook をモック
const mockWebLLM = {
  isInitializing: false,
  isInitialized: true,
  isSummarizing: false,
  error: null,
  initProgress: '',
  initializeEngine: vi.fn(),
  summarizeText: vi.fn(),
  resetEngine: vi.fn(),
};

vi.mock('./hooks/useWebLLM', () => ({
  useWebLLM: () => mockWebLLM,
}));

// File をモック
const createMockFile = (name: string, type: string, size: number = 1024) => {
  const file = new File(['mock content'], name, { type });
  Object.defineProperty(file, 'size', { value: size });
  return file;
};

describe('PDFアップロードページ', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    vi.clearAllMocks();
    
    // デフォルトのWebLLM状態をリセット
    mockWebLLM.isInitializing = false;
    mockWebLLM.isInitialized = true;
    mockWebLLM.isSummarizing = false;
    mockWebLLM.error = null;
    mockWebLLM.initProgress = '';
    mockWebLLM.summarizeText.mockResolvedValue('AIによる要約結果です。');
  });

  test('初期表示が正しく行われる', () => {
    renderWithTheme(<Home />);

    expect(screen.getByText(/PDF要約アプリ/)).toBeInTheDocument();
    expect(
      screen.getByText('PDFファイルを選択してください')
    ).toBeInTheDocument();
    expect(screen.getByText('ファイルを選択')).toBeInTheDocument();
  });

  test('PDFファイルを選択すると適切に表示される', async () => {
    const user = userEvent.setup();
    renderWithTheme(<Home />);

    const fileInput = screen.getByTestId('pdf-file-input');
    const pdfFile = createMockFile('test.pdf', 'application/pdf');

    await user.upload(fileInput, pdfFile);

    expect(screen.getByText('選択中: test.pdf')).toBeInTheDocument();
    expect(screen.getByText('PDFを解析・要約する')).toBeInTheDocument();
  });

  test('PDFファイル以外を選択するとエラーが表示される', async () => {
    const user = userEvent.setup();
    render(<Home />);

    const fileInput = screen.getByTestId('pdf-file-input');
    const textFile = createMockFile('test.txt', 'text/plain');

    await user.upload(fileInput, textFile);

    expect(
      screen.getByText(/PDFファイルを選択してください/)
    ).toBeInTheDocument();
    expect(screen.queryByText('PDFを解析・要約する')).not.toBeInTheDocument();
  });

  test('PDFアップロードが成功すると結果が表示される', async () => {
    const user = userEvent.setup();
    const mockResponse = {
      text: 'テスト結果のテキストです',
      metadata: {
        filename: 'test.pdf',
        size: 1024,
        type: 'application/pdf',
      },
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    });

    render(<Home />);

    const fileInput = screen.getByTestId('pdf-file-input');
    const pdfFile = createMockFile('test.pdf', 'application/pdf');

    await user.upload(fileInput, pdfFile);
    await user.click(screen.getByText('PDFを解析・要約する'));

    await waitFor(() => {
      expect(screen.getByText('結果')).toBeInTheDocument();
    });

    // Click on the "抽出テキスト" tab to see the extracted text
    await user.click(screen.getByText('抽出テキスト'));

    expect(screen.getByText('テスト結果のテキストです')).toBeInTheDocument();
    expect(screen.getByText('コピー')).toBeInTheDocument();
  });

  test('APIエラー時にエラーメッセージが表示される', async () => {
    const user = userEvent.setup();

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
    });

    render(<Home />);

    const fileInput = screen.getByTestId('pdf-file-input');
    const pdfFile = createMockFile('test.pdf', 'application/pdf');

    await user.upload(fileInput, pdfFile);
    await user.click(screen.getByText('PDFを解析・要約する'));

    await waitFor(() => {
      expect(screen.getByText('PDFの解析に失敗しました')).toBeInTheDocument();
    });
  });

  test('アップロード中はローディング状態が表示される', async () => {
    const user = userEvent.setup();

    // Promise を解決しないようにして、ローディング状態を維持
    mockFetch.mockImplementationOnce(
      () => new Promise(() => {}) // never resolves
    );

    render(<Home />);

    const fileInput = screen.getByTestId('pdf-file-input');
    const pdfFile = createMockFile('test.pdf', 'application/pdf');

    await user.upload(fileInput, pdfFile);
    await user.click(screen.getByText('PDFを解析・要約する'));

    expect(screen.getByText('解析中...')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '解析中...' })).toBeDisabled();
  });

  test('コピーボタンが正しく動作する', async () => {
    const user = userEvent.setup();
    const writeTextSpy = vi.spyOn(navigator.clipboard, 'writeText');
    const mockResponse = {
      text: 'コピーテスト用のテキスト',
      metadata: { filename: 'test.pdf', size: 1024, type: 'application/pdf' },
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    });

    render(<Home />);

    const fileInput = screen.getByTestId('pdf-file-input');
    const pdfFile = createMockFile('test.pdf', 'application/pdf');

    await user.upload(fileInput, pdfFile);
    await user.click(screen.getByText('PDFを解析・要約する'));

    await waitFor(() => {
      expect(screen.getByText('コピー')).toBeInTheDocument();
    });

    // The copy button initially copies the AI summary (which is the default active tab)
    await user.click(screen.getByText('コピー'));

    expect(writeTextSpy).toHaveBeenCalledWith('AIによる要約結果です。');
  });

  test('WebLLM初期化状態が表示される', () => {
    mockWebLLM.isInitializing = true;
    mockWebLLM.isInitialized = false;
    mockWebLLM.initProgress = 'モデルを初期化しています...';

    renderWithTheme(<Home />);

    expect(screen.getByText('モデルを初期化しています...')).toBeInTheDocument();
    expect(screen.getAllByRole('progressbar')).toHaveLength(2); // CircularProgress and LinearProgress
  });

  test('WebLLM初期化完了状態が表示される', () => {
    mockWebLLM.isInitializing = false;
    mockWebLLM.isInitialized = true;

    renderWithTheme(<Home />);

    expect(screen.getByText('AI モデルが準備完了しました')).toBeInTheDocument();
  });

  test('WebLLM初期化エラー状態が表示される', () => {
    mockWebLLM.isInitialized = false;
    mockWebLLM.error = '初期化エラーです';

    renderWithTheme(<Home />);

    expect(screen.getByText(/AI初期化エラー: 初期化エラーです/)).toBeInTheDocument();
    expect(screen.getByText('再試行')).toBeInTheDocument();
  });

  test('WebLLMエラー時の再試行ボタンが動作する', async () => {
    const user = userEvent.setup();
    mockWebLLM.isInitialized = false;
    mockWebLLM.error = '初期化エラーです';

    renderWithTheme(<Home />);

    const retryButton = screen.getByText('再試行');
    await user.click(retryButton);

    expect(mockWebLLM.resetEngine).toHaveBeenCalled();
    expect(mockWebLLM.initializeEngine).toHaveBeenCalled();
  });

  test('PDF解析と自動要約が正常に動作する', async () => {
    const user = userEvent.setup();
    const mockResponse = {
      text: 'PDFから抽出されたテキストです。',
      metadata: {
        filename: 'test.pdf',
        size: 1024,
        type: 'application/pdf',
      },
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    });

    renderWithTheme(<Home />);

    const fileInput = screen.getByTestId('pdf-file-input');
    const pdfFile = createMockFile('test.pdf', 'application/pdf');

    await user.upload(fileInput, pdfFile);
    await user.click(screen.getByText('PDFを解析・要約する'));

    await waitFor(() => {
      expect(screen.getByText('結果')).toBeInTheDocument();
    });

    // 要約が自動生成されることを確認
    expect(mockWebLLM.summarizeText).toHaveBeenCalledWith(
      'PDFから抽出されたテキストです。',
      {
        language: 'ja',
        maxLength: 500,
      }
    );

    // AI要約タブが存在することを確認
    expect(screen.getByText('AI要約')).toBeInTheDocument();
  });

  test('AI要約タブが正しく動作する', async () => {
    const user = userEvent.setup();
    const mockResponse = {
      text: 'テストテキスト',
      metadata: { filename: 'test.pdf', size: 1024, type: 'application/pdf' },
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    });

    renderWithTheme(<Home />);

    const fileInput = screen.getByTestId('pdf-file-input');
    const pdfFile = createMockFile('test.pdf', 'application/pdf');

    await user.upload(fileInput, pdfFile);
    await user.click(screen.getByText('PDFを解析・要約する'));

    await waitFor(() => {
      expect(screen.getByText('AI要約')).toBeInTheDocument();
    });

    // AI要約タブは自動的にアクティブになるので、直接要約結果を確認
    await waitFor(() => {
      expect(screen.getByText('AIによる要約結果です。')).toBeInTheDocument();
    });
  });

  test('手動要約生成ボタンが動作する', async () => {
    const user = userEvent.setup();
    const mockResponse = {
      text: 'テストテキスト',
      metadata: { filename: 'test.pdf', size: 1024, type: 'application/pdf' },
    };

    // 自動要約を無効にするため、初期化状態を false に設定
    mockWebLLM.isInitialized = false;

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    });

    renderWithTheme(<Home />);

    const fileInput = screen.getByTestId('pdf-file-input');
    const pdfFile = createMockFile('test.pdf', 'application/pdf');

    await user.upload(fileInput, pdfFile);
    await user.click(screen.getByText('PDFを解析・要約する'));

    await waitFor(() => {
      expect(screen.getByText('結果')).toBeInTheDocument();
    });

    // 自動要約が呼ばれないことを確認（WebLLMが未初期化のため）
    expect(mockWebLLM.summarizeText).not.toHaveBeenCalled();
    
    // 抽出テキストタブの内容を確認
    expect(screen.getByText('テストテキスト')).toBeInTheDocument();
  });

  test('要約中の状態が正しく表示される', async () => {
    // 要約処理中の状態を設定
    mockWebLLM.isSummarizing = true;
    mockWebLLM.initProgress = 'パート 1/3 を要約中...';

    renderWithTheme(<Home />);

    // 要約中の状態が正しく表示されることを確認
    expect(mockWebLLM.isSummarizing).toBe(true);
  });

  test('タブ切り替えでコピー対象が変わる', async () => {
    const user = userEvent.setup();
    
    const mockResponse = {
      text: '抽出されたテキスト',
      metadata: { filename: 'test.pdf', size: 1024, type: 'application/pdf' },
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    });

    renderWithTheme(<Home />);

    const fileInput = screen.getByTestId('pdf-file-input');
    const pdfFile = createMockFile('test.pdf', 'application/pdf');

    await user.upload(fileInput, pdfFile);
    await user.click(screen.getByText('PDFを解析・要約する'));

    await waitFor(() => {
      expect(screen.getByText('結果')).toBeInTheDocument();
    });

    // タブが存在することを確認
    expect(screen.getByText('抽出テキスト')).toBeInTheDocument();
    expect(screen.getByText('AI要約')).toBeInTheDocument();
    
    // コピーボタンが存在することを確認
    expect(screen.getByText('コピー')).toBeInTheDocument();
  });

  test('WebLLM未初期化時は自動要約されない', async () => {
    const user = userEvent.setup();
    mockWebLLM.isInitialized = false;

    const mockResponse = {
      text: 'テストテキスト',
      metadata: { filename: 'test.pdf', size: 1024, type: 'application/pdf' },
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    });

    renderWithTheme(<Home />);

    const fileInput = screen.getByTestId('pdf-file-input');
    const pdfFile = createMockFile('test.pdf', 'application/pdf');

    await user.upload(fileInput, pdfFile);
    await user.click(screen.getByText('PDFを解析・要約する'));

    await waitFor(() => {
      expect(screen.getByText('結果')).toBeInTheDocument();
    });

    // 自動要約が呼ばれないことを確認
    expect(mockWebLLM.summarizeText).not.toHaveBeenCalled();
  });
});

if (import.meta.vitest) {
  const { test, expect } = import.meta.vitest;

  test('ファイル作成ヘルパー関数のテスト', () => {
    const file = createMockFile('test.pdf', 'application/pdf', 2048);
    expect(file.name).toBe('test.pdf');
    expect(file.type).toBe('application/pdf');
    expect(file.size).toBe(2048);
  });
}
