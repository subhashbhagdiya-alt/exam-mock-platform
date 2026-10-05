"use client";

import { useEffect, useState } from "react";
import { ArrowRight, Award, BookOpen, Check, CheckCircle2, ChevronLeft, ChevronRight, Clock3, Flame, Flag, Globe2, GraduationCap, Home, Info, Languages, ListChecks, RotateCcw, ShieldCheck, Target, Trophy, X } from "lucide-react";

async function ensureSessionKey() {
  if (typeof window === "undefined") throw new Error("Browser session is not available");
  let key = window.localStorage.getItem("exam_prep_session_key");
  if (!key) {
    key = crypto.randomUUID();
    window.localStorage.setItem("exam_prep_session_key", key);
  }
  return key;
}
const questionBank = [
  // Seed questions — this bank will be expanded and ranked by the exam-question pipeline.
  { id: 1, subject: "सामान्य ज्ञान", en: "Which is the largest planet in our Solar System?", hi: "हमारे सौरमंडल का सबसे बड़ा ग्रह कौन-सा है?", options: ["Earth / पृथ्वी", "Jupiter / बृहस्पति", "Saturn / शनि", "Neptune / वरुण"], answer: 1, explanation: "Jupiter is the largest planet in the Solar System. / बृहस्पति सौरमंडल का सबसे बड़ा ग्रह है।" },
  { id: 2, subject: "भारतीय संविधान", en: "When did the Constitution of India come into force?", hi: "भारत का संविधान कब लागू हुआ?", options: ["15 August 1947", "26 January 1950", "26 November 1949", "2 October 1950"], answer: 1, explanation: "The Constitution came into force on 26 January 1950. / संविधान 26 जनवरी 1950 को लागू हुआ।" },
  { id: 3, subject: "गणित", en: "What is the LCM of 12 and 18?", hi: "12 और 18 का लघुत्तम समापवर्त्य (LCM) क्या है?", options: ["24", "30", "36", "72"], answer: 2, explanation: "LCM(12,18) = 36. / LCM = 36." },
  { id: 4, subject: "विज्ञान", en: "Which gas do plants absorb during photosynthesis?", hi: "प्रकाश संश्लेषण के दौरान पौधे कौन-सी गैस ग्रहण करते हैं?", options: ["Oxygen / ऑक्सीजन", "Nitrogen / नाइट्रोजन", "Carbon dioxide / कार्बन डाइऑक्साइड", "Hydrogen / हाइड्रोजन"], answer: 2, explanation: "Plants absorb carbon dioxide during photosynthesis. / पौधे प्रकाश संश्लेषण में कार्बन डाइऑक्साइड ग्रहण करते हैं।" },
  { id: 5, subject: "इतिहास", en: "Who was the first President of India?", hi: "भारत के प्रथम राष्ट्रपति कौन थे?", options: ["Dr. Rajendra Prasad", "Dr. S. Radhakrishnan", "Jawaharlal Nehru", "Sardar Patel"], answer: 0, explanation: "Dr. Rajendra Prasad was India's first President. / डॉ. राजेंद्र प्रसाद भारत के प्रथम राष्ट्रपति थे।" },
  { id: 6, subject: "रीजनिंग", en: "Find the next number: 2, 6, 12, 20, 30, ?", hi: "अगली संख्या ज्ञात करें: 2, 6, 12, 20, 30, ?", options: ["36", "40", "42", "44"], answer: 2, explanation: "The differences increase by 2: +4, +6, +8, +10, so next is +12. / उत्तर 42 है।" },
  { id: 7, subject: "भूगोल", en: "Which is the longest river in India by length within the country?", hi: "भारत की सीमाओं के भीतर बहने वाली सबसे लंबी नदी कौन-सी है?", options: ["Yamuna / यमुना", "Ganga / गंगा", "Godavari / गोदावरी", "Narmada / नर्मदा"], answer: 1, explanation: "The Ganga is generally recognised as the longest river flowing within India. / भारत में गंगा सबसे लंबी नदी मानी जाती है।" },
  { id: 8, subject: "कंप्यूटर", en: "What does CPU stand for?", hi: "CPU का पूरा नाम क्या है?", options: ["Central Processing Unit", "Computer Power Utility", "Central Program User", "Core Processing Upload"], answer: 0, explanation: "CPU stands for Central Processing Unit. / CPU का अर्थ Central Processing Unit है।" },
  { id: 9, subject: "अर्थशास्त्र", en: "Which institution issues most currency notes in India?", hi: "भारत में अधिकांश करेंसी नोट कौन जारी करता है?", options: ["SBI", "Finance Commission", "Reserve Bank of India", "NITI Aayog"], answer: 2, explanation: "The RBI issues banknotes except the ₹1 note, issued by the Government of India. / ₹1 का नोट भारत सरकार जारी करती है।" },
  { id: 10, subject: "सामान्य ज्ञान", en: "What is the national animal of India?", hi: "भारत का राष्ट्रीय पशु कौन-सा है?", options: ["Asiatic lion / एशियाई शेर", "Bengal tiger / बंगाल टाइगर", "Elephant / हाथी", "Leopard / तेंदुआ"], answer: 1, explanation: "The Bengal tiger is India's national animal. / बंगाल टाइगर भारत का राष्ट्रीय पशु है।" }
];

