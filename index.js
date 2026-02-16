const readline = require("readline");
const express = require("express");
const axios = require("axios");
const fs = require('fs');
const path = require('path');
const chalk = require("chalk");
const appDataPath = process.env.APPDATA;
const filePath = path.join(appDataPath, '.matankify', 'config');
let debug = false;
let pugkey = getSetting('Pug');
let urchinkey = getSetting('Urchin');

mtnkify();

let rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: chalk.cyan("Matankify") + chalk.gray(" » ")
});

rl.prompt();

rl.on("line", async (line) => {
    const input = line.trim();
    if (!input) {
        rl.prompt();
        return;
    }
    const parts = input.split(" ");
    const base = parts[0].toLowerCase();
    /* help */
    if (base === ".h" || base === ".help") {
        showHelp();
        rl.prompt();
        return;
    }
    /* api */
    if (base === ".apikey") {
        if (parts.length === 1) {
            console.log(chalk.yellow("Usage:"));
            console.log(c(".apikey urchin <key>", `Sets urchin key`));
            console.log(c(".apikey pug    <key>", `Sets pug key`));
            console.log("");
            console.log(chalk.cyan("Current Keys:"));
            console.log(c("urchin", urchinkey ?? "not set"));
            console.log(c("pug   ", pugkey ?? "not set"));
            rl.prompt();
            return;
        }

        const target = parts[1]?.toLowerCase();
        const key = parts[2];

        if (!key) {
            console.log(chalk.red("Error: Key is missing."));
            rl.prompt();
            return;
        }

        if (target === "urchin") {
            urchinkey = key;
            console.log(chalk.green(`Urchin key updated. (${chalk.bold(key)})`));
        } else if (target === "pug") {
            pugkey = key;
            console.log(chalk.green(`PugAPI key updated. (${chalk.bold(key)})`));
        } else {
            console.log(chalk.red("Error: Unknown target. Use 'urchin' or 'pug'."));
        }

        rl.prompt();
        return;
    }
    /* omake */
    if (base === ".snipedbychiterl") {
        console.log("bro spare me!");
        console.log("             _                   _       _                        _      _  _                _  _\n" +
            "            (_)                 | |     | |                      | |    (_)| |              | || |\n" +
            " ___  _ __   _  _ __    ___   __| |     | |__   _   _        ___ | |__   _ | |_   ___  _ __ | || |\n" +
            "/ __|| '_ \\ | || '_ \\  / _ \\ / _` |     | '_ \\ | | | |      / __|| '_ \\ | || __| / _ \\| '__|| || |\n" +
            "\\__ \\| | | || || |_) ||  __/| (_| |     | |_) || |_| |     | (__ | | | || || |_ |  __/| |   | ||_|\n" +
            "|___/|_| |_||_|| .__/  \\___| \\__,_|     |_.__/  \\__, |      \\___||_| |_||_| \\__| \\___||_|   |_|(_)\n" +
            "               | |                               __/ |\n" +
            "               |_|                              |___/\n")
        rl.prompt();
        return;
    }

    /* tags */
    if (base === ".tags") {
        availableTags();
        console.log("Want custom tags? contact @unsnipeable");
        rl.prompt();
        return;
    }

    /* resync */
    if (base === ".resync") {
        lastFetch = 0;
        tagMapCache = null;
        await loadTagMap();
        console.log(chalk.greenBright("Successfully resync"))
        rl.prompt();

        return;
    }

    /* discord */
    if (base === ".discord" || base === ".dsc") {
        console.log(chalk.blueBright("Discord: https://discord.gg/NvBsdMPPwG"))
        rl.prompt();
        return;
    }

    /* tag */
    if (base === ".t" || base === ".tag") {
        const sub = parts[1]?.toLowerCase();
        // .tag
        if (!sub) {
            tagHelp();
            availableTags();
            console.log("Want custom tags? contact @unsnipeable");
            rl.prompt();
            return;
        }
        // .tag list
        if (sub === "list") {
            const type = parts[2]?.toLowerCase();
            if (type && !tagFiles[type]) {
                console.log(chalk.redBright(`Unknown tag type: ${type}`));
                rl.prompt();
                return;
            }
            const targets = type ? {
                [type]: tagFiles[type]
            } : tagFiles;
            for (const [k, file] of Object.entries(targets)) {
                const list = readList(path.join(appDataPath, '.matankify', file));
                console.log(chalk.cyan(`\n${formatTagColor(file.replace(".txt", "").toUpperCase())}:`));
                if (list.length === 0) {
                    console.log(chalk.gray("  (empty)"));
                } else {
                    list.forEach(v => {
                        const reason = v.split(":")[1];
                        console.log("  " + v.split(":")[0] + (reason == null ? "" : " (reason: " + reason + ")"))
                    });
                }
            }
            rl.prompt();
            return;
        }
        // .tag remove
        if (sub === "remove") {
            const type = parts[2]?.toLowerCase();
            const player = parts.slice(3).join(" ");
            if (!tagFiles[type] || !player) {
                console.log(chalk.redBright("Usage: .tag remove <tag> <player>"));
                rl.prompt();
                return;
            }
            const file = tagFiles[type]
            const list = readList(path.join(appDataPath, '.matankify', file));
            const playerUUID = await getUUID(player);

            let found = false
            for (const u of list) {
                let uuid;
                if (u.includes(":")) {
                    uuid = u.split(":")[0];
                } else {
                    uuid = u;
                }
                console.log(uuid);
                if (playerUUID === uuid) {
                    found = true;
                }
            }
            if (!found) {
                console.log(chalk.redBright(`"${player}" (${playerUUID}) not found in ${file}`));
                rl.prompt();
                return;
            }

            const updated = list.filter(u => !u.startsWith(playerUUID));

            fs.writeFile(
                path.join(appDataPath, '.matankify', file),
                updated.join("\n") + "\n",
                (err) => {
                    if (err) {
                        console.error(chalk.red("Failed:"), err);
                    } else {
                        console.log(
                            chalk.greenBright(
                                `Removed ${chalk.white.underline(player)} from ${formatTagColor(file.replace(".txt", "").toUpperCase())}`
                            )
                        );
                    }
                    rl.prompt();
                }
            );
            return;
        }
        // .tag b/s/c
        const command = `.tag ${sub}`;
        const player = parts[2];
        const reason = parts.slice(3).join(" ") || "";
        if (commandMap[command]) {
            if (!player) {
                console.log(chalk.redBright(`Usage: ${command} <player>`));
            } else {
                const file = commandMap[command];
                try {
                    const playerUUID = await getUUID(player);
                    if (!playerUUID) {
                        console.log(chalk.red("Player not found."));
                        rl.prompt();
                        return;
                    }

                    const entry = `${playerUUID}:${reason}`;

                    fs.appendFile(
                        path.join(appDataPath, '.matankify', file),
                        entry + "\n",
                        (err) => {
                            if (err) {
                                console.error(chalk.red("Failed:"), err);
                            } else {
                                let extra = (reason == null ? "without any reasons" : " with a reason: " + chalk.bold(reason));
                                console.log(
                                    chalk.greenBright(
                                        `Tagged ${chalk.white.underline(player)} as ${formatTagColor(file.replace(".txt", "").toUpperCase())}${extra}`
                                    )
                                );
                            }
                            rl.prompt();
                        }
                    );
                } catch (err) {
                    console.error(chalk.red("UUID Fetch Failed:"), err.message);
                    rl.prompt();
                }
            }
            return;
        }
        console.log(chalk.redBright(`Unknown tag command: ${sub}`));
        tagHelp();
        rl.prompt();
        return;
    }
    console.log(chalk.redBright(`Unknown command. Type ".help" for help. ('${input}')`));
    rl.prompt();
});
rl.on("close", () => {
    console.log(chalk.gray("Quitting"));
    process.exit(0);
});

