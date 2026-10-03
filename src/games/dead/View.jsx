import { useEffect, useRef, useState } from 'preact/hooks';
import { Timer, gsend, useFinalTicks, useNow, fmtScore, PlayerChip, WaitList } from '../../ui/common.jsx';
import { PlayerAvatar } from '../../ui/Avatar.jsx';
import { RoundHeader, useStepSound, Voters } from '../shared.jsx';
import { sfx } from '../../audio/sfx.js';
import { vibrate } from '../../platform.js';
import { SYMBOLS, EXIT, MEMORY_SHOW } from './logic.js';
import './dead.css';

function Ghosty({ p, dead, size = 36 }) {
  return (
    <span class={'dl-av' + (dead ? ' ghost' : '')}>
      <PlayerAvatar p={p} size={size} />
    </span>
  );
}

export default function DeadView({ s, g, me, role }) {
  useStepSound(g, { question: 'pop', qreveal: 'reveal', floor: 'heartbeat', floorResult: 'drumroll', finalIntro: 'bell', tfreveal: 'whoosh' });
  useFinalTicks(g, g.phase === 'question' || g.phase === 'tf' || (g.phase === 'floor' && g.f && g.f.kind !== 'taps'));
  const amDead = !!g.dead[me];
  const head = (
    <RoundHeader
      left={g.phase === 'tf' || g.phase === 'tfreveal' || g.phase === 'finalIntro' ? 'Final: escape the gym' : `Question ${Math.min(g.qn + 1, 7)} of 7`}
      right={amDead ? 'You are a ghost' : role === 'player' ? 'Still alive' : ''}
    />
  );
  switch (g.phase) {
    case 'question':
      return <Question s={s} g={g} me={me} role={role} head={head} />;
    case 'qreveal':
      return <QReveal s={s} g={g} me={me} head={head} />;
    case 'floor':
      return <Floor s={s} g={g} me={me} head={head} />;
    case 'floorResult':
      return <FloorResult s={s} g={g} me={me} head={head} />;
    case 'finalIntro':
    case 'tf':
    case 'tfreveal':
      return <Final s={s} g={g} me={me} role={role} head={head} />;
    default:
      return null;
  }
}

function Question({ s, g, me, role, head }) {
  const q = g.q;
  const mine = q.ans[me];
  return (
    <div class="screen">
      {head}
      <div class="dl-q pop-in" key={g.qn}>
        {q.q}
      </div>
      <Timer g={g} />
      <div class="dl-opts">
        {q.opts.map((o, i) => (
          <button
            key={i}
            class={'dl-opt' + (mine === i ? ' on' : '')}
            disabled={role !== 'player' || mine !== undefined}
            onClick={() => {
              sfx('pop');
              gsend({ t: 'ans', i });
            }}
          >
            <span class="dl-letter">{'ABCD'[i]}</span>
            <span>{o}</span>
          </button>
        ))}
      </div>
      <WaitList s={s} pids={g.pids} done={(p) => q.ans[p] !== undefined} size={32} />
    </div>
  );
}

function QReveal({ s, g, me, head }) {
  const q = g.q;
  const right = q.ans[me] === q.correct;
  const once = useRef(false);
  useEffect(() => {
    if (once.current) return;
    once.current = true;
    if (q.ans[me] !== undefined) sfx(right ? 'correct' : 'wrong');
  }, []);
  return (
    <div class="screen">
      {head}
      <div class="dl-q">{q.q}</div>
      <div class="dl-opts">
        {q.opts.map((o, i) => {
          const who = Object.entries(q.ans)
            .filter(([, v]) => v === i)
            .map(([p]) => p);
          return (
            <div key={i} class={'dl-opt static' + (i === q.correct ? ' right' : ' wrong')}>
              <span class="dl-letter">{'ABCD'[i]}</span>
              <span style={{ flex: 1 }}>{o}</span>
              <Voters s={s} ids={who} size={22} />
            </div>
          );
        })}
      </div>
      {q.wrong.length > 0 ? (
        <div class="dl-doom pop-in">
          <strong class="stencil">To the Killing Floor</strong>
          <div class="row wrap" style={{ justifyContent: 'center', gap: 8 }}>
            {q.wrong.map((p) => (
              <PlayerChip key={p} p={s.players[p]} size={26} />
            ))}
          </div>
        </div>
      ) : (
        <div class="dl-safe pop-in">Everyone alive got it. Nobody dies… yet.</div>
      )}
      {q.pts[me] > 0 && <div class="pts-banner pop-in">+{fmtScore(q.pts[me])}</div>}
    </div>
  );
}

