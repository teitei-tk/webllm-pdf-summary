/**
 * PDFアップロードページのテスト
 */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import theme from './theme';
import Home from './page';

// Material-UI用のテストラッパー
const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider theme={theme}>
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

// File をモック
const createMockFile = (name: string, type: string, size: number = 1024) => {
  const file = new File(['mock content'], name, { type });
  Object.defineProperty(file, 'size', { value: size });
  return file;
};

describe('PDFアップロードページ', () => {
  beforeEach(() => {
    mockFetch.mockReset();
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
    expect(screen.getByText('PDFを解析する')).toBeInTheDocument();
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
    expect(screen.queryByText('PDFを解析する')).not.toBeInTheDocument();
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
    await user.click(screen.getByText('PDFを解析する'));

    await waitFor(() => {
      expect(screen.getByText('解析結果')).toBeInTheDocument();
    });

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
    await user.click(screen.getByText('PDFを解析する'));

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
    await user.click(screen.getByText('PDFを解析する'));

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
    await user.click(screen.getByText('PDFを解析する'));

    await waitFor(() => {
      expect(screen.getByText('コピー')).toBeInTheDocument();
    });

    await user.click(screen.getByText('コピー'));

    expect(writeTextSpy).toHaveBeenCalledWith('コピーテスト用のテキスト');
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
