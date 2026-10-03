// Registry of game screens (Preact components), keyed by game id.
import ZingerView from './zinger/View.jsx';
import FibView from './fib/View.jsx';
import SketchView from './sketch/View.jsx';
import PhoneView from './phone/View.jsx';
import BlendView from './blend/View.jsx';
import HerdView from './herd/View.jsx';
import DialView from './dial/View.jsx';
import BombView from './bomb/View.jsx';
import NoonView from './noon/View.jsx';
import HeadView from './head/View.jsx';
import SeatView from './seat/View.jsx';

export const VIEWS = {
  zinger: ZingerView,
  fib: FibView,
  sketch: SketchView,
  phone: PhoneView,
  blend: BlendView,
  herd: HerdView,
  dial: DialView,
  bomb: BombView,
  noon: NoonView,
  head: HeadView,
  seat: SeatView,
};
