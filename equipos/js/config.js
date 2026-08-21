/* ============================================================
   config.js — constantes de dominio del módulo Sesiones/Equipos.
   Convenciones de CONTRACT.md: weekday ISO 1-7, posiciones con
   'sin definir' (espacio), estados de sesión en español.
   ============================================================ */

export const WEEKDAYS = [
  { iso: 1, corto: 'L', nombre: 'Lunes' },
  { iso: 2, corto: 'M', nombre: 'Martes' },
  { iso: 3, corto: 'X', nombre: 'Miércoles' },
  { iso: 4, corto: 'J', nombre: 'Jueves' },
  { iso: 5, corto: 'V', nombre: 'Viernes' },
  { iso: 6, corto: 'S', nombre: 'Sábado' },
  { iso: 7, corto: 'D', nombre: 'Domingo' },
];
export const weekdayNombre = (iso) => WEEKDAYS.find((d) => d.iso === iso)?.nombre || '—';
export const weekdayCorto = (iso) => WEEKDAYS.find((d) => d.iso === iso)?.corto || '·';

export const POSICIONES = ['base', 'escolta', 'alero', 'ala-pivot', 'pivot', 'sin definir'];

/*
   Cuatro se guardan y el quinto —`activa`— se DEDUCE del reloj y no
   existe en la base de datos (Tramo 3.4, decisión #17). Está aquí
   porque a la hora de PINTAR son cinco: ver data/estado-sesion.js.
*/
export const ESTADOS_SESION = {
  preliminar: 'Preliminar',
  programada: 'Programada',
  activa: 'Ahora mismo',
  realizada: 'Realizada',
  cancelada: 'Cancelada',
};

export const ESTADOS_JUGADOR = {
  activo: 'Activo',
  lesionado: 'Lesionado',
  baja: 'Baja',
};

// Categorías de objetivo (CONTRACT: con tilde, casan con exercises.type).
export const CATEGORIAS_OBJETIVO = ['técnico', 'táctico', 'físico'];
export const CATEGORIA_ABREV = { 'técnico': 'TÉC', 'táctico': 'TÁC', 'físico': 'FÍS' };

export const ESTADOS_OBJETIVO = {
  activo: 'Activo',
  conseguido: 'Conseguido',
  archivado: 'Archivado',
};

// Paleta curada de colores de equipo: identidad (bandas/puntos), nunca color
// de acción (la acción es siempre papaya). Armonizan con papaya y dan AA.
export const TEAM_COLORS = [
  '#1F6FEB', // azul
  '#2FA968', // verde
  '#8957E5', // violeta
  '#D4318C', // magenta
  '#C89B00', // mostaza
  '#0B8B8B', // teal
  '#C0392B', // teja
  '#5A6572', // gris pizarra
];

export const CATEGORIAS_EQUIPO = [
  'babybasket', 'premini', 'minibasket', 'alevin', 'infantil',
  'cadete', 'junior', 'senior',
];

/* ============================================================
   AVISOS PUSH (Tramo 4.7)

   La clave VAPID PÚBLICA. Es pública por diseño —el navegador la
   necesita para suscribirse y viaja en cada suscripción—, así que
   estar aquí no es una filtración. La PRIVADA vive solo en las
   variables de entorno de Netlify y no se escribe en ningún fichero.

   Cómo se generan (una vez, y valen para siempre):

     node tools/vapid.mjs

   Sin instalar nada: son un par ECDSA P-256 y Node los saca de su
   propio módulo `crypto`. La pública se pega aquí; la privada, en
   Netlify → Site settings → Environment variables, como
   VAPID_PRIVATE_KEY.

   Vacía = no hay avisos. La pantalla lo dice («falta la clave pública»)
   en vez de enseñar un botón que no funciona.
   ============================================================ */
export const VAPID_PUBLIC_KEY = 'BNXigVdbT7Rpc-ssIzhG_mw4I4eNPwFUI05SeVt5yRYaK1dbfxytH3EKmNpHklZXKZZBMtq1MJ5PlHADYfldPcc';

/** A quién contesta el servicio de push si algo va mal. */
export const VAPID_CONTACTO = 'mailto:playbook@cbpalencia.es';
