// Emoji flags, not image assets - zero licensing risk, matches Jupiter's
// reference use of flags next to market row names.
const FLAGS: Record<string, string> = {
  Argentina: "🇦🇷",
  Switzerland: "🇨🇭",
  France: "🇫🇷",
  Spain: "🇪🇸",
  England: "🏴",
  Vietnam: "🇻🇳",
  Myanmar: "🇲🇲",
};

export function teamFlag(name: string): string {
  return FLAGS[name] ?? "⚽";
}
