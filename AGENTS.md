# Agent Instructions

## Commands

- Install dependencies with `bun install`; the committed lockfile is `bun.lock`.
- Run all tests with `bun test` and typecheck with `bun run typecheck`.
- Run one focused test file with `bun test test/<name>.test.ts`.
- Exercise the interactive TUI with `bun run src/main.tsx bun dev/mock-agent.ts`; it requires an interactive terminal.
- There is no configured linter, formatter, build script, or CI workflow; do not invent an additional validation command.

## Structure

- `src/main.tsx` parses CLI options, enters the terminal alternate screen, and mounts the Ink app. Options before the command include `--cwd`, repeatable `--env KEY=VALUE`, `--log`, and `--shell`.
- `src/core/connection.ts` owns the `Bun.spawn` child process and splits stdout/stderr into lines; `src/core/controller.ts` maps wire traffic to UI entries and handles restart, logging, and export.
- `src/core/store.ts` is the Zustand state machine for the editor, event stream, scrolling, and view/input modes; tests reset it through `_resetForTest()`.
- The child command speaks newline-delimited JSON-RPC. Outgoing valid JSON is compacted and sent with a newline; wire messages are otherwise not mutated.
- `dev/mock-agent.ts` is the local ACP-like child-process fixture for manual TUI checks, not a test runner.

## Testing

- Tests are Bun tests under `test/` and cover JSON helpers, line splitting, editor wrapping, and store behavior. TypeScript includes `src`, `dev`, and `test` via `tsconfig.json`.
- For changes to transport or state behavior, run the focused test first, then `bun test` and `bun run typecheck`.
