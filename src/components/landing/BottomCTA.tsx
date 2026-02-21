import WaitlistForm from "./WaitlistForm";

export default function BottomCTA() {
  return (
    <section className="bg-gradient-to-b from-green-50 to-green-100 px-6 py-20 sm:py-28">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-3xl font-bold tracking-tight text-sage-900 sm:text-4xl">
          Ready to ditch the spreadsheets?
        </h2>
        <p className="mx-auto mt-4 max-w-lg text-lg text-sage-600">
          Join the waitlist and be the first to know when MyGutPal launches.
          Your gut will thank you.
        </p>

        <div className="mt-10 flex justify-center">
          <WaitlistForm variant="large" />
        </div>
      </div>
    </section>
  );
}
