/// <reference types="vite/client" />
import { loadDevLogEntries } from "./dev-log";

const bundledEntries = import.meta.glob<string>("../data/dev-log/entries/*.md", { eager: true, query: "?raw", import: "default" });

export function loadDevLog() { return loadDevLogEntries(bundledEntries); }