startServer();

function mtnkify() {
    console.log(chalk.redBright("                      ,--.                     ,--.     ,--.  ,---.\n" + ",--,--,--.  ,--,--. ,-'  '-.  ,--,--. ,--,--,  |  |,-.  `--' /  .-' ,--. ,--.\n" + "|        | ' ,-.  | '-.  .-' ' ,-.  | |      \\ |     /  ,--. |  `-,  \\  '  /\n" + "|  |  |  | \\ '-'  |   |  |   \\ '-'  | |  ||  | |  \\  \\  |  | |  .-'   \\   '\n" + "`--`--`--'  `--`--'   `--'    `--`--' `--''--' `--'`--' `--' `--'   .-'  /\n" + "                                                                    `---'\n"))
}

function saveSettings(key1, value1, key2, value2) {
    const dirPath = path.dirname(filePath);
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, {
            recursive: true
        });
    }
    const content = `${key1}=${value1}\n${key2}=${value2}\n`;
    fs.writeFileSync(filePath, content);
}

function loadSettings() {
    if (fs.existsSync(filePath)) {
        const rawData = fs.readFileSync(filePath, 'utf8');
        const settings = {};
        const lines = rawData.split('\n');
        lines.forEach(line => {
            if (line.includes('=')) {
                const [key, value] = line.split('=');
                settings[key.trim()] = value.trim();
            }
        });
        return settings;
    }
    return {};
}

