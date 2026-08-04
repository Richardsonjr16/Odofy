import { createFileRoute, useRouter } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { readFile } from "node:fs/promises";
import { useRef, useState } from "react";
import {
  PRIVACY_STATEMENT_TITLE,
  PRIVACY_STATEMENT_LAST_UPDATED,
  PRIVACY_STATEMENT_SECTIONS,
} from "../utils/legalText";

const MASTER_ADMIN_EMAIL = 'support@getodofy.com'; // Master admin account — bypasses background checks

const getBusinessName = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const cfg = JSON.parse(await readFile("site.json", "utf8")) as {
      businessName?: string;
    };
    return cfg.businessName?.trim() ?? "Odofy";
  } catch {
    return "Odofy";
  }
});

export const Route = createFileRoute("/register")({
  loader: () => getBusinessName(),
  component: RegisterPage,
});

const TOS_SECTIONS = [
  {
    title: "Independent 1099 Contractor Status",
    body: "All Odofy couriers operate as independent contractors under IRS Form 1099 guidelines. You are responsible for your own tax reporting, fuel costs, vehicle maintenance, and any other business-related expenses.",
  },
  {
    title: "90% Minimum Trip Completion Rate",
    body: "Couriers must maintain a minimum 90% trip completion rate over any rolling 30-day period. Failure to meet this threshold may result in temporary or permanent suspension from the Odofy platform.",
  },
  {
    title: "Valid Missouri Driver's License and Auto Insurance",
    body: "All couriers must possess and maintain a valid Missouri state driver's license and active automobile insurance policy meeting Missouri minimum liability coverage requirements. Expired or suspended credentials will result in immediate account deactivation.",
  },
  {
    title: "100% Customer Data Privacy",
    body: "Couriers agree to strict data privacy standards. Customer names, phone numbers, addresses, and order details must never be shared, stored externally, or used for any purpose beyond the immediate delivery. Violation of this privacy policy constitutes grounds for immediate termination and may result in legal action.",
  },
  {
    title: "Fragile Cargo Safe-Handling",
    body: "Couriers must exercise reasonable care when transporting all packages. Fragile or marked packages must be secured in an upright position and protected from shifting during transit. Any cargo damage attributed to improper handling is the financial responsibility of the courier.",
  },
  {
    title: "Zero-Tolerance No Smoking or Vaping Policy",
    body: "Smoking, vaping, or the use of any tobacco or nicotine products inside the vehicle cabin during active deliveries is strictly prohibited. This is a zero-tolerance policy — a single confirmed violation will result in immediate and permanent deactivation from the Odofy platform.",
  },
];

const CHECKBOX_LABEL =
  "I have read, understand, and legally consent to the Odofy Driver Terms of Service, including the strict 100% smoke-free cargo mandate, and verify that my uploaded license and insurance documents are active and accurate.";

const REGISTER_URL = `/api/v1/odofy/drivers/register`;

const FILE_BLOCK_CLASS =
  "mt-1.5 block w-full rounded-lg border-2 border-slate-300 p-4 text-sm cursor-pointer hover:border-slate-400 transition";

