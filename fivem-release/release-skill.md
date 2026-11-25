---
name: release
description: Cut a new release of this FiveM resource. Picks the next version, writes the CHANGELOG.md entry customers read on the Cfx portal from what actually changed since the last release, bumps fxmanifest.lua and opens the release pull request. Use when asked to release, ship, bump the version or write release notes.
---

# Release

Merging a version bump to `main` releases it. The shared workflow (`Zerio-AB/cfx-portal-upload`, `.github/workflows/fivem-release.yml`) uploads the resource to every Cfx portal asset in `.github/workflows/release.yml`, deletes the oldest versions so each asset keeps at most five, and tags the commit `v<version>`. Your job is the version number and the release notes. Both go in one pull request.

## 1. Find the last release

```bash
git fetch origin --tags
git tag -l 'v*' --sort=-v:refname | head -n 5
```

The newest tag is the last release. If there are no tags yet, use the commit that set the current version: `git log -1 --format=%H -G'^version' -- fxmanifest.lua`.

Each version is released once. Never pick a version that already has a tag.

## 2. Read what changed

```bash
git log --format='%h %s%n%b' <last-release>..origin/main
git diff --stat <last-release>..origin/main
git diff <last-release>..origin/main -- . ':(exclude)*lock*' ':(exclude)html/**'
```

Read the diff, not just the commit messages. A commit message says what someone meant to do; the diff says what customers get. Pay attention to:

- `config*/` and `shared/`: new, renamed or removed options. Customers have to change these.
- `sql/` and any `ALTER TABLE` or `CREATE TABLE`: SQL they have to run, or that now runs by itself.
- `locales/`: new strings that translations need.
- `fxmanifest.lua`: new dependencies, and files added to or removed from `escrow_ignore`.
- Framework bridges (ESX, QBCore, Qbox, ox): which setups a fix applies to.

Leave out what customers never see: refactors, CI, linting, dependency bumps, dev tooling, docs in the repo.

## 3. Pick the version

- Patch (`1.2.3` → `1.2.4`): fixes only, no config change needed.
- Minor (`1.2.3` → `1.3.0`): new features or config options that work without changes to existing configs.
- Major (`1.2.3` → `2.0.0`): servers must change something to keep working, for example a renamed or removed config option, a database migration they run by hand, or a dropped framework.
- A pre-release (`2.0.0-beta.1`) is uploaded as a release candidate, so customers on the stable version aren't moved to it.

If unsure between two, ask.

## 4. Write the CHANGELOG.md entry

Add it at the top of `CHANGELOG.md`, under `# Changelog` (create the file with that heading if it's missing):

```markdown
## 1.3.0 — 2026-11-25

One paragraph for server owners: what this release changes for them, in plain words, and what they must do after updating (SQL to run, config to add, dependency to install). If there is nothing to do, say "Nothing to change in your configs or database."

### <Area, e.g. Admin menu>

- What players or admins now see or can do, one change per bullet.
- **Short label:** for a bigger change, a bold lead-in and then the detail.
```

The heading must start with the exact version, then ` — ` and today's date. CI fails the pull request otherwise.

The opening paragraph is the only part shown on the Cfx portal, so it has to stand on its own. The whole entry becomes the GitHub release, and `CHANGELOG.md` ships in the download.

How to write it:

- Write for server owners, not developers. Describe behavior ("Selecting a garage with qb-target now opens it"), not code ("fixed callback in target.lua").
- Name config options and commands exactly, in backticks: `Config.AllowSameGradeManagement`, `/radioadmin`.
- Say which frameworks or setups a fix applies to when it isn't all of them.
- For a fix, describe what was wrong and what happens now.
- No commit hashes, PR numbers, branch names, function names or internal file paths, unless customers edit that file.
- Use `###` sections for a release with several areas. A small release can skip them.

Example of the tone and shape (from zerio-radio):

```markdown
## 3.0.6 — 2026-11-25

Fixes repeated clicks while someone talks on the radio. When their audio arrived a moment late, the radio could treat the transmission as over and replay the receive click mid-sentence, and the voice cut in and out with a pop. Nothing to change in your configs or database.

### Radio audio

- A short delay in someone's audio no longer ends their transmission, so the receive click plays once at the start instead of repeating while they talk.
- The voice fades in and out over a couple of milliseconds when audio stalls, instead of popping.
```

## 5. Bump the version

Set `version "1.3.0"` in `fxmanifest.lua`, written without parentheses. The portal upload can't read `version("1.3.0")`.

## 6. Open the release pull request

Show the user the entry and the version before you commit. Then:

```bash
git switch -c release/<version> origin/main
git add CHANGELOG.md fxmanifest.lua
git commit -m "chore: release <version>"
git push -u origin release/<version>
gh pr create --title "Release <version>" --body-file <the entry without its heading>
```

The pull request's checks build the zip and show the portal changelog in the run summary. Merging it releases the version.
