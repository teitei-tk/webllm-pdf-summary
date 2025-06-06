/**
 * PDF解析APIのテスト
 */
import { NextRequest } from 'next/server';
import { POST } from './route';

// pdf2jsonをモック
vi.mock('pdf2json', () => ({
  default: vi.fn(),
}));

import PDFParser from 'pdf2json';
const MockPDFParser = vi.mocked(PDFParser);

// FormData をモック
const createMockFormData = (file?: File | null) => {
  const formData = new FormData();
  if (file) {
    formData.append('pdf', file);
  }
  return formData;
};

// File をモック
const createMockFile = (
  name: string,
  type: string,
  size: number = 1024,
  content: string = 'mock content'
) => {
  const file = new File([content], name, { type });
  Object.defineProperty(file, 'size', { value: size });

  // arrayBuffer メソッドをモック
  file.arrayBuffer = vi.fn().mockResolvedValue(new ArrayBuffer(size));

  return file;
};

// NextRequest をモック
const createMockRequest = (formData: FormData) => {
  return {
    formData: async () => formData,
  } as NextRequest;
};

describe('PDF解析API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('正常なPDFファイルで成功レスポンスを返す', async () => {
    const mockPdfData = {
      Pages: [
        {
          Texts: [
            {
              R: [
                { T: encodeURIComponent('これは抽出されたPDFテキストです。') },
              ],
            },
            {
              R: [
                { T: encodeURIComponent('日本語のサンプル文章です。') },
              ],
            },
          ],
        },
      ],
    };

    const mockParserInstance = {
      on: vi.fn(),
      parseBuffer: vi.fn(),
    };

    MockPDFParser.mockImplementation(() => mockParserInstance as any);

    // イベントハンドラーをモック
    mockParserInstance.on.mockImplementation((event: string, callback: any) => {
      if (event === 'pdfParser_dataReady') {
        // 非同期でコールバックを呼び出し
        setTimeout(() => callback(mockPdfData), 0);
      }
    });

    const pdfFile = createMockFile('test.pdf', 'application/pdf', 1024);
    const formData = createMockFormData(pdfFile);
    const request = createMockRequest(formData);

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.text).toContain('これは抽出されたPDFテキストです。');
    expect(data.text).toContain('日本語のサンプル文章です。');
    expect(data.metadata).toEqual({
      filename: 'test.pdf',
      size: 1024,
      type: 'application/pdf',
      pages: 1,
      extractedLength: data.text.length,
    });
  });

  test('ファイルが存在しない場合400エラーを返す', async () => {
    const formData = createMockFormData();
    const request = createMockRequest(formData);

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('PDFファイルが見つかりません');
  });

  test('PDFファイル以外の場合400エラーを返す', async () => {
    const textFile = createMockFile('test.txt', 'text/plain');
    const formData = createMockFormData(textFile);
    const request = createMockRequest(formData);

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('PDFファイルを選択してください');
  });

  test('ファイルサイズが大きすぎる場合400エラーを返す', async () => {
    const largePdfFile = createMockFile(
      'large.pdf',
      'application/pdf',
      11 * 1024 * 1024 // 11MB
    );
    const formData = createMockFormData(largePdfFile);
    const request = createMockRequest(formData);

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('ファイルサイズが大きすぎます (最大10MB)');
  });

  test('テキストが空のPDFの場合の処理', async () => {
    const mockPdf = {
      numPages: 1,
      getPage: vi.fn().mockResolvedValue({
        getTextContent: vi.fn().mockResolvedValue({
          items: [],
        }),
      }),
    };

    mockGetDocument.mockReturnValue({
      promise: Promise.resolve(mockPdf),
    } as any);

    const pdfFile = createMockFile('empty.pdf', 'application/pdf', 1024);
    const formData = createMockFormData(pdfFile);
    const request = createMockRequest(formData);

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.text).toBe(
      'PDFからテキストを抽出できませんでした。画像ベースのPDFの可能性があります。'
    );
    expect(data.metadata.isEmpty).toBe(true);
  });

  test('PDF.jsでエラーが発生した場合500エラーを返す', async () => {
    // console.error をモックして stderr 出力を抑制
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    mockGetDocument.mockReturnValue({
      promise: Promise.reject(new Error('Invalid PDF')),
    } as any);

    const pdfFile = createMockFile('invalid.pdf', 'application/pdf', 1024);
    const formData = createMockFormData(pdfFile);
    const request = createMockRequest(formData);

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('無効なPDFファイルです');
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'PDF解析エラー:',
      expect.any(Error)
    );

    // モックを復元
    consoleErrorSpy.mockRestore();
  });

  test('暗号化されたPDFの場合の専用エラーメッセージ', async () => {
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    mockGetDocument.mockReturnValue({
      promise: Promise.reject(new Error('PDF is encrypted')),
    } as any);

    const pdfFile = createMockFile('encrypted.pdf', 'application/pdf', 1024);
    const formData = createMockFormData(pdfFile);
    const request = createMockRequest(formData);

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('暗号化されたPDFは対応していません');

    consoleErrorSpy.mockRestore();
  });

  test('テキストの前処理が正しく動作する', async () => {
    const mockPdf = {
      numPages: 1,
      getPage: vi.fn().mockResolvedValue({
        getTextContent: vi.fn().mockResolvedValue({
          items: [{ str: 'Line 1\r\nLine 2\rLine 3\n\n\n\nLine 4  ' }],
        }),
      }),
    };

    mockGetDocument.mockReturnValue({
      promise: Promise.resolve(mockPdf),
    } as any);

    const pdfFile = createMockFile('test.pdf', 'application/pdf', 1024);
    const formData = createMockFormData(pdfFile);
    const request = createMockRequest(formData);

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.text).toBe('Line 1\nLine 2\nLine 3\n\nLine 4');
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

  test('FormData作成ヘルパー関数のテスト', () => {
    const file = createMockFile('test.pdf', 'application/pdf');
    const formData = createMockFormData(file);
    expect(formData.get('pdf')).toBe(file);

    const emptyFormData = createMockFormData();
    expect(emptyFormData.get('pdf')).toBeNull();
  });
}
