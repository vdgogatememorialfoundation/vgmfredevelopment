import { getModule } from "@/lib/cms/modules";
import ModuleManager from "@/components/portal/ModuleManager";
import SettingsForm from "@/components/portal/SettingsForm";

export default function ModulePage({ moduleKey, create }: { moduleKey: string; create?: boolean }) {
  const mod = getModule(moduleKey);
  if (!mod) return <p className="text-sm text-red-600">Unknown mod.</p>;
  return mod.kind === "settings" ? <SettingsForm moduleKey={moduleKey} /> : <ModuleManager moduleKey={moduleKey} create={create} />;
}
