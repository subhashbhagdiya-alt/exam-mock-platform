"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { ArrowRight, Award, BookOpen, Check, CheckCircle2, ChevronLeft, ChevronRight, Clock3, Download, FileText, Flame, Flag, Globe2, GraduationCap, Home, Info, Languages, ListChecks, RotateCcw, Search, ShieldCheck, Settings, SlidersHorizontal, Sparkles, Target, Trophy, Upload, X } from "lucide-react";
import { scorePaperQuiz } from "../lib/paper-analysis-quiz.mjs";
import { MAX_PAPER_FILE_BYTES, isSupportedPaperFile } from "../lib/paper-analysis-upload.mjs";

const supabaseBrowser = (
  typeof window !== "undefined" &&
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
)
  ? createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    )
  : null;

async function hashRecoveryCode(code) {
  const data = new TextEncoder().encode(code.trim().toUpperCase());
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest)).map(byte => byte.toString(16).padStart(2, "0")).join("");
}

function getUserDisplayName(authUser) {
  const metadata = authUser?.user_metadata || {};
  const name = metadata.full_name || metadata.name || metadata.display_name;
  if (name && String(name).trim()) return String(name).trim();
  if (authUser?.email) return String(authUser.email).split("@")[0];
  return "अभ्यर्थी";
}

async function ensureSessionKey() {
  if (typeof window === "undefined") throw new Error("Browser session is not available");
  let key = window.localStorage.getItem("exam_prep_session_key");
  if (!key) {
    key = crypto.randomUUID();
    window.localStorage.setItem("exam_prep_session_key", key);
  }
  return key;
}
const QUESTION_LOCALIZATIONS = {
  "00276434-e4a5-4bfd-95d4-fbca1d811567": { hi: "भारतीय संविधान का कौन-सा अनुच्छेद मौलिक अधिकारों से संबंधित है?", optionsHi: ["अनुच्छेद 12–35", "अनुच्छेद 36–51", "अनुच्छेद 52–78", "अनुच्छेद 79–122"] },
  "248f4ea3-a93a-421f-ab19-432da695461f": { hi: "यदि A की आयु B की आयु से दोगुनी है और B की आयु 10 वर्ष है, तो A की आयु कितनी है?", en: "If A’s age is twice B’s age and B is 10 years old, A’s age is –", optionsHi: ["15", "20", "25", "30"], optionsEn: ["15", "20", "25", "30"] },
  "45648cdd-6d6b-42f0-93e5-c3ec89f43a72": { hi: "मध्य प्रदेश का पहला टाइगर रिज़र्व कौन-सा है?", optionsHi: ["पेंच", "कान्हा", "सतपुड़ा", "बांधवगढ़"] },
  "4580f8e0-a5b8-4a71-bf4a-2a7cacf240c5": { hi: "भारतीय विदेश व्यापार संस्थान (IIFT) ने किस देश में अपना पहला विदेशी कैंपस खोलने की घोषणा की?", optionsHi: ["सिंगापुर", "दक्षिण अफ्रीका", "ऑस्ट्रेलिया", "संयुक्त अरब अमीरात"] },
  "4c669579-6b68-4b65-8f54-0ebde21a30ce": { hi: "मानव शरीर में पूरे शरीर में रक्त पंप करने वाला अंग कौन-सा है?", optionsHi: ["फेफड़े", "गुर्दा", "हृदय", "यकृत"] },
  "be6fc4bd-42ca-44d9-8aeb-c9a9763aa0a0": { hi: "Heimtextil 2025 में भारत मंडप का उद्घाटन वस्त्र मंत्री ने किस शहर में किया था?", optionsHi: ["बर्लिन", "फ्रैंकफर्ट", "पेरिस", "लंदन"] },
  "c05e4790-153d-4758-a797-5dc3550ee815": { hi: "लोकमान्य बाल गंगाधर तिलक किन समाचारपत्रों के संस्थापक थे?", optionsHi: ["मराठा और केसरी", "अमृत बाज़ार पत्रिका", "इंडियन मिरर", "बंगाली टाइम्स"] },
  "daaed804-67f7-4d8e-ac32-5add037251b2": { hi: "जल का रासायनिक सूत्र क्या है?", optionsHi: ["CO₂", "H₂O", "O₂", "H₂SO₄"] },
  "efc1e502-5fd3-4c1f-a764-2272ce9c4d96": { hi: "गुरु शिखर किस पर्वत श्रेणी की सबसे ऊँची चोटी है?", optionsHi: ["पूर्वी घाट", "अरावली पर्वतमाला", "पश्चिमी घाट", "हिमालय"] },
  "f822b19a-7f9a-4eb1-b712-e784db06ad18": { hi: "प्रकाश-वर्ष किसकी इकाई है?", optionsHi: ["समय", "दूरी", "चाल", "प्रकाश की तीव्रता"] },
  "01330693-92e5-4866-9f7f-dac67fe8f2e2": { en: "What is the smaller angle between the hour and minute hands at 3:30?", optionsEn: ["75°","90°","105°","120°"] },
  "03c56ebf-9b0a-4002-b626-ea277d816f4e": { en: "Find the next number in the series: 2, 6, 18, 54, ?", optionsEn: ["108","124","162","216"] },
  "054cfd5c-0eb4-4830-b913-f6dc1c767da3": { en: "Kanha National Park is in which state?", optionsEn: ["Madhya Pradesh","Rajasthan","Gujarat","Maharashtra"] },
  "075da99c-a754-4a58-b6b5-ca9a30681b16": { en: "What is the boiling point of water at normal pressure?", optionsEn: ["50°C","75°C","100°C","120°C"] },
  "0ec50b92-692d-4168-abef-6697fb68c16c": { en: "Express 0.125 as a fraction.", optionsEn: ["1/4","1/8","1/10","1/12"] },
  "1499024a-573e-422c-a103-4a3420b496de": { en: "Find the next number in the series: 1, 4, 9, 16, ?", optionsEn: ["20","24","25","36"] },
  "16378740-202c-45dd-9a98-81acdb3c64df": { en: "When was India's First Five-Year Plan launched?", optionsEn: ["1947","1951","1956","1961"] },
  "1a48c8de-67b8-4c86-8ef5-b5ad8f9a15b0": { en: "What is the chemical formula of carbon dioxide?", optionsEn: ["CO","CO2","C2O","C2O2"] },
  "1b406b33-04d4-410a-bd75-859b2d79ab1e": { en: "What is the full form of WWW?", optionsEn: ["World Wide Web","World Web Window","Web World Wide","Wide World Web"] },
  "2113b4ad-1726-4016-a576-f9a3a7c1d113": { en: "What is the LCM of 8 and 12?", optionsEn: ["16","20","24","36"] },
  "22d453cf-b0f5-4617-a122-bcc468a5bc62": { en: "What is 25% of 240?", optionsEn: ["40","50","60","80"] },
  "22e2b058-fc92-4cfa-854d-7bb59c69d405": { en: "Where does the Narmada River originate?", optionsEn: ["Amarkantak","Pachmarhi","Maheshwar","Mandu"] },
  "25bef1a1-afdf-4db9-91ad-b2893a0ee2e8": { en: "When was the Reserve Bank of India established?", optionsEn: ["1935","1947","1950","1955"] },
  "2715bf2e-5fa8-4912-9044-18ffef8533b3": { en: "What is 125 + 275?", optionsEn: ["350","375","400","425"] },
  "290db196-3a40-4d8a-8691-6c3e7f154bfc": { en: "National Sports Day is celebrated on whose birth anniversary?", optionsEn: ["Major Dhyan Chand","Milkha Singh","Kapil Dev","Sachin Tendulkar"] },
  "2a7af760-ebf7-45ad-9cb6-5102519e3b4c": { en: "What is the retirement age of a Supreme Court judge in India?", optionsEn: ["60","62","65","70"] },
  "2abae215-63ab-4b72-a9dc-abb0320d32ac": { en: "What is 360 ÷ 9?", optionsEn: ["30","40","45","50"] },
  "2e1d506c-d510-4e95-a0f3-c52271e980fd": { en: "What is the HCF of 48 and 60?", optionsEn: ["6","12","18","24"] },
  "31bf3f27-f5df-4df9-a152-6b8267711757": { en: "What is a brother's son called in relation to him?", optionsEn: ["Sister's son (nephew)","Brother's son (nephew)","Maternal uncle","Paternal uncle"] },
  "34f6ff2a-cc43-4217-8508-7b0693f11e92": { en: "If PEN is coded as QFO, how will BOX be coded?", optionsEn: ["CPY","CQY","BPX","DOZ"] },
  "37f6f839-4304-4dda-b9ac-27f769202139": { en: "Can sound travel through a vacuum?", optionsEn: ["Yes, quickly","Yes, slowly","No, it cannot","Yes, faster than light"] },
  "38ad798d-317a-4f78-96e3-764213212999": { en: "What is the state flower of Madhya Pradesh?", optionsEn: ["Lotus","Palash (Flame-of-the-forest)","Rose","Champa"] },
  "3b1752dd-c478-49f9-b6cd-f253ec634661": { en: "Bandhavgarh National Park is in which state?", optionsEn: ["Madhya Pradesh","Uttar Pradesh","Bihar","Chhattisgarh"] },
  "42c60e45-d2ed-4871-9c59-a6115959603c": { en: "P is taller than Q, and Q is taller than R. Who is the tallest?", optionsEn: ["P","Q","R","Cannot be determined"] },
  "465bb7d3-894f-432d-8860-49eda5464a73": { en: "What is Mohan's sister's daughter to Mohan?", optionsEn: ["Sister's daughter (niece)","Brother's daughter (niece)","Maternal aunt","Sister"] },
  "4ae15aa4-5204-42da-b295-5a62be92e5f1": { en: "Ram walks 4 metres east and then 3 metres north. What is the straight-line distance from the starting point?", optionsEn: ["5 metres","6 metres","7 metres","8 metres"] },
  "4b96228e-a951-4006-83fc-d5fd7897ead0": { en: "The Green Revolution is mainly associated with what?", optionsEn: ["Industry","Agricultural production","Transport","Mining"] },
  "4d5d2e70-8b52-4747-b5b2-100bcf0cda21": { en: "Find the next number in the series: 4, 8, 12, 16, ?", optionsEn: ["18","20","22","24"] },
  "4de17f10-e8e8-4099-95c8-b8204ea02ad0": { en: "What is the SI unit of energy?", optionsEn: ["Newton","Joule","Watt","Pascal"] },
  "4e2b75b6-818f-4109-b60a-2850b2a2e138": { en: "Pachmarhi lies in which mountain range?", optionsEn: ["Himalayas","Satpura Range","Aravalli Range","Vindhya Range"] },
  "4e72c463-358d-4f4a-b7a4-7b40723bff5c": { en: "When is Constitution Day observed in India?", optionsEn: ["26 January","15 August","26 November","2 October"] },
  "51a2d4e9-143e-4548-b2d3-15db9e00b563": { en: "What is the normal term of the Lok Sabha?", optionsEn: ["4 years","5 years","6 years","7 years"] },
  "5290106c-f068-45d7-b147-ec7ba3688a30": { en: "What is 12% of ₹1,000?", optionsEn: ["₹100","₹110","₹120","₹125"] },
  "54505092-4e2c-4ff2-963d-304b76ed8223": { en: "Mohan is 8th from the top and 13th from the bottom in a class. How many students are there in total?", optionsEn: ["19","20","21","22"] },
  "5cb33249-288d-4726-980c-78fd9d105963": { en: "What is Bhopal famous for?", optionsEn: ["Upper and Lower Lakes","Dal Lake","Pushkar Lake","Chilika Lake"] },
  "5f771b86-645d-4228-88fb-6681e787da85": { en: "Which gas do humans primarily take in for respiration?", optionsEn: ["Nitrogen","Oxygen","Carbon dioxide","Hydrogen"] },
  "5fc6a41d-d6f0-4146-bed7-2aba6422150e": { en: "Who wrote India's national song, 'Vande Mataram'?", optionsEn: ["Bankim Chandra Chattopadhyay","Rabindranath Tagore","Maithili Sharan Gupt","Subhadra Kumari Chauhan"] },
  "65706543-40c3-41b8-9758-d1c7013aa012": { en: "What is the area of a square with a side of 10 cm?", optionsEn: ["40","80","100","120"] },
  "6a8eeef1-dd08-4196-9167-f1fb4207beb0": { en: "A circle has a radius of 7 cm. What is its diameter?", optionsEn: ["7","14","21","28"] },
  "6fd116bb-11c4-463b-b618-5770dee3054a": { en: "Which Constitutional Amendment is related to Panchayati Raj?", optionsEn: ["42nd","61st","73rd","86th"] },
  "72e9c3b0-5b0e-485b-b48a-19ebe0851fb7": { en: "What is the term of a Rajya Sabha member?", optionsEn: ["4 years","5 years","6 years","7 years"] },
  "75b0c3ce-7e16-43be-bd43-ada7ae4e452d": { en: "If 64 is divided in the ratio 3:5, what is the smaller part?", optionsEn: ["20","24","30","40"] },
  "771f6ec7-a8f2-4b3e-b445-16a6f0f80c7b": { en: "Which planet is third from the Sun?", optionsEn: ["Venus","Earth","Mars","Mercury"] },
  "7a6ae96a-41a0-41c4-bc19-4d1d0a3b4761": { en: "How many players from one team are on the field in hockey?", optionsEn: ["9","10","11","12"] },
  "7ab45389-0a9c-46da-9a34-49198dc80b55": { en: "What does CC stand for in email?", optionsEn: ["Carbon Copy","Computer Copy","Central Copy","Common Communication"] },
  "7ac57a23-5438-4a2c-ab9a-7a61c65c7af7": { en: "A person is facing south and turns left. Which direction are they facing?", optionsEn: ["East","West","North","South"] },
  "7e89606d-1e2b-4eeb-9641-1106b767e8d7": { en: "What is the chemical symbol for iron?", optionsEn: ["Ir","Fe","In","F"] },
  "7ed119cf-09b9-49a0-a5f9-b8e93db3a700": { en: "What is the SI unit of power?", optionsEn: ["Joule","Watt","Newton","Ohm"] },
  "85e51bb0-1b91-4def-8cf9-f6b37d353de4": { en: "How many teeth does an adult human normally have?", optionsEn: ["28","30","32","36"] },
  "8a871a4a-aad3-4768-be22-b33a333e960c": { en: "If A = 1 and B = 2, what is the sum of CAT?", optionsEn: ["22","24","26","28"] },
  "8d6112f1-9e93-436b-bbc5-63329d7e05a9": { en: "What is the approximate normal temperature of the human body?", optionsEn: ["27°C","37°C","47°C","57°C"] },
  "90d0811a-2624-4a8c-b96d-99642e1d3246": { en: "What is 7 × 8?", optionsEn: ["54","56","58","64"] },
  "94c8592a-4cad-43a1-a3ca-88baf093155a": { en: "In which Part of the Indian Constitution are the emergency provisions?", optionsEn: ["Part XVIII","Part III","Part IV","Part IX"] },
  "96f14676-8748-423a-809c-4887af20e046": { en: "In which year was the United Nations established?", optionsEn: ["1919","1945","1950","1962"] },
  "97bcc1da-d429-4308-a303-db83912e4980": { en: "What is the average of 15, 20, 25 and 30?", optionsEn: ["20","22.5","25","27.5"] },
  "991482db-8c11-4048-9dbc-db16e169e854": { en: "What colour does a base turn red litmus paper?", optionsEn: ["Red","Blue","Green","Yellow"] },
  "9e39c85f-e87b-4795-a2e3-4ef16878a3a3": { en: "What is 2/5 expressed as a percentage?", optionsEn: ["20%","25%","40%","50%"] },
  "9ee92455-c740-41cb-a999-0a4cee5d5374": { en: "What are the two Houses of the Parliament of India?", optionsEn: ["Lok Sabha and Legislative Assembly","Lok Sabha and Rajya Sabha","Rajya Sabha and Legislative Council","Legislative Assembly and Legislative Council"] },
  "9f98f80e-d852-4040-90ac-1617b2ab5a59": { en: "Which computer memory stores permanent instructions?", optionsEn: ["RAM","ROM","Cache","Register"] },
  "a034a36c-42f0-4d74-b054-26f78705c5d8": { en: "What is the price after a 5% increase on ₹2,000?", optionsEn: ["₹2,050","₹2,100","₹2,150","₹2,200"] },
  "a338dc32-2556-4cf3-bcc4-d50560b9667d": { en: "What is the national animal of India?", optionsEn: ["Lion","Tiger","Elephant","Peacock"] },
  "a374d81e-3cab-4334-b10d-ef07e4d953cc": { en: "How many rings are there in the Olympic symbol?", optionsEn: ["4","5","6","7"] },
  "ab058a09-2e40-4fb2-a30b-04d29b5db193": { en: "Where does the digestion of food begin?", optionsEn: ["Stomach","Mouth","Small intestine","Large intestine"] },
  "ab3ee3a1-5411-4d89-a633-914f43fc3005": { en: "What is 900 − 365?", optionsEn: ["525","535","545","565"] },
  "abe85fc0-6f67-448f-abdf-d08dca5728e2": { en: "What is Earth's natural satellite?", optionsEn: ["Sun","Moon","Mars","Venus"] },
  "b0aea42b-2e61-4e76-a45b-1aa48823c627": { en: "When was Madhya Pradesh formed in its present form?", optionsEn: ["1 November 1956","15 August 1947","26 January 1950","1 November 2000"] },
  "b247494d-599c-4ace-ad7a-04d980b49ada": { en: "Which organ is primarily affected by tuberculosis?", optionsEn: ["Lungs","Skin","Heart","Kidneys"] },
  "ba062b1d-140b-4ab4-8547-b97255389dbf": { en: "What is the national flower of India?", optionsEn: ["Rose","Lotus","Marigold","Champa"] },
  "bb3cdcad-f23c-4dcf-82e4-62d452b574be": { en: "Today is Friday. What day will it be 12 days later?", optionsEn: ["Monday","Wednesday","Tuesday","Thursday"] },
  "c00e1ab5-9913-498d-ba19-6d5c354a37b3": { en: "What is 15 × 12?", optionsEn: ["150","170","180","190"] },
  "c79026bc-2d46-44c3-8ab3-a612738b9282": { en: "What is the price of an item after a 15% discount on ₹600?", optionsEn: ["₹490","₹500","₹510","₹520"] },
  "cf74c4f2-811a-4c18-83aa-58ff1db0bad3": { en: "If x + 7 = 19, what is x?", optionsEn: ["10","11","12","13"] },
  "d11d2b54-f281-43d6-a345-52f2ce09fe4f": { en: "What is the unit of electric voltage?", optionsEn: ["Ampere","Volt","Ohm","Watt"] },
  "d1e11e29-0aca-4e40-a4f1-e78d2c318019": { en: "What is India's national bird?", optionsEn: ["Peacock","Sarus crane","Parrot","Swan"] },
  "d5ef1134-9587-467d-97dd-ae62f4958154": { en: "Which parasite causes malaria?", optionsEn: ["Plasmodium","Virus","E. coli","Fungus"] },
  "d7fdb949-2255-4305-9dd9-99ef1d832749": { en: "If all roses are flowers, which conclusion is certain?", optionsEn: ["All roses are red","Some roses are red","All roses are flowers","No rose is a flower"] },
  "d9531625-797b-4692-b5b3-2b6baf8dc35f": { en: "What is the state tree of Madhya Pradesh?", optionsEn: ["Banyan","Neem","Sal","Peepal"] },
  "da4338c9-f648-45d7-888b-7ead62cf1d1c": { en: "A family has a father, a mother and two sons. How many members are there in total?", optionsEn: ["2","3","4","5"] },
  "db84334c-0d00-4590-ab45-278a2c65e2a5": { en: "What is the perimeter of a rectangle 12 cm long and 5 cm wide?", optionsEn: ["17","24","34","60"] },
  "db88ede4-00fb-4e63-9258-cfb1d4eea274": { en: "In which Part of the Constitution are Fundamental Duties listed?", optionsEn: ["Part III","Part IV-A","Part V","Part VI"] },
  "ddf9bcde-54d4-452d-8165-44366b74c3b7": { en: "What gives blood its red colour?", optionsEn: ["Chlorophyll","Hemoglobin","Insulin","Melanin"] },
  "de7ffb49-e196-44e2-aa44-a7e359fcf38e": { en: "What is the SI unit of pressure?", optionsEn: ["Pascal","Volt","Joule","Hertz"] },
  "e15a8f3f-1285-4480-8574-061246b7ecf1": { en: "What is the simple interest on ₹800 at 5% for one year?", optionsEn: ["₹20","₹40","₹50","₹80"] },
  "e3581c6f-da0e-4d9d-adc7-3bd0fc5b1463": { en: "What is the chemical symbol for gold?", optionsEn: ["Ag","Au","Gd","Go"] },
  "e700858a-0a0d-41b6-9da5-b31275bafa2a": { en: "Who appoints the Governor of a state in India?", optionsEn: ["Prime Minister","Chief Minister","President","Chief Justice"] },
  "e791c87a-ac89-4c56-a736-ec2a21d26282": { en: "Which tissue mainly transports water in plants?", optionsEn: ["Phloem","Xylem","Cambium","Epidermis"] },
  "e7c1e637-2dae-4da9-a576-23a48985fd12": { en: "If a job is completed in 12 days at a constant rate, what fraction of the work is completed each day?", optionsEn: ["1/6","1/10","1/12","1/24"] },
  "ea955d38-b420-4637-869e-375991832294": { en: "Who designed the national flag of India?", optionsEn: ["Pingali Venkayya","Rabindranath Tagore","Bankim Chandra Chattopadhyay","Abanindranath Tagore"] },
  "eb884c7a-45f8-4a1f-b0cf-79a398d758dc": { en: "An item was bought for ₹400 and sold for ₹460. What was the profit?", optionsEn: ["₹40","₹50","₹60","₹70"] },
  "ec866180-3579-406a-8637-d8ad4eb94e2c": { en: "When is World Environment Day observed?", optionsEn: ["5 June","15 August","2 October","22 April"] },
  "ed3b3f09-eee3-4ff7-a244-0bc6a7e43e0e": { en: "Which is the highest mountain peak located in India?", optionsEn: ["Kangchenjunga","Nanda Devi","Anamudi","Dhaulagiri"] },
  "efedff5b-cc7d-4df1-bce8-e25d0cae358b": { en: "If 3x = 27, what is x?", optionsEn: ["6","7","8","9"] },
  "f007263a-f53c-4ce6-a42a-c47502476f6e": { en: "What is the usual taste of an acid?", optionsEn: ["Sweet","Sour","Bitter","Salty"] },
  "f0326cc3-6f0a-4dd4-aaad-fc598fb8ecf7": { en: "What is the main function of the kidneys?", optionsEn: ["Pump blood","Filter blood","Produce oxygen","Digest food"] },
  "f1b5f9c8-5b32-4eb5-a585-5bbff9fbb748": { en: "Find the next number in the series: 81, 27, 9, 3, ?", optionsEn: ["0","1","2","6"] },
  "f324b0f7-8717-4381-9e40-1e7091dbac0d": { en: "Which Constitutional Amendment is related to municipalities?", optionsEn: ["52nd","73rd","74th","101st"] },
  "f4429384-e5e0-4d49-a513-ed16d6299d67": { en: "How is India described in the Preamble to the Constitution?", optionsEn: ["Monarchy","Socialist Democratic Republic","Military State","Federal Monarchy"] },
  "f4c5e283-f03e-4dc7-9c19-b266006b9d1e": { en: "How far does an object travel in 30 minutes at 72 km/h?", optionsEn: ["18 km","24 km","36 km","42 km"] },
  "f95745a0-28f8-45ba-a832-f309409e4642": { en: "What is the minimum voting age in India?", optionsEn: ["16","18","21","25"] },
  "fcac09fe-c0ea-44b2-9812-ba85c9149309": { en: "Ujjain is situated on the bank of which river?", optionsEn: ["Narmada","Shipra","Chambal","Tapti"] }
};

