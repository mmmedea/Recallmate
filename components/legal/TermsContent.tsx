import { LegalSection } from "@/components/legal/LegalSection";
import { RECALLMATE_CONTACT_EMAIL } from "@/lib/legal-contact";

const linkClass = "underline underline-offset-4 hover:text-indigo-600 dark:hover:text-indigo-300";

export function TermsContent() {
  return (
    <div className="space-y-10 text-sm leading-relaxed">
      <p>
        These Terms apply when you access or use RecallMate. By using the service, you agree to follow them. If you do not agree, do not use the service.
      </p>

      <LegalSection heading="1. Eligibility and accounts">
        <p>
          If you are under 18, you must have permission from a parent or legal guardian to use RecallMate. You are responsible for keeping your account credentials private, providing accurate account information, and activity that occurs through your account.
        </p>
      </LegalSection>

      <LegalSection heading="2. Your content">
        <p>
          You retain the rights you hold in materials and questions you provide. You give RecallMate permission to host, process, and transmit that content to the service providers needed to provide the features you request.
        </p>
        <p>
          You must have the rights and permissions needed to upload or use your content. Do not upload unlawful material, material that infringes another person&apos;s rights, or another person&apos;s sensitive or private information without authorization.
        </p>
      </LegalSection>

      <LegalSection heading="3. Acceptable use">
        <ul className="list-disc space-y-2 pl-6">
          <li>Do not attempt to access another user&apos;s data or bypass security controls.</li>
          <li>Do not disrupt, overload, reverse engineer, or abuse the service or its AI, credits, Hearts, or Premium features.</li>
          <li>Do not use RecallMate to cheat where AI assistance is not permitted; follow your school&apos;s academic-integrity rules.</li>
          <li>Do not use the service unlawfully or to harm others.</li>
        </ul>
        <p>We may restrict or suspend access when reasonably necessary to protect the service, users, or comply with law.</p>
      </LegalSection>

      <LegalSection heading="4. AI-generated content">
        <p>
          RecallMate uses AI to produce study notes, quizzes, reviewers, and explanations. AI output may be incorrect, incomplete, or unsuitable for a particular purpose. It is study assistance, not a substitute for your source materials, teacher, or professional advice. Check important information before relying on it.
        </p>
      </LegalSection>

      <LegalSection heading="5. Credits and Premium features">
        <p>
          Some features may be subject to usage limits, credits, Hearts, or Premium access. The available features and any applicable price or usage terms will be shown in the app when offered. Credits, Hearts, and similar in-app features have no cash value and are not redeemable for money unless applicable law requires otherwise.
        </p>
      </LegalSection>

      <LegalSection heading="6. Availability and changes">
        <p>
          We work to keep RecallMate available, but do not guarantee uninterrupted or error-free operation. Features may change, be suspended, or be discontinued. We may revise these Terms and will update the date above; where required, we will give notice of material changes.
        </p>
      </LegalSection>

      <LegalSection heading="7. Termination and account deletion">
        <p>
          You may stop using RecallMate and request account deletion through Settings. We may suspend or end access if needed to enforce these Terms, protect users or the service, or comply with law. Deletion and retention are also described in the Privacy Policy.
        </p>
      </LegalSection>

      <LegalSection heading="8. Disclaimers and liability">
        <p>
          To the extent permitted by applicable law, RecallMate is provided on an &quot;as is&quot; and &quot;as available&quot; basis. Nothing in these Terms excludes rights or remedies that cannot lawfully be excluded. To the extent permitted by law, RecallMate is not liable for indirect or consequential loss, or for grades, examination results, or decisions based on AI-generated content. Subject to those limits, total liability for a claim is limited to the amount you paid RecallMate in the 12 months before the claim, or PHP 500 if you paid nothing.
        </p>
      </LegalSection>

      <LegalSection heading="9. Governing law and contact">
        <p>These Terms are governed by the laws of the Republic of the Philippines, subject to any mandatory consumer protections that apply.</p>
        <p>Questions about these Terms: <a className={linkClass} href={`mailto:${RECALLMATE_CONTACT_EMAIL}`}>{RECALLMATE_CONTACT_EMAIL}</a>.</p>
      </LegalSection>
    </div>
  );
}
