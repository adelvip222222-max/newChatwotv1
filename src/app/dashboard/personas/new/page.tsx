import { PageHeader } from "@/components/dashboard/page-header";
import { getLocale } from "@/lib/i18n";
import { PersonaForm } from "@/components/dashboard/persona-form";

export default async function NewPersonaPage() {
  const locale = await getLocale();
  const isAr = locale === "ar";

  return (
    <>
      <PageHeader
        title={isAr ? "إضافة موظف آلي جديد" : "Add new AI persona"}
        description={
          isAr
            ? "قم بإنشاء شخصية AI جديدة وتحديد سيناريو المحادثة والأدوات المسموحة لها."
            : "Create a new AI persona and define its conversation scenario and allowed tools."
        }
        backHref="/dashboard/personas"
        backLabel={isAr ? "رجوع للموظفين" : "Back to personas"}
      />
      <section className="panel p-5 lg:p-6">
        <PersonaForm />
      </section>
    </>
  );
}
