# ExamPrep — Competitive Exam Mock Test Platform

A bilingual Hindi/English mock-test practice app built with Next.js, React, and Lucide icons.

Deployed with Vercel using the Next.js framework preset.

## Production features
- Responsive dark dashboard with bilingual Hindi/English UI
- Timed mock tests with question palette, answer selection, review marking, and automatic submission
- Server-backed exam catalog and verified question banks
- Exam-specific job-track catalog with readiness derived from the actual verified question-bank count
- Result persistence through the application API with offline queue support
- Secure OTP login and trusted-device/recovery flows
- PWA/offline support and automated verification tooling

## Question-bank safety
A job track is only treated as test-ready when it has an active exam configuration and at least the configured number of active, verified questions. The test runner does not silently fall back to sample/seed questions when the API question bank is unavailable.

## Weekly exam analysis and question batches
- A weekly Vercel cron selects one active exam, prioritizing the exam with the oldest/missing analysis and then the smallest question bank.
- The analysis uses available stored PYQ/official-tagged questions, exam configuration, topic coverage, and metadata from the configured official-source registry. The free-tier workflow does not claim it has opened or searched those URLs; if authentic past-paper content is missing, the analysis must disclose that limitation.
- It generates a target batch of 50 new bilingual practice questions, stages the result, then runs a separate AI review pass on a later scheduled worker run.
- Questions are inserted only when the batch has at least 50 unique, structurally valid questions with four distinct options, a valid answer index, Hindi/English text, and explanations.
- New questions are labelled `curated`; they are not presented as official PYQs. When authentic past-paper evidence is missing, the analysis must disclose that limitation instead of inventing frequency claims.
- Weekly automation requires server-side `CRON_SECRET`, `SUPABASE_URL` (or `NEXT_PUBLIC_SUPABASE_URL`), `SUPABASE_SERVICE_ROLE_KEY`, and an AI key. **It is free by default:** the worker uses the Gemini API on Google AI Studio's free tier (`GEMINI_API_KEY`, no billing needed; `GEMINI_MODEL` can override the default `gemini-3.6-flash`). OpenAI is used only if you set `AI_PROVIDER=openai` (or if it is the only key configured); OpenAI API usage is billed separately from ChatGPT subscriptions. Every model call gets whatever is left of the 60 s function budget, and rate-limit or quota errors are deferred to a later worker run, so a free-tier limit never throws away a task's saved draft. The workflow relies on stored question evidence and source metadata, and reports weak evidence instead of claiming to have browsed sources. Never expose server secrets in client-side variables.

## Run locally
```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Environment variables
| Variable | Where it is used |
| --- | --- |
| `SUPABASE_URL` or `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL (API routes and browser client) |
| `SUPABASE_PUBLISHABLE_KEY` or `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | User-scoped client for login-bound routes such as `/api/results` |
| `SUPABASE_SECRET_KEY` or `SUPABASE_SERVICE_ROLE_KEY` | **Server only.** Question bank reads, grading RPCs and automation. Never expose it to the browser |
| `CRON_SECRET` | Bearer secret for the `/api/automation/*` routes; they stay closed if it is not set |
| `GEMINI_API_KEY` (or `GEMINI_API_KEY_2`), `GEMINI_MODEL` | **Free** AI provider for weekly question generation. Create a key in [Google AI Studio](https://aistudio.google.com/apikey); no billing is needed |
| `AI_PROVIDER`, `OPENAI_API_KEY`, `OPENAI_MODEL` | Optional paid alternative. Set `AI_PROVIDER=openai` to use OpenAI instead of Gemini |

## Testing
```bash
npm run lint
npm run test:hardening   # rate limiter, UUID and option-splitting checks
npm run test:ai-provider # free-first AI provider selection, timeouts and quota handling
npm run build
```
Every `test:*` script in `package.json` is a plain Node script. CI (`.github/workflows/ci.yml`) runs lint, all of them, the localization check and a production build on each push and pull request, so add a new test script there too.

## API protections
- `/api/grade`, `/api/questions` and `/api/results` are rate limited per IP with a small in-memory limiter (`lib/rate-limit.mjs`). The limits are high enough for a whole classroom behind one college network and only stop scripted floods. Each serverless instance keeps its own counters, so this is not a global guarantee; use a shared store such as Upstash if strict limits are needed.
- API routes log database errors on the server and return generic messages to the browser.
- Grading runs on the server through the `submit_mock_test` RPC, which is callable only with the server key. The answer key reaches the browser only in the post-test review.

## Verification
Question content should be checked against authoritative exam sources before being marked verified. Official exam dates, application windows, and notifications should be rechecked when they are displayed as current information.

## Automation
ExamPrep includes offline PWA support, scheduled official-source monitoring, exam analysis storage, CI verification, and a weekly rotating exam-analysis/question-generation workflow.
