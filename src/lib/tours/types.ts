export interface TourStep {
  /** Debe matchear un atributo `data-tour="..."` real ya agregado al DOM —
   * el motor nunca resalta por coordenadas fijas (ver §37 del pedido). */
  target: string;
  title: string;
  description: string;
  placement?: "top" | "bottom" | "left" | "right";
  /** 'click' = el paso espera que el usuario haga click real en el target
   * antes de avanzar (aprender haciendo) — el botón "Siguiente" se oculta
   * para ese paso. 'none' (default) = el paso avanza con "Siguiente". */
  action?: "click" | "none";
  spotlightPadding?: number;
}

export interface TourConfig {
  /** Clave estable, persistida en learning_progress (kind='tour'). */
  key: string;
  /** Módulo del sidebar al que pertenece — usado por ModuleHelp/HelpCenter para encontrar "el tutorial de este módulo". */
  moduleKey: string;
  title: string;
  steps: TourStep[];
  /** Mensaje de cierre (§5 "Al finalizar") — se muestra como un toast breve
   * en vez de un paso más con spotlight, porque no hay ningún elemento real
   * al que apuntar después del último paso (p. ej. el lead ya se guardó y el
   * formulario se cerró). Opcional: si no se define, el tour simplemente
   * termina sin mensaje extra. */
  completionTitle?: string;
  completionDescription?: string;
}
