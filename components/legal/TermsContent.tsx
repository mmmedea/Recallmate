export function TermsContent() {
  return (
    <div className="prose prose-slate dark:prose-invert max-w-none text-sm">
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
        Effective Date: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
      </p>

      <p>
        Welcome to RecallMate. By accessing or using our platform, you agree to be bound by these Terms of Service. Please read them carefully.
      </p>

      <h3 className="text-base font-semibold mt-6 mb-2">1. Account Responsibilities</h3>
      <p>
        You are responsible for safeguarding your account credentials and for all activities that occur under your account. You must be at least 13 years of old to use RecallMate, or have verifiable parental consent.
      </p>

      <h3 className="text-base font-semibold mt-6 mb-2">2. Acceptable Use</h3>
      <p>
        RecallMate is an educational tool. You agree not to use the platform to:
      </p>
      <ul className="list-disc pl-5 space-y-1 mb-4">
        <li>Upload copyrighted material for which you do not have the right or permission to use.</li>
        <li>Generate or distribute harmful, illegal, or abusive content.</li>
        <li>Attempt to reverse-engineer, disrupt, or compromise the security of our platform.</li>
        <li>Use the service for academic dishonesty or cheating.</li>
      </ul>

      <h3 className="text-base font-semibold mt-6 mb-2">3. Uploaded Content</h3>
      <p>
        You retain all rights to the documents, notes, and images you upload to RecallMate. By uploading content, you grant us a temporary, limited license solely to process your files in order to generate study materials (quizzes, notes) on your behalf.
      </p>

      <h3 className="text-base font-semibold mt-6 mb-2">4. AI Limitations</h3>
      <p>
        RecallMate utilizes advanced generative AI to create study questions and summaries. While we strive for accuracy, AI can occasionally generate incorrect, incomplete, or misleading information (hallucinations). RecallMate is designed to supplement your learning, but you should always verify critical facts against your source material.
      </p>

      <h3 className="text-base font-semibold mt-6 mb-2">5. Billing and Credits</h3>
      <p>
        Certain features of RecallMate require credits or a premium subscription. All payments are processed securely through our third-party providers. Subscriptions are billed in advance on a recurring basis. You may cancel your subscription at any time, but we do not provide refunds for partial billing periods.
      </p>

      <h3 className="text-base font-semibold mt-6 mb-2">6. Termination</h3>
      <p>
        We reserve the right to suspend or terminate your account at any time, without notice, if we determine that you have violated these Terms of Service.
      </p>

      <h3 className="text-base font-semibold mt-6 mb-2">7. Contact Information</h3>
      <p>
        If you have any questions about these Terms, please contact us at <strong>legal@recallmate.example.com</strong>.
      </p>
    </div>
  );
}
