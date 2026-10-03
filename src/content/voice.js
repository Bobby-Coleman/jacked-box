// BOXTER's lines. BOXTER is the host: a cardboard box who discovered the gym.
// Each key has variants; the host picks one so every phone captions the same line.
// Pre-rendered audio lives at /voice/<key>-<index>.mp3 (see scripts/gen-voice.mjs);
// if a file is missing the speaker phone falls back to its built-in voice.
export const LINES = {
  'room.welcome': [
    "Welcome to Jacked Box! I'm Boxter. Get your friends in here. The code is on your screen.",
    "Boxter here, fully pumped. Tell your friends the room code and let's get this party lifted.",
  ],
  'room.pick': [
    'Pick a game, V.I.P. Everybody is waiting. No pressure.',
    "V.I.P., the games are on your phone. Choose wisely. Or don't. I'm a box.",
  ],
  'results.winner': [
    "And there's our champion! Take a bow. Or flex. Flexing is also acceptable.",
    'We have a winner! Everyone else, hit the showers.',
    'Winner, winner! I would hug you, but I have no arms. Just cardboard and dreams.',
  ],
  'gen.hurry': ['Ten seconds left!', 'Ten seconds! Hurry it up!', 'Clock is ticking. Ten seconds!'],
  'gen.timeup': ["Time's up!", 'Pencils down! Phones down! Everything down!'],
  'gen.scores': ["Let's check the scoreboard.", "Here's how everybody's doing."],
  'gen.lastround': ['Last round! Make it count.', 'Final round. Leave it all on the mat.'],

  // Zinger Ring
  'zinger.intro': [
    "Welcome to Zinger Ring! Two answers enter the ring. One answer leaves. Write the funniest thing you can think of, then vote for your favorite.",
    "This is Zinger Ring! I give you prompts, you write zingers, and your answers fight head to head. Most votes wins the bout.",
  ],
  'zinger.write': ['Gloves on! Write your answers now.', 'Get typing. Be funny. No pressure.', 'Answer your prompts! Funniest wins.'],
  'zinger.round2': ['Round two! Every point is doubled.', 'Round two. Double points. Double the pain.'],
  'zinger.vote': ['Vote for your favorite!', 'Which one hits harder? Vote!', 'Pick a winner!'],
  'zinger.ko': ['Zinger! Total knockout!', 'Knockout! That one got every vote!', 'Flawless victory! A clean sweep!'],
  'zinger.jinx': ['Jinx! Same answer. Nobody scores.', 'Jinx! Great minds think alike. Boring minds too.'],
  'zinger.final': ['Final round! Everybody answers the same prompt.', "It's the final round. One prompt. Everybody's in the ring."],
  'zinger.finalvote': ['Pick your two favorites. You cannot vote for yourself. I checked.'],

  // Fib Factory
  'fib.intro': [
    "Welcome to the Fib Factory, where we manufacture lies! I show you a weird fact with a blank. Write a fake answer that fools your friends. Then find the truth.",
    "Fib Factory is open! Fill in the blank with a lie so good your friends pick it. Then try to spot the real answer.",
  ],
  'fib.lie': ['Write a believable lie.', 'Make something up. Make it convincing.', 'Lie to your friends. I believe in you.'],
  'fib.choose': ['Now find the truth.', 'One of these is real. Which one?', 'Pick the truth. Avoid the lies.'],
  'fib.truth': ['And the truth is...', 'The real answer is...', 'Believe it or not, the truth is...'],
  'fib.nobody': ['Nobody found the truth. Embarrassing for everyone.', 'Wow. Not one of you. Incredible.'],
  'fib.about': ["This one's about one of you.", 'Time to get personal.'],
  'fib.round2': ['Round two! Points are doubled.'],
  'fib.final': ['Final fib! Triple points!'],

  // Sketchy
  'sketch.intro': [
    "Welcome to Sketchy! Everybody draws a weird prompt. Then you write fake titles for each drawing, and try to find the real one.",
    "This is Sketchy. Draw your secret prompt, then fool everyone with fake titles for each other's art.",
  ],
  'sketch.draw': ['Draw it! Masterpieces only. Or not.', 'Start drawing! Stick figures are welcome.', 'Get sketching!'],
  'sketch.title': ['What is this? Write a fake title.', 'Make up a title for this masterpiece.', 'Give this art a fake name.'],
  'sketch.choose': ['Which title is real?', 'Find the real title.', 'Which one was the artist going for?'],
  'sketch.reveal': ['The artist was going for...', 'The real title is...'],

  // Telephoney
  'phone.intro': [
    "This is Telephoney! Write something weird. Then you'll draw what someone else wrote, and describe what someone else drew. Watch it all fall apart.",
    "Welcome to Telephoney! Write, draw, guess, repeat. At the end we see how badly your message got mangled.",
  ],
  'phone.write': ['Write a weird sentence.', 'Write something strange for someone else to draw.'],
  'phone.draw': ['Draw what you see.', 'Draw it! Quickly!', 'Turn those words into art.'],
  'phone.guess': ['What is this drawing? Describe it.', 'Describe this drawing in a few words.'],
  'phone.reveal': ["Let's see how badly this went.", 'Time to see what happened.', 'Roll the tape!'],

  // Blend In
  'blend.intro': [
    "Blend In! Everyone gets the secret word, except the Chameleon. Go around the table and say one word about it. Then find who's faking.",
    "Welcome to Blend In. One of you is the Chameleon and has no idea what the secret word is. Give one-word clues, and catch the faker.",
  ],
  'blend.card': ['Check your phone. Do not let anyone see it.', 'Look at your card. Keep a straight face.'],
  'blend.clues': ['Clue time! One word each. Follow the order on your phone.', 'Go around the table. One word each. Not too obvious!'],
  'blend.discuss': ["Who's faking it? Talk it out.", 'Discuss! Someone here is lying.', 'Accuse your friends. Politely.'],
  'blend.vote': ['Vote now! Who is the Chameleon?', 'Point the finger! Vote on your phone.'],
  'blend.caught': ['Caught you! But can you guess the word?', 'Busted! Chameleon, one last chance. Guess the word.'],
  'blend.escaped': ['The Chameleon got away!', 'Nope! Wrong person. The Chameleon escapes!'],
  'blend.win': ['The Chameleon guessed it! Sneaky.', 'Unbelievable. The Chameleon knew all along.'],
  'blend.lose': ['Wrong word! The table wins this round.', "The Chameleon had no clue. Table wins!"],

  // Mind Dial
  'dial.intro': [
    'Mind Dial! One psychic sees a hidden target on a dial. They give a clue. Everyone else turns their dial to match. Closer is better.',
    "This is Mind Dial. The psychic knows where the target is. Read their mind, using only their clue.",
  ],
  'dial.clue': ['Psychic, give us a clue.', "Psychic's turn. Think of a clue."],
  'dial.guess': ['Turn your dial!', "Read the psychic's mind!", 'Lock in your guess!'],
  'dial.bullseye': ['Bullseye! Get out of my head!', 'Bullseye! Spooky.'],
  'dial.reveal': ["Let's see where it was.", 'Spinning the dial...'],

  // Moojority
  'herd.intro': [
    'Moojority! Answer like the herd. Match the most popular answer and you earn a cow. Be the only odd one out, and you get stuck with the odd cow.',
    "This is Moojority. Don't be original. Be popular. Match the herd and win cows.",
  ],
  'herd.answer': ['Think like the herd.', 'What would everyone else say?', "Don't be clever. Be normal."],
  'herd.reveal': ["Let's see what the herd said.", 'Moo-ment of truth!'],
  'herd.odd': ['Uh oh. Someone gets the odd cow.', 'Odd one out! Here is your cow. Do not love it.'],
  'herd.tie': ['A tie! No cows for anybody.', 'The herd is split. No cows this time.'],

  // Tick Tock Boom
  'bomb.intro': [
    "Tick Tock Boom! Put your phones face up on the table. When the bomb is on your phone, shout an answer, then tap to pass it. Don't be holding it when it blows!",
    'Phones on the table, everybody! When the bomb lands on your phone, shout something that fits the category and tap to throw it away.',
  ],
  'bomb.start': ['The fuse is lit!', 'Here we go!', 'Bomb is live!'],
  'bomb.boom': ['Boom! Somebody blew up.', 'Kaboom!', 'That one had your name on it.'],
  'bomb.next': ['New category. New fuse.', "Let's go again."],

  // High Noon
  'noon.intro': [
    'High Noon! Put your phone on the table and take your hands off it. When your screen says draw, tap it as fast as you can. Tap too early and you lose.',
    "This is High Noon, partner. Phones down, hands off. Wait for the word draw. Anything else is a trick.",
  ],
  'noon.ready': ['Hands off your phones...', 'Steady...', 'Nobody move...'],
  'noon.early': ['Too early, partner.', 'Twitchy trigger finger!'],
  'noon.winner': ['Fastest hand in the west!', 'Now that is a quick draw.'],

  // Forehead
  'head.intro': [
    'Forehead! The guesser holds their phone on their forehead. Everyone else shouts clues. Tap got it or pass on your own phone.',
    "Welcome to Forehead. Phone on your head, screen facing out. Your friends will help. Probably.",
  ],
  'head.next': ['Next guesser! Phone on your forehead.', "You're up! Phone on your forehead."],
  'head.go': ['Go go go!', 'Start shouting!', 'Clues! Now!'],
  'head.time': ["Time's up!", 'Phones down!'],
};
