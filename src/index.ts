import { Client, Events, GatewayIntentBits, Partials } from "discord.js";
import { NlpManager } from "node-nlp";
import { fileExists } from "./miscellaneous/util";
import { config } from "./miscellaneous/config";
import { processMessage, train } from "./nlp";
import { addLocalMessage } from "./data/messages";
import { getDatabase } from "./data/database";
import { addNormalBan, getBanList, removeBan } from "./data/bans";

const client = new Client({
    intents: [
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ],
    partials: [Partials.Channel],
});
const manager = new NlpManager({ languages: ["en"] });

client.once(Events.ClientReady, async (c) => {
    console.log(`Logged in as ${c.user.tag}.`);
    await getDatabase();
    await getBanList(client);

    const modelExists = await fileExists(config.modelPath);
    if (!modelExists) {
        await train(manager, c);
    } else {
        await manager.load(config.modelPath);
    }
});

client.on("messageCreate", async (message) => {
    if (message.content.length === 0) return;
    await addLocalMessage(message);
    await processMessage(manager, message);
});

client.on("guildBanAdd", async (member) => {
    await addNormalBan(member.user.tag);
    await train(manager, member.client);
});

client.on("guildBanRemove", async (member) => {
    await removeBan(member.user.tag);
    await train(manager, member.client);
});

client.login(process.env.TOKEN);
