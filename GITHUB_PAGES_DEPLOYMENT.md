# GitHub Pages Deployment

This app is deployed as a static Vite site. Participant data is not sent to GitHub Pages or any app server.

For cross-device save/load on Vercel + Supabase, see [`DEPLOYMENT.md`](DEPLOYMENT.md).

## Data Handling

- Participant drafts are kept in the browser's local storage during the session.
- Researcher exports download JSON files directly to the researcher's computer.
- Tool C PNG data is embedded in the downloaded Part 2 JSON.
- Do not configure Supabase for the GitHub Pages deployment (localStorage only). Use Vercel + Supabase for cross-device storage — see [`DEPLOYMENT.md`](DEPLOYMENT.md).

## Publish Steps

1. Build the static site:

   ```bash
   npm run build:github
   ```

2. Commit and push the generated `docs/` folder.
3. In GitHub, open repository settings.
4. Go to **Pages**.
5. Set **Source** to **Deploy from a branch**.
6. Set **Branch** to `main` and folder to `/docs`.

