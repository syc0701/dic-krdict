# Korean Dictionary API Integration

This project integrates with the Korean Basic Dictionary Open API to fetch Korean meanings for English words and store them in a PostgreSQL database.

## Files

- `db.js` - PostgreSQL database connection and query functions
- `search_korean_dict.js` - Simple script to search the Korean Dictionary API
- `update_korean_meanings.js` - Main script to update Korean meanings in the database

## Setup

1. Install dependencies:
```bash
npm install
```

2. Make sure PostgreSQL is running and the database is accessible with the credentials in `db.js`

## Usage

### Search Korean Dictionary API
```bash
node search_korean_dict.js [korean_word]
# Example: node search_korean_dict.js 영어
```

### Update Korean Meanings in Database
```bash
npm run update-meanings
# or
node update_korean_meanings.js
```

This script will:
1. Query the `dictionary_multi` table for English words without Korean meanings
2. Search the Korean Dictionary API for Korean translations
3. Update the `meaning_ko` column with Korean definitions

## Important Note

**Limitation**: The Korean Dictionary API searches Korean words, not English words directly. The current implementation includes a basic mapping for common words. For production use, you may want to integrate a translation service (like Google Translate API) to convert English words to Korean first, then search the dictionary.

## Database Schema

The script works with the `dictionary_multi` table:
- `word` - English word (TEXT)
- `meaning_ko` - Korean meaning (JSONB)
- `language` - Language code (VARCHAR)

## Configuration

Database connection settings are in `db.js`. Update them if needed:
- Host: localhost
- Port: 5433
- Database: puzzle_db
- User: puzzle_user
- Password: puzzle_password

