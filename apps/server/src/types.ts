import type { auth } from "@slushomat/auth";

type SessionResult = Awaited<
  ReturnType<typeof auth.api.getSession>
>;
type SessionData = NonNullable<SessionResult>;
type SessionUser = SessionData["user"];

export type AppEnv = {
  Variables: {
    user: SessionUser | null;
    session: SessionData | null;
    machineId?: string;
    requestId: string;
    logger: {
      info: (msg: string, meta?: object) => void;
      warn: (msg: string, meta?: object) => void;
      error: (msg: string, meta?: object) => void;
    };
  };
};
