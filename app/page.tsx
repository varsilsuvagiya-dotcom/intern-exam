/// The public landing page.
///
/// Deliberately still says nothing about the examination and links nowhere:
/// candidates are given the `/exam/start` address by their supervisor, and the
/// audit recorded that absence of a link as intentional. The only change is
/// that it now uses the CloudUS tokens instead of raw opacity utilities and
/// the `dark:` variants a light-only product does not have.
export default function Home() {
  return (
    <main className="cloudus-exam flex flex-1 items-center justify-center px-4 py-16 sm:px-6">
      <div className="w-full max-w-md text-center">
        <h1 className="text-4xl font-semibold tracking-tight text-exam-ink sm:text-5xl">
          CloudUS
        </h1>
        <p className="mt-3 text-lg text-exam-muted">Online Examination System</p>
      </div>
    </main>
  );
}
