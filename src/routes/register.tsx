import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { readFile } from "node:fs/promises";
import { useRef, useState } from "react";

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

const REGISTER_URL = `https://getodofy.com/api/v1/odofy/drivers/register`;

const FILE_BLOCK_CLASS =
  "mt-1.5 block w-full rounded-lg border-2 border-slate-300 p-4 text-sm cursor-pointer hover:border-slate-400 transition";

function RegisterPage() {
  const businessName = Route.useLoaderData();

  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
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

  const textFieldsFilled = Object.values(form).every(
    (v) => v.trim() !== "",
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
    if (!allFieldsFilled || !consent) return;

    setLoading(true);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("first_name", form.first_name);
      formData.append("last_name", form.last_name);
      formData.append("phone_number", form.phone_number);
      formData.append("vehicle_make_model", form.vehicle_make_model);

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
          status: data.status || "PENDING_REVIEW",
        }));
        setResult({
          type: "success",
          message:
            "Registration submitted successfully! Your application is pending admin review. Your auth token has been saved:",
          authToken: data.auth_token,
        });
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
                  accept=".jpg,.jpeg,.png,image/*"
                  capture="environment"
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

            <button
              type="submit"
              disabled={!consent || !allFieldsFilled || loading}
              className="w-full rounded-lg bg-msu-maroon px-6 py-3 text-base font-semibold text-white shadow-sm transition hover:bg-msu-maroon/80 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Submitting..." : "Submit Profile for Admin Review"}
            </button>
          </form>

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
