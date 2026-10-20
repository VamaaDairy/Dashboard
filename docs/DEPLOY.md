# CI and deployment

## CI (`.github/workflows/ci.yml`)
Runs on every push to `main` and every pull request: type check, lint (reported, not blocking yet), and a production build.

## Deploying
Production is the NSSM service `DashboardApp` (`next start -p 3001`), served at production.vamadairy.in.

**By hand, on the server** (must be on a clean `main`):

    npm run deploy

**From GitHub:** Actions -> Deploy -> Run workflow. This needs a self-hosted runner on the server:

1. GitHub repo -> Settings -> Actions -> Runners -> New self-hosted runner (Windows). Add the label `dashboard-prod`.
2. Install it as a service (`config.cmd --runasservice`) under an account that can restart `DashboardApp`.

`scripts/deploy.ps1` pulls `main`, runs `npm ci` and `npm run build`, restarts the service, then polls `/api/health`.
If the build or health check fails, the previous build (kept in `.next.bak`) is restored.

## Health check
`GET /api/health` returns 200 `{"status":"ok","db":"up"}` or 503 when the database is unreachable.
Point an uptime monitor at `https://production.vamadairy.in/api/health`.

## Enabling the workflows
The files in `docs/github-workflows/` are ready to use. GitHub only runs them from `.github/`, so add them there
(`.github/workflows/ci.yml`, `.github/workflows/deploy.yml`, `.github/dependabot.yml`), either with the GitHub
web UI ("Add file" -> "Create new file") or by pushing with a token that has the `workflow` scope.
