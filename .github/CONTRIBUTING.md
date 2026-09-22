# Contributing

## Setup

This project uses [Bun](https://bun.sh) for installs and scripts.

```sh
bun install
```

## Scripts

| Command                | What it does                         |
| ---------------------- | ------------------------------------ |
| `bun run lint`         | Lint with [oxlint](https://oxc.rs/)  |
| `bun run format`       | Format with [oxfmt](https://oxc.rs/) |
| `bun run format:check` | Check formatting without writing     |
| `bun run typecheck`    | `tsc --noEmit`                       |
| `bun run test`         | Run the test suite (vitest)          |
| `bun run build`        | Build `dist/` with tsdown            |

Before opening a PR, make sure `lint`, `typecheck`, `test`, and `build` all pass.

## Changesets

Releases are driven by [Changesets](https://github.com/changesets/changesets). Any PR that changes published behavior needs a changeset:

```sh
bun run changeset
```

Follow the prompts to describe the change and pick a bump type (patch/minor/major). Commit the generated file in `.changeset/` alongside your change.

Once merged to `main`, a GitHub Actions workflow (`.github/workflows/release.yml`) opens or updates a "Version Packages" PR; merging that PR publishes to npm.

## Pull requests

- Keep PRs focused on one change.
- Add or update tests for any behavior change (see `src/*.test.ts` for the existing style).
- Include a changeset (see above) unless the change has no user-facing effect (docs, CI, tests only).