function getSetting(key) {
    const settings = loadSettings();
    if (settings[key]) {
        return settings[key];
    }
    return null;
}

function startServer() {
    if (pugkey && urchinkey) {
        saveSettings("Pug", pugkey, "Urchin", urchinkey);
    } else {
        const missing = (pugkey==null ? (urchinkey==null ? "pug, " : "pug") : "") + (urchinkey==null ? "urchin" : "");
        console.error(chalk.redBright("Missing key(s): " + missing));
        return;
    }
    const app = express();
    app.get("/test", async (req, res) => {
        try {
            const {name} = req.query;
            const uuid = formatUuid(await getUUID(name));
            const response = await axios.get("http://localhost:3000/", {
                params: {
                    id: uuid,
                    name: name,
                    sources: "MANUAL"
                }
            });
            res.json(response.data);
        } catch (err) {
            console.error(chalk.redBright("Test server error: " + err.message));
            rl.prompt();
        }
    })
    app.get("/", async (req, res) => {
        const {
            id,
            name,
            sources
        } = req.query; // id = uuid, name = mcid
        if (debug === true) {
            console.log(`NR|${id}|${name}|${sources}`);
        }
        const UrchinAPI = `https://urchin.ws/cubelify`;
        const PugAPI = `https://privatemethod.xyz/api/cubelify`;
        try {
            const baseParam = {
                id: id,
                name: name,
                sources: sources,
            }
            const urchinResponse = await axios.get(UrchinAPI, {
                params: {
                    ...baseParam,
                    key: urchinkey
                }
            });
            const pugResponse = await axios.get(PugAPI, {
                params: {
                    ...baseParam,
                    key: pugkey
                }
            });
            if (debug === true) {
                console.log(`RR|${urchinResponse.data.toString()}|${pugResponse.data.toString()}|${mergeJSONString(urchinResponse.data,pugResponse.data).toString()}`);
            }
            pugResponse.data.tags = pugResponse.data.tags.filter(tag => !(tag.text && tag.text.endsWith('ms')));
            const mtnkTag = {
                tags: [{
                    tooltip: 'Matankify Owner',
                    color: 16748895,
                    icon: 'mdi-crown'
                }]
            };
            let merged = mergeJSONString(urchinResponse.data, pugResponse.data);
            for (const mtnk of ["mtnk", "matanku"]) {
                if (name.includes(mtnk)) {
                    merged = mergeJSONString(mtnkTag, merged)
                }
            }
            const tagDefinitions = [
                {
                    key: "b",
                    text: "B",
                    tooltip: "BOT",
                    color: 4705975,
                    icon: "mdi-robot"
                },
                {
                    key: "c",
                    text: "C",
                    tooltip: "CHEATER",
                    color: 4667572,
                    icon: "mdi-account-wrench"
                },
                {
                    key: "s",
                    text: "S",
                    tooltip: "SNIPER",
                    color: 11337728,
                    icon: "mdi-pistol"
                },
                {
                    key: "bs",
                    text: "BS",
                    tooltip: "BOOSTING/BOOSTER",
                    color: 4705975,
                    icon: "mdi-account-group"
                },
                {
                    key: "bl",
                    text: "BL",
                    tooltip: "BLACKLISTED",
                    color: 4667572,
                    icon: "mdi-alert-decagram"
                },
                {
                    key: "sl",
                    text: "SL",
                    tooltip: "SAFELISTED",
                    color: 11337728,
                    icon: "mdi-check-decagram"
                }
            ];

            for (const tag of tagDefinitions) {

                const reason = await getTagReason(tag.key, id);

                if (await isInTagFile(tag.key, id)) {

                    const tooltip = reason
                        ? `${tag.tooltip} | ${reason}`
                        : tag.tooltip;

                    merged = mergeJSONString({
                        tags: [{
                            text: tag.text,
                            tooltip: tooltip,
                            color: tag.color,
                            icon: tag.icon
                        }]
                    }, merged);
                }
            }

            // custom tag
            const map = await loadTagMap();
            const tags = map.get(id);
            if (tags) {
                merged = mergeJSONString({ tags }, merged);
            }

            res.json(merged);
        } catch (error) {
            if (error.response) {
                console.error('ServerError:', error.response.status);
                console.error('Error:', error.response.data);
            } else if (error.request) {
                console.error('ReqError:', error.request);
            } else {
                console.error('Error:', error.message);
            }
        }
    });
    const PORT = 3000;
    const server = app.listen(PORT, () => {
        console.log(`Set ${chalk.greenBright("Cubelify Custom Sniper API")} to \n${chalk.whiteBright.strikethrough("------------------------------------------------------------------")}\n${chalk.blueBright("http://localhost:3000/?id={{id}}&name={{name}}&sources={{sources}}")}\n${chalk.whiteBright.strikethrough("------------------------------------------------------------------")}`)

        rl.prompt();
    });
    server.on("error", (err) => {
        if (err.code === "EADDRINUSE") {
            console.log("Port 3000 is already in use.");
        } else {
            console.error("Error: " + err.code + " /", err);
        }
        process.exit(1);
    });
}

