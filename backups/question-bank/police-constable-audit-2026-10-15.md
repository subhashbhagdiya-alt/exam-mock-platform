# MPESB Police Constable Question Bank Audit — 2026-10-15

Repository: subhashbhagdiya-alt/exam-mock-platform
Database exam slug: mpesb-police-constable-2026
Exam ID: 0f0d88ab-9cbb-4398-bc9d-123b519a40e3

## Audit findings
- Active questions at audit start: 342
- Verified active questions: 342
- Missing Hindi/English question text: 0
- Missing Hindi/English explanations: 0
- Invalid option count (expected 4): 0
- Invalid answer index (expected 0–3): 0
- Exact normalized Hindi duplicate groups: 11 (22 rows before cleanup)
- Subject taxonomy is fragmented across multiple labels for the same broad sections (e.g. General Knowledge/MP General Knowledge and Science/General Science, including bilingual variants).

## Duplicate rows selected for deactivation
Keep the earlier row in each normalized-Hindi duplicate group; deactivate only the later duplicate row. No question rows are deleted.

| Duplicate row ID | Question |
|---|---|
| cd8e7db0-62fe-4a6e-8d84-f18277eebe0d | ₹2,000 पर 5% वार्षिक दर से 2 वर्ष का साधारण ब्याज कितना होगा? |
| 93ba4bb4-ae1e-408e-a4c9-efbf00267b2b | pH मान 7 से कम होने पर विलयन कैसा होता है? |
| f8ff70eb-82cc-4b44-99dc-9f8780a4dfa8 | कर्क रेखा भारत के कितने राज्यों से होकर गुजरती है? |
| b110fd35-6244-4b3e-aaa1-052021835cce | कान्हा राष्ट्रीय उद्यान मुख्यतः किन जिलों में फैला है? |
| b72b8700-dfb2-4d83-9143-c5b58f0cefa7 | दो संख्याओं का अनुपात 3:5 है और उनका योग 64 है। बड़ी संख्या क्या है? |
| cd819773-2c74-40c3-95bf-cb2aa4332fe3 | ध्वनि किस माध्यम में यात्रा नहीं कर सकती? |
| 45f25050-5589-4f90-983a-319bd299e196 | पुस्तक : पढ़ना :: भोजन : ? |
| 3fd6a20d-3788-4dc4-bf4d-4b1d70498ccf | भारत छोड़ो आंदोलन किस वर्ष शुरू हुआ था? |
| d1407a33-bf61-40e1-8aee-02e4b6e06371 | मध्य प्रदेश उच्च न्यायालय की मुख्य पीठ कहाँ स्थित है? |
| 3604a1e9-a579-4c34-8b7b-2806f3385771 | विटामिन C की कमी से कौन-सा रोग होता है? |
| 0ac147c6-da23-4aaa-9f3b-37080c74a2ed | साधारण नमक का रासायनिक सूत्र क्या है? |

## Notes
- These are curated practice items, not represented as official previous-year questions.
- This file records the audit and cleanup plan; it is not a full question-bank data export.
- Next QA step: normalize section labels after reviewing all dependent API/UI filters, then verify source-type distribution and representative answer keys.
