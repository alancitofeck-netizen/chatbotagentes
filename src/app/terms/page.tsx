import type { Metadata } from "next";
import { LegalPageLayout } from "@/components/legal/LegalPageLayout";

export const metadata: Metadata = {
  title: "Términos y Condiciones — Growth Link",
  description:
    "Condiciones de uso de Growth Link: responsabilidades del usuario, uso aceptable, integraciones con terceros, propiedad intelectual y legislación aplicable.",
};

const LAST_UPDATED = "24 de julio de 2026";
const CONTACT_EMAIL = "support@growthlink.uk";

export default function TermsPage() {
  return (
    <LegalPageLayout title="Términos y Condiciones" lastUpdated={LAST_UPDATED}>
      <p>
        Estos Términos y Condiciones (“Términos”) regulan el uso de <strong>Growth Link</strong>, la plataforma
        disponible en <a href="https://www.growthlink.uk">https://www.growthlink.uk</a>. Al crear una cuenta o usar el
        servicio, aceptás estos Términos en su totalidad. Si no estás de acuerdo, no debés usar Growth Link.
      </p>

      <h2>1. Condiciones de uso del servicio</h2>
      <p>
        Growth Link es un servicio provisto bajo la modalidad de software como servicio (SaaS), organizado en
        Workspaces independientes. Cada Workspace es responsable de la información que carga y de la actividad
        realizada por los usuarios que invita a ese Workspace. El acceso al servicio requiere una cuenta válida,
        creada mediante correo y contraseña o mediante “Continuar con Google”.
      </p>

      <h2>2. Responsabilidades del usuario</h2>
      <ul>
        <li>Mantener la confidencialidad de tus credenciales de acceso y notificarnos ante cualquier uso no autorizado de tu cuenta.</li>
        <li>Garantizar que la información que cargás en Growth Link (contactos, conversaciones, candidatos, documentos) fue obtenida de forma lícita y que tenés derecho a tratarla.</li>
        <li>Cumplir con la normativa aplicable al envío de mensajes de WhatsApp a tus propios contactos (incluyendo, cuando corresponda, contar con el consentimiento de esos contactos).</li>
        <li>Usar las credenciales de las integraciones que conectás (Google, WhatsApp/YCloud, OpenRouter u otras) exclusivamente para los fines previstos por Growth Link.</li>
      </ul>

      <h2>3. Uso aceptable de la plataforma</h2>
      <p>Al usar Growth Link, te comprometés a no utilizarlo para:</p>
      <ul>
        <li>Enviar mensajes masivos no solicitados (spam) o contenido engañoso, fraudulento o ilegal.</li>
        <li>Vulnerar, intentar vulnerar o eludir las medidas de seguridad de la plataforma o de sus integraciones.</li>
        <li>Acceder o intentar acceder a datos de otro Workspace distinto del tuyo.</li>
        <li>Sobrecargar deliberadamente la infraestructura del servicio o interferir con su funcionamiento normal.</li>
        <li>Utilizar la plataforma para actividades que infrinjan derechos de terceros, incluyendo propiedad intelectual o privacidad.</li>
      </ul>

      <h2>4. Restricciones</h2>
      <p>
        No está permitido revender, sublicenciar o redistribuir el acceso a Growth Link a terceros sin autorización
        previa por escrito. No está permitido realizar ingeniería inversa del software, ni extraer de forma masiva
        (scraping) datos de la plataforma más allá de las funciones de exportación que Growth Link ofrece
        explícitamente.
      </p>

      <h2>5. Propiedad intelectual</h2>
      <p>
        El software, el diseño, la marca “Growth Link” y demás elementos de la plataforma son propiedad de quien opera
        Growth Link. Los datos que cargás en tu Workspace (contactos, conversaciones, documentos y demás contenido)
        siguen siendo de tu propiedad o de la propiedad de quien corresponda legalmente; Growth Link solo los aloja y
        procesa en tu nombre para prestar el servicio.
      </p>

      <h2>6. Uso de las API de Google</h2>
      <p>
        Growth Link utiliza las API de Google (Google Identity/OAuth, Google Calendar, Google Drive y Google Sheets)
        exclusivamente para las funcionalidades descritas en nuestra{" "}
        <a href="/privacy">Política de Privacidad</a>. El uso de estas API por parte de Growth Link cumple con las{" "}
        <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noreferrer">
          Políticas de Datos de Usuario de los Servicios de API de Google
        </a>
        , incluyendo los requisitos de Uso Limitado (Limited Use). Sos responsable de conectar únicamente cuentas de
        Google sobre las que tengas autorización para operar.
      </p>

      <h2>7. Integraciones con terceros</h2>
      <p>
        Growth Link se integra con proveedores externos para prestar determinadas funcionalidades, entre ellos: YCloud
        (envío y recepción de mensajes de WhatsApp Business), OpenRouter (generación de respuestas mediante
        inteligencia artificial) y Google (identidad, Calendar, Drive y Sheets, según lo detallado en la sección 6).
        El uso de estas integraciones está sujeto adicionalmente a los propios términos de servicio de cada proveedor.
        Growth Link no es responsable por interrupciones o cambios en los servicios de estos terceros que estén fuera
        de su control.
      </p>

      <h2>8. Suspensión o cancelación de cuentas</h2>
      <p>
        Podemos suspender o cancelar el acceso a una cuenta o Workspace, con aviso previo cuando sea razonablemente
        posible, en caso de incumplimiento de estos Términos, uso indebido de la plataforma o de sus integraciones, o
        por requerimiento legal. Podés cancelar tu cuenta y solicitar la eliminación de tus datos en cualquier momento
        escribiendo a <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>, según lo descrito en nuestra{" "}
        <a href="/privacy">Política de Privacidad</a>.
      </p>

      <h2>9. Limitación de responsabilidad</h2>
      <p>
        Growth Link se ofrece “tal cual” (“as is”), sin garantías de disponibilidad ininterrumpida ni de ausencia total
        de errores. En la máxima medida permitida por la ley aplicable, no seremos responsables por daños indirectos,
        incidentales o consecuentes derivados del uso o la imposibilidad de uso del servicio, incluyendo pérdidas
        derivadas de fallas en integraciones de terceros (WhatsApp/YCloud, Google, proveedores de inteligencia
        artificial) que estén fuera de nuestro control razonable.
      </p>

      <h2>10. Cambios futuros en estos Términos</h2>
      <p>
        Podemos modificar estos Términos ocasionalmente para reflejar cambios en el servicio o en la normativa
        aplicable. Publicaremos la versión vigente en esta misma página, actualizando la fecha de “Última
        actualización”. El uso continuado de Growth Link luego de una actualización implica la aceptación de los
        Términos modificados.
      </p>

      <h2>11. Legislación aplicable</h2>
      <p>
        Estos Términos se rigen por las leyes de la República Argentina. Cualquier controversia derivada de estos
        Términos o del uso de Growth Link se someterá a los tribunales competentes de la República Argentina, sin
        perjuicio de los derechos de protección de datos que puedan corresponderte según tu propia jurisdicción de
        residencia (ver sección 10 de nuestra <a href="/privacy">Política de Privacidad</a>).
      </p>

      <h2>12. Contacto</h2>
      <p>
        Para cualquier consulta sobre estos Términos y Condiciones, podés escribirnos a{" "}
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
      </p>
    </LegalPageLayout>
  );
}
