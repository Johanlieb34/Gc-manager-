const TelegramBot = require('node-telegram-bot-api');
const ytdl = require('ytdl-core');
const ytSearch = require('yt-search');
const fs = require('fs');
const path = require('path');

// Replace with your BotFather token
const token = '8104826949:AAHv0ejQ11MGnZSUMjqwyD5r4LP78y3D_3A';
const bot = new TelegramBot(token, { polling: true });

// Queue to hold song requests
let songQueue = [];

// Dictionary to track users who have posted links
const linkWarningCount = {};

// ================== Anti-Link Feature ==================

// Detect and delete messages containing links
bot.on('message', (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const userName = msg.from.first_name;

  // Regular expression to detect links
  const linkRegex = /(https?:\/\/[^\s]+)/g;
  
  if (linkRegex.test(msg.text)) {
    // Delete the message with a link
    bot.deleteMessage(chatId, msg.message_id);
    
    // Warn the user
    if (!linkWarningCount[userId]) {
      linkWarningCount[userId] = 1;
    } else {
      linkWarningCount[userId]++;
    }

    // Send warning message
    bot.sendMessage(chatId, `${userName}, please don't post links in this group. Warning ${linkWarningCount[userId]}/3`);

    // If the user posts 3 links, mute them
    if (linkWarningCount[userId] >= 3) {
      const mutePermissions = {
        can_send_messages: false,
        can_send_media_messages: false,
        can_send_polls: false,
        can_send_other_messages: false,
        can_add_web_page_previews: false,
        can_change_info: false,
        can_invite_users: false,
        can_pin_messages: false
      };

      bot.restrictChatMember(chatId, userId, mutePermissions).then(() => {
        bot.sendMessage(chatId, `${userName} has been muted for repeatedly posting links.`);
      });

      // Reset their warning count after muting
      linkWarningCount[userId] = 0;
    }
  }
});

// ================== Group Management Commands ==================

// Welcome new members
bot.on('message', (msg) => {
  if (msg.new_chat_members) {
    msg.new_chat_members.forEach((user) => {
      bot.sendMessage(msg.chat.id, `Welcome to the group, ${user.first_name}! 🎉`);
    });
  }
});

// Command to show group rules
bot.onText(/\/rules/, (msg) => {
  const chatId = msg.chat.id;
  const rulesText = `
    📜 Group Rules:
    1. Be respectful.
    2. No spamming or flooding the chat.
    3. No offensive language.
    4. No posting links.
    5. Follow the admins' instructions.
  `;
  bot.sendMessage(chatId, rulesText);
});

// Kick a user by ID
bot.onText(/\/kick (\d+)/, (msg, match) => {
  const userId = parseInt(match[1]);
  const chatId = msg.chat.id;

  bot.kickChatMember(chatId, userId).then(() => {
    bot.sendMessage(chatId, `User has been kicked from the group.`);
  }).catch((error) => {
    bot.sendMessage(chatId, `Failed to kick user: ${error.message}`);
  });
});

// Mute a user by ID
bot.onText(/\/mute (\d+)/, (msg, match) => {
  const userId = parseInt(match[1]);
  const chatId = msg.chat.id;

  const mutePermissions = {
    can_send_messages: false,
    can_send_media_messages: false,
    can_send_polls: false,
    can_send_other_messages: false,
    can_add_web_page_previews: false,
    can_change_info: false,
    can_invite_users: false,
    can_pin_messages: false
  };

  bot.restrictChatMember(chatId, userId, mutePermissions).then(() => {
    bot.sendMessage(chatId, `User has been muted.`);
  }).catch((error) => {
    bot.sendMessage(chatId, `Failed to mute user: ${error.message}`);
  });
});

// Unmute a user by ID
bot.onText(/\/unmute (\d+)/, (msg, match) => {
  const userId = parseInt(match[1]);
  const chatId = msg.chat.id;

  const unmutePermissions = {
    can_send_messages: true,
    can_send_media_messages: true,
    can_send_polls: true,
    can_send_other_messages: true,
    can_add_web_page_previews: true,
    can_change_info: false,
    can_invite_users: true,
    can_pin_messages: false
  };

  bot.restrictChatMember(chatId, userId, unmutePermissions).then(() => {
    bot.sendMessage(chatId, `User has been unmuted.`);
  }).catch((error) => {
    bot.sendMessage(chatId, `Failed to unmute user: ${error.message}`);
  });
});

// ================== Music Player Commands ==================

// Search and add song to queue
bot.onText(/\/play (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const songName = match[1];

    try {
        const searchResult = await ytSearch(songName);
        if (searchResult.videos.length === 0) {
            bot.sendMessage(chatId, "Sorry, I couldn't find that song.");
            return;
        }

        const song = searchResult.videos[0];
        songQueue.push(song);
        bot.sendMessage(chatId, `Added to queue: ${song.title}`);
        
        if (songQueue.length === 1) {
            playSong(chatId);
        }
    } catch (error) {
        bot.sendMessage(chatId, `Error searching for song: ${error.message}`);
    }
});

// Play the current song in the queue
async function playSong(chatId) {
    if (songQueue.length === 0) return;

    const song = songQueue[0];
    const stream = ytdl(song.url, { filter: 'audioonly', quality: 'highestaudio' });
    const filePath = path.join(__dirname, `${song.title}.mp3`);

    stream.pipe(fs.createWriteStream(filePath)).on('finish', () => {
        bot.sendAudio(chatId, filePath, { title: song.title }).then(() => {
            fs.unlinkSync(filePath);
            songQueue.shift();
            if (songQueue.length > 0) {
                playSong(chatId);
            }
        });
    });
}

// ================== Additional Music Commands ==================
// /pause, /resume, /stop, /skip, /queue

// Error handling
bot.on('polling_error', (error) => {
  console.error(`Polling error: ${error.code} - ${error.message}`);
});