const QUESTION_OPTIONS_HI = {
  "01330693-92e5-4866-9f7f-dac67fe8f2e2": [
    "75°",
    "90°",
    "105°",
    "120°"
  ],
  "03c56ebf-9b0a-4002-b626-ea277d816f4e": [
    "108",
    "124",
    "162",
    "216"
  ],
  "054cfd5c-0eb4-4830-b913-f6dc1c767da3": [
    "मध्य प्रदेश",
    "राजस्थान",
    "गुजरात",
    "महाराष्ट्र"
  ],
  "075da99c-a754-4a58-b6b5-ca9a30681b16": [
    "50°C",
    "75°C",
    "100°C",
    "120°C"
  ],
  "0ec50b92-692d-4168-abef-6697fb68c16c": [
    "1/4",
    "1/8",
    "1/10",
    "1/12"
  ],
  "1499024a-573e-422c-a103-4a3420b496de": [
    "20",
    "24",
    "25",
    "36"
  ],
  "16378740-202c-45dd-9a98-81acdb3c64df": [
    "1947",
    "1951",
    "1956",
    "1961"
  ],
  "1a48c8de-67b8-4c86-8ef5-b5ad8f9a15b0": [
    "CO",
    "CO₂",
    "C₂O",
    "C₂O₂"
  ],
  "1b406b33-04d4-410a-bd75-859b2d79ab1e": [
    "वर्ल्ड वाइड वेब",
    "वर्ल्ड वेब विंडो",
    "वेब वर्ल्ड वाइड",
    "वाइड वर्ल्ड वेब"
  ],
  "2113b4ad-1726-4016-a576-f9a3a7c1d113": [
    "16",
    "20",
    "24",
    "36"
  ],
  "22d453cf-b0f5-4617-a122-bcc468a5bc62": [
    "40",
    "50",
    "60",
    "80"
  ],
  "22e2b058-fc92-4cfa-854d-7bb59c69d405": [
    "अमरकंटक",
    "पचमढ़ी",
    "महेश्वर",
    "मांडू"
  ],
  "25bef1a1-afdf-4db9-91ad-b2893a0ee2e8": [
    "1935",
    "1947",
    "1950",
    "1955"
  ],
  "2715bf2e-5fa8-4912-9044-18ffef8533b3": [
    "350",
    "375",
    "400",
    "425"
  ],
  "290db196-3a40-4d8a-8691-6c3e7f154bfc": [
    "मेजर ध्यानचंद",
    "मिल्खा सिंह",
    "कपिल देव",
    "सचिन तेंदुलकर"
  ],
  "2a7af760-ebf7-45ad-9cb6-5102519e3b4c": [
    "60",
    "62",
    "65",
    "70"
  ],
  "2abae215-63ab-4b72-a9dc-abb0320d32ac": [
    "30",
    "40",
    "45",
    "50"
  ],
  "2e1d506c-d510-4e95-a0f3-c52271e980fd": [
    "6",
    "12",
    "18",
    "24"
  ],
  "31bf3f27-f5df-4df9-a152-6b8267711757": [
    "बहन का बेटा (भांजा)",
    "भाई का बेटा (भतीजा)",
    "मामा",
    "चाचा/ताऊ"
  ],
  "34f6ff2a-cc43-4217-8508-7b0693f11e92": [
    "CPY",
    "CQY",
    "BPX",
    "DOZ"
  ],
  "37f6f839-4304-4dda-b9ac-27f769202139": [
    "हाँ, तेज़ी से",
    "हाँ, धीरे-धीरे",
    "नहीं, ध्वनि यात्रा नहीं कर सकती",
    "हाँ, प्रकाश से तेज़"
  ],
  "38ad798d-317a-4f78-96e3-764213212999": [
    "कमल",
    "पलाश (वन का ज्वाला-पुष्प)",
    "गुलाब",
    "चंपा"
  ],
  "3b1752dd-c478-49f9-b6cd-f253ec634661": [
    "मध्य प्रदेश",
    "उत्तर प्रदेश",
    "बिहार",
    "छत्तीसगढ़"
  ],
  "42c60e45-d2ed-4871-9c59-a6115959603c": [
    "P",
    "Q",
    "R",
    "निर्धारित नहीं किया जा सकता"
  ],
  "465bb7d3-894f-432d-8860-49eda5464a73": [
    "बहन की बेटी (भांजी)",
    "भाई की बेटी (भतीजी)",
    "मौसी",
    "बहन"
  ],
  "4ae15aa4-5204-42da-b295-5a62be92e5f1": [
    "5 मीटर",
    "6 मीटर",
    "7 मीटर",
    "8 मीटर"
  ],
  "4b96228e-a951-4006-83fc-d5fd7897ead0": [
    "उद्योग",
    "कृषि उत्पादन",
    "परिवहन",
    "खनन"
  ],
  "4d5d2e70-8b52-4747-b5b2-100bcf0cda21": [
    "18",
    "20",
    "22",
    "24"
  ],
  "4de17f10-e8e8-4099-95c8-b8204ea02ad0": [
    "न्यूटन",
    "जूल",
    "वाट",
    "पास्कल"
  ],
  "4e2b75b6-818f-4109-b60a-2850b2a2e138": [
    "हिमालय",
    "सतपुड़ा श्रेणी",
    "अरावली श्रेणी",
    "विंध्य श्रेणी"
  ],
  "4e72c463-358d-4f4a-b7a4-7b40723bff5c": [
    "26 जनवरी",
    "15 अगस्त",
    "26 नवंबर",
    "2 अक्टूबर"
  ],
  "51a2d4e9-143e-4548-b2d3-15db9e00b563": [
    "4 वर्ष",
    "5 वर्ष",
    "6 वर्ष",
    "7 वर्ष"
  ],
  "5290106c-f068-45d7-b147-ec7ba3688a30": [
    "₹100",
    "₹110",
    "₹120",
    "₹125"
  ],
  "54505092-4e2c-4ff2-963d-304b76ed8223": [
    "19",
    "20",
    "21",
    "22"
  ],
  "5cb33249-288d-4726-980c-78fd9d105963": [
    "बड़ा तालाब और छोटा तालाब",
    "डल झील",
    "पुष्कर झील",
    "चिलिका झील"
  ],
  "5f771b86-645d-4228-88fb-6681e787da85": [
    "नाइट्रोजन",
    "ऑक्सीजन",
    "कार्बन डाइऑक्साइड",
    "हाइड्रोजन"
  ],
  "5fc6a41d-d6f0-4146-bed7-2aba6422150e": [
    "बंकिम चंद्र चट्टोपाध्याय",
    "रवींद्रनाथ टैगोर",
    "मैथिलीशरण गुप्त",
    "सुभद्रा कुमारी चौहान"
  ],
  "65706543-40c3-41b8-9758-d1c7013aa012": [
    "40",
    "80",
    "100",
    "120"
  ],
  "6a8eeef1-dd08-4196-9167-f1fb4207beb0": [
    "7",
    "14",
    "21",
    "28"
  ],
  "6fd116bb-11c4-463b-b618-5770dee3054a": [
    "42वाँ",
    "61वाँ",
    "73वाँ",
    "86वाँ"
  ],
  "72e9c3b0-5b0e-485b-b48a-19ebe0851fb7": [
    "4 वर्ष",
    "5 वर्ष",
    "6 वर्ष",
    "7 वर्ष"
  ],
  "75b0c3ce-7e16-43be-bd43-ada7ae4e452d": [
    "20",
    "24",
    "30",
    "40"
  ],
  "771f6ec7-a8f2-4b3e-b445-16a6f0f80c7b": [
    "शुक्र",
    "पृथ्वी",
    "मंगल",
    "बुध"
  ],
  "7a6ae96a-41a0-41c4-bc19-4d1d0a3b4761": [
    "9",
    "10",
    "11",
    "12"
  ],
  "7ab45389-0a9c-46da-9a34-49198dc80b55": [
    "कार्बन कॉपी",
    "कंप्यूटर कॉपी",
    "सेंट्रल कॉपी",
    "सामान्य संचार"
  ],
  "7ac57a23-5438-4a2c-ab9a-7a61c65c7af7": [
    "पूर्व",
    "पश्चिम",
    "उत्तर",
    "दक्षिण"
  ],
  "7e89606d-1e2b-4eeb-9641-1106b767e8d7": [
    "Ir",
    "Fe",
    "In",
    "F"
  ],
  "7ed119cf-09b9-49a0-a5f9-b8e93db3a700": [
    "जूल",
    "वाट",
    "न्यूटन",
    "ओम"
  ],
  "85e51bb0-1b91-4def-8cf9-f6b37d353de4": [
    "28",
    "30",
    "32",
    "36"
  ],
  "8a871a4a-aad3-4768-be22-b33a333e960c": [
    "22",
    "24",
    "26",
    "28"
  ],
  "8d6112f1-9e93-436b-bbc5-63329d7e05a9": [
    "27°C",
    "37°C",
    "47°C",
    "57°C"
  ],
  "90d0811a-2624-4a8c-b96d-99642e1d3246": [
    "54",
    "56",
    "58",
    "64"
  ],
  "94c8592a-4cad-43a1-a3ca-88baf093155a": [
    "भाग XVIII",
    "भाग III",
    "भाग IV",
    "भाग IX"
  ],
  "96f14676-8748-423a-809c-4887af20e046": [
    "1919",
    "1945",
    "1950",
    "1962"
  ],
  "97bcc1da-d429-4308-a303-db83912e4980": [
    "20",
    "22.5",
    "25",
    "27.5"
  ],
  "991482db-8c11-4048-9dbc-db16e169e854": [
    "लाल",
    "नीला",
    "हरा",
    "पीला"
  ],
  "9e39c85f-e87b-4795-a2e3-4ef16878a3a3": [
    "20%",
    "25%",
    "40%",
    "50%"
  ],
  "9ee92455-c740-41cb-a999-0a4cee5d5374": [
    "लोकसभा और विधानसभा",
    "लोकसभा और राज्यसभा",
    "राज्यसभा और विधान परिषद",
    "विधानसभा और विधान परिषद"
  ],
  "9f98f80e-d852-4040-90ac-1617b2ab5a59": [
    "RAM",
    "ROM",
    "कैश",
    "रजिस्टर"
  ],
  "a034a36c-42f0-4d74-b054-26f78705c5d8": [
    "₹2,050",
    "₹2,100",
    "₹2,150",
    "₹2,200"
  ],
  "a338dc32-2556-4cf3-bcc4-d50560b9667d": [
    "शेर",
    "बाघ",
    "हाथी",
    "मोर"
  ],
  "a374d81e-3cab-4334-b10d-ef07e4d953cc": [
    "4",
    "5",
    "6",
    "7"
  ],
  "ab058a09-2e40-4fb2-a30b-04d29b5db193": [
    "पेट",
    "मुँह",
    "छोटी आँत",
    "बड़ी आँत"
  ],
  "ab3ee3a1-5411-4d89-a633-914f43fc3005": [
    "525",
    "535",
    "545",
    "565"
  ],
  "abe85fc0-6f67-448f-abdf-d08dca5728e2": [
    "सूर्य",
    "चंद्रमा",
    "मंगल",
    "शुक्र"
  ],
  "b0aea42b-2e61-4e76-a45b-1aa48823c627": [
    "1 नवंबर 1956",
    "15 अगस्त 1947",
    "26 जनवरी 1950",
    "1 नवंबर 2000"
  ],
  "b247494d-599c-4ace-ad7a-04d980b49ada": [
    "फेफड़े",
    "त्वचा",
    "हृदय",
    "गुर्दे"
  ],
  "ba062b1d-140b-4ab4-8547-b97255389dbf": [
    "गुलाब",
    "कमल",
    "गेंदा",
    "चंपा"
  ],
  "bb3cdcad-f23c-4dcf-82e4-62d452b574be": [
    "सोमवार",
    "बुधवार",
    "मंगलवार",
    "गुरुवार"
  ],
  "c00e1ab5-9913-498d-ba19-6d5c354a37b3": [
    "150",
    "170",
    "180",
    "190"
  ],
  "c79026bc-2d46-44c3-8ab3-a612738b9282": [
    "₹490",
    "₹500",
    "₹510",
    "₹520"
  ],
  "cf74c4f2-811a-4c18-83aa-58ff1db0bad3": [
    "10",
    "11",
    "12",
    "13"
  ],
  "d11d2b54-f281-43d6-a345-52f2ce09fe4f": [
    "एम्पियर",
    "वोल्ट",
    "ओम",
    "वाट"
  ],
  "d1e11e29-0aca-4e40-a4f1-e78d2c318019": [
    "मोर",
    "सारस",
    "तोता",
    "हंस"
  ],
  "d5ef1134-9587-467d-97dd-ae62f4958154": [
    "प्लाज्मोडियम",
    "वायरस",
    "ई. कोलाई",
    "कवक"
  ],
  "d7fdb949-2255-4305-9dd9-99ef1d832749": [
    "सभी गुलाब लाल हैं",
    "कुछ गुलाब लाल हैं",
    "सभी गुलाब फूल हैं",
    "कोई गुलाब फूल नहीं है"
  ],
  "d9531625-797b-4692-b5b3-2b6baf8dc35f": [
    "बरगद",
    "नीम",
    "साल",
    "पीपल"
  ],
  "da4338c9-f648-45d7-888b-7ead62cf1d1c": [
    "2",
    "3",
    "4",
    "5"
  ],
  "db84334c-0d00-4590-ab45-278a2c65e2a5": [
    "17",
    "24",
    "34",
    "60"
  ],
  "db88ede4-00fb-4e63-9258-cfb1d4eea274": [
    "भाग III",
    "भाग IV-A (भाग 4-क)",
    "भाग V",
    "भाग VI"
  ],
  "ddf9bcde-54d4-452d-8165-44366b74c3b7": [
    "क्लोरोफिल",
    "हीमोग्लोबिन",
    "इंसुलिन",
    "मेलेनिन"
  ],
  "de7ffb49-e196-44e2-aa44-a7e359fcf38e": [
    "पास्कल",
    "वोल्ट",
    "जूल",
    "हर्ट्ज़"
  ],
  "e15a8f3f-1285-4480-8574-061246b7ecf1": [
    "₹20",
    "₹40",
    "₹50",
    "₹80"
  ],
  "e3581c6f-da0e-4d9d-adc7-3bd0fc5b1463": [
    "Ag",
    "Au",
    "Gd",
    "Go"
  ],
  "e700858a-0a0d-41b6-9da5-b31275bafa2a": [
    "प्रधानमंत्री",
    "मुख्यमंत्री",
    "राष्ट्रपति",
    "मुख्य न्यायाधीश"
  ],
  "e791c87a-ac89-4c56-a736-ec2a21d26282": [
    "फ्लोएम",
    "जाइलम",
    "कैम्बियम",
    "एपिडर्मिस"
  ],
  "e7c1e637-2dae-4da9-a576-23a48985fd12": [
    "1/6",
    "1/10",
    "1/12",
    "1/24"
  ],
  "ea955d38-b420-4637-869e-375991832294": [
    "पिंगली वेंकैया",
    "रवींद्रनाथ टैगोर",
    "बंकिम चंद्र चट्टोपाध्याय",
    "अवनींद्रनाथ टैगोर"
  ],
  "eb884c7a-45f8-4a1f-b0cf-79a398d758dc": [
    "₹40",
    "₹50",
    "₹60",
    "₹70"
  ],
  "ec866180-3579-406a-8637-d8ad4eb94e2c": [
    "5 जून",
    "15 अगस्त",
    "2 अक्टूबर",
    "22 अप्रैल"
  ],
  "ed3b3f09-eee3-4ff7-a244-0bc6a7e43e0e": [
    "कंचनजंघा",
    "नंदा देवी",
    "अनामुड़ी",
    "धौलागिरी"
  ],
  "efedff5b-cc7d-4df1-bce8-e25d0cae358b": [
    "6",
    "7",
    "8",
    "9"
  ],
  "f007263a-f53c-4ce6-a42a-c47502476f6e": [
    "मीठा",
    "खट्टा",
    "कड़वा",
    "नमकीन"
  ],
  "f0326cc3-6f0a-4dd4-aaad-fc598fb8ecf7": [
    "रक्त पंप करना",
    "रक्त को छानना",
    "ऑक्सीजन बनाना",
    "भोजन पचाना"
  ],
  "f1b5f9c8-5b32-4eb5-a585-5bbff9fbb748": [
    "0",
    "1",
    "2",
    "6"
  ],
  "f324b0f7-8717-4381-9e40-1e7091dbac0d": [
    "52वाँ",
    "73वाँ",
    "74वाँ",
    "101वाँ"
  ],
  "f4429384-e5e0-4d49-a513-ed16d6299d67": [
    "राजतंत्र",
    "समाजवादी लोकतांत्रिक गणराज्य",
    "सैन्य राज्य",
    "संघीय राजतंत्र"
  ],
  "f4c5e283-f03e-4dc7-9c19-b266006b9d1e": [
    "18 किमी",
    "24 किमी",
    "36 किमी",
    "42 किमी"
  ],
  "f95745a0-28f8-45ba-a832-f309409e4642": [
    "16",
    "18",
    "21",
    "25"
  ],
  "fcac09fe-c0ea-44b2-9812-ba85c9149309": [
    "नर्मदा",
    "क्षिप्रा",
    "चंबल",
    "ताप्ती"
  ]
};

function getQuestionSourceLabel(sourceType, hi) {
  const labels = {
    pyq: hi ? "पिछले वर्ष का प्रश्न" : "PREVIOUS YEAR",
    official: hi ? "आधिकारिक" : "OFFICIAL",
    memory_based: hi ? "स्मृति-आधारित" : "MEMORY-BASED",
    curated: hi ? "अभ्यास प्रश्न" : "PRACTICE"
  };
  return labels[sourceType] || (hi ? "अभ्यास प्रश्न" : "PRACTICE");
}

const formatTime = (seconds) => {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return m + ":" + s;
};

