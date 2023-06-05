import fs from "fs/promises";
import { fileExists } from "../miscellaneous/util";
import { config } from "../miscellaneous/config";
import { AlarmType } from "../miscellaneous/types";

export const DB_FILE_PATH = "./db.json";

interface UserFlag {
    suspectedAs: string;
    count: number;
}

interface DatabaseSchema {
    users: {
        [key: string]: UserFlag[];
    };
}

const DEFAULT_DATABASE: DatabaseSchema = {
    users: {},
};

let database: DatabaseSchema;

export async function getDatabase(): Promise<DatabaseSchema> {
    if (database) return database;

    const databaseExists = await fileExists(DB_FILE_PATH);
    if (!databaseExists) {
        return await createDatabase();
    }

    const dbRaw = await fs.readFile(DB_FILE_PATH, "utf8");
    database = JSON.parse(dbRaw);
    return database;
}

export async function createDatabase(): Promise<DatabaseSchema> {
    database = DEFAULT_DATABASE;
    await writeDatabase();
    return database;
}

function checkUser(user: string): UserFlag[] {
    if (!database.users[user]) {
        database.users[user] = [];
        return [];
    }

    return database.users[user];
}

function incrementUserFlag(user: string, suspectedAs: string): AlarmType {
    const userFlags = checkUser(user);
    for (const flag of userFlags) {
        if (flag.suspectedAs === suspectedAs) {
            flag.count += 1;

            if (flag.count === config.silentFlagCount) return AlarmType.Silent;
            else if (flag.count >= config.alarmFlagCount) {
                flag.count = 0;
                return AlarmType.Alarm;
            } else return AlarmType.None;
        }
    }

    userFlags.push({ suspectedAs, count: 1 });
    database.users[user] = userFlags;
    return AlarmType.None;
}

export async function flagUser(
    user: string,
    suspectedAs: string
): Promise<AlarmType> {
    const alarmType = incrementUserFlag(user, suspectedAs);
    await writeDatabase();

    return alarmType;
}

async function writeDatabase() {
    await fs.writeFile(DB_FILE_PATH, JSON.stringify(database), "utf8");
}
