// ─── Revenge / Vendetta Runtime Resolver ──────────────────────────────────────

function getGlobal(): any {
    return (
        (typeof globalThis !== "undefined" && globalThis) ||
        (typeof window !== "undefined" && window) ||
        (typeof global !== "undefined" && global) ||
        {}
    );
}

const g = getGlobal();
const clientMod = g.revenge || g.vendetta;

function findByProps(...props: string[]): any {
    const finder =
        clientMod?.modules?.findByProps ||
        clientMod?.metro?.findByProps ||
        clientMod?.modules?.finders?.findByProps;
    if (typeof finder === "function") {
        return finder(...props);
    }
    return null;
}

function findByStoreName(name: string): any {
    const finder =
        clientMod?.modules?.findByStoreName ||
        clientMod?.metro?.findByStoreName ||
        clientMod?.modules?.finders?.findByStoreName;
    if (typeof finder === "function") {
        return finder(name);
    }
    return null;
}

function getFluxDispatcher(): any {
    return (
        clientMod?.modules?.common?.FluxDispatcher ||
        clientMod?.metro?.common?.FluxDispatcher ||
        findByProps("dispatch", "subscribe")
    );
}

function getStorageProxy(name: string, defaults: any): any {
    try {
        if (clientMod?.storage?.createProxy) {
            return clientMod.storage.createProxy(defaults);
        }
        if (clientMod?.storage?.createStorage) {
            return clientMod.storage.createStorage(name, defaults);
        }
    } catch {
        // fallback
    }
    return defaults;
}

// ─── Settings ────────────────────────────────────────────────────────────────

const pluginStorage = getStorageProxy("quest-auto-completer", {
    /** "parallel" = all quests at once, "sequential" = one at a time */
    mode: "parallel" as "parallel" | "sequential",
    /** Spoof Windows PC headers so Discord recognizes mobile as Desktop */
    spoofPC: true,
    /** Automatically enroll in active quests that haven't been started yet */
    autoEnroll: true,
});

export const settings = pluginStorage;

// ─── Desktop Spoofing Constants ──────────────────────────────────────────────

/**
 * Base64-encoded Discord Windows Desktop Super Properties (Discord Client on Windows 10 x64)
 */
const DESKTOP_SUPER_PROPERTIES =
    "eyJvcyI6IldpbmRvd3MiLCJicm93c2VyIjoiRGlzY29yZCBDbGllbnQiLCJyZWxlYXNlX2NoYW5uZWwiOiJzdGFibGUiLCJjbGllbnRfdmVyc2lvbiI6IjEuMC45MTc1Iiwib3NfdmVyc2lvbiI6IjEwLjAuMjI2MzEiLCJvc19hcmNoIjoieDY0IiwiYXBwX2FyY2giOiJ4NjQiLCJzeXN0ZW1fbG9jYWxlIjoiZW4tVVMiLCJicm93c2VyX3VzZXJfYWdlbnQiOiJNb3ppbGxhLzUuMCAoV2luZG93cyBOVCAxMC4wOyBXaW42NDsgeDY0KSBBcHBsZVdlYktpdC81MzcuMzYgKEtIVE1MLCBsaWtlIEdlY2tvKSBkaXNjb3JkLzEuMC45MTc1IENocm9tZS8xMjguMC42NjEzLjE4NiBFbGVjdHJvbi8zMi4yLjcgU2FmYXJpLzUzNy4zNiIsImJyb3dzZXJfdmVyc2lvbiI6IjMyLjIuNyIsImNsaWVudF9idWlsZF9udW1iZXIiOjM1NTAwMCwibmF0aXZlX2J1aWxkX251bWJlciI6bnVsbCwiY2xpZW50X2V2ZW50X3NvdXJjZSI6bnVsbH0=";

const DESKTOP_USER_AGENT =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) discord/1.0.9175 Chrome/128.0.6613.186 Electron/32.2.7 Safari/537.36";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Quest {
    id: string;
    config: {
        configVersion: number;
        questId: string;
        messages: Record<string, unknown>;
        applicationId: string;
        instructionsLink: string;
        taskConfig: {
            tasks: Record<string, unknown>;
            taskName: string;
            target: number;
        };
        rewards: Array<{
            type: number;
            codes_remaining: number;
            asset: string;
            sku_id: string;
        }>;
        colors: {
            primary: string;
            secondary: string;
        };
    };
    user_status: {
        completed_at: string | null;
        enrolled_at: string | null;
        expires_at: string;
    };
    targeted_content: unknown[];
    preview: boolean;
}

