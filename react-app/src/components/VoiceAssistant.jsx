import React, { useEffect, useRef, useState } from 'react';
import { Bot, MessageCircle, Mic, MicOff, Send, Volume2, X } from 'lucide-react';

const voiceLanguages = { en: 'en-IN', te: 'te-IN', hi: 'hi-IN' };

const answerKeys = [
  {
    key: 'assistantAnswerOwnTransport',
    terms: ['own vehicle', 'self pickup', 'self-pickup', 'my vehicle', 'bring my own', 'నా వాహనం', 'స్వంత వాహనం', 'నేనే వస్తా', 'నా వాహనంతో', 'రవాణా వద్దు', 'खुद का वाहन', 'अपना वाहन', 'खुद लेने', 'परिवहन नहीं']
  },
  {
    key: 'assistantAnswerTransport',
    terms: ['transport', 'delivery', 'vehicle', 'bullock cart', 'tractor', 'lorry', 'రవాణా', 'డెలివరీ', 'వాహనం', 'ఎడ్ల బండి', 'ట్రాక్టర్', 'లారీ', 'परिवहन', 'डिलीवरी', 'गाड़ी', 'बैलगाड़ी', 'ट्रैक्टर', 'लॉरी']
  },
  {
    key: 'assistantAnswerPayment',
    terms: ['advance', 'payment', 'pay', '₹', 'అడ్వాన్స్', 'చెల్లింపు', 'చెల్లించ', 'డబ్బు', 'పేమెంట్', 'अग्रिम', 'भुगतान', 'पैसे', 'पेमेंट']
  },
  {
    key: 'assistantAnswerOrder',
    terms: ['order', 'buy', 'purchase', 'how to book', 'ఎలా కొన', 'ఆర్డర్', 'కొనాలి', 'బుక్', 'ऑर्डर', 'खरीद', 'बुक']
  },
  {
    key: 'assistantAnswerPrice',
    terms: ['price', 'cost', 'rate', 'ధర', 'రేటు', 'ఎంత', 'ఖరీదు', 'कीमत', 'दाम', 'दर', 'कितना']
  },
  {
    key: 'assistantAnswerStock',
    terms: ['stock', 'available', 'brick types', 'varieties', 'ఇటుక', 'రకాలు', 'నిల్వ', 'అందుబాటు', 'ईंट', 'स्टॉक', 'उपलब्ध', 'किस्म']
  },
  {
    key: 'assistantAnswerQuality',
    terms: ['quality', 'strong', 'grade', 'నాణ్యత', 'బలం', 'క్వాలిటీ', 'गुणवत्ता', 'मजबूत', 'ग्रेड']
  },
  {
    key: 'assistantAnswerEnquiry',
    terms: ['contact', 'supplier', 'owner', 'enquiry', 'enquire', 'సంప్రదించ', 'యజమాని', 'విచారణ', 'సప్లయర్', 'संपर्क', 'मालिक', 'पूछताछ', 'सप्लायर']
  }
];

function findAnswer(question, t) {
  const normalizedQuestion = question.toLocaleLowerCase();
  const match = answerKeys.find(({ terms }) =>
    terms.some((term) => normalizedQuestion.includes(term.toLocaleLowerCase()))
  );
  return match ? t[match.key] : t.assistantAnswerFallback;
}

