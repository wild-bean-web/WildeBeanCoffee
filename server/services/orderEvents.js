import { EventEmitter } from "events";

/** Shared bus for order lifecycle (kitchen SSE, webhooks, etc.). */
export const orderEventEmitter = new EventEmitter();
