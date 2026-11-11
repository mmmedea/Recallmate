import { LegalSection } from "@/components/legal/LegalSection";
import { RECALLMATE_CONTACT_EMAIL } from "@/lib/legal-contact";

const linkClass = "underline underline-offset-4 hover:text-indigo-600 dark:hover:text-indigo-300";

export function PrivacyContent() {
  return (
    <div className="space-y-10 text-sm leading-relaxed">
      <p>
        RecallMate is an AI-assisted study service. This policy describes the information processed when you use the app and the choices available to you. It should be read together with the Terms of Service.
      </p>

      <LegalSection heading="1. Information we process">
        <ul className="list-disc space-y-2 pl-6">
          <li><strong>Account and profile information:</strong> email address, username, profile details, and authentication or security records.</li>
          <li><strong>Study materials and study activity:</strong> files you upload, extracted text, notes, quizzes, reviewers, questions and answers in Medea chats, and learning or review progress.</li>
          <li><strong>Service and support information:</strong> feature usage, credit or entitlement records, settings, and messages you submit through support or feedback features.</li>
          <li><strong>Optional calendar information:</strong> if you connect Google Calendar, the app processes the information needed to create or synchronize RecallMate study events.</li>
        </ul>
        <p>
          We use only the cookies and local storage needed to sign you in, keep your account secure, and remember your preferences. We do not currently use third-party analytics or advertising trackers.
        </p>
      </LegalSection>

      <LegalSection heading="2. How we use information">
        <ul className="list-disc space-y-2 pl-6">
          <li>To authenticate you, provide study features, process uploaded materials, and generate requested study content.</li>
          <li>To maintain account settings, learning progress, credits and entitlements.</li>
          <li>To protect the service, prevent abuse, troubleshoot errors, and respond to support requests.</li>
          <li>To provide optional integrations that you choose to connect.</li>
        </ul>
        <p>RecallMate does not sell your personal information or uploaded study materials.</p>
      </LegalSection>

      <LegalSection heading="3. AI processing and service providers">
        <p>
          When you request an AI feature, the relevant prompt and source material may be sent to the AI provider used for that feature. The app is configured to use providers including Google Gemini, Anthropic (Claude), and DeepSeek; the provider depends on the feature and its configuration. These providers process information to return the requested result under their own terms and retention practices.
        </p>
        <p>
          RecallMate also uses service providers for hosting, authentication, database and file storage, email delivery, and optional integrations. These include Supabase and Vercel. Google receives the information required for a Calendar integration you authorize. We do not control each provider&apos;s separate retention schedule.
        </p>
        <p>Please avoid uploading highly sensitive personal information unless it is necessary for your study use.</p>
      </LegalSection>

      <LegalSection heading="4. Storage, security, and retention">
        <p>
          Account and study information is stored with the service providers used to operate RecallMate. Access controls and authentication are used to protect account data and uploaded files, but no online service can guarantee absolute security.
        </p>
        <p>
          We retain information while it is needed to provide the service, maintain your account, protect the app, resolve disputes, or meet legal obligations. You can delete individual study materials in the app and delete your account in Settings. Account deletion removes your account and associated study records. Uploaded files can take additional time to be fully removed, and you can email <a className={linkClass} href={`mailto:${RECALLMATE_CONTACT_EMAIL}`}>{RECALLMATE_CONTACT_EMAIL}</a> to confirm deletion. Backup, security-log, and provider copies may remain for a limited period under the applicable systems&apos; retention schedules. AI providers may separately retain information under their own policies.
        </p>
      </LegalSection>

      <LegalSection heading="5. Your choices and privacy rights">
        <p>
          You can manage profile details, delete study materials, disconnect optional integrations where available, and request account deletion in the app. Depending on applicable law, you may also have rights to access or correct personal data, object to or restrict certain processing, request erasure or blocking, or lodge a complaint. For a request, contact us using the address below. We may need to verify your identity before responding.
        </p>
        <p>
          For information about data-subject rights under the Philippine Data Privacy Act, see the <a className={linkClass} href="https://privacy.gov.ph/data-subject-rights/" rel="noreferrer" target="_blank">National Privacy Commission&apos;s rights overview</a>.
        </p>
      </LegalSection>

      <LegalSection heading="6. Children and students">
        <p>
          RecallMate is intended for study use. If you are under 18, use the service with permission from a parent or legal guardian. A parent or guardian who has a privacy request may contact us on the student&apos;s behalf.
        </p>
      </LegalSection>

      <LegalSection heading="7. Changes and contact">
        <p>
          We may update this policy as the service changes. We will update the date at the top when we revise it. Questions or privacy requests can be sent to <a className={linkClass} href={`mailto:${RECALLMATE_CONTACT_EMAIL}`}>{RECALLMATE_CONTACT_EMAIL}</a>.
        </p>
      </LegalSection>
    </div>
  );
}
