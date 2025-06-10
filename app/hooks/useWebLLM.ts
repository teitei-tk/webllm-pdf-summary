/**
 * WebLLM hook for browser-based AI text summarization
 */
import { useState, useCallback, useRef } from 'react';
import * as webllm from '@mlc-ai/web-llm';

interface WebLLMState {
  isInitializing: boolean;
  isInitialized: boolean;
  isSummarizing: boolean;
  error: string | null;
  initProgress: string;
}

interface SummarizeOptions {
  language?: 'ja' | 'en';
  maxLength?: number;
}

export const useWebLLM = () => {
  const [state, setState] = useState<WebLLMState>({
    isInitializing: false,
    isInitialized: false,
    isSummarizing: false,
    error: null,
    initProgress: '',
  });

  const engineRef = useRef<webllm.MLCEngine | null>(null);

  const initializeEngine = useCallback(async () => {
    if (engineRef.current || state.isInitializing || state.isInitialized) {
      return;
    }

    setState((prev) => ({
      ...prev,
      isInitializing: true,
      error: null,
      initProgress: 'モデルを初期化しています...',
    }));

    try {
      // Progress callback for initialization updates
      const initProgressCallback = (progress: {
        text?: string;
        progress?: number;
      }) => {
        if (progress.text && typeof progress.progress === 'number') {
          setState((prev) => ({
            ...prev,
            initProgress: `${progress.text} (${Math.round(progress.progress * 100)}%)`,
          }));
        }
      };

      // Create engine with progress callback
      const engine = new webllm.MLCEngine();

      // Set progress callback if available
      if (typeof engine.setInitProgressCallback === 'function') {
        engine.setInitProgressCallback(initProgressCallback);
      }

      // Try different models in order of preference
      const modelCandidates = [
        'Phi-3-mini-4k-instruct-q4f16_1-MLC',
        'TinyLlama-1.1B-Chat-v0.4-q4f16_1-MLC',
        'RedPajama-INCITE-Chat-3B-v1-q4f16_1-MLC',
      ];

      let modelLoaded = false;
      let lastError: Error | null = null;

      for (const modelId of modelCandidates) {
        try {
          setState((prev) => ({
            ...prev,
            initProgress: `モデル ${modelId} を試行中...`,
          }));

          await engine.reload(modelId);
          modelLoaded = true;

          setState((prev) => ({
            ...prev,
            initProgress: `モデル ${modelId} をロード完了`,
          }));
          break;
        } catch (modelError) {
          console.warn(`Failed to load model ${modelId}:`, modelError);
          lastError = modelError as Error;
          continue;
        }
      }

      if (!modelLoaded) {
        throw lastError || new Error('利用可能なモデルが見つかりませんでした');
      }

      engineRef.current = engine;

      setState((prev) => ({
        ...prev,
        isInitializing: false,
        isInitialized: true,
        initProgress: '初期化完了',
      }));
    } catch (error) {
      console.error('WebLLM initialization error:', error);
      setState((prev) => ({
        ...prev,
        isInitializing: false,
        error:
          'AI モデルの初期化に失敗しました。ブラウザがWebLLMをサポートしていない可能性があります。',
        initProgress: '',
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Remove dependency to prevent re-initialization

  // Helper function to split text into chunks
  const splitTextIntoChunks = (
    text: string,
    maxChunkSize: number = 3000
  ): string[] => {
    const chunks: string[] = [];
    const sentences = text
      .split(/[。．！？\n\r]+/)
      .filter((s) => s.trim().length > 0);

    let currentChunk = '';

    for (const sentence of sentences) {
      const testChunk = currentChunk + sentence + '。';

      if (testChunk.length > maxChunkSize && currentChunk.length > 0) {
        chunks.push(currentChunk.trim());
        currentChunk = sentence + '。';
      } else {
        currentChunk = testChunk;
      }
    }

    if (currentChunk.trim().length > 0) {
      chunks.push(currentChunk.trim());
    }

    return chunks;
  };

  const summarizeText = useCallback(
    async (text: string, options: SummarizeOptions = {}) => {
      if (!engineRef.current) {
        throw new Error('AI モデルが初期化されていません');
      }

      if (!text || text.trim().length === 0) {
        throw new Error('要約するテキストが空です');
      }

      setState((prev) => ({ ...prev, isSummarizing: true, error: null }));

      try {
        const { language = 'ja', maxLength = 300 } = options;

        // If text is too long, split into chunks and summarize each
        const maxSafeTextLength = 2500; // Safe limit to avoid context window issues

        if (text.length > maxSafeTextLength) {
          setState((prev) => ({
            ...prev,
            initProgress: '長いテキストを分割して処理中...',
          }));

          const chunks = splitTextIntoChunks(text, maxSafeTextLength);
          const chunkSummaries: string[] = [];

          for (let i = 0; i < chunks.length; i++) {
            setState((prev) => ({
              ...prev,
              initProgress: `パート ${i + 1}/${chunks.length} を要約中...`,
            }));

            const chunkPrompt =
              language === 'ja'
                ? `以下のテキストの要点を簡潔にまとめてください。重要な情報を漏らさないようにしてください。

テキスト:
${chunks[i]}

要点:`
                : `Summarize the key points of the following text concisely. Do not miss important information.

Text:
${chunks[i]}

Key points:`;

            const response = await engineRef.current.chat.completions.create({
              messages: [
                {
                  role: 'user',
                  content: chunkPrompt,
                },
              ],
              temperature: 0.7,
              max_tokens: 400,
            });

            const chunkSummary = response.choices[0]?.message?.content?.trim();
            if (chunkSummary) {
              chunkSummaries.push(chunkSummary);
            }
          }

          // Final summarization of all chunk summaries
          setState((prev) => ({
            ...prev,
            initProgress: '最終要約を生成中...',
          }));

          const combinedSummaries = chunkSummaries.join('\n\n');
          const finalPrompt =
            language === 'ja'
              ? `以下は文書の各部分の要約です。これらを統合して、${maxLength}文字程度の包括的な要約を作成してください。

各部分の要約:
${combinedSummaries}

最終要約:`
              : `The following are summaries of different parts of a document. Create a comprehensive summary of approximately ${maxLength} words by integrating these parts.

Part summaries:
${combinedSummaries}

Final summary:`;

          const finalResponse = await engineRef.current.chat.completions.create(
            {
              messages: [
                {
                  role: 'user',
                  content: finalPrompt,
                },
              ],
              temperature: 0.7,
              max_tokens: Math.min(maxLength * 2, 600),
            }
          );

          const finalSummary =
            finalResponse.choices[0]?.message?.content?.trim();

          if (!finalSummary) {
            throw new Error('最終要約の生成に失敗しました');
          }

          setState((prev) => ({
            ...prev,
            isSummarizing: false,
            initProgress: '',
          }));
          return finalSummary;
        } else {
          // Single chunk processing for shorter texts
          const prompt =
            language === 'ja'
              ? `以下のテキストを${maxLength}文字程度で簡潔に要約してください。重要なポイントを漏らさず、分かりやすい日本語で要約してください。

テキスト:
${text}

要約:`
              : `Please summarize the following text in approximately ${maxLength} words. Focus on the key points and make it clear and concise.

Text:
${text}

Summary:`;

          const response = await engineRef.current.chat.completions.create({
            messages: [
              {
                role: 'user',
                content: prompt,
              },
            ],
            temperature: 0.7,
            max_tokens: Math.min(maxLength * 2, 600),
          });

          const summary = response.choices[0]?.message?.content?.trim();

          if (!summary) {
            throw new Error('要約の生成に失敗しました');
          }

          setState((prev) => ({ ...prev, isSummarizing: false }));
          return summary;
        }
      } catch (error) {
        console.error('Summarization error:', error);
        let errorMessage = '要約の生成中にエラーが発生しました';

        if (error instanceof Error) {
          if (error.message.includes('ContextWindowSizeExceededError')) {
            errorMessage =
              'テキストが長すぎます。より短いテキストで試してください。';
          } else {
            errorMessage = error.message;
          }
        }

        setState((prev) => ({
          ...prev,
          isSummarizing: false,
          error: errorMessage,
          initProgress: '',
        }));
        throw new Error(errorMessage);
      }
    },
    []
  );

  const resetEngine = useCallback(() => {
    if (engineRef.current) {
      engineRef.current = null;
    }
    setState({
      isInitializing: false,
      isInitialized: false,
      isSummarizing: false,
      error: null,
      initProgress: '',
    });
  }, []);

  return {
    ...state,
    initializeEngine,
    summarizeText,
    resetEngine,
  };
};
