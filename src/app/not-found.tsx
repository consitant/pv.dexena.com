import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-[60dvh] flex-col items-center justify-center gap-3 px-4 text-center">
      <p className="text-5xl font-semibold text-sun-500">404</p>
      <h1 className="text-lg font-semibold">Seite nicht gefunden</h1>
      <p className="text-sm text-stone-500">Die angeforderte Seite existiert nicht oder Sie haben keinen Zugriff.</p>
      <Link href="/" className="btn">Zur Startseite</Link>
    </main>
  );
}
