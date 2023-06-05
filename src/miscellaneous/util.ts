import fs from "fs/promises";

export async function fileExists(path: string): Promise<boolean> {
    try {
        await fs.access(path, fs.constants.F_OK);
        return true;
    } catch (error: any) {
        return false;
    }
}

export function cleanString(text) {
    const cleanedText = text.replace(/[^\w\s]/gi, "").replace(/\n/g, "");
    const lowercaseText = cleanedText.toLowerCase();
    return lowercaseText;
}
