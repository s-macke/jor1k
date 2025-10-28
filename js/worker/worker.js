// -------------------------------------------------
// -------------------- Worker ---------------------
// -------------------------------------------------

import message from './messagehandler.js';
import System from './system.js';

new System();
message.Send("WorkerReady", 0);