function mergeJSONString(json1, json2) {
    const result = {
        ...json1
    };
    for (const key in json2) {
        if (json1.hasOwnProperty(key)) {
            if (Array.isArray(result[key]) && Array.isArray(json2[key])) {
                result[key] = result[key].concat(json2[key]);
            } else if (typeof result[key] === 'object' && typeof json2[key] === 'object') {
                result[key] = mergeJSONString(result[key], json2[key]);
            } else {
                result[key] = [result[key], json2[key]];
            }
        } else {
            result[key] = json2[key];
        }
    }
    return result;
}
// SumoDB
const commandMap = {
    ".tag b": "bots.txt",
    ".tag c": "cheaters.txt",
    ".tag s": "snipers.txt",
    ".tag bs": "boosters.txt",
    ".tag bl": "blacklisted.txt",
    ".tag sl": "safelisted.txt"
};
const tagFiles = {
    b: "bots.txt",
    c: "cheaters.txt",
    s: "snipers.txt",
    bs: "boosters.txt",
    bl: "blacklisted.txt",
    sl: "safelisted.txt"
};
/* helpers */
function formatTagColor(tag) {
    switch (tag) {
        case "BOTS":
            return chalk.yellow("BOT");
        case "SNIPERS":
            return chalk.red("SNIPER");
        case "CHEATERS":
            return chalk.redBright("CHEATER");
        case "BOOSTERS":
            return chalk.blueBright("BOOSTER");
        case "BLACKLISTED":
            return chalk.cyanBright("BLACKLISTED");
        case "SAFELISTED":
            return chalk.magentaBright("SAFELISTED");
        default:
            return chalk.white(tag);
    }
}

function tagHelp() {
    console.log(chalk.yellowBright("Tag Commands:"));
    console.log(c(".tag <tag>  <player> [reason]", `Tag player`));
    console.log(c(".tag list [tag]", "List tagged players"));
    console.log(c(".tag remove <tag> <player>", "Remove a tag"));
    console.log(c(".tags", "Show available tags"));
}

function availableTags() {
    console.log("");
    console.log(chalk.yellowBright("Available tags:"));
    console.log(c("b ", `${chalk.yellow("Bot")}`));
    console.log(c("s ", `${chalk.red("Sniper")}`));
    console.log(c("c ", `${chalk.redBright("Cheater")}`));
    console.log(c("bs", `${chalk.blueBright("Booster")}`));
    console.log(c("bl", `${chalk.cyanBright("Blacklisted")}`));
    console.log(c("sl", `${chalk.magentaBright("Safelisted")}`));
    console.log("");
}

