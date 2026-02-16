import mongoose from "mongoose";

import { env } from "@/lib/env";

declare global {
  // eslint-disable-next-line no-var
  var mongooseConn: Promise<typeof mongoose> | undefined;
}

export async function connectToDatabase() {
  if (!global.mongooseConn) {
    global.mongooseConn = mongoose.connect(env.MONGODB_URI, {
      dbName: "docverctl"
    });
  }

  return global.mongooseConn;
}
