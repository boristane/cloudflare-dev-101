import type { GraphDatabase } from "./src/index";

export interface Bindings {
  GraphDatabase: DurableObjectNamespace<GraphDatabase>;
  ASSETS: Fetcher;
}
