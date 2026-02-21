import { Quote } from "lucide-react";

export default function FounderStory() {
  return (
    <section className="bg-white px-6 py-20 sm:py-28">
      <div className="mx-auto max-w-3xl">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-warm-50 via-warm-50 to-green-50 p-8 shadow-sm sm:p-12">
          <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-green-100/40 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-12 -left-12 h-36 w-36 rounded-full bg-warm-200/30 blur-3xl" />

          <div className="relative">
            <Quote className="mb-4 h-8 w-8 text-green-300" strokeWidth={1.5} />

            <h2 className="text-2xl font-extrabold tracking-tight text-sage-900 sm:text-3xl">
              Built by someone who gets it
            </h2>

            <div className="mt-6 space-y-4 text-sage-600">
              <p className="leading-relaxed">
                Hey, I&apos;m Jason. I&apos;m building MyGutPal because I needed it
                myself.
              </p>

              <p className="leading-relaxed">
                I&apos;ve been managing my own gut condition — dealing with the
                full gauntlet of antimicrobials, prokinetics, meal timing,
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

              <p className="leading-relaxed font-semibold text-sage-800">
                MyGutPal is what I use every day. I hope it helps you too.
              </p>
            </div>

            <div className="mt-8 flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-green-400 to-emerald-600 text-xl font-bold text-white shadow-md shadow-green-600/20">
                J
              </div>
              <div>
                <p className="font-bold text-sage-900">Jason</p>
                <p className="text-sm text-sage-500">Founder, MyGutPal</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
