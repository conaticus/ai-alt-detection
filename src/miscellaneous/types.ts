export interface LocalMessage {
    content: string;
    user: string;
    timestamp: number;
    length: number;
}

/** The key is the main account user tag, the value is an array of alt account user tags */
export interface BanList {
    [key: string]: string[];
}

export enum AlarmType {
    None,
    Silent,
    Alarm,
}
