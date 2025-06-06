'use client';

import { useState } from 'react';

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-center mb-8">PDF要約アプリ</h1>

        <div className="max-w-2xl mx-auto space-y-6">
          {/* ファイル選択 */}
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
            <input
              type="file"
              accept="application/pdf"
              onChange={handleFileChange}
              className="hidden"
              id="pdf-upload"
              data-testid="pdf-file-input"
            />
            <label htmlFor="pdf-upload" className="cursor-pointer block">
              <div className="text-gray-600 mb-4">
                📄 PDFファイルを選択してください
              </div>
              <div className="bg-blue-500 text-white px-6 py-2 rounded-lg inline-block hover:bg-blue-600 transition-colors">
                ファイルを選択
              </div>
            </label>
            {file && (
              <div className="mt-4 text-sm text-gray-600">
                選択中: {file.name}
              </div>
            )}
          </div>

          {/* アップロードボタン */}
          {file && (
            <button
              onClick={handleUpload}
              disabled={isLoading}
              className="w-full bg-green-500 text-white py-3 px-6 rounded-lg hover:bg-green-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? '解析中...' : 'PDFを解析する'}
            </button>
          )}

          {/* エラー表示 */}
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          {/* 結果表示 */}
          {result && (
            <div className="bg-gray-50 border rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4">解析結果</h2>
              <div className="whitespace-pre-wrap text-sm">{result}</div>
              <button
                onClick={() => navigator.clipboard.writeText(result)}
                className="mt-4 bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 transition-colors"
              >
                コピー
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
