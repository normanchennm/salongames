import type { Room } from "../types";
import { antiquarian } from "./antiquarian";
import { lastreservation } from "./lastreservation";

export const ROOMS: Room[] = [antiquarian, lastreservation];

export function getRoom(id: string): Room | undefined {
  return ROOMS.find((r) => r.id === id);
}
