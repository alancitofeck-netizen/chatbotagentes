import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

const FUTURE_INTEGRATIONS = [
  "Salesforce",
  "HubSpot",
  "Pipedrive",
  "Zoho",
  "Kommo",
  "Monday",
  "Zapier",
  "Make",
  "Meta Ads",
  "Google Ads",
  "LinkedIn",
];

/** Puro espacio visual reservado — pedido explícito del usuario ("preparar
 * espacio para"), sin backend ni botón "Conectar" detrás de ninguna. */
export function FutureIntegrationsGrid() {
  return (
    <Card className="flex flex-col gap-4">
      <div>
        <p className="text-sm font-semibold text-foreground">Integraciones futuras</p>
        <p className="text-[13px] text-neutral-500">Espacio reservado — todavía no están conectadas</p>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {FUTURE_INTEGRATIONS.map((name) => (
          <div key={name} className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border-strong px-3 py-4 text-center">
            <p className="text-sm font-medium text-neutral-500">{name}</p>
            <Badge variant="neutral">Próximamente</Badge>
          </div>
        ))}
      </div>
    </Card>
  );
}
