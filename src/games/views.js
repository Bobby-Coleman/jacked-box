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
import DeadView from './dead/View.jsx';
import PhotoView from './photo/View.jsx';
import ZoomView from './zoom/View.jsx';
import FrankView from './frank/View.jsx';
import WantedView from './wanted/View.jsx';
import PullView from './pull/View.jsx';
import FraudView from './fraud/View.jsx';
import PantsView from './pants/View.jsx';
import SplitView from './split/View.jsx';

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
  dead: DeadView,
  photo: PhotoView,
  zoom: ZoomView,
  frank: FrankView,
  wanted: WantedView,
  pull: PullView,
  fraud: FraudView,
  pants: PantsView,
  split: SplitView,
};
