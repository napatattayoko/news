import fs from 'fs';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'database.json');

// Define our simple database schema
export interface Database {
  users: {
    [userId: string]: {
      telegramChatId?: number;
      trackedSymbols: string[];
    }
  };
  pendingLinks: {
    [pin: string]: string; // Maps a 6-digit PIN to a userId
  };
  news?: any[];
}

// Initialize empty DB if it doesn't exist
function initDb(): Database {
  if (!fs.existsSync(DB_PATH)) {
    const defaultDb: Database = {
      users: {
        'user-1': { // We simulate a logged-in user with ID 'user-1'
          trackedSymbols: ['AAPL', 'TSLA', 'MSFT']
        }
      },
      pendingLinks: {}
    };
    fs.writeFileSync(DB_PATH, JSON.stringify(defaultDb, null, 2));
    return defaultDb;
  }
  return JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
}

export function readDb(): Database {
  try {
    return initDb();
  } catch (error) {
    console.error('Failed to read DB:', error);
    return { users: {}, pendingLinks: {} };
  }
}

export function writeDb(data: Database) {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Failed to write DB:', error);
  }
}
