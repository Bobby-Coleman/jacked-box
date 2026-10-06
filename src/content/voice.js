// BOXTER's lines. BOXTER is the host: a cardboard box who discovered the gym.
// Each key has variants; the host picks one so every phone captions the same line.
// Pre-rendered audio lives at /voice/<key>-<index>.mp3 (see scripts/gen-voice.mjs);
// if a file is missing the speaker phone falls back to its built-in voice.
export const LINES = {
  'room.welcome': [
    "Welcome to RiffRaff! I'm Boxter, your host. Get your friends in here. The code is on your screen.",
    "Boxter here, fully pumped. Tell your friends the room code and let's get this party lifted.",
  ],
  'room.pick': [
    'Pick a game, V.I.P. Everybody is waiting. No pressure.',
    "V.I.P., the games are on your phone. Choose wisely. Or don't. [chuckle] I'm a box.",
  ],
  'results.champ': [
    '{name}, you win! Take a bow. Or flex. Flexing is also acceptable.',
    'We have a winner! Give it up for {name}!',
    'Winner, winner! I would hug you, but I have no arms. Congratulations, {name}!',
  ],
  'results.winner': [
    "And there's our champion! Take a bow. Or flex. Flexing is also acceptable.",
    'We have a winner! Everyone else, hit the showers.',
    'Winner, winner! [laugh] I would hug you, but I have no arms. Just cardboard and dreams.',
  ],
  'gen.hurry': ['Ten seconds left!', 'Ten seconds! Hurry it up!', 'Clock is ticking. Ten seconds!'],
  'gen.timeup': ["Time's up!", 'Pencils down! Phones down! Everything down!'],
  'gen.scores': ["Let's check the scoreboard.", "Here's how everybody's doing."],
  // Said the moment a game starts, after the rules.
  'gen.go': ["Ready? It's go time!"],
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
  'zinger.jinx': ['Jinx! Same answer. Nobody scores.', 'Jinx! Great minds think alike. [chuckle] Boring minds too.'],
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
  'fib.nobody': ['Nobody found the truth. Embarrassing for everyone.', '[sigh] Wow. Not one of you. Incredible.'],
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
  'blend.first': ['{name}, you go first. Give us a clue!', 'First clue comes from {name}.'],
  'blend.turn': ['{name}!', '{name}, you are up.', 'Over to you, {name}.'],
  'blend.discuss': ["Who's faking it? Talk it out.", 'Discuss! Someone here is lying.', 'Accuse your friends. Politely.'],
  'blend.vote': ['Vote now! Who is the Chameleon?', 'Point the finger! Vote on your phone.'],
  'blend.caught': ['Caught you! But can you guess the word?', 'Busted! Chameleon, one last chance. Guess the word.'],
  'blend.escaped': ['The Chameleon got away!', 'Nope! Wrong person. The Chameleon escapes!'],
  'blend.win': ['The Chameleon guessed it! Sneaky.', '[gasp] Unbelievable. The Chameleon knew all along.'],
  'blend.lose': ['Wrong word! The table wins this round.', "The Chameleon had no clue. Table wins!"],

  // Mind Dial
  'dial.intro': [
    'Mind Dial! One psychic sees a hidden target on a dial. They give a clue. Everyone else turns their dial to match. Closer is better.',
    "This is Mind Dial. The psychic knows where the target is. Read their mind, using only their clue.",
  ],
  'dial.clue': ['{name}, you are the psychic. Give us a clue.', "Psychic's turn. Think of a clue, {name}."],
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
  'herd.odd': ['Odd one out! The cow goes to {name}.', '{name}, here is your cow. Do not love it.', 'Uh oh. Somebody gets the odd cow. That somebody is {name}.'],
  'herd.tie': ['A tie! No cows for anybody.', 'The herd is split. No cows this time.'],

  // Tick Tock Boom
  'bomb.intro': [
    "Tick Tock Boom! Put your phones face up on the table. When the bomb is on your phone, shout an answer, then tap to pass it. Don't be holding it when it blows!",
    'Phones on the table, everybody! When the bomb lands on your phone, shout something that fits the category and tap to throw it away.',
  ],
  'bomb.start': ['The fuse is lit!', 'Here we go!', 'Bomb is live!'],
  'bomb.boom': ['Kaboom! Sorry, {name}.', 'Boom! That one had your name on it, {name}.', '{name}, you blew up!'],
  'bomb.next': ['New category. New fuse.', "Let's go again."],

  // High Noon
  'noon.intro': [
    'High Noon! Put your phone on the table and take your hands off it. When your screen says draw, tap it as fast as you can. Tap too early and you lose.',
    "This is High Noon, partner. Phones down, hands off. Wait for the word draw. Anything else is a trick.",
  ],
  'noon.ready': ['Hands off your phones...', 'Steady...', 'Nobody move...'],
  'noon.early': ['Too early, partner.', 'Twitchy trigger finger!'],
  'noon.winner': ['Fastest hand in the west: {name}!', '{name}, you win the draw! Now that is a quick draw.'],

  // Dead Lift
  'dead.intro': [
    "Welcome to Dead Lift, the haunted gym where wrong answers are fatal. Get a question wrong and you go to the killing floor.",
    'This is Dead Lift. Answer the trivia. Miss one, and you work out with the ghosts. Permanently.',
  ],
  'dead.floor': ['To the killing floor!', 'Wrong answer. Time for a workout you might not survive.', 'Oh no. Killing floor time.'],
  'dead.lockers': ['Pick a locker. One of them is haunted.'],
  'dead.math': ["Quick math! Get one wrong and you're done."],
  'dead.memory': ['Memorize the reps. Then repeat them exactly.'],
  'dead.taps': ['Tap as fast as you can when I say go. Do not stop!'],
  'dead.died': ['Rest in reps.', "Ooh. [chuckle] That's a ghost now.", 'Welcome to the afterlife. The showers are cold.'],
  'dead.survived': ['Everybody survived! For now.', 'You live to lift another day.'],
  'dead.final': [
    'Final round! Escape the gym. True or false. Every right answer moves you toward the exit. Ghosts start one step behind.',
  ],
  'dead.escape': ['We have a survivor! Someone made it out!', 'And they escape the gym! Barely.'],
  'dead.winner': ['{name} escapes the gym! Barely.', 'We have a survivor! Give it up for {name}!'],

  // Forehead
  'head.intro': [
    'Forehead! The guesser holds their phone on their forehead. Everyone else shouts clues. Tap got it or pass on your own phone.',
    "Welcome to Forehead. Phone on your head, screen facing out. Your friends will help. Probably.",
  ],
  'head.next': ['{name}, phone on your forehead!', '{name}, you are the guesser. Phone up!', 'Phone on your forehead, {name}!'],
  'head.go': ['Go go go!', 'Start shouting!', 'Clues! Now!'],
  'head.time': ["Time's up!", 'Phones down!'],

  // Photobomb
  'photo.intro': [
    "Photobomb! Your friends' faces are now stickers. I give you a scene starring two of them. Drag their faces around and draw the rest. Make it beautiful. Or deeply wrong.",
    "Welcome to Photobomb. Two friends, one scene, and you're the artist. Put their faces in the picture and draw everything else. Hats and mustaches are encouraged.",
  ],
  'photo.draw': ['Start drawing! Their faces are on your canvas.', 'Get to work, artists. Your friends are counting on you. Sort of.', 'Draw the scene! Move the faces, add the chaos.'],
  'photo.by': ['A masterpiece by {name}!', 'Next up, a piece by {name}.', 'From the studio of {name}.'],
  'photo.gallery': ['Welcome to the gallery. Please do not touch the art.', "Gallery time. [chuckle] Let's admire your crimes against art.", 'The exhibit is open!'],
  'photo.vote': ['Vote for your two favorites!', 'Pick your two favorite masterpieces.', 'Which ones belong in a museum? Vote!'],
  'photo.reveal': ["Let's see who the critics loved.", 'And the critics have spoken!', 'The votes are in!'],

  // Zoom & Enhance
  'zoom.intro': [
    "Zoom and Enhance! I'm going to show you a face from this room, but heavily scrambled. It gets clearer every second. Buzz in fast with whose face it is. Faster guesses score more.",
    'Welcome to the crime lab. A mystery face, all zoomed in and pixelated. Figure out who it is before everyone else does.',
  ],
  'zoom.start': ['Enhance!', 'Zoom in on that!', 'Who is this? Buzz in!', 'Enhance. Enhance. Enhance!'],
  'zoom.reveal': ["It's {name}!", 'Case closed. It was {name}!', 'Identity confirmed: {name}!'],
  'zoom.nobody': ['Nobody recognized them. Ouch.', '[sigh] Not one of you. Do you even know your friends?'],

  // Frankenface
  'frank.intro': [
    "Frankenface! I've stitched together a monster out of your friends' faces. Figure out who donated the top, and who donated the bottom. It's science.",
    "Welcome to my laboratory. These faces are made of spare parts. Your job: name the donors. Faster is better. Don't ask where I got them.",
  ],
  'frank.start': ["It's alive! Who's in there?", 'A new creation! Name the donors.', 'Behold my monster! Whose parts are these?'],
  'frank.reveal': ['The donors are...', 'Unstitching the evidence.', "Let's see who gave up their face for science."],

  // Most Wanted
  'wanted.intro': [
    "Most Wanted! Every one of you gets a wanted poster. Your friends write the crime. The room decides which charge sticks. The biggest bounty is Public Enemy Number One.",
    'Welcome to the sheriff\'s office. Your face is going on a wanted poster. Two of your friends get to write why. Good luck out there.',
  ],
  'wanted.poster': ['Wanted: {name}!', 'Next poster: {name}!', 'Have you seen this face? It belongs to {name}!'],
  'wanted.write': ['Write the charges, deputies!', 'What are they wanted for? Write it up.', 'Time to frame your friends. Legally.'],
  'wanted.verdict': ['The charge sticks!', 'Guilty as charged!', 'Book em!', 'Another one for the wall.'],

  // Pull a Face
  'pull.intro': [
    'Pull a Face! I give you a situation, you act it out with your face, and snap a selfie. The best face wins. Commit to the bit.',
    'Welcome to Pull a Face. No drawing. No writing. Just your beautiful, ridiculous face. Act out the prompt and snap it.',
  ],
  'pull.snap': ['Show me that face! Snap it!', 'Faces ready. Act it out!', 'Strike a face!'],
  'pull.copy': [
    "Final round. Copycat! Recreate one of your friends' faces from earlier. Match it perfectly.",
    'Copycat round! You get a friend\'s face. Copy it as closely as you can.',
  ],
  'pull.vote': ['Vote for the best face!', 'Which face wins? Vote now.', 'Pick the best performance.'],
  'pull.reveal': ['And the best face goes to...', "We've got a winner! What a face.", 'That face is going in the hall of fame.'],
  'pull.winner': ['{name}, you win the round! What a face.', 'And the best face goes to {name}!'],
  'pull.nobody': ['No votes? [sigh] Tough crowd.', 'Nobody voted. Wow.'],

  // Art Fraud
  'fraud.intro': [
    'Art Fraud! Everyone knows the secret word except one player: the Fraud. You take turns adding one stroke to the same drawing. Then find the faker.',
    'Welcome to the gallery. Someone here is a fraud with no idea what we are drawing. One stroke each. Prove you know the word, without giving it away.',
  ],
  'fraud.peek': ['Check your phone. Keep it hidden.', 'Look at your card. Poker face, everyone.'],
  'fraud.draw': ['First stroke! Follow the order on your phone.', 'Pick up your brushes. One stroke each.'],
  'fraud.vote': ['Who is the Fraud? Argue it out, then vote.', 'Point at the faker! Vote now.'],
  'fraud.caught': ['Caught! But Fraud, you get one guess at the word.', 'Busted! One last chance. What is the word?'],
  'fraud.escaped': ['The Fraud got away with it!', 'Wrong person. The Fraud escapes into the night!'],
  'fraud.stole': ['They guessed it! The Fraud steals the win.', 'Unbelievable. The Fraud figured it out.'],
  'fraud.busted': ['Wrong guess. The real artists win!', 'The Fraud had no clue. Gallery wins!'],

  // Pants on Fire
  'pants.intro': [
    'Pants on Fire! Write two truths and one lie about yourself. Then everyone takes a turn in the hot seat. Grill them, and find the lie.',
    'Welcome to Pants on Fire. Two truths, one lie. Your friends will interrogate you. Keep a straight face, if you can.',
  ],
  'pants.write': ['Write two truths and a lie.', 'Three facts about you. One is fake. Make it good.'],
  'pants.grill': ['{name}, take the hot seat! Everyone else, start grilling.', '{name}, you are in the hot seat. Everyone, ask questions, then vote.', 'Into the hot seat, {name}!'],
  'pants.fooled': ['Liar liar, pants on fire! [laugh]', 'They fooled you! What a liar.', 'Smooth. Very smooth.'],
  'pants.caught': ['Caught! Everyone saw right through that.', 'Busted! Terrible liar.'],

  // Split Decision
  'split.intro': [
    'Split Decision! You get a great deal with a terrible catch. Write the catch. You score when the room is split right down the middle.',
    'Welcome to Split Decision. Finish the deal so half the room says yes and half says no. Perfect splits score big.',
  ],
  'split.write': ['Write the catch!', 'Make the deal tempting. Then ruin it.', 'Write a catch that splits the room.'],
  'split.perfect': ['A perfect split!', 'Fifty fifty! Beautiful.', 'Right down the middle!'],
  'split.lopsided': ['Everyone agreed. Zero points.', 'Unanimous! [laugh] That is the opposite of the point.'],
  'split.result': ["Let's see the split.", 'The room has spoken.'],
};
