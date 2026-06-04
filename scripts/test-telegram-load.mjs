/**
 * scripts/test-telegram-load.mjs
 * 
 * Node.js script for Telegram Load Testing.
 * Simulates sending messages to 1,000 users with batching (25 users per batch)
 * and a 1-second delay between batches to comply with Telegram's rate limits.
 */

// CONFIGURATION
const BOT_TOKEN = '8526043502:AAE6PUUfRyw29e4oMV60-c2QaJelNoWIhLI';
const MY_REAL_CHAT_ID = 7718095579;


// HELPERS
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Sends a telegram message to a specific Chat ID.
 * @param {string|number} chatId - Target Telegram chat ID.
 * @param {string} text - Message content.
 * @returns {Promise<{success: boolean, status: number|string, error?: string}>}
 */
async function sendMessage(chatId, text) {
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: text,
      }),
    });

    const data = await response.json();
    if (response.ok && data.ok) {
      return { success: true, status: response.status };
    } else {
      return {
        success: false,
        status: response.status,
        error: data.description || 'Unknown API Error'
      };
    }
  } catch (error) {
    return {
      success: false,
      status: 'NETWORK_ERROR',
      error: error.message
    };
  }
}

// MAIN RUNNER
async function main() {
  console.log('🚀 Starting Telegram Load Test Script...\n');

  // Check if configuration placeholders are still in use
  if (BOT_TOKEN === 'YOUR_BOT_TOKEN_HERE' || MY_REAL_CHAT_ID === 'YOUR_REAL_CHAT_ID_HERE') {
    console.warn('⚠️  Warning: BOT_TOKEN or MY_REAL_CHAT_ID contains placeholder values.');
    console.warn('To test real message delivery, replace them with your actual credentials at the top of the file.\n');
  }

  // Generate mock data for 1,000 users
  // First user is the real chat ID, next 999 are sequential mock IDs designed to fail (Bad Request)
  const users = [MY_REAL_CHAT_ID];
  for (let i = 0; i < 99; i++) {
    users.push(1000000001 + i);
  }

  const totalUsers = users.length;
  const batchSize = 30;
  const delayMs = 1000;

  let successCount = 0;
  let failureCount = 0;

  const startTime = Date.now();

  // Rate Limiting Queue Process
  for (let i = 0; i < totalUsers; i += batchSize) {
    const currentBatch = users.slice(i, i + batchSize);
    const startRange = i + 1;
    const endRange = Math.min(i + batchSize, totalUsers);

    console.log(`⏳ Processing batch [${startRange} - ${endRange}] of ${currentBatch.length} users...`);

    const promises = currentBatch.map(async (chatId, batchIndex) => {
      const globalIndex = i + batchIndex + 1;
      const text = `[Load Test] Message #${globalIndex} - System Performance Verification.`;

      const result = await sendMessage(chatId, text);

      if (result.success) {
        successCount++;
        console.log(`  ✅ [${globalIndex}/${totalUsers}] Chat ID: ${chatId} - Success`);
      } else {
        failureCount++;
        console.log(`  ❌ [${globalIndex}/${totalUsers}] Chat ID: ${chatId} - Failed (Status: ${result.status}, Error: ${result.error})`);
      }
    });

    // Execute the current batch of 25 parallel requests
    await Promise.all(promises);

    // Apply sleep limit if there are more batches left
    if (i + batchSize < totalUsers) {
      console.log(`  😴 Waiting ${delayMs / 1000}s before next batch to respect rate limits...\n`);
      await sleep(delayMs);
    }
  }

  // Calculate elapsed time
  const totalDurationSeconds = ((Date.now() - startTime) / 1000).toFixed(2);

  // Print Summary Report
  console.log('\n==================================================');
  console.log('📊 LOAD TEST RESULT SUMMARY');
  console.log('==================================================');
  console.log(`⏱️  Total Time Taken : ${totalDurationSeconds} seconds`);
  console.log(`✅ Success Sends   : ${successCount} users`);
  console.log(`❌ Failed Sends    : ${failureCount} users`);
  console.log(`👥 Total Attempted : ${totalUsers} users`);
  console.log('==================================================\n');
}

main().catch((err) => {
  console.error('Fatal load test error:', err);
  process.exit(1);
});
