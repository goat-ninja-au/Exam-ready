# Exam Ready

A study website for school and uni students. Upload lecture slides, notes or past papers and Exam Ready makes:

- **Study notes** with headings, key formulas and common mistakes
- **Flashcards**, including step-by-step method cards for maths and science, with spaced repetition
- **Quick quizzes** with instant feedback
- **Practice exams** in your course's style, marked with part marks for working
- **An AI tutor** that answers questions using your own course files
- **A readiness score** per subject and topic, and a daily study plan

## How it fits together

| Part | What it does | Where it runs | Cost to start |
|---|---|---|---|
| `index.html`, `config.js` | The website | GitHub Pages | Free |
| `supabase/schema.sql` | Logins (email link) and saving students' work | Supabase | Free tier |
| `worker/` | Holds the Anthropic API key and talks to Claude | Cloudflare Workers | Free tier |
| Claude API | Writes notes, cards, exams and marking | Anthropic | Pay per use |

The API key only ever lives in the Worker as a secret. It is never in the website code.

## Setup (about 30 minutes)

### 1. Put the site on GitHub Pages
1. In this repo on GitHub, open **Settings → Pages**.
2. Under **Build and deployment**, choose **Deploy from a branch**, branch **main**, folder **/ (root)**, then **Save**.
3. After a minute, the address appears at the top of **Settings → Pages** (for this repo: `https://goat-ninja-au.github.io/Exam-ready/`).

At this point it runs in demo mode: everything works except AI, and work saves in the browser.

### 2. Create the Supabase project (logins and saving)
1. Sign up at [supabase.com](https://supabase.com) and create a new project.
2. Open **SQL Editor → New query**, paste everything from `supabase/schema.sql`, and click **Run**.
3. Open **Authentication → URL Configuration**:
   - **Site URL**: `https://YOUR-USERNAME.github.io/exam-ready/`
   - **Redirect URLs**: add the same address.
4. Open **Project Settings → API** and copy the **Project URL** and the **anon public** key.

### 3. Get a Claude API key
1. Sign in at [console.anthropic.com](https://console.anthropic.com), add billing, and create an API key.
2. Set a **monthly spend limit** in the console so you can never get a surprise bill.

### 4. Deploy the AI Worker
1. Sign up at [cloudflare.com](https://dash.cloudflare.com) (free).
2. Install [Node.js](https://nodejs.org), then in a terminal:
   ```bash
   cd worker
   npx wrangler login
   ```
3. Edit `worker/wrangler.toml` and fill in `SUPABASE_URL`, `SUPABASE_ANON_KEY` and `ALLOWED_ORIGINS` (your GitHub Pages address, for example `https://YOUR-USERNAME.github.io`, with no path).
4. Add your API key as a secret, then deploy:
   ```bash
   npx wrangler secret put ANTHROPIC_API_KEY
   npx wrangler deploy
   ```
5. Copy the Worker address it prints, like `https://exam-ready-ai.YOUR-NAME.workers.dev`.

### 5. Connect the website
Edit `config.js` in this repo:

```js
window.EXAM_READY_CONFIG = {
  SUPABASE_URL: "https://abcd1234.supabase.co",
  SUPABASE_ANON_KEY: "eyJhbGci...",
  AI_URL: "https://exam-ready-ai.YOUR-NAME.workers.dev"
};
```

Commit the change. GitHub Pages updates in about a minute. Open the site, sign in with your email, and create a study set.

## Keeping costs under control
- The Worker only answers signed-in students on your site.
- Turn on the per-student daily limit: create a KV namespace (`npx wrangler kv namespace create USAGE`), paste its id into `wrangler.toml`, uncomment the `[[kv_namespaces]]` block, and redeploy. `DAILY_LIMIT` sets requests per student per day.
- Quick quizzes and cards cost cents. A full 2-hour exam with marking costs the most.
- Keep the spend limit set in the Anthropic console.

## Running it locally
Open a terminal in the repo and run `npx serve .`, then visit the address it prints. Add `http://localhost:3000` (or the port shown) to Supabase's Redirect URLs and to `ALLOWED_ORIGINS` while testing.

## Roadmap
- Version 2: subscriptions with Stripe, shared decks, study with friends
- High school curriculum packs (QCE first)
- Record lectures and import YouTube links