function showHelp() {
    console.log(chalk.blue.strikethrough("                                                            "));
    console.log(chalk.yellowBright("Available Commands:"));
    console.log(c(".h / .help", "Show help"));
    console.log(c(".dsc / .discord", "Show Discord URL"));
    console.log(c(".resync", "Resync custom tags"));
    console.log(c(".apikey", "Set api keys"));
    console.log("");
    tagHelp();
    availableTags();
    console.log("Found a bug, need support, or want custom tags?");
    console.log(chalk.blueBright("contact @unsnipeable"));
    console.log(chalk.redBright(`made by mtnk ${chalk.bold("<3")}`));
    console.log(chalk.blue.strikethrough("                                                            "));
}

function readList(file) {
    if (!fs.existsSync(file)) return [];
    return fs.readFileSync(file, "utf8").split("\n").filter(Boolean);
}

function c(a, b) {
    return chalk.gray("» ") + chalk.underline(a) + chalk.gray(": ") + b;
}
async function getUUID(username) {
    if (/^[0-9a-fA-F]{32}$/.test(username)) {
        return username;
    }
    const res = await axios.get(`https://api.mojang.com/users/profiles/minecraft/${username}`, {
        validateStatus: () => true
    });
    if (res.status === 204) {
        return null;
    }
    if (res.status !== 200) {
        return null;
    }
    return res.data.id;
}function isUUID32(str) {
    return /^[0-9a-fA-F]{32}$/.test(str);
}

function isUUID36(str) {
    return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(str);
}

function formatUuid(uuid) {
    if (uuid == null) {
        throw new Error("UUID is null or undefined");
    }

    const cleaned = String(uuid)
        .trim()
        .replace(/-/g, "")
        .toLowerCase();

    if (!/^[0-9a-f]{32}$/.test(cleaned)) {
        throw new Error(`Invalid UUID format: ${uuid.toString()}`);
    }

    return cleaned.replace(
        /^(.{8})(.{4})(.{4})(.{4})(.{12})$/,
        "$1-$2-$3-$4-$5"
    );
}
async function normalizeToUUID(input) {
    if (isUUID32(input)) {
        return input.toLowerCase();
    }

    if (isUUID36(input)) {
        return input.replace(/-/g, "").toLowerCase();
    }

    const uuid = await getUUID(input);
    return uuid ? uuid.replace(/-/g, "").toLowerCase() : null;
}
async function isInTagFile(type, input) {
    const file = tagFiles[type];
    if (!file) return false;
    const uuid = await normalizeToUUID(input);
    if (!uuid) return false;
    const fullPath = path.join(appDataPath, '.matankify', file);
    if (!fs.existsSync(fullPath)) return false;
    const lines = fs.readFileSync(fullPath, "utf8").split("\n").map(v => v.trim().toLowerCase()).filter(Boolean);
    return lines.includes(uuid);
}
let tagMapCache = null;
let lastFetch = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5分

const TAG_URL = "https://raw.githubusercontent.com/unsnipeable/custom-tags/refs/heads/main/tags";
async function loadTagMap() {
    const now = Date.now();

    if (tagMapCache && now - lastFetch < CACHE_TTL) {
        return tagMapCache;
    }

    const { data } = await axios.get(TAG_URL, {
        timeout: 5000
    });

    const map = new Map();

    const lines = data.split("\n")
        .map(line => line.trim())
        .filter(line => line && !line.startsWith("#"));

    for (const line of lines) {
        const parts = line.split(":");
        if (parts.length < 4) continue;

        const [uuid, text, tooltip, color, icon] = parts;

        const key = uuid.toLowerCase(); // ← await 必須
        if (!key) continue;

        if (!map.has(key)) {
            map.set(key, []);
        }

        const tagObject = {
            text,
            tooltip,
            color: Number(color)
        };

        if (icon) {
            tagObject.icon = icon;
        }

        map.get(key).push(tagObject);
    }

    tagMapCache = map;
    lastFetch = now;

    return map;
}


async function getTagReason(type, id) {
    const file = tagFiles[type];
    if (!file) return null;

    const fullPath = path.join(appDataPath, '.matankify', file)
    if (!fs.existsSync(fullPath)) return null;

    const lines = fs.readFileSync(fullPath, "utf8")
        .split("\n")
        .filter(Boolean);

    for (const line of lines) {
        const [uuid, reason = ""] = line.split(":");
        if (uuid.toLowerCase() === id.toLowerCase()) {
            return reason;
        }
    }

    return null;
}