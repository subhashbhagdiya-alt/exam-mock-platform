# ExamPrep — Competitive Exam Mock Test Platform

A bilingual Hindi/English mock-test practice app built with Next.js, React, and Lucide icons.

Deployed with Vercel using the Next.js framework preset.

## Features
- Responsive dark dashboard with a premium visual design
- Hindi/English interface toggle
- 10-question timed mock test (10 minutes) with countdown and automatic submission
- Question palette, answer selection, and mark-for-review state
- Submission confirmation and instant score summary
- Correct/wrong/unanswered counts, accuracy percentage, and detailed answer explanations
- Review every answer and retake the test
- Recent test results retained during the current browser session

## Run locally
```bash
npm install
npm run dev
```
Open http://localhost:3000.

## Notes
This is a front-end demo using sample general-knowledge questions. It does not yet include accounts, a database, official exam-specific question banks, or server-side result persistence. Verify all questions against official sources before using them for exam preparation.


## Automation
ExamPrep includes offline PWA support, scheduled official-source monitoring, exam analysis storage, and CI verification.
