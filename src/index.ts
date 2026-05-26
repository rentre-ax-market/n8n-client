/**
 * Thin HTTP client for calling rentre's internal n8n workflow webhooks.
 *
 * Each n8n workflow exposes a webhook URL at `${baseUrl}/webhook/${workflow}`.
 * Authentication is a single Bearer token, scoped per consuming service so
 * usage maps cleanly to n8n's team-account model.
 *
 * The client is intentionally minimal: assemble the URL, attach the
 * authorization header, send `{ params, requestId }`, surface the JSON
 * response. Retry / observability / schema validation are out of scope at
 * v0.x and may land as opt-ins once concrete use cases require them.
 */

export interface N8nClientOptions {
  /** Base URL of the n8n instance, e.g. `https://nnn.turn.rentre.kr` */
  baseUrl: string;
  /** Bearer token issued by the n8n operator for the calling service */
  token: string;
  /** Per-call timeout in milliseconds. Default 30_000. */
  timeout?: number;
  /** Inject a custom fetch (testing, polyfills). Default global fetch. */
  fetch?: typeof fetch;
}

export interface N8nCallOptions {
  /** Override the auto-generated requestId for correlation with caller logs. */
  requestId?: string;
  /** Per-call timeout override (ms). */
  timeout?: number;
}

export class N8nClient {
  private readonly baseUrl: string;
  private readonly token: string;
  private readonly defaultTimeout: number;
  private readonly fetchImpl: typeof fetch;

  constructor(options: N8nClientOptions) {
    if (!options.baseUrl) {
      throw new Error("N8nClient: baseUrl is required");
    }
    if (!options.token) {
      throw new Error("N8nClient: token is required");
    }
    this.baseUrl = options.baseUrl.replace(/\/+$/, "");
    this.token = options.token;
    this.defaultTimeout = options.timeout ?? 30_000;
    this.fetchImpl = options.fetch ?? globalThis.fetch;
    if (!this.fetchImpl) {
      throw new Error(
        "N8nClient: global fetch is not available; pass a fetch implementation in options",
      );
    }
  }

  /**
   * POST `{ params, requestId }` to `${baseUrl}/webhook/${workflow}` and
   * return the parsed JSON response.
   *
   * Throws {@link N8nCallError} on non-2xx responses or network failures.
   */
  async call<TOut = unknown>(
    workflow: string,
    params: Record<string, unknown> = {},
    options: N8nCallOptions = {},
  ): Promise<TOut> {
    if (!workflow) {
      throw new Error("N8nClient.call: workflow name is required");
    }
    const requestId = options.requestId ?? generateRequestId();
    const timeout = options.timeout ?? this.defaultTimeout;
    const url = `${this.baseUrl}/webhook/${encodeURIComponent(workflow)}`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    try {
      const res = await this.fetchImpl(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ params, requestId }),
        signal: controller.signal,
      });

      if (!res.ok) {
        let bodyText: string | undefined;
        try {
          bodyText = await res.text();
        } catch {
          // ignore body read failure
        }
        throw new N8nCallError(
          `n8n workflow "${workflow}" failed: HTTP ${res.status}`,
          {
            workflow,
            requestId,
            httpStatus: res.status,
            body: bodyText,
          },
        );
      }

      return (await res.json()) as TOut;
    } catch (err) {
      if (err instanceof N8nCallError) throw err;
      if (err instanceof Error && err.name === "AbortError") {
        throw new N8nCallError(
          `n8n workflow "${workflow}" timed out after ${timeout}ms`,
          { workflow, requestId, cause: err },
        );
      }
      throw new N8nCallError(
        `n8n workflow "${workflow}" request failed: ${(err as Error).message}`,
        { workflow, requestId, cause: err as Error },
      );
    } finally {
      clearTimeout(timer);
    }
  }
}

export interface N8nCallErrorContext {
  workflow: string;
  requestId: string;
  httpStatus?: number;
  body?: string;
  cause?: Error;
}

export class N8nCallError extends Error {
  readonly workflow: string;
  readonly requestId: string;
  readonly httpStatus?: number;
  readonly body?: string;

  constructor(message: string, context: N8nCallErrorContext) {
    super(message, context.cause ? { cause: context.cause } : undefined);
    this.name = "N8nCallError";
    this.workflow = context.workflow;
    this.requestId = context.requestId;
    this.httpStatus = context.httpStatus;
    this.body = context.body;
  }
}

function generateRequestId(): string {
  // Node 18+ exposes crypto.randomUUID via globalThis.crypto.
  if (
    typeof globalThis.crypto !== "undefined" &&
    typeof globalThis.crypto.randomUUID === "function"
  ) {
    return globalThis.crypto.randomUUID();
  }
  // Fallback (sufficient for log correlation, not cryptographic).
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}
