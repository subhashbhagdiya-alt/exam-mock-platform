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
- Weekly automation requires server-side `CRON_SECRET`, `SUPABASE_URL` (or `NEXT_PUBLIC_SUPABASE_URL`), `SUPABASE_SERVICE_ROLE_KEY`, and `GEMINI_API_KEY`. It uses Gemini 3.6 Flash text generation on the free tier and has no OpenAI/paid-provider fallback. Google Search grounding is not enabled because it is unavailable on this model's free tier; the workflow relies on stored question evidence and source metadata, and reports weak evidence instead of claiming to have browsed sources. Free quotas still apply, so a batch may wait until quota resets. Do not attach billing or enable a paid provider if your requirement is ₹0. Never expose server secrets in client-side variables.

## Run locally
```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Verification
Question content should be checked against authoritative exam sources before being marked verified. Official exam dates, application windows, and notifications should be rechecked when they are displayed as current information.

## Automation
ExamPrep includes offline PWA support, scheduled official-source monitoring, exam analysis storage, CI verification, and a weekly rotating exam-analysis/question-generation workflow.