const formatTime = (seconds) => {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return m + ":" + s;
};

export default function HomePage() {
  const [language, setLanguage] = useState("hi");
  const [view, setView] = useState("home");
  const [answers, setAnswers] = useState({});
  const [review, setReview] = useState([]);
  const [current, setCurrent] = useState(0);
  const [seconds, setSeconds] = useState(600);
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [storageMessage, setStorageMessage] = useState("");
  const [showSubmit, setShowSubmit] = useState(false);
  const [testQuestions, setTestQuestions] = useState(questionBank);
  const hi = language === "hi";
  const t = (h, e) => hi ? h : e;
  const q = testQuestions[current];
  const answered = Object.keys(answers).length;

  useEffect(() => {
    let active = true;
    async function loadHistory() {
      try {
        const key = await ensureSessionKey();
        const response = await fetch(`/api/results?session_key=${encodeURIComponent(key)}`);
        const payload = await response.json();
        if (!response.ok) throw new Error(payload?.error || "Could not load saved results");
        if (active) { setHistory(payload.data || []); setStorageMessage(""); }
      } catch (error) {
        if (active) setStorageMessage(error?.message || "Could not load saved results");
      }
    }
    loadHistory();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (view !== "test" || result) return;
    if (seconds <= 0) { finishTest(); return; }
    const timer = setTimeout(() => setSeconds(s => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [view, seconds, result]);

  async function startTest() {
    setAnswers({}); setReview([]); setCurrent(0); setSeconds(600); setResult(null); setShowSubmit(false);
    try {
      const response = await fetch("/api/questions?exam=mpesb&limit=10", { cache: "no-store" });
      const payload = await response.json();
      if (response.ok && Array.isArray(payload.data) && payload.data.length) {
        const mapped = payload.data.map((item, index) => ({
          id: index + 1,
          sourceId: item.id,
          subject: item.subject || "General",
          topic: item.topic || "",
          en: item.question_en || item.question_hi,
          hi: item.question_hi || item.question_en,
          options: Array.isArray(item.options) ? item.options : [],
          answer: Number(item.answer_index),
          explanation: item.explanation_hi || item.explanation_en || "",
          sourceType: item.source_type || "curated",
          sourceYear: item.source_year || null,
          predictionScore: Number(item.prediction_score || 0)
        })).filter(item => item.options.length === 4 && Number.isInteger(item.answer) && item.answer >= 0 && item.answer < 4);
        if (mapped.length) setTestQuestions(mapped);
        else setTestQuestions(questionBank);
      } else {
        setTestQuestions(questionBank);
      }
    } catch {
      setTestQuestions(questionBank);
    }
    setView("test");
  }
  async function finishTest() {
    if (result) return;
    const correctCount = Object.entries(answers).filter(([id, a]) => testQuestions[Number(id)-1]?.answer === a).length;
    const summary = { correct: correctCount, wrong: Object.keys(answers).filter(id => testQuestions[Number(id)-1]?.answer !== answers[id]).length, unanswered: testQuestions.length - Object.keys(answers).length, score: correctCount, accuracy: Math.round(correctCount / testQuestions.length * 100), answers: {...answers}, review_ids: [...review], language, total_questions: testQuestions.length, test_name: "Quick mock test" };
    setResult(summary); setView("result"); setShowSubmit(false);
    try {
      const sessionKey = await ensureSessionKey();
      const response = await fetch("/api/results", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ session_key: sessionKey, ...summary })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || "Result could not be saved to cloud");
      setHistory(old => [payload.data, ...old].slice(0, 50));
      setStorageMessage("");
    } catch (error) {
      setStorageMessage(error?.message || "Result could not be saved to cloud");
      setHistory(old => [{...summary, created_at: new Date().toISOString()}, ...old].slice(0, 50));
    }
  }
  function chooseAnswer(index) { setAnswers(old => ({ ...old, [q.id]: index })); }
  function toggleReview() { setReview(old => old.includes(q.id) ? old.filter(n => n !== q.id) : [...old, q.id]); }

  return (
    <main className="shell">
      <aside className="sidebar">
        <div className="brand"><div className="brand-icon"><GraduationCap size={23}/></div><span>Exam<span className="brand-accent">Prep</span><small>YOUR NEXT RANK STARTS HERE</small></span></div>
        <div className="side-label">{t("वर्कस्पेस","WORKSPACE")}</div>
        <button className={"nav-item " + (view === "home" ? "active" : "")} onClick={() => setView("home")}><Home size={18}/>{t("डैशबोर्ड","Dashboard")}</button>
        <button className={"nav-item " + (view !== "home" ? "active" : "")} onClick={startTest}><BookOpen size={18}/>{t("मॉक टेस्ट","Mock test")}</button>
        <button className="nav-item" onClick={() => setView("history")}><Award size={18}/>{t("मेरे रिज़ल्ट","My results")}</button>
        <div className="sidebar-bottom"><div className="daily-card"><div className="daily-icon"><Flame size={17}/></div><b>{t("लगातार अभ्यास करें","Keep your streak")}</b><p>{t("रोज़ थोड़ा अभ्यास, बेहतर रैंक।","Small daily practice. Better ranks.")}</p><div className="streak-dots"><i/><i/><i/><i/><i/><i/><i/></div></div><div className="profile"><div className="avatar">S</div><div><b>Subhash</b><span>{t("परीक्षा अभ्यर्थी","Exam candidate")}</span></div><ShieldCheck size={17} className="profile-check"/></div></div>
      </aside>

      <section className="main">
        <header className="topbar"><div className="breadcrumb">{t("आपकी तैयारी","Your preparation")} <span>/</span> <b>{view === "test" ? t("मॉक टेस्ट","Mock test") : view === "result" ? t("रिज़ल्ट","Results") : view === "history" ? t("मेरे रिज़ल्ट","My results") : t("डैशबोर्ड","Dashboard")}</b></div><div className="top-actions"><span className="live-pill"><i/> {t("सिस्टम तैयार","SYSTEM READY")}</span><button className="lang-button" onClick={() => setLanguage(hi ? "en" : "hi")}><Languages size={16}/>{hi ? "हिंदी" : "English"}</button></div></header>

        {view === "home" && <div className="content">{storageMessage && <div className="bottom-note"><div className="note-icon"><Info size={18}/></div><div><b>{t("डेटा सेव स्थिति","Storage status")}</b><p>{storageMessage}</p></div></div>}
          <div className="welcome-row"><div><div className="eyebrow"><span className="eyebrow-line"/> {t("आपके लक्ष्य, आपकी मेहनत","YOUR GOALS. YOUR GRIT.")}</div><h1>{t("नमस्ते, सुभाष","Hello, Subhash")} <span className="wave">✦</span><br/><span className="muted-heading">{t("आज कुछ नया सीखें।","Ready to level up today?")}</span></h1><p className="intro">{t("अपनी तैयारी को परखें, कमज़ोर विषय पहचानें और हर टेस्ट के साथ बेहतर बनें।","Test your knowledge, spot weak areas, and get better with every attempt.")}</p></div><div className="hero-emblem"><div className="emblem-ring"><GraduationCap size={47}/><span>EXAM<br/>READY</span></div><div className="orbit-dot dot-one"/><div className="orbit-dot dot-two"/></div></div>
          <div className="stats-grid"><div className="stat-card"><div className="stat-top"><span>{t("कुल मॉक टेस्ट","MOCK TESTS")}</span><div className="stat-icon purple"><BookOpen size={18}/></div></div><div className="stat-value">{history.length.toString().padStart(2,"0")}<small> / 50</small></div><div className="stat-foot">{t("हर प्रयास मायने रखता है","Every attempt counts")}</div></div><div className="stat-card"><div className="stat-top"><span>{t("सर्वश्रेष्ठ स्कोर","BEST SCORE")}</span><div className="stat-icon gold"><Trophy size={18}/></div></div><div className="stat-value">{history.length ? Math.max(...history.map(h=>h.score)) : "—"}<small> / 10</small></div><div className="stat-foot">{t("अपना रिकॉर्ड तोड़ें","Beat your personal best")}</div></div><div className="stat-card"><div className="stat-top"><span>{t("औसत सटीकता","AVG. ACCURACY")}</span><div className="stat-icon green"><Target size={18}/></div></div><div className="stat-value">{history.length ? Math.round(history.reduce((a,h)=>a+h.accuracy,0)/history.length) : 0}<small>%</small></div><div className="stat-foot">{t("सही जवाबों का प्रतिशत","Correct answer rate")}</div></div></div>
          <div className="section-heading"><div><h2>{t("अपनी तैयारी शुरू करें","Pick up where you want to grow")}</h2><p>{t("छोटे कदम, बड़ी सफलता।","Focused practice makes progress.")}</p></div><span className="section-count">01 — 03</span></div>
          <div className="feature-grid"><article className="feature-card featured"><div className="feature-top"><div className="feature-icon"><ListChecks size={22}/></div><span className="tag">POPULAR</span></div><h3>{t("क्विक मॉक टेस्ट","Quick mock test")}</h3><p>{t("10 सवाल · 10 मिनट · तुरंत रिज़ल्ट","10 questions · 10 minutes · instant results")}</p><div className="feature-meta"><span><Clock3 size={14}/> 10 min</span><span><Target size={14}/> 10 marks</span></div><button className="primary-button" onClick={startTest}>{t("टेस्ट शुरू करें","Start mock test")}<ArrowRight size={17}/></button><div className="card-decoration">01</div></article><article className="feature-card"><div className="feature-top"><div className="feature-icon green-icon"><Target size={22}/></div><span className="tag tag-green">PRACTICE</span></div><h3>{t("स्मार्ट रिविज़न","Smart revision")}</h3><p>{t("गलत जवाबों की समीक्षा करें और कॉन्सेप्ट मज़बूत करें।","Review explanations and strengthen concepts.")}</p><div className="mini-progress"><span style={{width: history.length ? "65%" : "8%"}}/></div><div className="feature-meta"><span>{t("आपकी प्रगति","Your progress")}</span><span>{history.length ? "65%" : "0%"}</span></div><button className="secondary-button" onClick={() => setView("history")}>{t("रिज़ल्ट देखें","View results")}<ArrowRight size={16}/></button></article><article className="feature-card"><div className="feature-top"><div className="feature-icon blue-icon"><Globe2 size={22}/></div><span className="tag tag-blue">BILINGUAL</span></div><h3>{t("हिंदी + English","Hindi + English")}</h3><p>{t("अपनी सुविधा के अनुसार भाषा बदलें।","Switch between Hindi and English anytime.")}</p><div className="language-pills"><span>अ आ इ</span><span>ABC</span></div><div className="feature-meta"><span>{t("दोनों भाषाओं में सवाल","Questions in both languages")}</span></div><button className="secondary-button" onClick={() => setLanguage(hi ? "en" : "hi")}>{t("English में बदलें","Switch to हिंदी")}<Languages size={16}/></button></article></div>
          <div className="bottom-note"><div className="note-icon"><ShieldCheck size={18}/></div><div><b>{t("आपकी तैयारी, आपकी रफ़्तार","Your preparation, your pace")}</b><p>{t("यह डेमो प्लेटफॉर्म है। अभ्यास के लिए प्रश्न दिए गए हैं; आधिकारिक परीक्षा के लिए नवीनतम सिलेबस देखें।","This is a demo practice platform. Check the latest official syllabus for your target exam.")}</p></div></div>
        </div>}

        {view === "test" && <div className="content test-content"><div className="test-title-row"><div><div className="eyebrow"><span className="eyebrow-line"/> PRACTICE SESSION / 01</div><h1>{t("क्विक मॉक टेस्ट","Quick mock test")}</h1><p className="intro">{t("सभी सवाल हल करें और अपना सर्वश्रेष्ठ स्कोर बनाएँ।","Answer every question and aim for your personal best.")}</p></div><div className={"timer-card " + (seconds < 60 ? "timer-warning" : "")}><Clock3 size={19}/><div><small>{t("बचा हुआ समय","TIME LEFT")}</small><strong>{formatTime(seconds)}</strong></div></div></div><div className="test-progress"><div><span>{t("टेस्ट की प्रगति","TEST PROGRESS")}</span><b>{answered} / {testQuestions.length} {t("जवाब दिए","answered")}</b></div><div className="progress-track"><span style={{width: (answered/testQuestions.length*100)+"%"}}/></div></div>
          <div className="test-layout"><div className="question-panel"><div className="question-meta"><span className="question-number">QUESTION {String(q.id).padStart(2,"0")} <i/> {String(testQuestions.length).padStart(2,"0")}</span><span className="subject-chip">{q.subject}</span></div><h2>{hi ? q.hi : q.en}</h2><p className="question-hint">{t("सही विकल्प चुनें। आप अपना जवाब बदल सकते हैं।","Select one option. You can change your answer before submitting.")}</p><div className="options">{q.options.map((option,i)=><button key={option} className={"option " + (answers[q.id] === i ? "selected" : "")} onClick={() => chooseAnswer(i)}><span className="option-letter">{String.fromCharCode(65+i)}</span><span>{option}</span>{answers[q.id] === i ? <span className="radio-selected"/> : null}</button>)}</div>
          <div className="question-controls"><button className="secondary-button" disabled={current===0} onClick={() => setCurrent(c=>c-1)}><ChevronLeft size={17}/>{t("पिछला","Previous")}</button><button className={"review-button " + (review.includes(q.id) ? "review-on" : "")} onClick={toggleReview}><Flag size={16}/>{review.includes(q.id) ? t("रिव्यू हटाएँ","Unmark review") : t("रिव्यू के लिए","Mark for review")}</button>{current < testQuestions.length-1 ? <button className="primary-button next-button" onClick={() => setCurrent(c=>c+1)}>{t("अगला सवाल","Next question")}<ChevronRight size={17}/></button> : <button className="primary-button next-button" onClick={() => setShowSubmit(true)}>{t("टेस्ट सबमिट करें","Submit test")}<ArrowRight size={17}/></button>}</div></div>
          <aside className="question-nav"><div className="nav-heading"><h3>{t("सवालों की सूची","Question palette")}</h3><span>{answered}/10</span></div><p>{t("किसी सवाल पर जाने के लिए नंबर चुनें।","Tap a number to jump to a question.")}</p><div className="number-grid">{testQuestions.map((item,i)=><button key={item.id} onClick={() => setCurrent(i)} className={"number-cell " + (current===i ? "current" : "") + (answers[item.id] !== undefined ? " answered" : "") + (review.includes(item.id) ? " marked" : "")}>{String(item.id).padStart(2,"0")}{review.includes(item.id) && <i/>}</button>)}</div><div className="legend"><span><i className="legend-answered"/> {t("जवाब दिया","Answered")}</span><span><i className="legend-marked"/> {t("रिव्यू","Review")}</span><span><i className="legend-empty"/> {t("बाकी","Not answered")}</span></div><div className="nav-summary"><div><span>{t("जवाब दिए","Answered")}</span><b>{answered}</b></div><div><span>{t("बाकी सवाल","Remaining")}</span><b>{testQuestions.length-answered}</b></div><div><span>{t("रिव्यू के लिए","For review")}</span><b>{review.length}</b></div></div><button className="submit-full" onClick={() => setShowSubmit(true)}>{t("टेस्ट समाप्त करें","Finish test")}<ArrowRight size={16}/></button></aside></div>
          {showSubmit && <div className="modal-backdrop"><div className="confirm-modal"><div className="modal-icon"><Flag size={22}/></div><h2>{t("टेस्ट सबमिट करें?","Submit your test?")}</h2><p>{t("आपने","You have answered")} {answered} {t("में से 10 सवालों के जवाब दिए हैं। सबमिट करने के बाद जवाब नहीं बदल पाएँगे।","of 10 questions. You cannot change answers after submission.")}</p><div className="modal-actions"><button className="secondary-button" onClick={() => setShowSubmit(false)}>{t("वापस जाएँ","Go back")}</button><button className="primary-button" onClick={finishTest}>{t("हाँ, सबमिट करें","Yes, submit")}</button></div></div></div>}
        </div>}

        {view === "result" && result && <div className="content result-content"><div className="result-hero"><div className="result-trophy"><Trophy size={37}/></div><div className="eyebrow"><span className="eyebrow-line"/> SESSION COMPLETE</div><h1>{t("शानदार प्रयास, सुभाष!","Great effort, Subhash!")}</h1><p>{t("हर टेस्ट आपको आपके लक्ष्य के और करीब ले जाता है।","Every attempt takes you one step closer to your goal.")}</p><div className="score-circle"><div><strong>{result.score}<small>/{result.total_questions}</small></strong><span>{t("आपका स्कोर","YOUR SCORE")}</span></div></div></div><div className="result-stats"><div className="result-stat"><CheckCircle2 size={19}/><span>{t("सही जवाब","Correct")}</span><b>{result.correct}</b></div><div className="result-stat wrong-stat"><X size={19}/><span>{t("गलत जवाब","Incorrect")}</span><b>{result.wrong}</b></div><div className="result-stat unanswered-stat"><Clock3 size={19}/><span>{t("बिना जवाब","Unanswered")}</span><b>{result.unanswered}</b></div><div className="result-stat accuracy-stat"><Target size={19}/><span>{t("सटीकता","Accuracy")}</span><b>{result.accuracy}%</b></div></div><div className="review-panel"><div className="section-heading"><div><h2>{t("सवालों की समीक्षा","Review your answers")}</h2><p>{t("सही उत्तर और व्याख्या देखें।","See the correct answer and explanation.")}</p></div><span className="section-count">{result.total_questions} QUESTIONS</span></div>{testQuestions.map((item,i)=>{const a=answers[item.id]; const isRight=a===item.answer; return <div className="review-question" key={item.id}><div className={"review-status " + (a===undefined ? "status-empty" : isRight ? "status-right" : "status-wrong")}>{a===undefined ? "—" : isRight ? <Check size={16}/> : <X size={16}/>}</div><div className="review-body"><b>{i+1}. {hi ? item.hi : item.en}</b><span>{t("आपका जवाब:","Your answer:")} {a===undefined ? t("जवाब नहीं दिया","Not answered") : item.options[a]}</span><span className="correct-answer">{t("सही जवाब:","Correct answer:")} {item.options[item.answer]}</span><p>{item.explanation}</p></div></div>})}</div><div className="result-actions"><button className="secondary-button" onClick={() => setView("home")}><Home size={17}/>{t("डैशबोर्ड","Dashboard")}</button><button className="primary-button" onClick={startTest}><RotateCcw size={17}/>{t("फिर से टेस्ट दें","Retake test")}</button></div></div>}

        {view === "history" && <div className="content">{storageMessage && <div className="bottom-note"><div className="note-icon"><Info size={18}/></div><div><b>{t("डेटा सेव स्थिति","Storage status")}</b><p>{storageMessage}</p></div></div>}<div className="eyebrow"><span className="eyebrow-line"/> YOUR JOURNEY</div><h1>{t("आपके रिज़ल्ट","Your results")}</h1><p className="intro">{t("आपके हाल के मॉक टेस्ट और प्रगति यहाँ दिखाई देंगे।","Your recent mock test attempts and progress appear here.")}</p>{history.length ? <div className="history-list">{history.map((h,i)=><div className="history-item" key={i}><div className="history-icon"><Award size={21}/></div><div className="history-main"><b>{t("क्विक मॉक टेस्ट","Quick mock test")}</b><span>{t("प्रयास","Attempt")} {history.length-i} · {h.accuracy}% {t("सटीकता","accuracy")}</span></div><strong>{h.score}/10</strong><span className="history-grade">{h.score>=8?t("बहुत अच्छा","Great"):h.score>=5?t("अच्छा प्रयास","Good effort"):t("अभ्यास जारी रखें","Keep practicing")}</span></div>)}</div> : <div className="empty-state"><div className="empty-icon"><BookOpen size={28}/></div><h2>{t("आपका पहला टेस्ट इंतज़ार कर रहा है","Your first test is waiting")}</h2><p>{t("टेस्ट पूरा करने के बाद आपका स्कोर और विश्लेषण यहाँ दिखाई देगा।","Complete a mock test to see your score and analysis here.")}</p><button className="primary-button" onClick={startTest}>{t("पहला टेस्ट शुरू करें","Start your first test")}<ArrowRight size={17}/></button></div>}</div>}

        <footer className="footer"><span>© 2026 ExamPrep</span><span>{t("अभ्यास • प्रगति • सफलता","PRACTICE · PROGRESS · SUCCESS")}</span><span>{t("आपकी तैयारी जारी है","Keep showing up ✦")}</span></footer>
      </section>
    </main>
  );
}
