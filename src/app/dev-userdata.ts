// Dev aid: HONYO_USER_DATA_DIR runs a second instance with its own config,
// cache and single-instance lock, side by side with an installed Honyo.
//
// Must be the FIRST import of main.ts: config/storage.ts resolves its file
// paths from app.getPath('userData') at module load time, so the override has
// to happen before any of those modules are evaluated.
import { app } from 'electron';

if (process.env.HONYO_USER_DATA_DIR) {
  app.setPath('userData', process.env.HONYO_USER_DATA_DIR);
}
