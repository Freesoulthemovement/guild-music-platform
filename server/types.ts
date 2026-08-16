import { z } from "zod";

declare module "express-session" {
  interface SessionData {
    userId: number;
  }
}