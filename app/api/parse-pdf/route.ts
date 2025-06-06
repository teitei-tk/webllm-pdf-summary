/**
 * PDF解析API - PDFファイルを受け取ってテキストを抽出する
 */
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('pdf') as File | null;

    if (!file) {
      return NextResponse.json(
        { error: 'PDFファイルが見つかりません' },
        { status: 400 }
      );
    }

    if (file.type !== 'application/pdf') {
      return NextResponse.json(
        { error: 'PDFファイルを選択してください' },
        { status: 400 }
      );
    }

    // ファイルサイズチェック (10MB制限)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'ファイルサイズが大きすぎます (最大10MB)' },
        { status: 400 }
      );
    }

    // TODO: PDF解析ロジックを実装
    // const arrayBuffer = await file.arrayBuffer();
    // const extractedText = await parsePDF(arrayBuffer);

    // 仮の応答
    const mockText = `PDFファイル「${file.name}」の解析結果です。

このテキストは仮のものです。実際の実装では、以下の処理を行います：

1. PDFファイルからテキストを抽出
2. 日本語フォントの適切な処理
3. 表形式データの構造化
4. OCRが必要な場合の画像処理

ファイル情報:
- ファイル名: ${file.name}
- ファイルサイズ: ${(file.size / 1024).toFixed(2)} KB
- タイプ: ${file.type}`;

    return NextResponse.json({
      text: mockText,
      metadata: {
        filename: file.name,
        size: file.size,
        type: file.type,
      },
    });
  } catch (error) {
    console.error('PDF解析エラー:', error);
    return NextResponse.json(
      { error: 'PDFの解析中にエラーが発生しました' },
      { status: 500 }
    );
  }
}
