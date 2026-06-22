// Number word → digit maps per language.
// Sorted longest-first on use to prevent partial-word replacement bugs.
// Focus on amounts commonly spoken AND confusable pairs that Whisper mismaps.

const MAPS = {
  hi: {
    // The classic "una" confusables (one-less-than patterns)
    'उनसठ': '59', 'उनहत्तर': '69', 'उनासी': '79', 'उनानवे': '99',
    // Compound hundreds/thousands (longest first)
    'पाँच हज़ार': '5000', 'पाँच हजार': '5000',
    'दो हज़ार': '2000',  'दो हजार': '2000',
    'पाँच सौ': '500',    'पांच सौ': '500',
    'चार सौ': '400', 'तीन सौ': '300', 'दो सौ': '200',
    // Singles
    'हज़ार': '1000', 'हजार': '1000', 'सौ': '100',
    'नब्बे': '90', 'अस्सी': '80', 'सत्तर': '70', 'साठ': '60',
    'पचास': '50', 'चालीस': '40', 'तीस': '30', 'बीस': '20',
    'उन्नीस': '19', 'अठारह': '18', 'सत्रह': '17', 'सोलह': '16',
    'पंद्रह': '15', 'चौदह': '14', 'तेरह': '13', 'बारह': '12', 'ग्यारह': '11',
    'दस': '10', 'नौ': '9', 'आठ': '8', 'सात': '7', 'छह': '6',
    'पाँच': '5', 'पांच': '5', 'चार': '4', 'तीन': '3', 'दो': '2', 'एक': '1',
  },
  mr: {
    // Marathi number words (same Devanagari script, slightly different words)
    'एकोणसाठ': '59', 'एकोणसत्तर': '69', 'एकोण्णऐंशी': '79', 'एकोण्णशंभर': '99',
    'पाच हजार': '5000', 'दोन हजार': '2000',
    'पाचशे': '500', 'चारशे': '400', 'तीनशे': '300', 'दोनशे': '200',
    'हजार': '1000', 'शंभर': '100',
    'नव्वद': '90', 'ऐंशी': '80', 'सत्तर': '70', 'साठ': '60',
    'पन्नास': '50', 'चाळीस': '40', 'तीस': '30', 'वीस': '20',
    'दहा': '10', 'नऊ': '9', 'आठ': '8', 'सात': '7', 'सहा': '6',
    'पाच': '5', 'चार': '4', 'तीन': '3', 'दोन': '2', 'एक': '1',
  },
  // For other languages, Whisper is generally accurate with digit sequences.
  // Add maps here as edge cases surface in production.
};

/**
 * Replace spoken number words with digit strings.
 * Applied after Whisper transcription, before Gemma intent parsing.
 * Sorts entries longest-first to avoid partial replacements.
 */
function replaceNumberWords(text, lang) {
  const map = MAPS[lang];
  if (!map) return text;
  const entries = Object.entries(map).sort((a, b) => b[0].length - a[0].length);
  let result = text;
  for (const [word, digit] of entries) {
    result = result.replace(new RegExp(word, 'g'), digit);
  }
  return result;
}

module.exports = { replaceNumberWords };
