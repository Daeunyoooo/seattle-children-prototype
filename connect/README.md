# SCH Posit Connect Deployment

This folder contains the Posit Connect entrypoint for the React prototype. It serves the Vite build in `dist/` and exposes the same `/api/*` routes that the local Node server uses, with participant sessions stored in DuckDB.

## Data Handling

Set `SCH_APP_DATA_DIR` to a persistent, access-controlled directory provided by SCH/Posit Connect administrators. The app writes:

- `participant_sessions.duckdb` for session save/load/list data
- `log-data/<sessionId>/session.json`
- `log-data/<sessionId>/<checkpoint>-log.json`
- `log-data/<sessionId>/tool-c/*.png`
- `stakeholders/*.json` if stakeholder defaults are edited through the API

Do not rely on the deployment bundle directory for `SCH_APP_DATA_DIR`; it may be ephemeral or replaced on redeploy.

## Local Smoke Test

From the repository root:

```bash
npm install
npm run build
python -m venv .venv-connect
source .venv-connect/bin/activate
pip install -r connect/requirements.txt
SCH_APP_DATA_DIR="$PWD/.connect-data" uvicorn connect.app:app --host 0.0.0.0 --port 8080
```

Then open `http://localhost:8080`. The React app and `/api` routes are served from the same origin.

## Posit Connect Publish Checklist

1. Confirm Posit Connect access control/SSO is enabled for the app.
2. Confirm a persistent writable `SCH_APP_DATA_DIR` path with SCH administrators.
3. Run `npm run build` before publishing so `dist/` is present.
4. Publish the repository with `connect/app.py` as the FastAPI entrypoint and `connect/requirements.txt` as the Python dependency file.
5. Set `SCH_APP_DATA_DIR` in the Posit Connect app environment.
6. Verify `/api/health` returns `{"ok": true, ... "storage": "duckdb"}` after deployment.

The internal deployment does not require Vercel or Supabase environment variables.
