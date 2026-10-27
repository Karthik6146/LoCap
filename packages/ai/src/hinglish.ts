import Sanscript from '@indic-transliteration/sanscript';
import type { Transcript } from '@clipx/types';

const common: Record<string, string> = {
  'काफी': 'kaafi', 'काफ़ी': 'kaafi', 'वापस': 'wapas', 'अपने': 'apne', 'अपना': 'apna',
  'अपनी': 'apni', 'बात': 'baat', 'बातें': 'baatein', 'काम': 'kaam', 'कम': 'kam',
  'करता': 'karta', 'करती': 'karti', 'करेंगे': 'karenge', 'करो': 'karo', 'किया': 'kiya',
  'रहा': 'raha', 'रही': 'rahi', 'रहे': 'rahe', 'रहता': 'rehta', 'रहते': 'rehte',
  'था': 'tha', 'थी': 'thi', 'थे': 'the', 'होगा': 'hoga', 'होता': 'hota', 'होती': 'hoti',
  'पहले': 'pehle', 'बाद': 'baad', 'साथ': 'saath', 'यहाँ': 'yahan', 'यहां': 'yahan',
  'कहाँ': 'kahan', 'कहां': 'kahan', 'क्योंकि': 'kyunki', 'इसलिए': 'isliye',
  'चाहिए': 'chahiye', 'चाहते': 'chahte', 'सकते': 'sakte', 'सकता': 'sakta',
  'समझ': 'samajh', 'समझना': 'samajhna', 'देखते': 'dekhte', 'देखना': 'dekhna',
  'बताओ': 'batao', 'बताना': 'batana', 'बोलते': 'bolte', 'बोलना': 'bolna',
  'कुछ': 'kuch', 'तुम्हारा': 'tumhara', 'मेरा': 'mera', 'मेरी': 'meri', 'मेरे': 'mere',
  'थोड़ा': 'thoda', 'ज्यादा': 'zyada', 'ज़्यादा': 'zyada',
  'टाइम': 'time', 'वॉइस': 'voice', 'ऑडियो': 'audio', 'कंटेंट': 'content',
  'एडिट': 'edit', 'एडिटिंग': 'editing', 'अपलोड': 'upload', 'डाउनलोड': 'download',
  'इंग्लिश': 'English', 'हिंग्लिश': 'Hinglish', 'टेम्पलेट': 'template',
  'मैं': 'main', 'में': 'mein', 'हूँ': 'hoon', 'हूं': 'hoon', 'हैं': 'hain', 'है': 'hai',
  'नहीं': 'nahi', 'यह': 'yeh', 'वह': 'woh', 'और': 'aur', 'एक': 'ek', 'बहुत': 'bahut',
  'क्या': 'kya', 'क्यों': 'kyun', 'कैसे': 'kaise', 'हिंदी': 'Hindi', 'अंग्रेजी': 'English',
  'आज': 'aaj', 'हम': 'hum', 'तुम': 'tum', 'आप': 'aap', 'कर': 'kar', 'करना': 'karna',
  'करते': 'karte', 'करने': 'karne', 'मतलब': 'matlab', 'लेकिन': 'lekin', 'अच्छा': 'achha',
  'अब': 'ab', 'सब': 'sab', 'इस': 'is', 'उस': 'us', 'बस': 'bas', 'पर': 'par', 'फिर': 'phir',
  'मुझे': 'mujhe', 'हमें': 'humein', 'तुम्हें': 'tumhein', 'ये': 'ye', 'वो': 'wo',
  'वीडियो': 'video', 'गेम': 'game', 'लाइक': 'like', 'चैनल': 'channel', 'सब्सक्राइब': 'subscribe',
  'कैप्शन': 'caption', 'कैप्शन्स': 'captions', 'शॉट': 'shot', 'प्लेयर': 'player',
};

/** Readable Roman Hindi; preserves Latin words and timed token boundaries. */
export function romanizeHindi(text: string): string {
  return text.normalize('NFC').replace(/[०-९]/g, digit => String(digit.charCodeAt(0) - 0x0966)).replace(/[।॥]/g, '.').replace(/[\u0900-\u097f]+/g, token => {
    if (common[token]) return common[token]!;
    const latin = Sanscript.t(token, 'devanagari', 'iast')
      .replace(/ā/g, 'aa').replace(/ī/g, 'ee').replace(/ū/g, 'oo')
      .replace(/[śṣ]/g, 'sh').replace(/ṛ/g, 'ri').replace(/[ṃṁṅñ]/g, 'n')
      .replace(/c/g, 'ch').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return /[क-हक़-य़]$/.test(token) && latin.length > 2 ? latin.replace(/a$/, '') : latin;
  });
}
export function toHinglish(transcript: Transcript): Transcript {
  return { ...transcript, script: 'hi-latn', words: transcript.words.map(w => ({ ...w, text: romanizeHindi(w.text) })),
    sentences: transcript.sentences.map(s => ({ ...s, text: romanizeHindi(s.text) })) };
}