function Floor({ s, g, me, head }) {
  const f = g.f;
  const victim = f.victims.includes(me);
  const title = { lockers: 'Pick a locker', math: 'Quick maths', memory: 'Memory reps', taps: 'Tap sprint' }[f.kind];
  return (
    <div class="screen dl-floor">
      {head}
      <div class="dl-floor-title pop-in">
        <span class="eyebrow" style={{ color: 'inherit' }}>
          The Killing Floor
        </span>
        <strong class="stencil">{title}</strong>
      </div>
      {victim && f.res[me] === undefined ? (
        f.kind === 'lockers' ? (
          <Lockers g={g} f={f} />
        ) : f.kind === 'math' ? (
          <MathGame g={g} f={f} />
        ) : f.kind === 'memory' ? (
          <Memory g={g} f={f} />
        ) : (
          <Taps g={g} f={f} />
        )
      ) : (
        <>
          <div class="label tight center-text">{victim ? 'Locked in. Pray.' : 'You answered right. Watch them sweat.'}</div>
          {f.kind !== 'taps' && <Timer g={g} />}
          <WaitList s={s} pids={f.victims} done={(p) => f.res[p] !== undefined} size={40} />
        </>
      )}
    </div>
  );
}

function Lockers({ g, f }) {
  return (
    <>
      <p class="center-text" style={{ margin: 0, fontWeight: 700 }}>
        One of these lockers is haunted. Choose wisely.
      </p>
      <Timer g={g} />
      <div class="dl-lockers">
        {Array.from({ length: f.n }).map((_, i) => (
          <button
            key={i}
            class="dl-locker"
            onClick={() => {
              sfx('slideDown');
              vibrate(40);
              gsend({ t: 'locker', i });
            }}
          >
            <span class="dl-vent" />
            <span class="dl-vent" />
            <span class="dl-num">{i + 1}</span>
          </button>
        ))}
      </div>
    </>
  );
}

function MathGame({ g, f }) {
  const [ans, setAns] = useState([]);
  const k = ans.length;
  const p = f.probs[k];
  const pick = (i) => {
    sfx('tap');
    const next = ans.concat([i]);
    setAns(next);
    if (next.length === f.probs.length) gsend({ t: 'math', a: next });
  };
  if (!p) return <div class="label tight center-text">Submitted…</div>;
  return (
    <>
      <Timer g={g} />
      <div class="dl-math pop-in" key={k}>
        <span class="eyebrow">
          Problem {k + 1} of {f.probs.length}
        </span>
        <strong class="game-font">
          {p.a} {p.op} {p.b} = ?
        </strong>
      </div>
      <div class="dl-opts grid2">
        {p.opts.map((o, i) => (
          <button key={i} class="dl-opt" onClick={() => pick(i)}>
            <span style={{ flex: 1, textAlign: 'center' }}>{o}</span>
          </button>
        ))}
      </div>
    </>
  );
}

function Memory({ g, f }) {
  const t = useNow(100);
  const [seq, setSeq] = useState([]);
  const showing = t - g.t0 < MEMORY_SHOW;
  const tap = (i) => {
    sfx('tap');
    const next = seq.concat([i]);
    setSeq(next);
    if (next.length === f.seq.length) gsend({ t: 'memory', seq: next });
  };
  return (
    <>
      <Timer g={g} />
      {showing ? (
        <div class="dl-mem-show pop-in">
          <span class="eyebrow">Memorize!</span>
          <div class="dl-seq">
            {f.seq.map((x, i) => (
              <span key={i} class="dl-sym">
                {SYMBOLS[x]}
              </span>
            ))}
          </div>
        </div>
      ) : (
        <>
          <div class="dl-seq entered">
            {f.seq.map((_, i) => (
              <span key={i} class={'dl-sym' + (seq[i] === undefined ? ' empty' : '')}>
                {seq[i] === undefined ? '' : SYMBOLS[seq[i]]}
              </span>
            ))}
          </div>
          <div class="dl-sym-pad">
            {SYMBOLS.map((sym, i) => (
              <button key={i} class="dl-sym-btn" onClick={() => tap(i)}>
                {sym}
              </button>
            ))}
          </div>
          {seq.length > 0 && (
            <button class="btn sm ghost" style={{ alignSelf: 'center' }} onClick={() => setSeq([])}>
              Start over
            </button>
          )}
        </>
      )}
    </>
  );
}

