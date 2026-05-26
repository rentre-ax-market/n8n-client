# Changelog

All notable changes to `@rentre-ax-market/n8n-client` are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.0.1] - TBD

### Added
- Initial scaffold (not yet published to npm).
- `N8nClient.call(workflow, params, options?)` — POST to `${baseUrl}/webhook/${workflow}` with Bearer auth, return parsed JSON.
- `N8nCallError` with `workflow`, `requestId`, `httpStatus`, `body` context for failure cases.
- Per-call `timeout` and `requestId` overrides.
- TypeScript types and ESM build.
