import * as Cloudflare from "alchemy/Cloudflare";

import { APP_NAME } from "./utils";

export const VERSION_METADATA = Cloudflare.Workers.VersionMetadata(`${APP_NAME}-version-metadata`);
