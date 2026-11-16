# AGENTS.md

Instructions for AI agents (Claude Code and others) working on this repository.

## Project

DocView is a desktop viewer for code snippets and files: paste or open SQL, HTML, XML, JSON, etc., and it detects the language, pretty-prints and highlights it. Tauri v2 (Rust shell in `src-tauri/`) + TypeScript/Vite frontend (`src/`). Targets Windows and Linux. See `README.md` for features and structure.

## Conventions

- **Everything written to git/GitHub is in English**: commit messages, PR titles and descriptions, code comments, README, docs.
- **The app's user interface is in Danish** (labels, messages, toasts). Keep new UI text in Danish.
- Never commit to `main` directly. Work on a branch and open a pull request. The owner merges, unless the owner asks the agent to merge (see "How to make a release").
- Do not change the updater public key in `src-tauri/tauri.conf.json` or the signing secrets. Doing so breaks updates for every installed copy.

## Commands

```bash
npm ci                 # install dependencies
npm test               # unit tests (Vitest) – run before every push
npm run build          # type-check + build the frontend
npm run tauri dev      # run the app
npm run tauri build    # build installers for the current OS
```

On Linux the Tauri build needs `libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev libxdo-dev`.

## Versioning

- The single source of truth for the app version is `version` in `package.json`. `tauri.conf.json` reads it from there (`"version": "../package.json"`). Do not add a version anywhere else. The `version` in `src-tauri/Cargo.toml` is not used for releases and can be left alone.
- Use semantic versioning: patch (`0.2.1`) for fixes, minor (`0.3.0`) for new features.

## How to make a release

Releases are made **only** by the workflow `.github/workflows/build.yml`. Never create or publish a release by hand in the GitHub UI. A release published before its files are built makes installed apps look for an update that is not there yet.

### When the owner asks for a release

The owner does not want to go into GitHub to release. When the owner asks for a release (e.g. "lav et release"), that request authorizes the agent to do the whole flow end to end, without asking again:

1. Merge any open PRs the owner has said are ready for the release (wait for the `test` check to pass first).
2. Pick the next version (patch for fixes, minor for new features; if unsure, ask).
3. Follow the standard way below: release branch, version bump, `npm test`, release PR.
4. Wait for the PR's `test` check to pass, then **merge the release PR yourself** (`gh pr merge <n> --merge --delete-branch`).
5. Follow the workflow run to the end and report the result (see "After a release").

This needs a session with the `gh` CLI logged in (e.g. a local Claude Code session). A session that cannot merge opens the release PR and tells the owner it is ready to merge.

### Standard way (works everywhere, including cloud sessions that cannot push tags)

1. Create a branch from the latest `main`, e.g. `release/v0.2.1`.
2. Bump `version` in `package.json` with `npm version 0.2.1 --no-git-tag-version`. This updates `package.json` and `package-lock.json`.
3. Commit (`Release v0.2.1`) and open a PR titled `Release v0.2.1`. In the description, list the user-visible changes since the previous release.
4. The PR is merged (by the agent when the owner asked for the release, otherwise by the owner). The push to `main` triggers the workflow:
   - `prepare` sees that `v0.2.1` has no published release and no tag, and creates a **draft** release.
   - `build` builds Windows and Linux. It uploads the installers, update packages (`.sig`) and `latest.json` to the draft.
   - `publish` runs only if every build succeeded. It checks that `latest.json` lists both `windows-x86_64` and `linux-x86_64`, then publishes the release. That creates the tag `v0.2.1` and makes it the latest release.
5. Follow the workflow run and report the result to the owner (see "After a release").

A version bump can also be part of a feature PR. The release then happens when that PR is merged. Prefer a separate release PR, so a release only happens when the owner asks for one.

### Alternative (local sessions with full git access)

Pushing a tag `vX.Y.Z` on a commit on `main` also triggers a release, with the version taken from the tag. Still bump `package.json` on `main` afterwards (or before), so the next release starts from the right number. When in doubt, use the standard way.

### Manual run

Actions → Build → "Run workflow" builds the installers as downloadable artifacts **without** releasing. Use it to test a build.

### If a release build fails

Nothing is published, so installed apps are unaffected. A draft release `vX.Y.Z` may be left behind. Fix the problem in a PR. When it is merged, the next push to `main` reuses the existing draft (the tag does not exist yet) and finishes the release. Do not delete published releases or tags.

### After a release

Verify, and report to the owner:

- The run's `prepare`, `build` (both platforms) and `publish` jobs succeeded.
- The release `vX.Y.Z` is published (not a draft). It contains the `.exe`, `.msi`, `.deb` and `.AppImage` files, their `.sig` files and `latest.json`.
- `https://github.com/lizzard85/docview/releases/latest/download/latest.json` returns `"version": "X.Y.Z"` and URLs for both Windows and Linux.

## Automatic updates

- The app (Tauri updater plugin) checks `releases/latest/download/latest.json` shortly after start and every 6 hours. The code is in `src/update.ts`.
- Update packages are signed with a minisign key. The private key and its password are the repository secrets `TAURI_SIGNING_PRIVATE_KEY` / `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`, and the owner keeps a backup. The public key is in `tauri.conf.json`.
- The repository must stay public, so the app can download `latest.json` and the installers without logging in.
- On Windows the update installs the NSIS (`-setup.exe`) package passively. On Linux only the AppImage self-updates.
