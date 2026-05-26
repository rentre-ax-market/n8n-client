# @rentre-ax-market/n8n-client

Thin HTTP client for calling rentre's internal **n8n** workflow webhooks.

- Public on npm (no auth needed to install).
- Each consuming service authenticates with its own bearer token (`N8N_WEBHOOK_TOKEN`), matching n8n's team-account model.
- ~150 lines, zero runtime dependencies.

## Install

```bash
pnpm add @rentre-ax-market/n8n-client
# or
npm install @rentre-ax-market/n8n-client
```

## Environment

| Variable | Purpose | Example |
|---|---|---|
| `N8N_BASE_URL` | n8n 인스턴스 base URL | `https://nnn.turn.rentre.kr` |
| `N8N_WEBHOOK_TOKEN` | 호출 서비스에 발급된 Bearer 토큰 | (운영자에게 발급 요청) |

토큰은 워크플로 운영자(n8n 팀 계정 보유자)에게 발급 요청. 서비스별로 별도 토큰을 사용해 n8n 측에서 호출 주체를 식별 가능하게 한다.

## Usage

```ts
import { N8nClient } from "@rentre-ax-market/n8n-client";

const n8n = new N8nClient({
  baseUrl: process.env.N8N_BASE_URL!,
  token: process.env.N8N_WEBHOOK_TOKEN!,
});

const result = await n8n.call<{ items: Array<{ name: string; price: number }> }>(
  "rental-brand-scrape",
  { brandUrl: "https://example.com/brand/foo" },
);

console.log(result.items);
```

### Typed responses

```ts
interface BrandScrapeResult {
  status: "ok" | "error";
  items: Array<{ name: string; price: number }>;
  scrapedAt: string;
}

const result = await n8n.call<BrandScrapeResult>("rental-brand-scrape", {
  brandUrl,
});
```

타입은 호출자가 정의한다. 클라이언트는 응답을 JSON으로 파싱해 그대로 반환할 뿐.

### Per-call options

```ts
await n8n.call("slow-workflow", params, {
  timeout: 60_000,          // override default 30s
  requestId: "my-correlation-id",
});
```

## Call contract

n8n 워크플로는 다음 규약을 따라야 호출 가능:

### Request

```
POST ${N8N_BASE_URL}/webhook/${workflow}
Authorization: Bearer ${N8N_WEBHOOK_TOKEN}
Content-Type: application/json

{ "params": { ... }, "requestId": "<uuid>" }
```

### Response (success)

HTTP 200 + JSON body. shape은 워크플로별로 자유. 호출자는 응답 본문을 그대로 받음 (`call<T>` 의 `T`는 그 shape).

권장 (필수 아님): 워크플로가 `{ status: "ok" | "error", data?, error?, requestId }` 형태를 따르면 호출자 코드가 일관됨.

### Response (failure)

비-2xx 응답: `N8nCallError` throw. `error.httpStatus`, `error.body`, `error.workflow`, `error.requestId` 접근 가능.

### Long-running workflows

30초 이상 걸리는 워크플로는 즉시 `{ status: "accepted", jobId }` 반환 후 별도 polling/callback 패턴 권장. 본 클라이언트는 그 패턴을 알지 못함 — 호출자가 jobId로 후속 polling 호출을 직접 수행.

## API

### `new N8nClient(options)`

| Option | Type | Default | Required | Description |
|---|---|---|---|---|
| `baseUrl` | `string` | — | yes | n8n base URL (trailing slash 자동 제거) |
| `token` | `string` | — | yes | Bearer 토큰 |
| `timeout` | `number` | `30000` | no | per-call 기본 timeout (ms) |
| `fetch` | `typeof fetch` | global `fetch` | no | custom fetch 주입 (testing) |

### `client.call<T>(workflow, params?, options?): Promise<T>`

n8n 워크플로 webhook 호출.

- `workflow` *(string, required)* — 워크플로 path (예: `"rental-brand-scrape"`)
- `params` *(object, optional)* — 워크플로에 전달할 파라미터
- `options.requestId` *(string, optional)* — 호출자 상관관계 추적용 ID
- `options.timeout` *(number, optional)* — 이 호출만의 timeout 오버라이드

### `N8nCallError`

비-2xx 응답·timeout·네트워크 실패 시 throw. 속성: `workflow`, `requestId`, `httpStatus?`, `body?`.

## Versioning

- **v0.x**: API 안정화 전 실험기. minor 버전에 breaking change 가능.
- **v1.0+** 부터 SemVer 엄격 적용. 호출 규약(헤더/body/응답 처리)에 breaking change가 들어가면 major bump.
- CHANGELOG는 `CHANGELOG.md` 참조.

## Background

이 클라이언트의 호출 규약과 인프라(사내 n8n에서 Playwright가 동작 가능한지)는 `doublecheck-kor/rentre_n8n` 의 [n8n + Playwright PoC (RPB-7873)](https://github.com/doublecheck-kor/rentre_n8n/pull/1) 에서 결정·검증되었다.

## License

[MIT](./LICENSE)
