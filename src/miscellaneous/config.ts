import dotenv from "dotenv";
dotenv.config();

export const config = {
    clientId: process.env.CLIENT_ID as string,
    token: process.env.TOKEN as string,
    modelPath: process.env.MODEL_PATH as string,
    chatId: process.env.CHAT_ID as string,
    trainingLimit: Number(process.env.TRAINING_LIMIT),
    balanceCount: Number(process.env.BALANCE_COUNT),
    guildId: process.env.GUILD_ID as string,
    confidenceThreshold: Number(process.env.CONFIDENCE_THRESHOLD),
    alarmFlagCount: Number(process.env.ALARM_FLAG_COUNT),
    silentFlagCount: Number(process.env.SILENT_FLAG_COUNT),
    alarmChannelId: process.env.ALARM_CHANNEL_ID as string,
};
