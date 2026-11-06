import esbuild from "esbuild";

await esbuild.build({
    entryPoints: ["src/index.ts"],
    bundle: true,
    outfile: "index.js",
    format: "iife",
    globalName: "QuestAutoCompleter",
    footer: {
        js: `
if (typeof module !== "undefined" && module.exports) {
    module.exports = QuestAutoCompleter.default || QuestAutoCompleter;
}
return QuestAutoCompleter.default || QuestAutoCompleter;
`.trim(),
    },
    minify: false,
    target: "es2020",
});

console.log("Build successful: index.js created.");
