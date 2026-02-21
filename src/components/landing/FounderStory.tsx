export default function FounderStory() {
  return (
    <section className="bg-white px-6 py-20 sm:py-28">
      <div className="mx-auto max-w-3xl">
        <div className="rounded-2xl border border-sage-200 bg-warm-50 p-8 sm:p-12">
          <h2 className="text-2xl font-bold tracking-tight text-sage-900 sm:text-3xl">
            Built by someone who gets it
          </h2>

          <div className="mt-6 space-y-4 text-sage-600">
            <p className="leading-relaxed">
              Hey, I&apos;m Jason. I&apos;m building MyGutPal because I needed it
              myself.
            </p>

            <p className="leading-relaxed">
              I&apos;m currently treating my own gut condition — dealing with
              the full gauntlet of antimicrobials, prokinetics, meal timing,
              probiotics, and all the phases in between. For months, I tracked
              everything in a mess of spreadsheets, reminders, and notes
              scattered across three different apps.
            </p>

            <p className="leading-relaxed">
              Every morning started with the same questions: Did I take my
              morning supplements? How long has it been since I ate? Which
              phase of my protocol am I in? Am I actually getting better, or
              does it just feel that way?
            </p>

            <p className="leading-relaxed">
              I got frustrated enough to build the tool I wished existed. Not
              another generic health app that treats gut issues as an
              afterthought, but something designed from the ground up for
              people managing complex digestive conditions.
            </p>

            <p className="leading-relaxed font-medium text-sage-700">
              MyGutPal is what I use every day. I hope it helps you too.
            </p>
          </div>

          <div className="mt-8 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-lg font-bold text-green-700">
              J
            </div>
            <div>
              <p className="font-semibold text-sage-800">Jason</p>
              <p className="text-sm text-sage-500">Founder, MyGutPal</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
