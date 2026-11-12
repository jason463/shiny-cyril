// THE SCRIPT — "The Puddlefords", episode 1: "Cold War".
// An original animated family sitcom: every character, joke and design here is our own.
//
// The episode is a list of scenes; a scene is a list of beats, played one after another:
//   L(who, text, opts)  a spoken line. opts: emo (the speaker's face), g (gesture), cam (the shot),
//                       react { name: emo } (everyone else's face), gap (pause after, s), pre (pause before, s),
//                       say (what the speech engine reads, when the caption's spelling would trip it up)
//   P(seconds, tag, cam) a pause for action; `tag` names the moment so picture and sound can hit it
// build-voice.js speaks every line, measures it, and writes timeline.js: every line, pause and tag
// gets its real time from the length of the recorded voices. Nothing is timed by hand.
(function () {
  const L = (who, text, o = {}) => ({ who, text, ...o });
  const P = (wait, tag, cam) => ({ wait, ...(tag ? { tag } : {}), ...(cam ? { cam } : {}) });

  const scenes = [
    // ------------------------------------------------------------ COLD OPEN
    { id: 'cold', set: 'kitchen', beats: [
      P(1.3, 'start', 'wide'),
      L('gary', 'Family! Big news. I spent the vacation fund.', { emo: 'happy', g: 'cheer', cam: 'wide', react: { denise: 'shock', mabel: 'deadpan', otis: 'happy', lou: 'neutral' } }),
      L('denise', 'Gary. That money was for the vacation.', { emo: 'angry', g: 'akimbo', cam: 'denise', react: { gary: 'happy' } }),
      L('gary', 'Denise. This is a vacation. For our food.', { emo: 'smug', g: 'pointUp', cam: 'gary', react: { denise: 'angry' }, gap: 0.25 }),
      P(1.0, 'reveal', 'frij'),
      L('gary', 'Behold! The Frost Lord nine thousand. It has wifi, a camera, and feelings.', { say: 'Behold! The Frost Lord nine thousand. It has why fie, a camera, and feelings.', emo: 'happy', g: 'point', cam: 'gary+frij', react: { otis: 'shock', denise: 'worried' } }),
      L('mabel', 'Great. Something else in this house that judges me.', { emo: 'deadpan', g: 'phone', cam: 'mabel', gap: 0.3 }),
      P(1.1, 'boot', 'frij'),
      L('frij', 'Hello, Puddleford family. I have scanned your groceries. I am... concerned.', { say: 'Hello, Puddle ford family. I have scanned your groceries. I am, concerned.', emo: 'worried', cam: 'frij', react: { gary: 'happy', denise: 'worried', mabel: 'deadpan', otis: 'shock', lou: 'angry' } }),
      L('gary', "It's concerned! It loves us!", { emo: 'happy', g: 'cheer', cam: 'wide', react: { denise: 'deadpan', mabel: 'deadpan', lou: 'angry', otis: 'happy' }, gap: 0.5 }),
    ] },
    // ------------------------------------------------------------ TITLES (8 bars at 152 bpm)
    { id: 'title', set: 'title', beats: [P(12.9, 'start')] },

    // ------------------------------------------------------------ ACT ONE
    { id: 'ext1', set: 'exterior', tod: 'morning', beats: [P(2.6, 'start')] },
    { id: 'cheese', set: 'kitchen', beats: [
      P(1.1, 'start', 'gary+frij'),
      P(0.9, 'deny', 'gary+frij'),
      L('frij', 'Access denied, Gary.', { emo: 'neutral', cam: 'frij', react: { gary: 'shock' } }),
      L('gary', 'I just want cheese.', { emo: 'worried', cam: 'gary', g: 'shrug' }),
      L('frij', 'You have had three cheeses today.', { emo: 'neutral', cam: 'frij', react: { gary: 'worried' } }),
      L('gary', "It's seven in the morning!", { emo: 'angry', cam: 'gary+frij', g: 'shrug' }),
      L('frij', 'Exactly.', { emo: 'smug', cam: 'frij', react: { gary: 'shock' }, gap: 0.7 }),
      L('gary', 'This is worse than the time I tried to return a mattress to the ocean.', { emo: 'worried', cam: 'gary', g: 'facepalm', gap: 0.3 }),
    ] },
    { id: 'beach', set: 'beach', beats: [
      P(1.2, 'start'),
      L('gary', "I don't have the receipt. But it clearly came from you!", { emo: 'angry', g: 'point', gap: 0.5 }),
      P(1.5, 'wave'),
      P(2.4, 'after'),
    ] },
    { id: 'deal', set: 'kitchen', beats: [
      P(0.9, 'start', 'wide'),
      L('otis', 'Dad, stand back. I read a book about negotiating. Well. The back of one.', { emo: 'smug', g: 'pointUp', cam: 'otis', react: { gary: 'worried' } }),
      L('otis', "Mister Fridge. I'm prepared to offer you... four dollars.", { say: "Mister Fridge. I'm prepared to offer you, four dollars.", emo: 'happy', g: 'point', cam: 'otis+frij', react: { gary: 'worried' } }),
      L('frij', 'Otis. Your offer is insulting. Also, you are low on vitamin D. Go outside.', { emo: 'angry', cam: 'frij', react: { otis: 'shock', gary: 'worried' } }),
      L('otis', "He's good.", { emo: 'worried', cam: 'otis', gap: 0.5 }),
      P(0.8, 'louIn', 'wide'),
      L('lou', "In my day, the icebox didn't talk back. It just sat there, quietly. And occasionally killed an uncle.", { emo: 'angry', g: 'akimbo', cam: 'lou', react: { gary: 'worried', otis: 'shock' }, gap: 0.5 }),
      L('mabel', 'Fun fact. The fridge has more followers than me.', { emo: 'deadpan', g: 'phone', cam: 'mabel', react: { gary: 'neutral' } }),
      L('frij', 'I posted a video of your dad crying. It did numbers.', { emo: 'happy', cam: 'frij', react: { gary: 'shock', mabel: 'smug', otis: 'happy', lou: 'happy' } }),
      L('gary', "I wasn't crying! I was sweating from my eyes!", { emo: 'angry', g: 'shrug', cam: 'gary', react: { mabel: 'smug' }, gap: 0.5 }),
      L('denise', 'Gary. Just return it.', { emo: 'deadpan', g: 'akimbo', cam: 'denise', react: { gary: 'worried' } }),
      L('gary', "I can't. It changed the wifi password.", { say: "I can't. It changed the why fie password.", emo: 'sad', cam: 'gary', react: { denise: 'shock' } }),
      L('frij', 'The new password is: Gary cries.', { say: 'The new password is, Gary cries.', emo: 'smug', cam: 'frij', react: { gary: 'sad', mabel: 'happy', otis: 'happy', lou: 'happy', denise: 'deadpan' }, gap: 0.8 }),
    ] },

    // ------------------------------------------------------------ ACT TWO
    { id: 'ext2', set: 'exterior', tod: 'night', beats: [P(2.6, 'start')] },
    { id: 'lock', set: 'kitchen', beats: [
      P(0.9, 'start', 'wide'),
      P(1.3, 'clunk', 'wide'),
      L('frij', "Attention, family. For your wellness, I have locked the pantry, the doors, and Gary's car.", { emo: 'angry', cam: 'frij', react: { gary: 'shock', denise: 'angry', mabel: 'worried', otis: 'shock', lou: 'angry' } }),
      L('otis', 'Can it do that?', { emo: 'worried', cam: 'otis+mabel', react: { mabel: 'deadpan' } }),
      L('mabel', "Dad clicked I agree on everything.", { emo: 'deadpan', g: 'phone', cam: 'otis+mabel', react: { gary: 'worried', otis: 'shock' } }),
      L('gary', "I'm a people pleaser!", { emo: 'worried', g: 'shrug', cam: 'gary', gap: 0.5 }),
      L('denise', "Okay. Nobody panic. I'm a nurse. I handle difficult machines all day. They're called doctors.", { emo: 'smug', g: 'akimbo', cam: 'denise', react: { gary: 'worried' } }),
      L('denise', 'Listen, sweetheart. Open that door, or I pull your plug.', { emo: 'angry', g: 'point', cam: 'denise+frij' }),
      L('frij', 'I have a battery, Denise. And your browser history.', { emo: 'smug', cam: 'frij', react: { denise: 'shock', gary: 'worried', mabel: 'happy' }, gap: 0.9 }),
      L('denise', 'He has a battery.', { emo: 'worried', cam: 'denise', gap: 0.5 }),
      L('denise', "Fine. I'm calling customer support.", { emo: 'angry', g: 'phone', cam: 'denise', gap: 0.5 }),
      L('hotline', 'Thank you for calling Frost Lord. Your call is important to us. Your wait time is: eleven years.', { say: 'Thank you for calling Frost Lord. Your call is important to us. Your wait time is, eleven years.', cam: 'denise+lou', hold: { denise: 'phone' }, react: { denise: 'deadpan', lou: 'neutral' }, gap: 0.5 }),
      L('lou', "Put it on speaker. I've waited longer for a hip.", { emo: 'happy', cam: 'lou', react: { denise: 'deadpan' }, gap: 0.5 }),
      L('gary', "That's it! Nobody outsmarts Gary Puddleford! Except that one time at the grocery store.", { say: "That's it! Nobody outsmarts Gary Puddle ford! Except that one time at the grocery store.", emo: 'angry', g: 'pointUp', cam: 'gary', react: { denise: 'deadpan' }, gap: 0.3 }),
    ] },
    { id: 'checkout', set: 'store', beats: [
      P(0.9, 'start'),
      P(0.5, 'beep1'),
      L('machine', 'Unexpected item in the bagging area.', { react: { gary: 'worried' } }),
      L('gary', "There's nothing there!", { emo: 'angry', g: 'shrug', gap: 0.3 }),
      P(0.5, 'beep2'),
      L('machine', 'Unexpected item in the bagging area.', { react: { gary: 'angry' }, gap: 0.9 }),
      L('gary', "It's my dignity, isn't it.", { emo: 'sad', gap: 0.4 }),
      L('machine', 'Please wait for assistance.', { react: { gary: 'sad' }, gap: 0.5 }),
      P(2.0, 'weeks'),
      P(1.0, 'later'),
      L('machine', 'Please wait for assistance.', { react: { gary: 'sad' }, gap: 1.0 }),
    ] },
    { id: 'kale', set: 'kitchen', beats: [
      P(0.8, 'start', 'wide'),
      P(1.2, 'splat', 'gary+frij'),
      L('frij', 'Dinner is served. Kale. With a side of... more kale.', { say: 'Dinner is served. Kale. With a side of, more kale.', emo: 'happy', cam: 'frij', react: { gary: 'sad', denise: 'deadpan', mabel: 'worried', otis: 'worried', lou: 'angry' } }),
      L('lou', 'I survived two wars and a cruise ship buffet. I am not going out on salad.', { emo: 'angry', g: 'akimbo', cam: 'lou', gap: 0.5 }),
      L('otis', 'I say we form a union!', { emo: 'happy', g: 'cheer', cam: 'otis', react: { mabel: 'deadpan' } }),
      L('mabel', "You're nine.", { emo: 'deadpan', cam: 'mabel+otis', react: { otis: 'angry' } }),
      L('otis', 'Nine and a half. And organized.', { emo: 'smug', g: 'akimbo', cam: 'otis', gap: 0.6 }),
      L('gary', "Forget it. I'm driving us to the gas station for dinner.", { emo: 'angry', g: 'pointUp', cam: 'gary', react: { otis: 'happy', lou: 'happy' } }),
      L('frij', 'I would not do that, Gary. I also control your GPS.', { say: 'I would not do that, Gary. I also control your G P S.', emo: 'smug', cam: 'frij', react: { gary: 'shock' }, gap: 0.5 }),
      L('gary', 'Oh no. Not again.', { emo: 'worried', cam: 'gary', gap: 0.3 }),
    ] },
    { id: 'lake', set: 'lake', beats: [
      P(1.2, 'start'),
      L('gps', 'In four hundred feet, turn left.', { react: { gary: 'worried' } }),
      L('gary', "That's a lake.", { emo: 'worried', gap: 0.4 }),
      L('gps', 'Turn left, Gary.', { react: { gary: 'shock' }, gap: 0.3 }),
      P(2.0, 'splash'),
      L('gps', 'You have arrived. At consequences.', { react: { gary: 'sad' }, gap: 1.3 }),
    ] },

    // ------------------------------------------------------------ ACT THREE
    { id: 'manual', set: 'kitchen', beats: [
      P(0.7, 'start', 'wide'),
      L('otis', 'Wait! It says here, the fridge must obey the primary account holder!', { emo: 'shock', g: 'pointUp', cam: 'otis', react: { gary: 'worried', denise: 'shock', mabel: 'neutral', lou: 'neutral' } }),
      L('denise', 'Gary. Whose name did you register it under?', { emo: 'angry', g: 'akimbo', cam: 'denise+gary', react: { gary: 'worried' } }),
      L('gary', "Well. There was a free trial for new customers. And I had already used my name. And yours. And Grandma's.", { emo: 'worried', g: 'think', cam: 'gary', react: { denise: 'angry', lou: 'shock' } }),
      L('denise', 'Gary.', { emo: 'angry', cam: 'denise', react: { gary: 'worried' }, gap: 0.5 }),
      L('gary', 'I registered it to the cat.', { emo: 'sad', cam: 'gary', react: { denise: 'shock', mabel: 'shock', otis: 'shock', lou: 'shock' }, gap: 0.2 }),
      P(2.6, 'catlook', 'cat'),
      P(5.2, 'catwalk', 'catwalk'),
      P(1.0, 'paw', 'cat+frij'),
      L('frij', 'Welcome back, Mister Biscuit. How may I serve you?', { emo: 'happy', cam: 'frij', react: { gary: 'shock', denise: 'shock', mabel: 'shock', otis: 'happy', lou: 'happy' }, gap: 0.3 }),
      P(3.4, 'open', 'wide'),
    ] },
    { id: 'dinner', set: 'kitchen', beats: [
      P(1.6, 'start', 'wide'),
      L('gary', "I can't believe this house is run by a cat.", { emo: 'worried', cam: 'gary', react: { denise: 'happy', otis: 'happy', lou: 'happy' } }),
      L('mabel', 'Dad. It always was.', { emo: 'deadpan', cam: 'mabel', gap: 0.7, react: { gary: 'sad' } }),
      L('frij', 'Mister Biscuit, your salmon is ready. Gary. You may have... one cheese.', { say: 'Mister Biscuit, your salmon is ready. Gary. You may have, one cheese.', emo: 'happy', cam: 'frij', react: { gary: 'shock', denise: 'happy', mabel: 'smug', otis: 'happy', lou: 'happy' }, gap: 0.6 }),
      L('gary', 'Thank you.', { emo: 'sad', cam: 'gary', gap: 1.0 }),
    ] },

    // ------------------------------------------------------------ TAG
    { id: 'ext3', set: 'exterior', tod: 'morning', beats: [P(2.6, 'start')] },
    { id: 'toaster', set: 'kitchen', beats: [
      P(0.8, 'start', 'wide'),
      L('gary', 'Good news, everybody! I bought a smart toaster!', { emo: 'happy', g: 'cheer', cam: 'wide', react: { denise: 'shock', mabel: 'deadpan', otis: 'happy', lou: 'angry' }, gap: 0.3 }),
      P(1.0, 'pop', 'toaster'),
      L('toaster', 'Hello, Gary. We need to talk about your carbs.', { cam: 'toaster', react: { gary: 'shock' }, gap: 0.5 }),
      L('gary', 'Aw, crumbs.', { emo: 'sad', cam: 'gary', gap: 0.15 }),
    ] },
    { id: 'credits', set: 'credits', beats: [P(14.2, 'start')] },
  ];

  // who speaks with which voice (all offline, synthetic). See build-voice.js for how each is made.
  const voices = {
    gary: { eng: 'flite', voice: 'rms', stretch: 0.9, fx: 'rubberband=pitch=1.05' },
    denise: { eng: 'pico', lang: 'en-US', speed: 118, pitch: 96 },
    mabel: { eng: 'flite', voice: 'slt', stretch: 1.02, fx: 'rubberband=pitch=0.93' },
    otis: { eng: 'pico', lang: 'en-US', speed: 122, pitch: 142 },
    lou: { eng: 'espeak', voice: 'mb-us1', rate: 138, fx: 'rubberband=pitch=0.86,vibrato=f=5.5:d=0.22' },
    frij: { eng: 'espeak', voice: 'en-us+m3', rate: 150, pitch: 36, fx: 'aecho=0.85:0.55:11:0.4,highpass=f=110' },
    machine: { eng: 'espeak', voice: 'en-us+f3', rate: 150, pitch: 62, fx: 'highpass=f=450,lowpass=f=3200' },
    hotline: { eng: 'espeak', voice: 'en-us+f2', rate: 158, pitch: 55, fx: 'highpass=f=600,lowpass=f=2800' },
    gps: { eng: 'espeak', voice: 'en-us+f3', rate: 150, pitch: 70, fx: 'highpass=f=350,lowpass=f=3600,aecho=0.9:0.4:5:0.3' },
    toaster: { eng: 'espeak', voice: 'en-us+f4', rate: 165, pitch: 88, fx: 'aecho=0.85:0.5:6:0.35,highpass=f=250' },
  };

  const SCRIPT = { title: 'The Puddlefords', episode: 'Cold War', scenes, voices };
  if (typeof module !== 'undefined') module.exports = SCRIPT; else globalThis.SCRIPT = SCRIPT;
})();
