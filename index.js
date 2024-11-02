require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const ytdl = require('ytdl-core');
const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const path = require('path');

const token = process.env.TELEGRAM_BOT_TOKEN;
const bot = new TelegramBot(token, { polling: true });

bot.onText(/\/start/, (msg) => {
  bot.sendMessage(msg.chat.id, "Hello! Send /play <YouTube URL> to play music.");
});

bot.onText(/\/play (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const url = match[1];

  if (!ytdl.validateURL(url)) {
    return bot.sendMessage(chatId, "Please provide a valid YouTube URL.");
  }

  bot.sendMessage(chatId, "Downloading audio...");

  try {
    const audioStream = ytdl(url, { filter: 'audioonly' });
    const outputFile = path.resolve(__dirname, 'audio.ogg');

    // Convert audio to .ogg using ffmpeg
    ffmpeg(audioStream)
      .audioBitrate(128)
      .toFormat('ogg')
      .save(outputFile)
      .on('end', async () => {
        // Send the audio file
        await bot.sendAudio(chatId, outputFile);

        // Clean up the file after sending
        fs.unlinkSync(outputFile);
      })
      .on('error', (err) => {
        bot.sendMessage(chatId, `Error: ${err.message}`);
      });
  } catch (error) {
    bot.sendMessage(chatId, `Error: ${error.message}`);
  }
});