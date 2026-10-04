import Image from "next/image";
import {
  ArrowUpRight,
  BookOpen,
  CalendarDays,
  Check,
  GraduationCap,
  ShieldCheck,
  Users,
} from "lucide-react";
import { SignIn } from "./signin";
import { college } from "@/lib/content/college";
export function Welcome({
  google,
  demo,
  initialError,
}: {
  google: boolean;
  demo: boolean;
  initialError: string;
}) {
  return (
    <main className="welcome-shell">
      <a href="#portal-login" className="welcome-skip">
        Skip to sign in
      </a>
      <section className="welcome-story" aria-labelledby="welcome-title">
        <header className="welcome-brand">
          <div className="welcome-logo">
            <Image
              unoptimized
              src="/college-logo.png"
              alt="I²IT Pune college logo"
              width={49}
              height={65}
              loading="eager"
            />
          </div>
          <div>
            <span className="welcome-college">{college.shortName}</span>
            <p>{college.name}</p>
          </div>
        </header>
        <div className="welcome-story-body">
          <p className="welcome-kicker">TRAINING & PLACEMENT</p>
          <h1 id="welcome-title">
            Keep learning.
            <br />
            <span>Keep growing.</span>
          </h1>
          <p className="welcome-lead">
            Your next chapter starts with showing up.
          </p>
          <p className="welcome-description">
            From your first pre-placement talk to your next opportunity, bring
            your preparation. Placement Desk brings your events, approved access
            and attendance together.
          </p>
          <a className="welcome-story-login" href="#portal-login">
            Go to sign in <ArrowUpRight size={16} aria-hidden="true" />
          </a>
          <div className="welcome-journey" aria-label="Your placement journey">
            {[
              { icon: BookOpen, title: "Prepare", text: "Build your skills" },
              { icon: Users, title: "Connect", text: "Meet the industry" },
              {
                icon: GraduationCap,
                title: "Progress",
                text: "Take the next step",
              },
            ].map(({ icon: Icon, title, text }, i) => (
              <div key={title}>
                <span className="journey-number">0{i + 1}</span>
                <Icon size={23} aria-hidden="true" />
                <strong>{title}</strong>
                <span>{text}</span>
              </div>
            ))}
          </div>
          <blockquote className="welcome-quote">
            Small steps today. More possibilities tomorrow.
          </blockquote>
        </div>
        <footer className="welcome-companies">
          <p>From the college’s placement history</p>
          <ul aria-label="Companies in college placement history">
            {college.companies.map((name) => (
              <li key={name}>{name}</li>
            ))}
          </ul>
          <a
            href={college.placements}
            target="_blank"
            rel="noopener noreferrer"
          >
            Explore placement stories{" "}
            <ArrowUpRight size={15} aria-hidden="true" />
          </a>
        </footer>
      </section>
      <section className="welcome-access" aria-labelledby="login-title">
        <nav className="welcome-links" aria-label="College information">
          <span>{college.location}</span>
          <a href={college.website} target="_blank" rel="noopener noreferrer">
            College website <ArrowUpRight size={16} aria-hidden="true" />
          </a>
        </nav>
        <div className="welcome-login" id="portal-login" tabIndex={-1}>
          <div className="welcome-login-icon">
            <CalendarDays size={27} aria-hidden="true" />
          </div>
          <p className="welcome-kicker">PLACEMENT DESK</p>
          <h2 id="login-title">
            Your opportunities.
            <br />
            One workspace.
          </h2>
          <p className="welcome-login-intro">
            Sign in to see your assigned events and participation records.
          </p>
          <SignIn google={google} demo={demo} initialError={initialError} />
          <div className="welcome-help">
            <ShieldCheck size={20} aria-hidden="true" />
            <p>
              Use the email linked to your CRN by TNP. Your college roster
              determines event access.
            </p>
          </div>
          <details className="welcome-faq">
            <summary>New here or can’t see your events?</summary>
            <p>
              Ask TNP to add your email and CRN to the student roster and
              include you in the event’s eligible list. Signing in does not
              automatically grant meeting access.
            </p>
          </details>
        </div>
        <footer className="welcome-access-footer">
          <span>
            <Check size={15} aria-hidden="true" /> Students & TNP administrators
          </span>
          <span>I²IT Pune · Placement Desk</span>
        </footer>
      </section>
    </main>
  );
}
