import type { Metadata } from "next";
import { GaiaLogo } from "@/components/brand";

export const metadata: Metadata = {
  title: "Privacy Policy | Gaia Dairy",
  description: "Privacy Policy for the Gaia Fresh, Gaia Delivery Partner, Gaia Distributors and Gaia Salesforce apps, operated by Vamaa Dairy Private Limited.",
};

const SECTIONS: { title?: string; paras?: string[]; list?: string[]; after?: string[] }[] = [
  {
    paras: [
      "For us, privacy for our valued customers is paramount. We strongly believe that our customer’s personal information should not be shared with a third party without prior consent or request from the customer. Privacy is the right of an individual, and at the website, www.gaiadairy.com or application ‘Gaia Fresh’ (collectively referred to as the “Platform”), the information of the customer, such as contact number, email, addresses, etc., is used only for the internal purpose and not for sale. Your use of the platform, services, and tools is governed by this privacy policy and the terms and conditions provided on the forum. By using the platform, you agree and consent to this privacy policy and the collection, transfer, use, storage, disclosure, and sharing of your information as described and collected by us by this privacy policy. If you do not accept the privacy policy or the terms and conditions, we will request that you use or access the platform.",
      "The Platform is owned and operated by Vamaa Dairy Private Limited, a company incorporated under the laws of India (“VDPL”). For this Privacy Policy, wherever the context so requires, \"You\" or \"User\" shall mean any natural or legal person who has agreed to use the Platform or become a buyer on the Platform by registering on the Platform using the computer system, phone or any other electronic device. The term \"We,\" \"Us,\" and \"Our\"; shall mean Vamaa. This Privacy Policy governs your use of the platform, services, and tools.",
    ],
  },
  {
    title: "Policy and Modification",
    paras: [
      "This Privacy Policy is available on the Gaia Fresh website www.gaiadairy.com and the ‘Gaia Fresh application for You. This Privacy Policy shall be read along with the Terms and Conditions provided on the Platform. We reserve the right, at our sole discretion, to change, modify, add or remove portions of this Privacy Policy at any time without any prior written notice to You by posting changes on the Platform, and you shall be liable to update yourself of such modifications, if any, by accessing the changes on the Platform. You shall, at all times, be responsible for regularly reviewing the Privacy Policy. Your continued use of the Platform following the posting of changes constitutes your acceptance of the amended Privacy Policy.",
    ],
  },
  {
    title: "Your Information",
    paras: [
      "Please note that Your personally identifiable information, including Your name, phone number, email address, region, location, address and demographic information (age/gender), and other content as is voluntarily submitted by You on our Platform, such as reviews and ordering details, purchase history, usage, preference information, and transaction information may be stored with Us and may use it to process your requests and automatically complete forms for future transactions and to enable Us to offer better shopping experience for You.",
    ],
  },
  {
    title: "Apps Covered by This Policy",
    paras: ["This Privacy Policy applies to the website www.gaiadairy.com and to all of the following apps published by Vamaa Dairy Private Limited:"],
    list: [
      "Gaia Fresh (Gaia Dairy), for customers who buy our products;",
      "Gaia Delivery Partner, for our delivery boys and transporters;",
      "Gaia Distributors, for our distributors and retailers;",
      "Gaia Salesforce, for our sales officers and other employees.",
    ],
    after: [
      "The sections below explain what each partner and staff app collects. Everything else in this policy applies to all of them.",
    ],
  },
  {
    title: "Location",
    list: [
      "Gaia Fresh: only when you choose to use your current location to fill in a delivery address. The app never reads your location in the background.",
      "Gaia Delivery Partner: your precise location while you are on duty, including when the screen is off or another app is open. A notification (“Sharing location while you deliver”) stays on the screen the whole time. It is used to show the customer where their order is, to plan routes and dispatch, and to record deliveries. Switching to off duty or signing out stops it.",
      "Gaia Salesforce: your precise location when you punch in and out and when you check in at a store, and your route during the working day (from punch-in to punch-out), including when the screen is off. A notification stays on the screen while the route is being recorded. It is used for attendance, to confirm store visits and to work out travel claims. Nothing is recorded after you punch out.",
      "Gaia Distributors: only when you choose to use your current location to set your firm’s or delivery address.",
    ],
  },
  {
    title: "Partner and Staff Information",
    list: [
      "Gaia Delivery Partner: name, mobile number, vehicle number (transporters), the orders you deliver, delivery confirmation codes, and ratings that customers give you.",
      "Gaia Distributors: firm and owner name, mobile number, GSTIN, PAN, business address and location, orders, invoices and payment records.",
      "Gaia Salesforce: your employee profile from our HR records (such as designation, department, date of birth, address, emergency contact, bank account and IFSC, PAN and the last four digits of Aadhaar), attendance, leave, expense claims with photos of receipts you attach, salary slips, an optional profile photo, and the store visits and orders you record.",
      "All apps: your mobile number and PIN. The PIN is stored only in encrypted (hashed) form, and repeated wrong PINs lock the number for a short time. One-time codes for signing up or resetting a PIN are sent by SMS.",
      "Fingerprint or face unlock, where offered, is checked by your phone. We never receive or store biometric data.",
      "To send notifications (new orders, dispatch updates, approvals), the apps register a notification token for your device.",
    ],
  },
  {
    title: "Who Can See Partner and Staff Information",
    paras: [
      "This information is used only to run our business with you. It is seen by the Vamaa Dairy staff who need it, such as your manager, HR, accounts and dispatch. A customer sees their delivery partner’s name and phone number, and the partner’s live location only while the order is out for delivery. We do not sell this information.",
    ],
  },
  {
    title: "Service Providers",
    paras: ["We use these service providers to run the apps. Each receives only what it needs:"],
    list: [
      "Google Firebase Cloud Messaging, to deliver notifications;",
      "Ola Maps, for maps, address search and routes (map requests go through our server and carry only coordinates or the address being searched);",
      "an SMS provider, to send one-time codes;",
      "Easebuzz, to process online payments in Gaia Fresh.",
    ],
  },
  {
    title: "Keeping and Deleting Your Data",
    paras: [
      "We keep your information while your account is active and afterwards only for as long as the law requires (for example invoices, tax and payroll records) or as needed to settle disputes. Gaia Fresh customers can delete their account at production.vamadairy.in/delete-account. Users of Gaia Delivery Partner, Gaia Distributors or Gaia Salesforce can ask for their account and its data to be deleted by writing to customercare@vamaadairy.com from their registered email or calling +91 8085959595 from their registered number. Records that we must keep by law (such as invoices, tax and payroll records) are retained for the period the law requires and are not used for anything else.",
    ],
  },
  {
    title: "Cookies",
    paras: [
      "Our Platform and third parties with whom we partner may use cookies, pixel tags, web beacons, mobile device IDs, “flash cookies,” and similar files or technologies to collect and store information concerning Your use of the services offered by Us on the Platform or about the Products and third-party websites. Like other platforms, our server log files also receive general information such as the visitor’s IP address, cookie, etc. We use \"Cookies\" to keep track of your current shopping session to personalize your experience so that you can retrieve your shopping cart anytime.",
      "\"Cookies\" are software codes that an internet website sends to your browser when you access information at that site or application. Cookies let you navigate between pages efficiently as they store your preferences, information about your shopping session, information to identify your computer, and generally improve your experience of a website. The Platform may contain links to other websites or online platforms, and We are not responsible for the privacy practices of such websites or online media, which We do not own, manage or control.",
      "We may also allow third parties to provide audience measurement and analytics services for us, to serve advertisements on our behalf across the Internet, and track and report on the performance of those advertisements. These entities may use cookies and other technologies to identify your device when you visit the Platform and use our services and other online sites and services.",
    ],
  },
  {
    title: "Secure Online Payments",
    paras: [
      "For financial transactions by credit card, the Platform uses a third-party secure payment gateway provided by “Ease buzz,” and the credit card details are ‘not stored’ Gaia Fresh Application. Instead, the information is securely stored and encrypted with Visa/MasterCard. We are not responsible for the practices and policies of such online platforms, which We do not own, manage or control.",
    ],
  },
  {
    title: "Your Responsibilities",
    paras: ["You shall not host, display, upload, modify, publish, transmit, update or share any information."],
    list: [
      "Belongs to another person and to which the user does not have any right;",
      "Is grossly harmful, harassing, blasphemous defamatory, obscene, pornographic, paedophilic, libelous, invasive of another's privacy, hateful, or racially, ethnically objectionable, disparaging, relating or encouraging money laundering or gambling, or otherwise unlawful in any manner whatever;",
      "Harm minors in any way;",
      "Infringes any patent, trademark, copyright, or other proprietary rights;",
      "Violates any law for the time being in force;",
      "Deceives or misleads the addressee about the origin of such messages or communicates any information which is grossly offensive or menacing in nature;",
      "Impersonate another person;",
      "Contains software viruses or any other computer code, files, or programs designed to interrupt, destroy or limit the functionality of any computer resource;",
      "Threatens the unity, integrity, defense, security, or sovereignty of India, friendly relations with foreign states, or public order or causes incitement to the commission of any cognizable offense or prevents investigation of any crime insulting any other nation.",
    ],
  },
  {
    title: "Use of Your Information",
    paras: [
      "We will use your information to provide personalized features to you on the Platform, to provide promotional offers to you through the Platform, to preserve transaction history as governed by existing law or policy, to use contact information internally to direct its efforts for product improvement, to contact you as a survey respondent, to notify you about your order, the products on the Platform and offer schemes and other promotional material or about Us. This helps us to administer the website, to learn about user behavior on the site, to improve our product and services, and gather demographic information about our user base as a whole.",
      "We may share the information that we collect with",
    ],
    list: [
      "service providers/our vendor’s consultants, marketing partners, advertisement agencies, research firms, and other service providers or business partners, such as Payment processing companies, associate companies to support our business,",
      "With our delivery partner,",
      "Governmental agencies or other companies assisting us, as required under applicable laws or in good faith, to respond to court orders and processes or to prevent or detect preventing against the actual or potential occurrence of identity theft, fraud, or other illegal acts.",
    ],
    after: [
      "Please be aware that the transmission of information via the internet is not completely secure. Although we will do our best to protect your data, we cannot guarantee the security of your data transmitted through the Platform. When you sign up for an account, you opt-in to receive emails from Us. You can follow the “unsubscribe” instructions in commercial email messages, but note that you cannot opt-out of receiving specific administrative notices, service notices, or legal notices from Us.",
    ],
  },
  {
    title: "Limitation of Liability",
    paras: [
      "We, in no event, shall be liable for any damages, including consequential, incidental, indirect, or special damages of any kind whatsoever in connection with this Privacy Policy or usage of the Platform or any part thereof by You or any third party.",
    ],
  },
  {
    title: "Governing Law and Dispute Resolution",
    paras: [
      "The laws of India govern this Privacy Policy. Any action, suit, or other legal proceedings commenced to resolve any matter arising under or relating to this Platform, or any part thereof shall be subject to the exclusive jurisdiction of the courts in Chhattisgarh, India.",
    ],
  },
  {
    title: "Complaints",
    paras: [
      "If you have any complaints about the products purchased from the Platform, you may notify Us about the same via phone at +91 8085959595 or at gaiafresh@vamaadairy.com, customercare@vamaadairy.com. We will assist you to the best of our abilities by providing relevant information and attempting to resolve your complaint.",
    ],
  },
];

export default function PrivacyPolicyPage() {
  return (
    <article className="mx-auto max-w-3xl px-5 py-10 text-sm leading-relaxed">
      <GaiaLogo className="mx-auto mb-6 w-40" />
      <h1 className="mb-1 text-2xl font-semibold">Privacy Policy</h1>
      <p className="mb-6 text-muted-foreground">Last updated: 10 November 2026</p>
      {SECTIONS.map((s, i) => (
        <section key={i} className="mb-6 space-y-3">
          {s.title && <h2 className="text-base font-semibold uppercase tracking-wide">{s.title}</h2>}
          {s.paras?.map((p, j) => <p key={j}>{p}</p>)}
          {s.list && (
            <ul className="list-disc space-y-1.5 pl-6">
              {s.list.map((l, j) => <li key={j}>{l}</li>)}
            </ul>
          )}
          {s.after?.map((p, j) => <p key={j}>{p}</p>)}
        </section>
      ))}
    </article>
  );
}
