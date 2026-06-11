export default function OfflinePage() {
  return (
    <main className="theme-rescue flex min-h-screen items-center justify-center bg-paper px-6 py-16">
      <section className="panel w-full max-w-md p-8 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-2xl dark:bg-slate-800">
          Wi-Fi
        </div>
        <h1 className="text-2xl font-bold text-ink">You are offline</h1>
        <p className="mt-3 text-sm leading-6 text-slate-500 dark:text-slate-400">
          ChatZi saved the app shell for you. Reconnect to continue syncing conversations and customer data.
        </p>
      </section>
    </main>
  );
}
