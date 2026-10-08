import type { Metadata } from "next";
import Link from "next/link";
import { getDb } from "@/db/client";
import { requireAdmin } from "@/lib/session";
import { isUuid } from "@/lib/portal-data";
import { ActionForm } from "@/components/action-form";
import { createInverterAction } from "../../actions";
import { InverterFields } from "../inverter-fields";
import { loadInverterFormOptions } from "../options";

export const metadata: Metadata = { title: "Wechselrichter anlegen" };

export default async function NewInverterPage({ searchParams }: PageProps<"/admin/inverters/new">) {
  await requireAdmin();
  const sp = await searchParams;
  const options = await loadInverterFormOptions(getDb());
  const device = typeof sp.device === "string" && isUuid(sp.device) ? sp.device : undefined;
  const customer = typeof sp.customer === "string" && isUuid(sp.customer) ? sp.customer : undefined;
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <Link href="/admin/inverters" className="link text-sm">← Wechselrichter</Link>
        <h1 className="text-2xl font-bold tracking-tight">Wechselrichter anlegen</h1>
        <p className="text-sm text-grey">
          Der Port wird automatisch vorgeschlagen (nächster freier Port des Gateways). Das Gateway übernimmt die Zuordnung beim nächsten Config-Abruf.
        </p>
      </div>
      {options.devices.length === 0 ? (
        <div className="panel text-sm">
          Zuerst ein <Link href="/admin/devices" className="link">Gateway registrieren</Link>.
        </div>
      ) : (
        <section className="panel">
          <ActionForm action={createInverterAction} submitLabel="Anlegen">
            <InverterFields options={options} initial={{ deviceId: device, customerId: customer, enabled: true }} />
          </ActionForm>
        </section>
      )}
    </div>
  );
}