// ─── Discord API Helper with PC Spoofing ─────────────────────────────────────

function getAuthToken(): string {
    const tokenModule = findByProps("getToken");
    return tokenModule?.getToken?.() ?? "";
}

async function discordApi(
    method: "GET" | "POST",
    path: string,
    body?: Record<string, unknown>,
): Promise<any> {
    const token = getAuthToken();
    const headers: Record<string, string> = {
        Authorization: token,
        "Content-Type": "application/json",
    };

    if (pluginStorage.spoofPC) {
        headers["X-Super-Properties"] = DESKTOP_SUPER_PROPERTIES;
        headers["User-Agent"] = DESKTOP_USER_AGENT;
        headers["X-Discord-Locale"] = "en-US";
        headers["Sec-Ch-Ua-Platform"] = '"Windows"';
    }

    const options: RequestInit = {
        method,
        headers,
    };
    if (body) {
        options.body = JSON.stringify(body);
    }

    const res = await fetch(`https://discord.com/api/v9${path}`, options);
    if (!res.ok) {
        throw new Error(`[QAC] API ${method} ${path} failed: ${res.status}`);
    }
    const text = await res.text();
    return text ? JSON.parse(text) : null;
}

// ─── Quest Helpers ───────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function enrollQuest(questId: string): Promise<boolean> {
    try {
        await discordApi("POST", `/quests/${questId}/enroll`);
        console.log(`[QAC] Auto-enrolled in quest ${questId}`);
        return true;
    } catch (e) {
        console.warn(`[QAC] Failed to enroll in quest ${questId}:`, e);
        return false;
    }
}

async function getQuestProgress(questId: string): Promise<number> {
    try {
        const data = await discordApi("GET", `/quests/${questId}/progress`);
        return (
            data?.progress?.PLAY_ON_DESKTOP?.value ??
            data?.progress?.STREAM_ON_DESKTOP?.value ??
            0
        );
    } catch (e) {
        console.error("[QAC] Failed to get quest progress:", e);
        return 0;
    }
}

async function sendHeartbeat(
    questId: string,
    streamKey: string | null = null,
): Promise<void> {
    try {
        await discordApi("POST", `/quests/${questId}/heartbeat`, {
            stream_key: streamKey,
        });
    } catch (e) {
        console.error("[QAC] Failed to send heartbeat:", e);
    }
}

// ─── Quest Processor ─────────────────────────────────────────────────────────

async function processQuest(quest: Quest): Promise<void> {
    const taskName = quest.config.taskConfig.taskName;
    const applicationId = quest.config.applicationId;
    const secondsNeeded = quest.config.taskConfig.target;
    const secondsDone = await getQuestProgress(quest.id);

    if (secondsDone >= secondsNeeded) {
        console.log(`[QAC] Quest ${quest.id} is already completed.`);
        return;
    }

    const remainingSeconds = secondsNeeded - secondsDone;
    const heartbeatInterval = 20;
    const totalHeartbeats = Math.ceil(remainingSeconds / heartbeatInterval);
    const isStream = taskName === "STREAM_ON_DESKTOP";
    const streamKey = isStream ? `call:quest-voice::${applicationId}` : null;

    console.log(
        `[QAC] Starting quest ${quest.id} (${taskName}) [PC Spoofed: ${pluginStorage.spoofPC}] — ` +
        `${secondsDone}/${secondsNeeded}s completed, ${remainingSeconds}s remaining (${totalHeartbeats} heartbeats).`,
    );

    const FluxDispatcher = getFluxDispatcher();

    // Dispatch running games & stream (best-effort)
    try {
        FluxDispatcher?.dispatch?.({
            type: "RUNNING_GAMES_CHANGE",
            removed: [],
            added: [{ id: applicationId, exePath: "C:\\Program Files\\Quest\\game.exe", name: "Quest" }],
            games: [{ id: applicationId, exePath: "C:\\Program Files\\Quest\\game.exe", name: "Quest" }],
        });

        if (isStream) {
            FluxDispatcher?.dispatch?.({
                type: "STREAM_START",
                streamType: "guild",
                guildId: null,
                channelId: null,
                pid: 0,
                sourceName: "Quest",
            });
        }
    } catch {
        // ignored
    }

    // Heartbeat loop
    for (let i = 0; i < totalHeartbeats; i++) {
        if (!running) return;
        await sendHeartbeat(quest.id, streamKey);
        console.log(`[QAC] Heartbeat ${i + 1}/${totalHeartbeats} for quest ${quest.id}`);
        if (i < totalHeartbeats - 1) {
            await sleep(heartbeatInterval * 1000);
        }
    }

    // Cleanup Flux dispatches
    try {
        if (isStream) {
            FluxDispatcher?.dispatch?.({ type: "STREAM_STOP", streamType: "guild" });
        }
        FluxDispatcher?.dispatch?.({
            type: "RUNNING_GAMES_CHANGE",
            removed: [{ id: applicationId, exePath: "C:\\Program Files\\Quest\\game.exe", name: "Quest" }],
            added: [],
            games: [],
        });
    } catch {
        // ignored
    }

    console.log(`[QAC] 🎉 Quest ${quest.id} completed!`);
}

