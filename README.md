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

## Run locally
```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Verification
Question content should be checked against authoritative exam sources before being marked verified. Official exam dates, application windows, and notifications should be rechecked when they are displayed as current information.

## Automation
ExamPrep includes offline PWA support, scheduled official-source monitoring, exam analysis storage, and CI verification.