function Taps({ g, f }) {
  const t = useNow(80);
  const [n, setN] = useState(0);
  const count = useRef(0);
  const sent = useRef(false);
  const live = t >= f.goAt && t < f.goAt + f.window;
  const over = t >= f.goAt + f.window;
  useEffect(() => {
    if (over && !sent.current) {
      sent.current = true;
      gsend({ t: 'taps', n: count.current });
    }
  });
  const tap = (e) => {
    e.preventDefault();
    if (!live) return;
    count.current++;
    setN(count.current);
    if (count.current % 5 === 0) sfx('tick');
  };
  const left = Math.max(0, Math.ceil((f.goAt - t) / 1000));
  return (
    <>
      <div class="dl-tapbar">
        <div class="dl-tapfill" style={{ width: `${Math.min(100, (n / f.target) * 100)}%` }} />
        <span>
          {n} / {f.target}
        </span>
      </div>
      <button class={'dl-tapzone' + (live ? ' live' : '')} onPointerDown={tap}>
        {live ? 'TAP TAP TAP!' : over ? 'Done!' : `Get ready… ${left}`}
      </button>
    </>
  );
}

function FloorResult({ s, g, me, head }) {
  const f = g.f;
  const iDied = f.died.includes(me);
  const once = useRef(false);
  useEffect(() => {
    if (once.current) return;
    once.current = true;
    if (iDied) {
      sfx('boom');
      vibrate([300, 80, 300]);
    } else if (f.victims.includes(me)) sfx('fanfare');
  }, []);
  return (
    <div class="screen">
      {head}
      {f.kind === 'lockers' && (
        <div class="label tight center-text">
          The haunted locker was <strong>#{f.bad + 1}</strong>
        </div>
      )}
      {f.kind === 'memory' && (
        <div class="dl-seq">
          {f.seq.map((x, i) => (
            <span key={i} class="dl-sym">
              {SYMBOLS[x]}
            </span>
          ))}
        </div>
      )}
      <div class="col">
        {f.victims.map((pid) => {
          const died = f.died.includes(pid);
          return (
            <div class={'dl-fate pop-in' + (died ? ' dead' : ' alive')} key={pid}>
              <Ghosty p={s.players[pid]} dead={died} size={44} />
              <span class="nm">{s.players[pid] ? s.players[pid].name : '?'}</span>
              <strong class="stencil">{died ? 'Ghosted' : 'Survived'}</strong>
              {f.kind === 'taps' && <span class="small">{f.res[pid] || 0} taps</span>}
            </div>
          );
        })}
      </div>
      {iDied && <div class="dl-doom">You're a ghost now. Keep answering: ghosts still score, and you'll get a shot at the escape.</div>}
    </div>
  );
}

function Track({ s, g, me }) {
  return (
    <div class="dl-track">
      {g.pids
        .filter((p) => s.players[p])
        .map((pid) => (
          <div class="dl-lane" key={pid}>
            <span class="dl-lane-name">{s.players[pid].name}</span>
            <div class="dl-lane-track">
              {Array.from({ length: EXIT + 1 }).map((_, i) => (
                <span key={i} class={'dl-step' + (i === EXIT ? ' exit' : '')} />
              ))}
              <span class="dl-runner" style={{ left: `calc(${((g.pos[pid] || 0) / EXIT) * 100}% - ${((g.pos[pid] || 0) / EXIT) * 30}px)` }}>
                <Ghosty p={s.players[pid]} dead={!!g.dead[pid]} size={30} />
              </span>
            </div>
          </div>
        ))}
    </div>
  );
}

function Final({ s, g, me, role, head }) {
  const tf = g.tf;
  const mine = tf && tf.ans[me];
  return (
    <div class="screen">
      {head}
      {g.phase === 'finalIntro' ? (
        <div class="dl-doom pop-in">
          <strong class="stencil">Escape the gym!</strong>
          <span>True or false. Each right answer moves you one step closer to the exit. Ghosts start a step behind.</span>
        </div>
      ) : (
        <div class="dl-q pop-in" key={g.fr}>
          {tf.q}
        </div>
      )}
      {g.phase === 'tf' && (
        <>
          <Timer g={g} />
          <div class="dl-tf">
            {[true, false].map((v) => (
              <button
                key={String(v)}
                class={'dl-tf-btn ' + (v ? 't' : 'f') + (mine === v ? ' on' : '')}
                disabled={role !== 'player' || mine !== undefined}
                onClick={() => {
                  sfx('pop');
                  gsend({ t: 'tf', v });
                }}
              >
                {v ? 'True' : 'False'}
              </button>
            ))}
          </div>
        </>
      )}
      {g.phase === 'tfreveal' && (
        <div class={'dl-tf-answer pop-in ' + (tf.a ? 't' : 'f')}>
          {tf.a ? 'TRUE' : 'FALSE'}
          {tf.ans[me] !== undefined && <span class="small">{tf.ans[me] === tf.a ? ' · you move up!' : ' · you stay put'}</span>}
        </div>
      )}
      <Track s={s} g={g} me={me} />
    </div>
  );
}
