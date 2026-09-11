// Biome selects the staged files itself (`--staged`) instead of taking them as
// arguments: on Windows a 120-file commit blows past the 8191-character command
// line limit and the hook dies with "The command line is too long."
const command = () => "biome check --staged --write --no-errors-on-unmatched";

export default {
  "*.{js,jsx,ts,tsx,mjs,cjs,json,jsonc,css}": command,
};
