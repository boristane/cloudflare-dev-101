import type { DurableDatabase } from "./src/index.ts";

export type Bindings = {
  DurableDatabase: DurableObjectNamespace<DurableDatabase>;
};
