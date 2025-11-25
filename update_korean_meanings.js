const https = require('https');
const querystring = require('querystring');
const db = require('./db');

const API_KEY = '713DF01BD2938F594845A50E47FB1315';
const API_URL = 'https://krdict.korean.go.kr/api/search';

// Search Korean Dictionary API for a word
function searchKoreanDict(searchTerm) {
  return new Promise((resolve, reject) => {
    const params = {
      key: API_KEY,
      q: searchTerm,
      translated: 'y',
      trans_lang: '1' // English translation
    };

    const queryString = querystring.stringify(params);
    const url = `${API_URL}?${queryString}`;

    https.get(url, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        if (res.statusCode === 200) {
          resolve(parseXMLResponse(data));
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
}

function parseXMLResponse(xml) {
  // Check for errors
  if (xml.includes('<error>')) {
    const errorCodeMatch = xml.match(/<error_code>([^<]+)<\/error_code>/);
    const errorMsgMatch = xml.match(/<message>([^<]+)<\/message>/);
    const errorCode = errorCodeMatch ? errorCodeMatch[1] : 'Unknown';
    const errorMsg = errorMsgMatch ? errorMsgMatch[1] : 'Unknown error';
    throw new Error(`API Error ${errorCode}: ${errorMsg}`);
  }

  // Extract items
  const items = xml.match(/<item>[\s\S]*?<\/item>/g);

  if (!items || items.length === 0) {
    return null;
  }

  const results = [];

  items.forEach((item) => {
    // Extract target_code
    const targetCodeMatch = item.match(/<target_code>(\d+)<\/target_code>/);
    const targetCode = targetCodeMatch ? targetCodeMatch[1] : null;

    // Extract word
    const wordMatch = item.match(/<word>([^<]+)<\/word>/);
    const word = wordMatch ? wordMatch[1] : null;

    // Extract part of speech
    const posMatch = item.match(/<pos>([^<]+)<\/pos>/);
    const pos = posMatch ? posMatch[1] : null;

    // Extract sense blocks
    const senseBlocks = item.match(/<sense>[\s\S]*?<\/sense>/g) || [];
    const definitions = [];
    const translations = [];

    senseBlocks.forEach(sense => {
      // Extract Korean definition
      const defMatch = sense.match(/<definition>([^<]+)<\/definition>/);
      if (defMatch) {
        definitions.push(defMatch[1].trim());
      }

      // Extract English translations
      const translationBlocks = sense.match(/<translation>[\s\S]*?<\/translation>/g) || [];
      translationBlocks.forEach(block => {
        const transWordMatch = block.match(/<trans_word><!\[CDATA\[([^\]]+)\]\]><\/trans_word>/) ||
                               block.match(/<trans_word>([^<]+)<\/trans_word>/);
        const transDfnMatch = block.match(/<trans_dfn><!\[CDATA\[([^\]]+)\]\]><\/trans_dfn>/) ||
                              block.match(/<trans_dfn>([^<]+)<\/trans_dfn>/);

        if (transWordMatch) {
          translations.push({
            word: transWordMatch[1].trim(),
            definition: transDfnMatch ? transDfnMatch[1].trim() : ''
          });
        }
      });
    });

    results.push({
      target_code: targetCode,
      word: word,
      part_of_speech: pos,
      korean_definitions: definitions,
      english_translations: translations
    });
  });

  return results;
}

// Find Korean words that match the English word
// Note: The Korean Dictionary API searches Korean words, not English words
// So we need to search Korean words and check if their English translation matches
async function findKoreanMeaningForEnglishWord(englishWord) {
  const normalizedEnglishWord = englishWord.toLowerCase().trim();
  
  // Strategy 1: Try searching the English word directly (rarely works, but worth trying)
  try {
    const results = await searchKoreanDict(englishWord);
    if (results && results.length > 0) {
      // Check if any result has the English word in translations
      // Try exact match first
      for (const result of results) {
        const hasMatchingTranslation = result.english_translations.some(
          trans => trans.word.toLowerCase() === normalizedEnglishWord
        );
        if (hasMatchingTranslation) {
          return {
            korean_word: result.word,
            korean_definitions: result.korean_definitions,
            part_of_speech: result.part_of_speech,
            target_code: result.target_code,
            english_translations: result.english_translations
          };
        }
      }
      // If no exact match, try partial match (word appears in translation)
      for (const result of results) {
        const hasPartialMatch = result.english_translations.some(
          trans => trans.word.toLowerCase().includes(normalizedEnglishWord) ||
                   normalizedEnglishWord.includes(trans.word.toLowerCase())
        );
        if (hasPartialMatch) {
          return {
            korean_word: result.word,
            korean_definitions: result.korean_definitions,
            part_of_speech: result.part_of_speech,
            target_code: result.target_code,
            english_translations: result.english_translations
          };
        }
      }
    }
  } catch (error) {
    // Expected - API doesn't search English words
  }

  // Strategy 2: Search for common Korean words that might translate to the English word
  // This is a limited approach - for production, you'd want to use a translation service
  // to convert English -> Korean first, then search
  
  // Common English-to-Korean mappings
  // Note: Some words may have multiple Korean translations - this uses the most common one
  const commonMappings = {
    'english': '영어',
    'korean': '한국어',
    'hello': '안녕',
    'water': '물',
    'book': '책',
    'house': '집',
    'tree': '나무',
    'friend': '친구',
    'love': '사랑',
    'food': '음식',
    'give': '주다',
    'own': '소유하다',
    'strainer': '체',
    'aromatic': '향기로운',
    'reckoning': '계산'
  };

  const koreanWord = commonMappings[normalizedEnglishWord];
  if (koreanWord) {
    try {
      const results = await searchKoreanDict(koreanWord);
      if (results && results.length > 0) {
        // Verify the translation matches - try exact match first
        for (const result of results) {
          const hasMatchingTranslation = result.english_translations.some(
            trans => trans.word.toLowerCase() === normalizedEnglishWord
          );
          if (hasMatchingTranslation) {
            return {
              korean_word: result.word,
              korean_definitions: result.korean_definitions,
              part_of_speech: result.part_of_speech,
              target_code: result.target_code,
              english_translations: result.english_translations
            };
          }
        }
        // If no exact match, try partial match
        for (const result of results) {
          const hasPartialMatch = result.english_translations.some(
            trans => trans.word.toLowerCase().includes(normalizedEnglishWord) ||
                     normalizedEnglishWord.includes(trans.word.toLowerCase())
          );
          if (hasPartialMatch) {
            return {
              korean_word: result.word,
              korean_definitions: result.korean_definitions,
              part_of_speech: result.part_of_speech,
              target_code: result.target_code,
              english_translations: result.english_translations
            };
          }
        }
        // If still no match but we have results, return the first one (might be a close match)
        if (results.length > 0) {
          return {
            korean_word: results[0].word,
            korean_definitions: results[0].korean_definitions,
            part_of_speech: results[0].part_of_speech,
            target_code: results[0].target_code,
            english_translations: results[0].english_translations
          };
        }
      }
    } catch (error) {
      console.log(`  Search failed for Korean word "${koreanWord}": ${error.message}`);
    }
  }

  // No match found
  return null;
}

// Process words and update Korean meanings
async function processWords() {
  try {
    console.log('Fetching words from database...');
    const words = await db.getWordsWithoutKoreanMeaning('english');
    console.log(`Found ${words.length} words to process\n`);

    if (words.length === 0) {
      console.log('No words to process.');
      await db.close();
      return;
    }

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      console.log(`[${i + 1}/${words.length}] Processing: "${word.word}" (ID: ${word.id})`);

      try {
        const koreanMeaning = await findKoreanMeaningForEnglishWord(word.word);

        if (koreanMeaning) {
          // Structure the Korean meaning as JSONB
          const meaningKo = {
            word: koreanMeaning.korean_word,
            definitions: koreanMeaning.korean_definitions,
            part_of_speech: koreanMeaning.part_of_speech,
            target_code: koreanMeaning.target_code,
            source: 'krdict',
            updated_at: new Date().toISOString()
          };

          await db.updateKoreanMeaning(word.id, word.language, meaningKo);
          console.log(`  ✓ Updated: ${koreanMeaning.korean_word} - ${koreanMeaning.korean_definitions[0]?.substring(0, 50)}...`);
          successCount++;

          // Add a small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 500));
        } else {
          console.log(`  ✗ No Korean meaning found for "${word.word}"`);
          failCount++;
        }
      } catch (error) {
        console.error(`  ✗ Error processing "${word.word}": ${error.message}`);
        failCount++;
      }
    }

    console.log(`\n=== Summary ===`);
    console.log(`Total processed: ${words.length}`);
    console.log(`Success: ${successCount}`);
    console.log(`Failed: ${failCount}`);

  } catch (error) {
    console.error('Error processing words:', error);
  } finally {
    await db.close();
  }
}

// Run the script
if (require.main === module) {
  processWords().catch(console.error);
}

module.exports = {
  searchKoreanDict,
  findKoreanMeaningForEnglishWord,
  processWords
};

