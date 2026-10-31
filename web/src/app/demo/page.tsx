import Link from "next/link";
import { InteractiveDemo } from "@/components/interactive-demo";

export default function DemoPage() {
  return (
    <div className="page-shell">
      <header className="site-header">
        <Link className="wordmark" href="/" aria-label="Workline home">
          Workline
        </Link>
        <nav className="site-nav" aria-label="Main navigation">
          <Link href="/#workflow-set">Workflow set</Link>
          <Link href="/#boundaries">Data boundaries</Link>
        </nav>
        <Link className="button button-quiet header-action" href="/login">
          Staff sign in
        </Link>
      </header>
      <main className="page-main">
        <div className="page-heading">
          <div>
            <p className="eyebrow">Browser-only sample</p>
            <h1>Try a workflow before connecting a workspace.</h1>
            <p>
              Sample cases stay in this browser session. They are not company
              records and do not trigger external actions.
            </p>
          </div>
        </div>
        <div className="demo-full">
          <InteractiveDemo />
        </div>
      </main>
    </div>
  );
}
