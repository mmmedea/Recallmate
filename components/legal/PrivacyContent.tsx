export function PrivacyContent() {
  return (
    <div className="prose prose-slate dark:prose-invert max-w-none text-sm">
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
        Effective Date: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
      </p>

      <p>
        At RecallMate, your privacy and data security are our top priorities. This Privacy Policy outlines what data we collect, how it is processed, and how we keep it secure when you use our AI study tutor.
      </p>

      <h3 className="text-base font-semibold mt-6 mb-2">1. What Data RecallMate Collects</h3>
      <p>We collect the following types of information when you use our service:</p>
      <ul className="list-disc pl-5 space-y-1 mb-4">
        <li><strong>Authentication & Session Data:</strong> Your email address and basic profile information if you sign in using OAuth providers (Google, GitHub, Facebook) or via Email OTP. We use Supabase for secure authentication.</li>
        <li><strong>Uploaded Study Materials:</strong> Documents, images, and text you upload for analysis.</li>
        <li><strong>AI Processing Data:</strong> Generated quizzes, summaries, notes, and chat histories with Medea AI.</li>
        <li><strong>Usage & Billing Data:</strong> Interaction metrics, credits consumed, and payment status (handled securely via our payment providers).</li>
      </ul>

      <h3 className="text-base font-semibold mt-6 mb-2">2. How We Use Your Uploaded Study Materials</h3>
      <p>
        The materials you upload are used strictly to generate study aids, quizzes, and to allow Medea AI to answer your questions. We do not use your personal study materials to train our foundational AI models, nor do we sell your documents to third parties.
      </p>

      <h3 className="text-base font-semibold mt-6 mb-2">3. AI Processing</h3>
      <p>
        RecallMate integrates with external AI providers (such as Google Gemini) to process your documents and generate predictive exam questions. When your data is sent to these APIs, it is transmitted securely and is subject to strict data processing agreements that prohibit them from using your personal data to train their models.
      </p>

      <h3 className="text-base font-semibold mt-6 mb-2">4. Data Retention and Deletion</h3>
      <p>
        You retain ownership of the materials you upload. You may delete your uploaded documents, quizzes, and account at any time through your dashboard. Once deleted, your data is permanently removed from our active databases.
      </p>

      <h3 className="text-base font-semibold mt-6 mb-2">5. Cookies and Tracking</h3>
      <p>
        We use essential cookies to maintain your active session and secure your account. Optional analytics and marketing cookies are only used if you explicitly consent to them via our Cookie Preferences manager.
      </p>

      <h3 className="text-base font-semibold mt-6 mb-2">6. Contact Information</h3>
      <p>
        If you have any questions or concerns regarding this Privacy Policy or your data, please contact us at <strong>privacy@recallmate.example.com</strong>.
      </p>
    </div>
  );
}
