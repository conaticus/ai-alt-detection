import { NlpManager } from "node-nlp";
import { Client, Message, EmbedBuilder } from "discord.js";
import { config } from "./miscellaneous/config";
import { constructLocalMessage, getLocalMessages } from "./data/messages";
import { getBanList } from "./data/bans";
import { AlarmType, BanList } from "./miscellaneous/types";
import { flagUser } from "./data/database";
import { sendAlarmEmbed } from "./alarm";

/** Returns undefined if author is not banned. If it was sent on an alt, it will return the master author. */
function getBannedAuthor(
    banList: BanList,
    authorUser: string
): string | undefined {
    for (const masterUser in banList) {
        if (masterUser === authorUser) return masterUser;

        const altAccounts = banList[masterUser];
        for (const altUser of altAccounts) {
            if (altUser === authorUser) return masterUser;
        }
    }
}

/** Train the model on the stored message history in `messages.json`. Should be re-trained every time a new member is banned. */
export async function train(
    manager: NlpManager,
    client: Client
): Promise<void> {
    const localMessages = await getLocalMessages(client);
    const banList = await getBanList(client);

    // Ensures that the balancing limit is not exceeded.
    const trackedMembers = {};

    localMessages.forEach((localMessage) => {
        const author = getBannedAuthor(banList, localMessage.user);
        if (!author) return;

        if (!trackedMembers[author]) {
            trackedMembers[author] = 1;
        } else {
            trackedMembers[author] += 1;
        }

        if (trackedMembers[author] > config.balanceCount) return;

        // Train model on master author if found banned.
        manager.addDocument("en", localMessage.content, localMessage.user, {
            length: localMessage.length,
            timestamp: localMessage.timestamp,
        });
    });

    await manager.train();
    await manager.save(config.modelPath, true);
    console.log("Model successfully trained.");
}

export async function processMessage(manager: NlpManager, message: Message) {
    const localMessage = constructLocalMessage(message);
    const { classifications } = await manager.process(
        "en",
        localMessage.content,
        {
            length: localMessage.length,
            timestamp: localMessage.timestamp,
        }
    );

    const { intent, score } = classifications[0];
    if (score < config.confidenceThreshold) return;

    const alarmType = await flagUser(message.author.tag, intent);
    if (alarmType === AlarmType.None) return;

    await sendAlarmEmbed(manager, message, intent, alarmType);
}