function RegisterPage() {
  const businessName = Route.useLoaderData();
  const router = useRouter();

  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    backup_email: "",
    phone_number: "",
    vehicle_make_model: "",
  });

  const licenseRef = useRef<HTMLInputElement>(null);
  const insuranceRef = useRef<HTMLInputElement>(null);
  const profileRef = useRef<HTMLInputElement>(null);

  const [licenseFileName, setLicenseFileName] = useState<string | null>(null);
  const [insuranceFileName, setInsuranceFileName] = useState<string | null>(
    null,
  );
  const [profileFileName, setProfileFileName] = useState<string | null>(null);

  const [consent, setConsent] = useState(false);
  const [privacyConsent, setPrivacyConsent] = useState(false);
  const [isPrivacyModalOpen, setIsPrivacyModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    type: "success" | "error";
    message: string;
    authToken?: string;
  } | null>(null);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const isStudentEmail = form.email.toLowerCase().endsWith('.edu');

  const requiredTextFields = ['first_name', 'last_name', 'email', 'phone_number', 'vehicle_make_model'];
  if (isStudentEmail) {
    requiredTextFields.push('backup_email');
  }

  const textFieldsFilled = requiredTextFields.every(
    (key) => (form as Record<string, string>)[key].trim() !== "",
  );
  const allFilesSelected =
    licenseFileName !== null &&
    insuranceFileName !== null &&
    profileFileName !== null;
  const allFieldsFilled = textFieldsFilled && allFilesSelected;

  const handleFileChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    setter: (name: string | null) => void,
  ) => {
    const file = e.target.files?.[0];
    setter(file ? file.name : null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!allFieldsFilled || !consent || !privacyConsent) return;

    setLoading(true);
    setResult(null);

    // --- ADMINISTRATIVE BYPASS CHECK ---
    const isSystemAdministrator =
      form.email.toLowerCase() === MASTER_ADMIN_EMAIL.toLowerCase();

    try {
      const formData = new FormData();
      formData.append("first_name", form.first_name);
      formData.append("last_name", form.last_name);
      formData.append("email", form.email);
      if (isStudentEmail && form.backup_email) {
        formData.append("backup_email", form.backup_email);
      }
      formData.append("phone_number", form.phone_number);
      formData.append("vehicle_make_model", form.vehicle_make_model);

      // Admin override flag — bypasses background check, W-9, and waitlist
      if (isSystemAdministrator) {
        formData.append("admin_override", "true");
      }

      const licenseFile = licenseRef.current?.files?.[0];
      const insuranceFile = insuranceRef.current?.files?.[0];
      const profileFile = profileRef.current?.files?.[0];

      if (!licenseFile || !insuranceFile || !profileFile) {
        setResult({
          type: "error",
          message: "All three file uploads are required.",
        });
        setLoading(false);
        return;
      }

      formData.append("license_photo", licenseFile);
      formData.append("insurance_proof", insuranceFile);
      formData.append("profile_photo", profileFile);

      const res = await fetch(REGISTER_URL, {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (res.status === 201) {
        sessionStorage.setItem("odofy_driver_token", data.auth_token);
        sessionStorage.setItem("odofy_driver_profile", JSON.stringify({
          first_name: form.first_name,
          last_name: form.last_name,
          profile_photo_url: null,
          license_photo_url: null,
          insurance_proof_url: null,
          email: null,
          status: data.status || (isSystemAdministrator ? "APPROVED" : "PENDING_REVIEW"),
        }));

        if (isSystemAdministrator) {
          // Admin: skip waitlist, wipe form, and route directly to live dashboard
          setResult({
            type: "success",
            message: "Administrative override — account approved instantly. Routing to dashboard…",
            authToken: data.auth_token,
          });
          setTimeout(() => {
            router.navigate({ to: "/dashboard" });
          }, 800);
        } else {
          // Normal flow: standard pending admin review
          setResult({
            type: "success",
            message:
              "Registration submitted successfully! Your application is pending admin review. Your auth token has been saved:",
            authToken: data.auth_token,
          });
        }
      } else if (res.status === 409) {
        setResult({
          type: "error",
          message:
            data.error ||
            "A driver with this phone number is already registered.",
        });
      } else {
        setResult({
          type: "error",
          message: data.error || `Request failed with status ${res.status}`,
        });
      }
    } catch (err) {
      setResult({
        type: "error",
        message: err instanceof Error ? err.message : "Network error",
      });
    } finally {
      setLoading(false);
    }
  };

  const fieldClass =
    "mt-1.5 block w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm shadow-sm focus:border-msu-maroon focus:ring-2 focus:ring-msu-maroon/30 outline-none transition";

  return (
    <div className="min-h-dvh bg-white text-charcoal">
      <nav className="flex items-center justify-between px-6 py-5 sm:px-8 lg:px-12 border-b border-gray-100">
        <a
          href="/"
          className="text-xl font-bold tracking-tight text-msu-maroon hover:text-msu-maroon/80"
        >
          {businessName}
        </a>
      </nav>

      <main className="px-6 py-12 sm:px-8 lg:px-12">
        <div className="mx-auto max-w-lg">
          <h1 className="text-2xl font-bold tracking-tight text-msu-maroon sm:text-3xl">
            Driver Registration
          </h1>
          <p className="mt-2 text-charcoal">
            Complete the form below to apply as an independent courier with{" "}
            {businessName}.
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="first_name"
                  className="block text-sm font-semibold text-gray-700"
                >
                  First Name
                </label>
                <input
                  id="first_name"
                  name="first_name"
                  type="text"
                  required
                  value={form.first_name}
                  onChange={handleChange}
                  placeholder="John"
                  className={fieldClass}
                />
              </div>
              <div>
                <label
                  htmlFor="last_name"
                  className="block text-sm font-semibold text-gray-700"
                >
                  Last Name
                </label>
                <input
                  id="last_name"
                  name="last_name"
                  type="text"
                  required
                  value={form.last_name}
                  onChange={handleChange}
                  placeholder="Doe"
                  className={fieldClass}
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="email"
                className="block text-sm font-semibold text-gray-700"
              >
                Email Address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                value={form.email}
                onChange={handleChange}
                placeholder="yourname@live.missouristate.edu"
                className={fieldClass}
              />
              <p className="text-[#5E0009] text-[11px] font-semibold mt-1 tracking-wide">* Required: You must register with your active college .edu email address to verify student driver status.</p>
            </div>

            {isStudentEmail && (
              <div>
                <label
                  htmlFor="backup_email"
                  className="block text-sm font-semibold text-gray-700"
                >
                  Personal Backup Email
                </label>
                <input
                  id="backup_email"
                  name="backup_email"
                  type="email"
                  required
                  value={form.backup_email}
                  onChange={handleChange}
                  placeholder="you@gmail.com"
                  className={fieldClass}
                />
                <p className="mt-1 text-xs text-gray-500">
                  Required for .edu registrations. We'll use this if your university email becomes inactive.
                </p>
              </div>
            )}

            <div>
              <label
                htmlFor="phone_number"
                className="block text-sm font-semibold text-gray-700"
              >
                Phone Number
              </label>
              <input
                id="phone_number"
                name="phone_number"
                type="tel"
                required
                value={form.phone_number}
                onChange={handleChange}
                placeholder="+1 555-123-4567"
                className={fieldClass}
              />
            </div>

            <div>
              <label
                htmlFor="vehicle_make_model"
                className="block text-sm font-semibold text-gray-700"
              >
                Vehicle Make &amp; Model
              </label>
              <input
                id="vehicle_make_model"
                name="vehicle_make_model"
                type="text"
                required
                value={form.vehicle_make_model}
                onChange={handleChange}
                placeholder="White Honda Civic"
                className={fieldClass}
              />
            </div>

            <div>
              <p className="block text-sm font-semibold text-gray-700">
                Driver's License Photo
              </p>
              <label className={FILE_BLOCK_CLASS}>
                <input
                  ref={licenseRef}
                  type="file"
                  accept=".jpg,.jpeg,.png,image/*"
                  className="hidden"
                  onChange={(e) => handleFileChange(e, setLicenseFileName)}
                />
                <span className="block text-center">
                  {licenseFileName ? (
                    <span className="text-green-700 font-medium">
                      ✅ {licenseFileName}
                    </span>
                  ) : (
                    <span className="text-gray-500">
                      📎 Tap to upload image or document
                    </span>
                  )}
                </span>
              </label>
            </div>

            <div>
              <p className="block text-sm font-semibold text-gray-700">
                Proof of Auto Insurance
              </p>
              <label className={FILE_BLOCK_CLASS}>
                <input
                  ref={insuranceRef}
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  className="hidden"
                  onChange={(e) =>
                    handleFileChange(e, setInsuranceFileName)
                  }
                />
                <span className="block text-center">
                  {insuranceFileName ? (
                    <span className="text-green-700 font-medium">
                      ✅ {insuranceFileName}
                    </span>
                  ) : (
                    <span className="text-gray-500">
                      📎 Tap to upload image or document
                    </span>
                  )}
                </span>
              </label>
            </div>

            <div>
              <p className="block text-sm font-semibold text-gray-700">
                Driver Profile Photo
              </p>
              <label className={FILE_BLOCK_CLASS}>
                <input
                  ref={profileRef}
                  type="file"
                  accept="image/*"
                  capture="user"
                  id="profile_photo"
                  className="hidden"
                  onChange={(e) => handleFileChange(e, setProfileFileName)}
                />
                <span className="block text-center">
                  {profileFileName ? (
                    <span className="text-green-700 font-medium">
                      ✅ {profileFileName}
                    </span>
                  ) : (
                    <span className="text-gray-500">
                      📎 Tap to upload or take a selfie
                    </span>
                  )}
                </span>
              </label>
            </div>

            <div className="rounded-xl border-2 border-gray-300 bg-white p-1">
              <h2 className="px-4 pt-4 text-sm font-bold uppercase tracking-wide text-msu-maroon">
                Odofy Courier Independent Contractor Terms of Service
              </h2>
              <div className="mt-2 max-h-[250px] overflow-y-scroll border-y border-gray-200 bg-white px-4 py-3 text-charcoal">
                {TOS_SECTIONS.map((section) => (
                  <div key={section.title} className="mb-4 last:mb-0">
                    <h3 className="text-sm font-bold text-gray-900">
                      {section.title}
                    </h3>
                    <p className="mt-1 text-sm leading-relaxed text-gray-700">
                      {section.body}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 rounded border-gray-300 text-msu-maroon focus:ring-msu-maroon/30"
              />
              <span className="text-sm leading-relaxed text-gray-700">
                {CHECKBOX_LABEL}
              </span>
            </label>

            <label className="flex items-start gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={privacyConsent}
                onChange={(e) => setPrivacyConsent(e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 rounded border-gray-300 text-msu-maroon focus:ring-msu-maroon/30"
              />
              <span className="text-sm font-medium text-gray-700 leading-relaxed">
                I have read and agree to the Odofy Deliver{" "}
                <span
                  onClick={(e) => {
                    e.preventDefault();
                    setIsPrivacyModalOpen(true);
                  }}
                  className="font-bold cursor-pointer underline hover:opacity-80 transition-opacity"
                  style={{ color: "#5E0009" }}
                >
                  Privacy Statement
                </span>{" "}
                (Last Updated: {PRIVACY_STATEMENT_LAST_UPDATED}).
              </span>
            </label>

            <button
              type="submit"
              disabled={!consent || !privacyConsent || !allFieldsFilled || loading}
              className="w-full rounded-lg bg-msu-maroon px-6 py-3 text-base font-semibold text-white shadow-sm transition hover:bg-msu-maroon/80 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Submitting..." : "Submit Profile for Admin Review"}
            </button>
          </form>

          {/* ── PRIVACY STATEMENT MODAL ── */}
          {isPrivacyModalOpen && (
            <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50 animate-fade-in">
              <div className="bg-white rounded-2xl w-full max-w-lg max-h-[80vh] flex flex-col shadow-2xl p-6 relative border border-gray-100">
                {/* Close button */}
                <button
                  onClick={() => setIsPrivacyModalOpen(false)}
                  className="absolute top-4 right-4 text-sm font-semibold text-gray-500 hover:text-gray-800 transition-colors cursor-pointer"
                >
                  ✕ Close
                </button>

                {/* Title */}
                <h2 className="text-lg font-bold text-gray-900 pr-16">
                  {PRIVACY_STATEMENT_TITLE}
                </h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  Last updated: {PRIVACY_STATEMENT_LAST_UPDATED}
                </p>

                {/* Scrollable body */}
                <div className="overflow-y-auto text-sm text-gray-600 leading-relaxed pr-2 mt-4 space-y-4 font-normal">
                  {PRIVACY_STATEMENT_SECTIONS.map((section) => (
                    <div key={section.title}>
                      <h3 className="text-sm font-bold text-gray-900 mb-1">
                        {section.title}
                      </h3>
                      <p className="whitespace-pre-wrap">{section.body}</p>
                    </div>
                  ))}
                  <p className="text-xs text-gray-400 pt-2 border-t border-gray-100">
                    For privacy-related inquiries, contact{" "}
                    <a
                      href="mailto:support@getodofy.com"
                      className="text-msu-maroon underline"
                    >
                      support@getodofy.com
                    </a>
                    .
                  </p>
                </div>
              </div>
            </div>
          )}

          {result && (
            <div
              className={`mt-6 rounded-xl border p-5 ${
                result.type === "success"
                  ? "border-green-200 bg-green-50"
                  : "border-red-200 bg-red-50"
              }`}
            >
              <p
                className={`text-sm font-semibold ${
                  result.type === "success"
                    ? "text-green-800"
                    : "text-red-800"
                }`}
              >
                {result.type === "success" ? "✓" : "✗"} {result.message}
              </p>
              {result.authToken && (
                <pre className="mt-3 overflow-x-auto rounded-lg bg-white/50 p-3 text-xs text-gray-700 break-all">
                  {result.authToken}
                </pre>
              )}
            </div>
          )}
        </div>
      </main>

      <footer className="border-t border-gray-100 px-6 py-8 text-center sm:px-8 lg:px-12">
        <p className="text-sm text-gray-400">
          &copy; {new Date().getFullYear()} {businessName}.
        </p>
      </footer>
    </div>
  );
}
