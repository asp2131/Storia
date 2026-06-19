import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How Loratone collects, uses, and protects information in our native app.",
};

export default function PrivacyPolicyPage() {
  const lastUpdated = "February 27, 2026";

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white px-6 py-16 sm:py-20">
      <div className="mx-auto w-full max-w-4xl">
        <p className="text-xs uppercase tracking-[0.2em] text-amber-200/70 mb-4">Legal</p>
        <h1 className="font-serif text-4xl sm:text-5xl font-black tracking-tight text-amber-100 mb-4">
          Loratone Privacy Policy
        </h1>
        <p className="text-sm text-white/50 mb-12">Last updated: {lastUpdated}</p>

        <div className="space-y-10 text-white/80 leading-relaxed">
          <section>
            <h2 className="font-serif text-2xl text-white mb-3">1. Introduction</h2>
            <p>
              This Privacy Policy explains how Loratone (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;) collects, uses, and protects information
              when you use the Loratone native mobile app and related services. By using Loratone, you agree to the practices
              described in this policy.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-2xl text-white mb-3">2. Information We Collect</h2>
            <ul className="list-disc pl-6 space-y-2 marker:text-amber-200/70">
              <li>
                <span className="font-semibold text-white">Account information:</span> email address and account credentials
                when you create an account.
              </li>
              <li>
                <span className="font-semibold text-white">Profile and reading data:</span> reading progress, saved books,
                app preferences, and interaction events needed to personalize the experience.
              </li>
              <li>
                <span className="font-semibold text-white">Device and usage information:</span> app version, device type,
                operating system, language, and diagnostic logs for performance and reliability.
              </li>
              <li>
                <span className="font-semibold text-white">Purchase information:</span> subscription or purchase status
                provided by platform billing systems (such as Apple App Store or Google Play). We do not store full payment
                card details.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="font-serif text-2xl text-white mb-3">3. How We Use Information</h2>
            <ul className="list-disc pl-6 space-y-2 marker:text-amber-200/70">
              <li>Provide and improve core app features and content delivery.</li>
              <li>Sync reading progress and personalize stories and audio experiences.</li>
              <li>Monitor app performance, troubleshoot errors, and maintain security.</li>
              <li>Communicate important service updates and support responses.</li>
              <li>Comply with legal obligations and enforce our terms.</li>
            </ul>
          </section>

          <section>
            <h2 className="font-serif text-2xl text-white mb-3">4. Children&apos;s Privacy</h2>
            <p>
              Loratone is designed for children with parent or guardian involvement. We strive to limit data collection to what
              is necessary to provide the service. If you are a parent or guardian and believe your child&apos;s information was
              provided inappropriately, contact us and we will investigate and take appropriate action.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-2xl text-white mb-3">5. Sharing of Information</h2>
            <p className="mb-3">We do not sell personal information. We may share limited data with:</p>
            <ul className="list-disc pl-6 space-y-2 marker:text-amber-200/70">
              <li>Service providers that help us host, analyze, and operate Loratone.</li>
              <li>Platform services (such as app stores) for subscriptions and purchase validation.</li>
              <li>Legal authorities when required by law or to protect rights and safety.</li>
            </ul>
          </section>

          <section>
            <h2 className="font-serif text-2xl text-white mb-3">6. Data Retention</h2>
            <p>
              We retain information only as long as needed for the purposes described in this policy, including account
              management, legal compliance, dispute resolution, and security.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-2xl text-white mb-3">7. Your Choices and Rights</h2>
            <p className="mb-3">Depending on your location, you may have rights to:</p>
            <ul className="list-disc pl-6 space-y-2 marker:text-amber-200/70">
              <li>Access, update, or delete certain personal information.</li>
              <li>Request a copy of your data.</li>
              <li>Object to or restrict certain processing activities.</li>
            </ul>
            <p className="mt-3">To make a request, contact us at the email below.</p>
          </section>

          <section>
            <h2 className="font-serif text-2xl text-white mb-3">8. Security</h2>
            <p>
              We use reasonable administrative, technical, and organizational safeguards to protect information. No method
              of transmission or storage is completely secure, so we cannot guarantee absolute security.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-2xl text-white mb-3">9. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. If we make material changes, we will update the &quot;Last
              updated&quot; date and provide notice where required.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-2xl text-white mb-3">10. Contact Us</h2>
            <p>
              If you have any questions or requests about this policy, contact us at{" "}
              <a className="text-amber-200 hover:text-amber-100 underline underline-offset-4" href="mailto:privacy@loratone.kids">
                privacy@loratone.kids
              </a>
              .
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
