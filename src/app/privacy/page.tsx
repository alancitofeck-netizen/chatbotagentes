import type { Metadata } from "next";
import { LegalPageLayout } from "@/components/legal/LegalPageLayout";

export const metadata: Metadata = {
  title: "Política de Privacidad — GrowthLink",
  description:
    "Cómo GrowthLink recopila, usa, almacena y protege tus datos, incluyendo el uso de Google OAuth, Google Calendar, Google Drive y Google Sheets.",
};

const LAST_UPDATED = "24 de julio de 2026";
const CONTACT_EMAIL = "support@growthlink.uk";

export default function PrivacyPolicyPage() {
  return (
    <LegalPageLayout title="Política de Privacidad" lastUpdated={LAST_UPDATED}>
      <p>
        Esta Política de Privacidad describe cómo <strong>GrowthLink</strong> (“GrowthLink”, “nosotros”, “la
        plataforma”) recopila, utiliza, almacena y protege la información de las personas y empresas que usan el
        servicio, disponible en <a href="https://www.growthlink.uk">https://www.growthlink.uk</a>.
      </p>

      <h2>1. Qué es GrowthLink</h2>
      <p>
        GrowthLink es una plataforma de software como servicio (SaaS) para la gestión conversacional de negocios sobre
        WhatsApp. Permite a una empresa (un “Workspace”) centralizar su bandeja de conversaciones de WhatsApp,
        atenderlas con agentes humanos y con inteligencia artificial, y gestionar su operación comercial a través de
        módulos como un CRM de ventas, un módulo de reclutamiento (ATS), un calendario, un gestor de documentos y un
        panel de indicadores (KPIs). Cada Workspace es una cuenta independiente: sus datos están aislados de los de
        cualquier otro Workspace que use GrowthLink.
      </p>

      <h2>2. Qué servicios ofrece</h2>
      <ul>
        <li>Bandeja de entrada unificada de conversaciones de WhatsApp (a través de nuestro proveedor de mensajería, YCloud).</li>
        <li>Respuestas asistidas o automatizadas mediante inteligencia artificial (a través de proveedores de modelos de lenguaje, como OpenRouter).</li>
        <li>Un CRM para gestionar contactos, empresas y oportunidades de venta.</li>
        <li>Un módulo de reclutamiento (ATS) para gestionar vacantes y candidatos.</li>
        <li>Un calendario interno, con sincronización opcional con Google Calendar.</li>
        <li>Un gestor de documentos, con importación/exportación opcional desde Google Drive.</li>
        <li>Un panel de indicadores (KPIs), con lectura opcional de datos desde Google Sheets.</li>
        <li>Inicio de sesión y registro de cuenta, incluyendo la opción de “Continuar con Google”.</li>
      </ul>

      <h2>3. Qué información recopilamos</h2>
      <h3>3.1 Datos de la cuenta</h3>
      <p>
        Al crear una cuenta recopilamos tu nombre, correo electrónico y, si te registrás con correo y contraseña, una
        contraseña (almacenada siempre en forma cifrada, nunca en texto plano). Si te registrás o iniciás sesión con
        “Continuar con Google”, recibimos tu identificador de cuenta de Google, nombre, correo electrónico y foto de
        perfil — ver sección 7.
      </p>
      <h3>3.2 Datos que vos cargás en la plataforma</h3>
      <p>
        Como parte del uso normal del servicio, tu Workspace puede almacenar datos que vos mismo cargás o que se
        generan por el uso de la plataforma: contactos y números de WhatsApp de tus propios clientes, el contenido de
        las conversaciones de WhatsApp que gestionás a través de GrowthLink, información de oportunidades comerciales,
        candidatos de un proceso de selección, eventos de calendario, documentos que subís o importás, y datos de
        indicadores (KPIs) que se leen desde una hoja de Google Sheets que vos conectás. Estos datos pertenecen a tu
        Workspace y a vos como responsable de esa información, no a GrowthLink.
      </p>
      <h3>3.3 Datos técnicos</h3>
      <p>
        Recopilamos datos técnicos básicos para operar el servicio de forma segura: dirección IP, tipo de navegador,
        fecha y hora de inicio de sesión, y registros (logs) de actividad relevantes para diagnosticar errores y
        prevenir accesos no autorizados.
      </p>

      <h2>4. Cómo almacenamos y protegemos tus datos</h2>
      <p>
        Los datos se almacenan en Supabase (infraestructura sobre PostgreSQL), con controles de seguridad a nivel de
        fila (Row Level Security) que garantizan que los datos de un Workspace nunca sean accesibles desde otro
        Workspace. Las contraseñas se almacenan cifradas mediante el sistema de autenticación de Supabase, nunca en
        texto plano. Los tokens de acceso de integraciones externas (incluyendo Google) se almacenan cifrados mediante
        Supabase Vault, un mecanismo de cifrado dedicado para credenciales sensibles — nunca se guardan como texto
        plano en la base de datos. Toda la comunicación entre tu navegador y GrowthLink viaja cifrada mediante HTTPS.
      </p>

      <h2>5. Qué datos permanecen privados</h2>
      <p>
        Todos los datos que cargás en tu Workspace (contactos, conversaciones, oportunidades, candidatos, documentos,
        KPIs) son privados de ese Workspace. Solo pueden acceder a ellos los usuarios que vos invitaste a tu Workspace,
        de acuerdo con el rol que les asignaste (agente, administrador o propietario). GrowthLink no expone los datos
        de un Workspace a otros clientes de la plataforma bajo ninguna circunstancia.
      </p>

      <h2>6. Nunca vendemos tus datos</h2>
      <p>
        GrowthLink no vende, alquila ni comercializa tus datos personales ni los datos de tu Workspace a terceros, bajo
        ninguna circunstancia. Los datos solo se comparten con los proveedores estrictamente necesarios para operar el
        servicio que vos mismo decidís usar (por ejemplo, YCloud para el envío de mensajes de WhatsApp, u OpenRouter
        para generar respuestas con inteligencia artificial), y únicamente en la medida necesaria para prestar esa
        funcionalidad.
      </p>

      <h2>7. Cómo usamos las integraciones con Google</h2>
      <p>
        GrowthLink utiliza Google OAuth 2.0 exclusivamente para dos fines, separados y solicitados en momentos
        distintos:
      </p>
      <h3>7.1 Inicio de sesión con Google</h3>
      <p>
        Cuando elegís “Continuar con Google” para iniciar sesión o registrarte, solicitamos únicamente los permisos
        básicos de identidad: tu nombre, tu dirección de correo electrónico y tu foto de perfil (scopes{" "}
        <code>openid</code>, <code>email</code> y <code>profile</code>). Con esa información creamos o identificamos tu
        cuenta y tu Workspace. En este paso no solicitamos ningún permiso sobre Google Calendar, Google Drive ni Google
        Sheets.
      </p>
      <h3>7.2 Conexión opcional de Google Calendar, Google Drive y Google Sheets</h3>
      <p>
        Solo si vos decidís conectarlos explícitamente desde Perfil → Integraciones, GrowthLink solicita permisos
        adicionales y específicos para cada servicio, en ese momento (autorización incremental) — nunca durante el
        inicio de sesión inicial:
      </p>
      <ul>
        <li>
          <strong>Google Calendar:</strong> permite importar tus eventos existentes y sincronizar hacia tu calendario
          de Google los eventos que crees dentro del módulo Calendario de GrowthLink.
        </li>
        <li>
          <strong>Google Drive:</strong> permite navegar tus archivos de Drive para importarlos al módulo Documentos
          de GrowthLink, y exportar documentos generados en GrowthLink hacia una carpeta de tu Drive que vos elijas.
        </li>
        <li>
          <strong>Google Sheets:</strong> permite leer (en modo solo lectura) una hoja de cálculo que vos indiques,
          para mostrar sus datos de indicadores (KPIs) dentro del panel correspondiente de GrowthLink.
        </li>
      </ul>
      <p>
        Guardamos el identificador de tu cuenta de Google, tu nombre, tu correo electrónico, tu foto de perfil y los
        tokens de acceso necesarios (cifrados, ver sección 4) y la fecha de conexión. Nunca leemos ni accedemos a más
        información de tu cuenta de Google que la estrictamente necesaria para la funcionalidad que conectaste.
      </p>

      <h2>8. Cómo revocar el acceso de Google en cualquier momento</h2>
      <p>Podés revocar el acceso de GrowthLink a tu cuenta de Google en cualquier momento, de dos formas:</p>
      <ul>
        <li>
          Desde GrowthLink: Perfil → Integraciones → “Desconectar”, para Google Calendar, Google Drive o Google
          Sheets de forma individual.
        </li>
        <li>
          Directamente desde Google: en{" "}
          <a href="https://myaccount.google.com/permissions" target="_blank" rel="noreferrer">
            myaccount.google.com/permissions
          </a>
          , donde podés revocar el acceso de GrowthLink por completo.
        </li>
      </ul>
      <p>
        Al revocar el acceso, dejamos de poder usar esos tokens y no realizamos ninguna acción adicional sobre tu
        cuenta de Google.
      </p>

      <h2>9. Cómo solicitar la eliminación de tus datos</h2>
      <p>
        Podés solicitar la eliminación de tu cuenta y de los datos de tu Workspace escribiendo a{" "}
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>. Procesaremos la solicitud y eliminaremos los datos
        correspondientes de nuestros sistemas dentro de un plazo razonable, salvo que debamos conservar cierta
        información por un período adicional para cumplir con una obligación legal.
      </p>

      <h2>10. Tus derechos (GDPR y normativas de privacidad aplicables)</h2>
      <p>
        Si te encontrás en el Espacio Económico Europeo, el Reino Unido u otra jurisdicción con protecciones de
        privacidad equivalentes, tenés derecho a: acceder a tus datos personales, solicitar su rectificación,
        solicitar su eliminación, solicitar la portabilidad de tus datos, oponerte a determinados tratamientos y
        retirar tu consentimiento en cualquier momento. Podés ejercer cualquiera de estos derechos escribiendo a{" "}
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>. El uso de tus datos se basa en la ejecución del
        contrato de servicio con vos (los términos de uso de GrowthLink) y, en el caso de la integración con Google,
        en tu consentimiento explícito otorgado a través de la pantalla de autorización de Google.
      </p>

      <h2>11. Contacto</h2>
      <p>
        Para cualquier consulta sobre esta Política de Privacidad o sobre el tratamiento de tus datos, podés
        escribirnos a <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
      </p>

      <h2>12. Cambios a esta política</h2>
      <p>
        Podemos actualizar esta Política de Privacidad ocasionalmente para reflejar cambios en el servicio o en la
        normativa aplicable. La fecha de “Última actualización” al inicio de esta página siempre refleja la versión
        vigente.
      </p>
    </LegalPageLayout>
  );
}