// ─── Fetch Quests ────────────────────────────────────────────────────────────

async function fetchQuests(): Promise<Quest[]> {
    try {
        const QuestsStore = findByStoreName("QuestsStore");
        if (QuestsStore?.quests?.size > 0) {
            return Array.from(QuestsStore.quests.values()) as Quest[];
        }
    } catch {
        // fallback to direct API
    }

    try {
        console.log("[QAC] Fetching active quests from /quests/@me...");
        const res = await discordApi("GET", "/quests/@me");
        if (Array.isArray(res?.quests)) {
            return res.quests as Quest[];
        }
    } catch (e) {
        console.error("[QAC] Failed to fetch /quests/@me:", e);
    }

    return [];
}

// ─── Orchestrator ────────────────────────────────────────────────────────────

let running = false;

async function startQuests(): Promise<void> {
    if (running) {
        console.log("[QAC] Already running.");
        return;
    }
    running = true;

    try {
        await sleep(3000);

        let quests = await fetchQuests();

        if (quests.length === 0) {
            for (let i = 0; i < 3 && quests.length === 0; i++) {
                console.log(`[QAC] Retrying quest fetch (${i + 1}/3)...`);
                await sleep(5000);
                quests = await fetchQuests();
            }
        }

        if (quests.length === 0) {
            console.log("[QAC] No quests found.");
            return;
        }

        const validQuests: Quest[] = [];

        for (const q of quests) {
            if (q.user_status?.completed_at !== null) continue;

            if (q.user_status?.enrolled_at === null) {
                if (pluginStorage.autoEnroll) {
                    const enrolled = await enrollQuest(q.id);
                    if (enrolled) {
                        q.user_status.enrolled_at = new Date().toISOString();
                        validQuests.push(q);
                    }
                }
            } else {
                validQuests.push(q);
            }
        }

        validQuests.sort(
            (a, b) =>
                new Date(a.user_status.expires_at).getTime() -
                new Date(b.user_status.expires_at).getTime(),
        );

        const supported = validQuests.filter(
            (q) =>
                q.config?.taskConfig?.taskName === "PLAY_ON_DESKTOP" ||
                q.config?.taskConfig?.taskName === "STREAM_ON_DESKTOP",
        );

        if (supported.length === 0) {
            console.log("[QAC] No supported quests found to process.");
            return;
        }

        console.log(
            `[QAC] Processing ${supported.length} quest(s) in "${pluginStorage.mode}" mode (Desktop spoof: ${pluginStorage.spoofPC}).`,
        );

        if (pluginStorage.mode === "parallel") {
            await Promise.all(supported.map((q) => processQuest(q)));
        } else {
            for (const q of supported) {
                if (!running) break;
                await processQuest(q);
            }
        }

        console.log("[QAC] 🎉 All quests finished processing.");
    } catch (e) {
        console.error("[QAC] Unexpected error:", e);
    } finally {
        running = false;
    }
}

// ─── Plugin Object ───────────────────────────────────────────────────────────

const plugin = {
    onLoad() {
        console.log("[QAC] Quest Auto Completer loaded (PC Spoofing enabled).");
        startQuests();
    },
    onUnload() {
        console.log("[QAC] Quest Auto Completer unloaded.");
        running = false;
    },
    settings,
};

export default plugin;
