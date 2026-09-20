import { register } from "node:module";

register(new URL("./server-only-hooks.mjs", import.meta.url));
