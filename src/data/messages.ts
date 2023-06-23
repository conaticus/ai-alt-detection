import { ChannelType, Client, Collection, Message } from "discord.js";
import { LocalMessage } from "../miscellaneous/types";
import { config } from "../miscellaneous/config";
import fs from "fs/promises";
import { cleanString, fileExists } from "../miscellaneous/util";
import natural from "natural";

const MESSAGES_FILE_PATH = "./messages.json";
export let localMessages: LocalMessage[];

/** Reads saved messages file and returns messages */
export async function getLocalMessages(
    client: Client
): Promise<LocalMessage[]> {
    if (localMessages) return localMessages;

    const messagesFileExists = await fileExists(MESSAGES_FILE_PATH);
    if (!messagesFileExists) {
        localMessages = await saveDiscordMessages(client);
        return localMessages;
    }

    const rawMessages = await fs.readFile(MESSAGES_FILE_PATH, "utf8");
    localMessages = JSON.parse(rawMessages);
    return localMessages;
}

/** Writes new message to memory and storage file. */
export async function addLocalMessage(message: Message) {
    await getLocalMessages(message.client);
    localMessages.push(constructLocalMessage(message));
    await writeMessageFile(localMessages);
}

/** Turns discord.js message into local message type. */
export function constructLocalMessage(message: Message): LocalMessage {
    return {
        content: cleanMessage(message.content),
        user: message.author.tag,
        timestamp: message.createdTimestamp,
        length: message.content.length,
    };
}

/** Fetches number of messages specified in the config file & stores them in a `messages.json`. All messages are cleaned for the NLP before being saved. */
export async function saveDiscordMessages(
    client: Client
): Promise<LocalMessage[]> {
    const messages = new Collection<string, Message>();
    let arr = client.guilds.cache.get(config.guildId)?.channels.cache.map(c => c);
    console.log(arr)
    for (const c of arr ? arr : []) {
        let id = c.id
        if (c.type == ChannelType.GuildText) {
            const r = await getChannelMessages(client, id)
            messages.concat(r)
            console.log("done " + id)
        }
    }

    const localMessages: LocalMessage[] = [];

    messages.forEach((m) => {
        localMessages.push(constructLocalMessage(m));
    });

    await writeMessageFile(localMessages);
    return localMessages;
}

export async function writeMessageFile(messages: LocalMessage[]) {
    await fs.writeFile("./messages.json", JSON.stringify(messages));
}

/** Cleans a message so that the NLP can make the most use out of it. This includes removing special characters, stopwords and uppercase letters. */
export function cleanMessage(content: string): string {
    if (content.length === 0) return "";

    const cleanedGrammar = cleanString(content);
    const tokenizer = new natural.WordTokenizer();
    const tokens = tokenizer.tokenize(cleanedGrammar);

    if (!tokens) return "";

    const filteredTokens = tokens.filter(
        (token) => !natural.stopwords.includes(token)
    );

    return filteredTokens.join(" ");
}

/** Fetches the specified amount of messages in the config from the specified channel. */
export async function getChannelMessages(
    client: Client,
    channelId: string
): Promise<Collection<string, Message>> {
    console.log(channelId)
    const channel = client.channels.cache.get(channelId);

    if (!channel) {
        throw new Error("Failed to find specified channel.");
    }
    if (channel.type !== ChannelType.GuildText) {
        let a = new Collection<string, Message>()
        return a
    }

    if (!channel.isTextBased()) {
        throw new Error(
            "Could not fetch messages from channel as is not text based."
        );
    }

    let allMessages = new Collection<string, Message>();

    let lastMessageId = null;
    let fetching = true;

    while (fetching) {
        const options: any = { limit: 100 };
        if (lastMessageId) options.before = lastMessageId;

        const messages = (await channel.messages.fetch(options)) as any;
        allMessages = allMessages.concat(messages);
        console.log("Found:", allMessages.size, "messages.");

        if (messages.size < 100 || allMessages.size >= config.trainingLimit) {
            fetching = false;
        } else {
            lastMessageId = messages.lastKey();
        }
    }

    return allMessages;
}
