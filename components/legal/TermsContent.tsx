import Link from "next/link";

export function TermsContent() {
  return (
    <div className="font-nunito space-y-5 leading-7 text-[#d0c8d9]">
      <p className="text-sm text-[#a99fb6]">Last updated: November 11, 2026</p>
      <p>By accessing or using RecallMate, you agree to these Terms & Conditions. If you do not agree, do not use the service.</p>
      <section><h2 className="font-fredoka text-xl text-white">1. Account responsibilities</h2><p>Provide accurate account information, safeguard your credentials, and remain responsible for activity through your account. Use the service only if you meet the minimum age requirements under applicable law and these terms.</p></section>
      <section><h2 className="font-fredoka text-xl text-white">2. Acceptable use</h2><p>Do not upload content you have no right to use, generate or distribute harmful or illegal content, attempt unauthorized access, disrupt the service, or use RecallMate to violate academic integrity rules or applicable law.</p></section>
      <section><h2 className="font-fredoka text-xl text-white">3. Uploaded content</h2><p>You retain rights you already hold in documents, notes, and images you upload. You must have permission to submit them. You grant RecallMate a limited permission to process submitted content as needed to provide the features you request, including study materials and AI responses.</p></section>
      <section><h2 className="font-fredoka text-xl text-white">4. AI limitations</h2><p>AI-generated notes, answers, and quizzes may be inaccurate, incomplete, or misleading. They are study aids, not authoritative academic, legal, medical, or professional advice. Verify important information against original materials and trusted sources.</p></section>
      <section><h2 className="font-fredoka text-xl text-white">5. Billing and credits</h2><p>Some features may be subject to credits or paid plans. Where payment features are offered, the applicable price, renewal, cancellation, and refund terms should be shown at checkout or in the relevant plan information. Mandatory consumer rights are not excluded.</p></section>
      <section><h2 className="font-fredoka text-xl text-white">6. Availability and termination</h2><p>Features may change or be interrupted, including where they rely on third-party services. Access may be restricted where reasonably necessary to protect users, the service, or legal rights. You may stop using the service and use available account controls to request deletion.</p></section>
      <section><h2 className="font-fredoka text-xl text-white">7. Contact and changes</h2><p>Questions about these terms can be sent through the <Link className="text-[#c4a7ff] underline" href="/help">RecallMate Help Center</Link>. These terms may be updated as the service changes, subject to applicable law.</p></section>
    </div>
  );
}