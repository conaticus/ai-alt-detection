import { Client, Guild } from "discord.js";
import { fileExists } from "../miscellaneous/util";
import fs from "fs/promises";
import { config } from "../miscellaneous/config";
import { BanList } from "../miscellaneous/types";

const BAN_FILE_PATH = "./bans.json";
let banList: BanList;

/** Reads bans.json and stores in memory. */
export async function getBanList(client: Client): Promise<BanList> {
    if (banList) return banList;

    const banFileExists = await fileExists(BAN_FILE_PATH);
    if (!banFileExists) {
        banList = await generateBanList(client);
        return banList;
    }

    const rawList = await fs.readFile(BAN_FILE_PATH, "utf8");
    banList = JSON.parse(rawList);
    return banList;
}

/** Gets all the server bans and stores them in JSON. This needs to be customised so that alt accounts are identified before the model is trained. */
async function generateBanList(client: Client): Promise<BanList> {
    const guild = client.guilds.cache.get(config.guildId);
    if (!guild) {
        throw new Error("Failed to find guild specified in config.");
    }

    const list = {};
    const bans = await guild.bans.fetch();
    bans.forEach((ban) => {
        list[ban.user.tag] = [];
    });

    await fs.writeFile(BAN_FILE_PATH, JSON.stringify(list));
    return list;
}

export async function writeBans() {
    await fs.writeFile(BAN_FILE_PATH, JSON.stringify(banList), "utf8");
}

export async function addAltBan(masterUser: string, bannedAltAccount: string) {
    banList[masterUser].push(bannedAltAccount);
    await writeBans();
}

export async function addNormalBan(user: string) {
    banList[user] = [];
    await writeBans();
}

export async function removeBan(user: string) {
    delete banList[user];
    await writeBans();
}
