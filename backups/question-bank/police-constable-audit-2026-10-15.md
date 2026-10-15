# MPESB Police Constable Question Bank Audit — 2026-10-15

Repository: subhashbhagdiya-alt/exam-mock-platform
Database exam slug: mpesb-police-constable-2026
Exam ID: 0f0d88ab-9cbb-4398-bc9d-123b519a40e3

## Initial audit
- Active questions before cleanup: 342
- Verified active questions before cleanup: 342
- Missing Hindi/English question text: 0
- Missing Hindi/English explanations: 0
- Invalid option count (expected 4): 0
- Invalid answer index (expected 0–3): 0
- Exact normalized Hindi duplicate groups: 11 (22 active rows across those groups)
- Subject taxonomy is fragmented across labels for the same broad sections (e.g. General Knowledge/MP General Knowledge, Science/General Science, and bilingual variants).

## Cleanup completed
- Deactivated 11 later duplicate rows; no rows were deleted.
- Kept the earlier row for each normalized-Hindi duplicate group.
- Remaining active duplicate groups: 0.
- Final active questions: 331.
- Final verified active questions: 331.
- Final active validation issues: 0.
- Final source distribution: 321 curated practice questions and 10 memory-based questions. None are labelled official PYQ in this source-type distribution.

## Duplicate rows deactivated
| Row ID | Question |
|---|---|
| cd8e7db0-62fe-4a6e-8d84-f18277eebe0d | ₹2,000 पर 5% वार्षिक दर से 2 वर्ष का साधारण ब्याज कितना होगा? |
| 93ba4bb4-ae1e-408e-a4c9-efbf00267b2b | pH मान 7 से कम होने पर विलयन कैसा होता है? |
| f8ff70eb-82cc-4b44-99dc-9f8780a4dfa8 | कर्क रेखा भारत के कितने राज्यों से होकर गुजरती है? |
| b110fd35-6244-4b3e-aaa1-052021835cce | कान्हा राष्ट्रीय उद्यान मुख्यतः किन जिलों में फैला है? |
| b72b8700-dfb2-4d83-9143-c5b58f0cefa7 | दो संख्याओं का अनुपात 3:5 है और उनका योग 64 है। बड़ी संख्या क्या है? |
| cd819773-2c74-40c3-95bf-cb2aa4332fe3 | ध्वनि किस माध्यम में यात्रा नहीं कर सकती? |
| 45f25050-5589-4f90-983a-319bd299e196 | पुस्तक : पढ़ना :: भोजन : ? |
| 3fd6a20d-3788-4dc4-8d4f-4b1d70498ccf | भारत छोड़ो आंदोलन किस वर्ष शुरू हुआ था? |
| d1407a33-7ea7-452e-b9b4-1ed0c03db97a | मध्य प्रदेश उच्च न्यायालय की मुख्य पीठ कहाँ स्थित है? |
| 3604a1e9-a579-4c34-8b7b-2806f3385771 | विटामिन C की कमी से कौन-सा रोग होता है? |
| 0ac147c6-da23-4aaa-9f3b-37080c74a2ed | साधारण नमक का रासायनिक सूत्र क्या है? |

## Application code review
Reviewed `lib/question-categories.mjs`, `app/api/questions/route.js`, `app/api/exams/route.js`, and `package.json`.
- The question API builds its subject/topic catalog from active verified rows and filters questions using normalized case and whitespace.
- It does not merge semantic or bilingual aliases (for example, "Science" and "General Science") into one subject.
- A database-wide subject rename/merge is not safe yet without reviewing every UI consumer and filter expectation. Keep the current stored labels unchanged for now.

## Test/CI review
- Added `scripts/test-question-categories.mjs` and the `test:question-categories` npm script.
- Local Node.js 22 execution of the category catalog/filter test passed.
- Preserved the existing `test:result-validation` npm script.
- Updated `.github/workflows/ci.yml` to run category tests, result-validation tests, localization checks, lint, and build.
- A GitHub Draft PR (#5) was opened for isolated review. At the time of this report, GitHub Actions CI had not started (no workflow run returned); Vercel's PR preview feedback check reported success, which is not the same as the CI/build result.
- Do not merge the PR or make category/UI changes until CI status is confirmed.

## Notes and next steps
- Curated items are practice questions and are not represented as official previous-year questions.
- This is an audit/cleanup record, not a full question-bank data export.
- Next: diagnose why GitHub Actions CI did not start for PR #5; once it runs, review each test/build result before any merge.
