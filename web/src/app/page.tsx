import Link from "next/link";
import { workflows } from "@/lib/catalog";
import { InteractiveDemo } from "@/components/interactive-demo";

export default function Home() {
  return (
    <>
      <header className="site-header">
        <Link className="wordmark" href="/" aria-label="Workline home">
          Workline
        </Link>
        <nav className="site-nav" aria-label="Main navigation">
          <a href="#flow">The flow</a>
          <a href="#workflow-set">Workflow set</a>
          <a href="#boundaries">Data boundaries</a>
        </nav>
        <Link className="button button-quiet header-action" href="/login">
          Staff sign in
        </Link>
      </header>

      <main>
        <section className="hero section-wrap">
          <div className="hero-copy">
            <p className="eyebrow">Operational work, ready for a human decision</p>
            <h1>Make the next decision easier to see.</h1>
            <p className="hero-intro">
              Workline turns a business request into validated facts, clear
              checks, and a review that stays with the case.
            </p>
            <div className="hero-actions">
              <Link className="button button-primary" href="/demo">
                Run the sample workflow
              </Link>
              <Link className="text-link" href="/login">
                Open the staff workspace
              </Link>
            </div>
            <p className="hero-note">
              The public demo runs in your browser. It saves no case data.
            </p>
          </div>

          <div className="hero-visual">
            <div className="preview-meta">
              <span>Sample run</span>
              <span>Supplier invoice review</span>
            </div>
            <ol className="flow-preview" aria-label="Invoice review steps">
              <li>
                <span className="flow-step-index">01</span>
                <span className="flow-step-title">Request received</span>
                <span className="flow-step-detail">Invoice fields</span>
              </li>
              <li>
                <span className="flow-step-index">02</span>
                <span className="flow-step-title">Rules checked</span>
                <span className="flow-step-detail">Dates and totals</span>
              </li>
              <li className="flow-step-review">
                <span className="flow-step-index">03</span>
                <span className="flow-step-title">Human review</span>
                <span className="flow-step-detail">Approve or reject</span>
              </li>
              <li>
                <span className="flow-step-index">04</span>
                <span className="flow-step-title">Decision recorded</span>
                <span className="flow-step-detail">No payment sent</span>
              </li>
            </ol>
            <p className="preview-foot">
              An approval creates a manual instruction, not a payment.
            </p>
          </div>
        </section>

        <section className="section-wrap demo-section" id="flow">
          <div className="section-heading">
            <p className="eyebrow">Try a complete case</p>
            <h2>Run it, review it, decide it.</h2>
            <p>
              This browser-only walkthrough uses the same checks as the
              workspace. Its decisions are examples, not company policy.
            </p>
          </div>
          <InteractiveDemo compact />
        </section>

        <section className="workflow-section" id="workflow-set">
          <div className="section-wrap">
            <div className="section-heading section-heading-wide">
              <div>
                <p className="eyebrow">Workflow set</p>
                <h2>One review pattern, built around the work.</h2>
              </div>
              <p>
                Each template checks its own fields and routes a case to a
                person. Teams still set their own policy limits.
              </p>
            </div>
            <ul className="workflow-list">
              {workflows.map((workflow, index) => (
                <li className="workflow-row" key={workflow.id}>
                  <span className="workflow-number">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <div className="workflow-row-copy">
                    <h3>{workflow.name}</h3>
                    <p>{workflow.description}</p>
                  </div>
                  <span className="workflow-area">{workflow.area}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="section-wrap boundaries-section" id="boundaries">
          <div className="boundary-mark" aria-hidden="true">
            W
          </div>
          <div className="boundary-copy">
            <p className="eyebrow">Clear limits</p>
            <h2>People keep the final say.</h2>
            <p>
              Rules flag exceptions. A reviewer approves or rejects each
              case. Approval records a manual next step; Workline does not send
              messages, issue payments, place orders, or change another system.
            </p>
            <p>
              The signed-in workspace manages business cases with immutable
              audit logs and human approval gates. The browser demo stores
              nothing. All analysis runs deterministically and requires no
              third-party cloud data transfer.
            </p>
            <Link className="text-link" href="/demo">
              Inspect the sample case
            </Link>
          </div>
        </section>

        <section className="closing-section">
          <div className="section-wrap closing-inner">
            <p className="eyebrow">For the next review in your queue</p>
            <h2>Start with a request your team already handles.</h2>
            <Link className="button button-light" href="/demo">
              Choose a workflow to try
            </Link>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <Link className="wordmark" href="/">
          Workline
        </Link>
        <p>Workflow prototypes for human-reviewed business operations.</p>
        <Link href="/login">Staff sign in</Link>
      </footer>
    </>
  );
}
