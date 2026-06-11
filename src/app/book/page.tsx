"use client";

import { useState } from "react";
import { Calendar, CheckCircle2, Clock, Loader2, Video } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";

const labels = {
  en: {
    title: "Book a call to explore ChatZi",
    subtitle:
      "Choose a suitable time to speak with one of our specialists. We will show you how ChatZi can improve customer service and increase sales.",
    meetingDetails: "Meeting details",
    duration: "Duration",
    durationValue: "30 minutes",
    location: "Location",
    locationValue: "Google Meet or Zoom",
    quote:
      "\"One call was enough to completely change how we communicate with customers. The ChatZi team was very professional.\"",
    firstName: "First name",
    firstNamePlaceholder: "Ahmed",
    lastName: "Last name",
    lastNamePlaceholder: "Mohamed",
    email: "Work email",
    company: "Company name",
    companyPlaceholder: "Modern Tech Company",
    notes: "How can we help? (optional)",
    notesPlaceholder: "I would like to ask about...",
    submit: "Confirm booking",
    requiredError: "Please enter your first name and work email.",
    requestError: "Something went wrong while booking.",
    successTitle: "Booking request confirmed!",
    successBody:
      "We received your request successfully. One of our representatives will contact you soon to schedule the best time and send the meeting link.",
    bookAgain: "Book another call"
  },
  ar: {
    title: "احجز موعداً للتعرف على المنصة",
    subtitle:
      "اختر الوقت المناسب للتحدث مع أحد خبرائنا. سنشرح لك كيف يمكن لمنصة ChatZi تطوير خدمة العملاء لديك وزيادة مبيعاتك.",
    meetingDetails: "تفاصيل الاجتماع",
    duration: "المدة",
    durationValue: "30 دقيقة",
    location: "المكان",
    locationValue: "Google Meet أو Zoom",
    quote:
      "\"مكالمة واحدة كانت كفيلة بتغيير طريقة تواصلنا مع عملائنا بالكامل. فريق ChatZi احترافي جداً.\"",
    firstName: "الاسم الأول",
    firstNamePlaceholder: "أحمد",
    lastName: "اسم العائلة",
    lastNamePlaceholder: "محمد",
    email: "البريد الإلكتروني للعمل",
    company: "اسم الشركة",
    companyPlaceholder: "شركة التقنية الحديثة",
    notes: "كيف يمكننا مساعدتك؟ (اختياري)",
    notesPlaceholder: "أرغب في الاستفسار عن...",
    submit: "تأكيد الحجز",
    requiredError: "يرجى إدخال الاسم الأول والبريد الإلكتروني.",
    requestError: "حدث خطأ أثناء الحجز.",
    successTitle: "تم تأكيد طلب الحجز!",
    successBody:
      "لقد تلقينا طلبك بنجاح. سيقوم أحد ممثلينا بالتواصل معك قريباً لتحديد الوقت المناسب وإرسال رابط الاجتماع.",
    bookAgain: "حجز موعد آخر"
  }
} as const;

export default function BookPage() {
  const { locale, dir } = useI18n();
  const copy = labels[locale];
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    company: "",
    notes: ""
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.id]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.firstName || !formData.email) {
      setError(copy.requiredError);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData)
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || copy.requestError);

      setSuccess(true);
      setFormData({ firstName: "", lastName: "", email: "", company: "", notes: "" });
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.requestError);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main dir={dir} className="theme-rescue min-h-screen bg-slate-50 px-4 py-8 sm:px-6 sm:py-12 lg:px-8 lg:py-16">
      <div className="mx-auto max-w-3xl">
        <div className="mb-8 text-center sm:mb-12">
          <h1 className="mx-auto max-w-2xl text-3xl font-extrabold leading-tight tracking-tight text-slate-900 sm:text-4xl">
            {copy.title}
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-slate-600 sm:text-lg">
            {copy.subtitle}
          </p>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-950 sm:rounded-3xl md:flex">
          <section className="relative flex flex-col justify-between overflow-hidden bg-slate-900 p-6 text-white sm:p-8 md:w-2/5 md:p-10">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-white/20 via-transparent to-transparent" />

            <div className="relative z-10">
              <h2 className="mb-6 text-xl font-bold text-white">{copy.meetingDetails}</h2>

              <div className="space-y-6">
                <div className="flex items-start gap-4">
                  <span className="mt-1 rounded-lg bg-white/10 p-2">
                    <Clock size={20} className="text-blue-300" />
                  </span>
                  <span>
                    <span className="block font-semibold text-white">{copy.duration}</span>
                    <span className="mt-1 block text-sm text-slate-300">{copy.durationValue}</span>
                  </span>
                </div>

                <div className="flex items-start gap-4">
                  <span className="mt-1 rounded-lg bg-white/10 p-2">
                    <Video size={20} className="text-purple-300" />
                  </span>
                  <span>
                    <span className="block font-semibold text-white">{copy.location}</span>
                    <span className="mt-1 block text-sm text-slate-300">{copy.locationValue}</span>
                  </span>
                </div>
              </div>
            </div>

            <p className="relative z-10 mt-10 text-sm leading-relaxed text-slate-300">{copy.quote}</p>
          </section>

          <section className="bg-white p-6 dark:bg-slate-950 sm:p-8 md:w-3/5 md:p-10">
            {success ? (
              <div className="flex h-full flex-col items-center justify-center py-10 text-center">
                <span className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-green-600 dark:bg-green-950/40 dark:text-green-300">
                  <CheckCircle2 size={32} />
                </span>
                <h2 className="text-2xl font-bold text-slate-900">{copy.successTitle}</h2>
                <p className="mt-3 text-slate-600">{copy.successBody}</p>
                <button type="button" onClick={() => setSuccess(false)} className="btn-secondary mt-6">
                  {copy.bookAgain}
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                {error ? <div className="callout-error">{error}</div> : null}

                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                  <Field
                    id="firstName"
                    label={`${copy.firstName} *`}
                    value={formData.firstName}
                    onChange={handleChange}
                    placeholder={copy.firstNamePlaceholder}
                    required
                  />
                  <Field
                    id="lastName"
                    label={copy.lastName}
                    value={formData.lastName}
                    onChange={handleChange}
                    placeholder={copy.lastNamePlaceholder}
                  />
                </div>

                <Field
                  id="email"
                  type="email"
                  label={`${copy.email} *`}
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="ahmed@company.com"
                  inputDir="ltr"
                  required
                />

                <Field
                  id="company"
                  label={copy.company}
                  value={formData.company}
                  onChange={handleChange}
                  placeholder={copy.companyPlaceholder}
                />

                <div>
                  <label htmlFor="notes" className="label">
                    {copy.notes}
                  </label>
                  <textarea
                    id="notes"
                    value={formData.notes}
                    onChange={handleChange}
                    rows={4}
                    className="field resize-none"
                    placeholder={copy.notesPlaceholder}
                  />
                </div>

                <button type="submit" disabled={loading} className="btn-primary w-full py-3.5 text-base">
                  {loading ? <Loader2 size={18} className="animate-spin" /> : <Calendar size={18} />}
                  {copy.submit}
                </button>
              </form>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  inputDir,
  required
}: {
  id: keyof typeof labels.en;
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder: string;
  type?: string;
  inputDir?: "ltr" | "rtl";
  required?: boolean;
}) {
  return (
    <div>
      <label htmlFor={id} className="label">
        {label}
      </label>
      <input
        type={type}
        id={id}
        value={value}
        onChange={onChange}
        required={required}
        dir={inputDir}
        className="field"
        placeholder={placeholder}
      />
    </div>
  );
}