export default function VoiceAssistant({ t, lang }) {
  const [isOpen, setIsOpen] = useState(false);
  const [question, setQuestion] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [voiceError, setVoiceError] = useState('');
  const [messages, setMessages] = useState([]);
  const recognitionRef = useRef(null);
  const nextMessageId = useRef(0);
  const speechRecognitionSupported = typeof window !== 'undefined'
    && Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
  const speechSynthesisSupported = typeof window !== 'undefined' && Boolean(window.speechSynthesis);

  useEffect(() => () => {
    recognitionRef.current?.stop();
    window.speechSynthesis?.cancel();
  }, []);

  const speak = (text) => {
    if (!speechSynthesisSupported) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = voiceLanguages[lang] || voiceLanguages.en;
    window.speechSynthesis.speak(utterance);
  };

  const submitQuestion = (rawQuestion) => {
    const customerQuestion = rawQuestion.trim();
    if (!customerQuestion) return;

    const answer = findAnswer(customerQuestion, t);
    setMessages((currentMessages) => [
      ...currentMessages,
      { id: nextMessageId.current++, isAssistant: false, text: customerQuestion },
      { id: nextMessageId.current++, isAssistant: true, text: answer }
    ]);
    setQuestion('');
    setVoiceError('');
    speak(answer);
  };

  const startListening = () => {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) {
      setVoiceError(t.assistantVoiceUnavailable);
      return;
    }

    recognitionRef.current?.stop();
    setVoiceError('');
    const recognition = new Recognition();
    recognition.lang = voiceLanguages[lang] || voiceLanguages.en;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onstart = () => setIsListening(true);
    recognition.onresult = (event) => {
      const transcript = event.results?.[0]?.[0]?.transcript?.trim();
      if (transcript) {
        setQuestion(transcript);
        submitQuestion(transcript);
      } else {
        setVoiceError(t.assistantVoiceError);
      }
    };
    recognition.onerror = () => {
      setVoiceError(t.assistantVoiceError);
    };
    recognition.onend = () => {
      setIsListening(false);
      recognitionRef.current = null;
    };
    recognitionRef.current = recognition;

    try {
      recognition.start();
    } catch {
      setIsListening(false);
      recognitionRef.current = null;
      setVoiceError(t.assistantVoiceError);
    }
  };

  const closeAssistant = () => {
    recognitionRef.current?.stop();
    setIsOpen(false);
  };

  return (
    <div className="voice-assistant">
      {isOpen && (
        <section className="voice-assistant-panel" role="dialog" aria-label={t.assistantTitle}>
          <header className="voice-assistant-header">
            <div className="voice-assistant-heading">
              <span className="voice-assistant-avatar"><Bot size={20} /></span>
              <div>
                <h2>{t.assistantTitle}</h2>
                <p>{t.assistantIntro}</p>
              </div>
            </div>
            <button type="button" className="voice-assistant-close" onClick={closeAssistant} aria-label={t.assistantClose}>
              <X size={19} />
            </button>
          </header>

          <div className="voice-assistant-messages" aria-live="polite">
            <div className="voice-assistant-message assistant">
              <p>{t.assistantWelcome}</p>
              {speechSynthesisSupported && (
                <button type="button" className="voice-assistant-speak" onClick={() => speak(t.assistantWelcome)} aria-label={t.assistantPlayAnswer}>
                  <Volume2 size={15} />
                </button>
              )}
            </div>
            {messages.map((message) => (
              <div key={message.id} className={`voice-assistant-message ${message.isAssistant ? 'assistant' : 'customer'}`}>
                <p>{message.text}</p>
                {message.isAssistant && speechSynthesisSupported && (
                  <button type="button" className="voice-assistant-speak" onClick={() => speak(message.text)} aria-label={t.assistantPlayAnswer}>
                    <Volume2 size={15} />
                  </button>
                )}
              </div>
            ))}
          </div>

          {messages.length === 0 && (
            <div className="voice-assistant-suggestions">
              {[t.assistantQuestionOrder, t.assistantQuestionPrice, t.assistantQuestionTransport, t.assistantQuestionOwnVehicle].map((suggestion) => (
                <button key={suggestion} type="button" onClick={() => submitQuestion(suggestion)}>{suggestion}</button>
              ))}
            </div>
          )}

          <form
            className="voice-assistant-form"
            onSubmit={(event) => {
              event.preventDefault();
              submitQuestion(question);
            }}
          >
            <button
              type="button"
              className={`voice-assistant-mic${isListening ? ' listening' : ''}`}
              onClick={isListening ? () => recognitionRef.current?.stop() : startListening}
              aria-label={isListening ? t.assistantStopListening : t.assistantListen}
              title={isListening ? t.assistantStopListening : t.assistantListen}
            >
              {isListening ? <MicOff size={19} /> : <Mic size={19} />}
            </button>
            <input
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder={t.assistantInput}
              aria-label={t.assistantInput}
              maxLength={500}
            />
            <button type="submit" className="voice-assistant-send" aria-label={t.assistantSend} disabled={!question.trim()}>
              <Send size={18} />
            </button>
          </form>
          <p className="voice-assistant-note">
            {voiceError || (!speechRecognitionSupported ? t.assistantVoiceUnavailable : t.assistantPrivacyNote)}
          </p>
        </section>
      )}

      <button
        type="button"
        className="voice-assistant-launcher"
        onClick={() => setIsOpen((open) => !open)}
        aria-expanded={isOpen}
        aria-label={isOpen ? t.assistantClose : t.assistantOpen}
      >
        {isOpen ? <X size={20} /> : <MessageCircle size={20} />}
        <span>{isOpen ? t.assistantClose : t.assistantOpen}</span>
      </button>
    </div>
  );
}
