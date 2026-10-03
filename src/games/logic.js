// Registry of game logic modules (pure JS, shared by phones and the Node simulator).
// Order here is the order games appear in the lobby.
import zinger from './zinger/logic.js';
import fib from './fib/logic.js';
import sketch from './sketch/logic.js';
import phone from './phone/logic.js';
import blend from './blend/logic.js';
import herd from './herd/logic.js';
import dial from './dial/logic.js';
import bomb from './bomb/logic.js';
import noon from './noon/logic.js';
import head from './head/logic.js';
import seat from './seat/logic.js';
import dead from './dead/logic.js';
import photo from './photo/logic.js';
import zoom from './zoom/logic.js';
import frank from './frank/logic.js';
import wanted from './wanted/logic.js';
import pull from './pull/logic.js';
import fraud from './fraud/logic.js';
import pants from './pants/logic.js';
import split from './split/logic.js';

export const GAME_LIST = [photo, wanted, pull, zoom, frank, zinger, fib, sketch, phone, dead, split, fraud, blend, pants, herd, seat, dial, bomb, noon, head];
export const GAMES = Object.fromEntries(GAME_LIST.map((g) => [g.id, g]));
