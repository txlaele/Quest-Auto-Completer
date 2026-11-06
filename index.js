var QuestAutoCompleter = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // src/index.ts
  var index_exports = {};
  __export(index_exports, {
    default: () => index_default,
    settings: () => settings
  });
  function getGlobal() {
    return typeof globalThis !== "undefined" && globalThis || typeof window !== "undefined" && window || typeof global !== "undefined" && global || {};
  }
  var g = getGlobal();
  var clientMod = g.revenge || g.vendetta;
  function findByProps(...props) {
    const finder = clientMod?.modules?.findByProps || clientMod?.metro?.findByProps || clientMod?.modules?.finders?.findByProps;
    if (typeof finder === "function") {
      return finder(...props);
    }
    return null;
  }
  function findByStoreName(name) {
    const finder = clientMod?.modules?.findByStoreName || clientMod?.metro?.findByStoreName || clientMod?.modules?.finders?.findByStoreName;
    if (typeof finder === "function") {
      return finder(name);
    }
    return null;
  }
  function getFluxDispatcher() {
    return clientMod?.modules?.common?.FluxDispatcher || clientMod?.metro?.common?.FluxDispatcher || findByProps("dispatch", "subscribe");
  }
  function getStorageProxy(name, defaults) {
    try {
      if (clientMod?.storage?.createProxy) {
        return clientMod.storage.createProxy(defaults);
      }
      if (clientMod?.storage?.createStorage) {
        return clientMod.storage.createStorage(name, defaults);
      }
    } catch {
    }
    return defaults;
  }
  var pluginStorage = getStorageProxy("quest-auto-completer", {
    /** "parallel" = all quests at once, "sequential" = one at a time */
    mode: "parallel",
    /** Spoof Windows PC headers so Discord recognizes mobile as Desktop */
    spoofPC: true,
    /** Automatically enroll in active quests that haven't been started yet */
    autoEnroll: true
  });
  var settings = pluginStorage;
  var DESKTOP_SUPER_PROPERTIES = "eyJvcyI6IldpbmRvd3MiLCJicm93c2VyIjoiRGlzY29yZCBDbGllbnQiLCJyZWxlYXNlX2NoYW5uZWwiOiJzdGFibGUiLCJjbGllbnRfdmVyc2lvbiI6IjEuMC45MTc1Iiwib3NfdmVyc2lvbiI6IjEwLjAuMjI2MzEiLCJvc19hcmNoIjoieDY0IiwiYXBwX2FyY2giOiJ4NjQiLCJzeXN0ZW1fbG9jYWxlIjoiZW4tVVMiLCJicm93c2VyX3VzZXJfYWdlbnQiOiJNb3ppbGxhLzUuMCAoV2luZG93cyBOVCAxMC4wOyBXaW42NDsgeDY0KSBBcHBsZVdlYktpdC81MzcuMzYgKEtIVE1MLCBsaWtlIEdlY2tvKSBkaXNjb3JkLzEuMC45MTc1IENocm9tZS8xMjguMC42NjEzLjE4NiBFbGVjdHJvbi8zMi4yLjcgU2FmYXJpLzUzNy4zNiIsImJyb3dzZXJfdmVyc2lvbiI6IjMyLjIuNyIsImNsaWVudF9idWlsZF9udW1iZXIiOjM1NTAwMCwibmF0aXZlX2J1aWxkX251bWJlciI6bnVsbCwiY2xpZW50X2V2ZW50X3NvdXJjZSI6bnVsbH0=";
  var DESKTOP_USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) discord/1.0.9175 Chrome/128.0.6613.186 Electron/32.2.7 Safari/537.36";
  function getAuthToken() {
    const tokenModule = findByProps("getToken");
    return tokenModule?.getToken?.() ?? "";
  }
  async function discordApi(method, path, body) {
    const token = getAuthToken();
    const headers = {
      Authorization: token,
      "Content-Type": "application/json"
    };
    if (pluginStorage.spoofPC) {
      headers["X-Super-Properties"] = DESKTOP_SUPER_PROPERTIES;
      headers["User-Agent"] = DESKTOP_USER_AGENT;
      headers["X-Discord-Locale"] = "en-US";
      headers["Sec-Ch-Ua-Platform"] = '"Windows"';
    }
    const options = {
      method,
      headers
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
  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
  async function enrollQuest(questId) {
    try {
      await discordApi("POST", `/quests/${questId}/enroll`);
      console.log(`[QAC] Auto-enrolled in quest ${questId}`);
      return true;
    } catch (e) {
      console.warn(`[QAC] Failed to enroll in quest ${questId}:`, e);
      return false;
    }
  }
  async function getQuestProgress(questId) {
    try {
      const data = await discordApi("GET", `/quests/${questId}/progress`);
      return data?.progress?.PLAY_ON_DESKTOP?.value ?? data?.progress?.STREAM_ON_DESKTOP?.value ?? 0;
    } catch (e) {
      console.error("[QAC] Failed to get quest progress:", e);
      return 0;
    }
  }
  async function sendHeartbeat(questId, streamKey = null) {
    try {
      await discordApi("POST", `/quests/${questId}/heartbeat`, {
        stream_key: streamKey
      });
    } catch (e) {
      console.error("[QAC] Failed to send heartbeat:", e);
    }
  }
  async function processQuest(quest) {
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
      `[QAC] Starting quest ${quest.id} (${taskName}) [PC Spoofed: ${pluginStorage.spoofPC}] \u2014 ${secondsDone}/${secondsNeeded}s completed, ${remainingSeconds}s remaining (${totalHeartbeats} heartbeats).`
    );
    const FluxDispatcher = getFluxDispatcher();
    try {
      FluxDispatcher?.dispatch?.({
        type: "RUNNING_GAMES_CHANGE",
        removed: [],
        added: [{ id: applicationId, exePath: "C:\\Program Files\\Quest\\game.exe", name: "Quest" }],
        games: [{ id: applicationId, exePath: "C:\\Program Files\\Quest\\game.exe", name: "Quest" }]
      });
      if (isStream) {
        FluxDispatcher?.dispatch?.({
          type: "STREAM_START",
          streamType: "guild",
          guildId: null,
          channelId: null,
          pid: 0,
          sourceName: "Quest"
        });
      }
    } catch {
    }
    for (let i = 0; i < totalHeartbeats; i++) {
      if (!running) return;
      await sendHeartbeat(quest.id, streamKey);
      console.log(`[QAC] Heartbeat ${i + 1}/${totalHeartbeats} for quest ${quest.id}`);
      if (i < totalHeartbeats - 1) {
        await sleep(heartbeatInterval * 1e3);
      }
    }
    try {
      if (isStream) {
        FluxDispatcher?.dispatch?.({ type: "STREAM_STOP", streamType: "guild" });
      }
      FluxDispatcher?.dispatch?.({
        type: "RUNNING_GAMES_CHANGE",
        removed: [{ id: applicationId, exePath: "C:\\Program Files\\Quest\\game.exe", name: "Quest" }],
        added: [],
        games: []
      });
    } catch {
    }
    console.log(`[QAC] \u{1F389} Quest ${quest.id} completed!`);
  }
  async function fetchQuests() {
    try {
      const QuestsStore = findByStoreName("QuestsStore");
      if (QuestsStore?.quests?.size > 0) {
        return Array.from(QuestsStore.quests.values());
      }
    } catch {
    }
    try {
      console.log("[QAC] Fetching active quests from /quests/@me...");
      const res = await discordApi("GET", "/quests/@me");
      if (Array.isArray(res?.quests)) {
        return res.quests;
      }
    } catch (e) {
      console.error("[QAC] Failed to fetch /quests/@me:", e);
    }
    return [];
  }
  var running = false;
  async function startQuests() {
    if (running) {
      console.log("[QAC] Already running.");
      return;
    }
    running = true;
    try {
      await sleep(3e3);
      let quests = await fetchQuests();
      if (quests.length === 0) {
        for (let i = 0; i < 3 && quests.length === 0; i++) {
          console.log(`[QAC] Retrying quest fetch (${i + 1}/3)...`);
          await sleep(5e3);
          quests = await fetchQuests();
        }
      }
      if (quests.length === 0) {
        console.log("[QAC] No quests found.");
        return;
      }
      const validQuests = [];
      for (const q of quests) {
        if (q.user_status?.completed_at !== null) continue;
        if (q.user_status?.enrolled_at === null) {
          if (pluginStorage.autoEnroll) {
            const enrolled = await enrollQuest(q.id);
            if (enrolled) {
              q.user_status.enrolled_at = (/* @__PURE__ */ new Date()).toISOString();
              validQuests.push(q);
            }
          }
        } else {
          validQuests.push(q);
        }
      }
      validQuests.sort(
        (a, b) => new Date(a.user_status.expires_at).getTime() - new Date(b.user_status.expires_at).getTime()
      );
      const supported = validQuests.filter(
        (q) => q.config?.taskConfig?.taskName === "PLAY_ON_DESKTOP" || q.config?.taskConfig?.taskName === "STREAM_ON_DESKTOP"
      );
      if (supported.length === 0) {
        console.log("[QAC] No supported quests found to process.");
        return;
      }
      console.log(
        `[QAC] Processing ${supported.length} quest(s) in "${pluginStorage.mode}" mode (Desktop spoof: ${pluginStorage.spoofPC}).`
      );
      if (pluginStorage.mode === "parallel") {
        await Promise.all(supported.map((q) => processQuest(q)));
      } else {
        for (const q of supported) {
          if (!running) break;
          await processQuest(q);
        }
      }
      console.log("[QAC] \u{1F389} All quests finished processing.");
    } catch (e) {
      console.error("[QAC] Unexpected error:", e);
    } finally {
      running = false;
    }
  }
  var plugin = {
    onLoad() {
      console.log("[QAC] Quest Auto Completer loaded (PC Spoofing enabled).");
      startQuests();
    },
    onUnload() {
      console.log("[QAC] Quest Auto Completer unloaded.");
      running = false;
    },
    settings
  };
  var index_default = plugin;
  return __toCommonJS(index_exports);
})();
if (typeof module !== 'undefined' && module.exports) { module.exports = QuestAutoCompleter.default || QuestAutoCompleter; }
