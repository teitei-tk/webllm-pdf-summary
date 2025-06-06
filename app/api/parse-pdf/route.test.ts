/**
 * PDF解析APIのテスト
 */
import { NextRequest } from 'next/server';
import { POST } from './route';

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
  return file;
};

// NextRequest をモック
const createMockRequest = (formData: FormData) => {
  return {
    formData: async () => formData,
  } as NextRequest;
};

describe('PDF解析API', () => {
  test('正常なPDFファイルで成功レスポンスを返す', async () => {
    const pdfFile = createMockFile('test.pdf', 'application/pdf', 1024);
    const formData = createMockFormData(pdfFile);
    const request = createMockRequest(formData);

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.text).toContain('PDFファイル「test.pdf」の解析結果です');
    expect(data.metadata).toEqual({
      filename: 'test.pdf',
      size: 1024,
      type: 'application/pdf',
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

  test('FormDataの解析でエラーが発生した場合500エラーを返す', async () => {
    // console.error をモックして stderr 出力を抑制
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const invalidRequest = {
      formData: async () => {
        throw new Error('FormData parsing error');
      },
    } as NextRequest;

    const response = await POST(invalidRequest);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('PDFの解析中にエラーが発生しました');
    expect(consoleErrorSpy).toHaveBeenCalledWith('PDF解析エラー:', expect.any(Error));

    // モックを復元
    consoleErrorSpy.mockRestore();
  });

  test('レスポンスに正しいメタデータが含まれている', async () => {
    const pdfFile = createMockFile('contract.pdf', 'application/pdf', 2048);
    const formData = createMockFormData(pdfFile);
    const request = createMockRequest(formData);

    const response = await POST(request);
    const data = await response.json();

    expect(data.metadata.filename).toBe('contract.pdf');
    expect(data.metadata.size).toBe(2048);
    expect(data.metadata.type).toBe('application/pdf');
  });

  test('レスポンステキストに期待される内容が含まれている', async () => {
    const pdfFile = createMockFile('document.pdf', 'application/pdf');
    const formData = createMockFormData(pdfFile);
    const request = createMockRequest(formData);

    const response = await POST(request);
    const data = await response.json();

    expect(data.text).toContain('PDFファイル「document.pdf」の解析結果です');
    expect(data.text).toContain('このテキストは仮のものです');
    expect(data.text).toContain('PDFファイルからテキストを抽出');
    expect(data.text).toContain('日本語フォントの適切な処理');
    expect(data.text).toContain('表形式データの構造化');
    expect(data.text).toContain('OCRが必要な場合の画像処理');
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