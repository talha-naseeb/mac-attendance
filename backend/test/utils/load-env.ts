import * as path from 'path';
import * as dotenv from 'dotenv';

/**
 * Load `backend/.env` for local e2e runs. CI supplies the variables through the
 * job environment and has no `.env` file, so a missing file is not an error.
 * Values already present in the environment always win.
 */
export function loadEnvFile(): void {
  dotenv.config({ path: path.resolve(__dirname, '..', '..', '.env') });
}
