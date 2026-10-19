import { loadStylesheet } from "../../core/ui/dom.js";
import { openLobby } from "../../core/ui/pvp-lobby.js";
import { runGuest } from "./guest.js";
import { runHost } from "./host.js";
import { messages } from "./i18n.js";

/** @type {import("../../core/registry.js").GameDefinition} */
export const tugOfWar = {
  id: "tug-of-war",
  titleKey: "tugOfWar.title",
  icon: "🪢",
  subject: "math",
  messages,
  mount(root, ctx) {
    loadStylesheet(new URL("./style.css", import.meta.url).href);
    const lobby = openLobby(root, { gameId: tugOfWar.id, arg: ctx.arg, t: ctx.t });
    let mounted = true;
    let stopMatch = () => {};
    lobby.connected.then(({ role, channel }) => {
      if (!mounted) return channel.close();
      stopMatch = (role === "host" ? runHost : runGuest)(root, ctx, channel);
    });
    return () => {
      mounted = false;
      stopMatch();
      lobby.close();
    };
  },
};
