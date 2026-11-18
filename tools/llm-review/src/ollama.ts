import type { ChatMessage } from './types.ts';

export interface OllamaConfig {
  url: string;
  model: string;
  timeoutMs: number;
  contextTokens: number;
}

export interface ChatResult {
  content: string;
  tokensIn: number;
  tokensOut: number;
}

interface OllamaChatResponse {
  message?: { content?: string };
  prompt_eval_count?: number;
  eval_count?: number;
}

/**
 * Minimal client for Ollama's /api/chat.
 *
 * It asks for grammar-constrained JSON (`format: "json"`). Some runners, e.g. MLX on
 * Apple Silicon, answer 501 for that; the client then switches to plain text with
 * thinking disabled for the rest of the run, and the caller extracts JSON itself.
 */
export class OllamaClient {
  readonly config: OllamaConfig;
  #structuredOutput = true;

  constructor(config: OllamaConfig) {
    this.config = config;
  }

  get structuredOutput(): boolean {
    return this.#structuredOutput;
  }

  async chat(messages: ChatMessage[]): Promise<ChatResult> {
    let response = await this.#post(messages);
    if (response.status === 501 && this.#structuredOutput) {
      this.#structuredOutput = false;
      console.warn('  (model has no structured output support: using plain JSON text, thinking off)');
      response = await this.#post(messages);
    }
    if (!response.ok) {
      throw new Error(`Ollama error ${response.status}: ${await response.text()}`);
    }
    const data = (await response.json()) as OllamaChatResponse;
    return {
      content: data.message?.content ?? '',
      tokensIn: data.prompt_eval_count ?? 0,
      tokensOut: data.eval_count ?? 0,
    };
  }

  async #post(messages: ChatMessage[]): Promise<Response> {
    const body: Record<string, unknown> = {
      model: this.config.model,
      stream: false,
      options: { temperature: 0, num_ctx: this.config.contextTokens },
      messages,
    };
    if (this.#structuredOutput) {
      body['format'] = 'json';
    } else {
      body['think'] = false;
    }
    try {
      return await fetch(`${this.config.url}/api/chat`, {
        method: 'POST',
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(this.config.timeoutMs),
      });
    } catch (error) {
      throw new Error(
        `Cannot reach Ollama at ${this.config.url} (${String(error)}). Is it running? Try: brew services start ollama`,
      );
    }
  }
}
