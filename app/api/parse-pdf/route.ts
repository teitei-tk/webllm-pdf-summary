/**
 * PDF解析API - PDFファイルを受け取ってテキストを抽出する
 */
import { NextRequest, NextResponse } from 'next/server';
import PDFParser from 'pdf2json';

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

    // PDFファイルを解析してテキストを抽出
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // pdf2jsonを使用してPDFを解析
    const pdfParser = new (PDFParser as unknown as new (
      arg1: null,
      arg2: number
    ) => PDFParser)(null, 1);

    interface PDFData {
      Pages?: Array<{
        Texts?: Array<{
          R?: Array<{ T?: string }>;
        }>;
      }>;
    }

    const pdfData = await new Promise<PDFData>((resolve, reject) => {
      pdfParser.on('pdfParser_dataError', reject);
      pdfParser.on('pdfParser_dataReady', resolve);
      pdfParser.parseBuffer(buffer);
    });

    // テキストを抽出
    let extractedText = '';
    if (pdfData.Pages && pdfData.Pages.length > 0) {
      pdfData.Pages.forEach((page) => {
        if (page.Texts && page.Texts.length > 0) {
          page.Texts.forEach((textObj) => {
            if (textObj.R && textObj.R.length > 0) {
              textObj.R.forEach((run) => {
                if (run.T) {
                  extractedText += decodeURIComponent(run.T) + ' ';
                }
              });
            }
          });
          extractedText += '\n';
        }
      });
    }

    // 抽出されたテキストが空の場合
    if (!extractedText || extractedText.trim().length === 0) {
      return NextResponse.json({
        text: 'PDFからテキストを抽出できませんでした。画像ベースのPDFの可能性があります。',
        metadata: {
          filename: file.name,
          size: file.size,
          type: file.type,
          pages: pdfData.Pages ? pdfData.Pages.length : 0,
          isEmpty: true,
        },
      });
    }

    // テキストの前処理（日本語対応）
    const processedText = extractedText
      .replace(/\r\n/g, '\n') // 改行コードの統一
      .replace(/\r/g, '\n')
      .replace(/\n{3,}/g, '\n\n') // 連続する改行を2個まで削減
      .trim();

    return NextResponse.json({
      text: processedText,
      metadata: {
        filename: file.name,
        size: file.size,
        type: file.type,
        pages: pdfData.Pages ? pdfData.Pages.length : 0,
        extractedLength: processedText.length,
      },
    });
  } catch (error) {
    console.error('PDF解析エラー:', error);

    // pdf2json特有のエラーをハンドリング
    let errorMessage = 'PDFの解析中にエラーが発生しました';
    if (error instanceof Error) {
      if (
        error.message.includes('Invalid PDF') ||
        error.message.includes('PDF parsing error')
      ) {
        errorMessage = '無効なPDFファイルです';
      } else if (
        error.message.includes('password') ||
        error.message.includes('encrypted')
      ) {
        errorMessage = 'パスワード保護されたPDFは対応していません';
      }
    }

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
