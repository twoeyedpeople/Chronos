<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/e2549c80-2e01-4537-97e1-2d6152af31ee

## Run Locally 

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Claude milestone briefing export

Chronos can export the same active milestones shown in Milestone View to a Markdown file that Claude can read without scraping the rendered app.

Run this before each scheduled briefing:

```sh
npm run export:milestones
```

If Firestore requires an authenticated read in the scheduled environment, provide a bearer token in one of these environment variables before running the command:

```sh
FIREBASE_ID_TOKEN=... npm run export:milestones
```

The exporter also accepts `FIREBASE_AUTH_TOKEN`, `GOOGLE_OAUTH_ACCESS_TOKEN`, or `GOOGLE_ACCESS_TOKEN`.

The command reads the current Firestore `projects` collection, keeps only tasks with `isMilestone: true`, and overwrites:

- `active-milestones.md`
- `public/active-milestones.md`

Because the files are overwritten from the live milestone source each run, milestones removed from Milestone View are removed from Claude's briefing file on the next export.