export default function HomePage() {
  const [language, setLanguage] = useState("en");
  const [view, setView] = useState("boards");
  const [settingsSection, setSettingsSection] = useState("profile");
  const [answers, setAnswers] = useState({});
  const [review, setReview] = useState([]);
  const [current, setCurrent] = useState(0);
  const [seconds, setSeconds] = useState(600);
  const [result, setResult] = useState(null);
  const [reviewAnswers, setReviewAnswers] = useState({});
  const [testSessionId, setTestSessionId] = useState("");
  const [testSessionKey, setTestSessionKey] = useState("");
  const [grading, setGrading] = useState(false);
  const autoSubmitAttempted = useRef(false);
  const [history, setHistory] = useState([]);
  const [storageMessage, setStorageMessage] = useState("");
  const [showSubmit, setShowSubmit] = useState(false);
  const [testQuestions, setTestQuestions] = useState([]);
  const [examConfig, setExamConfig] = useState({ total_questions: 10, duration_minutes: 10, marks_per_question: 1, negative_marks: 0, passing_percentage: 33 });
  const [examName, setExamName] = useState("MPESB Mock Test");
  const [examId, setExamId] = useState(null);
  const [exams, setExams] = useState([]);
  const [examsLoading, setExamsLoading] = useState(true);
  const [selectedExam, setSelectedExam] = useState("mpesb");
  const [jobTracks, setJobTracks] = useState([]);
  const [jobTracksLoading, setJobTracksLoading] = useState(true);
  const [selectedJobTrack, setSelectedJobTrack] = useState("mpesb-common");
  const [expandedJobTrack, setExpandedJobTrack] = useState(null);
  const [openExamGroup, setOpenExamGroup] = useState("MPESB");
  const [examFilter, setExamFilter] = useState("all");
  const [examQuery, setExamQuery] = useState("");
  const [isOnline, setIsOnline] = useState(true);
  const [user, setUser] = useState(null);
  const [profileName, setProfileName] = useState("");
  const [needsProfileName, setNeedsProfileName] = useState(false);
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [authMethod, setAuthMethod] = useState("email");
  const [otp, setOtp] = useState("");
  const [otpCooldown, setOtpCooldown] = useState(0);
  const [recoveryCode, setRecoveryCode] = useState("");
  const [authStep, setAuthStep] = useState("phone");
  const [authMessage, setAuthMessage] = useState("");
  const [paperFile, setPaperFile] = useState(null);
  const [paperAnalysis, setPaperAnalysis] = useState(null);
  const [paperAnalysisError, setPaperAnalysisError] = useState("");
  const [paperAnalysisBusy, setPaperAnalysisBusy] = useState(false);
  const [paperQuizAnswers, setPaperQuizAnswers] = useState({});
  const [paperQuizSubmitted, setPaperQuizSubmitted] = useState(false);
  const [paperDragActive, setPaperDragActive] = useState(false);
  const paperFileInputRef = useRef(null);
  const paperQuizScore = scorePaperQuiz(paperAnalysis?.mcqs, paperQuizAnswers);
  const [practiceQuestionCount, setPracticeQuestionCount] = useState(30);
  const [practiceDuration, setPracticeDuration] = useState(10);
  const [selectedSubject, setSelectedSubject] = useState("all");
  const [selectedTopic, setSelectedTopic] = useState("all");
  const [availableQuestionCount, setAvailableQuestionCount] = useState(0);
  const [questionCatalogMeta, setQuestionCatalogMeta] = useState({ loaded: false, examSlug: "", subjects: [], subjectTopics: [] });
  const [questionBankLoading, setQuestionBankLoading] = useState(false);
  const [questionLoadError, setQuestionLoadError] = useState("");
  const [nativeSimStatus, setNativeSimStatus] = useState("web");
  const [trustedDeviceVerified, setTrustedDeviceVerified] = useState(false);
  const [themeMode, setThemeMode] = useState("dark");
  const [splashVisible, setSplashVisible] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const menuButtonRef = useRef(null);
  const [showDashboardOptions, setShowDashboardOptions] = useState(false);
  const [testFocusWarning, setTestFocusWarning] = useState(false);
  useEffect(() => {
    if (!menuOpen || typeof document === "undefined") return undefined;
    const closeOnOutsideTap = (event) => {
      if (menuRef.current?.contains(event.target) || menuButtonRef.current?.contains(event.target)) return;
      setMenuOpen(false);
    };
    const closeOnEscape = (event) => { if (event.key === "Escape") setMenuOpen(false); };
    document.addEventListener("pointerdown", closeOnOutsideTap, true);
    document.addEventListener("keydown", closeOnEscape);
    return () => { document.removeEventListener("pointerdown", closeOnOutsideTap, true); document.removeEventListener("keydown", closeOnEscape); };
  }, [menuOpen]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = localStorage.getItem("exam_prep_theme");
    if (saved === "light" || saved === "dark" || saved === "system") window.setTimeout(() => setThemeMode(saved), 0);
    const timer = window.setTimeout(() => setSplashVisible(false), 1800);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem("exam_prep_theme", themeMode);
  }, [themeMode]);

  const effectiveTheme = themeMode === "system"
    ? (typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light")
    : themeMode;

  const hi = language === "hi";
  const t = (h, e) => hi ? h : e;

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);
  const formatQuestionCategory = (value) => {
    const labels = {
      "General Knowledge": ["सामान्य ज्ञान", "General Knowledge"],
      "General Studies": ["सामान्य अध्ययन", "General Studies"],
      "Reasoning": ["रीज़निंग", "Reasoning"],
      "Science": ["विज्ञान", "Science"],
      "Age": ["आयु आधारित प्रश्न", "Age"],
      "Biology": ["जीव विज्ञान", "Biology"],
      "Constitution": ["भारतीय संविधान", "Constitution"],
      "Current Affairs": ["समसामयिक घटनाएँ", "Current Affairs"],
      "Geography": ["भूगोल", "Geography"],
      "History": ["इतिहास", "History"],
      "Madhya Pradesh": ["मध्य प्रदेश", "Madhya Pradesh"],
      "Physics": ["भौतिक विज्ञान", "Physics"],
      "Police Constable GD 2026 syllabus-aligned": ["पुलिस कांस्टेबल GD 2026 पाठ्यक्रम आधारित", "Police Constable GD 2026 syllabus-aligned"],
      "बौद्धिक क्षमता एवं मानसिक अभिरुचि": ["बौद्धिक क्षमता एवं मानसिक अभिरुचि", "Logical Ability & Mental Aptitude"],
      "विज्ञान एवं सरल अंक गणित": ["विज्ञान एवं सरल अंक गणित", "Science & Simple Arithmetic"],
      "सामान्य ज्ञान एवं तार्किक ज्ञान": ["सामान्य ज्ञान एवं तार्किक ज्ञान", "General Knowledge & Logical Reasoning"]
    };
    return labels[value] ? (hi ? labels[value][0] : labels[value][1]) : value;
  };
  const q = testQuestions[current];
  const displayQuestion = q ? (hi ? (q.hi || q.en) : (q.en || q.hi)) : "";
  const displayOptions = q ? (hi && q.optionsHi ? q.optionsHi : !hi && q.optionsEn ? q.optionsEn : q.options) : [];
  const answered = Object.keys(answers).length;
  const filteredJobTracks = jobTracks.filter(track => {
    const categoryMatch = examFilter === "all" || track.exam_category === examFilter;
    const needle = examQuery.trim().toLowerCase();
    const text = `${track.name_hi || ""} ${track.name_en || ""} ${track.description_hi || ""} ${track.description_en || ""}`.toLowerCase();
    return categoryMatch && (!needle || text.includes(needle));
  });
  const selectedTrackData = jobTracks.find(track => track.slug === selectedJobTrack) || null;
  const hasCurrentQuestionCatalog = questionCatalogMeta.loaded && questionCatalogMeta.examSlug === selectedExam;
  const subjectOptions = Array.from(new Set(
    ((hasCurrentQuestionCatalog ? questionCatalogMeta.subjects : selectedTrackData?.subjects) || [])
      .map(item => String(item).trim()).filter(Boolean)
  ));
  const topicOptions = hasCurrentQuestionCatalog && selectedSubject !== "all"
    ? Array.from(new Set(questionCatalogMeta.subjectTopics
        .filter(item => item.subject === selectedSubject)
        .map(item => String(item.topic || "").trim()).filter(Boolean)))
    : Array.from(new Set((hasCurrentQuestionCatalog
        ? questionCatalogMeta.subjectTopics.map(item => item.topic)
        : selectedTrackData?.topics || [])
        .map(item => String(item).trim()).filter(Boolean)));
  const examGroups = [
    { key: "MPESB", labelHi: "MPESB", labelEn: "MPESB", icon: "🏛️" },
    { key: "SSC", labelHi: "SSC", labelEn: "SSC", icon: "📝" },
    { key: "RPF", labelHi: "RPF", labelEn: "RPF", icon: "🛡️" },
    { key: "RRB", labelHi: "RRB / रेलवे", labelEn: "RRB / Railway", icon: "🚆" },
    { key: "OTHER", labelHi: "अन्य परीक्षाएँ", labelEn: "Other Exams", icon: "🎯" }
  ];
  const getExamGroup = (track) => {
    const board = String(track.exam_board || "").toUpperCase();
    if (board.includes("MPESB") || board.includes("ESB")) return "MPESB";
    if (board.includes("SSC")) return "SSC";
    if (board.includes("RPF")) return "RPF";
    if (board.includes("RRB") || board.includes("RAILWAY")) return "RRB";
    const slug = String(track.slug || "").toLowerCase();
    if (slug.startsWith("rpf-")) return "RPF";
    if (slug.startsWith("rrb-")) return "RRB";
    if (slug.startsWith("ssc-")) return "SSC";
    return "OTHER";
  };

  useEffect(() => {
    if (!supabaseBrowser) return undefined;
    let mounted = true;
    supabaseBrowser.auth.getSession().then(({ data }) => {
      if (mounted) {
        const nextUser = data.session?.user || null;
        setUser(nextUser);
        const nextName = getUserDisplayName(nextUser);
        setProfileName(nextName === "अभ्यर्थी" ? "" : nextName);
        setNeedsProfileName(Boolean(nextUser) && nextName === "अभ्यर्थी");
      }
    });
    const { data: listener } = supabaseBrowser.auth.onAuthStateChange((_event, session) => {
      if (mounted) {
        const nextUser = session?.user || null;
        setUser(nextUser);
        const nextName = getUserDisplayName(nextUser);
        setProfileName(nextName === "अभ्यर्थी" ? "" : nextName);
        setNeedsProfileName(Boolean(nextUser) && nextName === "अभ्यर्थी");
      }
    });
    return () => { mounted = false; listener?.subscription?.unsubscribe(); };
  }, []);

  useEffect(() => {
    if (!user || !supabaseBrowser || typeof window === "undefined") return;
    const existing = localStorage.getItem("exam_prep_device_key") || crypto.randomUUID();
    localStorage.setItem("exam_prep_device_key", existing);
    (async () => {
      const { data: isTrusted, error } = await supabaseBrowser.rpc("bind_or_verify_trusted_device", {
        p_device_key: existing,
        p_phone: user.phone || null
      });
      if (error) {
        setAuthMessage(t("Trusted device की जाँच नहीं हो सकी।","Trusted-device verification could not be completed."));
        await supabaseBrowser.auth.signOut();
        return;
      }
      if (isTrusted !== true) {
        setAuthStep("recovery");
        setAuthMessage(t("यह अकाउंट दूसरे trusted device से जुड़ा है। पुराने device से recovery code लेकर यहाँ दर्ज करें।","This account is bound to another trusted device. Enter a recovery code generated on the old trusted device."));
        return;
      }
      setTrustedDeviceVerified(true);
      setAuthMessage(t("लॉगिन सफल। यह डिवाइस trusted है।","Login successful. This device is trusted."));
    })();
  }, [user]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    // Defer the initial browser-only read until after hydration completes.
    const initialSync = window.setTimeout(() => setIsOnline(navigator.onLine), 0);
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.clearTimeout(initialSync);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);

  useEffect(() => {
    if (view !== "test" || seconds <= 0) return undefined;
    const timer = setInterval(() => setSeconds(value => Math.max(0, value - 1)), 1000);
    return () => clearInterval(timer);
  }, [view, seconds]);

  // Automatically submit once the countdown expires, so a test cannot remain
  // open indefinitely at 00:00. finishTest guards against duplicate submissions.
  useEffect(() => {
    if (view === "test" && seconds === 0 && !result && !grading) {
      finishTest();
    }
  }, [view, seconds, result, grading]);

   useEffect(() => {
    if (otpCooldown <= 0) return undefined;
    const timer = setInterval(() => setOtpCooldown(value => Math.max(0, value - 1)), 1000);
    return () => clearInterval(timer);
  }, [otpCooldown]);

  useEffect(() => {
    if (!supabaseBrowser || typeof window === "undefined") return;
    let flushing = false;
    async function flushOfflineResults() {
      if (flushing || !navigator.onLine) return;
      flushing = true;
      try {
        const raw = localStorage.getItem("exam_prep_offline_results");
        const pending = raw ? JSON.parse(raw) : [];
        if (!Array.isArray(pending) || !pending.length) return;
        const { data: sessionData } = await supabaseBrowser.auth.getSession();
        const accessToken = sessionData.session?.access_token || "";
        if (!accessToken) return;
        const remaining = [];
        for (const item of pending) {
          if (!item?.device_key || !item?.user_id || item.user_id !== sessionData.session?.user?.id) { remaining.push(item); continue; }
          try {
            const response = await fetch("/api/results", {
              method: "POST",
              headers: { "content-type": "application/json", Authorization: `Bearer ${accessToken}` },
              body: JSON.stringify(item)
            });
            if (!response.ok) remaining.push(item);
          } catch { remaining.push(item); }
        }
        localStorage.setItem("exam_prep_offline_results", JSON.stringify(remaining));
      } catch {}
      finally { flushing = false; }
    }
    const { data: authListener } = supabaseBrowser.auth.onAuthStateChange(() => { flushOfflineResults(); });
    flushOfflineResults();
    window.addEventListener("online", flushOfflineResults);
    return () => {
      window.removeEventListener("online", flushOfflineResults);
      authListener?.subscription?.unsubscribe();
    };
  }, [trustedDeviceVerified]);

  useEffect(() => {
    let active = true;
    async function loadExams() {
      try {
        const response = await fetch("/api/exams", { cache: "no-store" });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload?.error || "Could not load exams");
        const available = Array.isArray(payload.data) ? payload.data : [];
        if (active) {
          setExams(available);
          setExamsLoading(false);
          const preferred = available.find(item => item.slug === "mpesb") || available[0];
          if (preferred) {
            setSelectedExam(preferred.slug);
            setExamConfig({ total_questions:Number(preferred.total_questions || 10), duration_minutes:Number(preferred.duration_minutes || 10), marks_per_question:Number(preferred.marks_per_question || 1), negative_marks:Number(preferred.negative_marks || 0), passing_percentage:Number(preferred.passing_percentage || 33) });
            setExamId(preferred.id);
            setExamName(preferred.name || "Mock Test");
          }
        }
      } catch { if (active) setExamsLoading(false); }
    }
    loadExams();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    async function loadQuestionCatalogMeta() {
      try {
        const response = await fetch(`/api/questions?exam=${encodeURIComponent(selectedExam)}&limit=100&mode=availability`, { cache: "no-store" });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload?.error || "Question bank unavailable");
        if (!active) return;
        const subjectTopics = Array.isArray(payload?.meta?.subject_topics) ? payload.meta.subject_topics : [];
        setQuestionCatalogMeta({
          loaded: true,
          examSlug: selectedExam,
          subjects: Array.isArray(payload?.meta?.subjects) ? payload.meta.subjects : [],
          subjectTopics
        });
      } catch {
        if (active) setQuestionCatalogMeta({ loaded: false, examSlug: selectedExam, subjects: [], subjectTopics: [] });
      }
    }
    loadQuestionCatalogMeta();
    return () => { active = false; };
  }, [selectedExam]);

  useEffect(() => {
    let active = true;
    async function loadFilteredQuestionAvailability() {
      setQuestionBankLoading(true);
      setQuestionLoadError("");
      try {
        const params = new URLSearchParams({ exam: selectedExam, limit: "100", mode: "availability" });
        if (selectedSubject !== "all") params.set("subject", selectedSubject);
        if (selectedTopic !== "all") params.set("topic", selectedTopic);
        const response = await fetch(`/api/questions?${params.toString()}`, { cache: "no-store" });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload?.error || "Question bank unavailable");
        if (!active) return;
        const actual = Number(payload?.meta?.available ?? (Array.isArray(payload.data) ? payload.data.length : 0));
        setAvailableQuestionCount(actual);
        setPracticeQuestionCount(current => {
          const validChoices = Array.from(new Set(
            [10, 20, 30, 40, 50, Math.min(100, actual)].filter(n => n > 0 && n <= actual)
          )).sort((a, b) => a - b);
          if (!validChoices.length) return 0;
          if (validChoices.includes(current)) return current;
          const preferredDefault = Math.min(30, actual);
          return validChoices.includes(preferredDefault) ? preferredDefault : validChoices[validChoices.length - 1];
        });
      } catch (error) {
        if (active) {
          setAvailableQuestionCount(0);
          setPracticeQuestionCount(0);
          setQuestionLoadError(error?.message || "Question bank unavailable");
        }
      } finally {
        if (active) setQuestionBankLoading(false);
      }
    }
    loadFilteredQuestionAvailability();
    return () => { active = false; };
  }, [selectedExam, selectedSubject, selectedTopic]);

  async function requestNativeSimPermission() {
    const bridge = typeof window !== "undefined" ? window.ExamPrepNative : null;
    if (!bridge || typeof bridge.requestSimPermission !== "function") {
      setAuthMessage(t("SIM की अनुमति केवल Android app में दी जा सकती है। Browser/PWA SIM को पढ़ नहीं सकता।","SIM permission can only be granted in the Android app. A browser/PWA cannot read SIM state."));
      return;
    }
    try {
      const state = await bridge.requestSimPermission();
      setNativeSimStatus(state === "ready" ? "sim-ready" : "native");
      setAuthMessage(state === "ready" ? t("SIM verification चालू है।","SIM verification is enabled.") : t("SIM permission पूरी नहीं हुई।","SIM permission was not granted."));
    } catch (error) {
      setAuthMessage(error?.message || t("SIM permission नहीं मिल सकी।","SIM permission could not be granted."));
    }
  }

  useEffect(() => {
    if (view !== "test" || typeof document === "undefined") return undefined;
    const onVisibility = () => { if (document.hidden) setTestFocusWarning(true); };
    const onBeforeUnload = (event) => { event.preventDefault(); event.returnValue = ""; };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [view]);

  useEffect(() => {
    if (view !== "boards" || jobTracks.length) return undefined;
    let active = true;
    async function loadJobTracks() {
      setJobTracksLoading(true);
      try {
        const response = await fetch("/api/job-tracks", { cache: "no-store" });        const payload = await response.json();
        if (!response.ok) throw new Error(payload?.error || "Could not load job tracks");
        if (active) {
          setJobTracks(Array.isArray(payload.data) ? payload.data : []);
          setJobTracksLoading(false);
        }
      } catch { if (active) setJobTracksLoading(false); }
    }
    loadJobTracks();
    return () => { active = false; };
  }, [view, jobTracks.length]);

  useEffect(() => {
    let active = true;
    async function loadHistory() {
      let localHistory = [];
      try {
        const localRaw = typeof window !== "undefined" ? localStorage.getItem("exam_prep_local_history") : "[]";
        const parsedLocal = localRaw ? JSON.parse(localRaw) : [];
        localHistory = Array.isArray(parsedLocal) ? parsedLocal : [];

        // Keep locally saved guest results visible even if Supabase is unavailable.
        if (!supabaseBrowser) {
          if (active) setHistory(localHistory.slice(0, 50));
          return;
        }
        const { data: sessionData } = await supabaseBrowser.auth.getSession();
        const accessToken = sessionData.session?.access_token || "";
        if (!accessToken) {
          if (active) setHistory(localHistory.slice(0, 50));
          return;
        }

        const key = await ensureSessionKey();
        const deviceKey = typeof window !== "undefined" ? (localStorage.getItem("exam_prep_device_key") || "") : "";
        const response = await fetch(`/api/results?session_key=${encodeURIComponent(key)}`, {
          headers: { Authorization: `Bearer ${accessToken}`, ...(deviceKey ? { "x-device-key": deviceKey } : {}) }
        });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload?.error || "Could not load saved results");

        const cloudHistory = Array.isArray(payload.data) ? payload.data : [];
        // A result may exist in both cloud history and a local cache. Prefer the
        // cloud row when the same attempt has matching answers and near-identical timestamps.
        const signature = item => [
          item.exam_id || "", item.test_name || "", item.total_questions ?? "",
          item.score ?? "", item.correct ?? "", item.wrong ?? "", item.unanswered ?? "",
          JSON.stringify(item.answers && typeof item.answers === "object" ? item.answers : {})
        ].join("|");
        const merged = [];
        for (const item of [...cloudHistory, ...localHistory]) {
          const stamp = Date.parse(item.created_at || "");
          const keyForItem = signature(item);
          const duplicate = merged.some(previous => {
            if (signature(previous) !== keyForItem) return false;
            const previousStamp = Date.parse(previous.created_at || "");
            return Number.isFinite(stamp) && Number.isFinite(previousStamp) && Math.abs(stamp - previousStamp) <= 120000;
          });
          if (!duplicate) merged.push(item);
        }
        merged.sort((a, b) => (Date.parse(b.created_at || "") || 0) - (Date.parse(a.created_at || "") || 0));
        if (active) { setHistory(merged.slice(0, 50)); setStorageMessage(""); }
      } catch (error) {
        if (active) setHistory(localHistory.slice(0, 50));
      }
    }
    loadHistory();
    return () => { active = false; };
  }, [user, trustedDeviceVerified]);

  function selectPaperFile(file) {
    setPaperAnalysis(null);
    setPaperQuizAnswers({});
    setPaperQuizSubmitted(false);
    setPaperAnalysisError("");
    if (!file) {
      setPaperFile(null);
      return;
    }
    if (file.size > MAX_PAPER_FILE_BYTES) {
      setPaperFile(null);
      setPaperAnalysisError(t("फ़ाइल 3 MB या उससे छोटी होनी चाहिए।", "The file must be 3 MB or smaller."));
      return;
    }
    if (!isSupportedPaperFile(file.name, file.type)) {
      setPaperFile(null);
      setPaperAnalysisError(t("PDF, JPG, PNG या WEBP फ़ाइल चुनें।", "Choose a PDF, JPG, PNG, or WEBP file."));
      return;
    }
    setPaperFile(file);
  }

  async function analyzeUploadedPaper(event) {
    event.preventDefault();
    setPaperAnalysisError("");
    if (!user) {
      setPaperAnalysisError(t("पहले अकाउंट में लॉगिन करें, फिर पेपर का विश्लेषण करें।", "Please sign in to your account before analyzing a paper."));
      return;
    }
    if (!supabaseBrowser) {
      setPaperAnalysisError(t("Login सेवा अभी उपलब्ध नहीं है।", "Login service is not available right now."));
      return;
    }
    if (!paperFile) {
      setPaperAnalysisError(t("पहले PDF या साफ़ पेपर फोटो चुनें।", "Choose a PDF or a clear paper photo first."));
      return;
    }
    if (paperFile.size > MAX_PAPER_FILE_BYTES) {
      setPaperAnalysisError(t("फ़ाइल 3 MB या उससे छोटी होनी चाहिए।", "The file must be 3 MB or smaller."));
      return;
    }
    if (!isSupportedPaperFile(paperFile.name, paperFile.type)) {
      setPaperAnalysisError(t("PDF, JPG, PNG या WEBP फ़ाइल चुनें।", "Choose a PDF, JPG, PNG, or WEBP file."));
      return;
    }
    setPaperAnalysisBusy(true);
    setPaperAnalysis(null);
    setPaperQuizAnswers({});
    setPaperQuizSubmitted(false);
    try {
      const { data: sessionData, error: sessionError } = await supabaseBrowser.auth.getSession();
      const accessToken = sessionData?.session?.access_token || "";
      if (sessionError || !accessToken) {
        setPaperAnalysisError(t("सेशन समाप्त हो गया है। दोबारा लॉगिन करें।", "Your session has expired. Please sign in again."));
        return;
      }
      const bytes = new Uint8Array(await paperFile.arrayBuffer());
      let binary = "";
      for (let offset = 0; offset < bytes.length; offset += 0x8000) {
        binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
      }
      const fileBase64 = btoa(binary);
      const response = await fetch("/api/paper-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ fileName: paperFile.name, mimeType: paperFile.type, fileBase64 })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || t("पेपर का विश्लेषण नहीं हो सका।", "Could not analyze this paper."));
      setPaperAnalysis(payload.analysis || null);
      setPaperQuizAnswers({});
      setPaperQuizSubmitted(false);
    } catch (error) {
      setPaperAnalysisError(String(error?.message || t("कुछ गड़बड़ हुई। फिर कोशिश करें।", "Something went wrong. Please try again.")));
    } finally {
      setPaperAnalysisBusy(false);
    }
  }

  async function signInWithGoogle() {
    if (!supabaseBrowser) {
      setAuthMessage(t("Login सेवा अभी उपलब्ध नहीं है।","Login service is not available right now."));
      return;
    }
    setAuthMessage(t("Google login शुरू हो रहा है…","Starting Google login…"));
    const redirectTo = typeof window !== "undefined" ? window.location.origin : undefined;
    const { error } = await supabaseBrowser.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo }
    });
    if (error) {
      const message = String(error.message || "");
      if (/provider.*not enabled|unsupported.*provider|not configured/i.test(message)) {
        setAuthMessage(t("Google Login अभी Supabase में enable नहीं है। Google OAuth provider configure करना होगा।","Google Login is not enabled in Supabase yet. Configure the Google OAuth provider first."));
      } else {
        setAuthMessage(message);
      }
    }
  }

  async function sendOtp() {
    if (otpCooldown > 0) return;
    if (!supabaseBrowser) {
      setAuthMessage(t("Login सेवा अभी उपलब्ध नहीं है।","Login service is not available right now."));
      return;
    }

    if (authMethod === "email") {
      const normalizedEmail = email.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
        setAuthMessage(t("एक सही email address दर्ज करें।","Enter a valid email address."));
        return;
      }
      setAuthMessage(t("Email पर login link भेजा जा रहा है…","Sending a sign-in link to your email…"));
      const { error } = await supabaseBrowser.auth.signInWithOtp({
        email: normalizedEmail,
        options: {
          shouldCreateUser: true,
          emailRedirectTo: typeof window !== "undefined" ? window.location.origin : undefined
        }
      });
      if (error) {
        setAuthMessage(String(error.message || t("Email login अभी उपलब्ध नहीं है।","Email login is not available right now.")));
        return;
      }
      setOtp("");
      setAuthStep("email-sent");
      setOtpCooldown(60);
      setAuthMessage(t("Email भेज दिया गया है। Inbox/Spam देखें और login link खोलें। अगर 6-digit code आया है, तो यहाँ दर्ज कर सकते हैं।","Email sent. Check your inbox/spam and open the sign-in link. If you received a 6-digit code, you can enter it here."));
      return;
    }

    const digits = phone.replace(/\D/g, "").replace(/^91(?=\d{10})/, "");
    const normalized = `+91${digits}`;
    if (!/^\+91\d{10}$/.test(normalized)) {
      setAuthMessage(t("10 अंकों का भारतीय मोबाइल नंबर दर्ज करें।","Enter a valid 10-digit Indian mobile number."));
      return;
    }
    setAuthMessage(t("OTP भेजा जा रहा है…","Sending OTP…"));
    const { error } = await supabaseBrowser.auth.signInWithOtp({ phone: normalized, options: { channel: "sms" } });
    if (error) {
      const message = String(error.message || "");
      if (/phone[_\s-]*provider[_\s-]*disabled|phone provider.*disabled|phone.*not enabled|unsupported phone provider/i.test(message) || /sms provider/i.test(message)) {
        setAuthMethod("email");
        setAuthMessage(t("SMS OTP चालू नहीं है। हमने Email login चुन दिया है—अपना email डालकर login link भेजें।","SMS OTP is disabled. Email login has been selected for you—enter your email and send a sign-in link."));
      } else {
        setAuthMessage(message);
      }
      return;
    }
    setAuthStep("otp");
    setOtp("");
    setOtpCooldown(60);
    setAuthMessage(t("OTP भेज दिया गया है। 60 सेकंड बाद फिर भेज सकते हैं।","OTP sent. You can request another OTP after 60 seconds."));
  }

  async function verifyOtp() {
    if (!supabaseBrowser) {
      setAuthMessage(t("Login सेवा अभी उपलब्ध नहीं है।","Login service is not available right now."));
      return;
    }
    const token = otp.replace(/\s+/g, "");
    if (!/^\d{6}$/.test(token)) {
      setAuthMessage(t("6 अंकों का code दर्ज करें।","Enter the 6-digit code."));
      return;
    }

    setAuthMessage(t("Code जाँचा जा रहा है…","Verifying code…"));
    const { error } = authMethod === "email"
      ? await supabaseBrowser.auth.verifyOtp({ email: email.trim().toLowerCase(), token, type: "email" })
      : await supabaseBrowser.auth.verifyOtp({
          phone: `+91${phone.replace(/\D/g, "").replace(/^91(?=\d{10})/, "")}`,
          token,
          type: "sms"
        });
    if (error) setAuthMessage(error.message);
    else setAuthMessage(t("Code सही है। Trusted device की जाँच हो रही है…","Code verified. Checking trusted device…"));
  }

  async function saveProfileName() {
    const name = profileName.trim();
    if (!supabaseBrowser || !user || !name) {
      setAuthMessage(t("अपना नाम दर्ज करें।","Enter your name."));
      return;
    }
    const { data, error } = await supabaseBrowser.auth.updateUser({ data: { full_name: name, display_name: name } });
    if (error) {
      setAuthMessage(error.message);
      return;
    }
    setUser(data.user);
    setProfileName(name);
    setNeedsProfileName(false);
    setAuthMessage(t("नाम सेव हो गया।","Your name has been saved."));
  }

  async function createRecoveryCode() {
    if (!supabaseBrowser || !user || typeof window === "undefined") return;
    const deviceKey = localStorage.getItem("exam_prep_device_key") || "";
    if (!/^[0-9a-f-]{36}$/i.test(deviceKey)) {
      setAuthMessage(t("Trusted device की जानकारी नहीं मिली।","Trusted device information is unavailable."));
      return;
    }
    const bytes = new Uint8Array(9);
    crypto.getRandomValues(bytes);
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const code = Array.from(bytes, byte => alphabet[byte % alphabet.length]).join("");
    const codeHash = await hashRecoveryCode(code);
    const { data, error } = await supabaseBrowser.rpc("create_device_recovery_code", { p_device_key: deviceKey, p_code_hash: codeHash });
    if (error || data !== true) {
      setAuthMessage(error?.message || t("Recovery code नहीं बन सका।","Could not create a recovery code."));
      return;
    }
    setAuthMessage(t("Recovery code: " + code + " — इसे नए फोन में OTP के बाद दर्ज करें। यह 15 मिनट में expire होगा।","Recovery code: " + code + " — enter it on the new phone after OTP. It expires in 15 minutes."));
  }

  async function recoverTrustedDevice() {
    if (!supabaseBrowser || !user || typeof window === "undefined") return;
    const code = recoveryCode.replace(/\s+/g, "").toUpperCase();
    if (!/^[A-Z0-9]{9}$/.test(code)) {
      setAuthMessage(t("9 अक्षरों का recovery code दर्ज करें।","Enter the 9-character recovery code."));
      return;
    }
    const newDeviceKey = localStorage.getItem("exam_prep_device_key") || "";
    if (!/^[0-9a-f-]{36}$/i.test(newDeviceKey)) {
      setAuthMessage(t("नए device की पहचान नहीं मिली।","New-device identity is unavailable."));
      return;
    }
    const codeHash = await hashRecoveryCode(code);
    const { data, error } = await supabaseBrowser.rpc("consume_device_recovery_code", {
      p_code_hash: codeHash,
      p_new_device_key: newDeviceKey,
      p_phone: user.phone || null
    });
    if (error || data !== true) {
      setAuthMessage(error?.message || t("Recovery code गलत, expired या पहले इस्तेमाल हो चुका है।","Recovery code is invalid, expired, or already used."));
      return;
    }
    setTrustedDeviceVerified(true);
    setAuthStep("phone");
    setRecoveryCode("");
    setAuthMessage(t("नया device trusted बन गया।","The new device is now trusted."));
  }

  async function logout() {
    if (supabaseBrowser) await supabaseBrowser.auth.signOut();
    setUser(null);
    setAuthStep("phone");
    setOtp("");
    setRecoveryCode("");
    setTrustedDeviceVerified(false);
    setAuthMessage("");
  }

  async function logoutAllDevices() {
    if (!supabaseBrowser || typeof window === "undefined") return;
    const confirmed = window.confirm(t(
      "सभी devices से logout करना है? इससे दूसरे devices के refresh sessions revoke हो जाएँगे।",
      "Sign out from every device? This revokes refresh sessions on other devices too."
    ));
    if (!confirmed) return;
    const { error } = await supabaseBrowser.auth.signOut({ scope: "global" });
    if (error) {
      setAuthMessage(error.message || t("सभी devices से logout नहीं हो सका।", "Could not sign out all devices."));
      return;
    }
    setUser(null);
    setTrustedDeviceVerified(false);
    setAuthStep("phone");
    setOtp("");
    setRecoveryCode("");
    setAuthMessage(t(
      "सभी sessions revoke करने का अनुरोध सफल हुआ। अगर account compromise हुआ है, तो email account भी सुरक्षित करें और keys बदलें।",
      "All sessions were revoked. If the account was compromised, also secure your email account and rotate exposed project keys."
    ));
  }

  async function runTest() {
    autoSubmitAttempted.current = false;
    setAuthMessage("");
    if (!user) setAuthMessage(t("बिना लॉगिन अभ्यास मोड: टेस्ट शुरू हो रहा है। रिज़ल्ट इसी डिवाइस पर सेव होगा।","Guest practice mode: the test is starting without login. Your result will be saved on this device."));
    if (questionLoadError) { setAuthMessage(questionLoadError); return; }
    if (questionBankLoading) { setAuthMessage(t("सवाल अभी लोड हो रहे हैं। एक सेकंड रुककर फिर दबाएँ।","Questions are still loading. Wait a second and tap again.")); return; }
    const readyCount = Number(availableQuestionCount || 0);
    if (!readyCount) { setAuthMessage(t("इस परीक्षा के verified सवाल अभी उपलब्ध नहीं हैं।","Verified questions are not available for this exam yet.")); return; }
    const requestedCount = Math.min(Number(practiceQuestionCount || 10), readyCount);
    setAnswers({}); setReview([]); setCurrent(0); setSeconds(0); setResult(null); setReviewAnswers({}); setTestSessionId(""); setTestSessionKey(""); setShowSubmit(false); setTestQuestions([]);
    try {
      const historyKey = `exam_prep_seen_questions_${selectedExam}_${selectedSubject}_${selectedTopic}`;
      let seenQuestionIds = [];
      try {
        const stored = JSON.parse(localStorage.getItem(historyKey) || "[]");
        if (Array.isArray(stored)) seenQuestionIds = stored.filter(id => typeof id === "string").slice(-250);
      } catch {}
      const excludeParam = seenQuestionIds.length ? `&exclude=${encodeURIComponent(seenQuestionIds.join(","))}` : "";
      const response = await fetch(`/api/questions?exam=${encodeURIComponent(selectedExam)}&limit=${requestedCount}${selectedSubject !== "all" ? `&subject=${encodeURIComponent(selectedSubject)}` : ""}${selectedTopic !== "all" ? `&topic=${encodeURIComponent(selectedTopic)}` : ""}${excludeParam}`, { cache: "no-store" });
      const payload = await response.json();
      if (response.ok && payload.exam && payload.test_session_id && payload.test_session_key) { setTestSessionId(payload.test_session_id); setTestSessionKey(payload.test_session_key); const config = { total_questions: Number(payload.exam.total_questions || 10), duration_minutes: Number(payload.exam.duration_minutes || 10), marks_per_question: Number(payload.exam.marks_per_question || 1), negative_marks: Number(payload.exam.negative_marks || 0), passing_percentage: Number(payload.exam.passing_percentage || 33) }; setExamConfig(config); setExamName(String(payload.exam.name || "MPESB Mock Test")); setExamId(payload.exam.id || null); setSeconds(Number(practiceDuration || config.duration_minutes || 10) * 60); } else { setSeconds(Number(practiceDuration || examConfig.duration_minutes || 10) * 60); }
      if (response.ok && payload.test_session_id && payload.test_session_key && Array.isArray(payload.data) && payload.data.length) {
        const mapped = payload.data.map((item, index) => {
          const locale = QUESTION_LOCALIZATIONS[item.id];
          return {
            id: index + 1,
            sourceId: item.id,
            subject: item.subject || "General",
            topic: item.topic || "",
            en: locale?.en || item.question_en || item.question_hi,
            hi: locale?.hi || item.question_hi || item.question_en,
            options: Array.isArray(item.options) ? item.options : [],
            optionsHi: QUESTION_OPTIONS_HI[item.id] || locale?.optionsHi || null,
            optionsEn: locale?.optionsEn || null,
            sourceType: item.source_type || "curated",
            sourceYear: item.source_year || null,
            predictionScore: Number(item.prediction_score || 0)
          };
        }).filter(item => item.options.length === 4);
        if (mapped.length) {
          try {
            const stored = JSON.parse(localStorage.getItem(historyKey) || "[]");
            const previous = Array.isArray(stored) ? stored.filter(id => typeof id === "string") : [];
            const seen = [...new Set([...previous, ...mapped.map(item => item.sourceId).filter(Boolean)])].slice(-250);
            localStorage.setItem(historyKey, JSON.stringify(seen));
          } catch {}
          setTestQuestions(mapped);
          setView("test");
        }
        else {
          setTestQuestions([]);
          setAuthMessage(t("इस परीक्षा के सवाल वैध format में उपलब्ध नहीं हैं।","This exam's questions are not available in a valid format."));
          return;
        }
      } else {
        setTestQuestions([]);
        setAuthMessage(t("इस परीक्षा के verified सवाल अभी उपलब्ध नहीं हैं।","Verified questions are not available for this exam yet."));
        return;
      }
    } catch (error) {
      setTestQuestions([]);
      setAuthMessage(error?.message || t("Question bank लोड नहीं हो सका। कृपया दोबारा प्रयास करें।","The question bank could not be loaded. Please try again."));
      return;
    }
    setTestFocusWarning(false);
    setView("test");
    if (typeof window !== "undefined") {
      const session = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : String(Date.now());
      window.history.replaceState({ view: "test", session }, "", "#test");
      window.requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "auto" }));
    }
  }
  function startTest() {
    setAuthMessage("");
    const readySelectedExam = selectedTrackData?.exam_slug && selectedTrackData?.question_bank_ready;
    if (!readySelectedExam || !availableQuestionCount) {
      setAuthMessage(t("पहले READY परीक्षा चुनें।","Choose a READY exam first."));
      return;
    }
    setView("setup");
    if (typeof window !== "undefined") window.history.replaceState({ view: "setup" }, "", "#exam-setup");
  }

   async function finishTest() {
    if (result || grading) return;
    if (!testSessionId || !testSessionKey) {
      setAuthMessage(t("इस टेस्ट का सुरक्षित session नहीं मिला। नया टेस्ट शुरू करें।", "Secure test session missing. Please start a new test."));
      return;
    }
    setGrading(true);
    setAuthMessage("");
    try {
      const gradeResponse = await fetch("/api/grade", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ test_session_id: testSessionId, test_session_key: testSessionKey, answers })
      });
      const gradePayload = await gradeResponse.json();
      if (!gradeResponse.ok || !gradePayload?.data) throw new Error(gradePayload?.error || "Could not grade this test. Please retry.");

      const graded = gradePayload.data;
      setReviewAnswers(Object.fromEntries((graded.review || []).map(item => [String(item.id), item])));
      const summary = {
        practice_mode: true,
        full_exam_mode: selectedSubject === "all" && selectedTopic === "all" && testQuestions.length === Number(examConfig.total_questions),
        exam_id: examId,
        question_ids: Object.fromEntries(testQuestions.map(item => [String(item.id), item.sourceId]).filter(([, sourceId]) => sourceId)),
        correct: Number(graded.correct || 0),
        wrong: Number(graded.wrong || 0),
        unanswered: Number(graded.unanswered || 0),
        score: Number(graded.score || 0),
        gross_score: Number(graded.gross_score || 0),
        negative_score: Number(graded.negative_score || 0),
        accuracy: Number(graded.accuracy || 0),
        answers: { ...answers },
        review_ids: [...review],
        language,
        total_questions: Number(graded.total_questions || testQuestions.length),
        marks_per_question: Number(graded.marks_per_question || examConfig.marks_per_question || 1),
        negative_marks_per_question: Number(graded.negative_marks_per_question ?? examConfig.negative_marks ?? 0),
        passing_percentage: Number(graded.passing_percentage || examConfig.passing_percentage || 33),
        test_name: String(graded.test_name || examName)
      };
      setResult(summary);
      setView("result");
      setShowSubmit(false);

      const saveLocal = (pending = false, syncPayload = null) => {
        try {
          const key = pending ? "exam_prep_offline_results" : "exam_prep_local_history";
          const existing = JSON.parse(localStorage.getItem(key) || "[]");
          const deviceKey = typeof window !== "undefined" ? (localStorage.getItem("exam_prep_device_key") || "") : "";
          const canSync = pending && Boolean(user?.id && deviceKey && syncPayload?.session_key);
          const item = {...(canSync ? syncPayload : summary), created_at: new Date().toISOString(), ...(canSync ? {offline_pending:true, user_id:user.id, device_key:deviceKey} : {})};
          localStorage.setItem(key, JSON.stringify([item, ...existing].slice(0, 50)));
          setHistory(old => [item, ...old].slice(0, 50));
        } catch {}
      };

      let retryableSave = false;
      let retryablePayload = null;
      try {
        const sessionKey = await ensureSessionKey();
        let deviceKey = "";
        if (typeof window !== "undefined") {
          deviceKey = localStorage.getItem("exam_prep_device_key") || "";
          if (user?.id && !deviceKey) {
            deviceKey = crypto.randomUUID();
            localStorage.setItem("exam_prep_device_key", deviceKey);
          }
        }
        const body = { session_key: sessionKey, practice_mode: true, requested_total_questions: practiceQuestionCount, requested_duration_minutes: practiceDuration, user_id: user?.id || null, device_key: deviceKey, ...summary };
        retryablePayload = body;
        if (!navigator.onLine) {
          const canSync = Boolean(user?.id && deviceKey);
          saveLocal(canSync, body);
          setStorageMessage(canSync
            ? t("रिज़ल्ट इस device पर सेव है; इंटरनेट आने पर cloud sync करें।", "Result is saved on this device; sync to cloud when online.")
            : t("Guest result इस device पर सुरक्षित है। Cloud sync के लिए login करें।", "Guest result is saved on this device. Login to sync it to the cloud."));
          return;
        }

        const { data: sessionData } = await supabaseBrowser.auth.getSession();
        const accessToken = sessionData.session?.access_token || "";
        if (!accessToken) {
          saveLocal(false);
          setStorageMessage(t("Guest result इस device पर सुरक्षित है। Cloud sync के लिए login करें।", "Guest result is saved on this device. Login to sync it to the cloud."));
          return;
        }
        if (!trustedDeviceVerified) {
          saveLocal(true, body);
          setStorageMessage(t(
            "Trusted device की जाँच पूरी हो रही है। रिज़ल्ट सुरक्षित queue में रखा है और जाँच पूरी होने पर cloud में sync होगा।",
            "Trusted-device verification is still completing. The result is queued safely and will sync to the cloud after verification."
          ));
          return;
        }

        const response = await fetch("/api/results", {
          method: "POST",
          headers: { "content-type": "application/json", Authorization: `Bearer ${accessToken}` },
          body: JSON.stringify(body)
        });
        const payload = await response.json();
        if (!response.ok) {
          retryableSave = response.status === 429 || response.status >= 500;
          throw new Error(payload?.error || "Result could not be saved to cloud");
        }
        setHistory(old => [payload.data, ...old].slice(0, 50));
        setStorageMessage("");
      } catch (error) {
        const deviceKey = typeof window !== "undefined" ? (localStorage.getItem("exam_prep_device_key") || "") : "";
        const retryable = Boolean(user?.id && deviceKey) && (retryableSave || /failed to fetch|networkerror|network request failed|load failed|timeout|timed out/i.test(String(error?.message || "")));
        saveLocal(retryable, retryablePayload);
        setStorageMessage(retryable
          ? t("Cloud save अभी नहीं हो सका; रिज़ल्ट queue में सुरक्षित है और दोबारा sync होगा।", "Cloud save failed temporarily; the result is queued and will sync again.")
          : error?.message || "Result could not be saved to cloud");
      }
    } catch (error) {
      setAuthMessage(error?.message || t("टेस्ट जाँच नहीं हो सकी। इंटरनेट जाँचकर फिर सबमिट करें।", "Could not grade the test. Check your connection and retry submission."));
      setShowSubmit(true);
    } finally {
      setGrading(false);
    }
  }
  useEffect(() => {
    if (view !== "test" || seconds !== 0 || !testQuestions.length || result || grading || autoSubmitAttempted.current) return;
    autoSubmitAttempted.current = true;
    void finishTest();
  }, [view, seconds, testQuestions.length, result, grading]);

  function chooseAnswer(index) { setAnswers(old => ({ ...old, [q.id]: index })); }
  function toggleReview() { setReview(old => old.includes(q.id) ? old.filter(n => n !== q.id) : [...old, q.id]); }
  function navigateTo(nextView) {
    setMenuOpen(false);
    setView(nextView);
    if (typeof window !== "undefined") {
      const route = nextView === "boards" ? "#exams" : nextView === "setup" ? "#exam-setup" : nextView === "test" ? "#test" : nextView === "login" ? "#login" : "#" + nextView;
      window.history.replaceState({ view: nextView }, "", route);
      window.requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "auto" }));
    }
  }

  return (
    <main className={"shell theme-" + effectiveTheme + (view === "test" ? " exam-active" : "")}>
      {splashVisible && <div className="splash-screen" aria-label="ExamPrep loading"><div className="splash-orbit splash-orbit-one"/><div className="splash-orbit splash-orbit-two"/><div className="splash-logo"><GraduationCap size={54}/></div><h1>EXAM <span>PREP</span></h1><p>Study Smarter • Score Higher</p><div className="splash-loader"><span/></div><small>Loading…</small></div>}
      <aside className="sidebar">
        <div className="brand"><div className="brand-icon"><GraduationCap size={23}/></div><span>Exam<span className="brand-accent">Prep</span><small>YOUR NEXT RANK STARTS HERE</small></span></div>
        <div className="side-label">{t("वर्कस्पेस","WORKSPACE")}</div>
        {view !== "test" && view !== "instructions" && <button className={"nav-item " + (view === "home" ? "active" : "")} onClick={() => navigateTo("home")}><Home size={18}/>{t("होम","Home")}</button>}
        <button className={"nav-item " + (view === "boards" ? "active" : "")} onClick={() => navigateTo("boards")}><GraduationCap size={18}/>{t("परीक्षाएँ","Exams")}</button><button className={"nav-item " + (view === "history" ? "active" : "")} onClick={() => navigateTo("history")}><Award size={18}/>{t("मेरे रिज़ल्ट","My results")}</button><button className={"nav-item " + (view === "login" ? "active" : "")} onClick={() => navigateTo("login")}><ShieldCheck size={18}/>{user ? t("अकाउंट","Account") : t("लॉगिन","Login")}</button><button className={"nav-item " + (view === "settings" ? "active" : "")} onClick={() => navigateTo("settings")}><Settings size={18}/>{t("सेटिंग्स","Settings")}</button>
        <button className={"nav-item " + (view === "sources" ? "active" : "")} onClick={() => navigateTo("sources")}><Download size={18}/>{t("Source PDFs","Source PDFs")}</button>
        <button className={"nav-item " + (view === "paper" ? "active" : "")} onClick={() => navigateTo("paper")}><FileText size={18}/>{t("पेपर विश्लेषण","Paper Analyzer")}</button>
        <div className="sidebar-bottom"><div className="daily-card"><div className="daily-icon"><Flame size={17}/></div><b>{t("लगातार अभ्यास करें","Keep your streak")}</b><p>{t("रोज़ थोड़ा अभ्यास, बेहतर रैंक।","Small daily practice. Better ranks.")}</p><div className="streak-dots"><i/><i/><i/><i/><i/><i/><i/></div></div><div className="profile"><div className="avatar">{(getUserDisplayName(user).charAt(0) || "अ").toUpperCase()}</div><div><b>{getUserDisplayName(user)}</b><span>{t("परीक्षा अभ्यर्थी","Exam candidate")}</span></div><ShieldCheck size={17} className="profile-check"/></div></div>
      </aside>

      <section className="main">
        <header className="topbar"><div className="breadcrumb">{t("आपकी तैयारी","Your preparation")} <span>/</span> <b>{view === "test" ? t("मॉक टेस्ट","Mock test") : view === "result" ? t("रिज़ल्ट","Results") : view === "history" ? t("मेरे रिज़ल्ट","My results") : view === "paper" ? t("पेपर विश्लेषण","Paper Analyzer") : view === "sources" ? t("Source PDFs","Source PDFs") : view === "about" ? t("ऐप के बारे में","About") : view === "settings" ? t("प्रोफाइल / सेटिंग्स","Profile / Settings") : view === "boards" ? t("परीक्षा बोर्ड","Exam boards") : t("डैशबोर्ड","Dashboard")}</b></div><div className="top-actions"><span className={"live-pill " + (!isOnline ? "offline-pill" : "")}><i/> {isOnline ? t("सिस्टम तैयार","SYSTEM READY") : t("ऑफलाइन मोड","OFFLINE MODE")}</span><button className="home-quick-button" onClick={() => navigateTo("home")} aria-label={t("होम पर जाएँ","Go to Home")} title={t("होम","Home")}><Home size={17}/><span>{t("होम","Home")}</span></button><button className="lang-button" onClick={() => setLanguage(hi ? "en" : "hi")}><Languages size={16}/>{hi ? "हिंदी" : "English"}</button><button className="theme-toggle" onClick={() => setThemeMode(effectiveTheme === "light" ? "dark" : "light")} title={themeMode === "light" ? "Night mode" : themeMode === "dark" ? "System mode" : "Day mode"}>{themeMode === "light" ? "☀️" : themeMode === "dark" ? "🌙" : "◐"}<span>{themeMode === "light" ? t("दिन","Day") : themeMode === "dark" ? t("रात","Night") : t("सिस्टम","System")}</span></button><button ref={menuButtonRef} className="menu-button" onClick={() => setMenuOpen(v=>!v)} aria-expanded={menuOpen} aria-label="Menu" data-testid="menu-toggle"><SlidersHorizontal size={18}/></button>{menuOpen && <div ref={menuRef} className="menu-popover"><b>{t("दिखावट","Appearance")}</b><button onClick={() => {setThemeMode("light");setMenuOpen(false)}}>☀️ {t("Day Mode","Day Mode")}</button><button onClick={() => {setThemeMode("dark");setMenuOpen(false)}}>🌙 {t("Night Mode","Night Mode")}</button><button onClick={() => {setThemeMode("system");setMenuOpen(false)}}>◐ {t("System","System")}</button><hr/><button onClick={() => navigateTo("boards")}>{t("परीक्षाएँ","Exams")}</button><button onClick={() => navigateTo("history")}>{t("मेरे रिज़ल्ट","My results")}</button><button data-testid="menu-login" onClick={() => navigateTo("login")}>{user ? t("अकाउंट","Account") : t("लॉगिन","Login")}</button><button onClick={() => navigateTo("settings")}>{t("सेटिंग्स","Settings")}</button><button onClick={() => navigateTo("sources")}>Source PDFs</button><button data-testid="menu-paper-analyzer" onClick={() => navigateTo("paper")}>{t("पेपर विश्लेषण","Paper Analyzer")}</button><button onClick={() => navigateTo("about")}>{t("ऐप के बारे में","About ExamPrep")}</button></div>}</div></header>

        {view === "home" && <div className="content dashboard-content">{storageMessage && <div className="bottom-note"><div className="note-icon"><Info size={18}/></div><div><b>{t("डेटा सेव स्थिति","Storage status")}</b><p>{storageMessage}</p></div></div>}
          <div className="auth-panel" aria-label={t("वैकल्पिक लॉगिन","Optional login")}>
  <div><b>{user ? t("अकाउंट सक्रिय","Account active") : t("Guest Practice Mode","Guest Practice Mode")}</b><span>{user ? (user.email || user.phone || "") : t("लॉगिन जरूरी नहीं है। मॉक टेस्ट सीधे शुरू करें।","Login is optional. Start the mock test directly.")}</span></div>
  {user ? <>{needsProfileName ? <div className="auth-actions"><div className="guest-login-note">{t("लॉगिन हो गया है। अपना नाम दर्ज करें, यही नाम आपके डैशबोर्ड पर दिखेगा।","Login successful. Enter your name; this name will appear on your dashboard.")}</div><input value={profileName} onChange={e=>setProfileName(e.target.value.slice(0,60))} autoComplete="name" placeholder={t("आपका नाम","Your name")} /><button onClick={saveProfileName}>{t("नाम सेव करें","Save name")}</button></div> : <button onClick={logout}>{t("लॉगआउट","Sign out")}</button>}</> : <div className="auth-actions">
    <div className="guest-login-note">{t("Login वैकल्पिक है। SMS उपलब्ध न हो तो email से सुरक्षित login link इस्तेमाल करें।","Login is optional. Use a secure email sign-in link when SMS is unavailable.")}</div>
    <div className="auth-divider"><span>{t("Cloud sync के लिए login (वैकल्पिक)","OPTIONAL LOGIN FOR CLOUD SYNC")}</span></div>
    {authStep === "phone" ? <>
      <div className="auth-method-switch">
        <button type="button" data-testid="login-method-email" aria-pressed={authMethod === "email"} onClick={() => { setAuthMethod("email"); setAuthMessage(""); }}>{authMethod === "email" ? "✓ " : ""}{t("Email login","Email login")}</button>
        <button type="button" data-testid="login-method-phone" aria-pressed={authMethod === "phone"} onClick={() => { setAuthMethod("phone"); setAuthMessage(""); }}>{authMethod === "phone" ? "✓ " : ""}{t("Mobile SMS","Mobile SMS")}</button>
      </div>
      {authMethod === "email"
        ? <input type="email" value={email} onChange={e=>setEmail(e.target.value)} autoComplete="email" inputMode="email" placeholder={t("आपका email address","Your email address")} data-testid="login-email-input"/>
        : <div className="phone-input"><span>+91</span><input value={phone} onChange={e=>setPhone(e.target.value.replace(/\D/g,"").slice(0,10))} inputMode="numeric" autoComplete="tel-national" maxLength={10} placeholder="10 अंकों का मोबाइल नंबर"/></div>}
      <button onClick={sendOtp} disabled={otpCooldown > 0}>{otpCooldown > 0 ? `${t("फिर भेजें","Resend")} (${otpCooldown}s)` : authMethod === "email" ? t("Login link भेजें","Send login link") : t("OTP भेजें","Send SMS OTP")}</button>
    </> : authStep === "otp" ? <>
      <input value={otp} onChange={e=>setOtp(e.target.value)} inputMode="numeric" maxLength={6} placeholder={t("6-digit OTP","6-digit code")}/>
      <button onClick={verifyOtp}>{t("Code verify करें","Verify code")}</button>
      <button type="button" onClick={() => { setAuthStep("phone"); setOtp(""); setAuthMessage(""); }}>{t("Login method बदलें","Change login method")}</button>
    </> : authStep === "email-sent" ? <>
      <div className="guest-login-note">{t("अपने email के inbox/Spam में आए login link को खोलें। यदि email में 6-digit code है, तो नीचे दर्ज करें।","Open the sign-in link in your email inbox/spam. If the email contains a 6-digit code, enter it below.")}</div>
      <input value={otp} onChange={e=>setOtp(e.target.value)} inputMode="numeric" maxLength={6} placeholder={t("Email code (यदि दिया हो)","Email code (if provided)")}/>
      <button onClick={verifyOtp}>{t("Email code verify करें","Verify email code")}</button>
      <button type="button" onClick={() => { setAuthStep("phone"); setOtp(""); setAuthMessage(""); }}>{t("Email बदलें / वापस जाएँ","Change email / go back")}</button>
    </> : <>
      <input value={recoveryCode} onChange={e=>setRecoveryCode(e.target.value.toUpperCase())} maxLength={9} placeholder={t("Recovery code","Recovery code")}/>
      <button onClick={recoverTrustedDevice}>{t("Device बदलें","Replace device")}</button>
    </>}
  </div>}
  {authMessage && <small>{authMessage}</small>}
</div>
<div className="welcome-row"><div><div className="eyebrow"><span className="eyebrow-line"/> {t("आपके लक्ष्य, आपकी मेहनत","YOUR GOALS. YOUR GRIT.")}</div><h1>{t("नमस्ते, " + getUserDisplayName(user),"Hello, " + getUserDisplayName(user))} <span className="wave">✦</span><br/><span className="muted-heading">{t("आज कुछ नया सीखें।","Ready to level up today?")}</span></h1><p className="intro">{t("अपनी तैयारी को परखें, कमज़ोर विषय पहचानें और हर टेस्ट के साथ बेहतर बनें।","Test your knowledge, spot weak areas, and get better with every attempt.")}</p></div><div className="hero-emblem"><div className="emblem-ring"><GraduationCap size={47}/><span>EXAM<br/>READY</span></div><div className="orbit-dot dot-one"/><div className="orbit-dot dot-two"/></div></div>
          <div className="dashboard-options-bar"><div><span className="dashboard-options-kicker">{t("डैशबोर्ड विकल्प","DASHBOARD OPTIONS")}</span><b>{t("अतिरिक्त विकल्प","More tools & shortcuts")}</b></div><button type="button" className={"dashboard-options-toggle " + (showDashboardOptions ? "open" : "")} aria-expanded={showDashboardOptions} onClick={() => setShowDashboardOptions(value => !value)}><Settings size={17}/><span>{showDashboardOptions ? t("विकल्प छुपाएँ","Hide options") : t("विकल्प दिखाएँ","Show options")}</span><ChevronRight size={16}/></button></div>
          {showDashboardOptions && <div className="feature-grid dashboard-options-panel"><article className="feature-card featured"><div className="feature-top"><div className="feature-icon"><ListChecks size={22}/></div><span className="tag">POPULAR</span></div><h3>{t("चयनित भर्ती का मॉक टेस्ट","Mock test for selected recruitment")}</h3><div className="selected-track"><span>{t("ट्रैक","TRACK")}</span><b>{jobTracks.find(item => item.slug === selectedJobTrack)?.name_hi || examName}</b></div><p>{t(`${examConfig.total_questions} सवाल · ${examConfig.duration_minutes} मिनट · तुरंत रिज़ल्ट`,`${examConfig.total_questions} questions · ${examConfig.duration_minutes} minutes · instant results`)}</p><div className="feature-meta"><span><Clock3 size={14}/> {examConfig.duration_minutes} min</span><span><Target size={14}/> {Number(examConfig.total_questions) * Number(examConfig.marks_per_question)} marks</span></div><button className="primary-button" disabled={questionBankLoading || !availableQuestionCount} onClick={startTest}>{questionBankLoading ? t("सवाल लोड हो रहे हैं…","Loading questions…") : t("टेस्ट शुरू करें","Start mock test")}<ArrowRight size={17}/></button>{!user ? <small className="start-hint">{t("Guest mode चालू है — login optional है।","Guest mode is enabled — login is optional.")}</small> : questionLoadError ? <small className="start-hint error-hint">{questionLoadError}</small> : null}<div className="card-decoration">01</div></article><article className="feature-card"><div className="feature-top"><div className="feature-icon green-icon"><Target size={22}/></div><span className="tag tag-green">PRACTICE</span></div><h3>{t("स्मार्ट रिविज़न","Smart revision")}</h3><p>{t("गलत जवाबों की समीक्षा करें और कॉन्सेप्ट मज़बूत करें।","Review explanations and strengthen concepts.")}</p><div className="mini-progress"><span style={{width: history.length ? "65%" : "8%"}}/></div><div className="feature-meta"><span>{t("आपकी प्रगति","Your progress")}</span><span>{history.length ? "65%" : "0%"}</span></div><button className="secondary-button" onClick={() => setView("history")}>{t("रिज़ल्ट देखें","View results")}<ArrowRight size={16}/></button></article><article className="feature-card"><div className="feature-top"><div className="feature-icon blue-icon"><Globe2 size={22}/></div><span className="tag tag-blue">BILINGUAL</span></div><h3>{t("हिंदी + English","Hindi + English")}</h3><p>{t("अपनी सुविधा के अनुसार भाषा बदलें।","Switch between Hindi and English anytime.")}</p><div className="language-pills"><span>अ आ इ</span><span>ABC</span></div><div className="feature-meta"><span>{t("दोनों भाषाओं में सवाल","Questions in both languages")}</span></div><button className="secondary-button" onClick={() => setLanguage(hi ? "en" : "hi")}>{t("English में बदलें","Switch to हिंदी")}<Languages size={16}/></button></article></div>}<div className="stats-grid"><div className="stat-card"><div className="stat-top"><span>{t("कुल मॉक टेस्ट","MOCK TESTS")}</span><div className="stat-icon purple"><BookOpen size={18}/></div></div><div className="stat-value">{history.length.toString().padStart(2,"0")}<small> / 50</small></div><div className="stat-foot">{t("हर प्रयास मायने रखता है","Every attempt counts")}</div></div><div className="stat-card"><div className="stat-top"><span>{t("सर्वश्रेष्ठ स्कोर","BEST SCORE")}</span><div className="stat-icon gold"><Trophy size={18}/></div></div><div className="stat-value">{history.length ? (() => { const best = history.reduce((a, h) => Number(h.score || 0) / Math.max(1, Number(h.total_questions || 10) * Number(h.marks_per_question || 1)) > Number(a.score || 0) / Math.max(1, Number(a.total_questions || 10) * Number(a.marks_per_question || 1)) ? h : a, history[0]); return best.score; })() : "—"}<small> / {history.length ? (() => { const best = history.reduce((a, h) => Number(h.score || 0) / Math.max(1, Number(h.total_questions || 10) * Number(h.marks_per_question || 1)) > Number(a.score || 0) / Math.max(1, Number(a.total_questions || 10) * Number(a.marks_per_question || 1)) ? h : a, history[0]); return Number(best.total_questions || 10) * Number(best.marks_per_question || 1); })() : 0}</small></div><div className="stat-foot">{t("अपना रिकॉर्ड तोड़ें","Beat your personal best")}</div></div><div className="stat-card"><div className="stat-top"><span>{t("औसत सटीकता","AVG. ACCURACY")}</span><div className="stat-icon green"><Target size={18}/></div></div><div className="stat-value">{history.length ? Math.round(history.reduce((a,h)=>a+h.accuracy,0)/history.length) : 0}<small>%</small></div><div className="stat-foot">{t("सही जवाबों का प्रतिशत","Correct answer rate")}</div></div></div>

        </div>}

        {view === "boards" && <div className="content boards-content">
          <div className="boards-hero"><div><div className="eyebrow"><span className="eyebrow-line"/> {t("परीक्षा खोजें","FIND YOUR EXAM")}</div><h1>{t("परीक्षा बोर्ड","Exam Boards")}</h1><p className="intro">{t("बोर्ड चुनें, भर्ती चुनें और फिर focused mock test शुरू करें।","Choose a board, select a recruitment, then launch a focused mock test.")}</p></div><div className="boards-hero-badge"><GraduationCap size={28}/><span>EXAM<br/>HUB</span></div></div>
<div className="job-section">
            <div className="section-heading job-heading"><div><h2>{t("परीक्षा बोर्ड चुनें","Choose an exam board")}</h2><p>{t("पहले बोर्ड चुनें, फिर उसी बोर्ड की भर्ती/परीक्षा खोलें।","Choose a board first, then pick a recruitment or exam.")}</p></div><span className="section-count">{String(jobTracks.length).padStart(2,"0")} {t("पोस्ट","POSTS")}</span></div>
            <div className="exam-board-tabs" role="tablist" aria-label={t("परीक्षा बोर्ड","Exam boards")}>
              {examGroups.map(group => {
                const count = filteredJobTracks.filter(track => getExamGroup(track) === group.key).length;                const ready = filteredJobTracks.filter(track => getExamGroup(track) === group.key && track.question_bank_ready === true && track.exam_slug).length;
                return <button key={group.key} type="button" role="tab" aria-selected={openExamGroup === group.key} className={"exam-board-tab " + (openExamGroup === group.key ? "active" : "")} onClick={() => setOpenExamGroup(group.key)}>
                  <span className="board-tab-icon">{group.icon}</span><span className="board-tab-copy"><b>{hi ? group.labelHi : group.labelEn}</b><small>{count} {t("पोस्ट","posts")}</small></span><em>{ready > 0 ? String(ready) + " READY" : "SOON"}</em>
                </button>;
              })}
            </div>
            <div className="exam-toolbar">
              <div className="exam-search"><Search size={15}/><input value={examQuery} onChange={e => setExamQuery(e.target.value)} placeholder={t("इस बोर्ड में परीक्षा खोजें…","Search this board…")} /></div>
              <div className="exam-filters"><button type="button" aria-pressed={examFilter==="all"} className={examFilter==="all" ? "active" : ""} onClick={() => setExamFilter("all")}><SlidersHorizontal size={13}/>{t("सभी","All")}</button><button type="button" aria-pressed={examFilter==="recruitment"} className={examFilter==="recruitment" ? "active" : ""} onClick={() => setExamFilter("recruitment")}>{t("भर्ती","Recruitment")}</button><button type="button" aria-pressed={examFilter==="entrance"} className={examFilter==="entrance" ? "active" : ""} onClick={() => setExamFilter("entrance")}>{t("प्रवेश","Entrance")}</button><button type="button" aria-pressed={examFilter==="eligibility"} className={examFilter==="eligibility" ? "active" : ""} onClick={() => setExamFilter("eligibility")}>{t("पात्रता","Eligibility")}</button></div>
            </div>
            <div className="exam-groups">{jobTracksLoading ? <div className="exam-loading">{t("परीक्षा बोर्ड लोड हो रहे हैं…","Loading exam boards…")}</div> : (() => {
              const group = examGroups.find(item => item.key === openExamGroup) || examGroups[0];
              const groupTracks = filteredJobTracks
                .filter(track => getExamGroup(track) === group.key)
                .sort((a, b) => {
                  const aReady = a.question_bank_ready === true && Boolean(a.exam_slug);
                  const bReady = b.question_bank_ready === true && Boolean(b.exam_slug);
                  return Number(bReady) - Number(aReady);
                });
              return <section className="exam-group exam-group-active">
                <div className="active-board-head"><div><span className="active-board-kicker">{group.icon} {t("चयनित बोर्ड","SELECTED BOARD")}</span><h3>{hi ? group.labelHi : group.labelEn}</h3></div><span>{groupTracks.length} {t("पोस्ट","posts")}</span></div>
                {groupTracks.length ? <div className="job-grid">{groupTracks.map((track,index) => <article key={track.slug + (expandedJobTrack === track.slug ? "-expanded" : "-collapsed")} onClick={() => setExpandedJobTrack(current => current === track.slug ? null : track.slug)} className={"job-card " + (selectedJobTrack === track.slug ? "selected" : "") + (expandedJobTrack === track.slug ? " revealed" : "") + (!track.question_bank_ready ? "coming" : "")}>
                  <span className="job-number">{String(index + 1).padStart(2,"0")}</span><div className="job-3d-icon"><GraduationCap size={17}/></div>
                  <div className="job-copy"><b>{hi ? track.name_hi : track.name_en}</b><span>{hi ? track.description_hi : track.description_en}</span><small>{track.exam_date_text ? "📅 " + track.exam_date_text : ""}{track.form_status_text ? (track.exam_date_text ? " · " : "") + track.form_status_text : ""}</small></div>
                  <em>{track.question_bank_ready ? t("अभी उपलब्ध","READY") : t("जल्द आएगा","SOON")}</em>
                  {expandedJobTrack === track.slug && <button type="button" className="job-open-button" disabled={!track.question_bank_ready || !track.exam_slug} onClick={(event) => { event.stopPropagation(); if (!track.question_bank_ready || !track.exam_slug) return; setSelectedJobTrack(track.slug); setSelectedSubject("all"); setSelectedTopic("all"); setSelectedExam(track.exam_slug); setAvailableQuestionCount(Number(track.verified_question_count || 0)); setQuestionLoadError(""); const exam=exams.find(item => item.slug === track.exam_slug); if (exam) { setExamConfig({ total_questions:Number(exam.total_questions || 10), duration_minutes:Math.max(30, Number(exam.duration_minutes || 10)), marks_per_question:Number(exam.marks_per_question || 1), negative_marks:Number(exam.negative_marks || 0), passing_percentage:Number(exam.passing_percentage || 33) }); setExamId(exam.id); setExamName(exam.name || "Mock Test"); setPracticeQuestionCount(Math.min(30, Number(track.verified_question_count || 10))); setPracticeDuration(Math.max(30, Number(exam.duration_minutes || 10))); } setView("setup"); if (typeof window !== "undefined") window.history.replaceState({view:"setup"}, "", "#exam-setup"); }}>{t("Open","Open")}<ArrowRight size={14}/></button>}
                  {selectedJobTrack === track.slug && <Check className="job-selected-check" size={15}/>}
                </article>)}</div> : <div className="exam-empty"><b>{t("इस बोर्ड में अभी कोई मैचिंग परीक्षा नहीं मिली।","No matching exams found for this board.")}</b><span>{t("सर्च हटाकर या दूसरा बोर्ड चुनकर देखें।","Clear the search or choose another board.")}</span></div>}
                {selectedTrackData && getExamGroup(selectedTrackData) === group.key && <div className="exam-detail-panel">
                  <div className="exam-detail-head"><div><span className="active-board-kicker">{group.icon} {t("परीक्षा विवरण","EXAM DETAILS")}</span><h3>{hi ? selectedTrackData.name_hi : selectedTrackData.name_en}</h3><p>{hi ? selectedTrackData.description_hi : selectedTrackData.description_en}</p></div><span className={"detail-status " + (selectedTrackData.question_bank_ready ? "ready" : "soon")}>{selectedTrackData.question_bank_ready ? "✓ READY" : "SOON"}</span></div>
                  {selectedTrackData.official_url && <a className="job-official-link" href={selectedTrackData.official_url} target="_blank" rel="noopener noreferrer"><Globe2 size={15}/>{t("आधिकारिक वेबसाइट खोलें","Open official website")}<ArrowRight size={14}/></a>}
                  <div className="exam-detail-stats"><div><span>{t("सवाल","QUESTIONS")}</span><b>{Number(selectedTrackData.verified_question_count || 0)}</b></div><div><span>{t("टेस्ट समय","TEST TIME")}</span><b>{examConfig.duration_minutes} min</b></div><div><span>{t("मार्किंग","MARKING")}</span><b>{examConfig.marks_per_question} / -{examConfig.negative_marks}</b></div><div><span>{t("सोर्स","SOURCE")}</span><b>{Number(selectedTrackData.pyq_question_count || 0) + Number(selectedTrackData.official_question_count || 0) > 0 ? (Number(selectedTrackData.practice_question_count || 0) > 0 ? "MIXED BANK" : "OFFICIAL / PYQ") : "PRACTICE BANK"}</b></div></div>
                  <div className="exam-detail-actions"><span>{selectedTrackData.question_bank_ready ? t("Question bank उपलब्ध है।","Question bank is available.") : t("Question bank तैयार होते ही unlock होगा।","Unlocks when the question bank is ready.")}</span>{selectedTrackData.question_bank_ready && Number(selectedTrackData.verified_question_count || 0) > 0 && <button className="primary-button" onClick={startTest}>{t("मॉक टेस्ट शुरू करें","Start mock test")}<ArrowRight size={17}/></button>}</div>
                </div>}
              </section>;
            })()}</div>
          </div>
          {selectedTrackData?.question_bank_ready && selectedTrackData?.exam_slug ? <>
<div className="selected-exam-strip"><div><span>{t("चयनित परीक्षा","SELECTED EXAM")}</span><b>{hi ? selectedTrackData.name_hi : selectedTrackData.name_en}</b></div><em>{availableQuestionCount > 0 ? "✓ " + availableQuestionCount + " " + t("सवाल तैयार","QUESTIONS READY") : t("बैंक जाँच रहे हैं…","CHECKING BANK…")}</em></div>
<div className="analysis-candidates-panel">
  <div className="section-heading"><div><h2>{t("परीक्षा विश्लेषण","Exam analysis")}</h2><p>{t("High-signal topics को question-bank analysis से ऊपर रखा गया है। ये forecast हैं, guaranteed questions नहीं।","High-signal topics are ranked from question-bank analysis. These are forecasts, not guaranteed exam questions.")}</p></div><span className="section-count">FORECAST</span></div>
  <div className="analysis-candidate-grid">
    {(selectedTrackData.analysis_candidates || []).slice(0,5).map((item,i) => <div className="analysis-candidate" key={item.subject+"-"+item.topic+"-"+i}><span>{String(i+1).padStart(2,"0")}</span><div><b>{item.subject || t("सामान्य","General")}</b><small>{item.topic || t("मिश्रित","Mixed")}</small></div><em>{Math.round(Number(item.prediction_score || 0))}</em></div>)}
  </div>
</div>
<div className="subject-chapter-panel"><div className="section-heading"><div><h2>{t("विषय और अध्याय चुनें","Choose subject & chapter")}</h2><p>{t("पूरे exam की जगह किसी एक subject/topic पर focused practice करें।","Practice a specific subject or topic instead of the full exam.")}</p></div><span className="section-count">FOCUSED PRACTICE</span></div><div className="subject-selector" role="group" aria-label={t("विषय चुनें","Choose subject")}><button type="button" aria-pressed={selectedSubject==="all"} className={selectedSubject==="all"?"active":""} onClick={()=>{setSelectedSubject("all");setSelectedTopic("all");setAuthMessage("")}}>{t("सभी विषय","All subjects")}{selectedSubject==="all" && <Check size={13} className="selector-check"/>}</button>{subjectOptions.map(subject=><button type="button" key={subject} aria-pressed={selectedSubject===subject} className={selectedSubject===subject?"active":""} onClick={()=>{setSelectedSubject(subject);setSelectedTopic("all");setAuthMessage("")}}>{formatQuestionCategory(subject)}{selectedSubject===subject && <Check size={13} className="selector-check"/>}</button>)}</div>{selectedSubject!=="all" && <div className="topic-selector" role="group" aria-label={t("अध्याय चुनें","Choose topic")}><span>{t("अध्याय","CHAPTER")}</span><button type="button" aria-pressed={selectedTopic==="all"} className={selectedTopic==="all"?"active":""} onClick={()=>{setSelectedTopic("all");setAuthMessage("")}}>{t("सभी अध्याय","All chapters")}{selectedTopic==="all" && <Check size={13} className="selector-check"/>}</button>{topicOptions.map(topic=><button type="button" key={topic} aria-pressed={selectedTopic===topic} className={selectedTopic===topic?"active":""} onClick={()=>{setSelectedTopic(topic);setAuthMessage("")}}>{formatQuestionCategory(topic)}{selectedTopic===topic && <Check size={13} className="selector-check"/>}</button>)}</div>}{selectedSubject!=="all" && hasCurrentQuestionCatalog && topicOptions.length===0 && <div className="topic-empty">{t("इस विषय के लिए कोई verified chapter उपलब्ध नहीं है।","No verified chapters are available for this subject.")}</div>}</div>
<div className="practice-config">
  <div className="config-block"><b>{t("सवाल कितने?","Questions")}</b><div className="config-options">{Array.from(new Set([10,20,30,40,50,Math.min(100,availableQuestionCount)].filter(n => n > 0 && n <= availableQuestionCount))).sort((a,b) => a-b).map(n=><button type="button" key={n} aria-pressed={practiceQuestionCount===n} className={practiceQuestionCount===n?"active":""} onClick={()=>{setPracticeQuestionCount(n);setAuthMessage("")}}>{n}</button>)}</div><small>{questionBankLoading ? t("इस चयन के लिए सवाल गिने जा रहे हैं…","Checking questions for this selection…") : availableQuestionCount ? t(availableQuestionCount + " verified/active सवाल · " + (selectedSubject === "all" ? "सभी विषय" : formatQuestionCategory(selectedSubject)) + (selectedTopic !== "all" ? " · " + formatQuestionCategory(selectedTopic) : "") + " के लिए उपलब्ध हैं।","" + availableQuestionCount + " verified/active questions available for " + (selectedSubject === "all" ? "all subjects" : formatQuestionCategory(selectedSubject)) + (selectedTopic !== "all" ? " · " + formatQuestionCategory(selectedTopic) : "") + ".") : t("इस विषय/अध्याय में verified सवाल नहीं मिले। दूसरा चयन करें।","No verified questions for this subject/topic. Choose another selection.")}</small></div>
  <div className="config-block"><b>{t("समय कितना?","Time")}</b><div className="config-options">{[10,20,30,45,60,120].map(n=><button type="button" key={n} aria-pressed={practiceDuration===n} className={practiceDuration===n?"active":""} onClick={()=>{setPracticeDuration(n);setAuthMessage("")}}>{n}m</button>)}</div><small>{t("चुना गया समय: "+practiceDuration+" मिनट","Selected duration: "+practiceDuration+" minutes")}</small></div>
  <div className="config-block device-security"><b>{t("SIM / डिवाइस सुरक्षा","SIM / Device security")}</b><div className="config-options"><button onClick={requestNativeSimPermission}>{nativeSimStatus === "sim-ready" ? t("SIM चालू ✓","SIM active ✓") : t("SIM अनुमति दें","Allow SIM")}</button>{user && <button onClick={createRecoveryCode}>{t("नए फोन के लिए recovery code","Create recovery code")}</button>}</div><small>{t("Recovery code trusted device से बनता है, 15 मिनट में expire होता है और एक बार इस्तेमाल होता है।","Recovery code is created on the trusted device, expires in 15 minutes, and works once.")}</small></div>
</div>
</> : <div className="selection-empty">{t("ऊपर से READY परीक्षा चुनें।","Choose a READY exam above.")}<span>{t("SOON वाली परीक्षाएँ उपलब्ध होते ही unlock होंगी।","SOON exams unlock when their verified question bank is ready.")}</span></div>}
{authMessage && <div className={"dashboard-action-message" + (nativeSimStatus === "sim-ready" ? " success" : "")} role="status" aria-live="polite">{authMessage}</div>}<div className="bottom-note"><div className="note-icon"><ShieldCheck size={18}/></div><div><b>{t("आपकी तैयारी, आपकी रफ़्तार","Your preparation, your pace")}</b><p>{t("यह डेमो प्लेटफॉर्म है। अभ्यास के लिए प्रश्न दिए गए हैं; आधिकारिक परीक्षा के लिए नवीनतम सिलेबस देखें।","This is a demo practice platform. Check the latest official syllabus for your target exam.")}</p></div></div>
        </div>}

        {view === "setup" && selectedTrackData && <div className="content exam-setup-content">
          <button className="back-link" onClick={() => navigateTo("boards")}><ChevronLeft size={17}/>{t("परीक्षा सूची पर वापस","Back to exams")}</button>
          <div className="setup-hero"><div><div className="eyebrow"><span className="eyebrow-line"/> {t("टेस्ट सेटअप","TEST SETUP")}</div><h1>{hi ? selectedTrackData.name_hi : selectedTrackData.name_en}</h1><p className="intro">{hi ? selectedTrackData.description_hi : selectedTrackData.description_en}</p></div><div className="setup-status">✓ READY</div></div>
          <div className="setup-summary"><div><span>{t("उपलब्ध सवाल","AVAILABLE")}</span><b>{availableQuestionCount}</b></div><div><span>{t("सही जवाब","CORRECT")}</span><b>+{examConfig.marks_per_question}</b></div><div><span>{t("गलत जवाब","WRONG")}</span><b>-{examConfig.negative_marks}</b></div><div><span>{t("सोर्स","SOURCE")}</span><b>{Number(selectedTrackData.pyq_question_count || 0) + Number(selectedTrackData.official_question_count || 0) > 0 ? (Number(selectedTrackData.practice_question_count || 0) > 0 ? "MIXED BANK" : "OFFICIAL / PYQ") : "PRACTICE BANK"}</b></div></div>
          <div className="setup-card"><div className="section-heading"><div><h2>{t("अपना टेस्ट सेट करें","Configure your test")}</h2><p>{t("सिस्टम उपलब्ध verified सवालों के हिसाब से default चुनता है।","The system chooses a safe default from the verified question bank.")}</p></div><span className="section-count">AUTO READY</span></div>
            <div className="setup-filter-panel">
              <div className="setup-filter-head">
                <b>{t("विषय और अध्याय (वैकल्पिक)","Subject & topic (optional)")}</b>
                <small>{t("पूरा मॉक टेस्ट देने के लिए सभी विषय चुनें।","Choose all subjects for a full mixed mock test.")}</small>
              </div>
              {hasCurrentQuestionCatalog ? <>
                <div className="subject-selector setup-subject-selector" role="group" aria-label={t("विषय चुनें","Choose subject")}>
                  <button type="button" aria-pressed={selectedSubject==="all"} className={selectedSubject==="all"?"active":""} onClick={()=>{setSelectedSubject("all");setSelectedTopic("all");setAuthMessage("")}}>{t("सभी विषय","All subjects")}{selectedSubject==="all" && <Check size={13} className="selector-check"/>}</button>
                  {subjectOptions.map(subject=><button type="button" key={subject} aria-pressed={selectedSubject===subject} className={selectedSubject===subject?"active":""} onClick={()=>{setSelectedSubject(subject);setSelectedTopic("all");setAuthMessage("")}}>{formatQuestionCategory(subject)}{selectedSubject===subject && <Check size={13} className="selector-check"/>}</button>)}
                </div>
                {selectedSubject!=="all" && <div className="topic-selector setup-topic-selector" role="group" aria-label={t("अध्याय चुनें","Choose topic")}>
                  <span>{t("अध्याय","CHAPTER")}</span>
                  <button type="button" aria-pressed={selectedTopic==="all"} className={selectedTopic==="all"?"active":""} onClick={()=>{setSelectedTopic("all");setAuthMessage("")}}>{t("सभी अध्याय","All chapters")}{selectedTopic==="all" && <Check size={13} className="selector-check"/>}</button>
                  {topicOptions.map(topic=><button type="button" key={topic} aria-pressed={selectedTopic===topic} className={selectedTopic===topic?"active":""} onClick={()=>{setSelectedTopic(topic);setAuthMessage("")}}>{formatQuestionCategory(topic)}{selectedTopic===topic && <Check size={13} className="selector-check"/>}</button>)}
                </div>}
                {selectedSubject!=="all" && topicOptions.length===0 && <div className="topic-empty">{t("इस विषय के लिए कोई verified अध्याय उपलब्ध नहीं है।","No verified topics are available for this subject.")}</div>}
              </> : <small className="setup-filter-loading">{t("विषय और अध्याय लोड हो रहे हैं…","Loading subjects and topics…")}</small>}
            </div>
            <div className="setup-block"><b>{t("कितने सवाल?","How many questions?")}</b><div className="setup-options">{Array.from(new Set([10,20,30,40,50,Math.min(100,availableQuestionCount)].filter(n=>n>0&&n<=availableQuestionCount))).sort((a,b)=>a-b).map(n=><button type="button" key={n} aria-pressed={practiceQuestionCount===n} className={practiceQuestionCount===n?"active":""} onClick={()=>setPracticeQuestionCount(n)}>{n}</button>)}</div><small>{t("डिफ़ॉल्ट: उपलब्ध बैंक के अनुसार auto-selected","Default: auto-selected from the available bank")}</small></div>
            <div className="setup-block"><b>{t("कितना समय?","Time limit?")}</b><div className="setup-options">{[10,20,30,45,60,120].map(n=><button type="button" key={n} aria-pressed={practiceDuration===n} className={practiceDuration===n?"active":""} onClick={()=>setPracticeDuration(n)}>{n} min</button>)}</div><small>{t("Timer test शुरू होते ही चलेगा।","Timer starts when the fresh test begins.")}</small></div>
            <div className="setup-auto"><Target size={20}/><div><b>{t("Automatic test system","Automatic test system")}</b><span>{t("Fresh questions • fresh timer • instant scoring • old answers reset","Fresh questions • fresh timer • instant scoring • old answers reset")}</span></div><Check size={20}/></div>
            {authMessage && <div className="setup-message">{authMessage}</div>}<button className="primary-button setup-start" onClick={runTest} disabled={questionBankLoading || !availableQuestionCount}>{questionBankLoading ? t("सवाल तैयार हो रहे हैं…","Preparing questions…") : t("फ्रेश टेस्ट शुरू करें","Start fresh test")}<ArrowRight size={19}/></button>
          </div>
        </div>}

        {view === "login" && (
          <div className="content login-content">
            <div className="login-hero">
              <div className="login-icon"><ShieldCheck size={34} /></div>
              <div>
                <div className="eyebrow"><span className="eyebrow-line" /> EXAMPREP ACCOUNT</div>
                <h1>{user ? t("अकाउंट सक्रिय है", "Account active") : t("लॉगिन / अकाउंट", "Login / Account")}</h1>
                <p className="intro">{user ? t("आपका result cloud में sync किया जा सकता है।", "Your results can sync to the cloud.") : t("Guest mode में भी परीक्षा दे सकते हैं। Login सिर्फ cloud sync के लिए है।", "You can take exams as a guest. Login is only needed for cloud sync.")}</p>
              </div>
            </div>
            <div className="login-card">
              {user ? (
                <>
                  <div className="login-success">
                    <CheckCircle2 size={24} />
                    <div><b>{getUserDisplayName(user)}</b><span>{user.email || user.phone || "Cloud account"}</span></div>
                  </div>
                  <button className="secondary-button" onClick={logout}>{t("इस device से लॉगआउट", "Sign out on this device")}<X size={16} /></button>
                  <button className="secondary-button danger-button" data-testid="logout-all-devices" onClick={logoutAllDevices}>{t("सभी devices से लॉगआउट", "Sign out all devices")}<ShieldCheck size={16} /></button>
                  {authMessage && <small className="login-message">{authMessage}</small>}
                </>
              ) : (
                <>
                  <div className="login-note">{t("लॉगिन optional है — बिना login के भी test और result local device पर काम करेंगे।", "Login is optional — tests and results work locally without an account.")}</div>
                  <div className="auth-divider"><span>{t("Email या मोबाइल से login", "EMAIL OR MOBILE LOGIN")}</span></div>
                  {authStep === "phone" ? (
                    <>
                      <div className="auth-method-switch">
                        <button type="button" data-testid="login-method-email" aria-pressed={authMethod === "email"} onClick={() => { setAuthMethod("email"); setAuthMessage(""); }}>{authMethod === "email" ? "✓ " : ""}{t("Email login", "Email login")}</button>
                        <button type="button" data-testid="login-method-phone" aria-pressed={authMethod === "phone"} onClick={() => { setAuthMethod("phone"); setAuthMessage(""); }}>{authMethod === "phone" ? "✓ " : ""}{t("Mobile SMS", "Mobile SMS")}</button>
                      </div>
                      {authMethod === "email"
                        ? <input type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" inputMode="email" placeholder={t("आपका email address", "Your email address")} data-testid="login-email-input" />
                        : <div className="phone-input"><span>+91</span><input value={phone} onChange={e => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))} inputMode="numeric" autoComplete="tel-national" maxLength={10} placeholder="10 अंकों का मोबाइल नंबर" /></div>}
                      <button className="primary-button" onClick={sendOtp} disabled={otpCooldown > 0}>{otpCooldown > 0 ? t("फिर भेजें", "Resend") + " (" + otpCooldown + "s)" : authMethod === "email" ? t("Login link भेजें", "Send login link") : t("OTP भेजें", "Send SMS OTP")}<ArrowRight size={17} /></button>
                    </>
                  ) : authStep === "otp" ? (
                    <>
                      <input value={otp} onChange={e => setOtp(e.target.value)} inputMode="numeric" maxLength={6} placeholder={t("6-digit OTP", "6-digit code")} />
                      <button className="primary-button" onClick={verifyOtp}>{t("Code verify करें", "Verify code")}<Check size={17} /></button>
                      <button type="button" className="secondary-button" onClick={() => { setAuthStep("phone"); setOtp(""); setAuthMessage(""); }}>{t("Login method बदलें", "Change login method")}</button>
                    </>
                  ) : authStep === "email-sent" ? (
                    <>
                      <div className="login-note">{t("अपने email के Inbox/Spam में आए login link को खोलें। यदि email में 6-digit code है, तो नीचे दर्ज करें।", "Open the sign-in link in your email inbox/spam. If the email contains a 6-digit code, enter it below.")}</div>
                      <input value={otp} onChange={e => setOtp(e.target.value)} inputMode="numeric" maxLength={6} placeholder={t("Email code (यदि दिया हो)", "Email code (if provided)")} />
                      <button className="primary-button" onClick={verifyOtp}>{t("Email code verify करें", "Verify email code")}<Check size={17} /></button>
                      <button type="button" className="secondary-button" onClick={() => { setAuthStep("phone"); setOtp(""); setAuthMessage(""); }}>{t("Email बदलें / वापस जाएँ", "Change email / go back")}</button>
                    </>
                  ) : (
                    <>
                      <input value={recoveryCode} onChange={e => setRecoveryCode(e.target.value.toUpperCase())} maxLength={9} placeholder={t("Recovery code", "Recovery code")} />
                      <button className="primary-button" onClick={recoverTrustedDevice}>{t("Device बदलें", "Replace device")}<ArrowRight size={17} /></button>
                    </>
                  )}
                                    <div className="auth-divider"><span>{t("या", "OR")}</span></div>
                  <button type="button" className="secondary-button" onClick={signInWithGoogle}><Globe2 size={17} />{t("Google से लॉगिन करें", "Continue with Google")}</button>
                  {authMessage && <small className="login-message">{authMessage}</small>}
                </>
              )}
            </div>
          </div>
        )}

        {view === "instructions" && <div className="content instructions-content"><div className="instructions-hero"><div><div className="eyebrow"><span className="eyebrow-line"/> {t("टेस्ट से पहले","BEFORE YOU START")}</div><h1>{examName}</h1><p className="intro">{t("एक बार नियम देख लें, फिर बिना distraction के टेस्ट शुरू करें।","Review the rules once, then start the test without distractions.")}</p></div><div className="instruction-orb"><BookOpen size={38}/></div></div><div className="instruction-grid"><div className="instruction-stat"><span>{t("सवाल","QUESTIONS")}</span><b>{practiceQuestionCount}</b><small>{selectedSubject === "all" ? t("पूरा syllabus pool","Full syllabus pool") : selectedSubject}</small></div><div className="instruction-stat"><span>{t("समय","TIME")}</span><b>{practiceDuration} min</b><small>{t("Timer test शुरू होते ही चलेगा","Timer starts with the test")}</small></div><div className="instruction-stat"><span>{t("सही उत्तर","CORRECT")}</span><b>+{examConfig.marks_per_question}</b><small>{t("हर सही जवाब","For each correct answer")}</small></div><div className="instruction-stat negative"><span>{t("गलत उत्तर","WRONG")}</span><b>-{examConfig.negative_marks}</b><small>{t("Negative marking","Negative marking")}</small></div></div><div className="rules-card"><div className="section-heading"><div><h2>{t("महत्वपूर्ण निर्देश","Important instructions")}</h2><p>{t("इन नियमों को ध्यान से पढ़ें।","Read these rules carefully.")}</p></div><span className="section-count">RULES</span></div><div className="rules-list"><div><b>01</b><span>{t("हर सवाल का एक सही विकल्प चुनें। जवाब बाद में बदला जा सकता है।","Choose one option for each question. Answers can be changed before submission.")}</span></div><div><b>02</b><span>{t("Review के लिए सवाल mark कर सकते हैं और question palette से वापस जा सकते हैं।","You can mark questions for review and jump back using the question palette.")}</span></div><div><b>03</b><span>{t("Timer समाप्त होने पर test submit हो जाएगा।","The test will submit when the timer reaches zero.")}</span></div><div><b>04</b><span>{t("सवालों के source labels test में दिखाई देंगे: PYQ, OFFICIAL, MEMORY-BASED या PRACTICE।","Question source labels appear in the test: PYQ, OFFICIAL, MEMORY-BASED, or PRACTICE.")}</span></div></div></div><div className="instruction-bottom"><span>{!user ? t("Guest mode: result इसी device पर save होगा।","Guest mode: your result will be saved on this device.") : t("आप logged in हैं; result cloud history में save किया जा सकता है।","You are logged in; your result can be saved to cloud history.")}</span><div><button className="secondary-button" onClick={()=>setView("home")}>{t("वापस","Back")}</button><button className="primary-button" onClick={runTest}>{t("मैं तैयार हूँ — टेस्ट शुरू करें","I’m ready — Start test")}<ArrowRight size={17}/></button></div></div></div>}

        {view === "test" && <div className="content test-content anti-cheat-screen" onContextMenu={e=>e.preventDefault()} onCopy={e=>e.preventDefault()} onCut={e=>e.preventDefault()}><div className="question-screen-top">{testFocusWarning && <div className="test-focus-warning"><ShieldCheck size={15}/> {t("टेस्ट स्क्रीन से बाहर गए थे। ध्यान रखें—यह session जारी है।","You left the test screen. Stay focused—this session is still active.")}</div>}<div className="live-test-badge"><span/> LIVE TEST</div><div className="test-title-row"><div><div className="eyebrow"><span className="eyebrow-line"/> {t("मॉक टेस्ट / परीक्षा","MOCK TEST / EXAM")}</div><h1>{examName}</h1><p className="intro">{t("सवाल ध्यान से पढ़ें। जरूरत हो तो रिव्यू के लिए मार्क करें।","Read carefully. Mark questions for review when needed.")}</p></div><div className={"timer-card " + (seconds < 60 ? "timer-warning" : "")}><Clock3 size={19}/><div><small>{t("बचा हुआ समय","TIME LEFT")}</small><strong>{formatTime(seconds)}</strong></div></div></div><div className="quick-test-meta"><span>✓ {testQuestions.length} {t("सवाल","questions")}</span><span>◉ {getQuestionSourceLabel(q.sourceType, hi) + (q.sourceType === "pyq" && q.sourceYear ? " " + q.sourceYear : "")}</span></div></div><div className="test-progress"><div><span>{t("टेस्ट की प्रगति","TEST PROGRESS")}</span><b>{answered} / {testQuestions.length} {t("जवाब दिए","answered")}</b></div><div className="progress-track"><span style={{width: (answered/testQuestions.length*100)+"%"}}/></div></div>
          <button type="button" className="mobile-finish-test" onClick={() => setShowSubmit(true)}><Flag size={18}/>{t("टेस्ट सबमिट करें","Finish test")}<ArrowRight size={18}/></button>
          <div className="test-layout"><div className="question-panel"><div className="question-meta"><span className="question-number">{t("सवाल","QUESTION")} {current + 1} <i/> {testQuestions.length}</span><span className="subject-chip">{formatQuestionCategory(q.subject)}</span>{q.topic ? <span className="topic-chip">{formatQuestionCategory(q.topic)}</span> : null}<span className="source-chip">{getQuestionSourceLabel(q.sourceType, hi)}</span></div><h2>{displayQuestion}</h2><p className="question-hint">{t("सही विकल्प चुनें। आप अपना जवाब बदल सकते हैं।","Select one option. You can change your answer before submitting.")}</p><div className="options">{displayOptions.map((option,i)=><button key={q.id + "-" + i} className={"option " + (answers[q.id] === i ? "selected" : "")} onClick={() => chooseAnswer(i)}><span className="option-letter">{String.fromCharCode(65+i)}</span><span>{option}</span>{answers[q.id] === i ? <span className="radio-selected"/> : null}</button>)}</div>
          <div className="question-controls"><button className="secondary-button" disabled={current===0} onClick={() => setCurrent(c=>c-1)}><ChevronLeft size={17}/>{t("पिछला","Previous")}</button><button className={"review-button " + (review.includes(q.id) ? "review-on" : "")} onClick={toggleReview}><Flag size={16}/>{review.includes(q.id) ? t("रिव्यू हटाएँ","Unmark review") : t("रिव्यू के लिए","Mark for review")}</button>{current < testQuestions.length-1 ? <button className="primary-button next-button" onClick={() => setCurrent(c=>c+1)}>{t("अगला सवाल","Next question")}<ChevronRight size={17}/></button> : <button className="primary-button next-button" onClick={() => setShowSubmit(true)}>{t("टेस्ट सबमिट करें","Submit test")}<ArrowRight size={17}/></button>}</div></div>
          <aside className="question-nav"><div className="nav-heading"><h3>{t("सवालों की सूची","Question palette")}</h3><span>{answered}/{testQuestions.length}</span></div><p>{t("किसी सवाल पर जाने के लिए नंबर चुनें।","Tap a number to jump to a question.")}</p><div className="number-grid">{testQuestions.map((item,i)=><button key={item.id} onClick={() => setCurrent(i)} className={"number-cell " + (current===i ? "current" : "") + (answers[item.id] !== undefined ? " answered" : "") + (review.includes(item.id) ? " marked" : "")}>{String(item.id).padStart(2,"0")}{review.includes(item.id) && <i/>}</button>)}</div><div className="legend"><span><i className="legend-answered"/> {t("जवाब दिया","Answered")}</span><span><i className="legend-marked"/> {t("रिव्यू","Review")}</span><span><i className="legend-empty"/> {t("बाकी","Not answered")}</span></div><div className="nav-summary"><div><span>{t("जवाब दिए","Answered")}</span><b>{answered}</b></div><div><span>{t("बाकी सवाल","Remaining")}</span><b>{testQuestions.length-answered}</b></div><div><span>{t("रिव्यू के लिए","For review")}</span><b>{review.length}</b></div></div><button className="submit-full" onClick={() => setShowSubmit(true)}>{t("टेस्ट समाप्त करें","Finish test")}<ArrowRight size={16}/></button></aside></div>
          {showSubmit && <div className="modal-backdrop"><div className="confirm-modal"><div className="modal-icon"><Flag size={22}/></div><h2>{t("टेस्ट सबमिट करें?","Submit your test?")}</h2><p>{t("आपने","You have answered")} {answered} {t("में से "+testQuestions.length+" सवालों के जवाब दिए हैं। सबमिट करने के बाद जवाब नहीं बदल पाएँगे।","of the selected questions. You cannot change answers after submission.")}</p>{authMessage && <p role="alert" className="setup-message">{authMessage}</p>}<div className="modal-actions"><button className="secondary-button" onClick={() => setShowSubmit(false)}>{t("वापस जाएँ","Go back")}</button><button className="primary-button" onClick={finishTest} disabled={grading}>{grading ? t("जाँच हो रही है…","Grading…") : t("हाँ, सबमिट करें","Yes, submit")}</button></div></div></div>}
        </div>}

        {view === "result" && result && <div className="content result-content">
          <div className="result-hero">
            <div className="result-trophy"><Trophy size={37}/></div>
            <div className="eyebrow"><span className="eyebrow-line"/> SESSION COMPLETE</div>
            <h1>{t("शानदार प्रयास, " + getUserDisplayName(user) + "!","Great effort, " + getUserDisplayName(user) + "!")}</h1>
            <p>{t("हर टेस्ट आपको आपके लक्ष्य के और करीब ले जाता है।","Every attempt takes you one step closer to your goal.")}</p>
            <p>{t("नेट स्कोर:","Net score:")} <b>{result.score}</b> · {t("कटौती:","Negative:")} <b>{result.negative_score}</b></p>
            <div className="score-circle"><div><strong>{result.score}<small>/{Number(result.total_questions || 0) * Number(result.marks_per_question || 1)}</small></strong><span>{t("आपका स्कोर","YOUR SCORE")}</span></div></div>
          </div>
          <div className="result-insight">
            <div className="result-insight-main">
              <span>{t("आपका प्रदर्शन","YOUR PERFORMANCE")}</span>
              <b>{result.accuracy >= 80 ? t("बहुत बढ़िया!","Excellent!") : result.accuracy >= 60 ? t("अच्छी प्रगति","Good progress") : t("अभ्यास जारी रखें","Keep practicing")}</b>
              <p>{result.accuracy >= 60 ? t("गलत और बिना जवाब वाले सवालों की समीक्षा करके consistency बढ़ाएँ।","Review incorrect and unanswered questions to improve consistency.") : t("गलत और बिना जवाब वाले सवालों को दोबारा पढ़ें और अगली कोशिश में सुधार करें।","Review incorrect and unanswered questions and improve on the next attempt.")}</p>
            </div>
            <div className="performance-meter"><span>{t("सटीकता","Accuracy")}</span><strong>{result.accuracy}%</strong><div><i style={{width: Math.min(100, Math.max(0, Number(result.accuracy) || 0)) + "%"}}/></div></div>
          </div>
          <div className="result-stats">
            <div className="result-stat"><CheckCircle2 size={19}/><span>{t("सही जवाब","Correct")}</span><b>{result.correct}</b></div>
            <div className="result-stat"><Target size={19}/><span>{t("Gross Marks","Gross marks")}</span><b>{result.gross_score}</b></div>
            <div className="result-stat wrong-stat"><X size={19}/><span>{t("Negative Marks","Negative marks")}</span><b>-{result.negative_score}</b></div>
            <div className="result-stat wrong-stat"><X size={19}/><span>{t("गलत जवाब","Incorrect")}</span><b>{result.wrong}</b></div>
            <div className="result-stat unanswered-stat"><Clock3 size={19}/><span>{t("बिना जवाब","Unanswered")}</span><b>{result.unanswered}</b></div>
            <div className="result-stat accuracy-stat"><Target size={19}/><span>{t("सटीकता","Accuracy")}</span><b>{result.accuracy}%</b></div>
          </div>
          <div className="subject-analysis">
            <div className="section-heading"><div><h2>{t("विषयवार प्रदर्शन","Subject performance")}</h2><p>{t("किस विषय में पकड़ मजबूत है और कहाँ सुधार चाहिए।","See your strengths and where to improve.")}</p></div><span className="section-count">ANALYSIS</span></div>
            <div className="subject-list">
              {Object.entries(testQuestions.reduce((acc,item) => {
                const key = item.subject || "General";
                const row = acc[key] || {total:0, correct:0};
                row.total += 1;
                if (answers[item.id] === reviewAnswers[String(item.id)]?.answer) row.correct += 1;
                acc[key] = row;
                return acc;
              }, {})).map(([subject,data]) => {
                const pct = Math.round(data.correct / Math.max(1,data.total) * 100);
                return <div className="subject-row" key={subject}><div className="subject-row-head"><b>{subject}</b><span>{data.correct}/{data.total} · {pct}%</span></div><div className="subject-bar"><i style={{width: pct + "%"}}/></div></div>;
              })}
            </div>
          </div>
          <div className="review-panel">
            <div className="section-heading"><div><h2>{t("सवालों की समीक्षा","Review your answers")}</h2><p>{t("सही उत्तर और व्याख्या देखें।","See the correct answer and explanation.")}</p></div><span className="section-count">{result.total_questions} QUESTIONS</span></div>
            {testQuestions.map((item,i) => {
              const answer = answers[item.id];
              const reviewItem = reviewAnswers[String(item.id)] || {};
              const correctAnswer = reviewItem.answer;
              const reviewOptions = hi && item.optionsHi ? item.optionsHi : !hi && item.optionsEn ? item.optionsEn : item.options;
              const explanation = (hi ? reviewItem.explanation_hi : reviewItem.explanation_en) || (hi ? reviewItem.explanation : "") || "";
              const isRight = answer !== undefined && answer === correctAnswer;
              const reviewQuestionText = hi ? (item.hi || item.en) : (item.en || item.hi);
              return <div className="review-question" key={item.id}><div className={"review-status " + (answer === undefined ? "status-empty" : isRight ? "status-right" : "status-wrong")}>{answer === undefined ? "—" : isRight ? <Check size={16}/> : <X size={16}/>}</div><div className="review-body"><b>{i+1}. {reviewQuestionText}</b><span>{t("आपका जवाब:","Your answer:")} {answer === undefined ? t("जवाब नहीं दिया","Not answered") : reviewOptions[answer]}</span><span className="correct-answer">{t("सही जवाब:","Correct answer:")} {correctAnswer === undefined ? t("उपलब्ध नहीं","Unavailable") : reviewOptions[correctAnswer]}</span>{explanation ? <details className="review-explanation" open={!isRight}><summary>{t("उत्तर की व्याख्या","Explanation")}</summary><p>{explanation}</p></details> : <p className="review-explanation-missing">{t("इस सवाल की विस्तृत व्याख्या अभी उपलब्ध नहीं है।","A detailed explanation is not available for this question yet.")}</p>}</div></div>;
            })}
          </div>
          <div className="result-actions"><button className="secondary-button" onClick={() => setView("home")}><Home size={17}/>{t("डैशबोर्ड","Dashboard")}</button><button className="primary-button" onClick={startTest}><RotateCcw size={17}/>{t("फिर से टेस्ट दें","Retake test")}</button></div>
        </div>}


        {view === "paper" && <div className="content paper-analyzer-content">
          <div className="eyebrow"><span className="eyebrow-line"/> AI PAPER WORKSPACE</div>
          <div className="paper-analyzer-hero">
            <div className="paper-analyzer-icon"><FileText size={28}/></div>
            <div>
              <h1 data-testid="paper-analyzer-title">{t("अपने प्रश्न-पत्र का विश्लेषण करें","Analyze your question paper")}</h1>
              <p className="intro">{t("PDF या साफ़ फोटो चुनें। पेपर के विषय और कठिनाई का अनुमान मिलेगा, साथ में नए bilingual practice MCQs बनेंगे।","Upload a PDF or a clear photo to estimate topics and difficulty, then create new bilingual practice MCQs.")}</p>
            </div>
          </div>
          <div className="paper-privacy-note">
            <Info size={18}/>
            <p>{t("पेपर ExamPrep में सेव नहीं होगा; विश्लेषण के लिए Gemini API को भेजा जाएगा। निजी दस्तावेज़ अपलोड न करें। तैयार सवाल अभ्यास के लिए हैं, verified official PYQ नहीं।","Your paper is not saved by ExamPrep; it is sent to the Gemini API for analysis. Do not upload private documents. Generated questions are for practice and are not verified official PYQs.")}</p>
          </div>
          {!user && <div className="paper-login-prompt">
            <b>{t("विश्लेषण के लिए लॉगिन ज़रूरी है","Sign-in required")}</b>
            <span>{t("लॉगिन करने के बाद अपनी फ़ाइल अपलोड कर सकते हैं।","Sign in to your account before uploading a file.")}</span>
            <button type="button" className="primary-button" onClick={() => navigateTo("login")}>{t("लॉगिन / अकाउंट खोलें","Open Login / Account")}<ArrowRight size={17}/></button>
          </div>}
          <form className="paper-upload-card" onSubmit={analyzeUploadedPaper}>
            <input
              ref={paperFileInputRef}
              className="paper-file-input"
              type="file"
              accept=".pdf,application/pdf,.jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
              aria-label={t("प्रश्न-पत्र फ़ाइल चुनें","Choose question paper file")}
              onChange={(event) => { selectPaperFile(event.target.files?.[0] || null); event.target.value = ""; }}
            />
            <div
              className={"paper-upload-dropzone" + (paperDragActive ? " is-dragging" : "")}
              onDragEnter={(event) => { event.preventDefault(); setPaperDragActive(true); }}
              onDragOver={(event) => { event.preventDefault(); setPaperDragActive(true); }}
              onDragLeave={(event) => { event.preventDefault(); setPaperDragActive(false); }}
              onDrop={(event) => { event.preventDefault(); setPaperDragActive(false); selectPaperFile(event.dataTransfer.files?.[0] || null); }}
            >
              <div className="paper-upload-icon"><Upload size={27}/></div>
              <h2>{t("अपना पेपर चुनें","Choose your paper")}</h2>
              <p>{t("PDF, JPG, PNG या WEBP · अधिकतम 3 MB","PDF, JPG, PNG, or WEBP · 3 MB maximum")}</p>
              <button type="button" className="secondary-button" onClick={() => paperFileInputRef.current?.click()}><FileText size={17}/>{paperFile ? t("फ़ाइल बदलें","Change file") : t("फ़ाइल चुनें","Browse files")}</button>
              {paperFile && <div className="paper-file-selected"><CheckCircle2 size={17}/><span>{paperFile.name}</span><small>{(paperFile.size / 1024 / 1024).toFixed(2)} MB</small></div>}
            </div>
            {paperAnalysisError && <div className="paper-analysis-error" role="alert">{paperAnalysisError}</div>}
            <button type="submit" className="primary-button paper-analyze-button" disabled={!user || !paperFile || paperAnalysisBusy}>
              {paperAnalysisBusy ? <><span className="paper-spinner"/> {t("विश्लेषण चल रहा है…","Analyzing paper…")}</> : <><Sparkles size={18}/>{t("विश्लेषण और MCQ बनाएं","Analyze & Generate MCQs")}</>}
            </button>
            <p className="paper-free-note">{t("केवल configured free-tier Gemini API इस्तेमाल होगा। Quota खत्म होने पर बाद में कोशिश करें—कोई paid fallback नहीं।","Uses only the configured Gemini API free tier. If quota is exhausted, try later—no paid fallback.")}</p>
          </form>
          {paperAnalysis && <div className="paper-results">
            <div className="paper-result-heading">
              <div><div className="eyebrow"><span className="eyebrow-line"/> PAPER REPORT</div><h2>{paperAnalysis.paper_title || t("पेपर रिपोर्ट","Paper report")}</h2><p>{paperAnalysis.exam_type || t("परीक्षा पहचान नहीं मिली","Exam not identified")} · {paperAnalysis.detected_language || "Unknown"}</p></div>
              <div className="paper-question-count"><b>{paperAnalysis.mcqs?.length || 0}</b><span>{t("नए MCQ","New MCQs")}</span></div>
            </div>
            <div className="paper-report-stats">
              <div><span>{t("अनुमानित प्रश्न","Estimated questions")}</span><b>{paperAnalysis.estimated_question_count || "—"}</b></div>
              <div><span>{t("सेक्शन","Sections")}</span><b>{paperAnalysis.sections?.length || 0}</b></div>
              <div><span>{t("प्रैक्टिस सवाल","Practice items")}</span><b>{paperAnalysis.mcqs?.length || 0}</b></div>
            </div>
            {Array.isArray(paperAnalysis.sections) && paperAnalysis.sections.length > 0 && <div className="paper-report-card"><h3>{t("विषय और अनुमानित कवरेज","Topics and estimated coverage")}</h3>{paperAnalysis.sections.map((section, index) => <div className="paper-section-row" key={section.name + index}><b>{section.name}</b><span>{(section.topic_counts || []).map((topic) => topic.topic + " (" + topic.count + ", " + topic.confidence + ")").join(" · ") || t("कोई साफ़ विषय नहीं मिला","No clear topics detected")}</span></div>)}</div>}
            {Array.isArray(paperAnalysis.strengths) && paperAnalysis.strengths.length > 0 && <div className="paper-report-card"><h3>{t("मुख्य निष्कर्ष","Key observations")}</h3><ul>{paperAnalysis.strengths.map((item, index) => <li key={index}>{item}</li>)}</ul></div>}
            {Array.isArray(paperAnalysis.limitations) && paperAnalysis.limitations.length > 0 && <div className="paper-report-card paper-report-caveat"><h3>{t("सावधानियाँ","Caveats")}</h3><ul>{paperAnalysis.limitations.map((item, index) => <li key={index}>{item}</li>)}</ul></div>}
            <div className="paper-generated-questions">
              <div className="paper-generated-title"><Sparkles size={19}/><div><h2>{t("नए अभ्यास MCQ","New practice MCQs")}</h2><p>{t("पहले अपने उत्तर चुनें, फिर सबमिट करके स्कोर और व्याख्या देखें।","Choose your answers first, then submit to see your score and explanations.")}</p></div></div>
              <div className="paper-quiz-toolbar">
                <div className="paper-quiz-progress"><b>{t("आपका अभ्यास","Your practice")}</b><span>{paperQuizScore.answered} / {paperQuizScore.total} {t("उत्तर चुने","answered")}</span></div>
                <div className="paper-quiz-actions">
                  <button type="button" className="secondary-button" onClick={() => { setPaperQuizAnswers({}); setPaperQuizSubmitted(false); }} disabled={Object.keys(paperQuizAnswers).length === 0 && !paperQuizSubmitted}><RotateCcw size={15}/>{t("रीसेट","Reset")}</button>
                  <button type="button" className="primary-button" onClick={() => setPaperQuizSubmitted(true)} disabled={paperQuizSubmitted || Object.keys(paperQuizAnswers).length === 0}><CheckCircle2 size={16}/>{t("उत्तर जमा करें","Submit answers")}</button>
                </div>
              </div>
              {paperQuizSubmitted && <div className="paper-quiz-score" aria-live="polite">
                <div><span>{t("आपका स्कोर","Your score")}</span><b>{paperQuizScore.correct} / {paperQuizScore.total} · {paperQuizScore.percentage}%</b></div>
                <p>{t("सही उत्तर","Correct")}: {paperQuizScore.correct} · {t("गलत","Incorrect")}: {paperQuizScore.incorrect} · {t("छूटे","Unanswered")}: {paperQuizScore.unanswered}</p>
                <span>{t("इन सवालों को अभ्यास सामग्री के रूप में बनाया गया है; इन्हें आधिकारिक PYQ नहीं माना गया है।","These questions are practice material and are not verified official PYQs.")}</span>
              </div>}
              {(paperAnalysis.mcqs || []).map((question, index) => {
                const options = hi ? question.options_hi : question.options_en;
                const selectedAnswer = paperQuizAnswers[index];
                return <article className="paper-question-card" key={index}>
                  <div className="paper-question-meta"><span>Q{index + 1}</span><span>{question.topic}</span><span>{question.difficulty}</span></div>
                  <h3>{hi ? question.question_hi : question.question_en}</h3>
                  <ol>{options.map((option, optionIndex) => {
                    const selected = selectedAnswer === optionIndex;
                    const correct = optionIndex === question.answer_index;
                    const optionClass = "paper-option-button" +
                      (selected ? " is-selected" : "") +
                      (paperQuizSubmitted && correct ? " is-correct" : "") +
                      (paperQuizSubmitted && selected && !correct ? " is-wrong" : "");
                    return <li key={optionIndex}><button type="button" className={optionClass} aria-pressed={selected} disabled={paperQuizSubmitted} onClick={() => setPaperQuizAnswers((previous) => ({ ...previous, [index]: optionIndex }))}><span className="paper-option-letter">{String.fromCharCode(65 + optionIndex)}.</span><span className="paper-option-text">{option}</span>{paperQuizSubmitted && correct && <CheckCircle2 size={16}/>}{paperQuizSubmitted && selected && !correct && <X size={16}/>}</button></li>;
                  })}</ol>
                  {paperQuizSubmitted && <div className="paper-answer-explanation"><b>{t("सही उत्तर","Correct answer")}: {options[question.answer_index]}</b><p>{hi ? question.explanation_hi : question.explanation_en}</p></div>}
                </article>;
              })}
              {paperQuizSubmitted && <button type="button" className="secondary-button" onClick={() => { setPaperQuizAnswers({}); setPaperQuizSubmitted(false); }}><RotateCcw size={16}/>{t("फिर से अभ्यास करें","Practice again")}</button>}
            </div>
            <p className="paper-privacy-note"><Info size={18}/><span>{t("यह रिपोर्ट इस पेज की मेमोरी में है; refresh करने पर हट जाएगी। सवालों को प्रश्न-बैंक में अपने-आप प्रकाशित नहीं किया गया है।","This report only lives in this page's memory and clears on refresh. Questions have not been automatically published to the question bank.")}</span></p>
            <button type="button" className="secondary-button" onClick={() => { setPaperAnalysis(null); setPaperAnalysisError(""); setPaperFile(null); if (paperFileInputRef.current) paperFileInputRef.current.value = ""; }}>{t("नया पेपर विश्लेषित करें","Analyze another paper")}<RotateCcw size={16}/></button>
          </div>}
        </div>}

        {view === "sources" && <div className="content sources-content">
          <div className="eyebrow"><span className="eyebrow-line"/> SOURCE LIBRARY</div>
          <h1>{t("Source PDFs","Source PDFs")}</h1>
          <p className="intro">{t("हर परीक्षा के मूल/स्रोत question-paper pages यहाँ मिलेंगे। PDF खोलकर सीधे डाउनलोड कर सकते हैं।","Open the original source-paper page for each exam and download the PDF directly.")}</p>
          <div className="feature-grid">
            <article className="feature-card featured"><div className="feature-top"><div className="feature-icon"><Download size={22}/></div><span className="tag">OFFICIAL</span></div><h3>MPESB Source Papers</h3><p>{t("MPESB की official question paper और candidate-response library.","Official MPESB question-paper and candidate-response library.")}</p><a className="primary-button" href="https://esb.mp.gov.in/Question%20Paper%20and%20Candidate%20Responses/Question_Objection.asp" target="_blank" rel="noreferrer">{t("PDF Library खोलें","Open PDF Library")}<Download size={17}/></a></article>
            <article className="feature-card"><div className="feature-top"><div className="feature-icon green-icon"><Download size={22}/></div><span className="tag tag-green">RPF</span></div><h3>RPF Constable 2025</h3><p>{t("23 shift-wise question-paper PDFs.","23 shift-wise question-paper PDFs.")}</p><a className="secondary-button" href="https://docs.aglasem.com/org/railway/rpf-constable/question-paper" target="_blank" rel="noreferrer">{t("Papers देखें","View papers")}<Download size={16}/></a></article>
            <article className="feature-card"><div className="feature-top"><div className="feature-icon blue-icon"><Download size={22}/></div><span className="tag tag-blue">RRB</span></div><h3>RRB ALP / Railway</h3><p>{t("RRB ALP और Railway previous-paper libraries.","RRB ALP and Railway previous-paper libraries.")}</p><a className="secondary-button" href="https://testbook.com/rrb-alp/previous-year-papers" target="_blank" rel="noreferrer">{t("ALP papers देखें","View ALP papers")}<Download size={16}/></a></article>
<article className="feature-card"><div className="feature-top"><div className="feature-icon"><Download size={22}/></div><span className="tag">OFFICIAL PDF</span></div><h3>RRB ALP CBT-1 2026</h3><p>{t("Official RRB question/response notice PDF source — original source पर ही खुलेगा।","Official RRB question/response notice PDF source — opens at the original source.")}</p><a className="primary-button" href="https://www.rrbcdg.gov.in/uploads/2025/01-ALP/012025ALP-CBT1_ObjectionTracker.pdf" target="_blank" rel="noreferrer">{t("Official PDF खोलें","Open official PDF")}<Download size={17}/></a></article>
          </div>
          <div className="job-section">
            <div className="section-heading"><div><h2>{t("बाकी source libraries","More source libraries")}</h2><p>{t("इन pages से original PDF डाउनलोड करें; ExamPrep केवल source index रखता है।","Use these source pages to download the original PDFs; ExamPrep keeps the source index.")}</p></div><span className="section-count">SOURCE INDEX</span></div>
            <div className="job-grid">
              <a className="job-card source-index-card" href="https://career.aglasem.com/index.php/railway/rrb-group-d/previous-papers/2025" target="_blank" rel="noreferrer"><div className="job-copy"><b>RRB Group D 2025</b><span>Shift-wise previous-year PDFs</span></div><em>PDF ↗</em></a>
              <a className="job-card source-index-card" href="https://career.aglasem.com/index.php/railway/rrb-ntpc/previous-papers/2025" target="_blank" rel="noreferrer"><div className="job-copy"><b>RRB NTPC 2025</b><span>Graduate + Undergraduate papers</span></div><em>PDF ↗</em></a>
              <a className="job-card source-index-card" href="https://career.aglasem.com/ssc/ssc-gd/previous-papers/" target="_blank" rel="noreferrer"><div className="job-copy"><b>SSC GD</b><span>Previous-year / shift-wise papers</span></div><em>PDF ↗</em></a>
              <a className="job-card source-index-card" href="https://esb.mp.gov.in/Old_Question_Papers/old_question_papers.htm" target="_blank" rel="noreferrer"><div className="job-copy"><b>MPESB Old Papers</b><span>Official archive</span></div><em>PDF ↗</em></a>
            </div>
          </div>
          <div className="bottom-note"><div className="note-icon"><ShieldCheck size={18}/></div><div><b>{t("Source integrity","Source integrity")}</b><p>{t("Third-party copyrighted PDFs को हम अपनी site पर copy/re-host नहीं करते; original source/download page पर भेजते हैं।","We link to third-party original/download pages instead of copying or re-hosting copyrighted PDFs.")}</p></div></div>
        </div>}

        {view === "history" && <div className="content">{storageMessage && <div className="bottom-note"><div className="note-icon"><Info size={18}/></div><div><b>{t("डेटा सेव स्थिति","Storage status")}</b><p>{storageMessage}</p></div></div>}<div className="eyebrow"><span className="eyebrow-line"/> YOUR JOURNEY</div><h1>{t("आपके रिज़ल्ट","Your results")}</h1><p className="intro">{t("आपके हाल के मॉक टेस्ट और प्रगति यहाँ दिखाई देंगे।","Your recent mock test attempts and progress appear here.")}</p>{history.length ? <div className="history-list">{history.map((h,i)=><div className="history-item" key={i}><div className="history-icon"><Award size={21}/></div><div className="history-main"><b>{h.test_name || t("क्विक मॉक टेस्ट","Quick mock test")}</b><span>{t("प्रयास","Attempt")} {history.length-i} · {h.accuracy}% {t("सटीकता","accuracy")}</span></div><strong>{h.score}/{Number(h.total_questions || 10) * Number(h.marks_per_question || 1)}</strong><span className="history-grade">{(Number(h.score || 0) / Math.max(1, Number(h.total_questions || 10) * Number(h.marks_per_question || 1))) >= 0.8?t("बहुत अच्छा","Great"):(Number(h.score || 0) / Math.max(1, Number(h.total_questions || 10) * Number(h.marks_per_question || 1))) >= 0.5?t("अच्छा प्रयास","Good effort"):t("अभ्यास जारी रखें","Keep practicing")}</span></div>)}</div> : <div className="empty-state"><div className="empty-icon"><BookOpen size={28}/></div><h2>{t("आपका पहला टेस्ट इंतज़ार कर रहा है","Your first test is waiting")}</h2><p>{t("टेस्ट पूरा करने के बाद आपका स्कोर और विश्लेषण यहाँ दिखाई देगा।","Complete a mock test to see your score and analysis here.")}</p><button className="primary-button" disabled={!availableQuestionCount} onClick={startTest}>{t("पहला टेस्ट शुरू करें","Start your first test")}<ArrowRight size={17}/></button></div>}</div>}

        {view === "settings" && <div className="content settings-content">
          <div className="settings-hero"><div><div className="eyebrow"><span className="eyebrow-line"/> {t("आपका कंट्रोल सेंटर","YOUR CONTROL CENTER")}</div><h1>{t("प्रोफाइल और सेटिंग्स","Profile & Settings")}</h1><p className="intro">{t("अपने प्रोफाइल, भाषा, थीम और trusted-device controls एक ही जगह से संभालें।","Manage your profile, language, theme and trusted-device controls from one place.")}</p></div><div className="settings-orb"><Settings size={34}/><span>{user ? "SYNCED" : "GUEST"}</span></div></div>
          <div className="settings-layout">
            <div className="settings-profile-card"><div className="settings-avatar">{(getUserDisplayName(user).charAt(0) || "अ").toUpperCase()}</div><div className="settings-profile-copy"><span>{t("अभ्यर्थी प्रोफाइल","CANDIDATE PROFILE")}</span><h2>{getUserDisplayName(user)}</h2><p>{user?.email || user?.phone || t("Guest practice mode","Guest practice mode")}</p></div><div className={"settings-status " + (user ? "online" : "")}><i/>{user ? t("Cloud synced","Cloud synced") : t("Local only","Local only")}</div></div>
            <div className="settings-card"><div className="settings-card-head"><div><span className="settings-kicker">PROFILE</span><h3>{t("नाम और अकाउंट","Name & account")}</h3></div><div className="settings-card-icon"><Award size={18}/></div></div>{user ? <div className="settings-form-row"><input value={profileName} onChange={e=>setProfileName(e.target.value.slice(0,60))} placeholder={t("आपका नाम","Your name")} autoComplete="name"/><button className="primary-button" onClick={saveProfileName}>{t("सेव करें","Save changes")}<Check size={16}/></button></div> : <div className="settings-note"><Info size={17}/><span>{t("Guest mode में प्रोफाइल local है। Cloud history के लिए Dashboard से optional mobile login करें।","In Guest mode your profile is local. Use optional mobile login from Dashboard for cloud history.")}</span></div>}</div>
            <div className="settings-card"><div className="settings-card-head"><div><span className="settings-kicker">APPEARANCE</span><h3>{t("दिखावट और भाषा","Appearance & language")}</h3></div><div className="settings-card-icon"><Languages size={18}/></div></div><div className="settings-option-grid"><button className={themeMode==="light" ? "setting-choice active" : "setting-choice"} onClick={()=>setThemeMode("light")}><span>☀️</span><b>Day</b><small>Light glass UI</small></button><button className={themeMode==="dark" ? "setting-choice active" : "setting-choice"} onClick={()=>setThemeMode("dark")}><span>🌙</span><b>Night</b><small>Dark glass UI</small></button><button className={themeMode==="system" ? "setting-choice active" : "setting-choice"} onClick={()=>setThemeMode("system")}><span>◐</span><b>System</b><small>Follow device</small></button></div><div className="settings-divider"/><div className="settings-inline-row"><div><b>{t("भाषा","Language")}</b><span>{t("सवाल और labels की भाषा बदलें","Switch question and label language")}</span></div><button className="secondary-button" onClick={()=>setLanguage(hi ? "en" : "hi")}><Languages size={16}/>{hi ? "English" : "हिंदी"}</button></div></div>
            <div className="settings-card security-card"><div className="settings-card-head"><div><span className="settings-kicker">SECURITY</span><h3>{t("Trusted device","Trusted device")}</h3></div><div className="settings-card-icon"><ShieldCheck size={18}/></div></div><div className="settings-security-row"><div className={"security-indicator " + (trustedDeviceVerified ? "verified" : "")}><ShieldCheck size={18}/></div><div><b>{trustedDeviceVerified ? t("यह device trusted है","This device is trusted") : t("Guest / current device","Guest / current device")}</b><span>{t("Recovery code केवल trusted device से बनाया जा सकता है।","A recovery code can only be created from a trusted device.")}</span></div><button className="secondary-button" onClick={()=>navigateTo("boards")}>{t("परीक्षा खोलें","Open exams")}<ArrowRight size={15}/></button></div></div>
            <div className="settings-card danger-card"><div className="settings-card-head"><div><span className="settings-kicker">SESSION</span><h3>{t("सेशन","Session")}</h3></div><div className="settings-card-icon"><RotateCcw size={18}/></div></div><div className="settings-inline-row"><div><b>{user ? t("अकाउंट से लॉगआउट","Sign out of account") : t("Guest practice mode","Guest practice mode")}</b><span>{user ? t("Cloud sync बंद हो जाएगा, local results इस device पर रहेंगे।","Cloud sync will stop; local results stay on this device.") : t("आप बिना login के mock tests दे सकते हैं।","You can take mock tests without logging in.")}</span></div>{user && <button className="secondary-button danger-button" onClick={logout}>{t("लॉगआउट","Sign out")}<X size={16}/></button>}</div></div>
          </div>
        </div>}

        {view === "about" && <div className="content about-content">
          <div className="about-hero"><div className="about-logo"><GraduationCap size={38}/></div><div><div className="eyebrow"><span className="eyebrow-line"/> EXAMPREP</div><h1>{t("आपकी अगली रैंक यहीं से शुरू होती है।","Your next rank starts here.")}</h1><p className="intro">{t("ExamPrep एक focused mock-test workspace है — exam चुनें, topic पर practice करें, test दें और हर attempt से अपनी तैयारी बेहतर करें।","ExamPrep is a focused mock-test workspace — choose an exam, practice by topic, take a test and improve with every attempt.")}</p></div></div>
          <div className="about-grid"><article className="about-card featured-about"><div className="about-card-icon"><Target size={22}/></div><span>01</span><h3>Focused Practice</h3><p>{t("पूरे exam के साथ subject और chapter level practice भी उपलब्ध है, ताकि weak areas पर सीधे काम कर सकें।","Practice the full exam or drill down to subjects and chapters to work directly on weak areas.")}</p></article><article className="about-card"><div className="about-card-icon"><CheckCircle2 size={22}/></div><span>02</span><h3>Instant Analysis</h3><p>{t("हर attempt के बाद score, accuracy, subject performance और answer review एक ही screen पर मिलता है।","After every attempt, see score, accuracy, subject performance and answer review in one place.")}</p></article><article className="about-card"><div className="about-card-icon"><Languages size={22}/></div><span>03</span><h3>Hindi + English</h3><p>{t("भाषा कभी भी बदलें और bilingual questions के साथ अपनी सुविधा के अनुसार अभ्यास करें।","Switch languages anytime and practice with bilingual questions.")}</p></article><article className="about-card"><div className="about-card-icon"><ShieldCheck size={22}/></div><span>04</span><h3>Privacy-first practice</h3><p>{t("Guest practice local device पर चल सकता है; cloud history के लिए optional account sync उपलब्ध है।","Guest practice can stay on-device; optional account sync is available for cloud history.")}</p></article></div>
          <div className="about-note"><div className="note-icon"><Info size={18}/></div><div><b>{t("महत्वपूर्ण","Important")}</b><p>{t("ExamPrep अभ्यास के लिए बनाया गया platform है। आधिकारिक परीक्षा dates, syllabus और notices के लिए संबंधित official board की latest information देखें।","ExamPrep is a practice platform. For official exam dates, syllabi and notices, always check the latest information from the relevant official board.")}</p></div></div>
          <div className="about-actions"><button className="secondary-button" onClick={()=>navigateTo("sources")}><Download size={16}/>Source PDFs</button><button className="primary-button" onClick={()=>navigateTo("boards")}><GraduationCap size={16}/>{t("परीक्षाएँ","Exams")}</button></div>
        </div>}

        <footer className="footer"><span>© 2026 ExamPrep</span><span>{t("अभ्यास • प्रगति • सफलता","PRACTICE · PROGRESS · SUCCESS")}</span><span>{t("आपकी तैयारी जारी है","Keep showing up ✦")}</span></footer>
      </section>
    </main>
  );
}