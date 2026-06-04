# Idle Rifts

A dependency-light TypeScript canvas idle auto-battler inspired by MOBA strategy loops: roles, lanes, jungle camps, objectives, team building, post-match rewards, and persistent account progression.

## Run Locally

This project does not require package installation. It uses Node 24's built-in TypeScript type stripping to emit browser-ready JavaScript.

```bash
node scripts/build.mjs
node scripts/serve.mjs
```

Then open the printed local URL.

## Validate

```bash
node scripts/build.mjs
node --test tests/*.test.mjs
```

If a package manager is available, the equivalent scripts are also listed in `package.json`.
