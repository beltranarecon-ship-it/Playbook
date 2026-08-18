/* Contenido del informe de cambios v3 — Playbook CBP.
   `hoy`    = qué existe hoy (lo escribe el desarrollo, no se rellena).
   `piezas` = elementos concretos que el entrenador puede marcar. */

module.exports.bloques = [

/* ══════════════════════════════════════════════════════════ */
{
  id: '0', titulo: 'Decisiones globales de la v3',
  intro: 'Antes de bajar a cada pantalla: las decisiones que afectan a TODA la aplicación. Lo que se marque aquí manda sobre lo que se marque después.',
  apartados: [
    {
      id: '0.1', titulo: 'Alcance y ambición de la v3',
      hoy: 'La v2 está en producción con tres áreas: Biblioteca + Taller de ejercicios, Equipos/Sesiones (calendario, planificador, post-sesión, partidos) y Dossier. 204 ejercicios en la biblioteca. Sin proceso de compilación: HTML, CSS y JavaScript directos sobre Netlify, con Supabase de base de datos.',
      piezas: ['Retoques sobre lo que ya hay', 'Rediseño completo de alguna área', 'Módulos nuevos que hoy no existen', 'Reescritura técnica por dentro', 'Solo contenido (más ejercicios)', 'Corregir errores conocidos'],
    },
    {
      id: '0.2', titulo: 'Identidad visual, colores y tema',
      hoy: 'Estilo inspirado en McLaren Racing: papaya (#FF6A00) reservado SIEMPRE para la acción, nunca para decorar. Tema claro en Equipos/Sesiones y oscuro en el acceso y la topbar. Cada equipo tiene su color de identidad de una paleta cerrada de ocho, que se usa en bandas y puntos, nunca como color de acción.',
      piezas: ['Paleta general', 'Papaya como único color de acción', 'Tema claro / oscuro / ambos', 'Colores de equipo', 'Logo y escudo del club', 'Iconos', 'Fondo de la pantalla de acceso', 'Sombras, bordes y esquinas'],
    },
    {
      id: '0.3', titulo: 'Tipografía y densidad de información',
      hoy: 'Tres tipografías con papel fijo: Saira Condensed en titulares, Archivo en el cuerpo y JetBrains Mono en los datos y cifras. Las pantallas son más bien espaciadas: se ve poco por pantalla pero se lee cómodo.',
      piezas: ['Tipografías', 'Tamaño de letra general', 'Más información por pantalla (más densa)', 'Menos información por pantalla (más aireada)', 'Tamaño de los números y datos'],
    },
    {
      id: '0.4', titulo: 'Navegación general y estructura',
      hoy: 'Barra superior con tres destinos: Ejercicios, Equipos y Calendario. Por dentro son tres aplicaciones distintas que comparten dominio y sesión. No hay buscador global, ni migas de pan, ni un acceso directo a «la sesión de hoy».',
      piezas: ['Menú principal', 'Buscador global (busca en todo)', 'Migas de pan / saber dónde estoy', 'Acceso directo a la sesión de hoy', 'Menú lateral fijo', 'Pantalla de inicio con resumen', 'Atajos de teclado'],
    },
    {
      id: '0.5', titulo: 'Móvil, tablet y uso real en el pabellón',
      hoy: 'Todo se adapta al móvil. En pantalla pequeña el visor del ejercicio se abre en ventana emergente en vez de en columna. El proyector va a pantalla completa. No hay nada pensado específicamente para usarlo de pie, con frío o con el móvil en una mano.',
      piezas: ['Tamaño de los botones', 'Uso con una sola mano', 'Uso con guantes o con frío', 'Legibilidad con sol o luz mala', 'Modo tablet en el banquillo', 'Instalar como aplicación en el móvil', 'Girar la pantalla'],
    },
    {
      id: '0.6', titulo: 'Textos, tono y ayuda al usuario',
      hoy: 'Todo en castellano, con vocabulario de entrenador. Los mensajes de error explican qué ha pasado. No hay ayuda contextual, ni tutorial inicial, ni manual.',
      piezas: ['Tono de los textos', 'Ayuda contextual (¿qué es esto?)', 'Tutorial la primera vez', 'Manual o guía', 'Mensajes de error', 'Textos de las pantallas vacías'],
    },
    {
      id: '0.7', titulo: 'Velocidad y tiempos de espera',
      hoy: 'Carga directa sin compilar, con esqueletos de carga mientras llegan los datos. La biblioteca trae los 204 ejercicios de una vez. Las animaciones se dibujan en el navegador en tiempo real.',
      piezas: ['Tiempo de arranque', 'Carga de la biblioteca', 'Fluidez de las animaciones', 'Esperas al guardar', 'Consumo de datos móviles', 'Consumo de batería'],
    },
    {
      id: '0.8', titulo: 'Accesibilidad',
      hoy: 'Contraste cuidado (AA) en la paleta de equipos, textos alternativos en imágenes, avisos anunciados a lectores de pantalla y reordenación de bloques con teclado además de con el ratón. No se ha auditado formalmente.',
      piezas: ['Contraste de color', 'Tamaño mínimo de texto', 'Navegación completa con teclado', 'Lectores de pantalla', 'Reducir animaciones', 'Daltonismo'],
    },
    {
      id: '0.9', titulo: 'Uso sin conexión',
      hoy: 'Hay un service worker que pide siempre la red primero y solo tira de la copia guardada si falla. Eso mantiene el código fresco, pero significa que sin cobertura solo funciona lo que ya se había visitado, y no se puede guardar nada.',
      piezas: ['Ver la sesión del día sin cobertura', 'Ver los ejercicios sin cobertura', 'Pasar lista sin cobertura y sincronizar después', 'Descargar un equipo entero para llevárselo', 'Aviso claro de «estás sin conexión»'],
    },
    {
      id: '0.10', titulo: 'Uso de inteligencia artificial y su coste',
      hoy: 'Decisión congelada en v2: coste de API casi cero. Solo hay UNA llamada a un modelo en toda la aplicación — generar la animación desde el texto del ejercicio. Todo lo demás (guion en castellano, sugerencias de ejercicios, dossier) son motores deterministas que no llaman a nada. El dossier se copia y se pega en un chat aparte a mano, a propósito.',
      piezas: ['Mantener el coste cero', 'Aceptar coste por uso', 'Chat integrado con la app', 'IA que propone la sesión entera', 'IA que analiza el dossier', 'IA que redacta el ejercicio desde una foto o vídeo', 'Quitar la IA del todo'],
    },
    {
      id: '0.11', titulo: 'Usuarios, roles y permisos',
      hoy: 'Dos roles: administrador y entrenador. El entrenador ve y gestiona sus equipos; el administrador crea temporadas, asigna entrenadores a equipos y define los periodos sin entrenamiento del club. El rol está blindado en la base de datos: nadie puede ascenderse a sí mismo. No existe ningún acceso para jugadores ni familias.',
      piezas: ['Roles actuales (admin / entrenador)', 'Rol de segundo entrenador o ayudante', 'Rol de coordinador de categoría', 'Acceso para jugadores', 'Acceso para familias', 'Quién ve los equipos de los demás', 'Compartir un ejercicio fuera del club'],
    },
    {
      id: '0.12', titulo: 'Lo que NO se debe tocar en la v3',
      hoy: 'Este apartado no describe nada: es para que dejes por escrito qué funciona bien y no quieres que nadie mueva. Ahorra discusiones más adelante.',
      piezas: ['El motor de animación', 'La biblioteca de ejercicios', 'El calendario', 'El planificador', 'La identidad visual', 'La estructura de la base de datos', 'El coste cero de IA'],
    },
  ],
},

/* ══════════════════════════════════════════════════════════ */
{
  id: '1', titulo: 'Acceso y cuenta',
  intro: 'La puerta de entrada y todo lo que rodea a la identidad del entrenador.',
  apartados: [
    {
      id: '1.1', titulo: 'Pantalla de acceso',
      hoy: 'Fondo oscuro con el escudo del club, correo y contraseña, y un mensaje de error en rojo cuando falla. No hay registro público: las cuentas se crean por dentro.',
      piezas: ['Diseño de la pantalla', 'Recordar sesión', 'Entrar con Google', 'Mensajes de error', 'Textos de bienvenida'],
    },
    {
      id: '1.2', titulo: 'Alta de entrenadores e invitaciones',
      hoy: 'No se puede dar de alta a nadie desde la aplicación. Las cuentas las crea el administrador directamente en el panel de Supabase, y después asigna el entrenador a sus equipos.',
      piezas: ['Invitar por correo desde la app', 'Pantalla de gestión de usuarios', 'Dar de baja a un entrenador', 'Ver quién ha entrado y cuándo'],
    },
    {
      id: '1.3', titulo: 'Contraseñas',
      hoy: 'No hay «he olvidado mi contraseña» en la pantalla de acceso, ni forma de cambiarla desde dentro de la aplicación.',
      piezas: ['Recuperar contraseña por correo', 'Cambiar la contraseña desde el perfil', 'Exigir contraseña fuerte', 'Verificación en dos pasos'],
    },
    {
      id: '1.4', titulo: 'Perfil del entrenador',
      hoy: 'Solo se guarda el nombre completo, que sale en la barra superior con las iniciales. No hay página de perfil, ni foto, ni preferencias personales.',
      piezas: ['Página de perfil', 'Foto', 'Preferencias (tema, vista por defecto)', 'Firma en los dossieres', 'Datos de contacto'],
    },
    {
      id: '1.5', titulo: 'Sesión abierta y cierre',
      hoy: 'La sesión se comparte entre las tres áreas de la aplicación. Hay botón de salir en la barra superior. Cuando la sesión caduca, te devuelve a la pantalla de acceso.',
      piezas: ['Cuánto dura la sesión abierta', 'Aviso antes de caducar', 'Cerrar sesión en todos los dispositivos'],
    },
  ],
},

/* ══════════════════════════════════════════════════════════ */
{
  id: '2', titulo: 'Biblioteca de ejercicios',
  intro: 'La pantalla donde están los 204 ejercicios del club y todo lo que se hace con ellos.',
  apartados: [
    {
      id: '2.1', titulo: 'Portada de la biblioteca',
      hoy: 'Titular «Ejercicios del club», contador de resultados, botón de nuevo ejercicio y una rejilla de tarjetas que aparecen escalonadas.',
      piezas: ['Titular y presentación', 'Contador de resultados', 'Botón de nuevo ejercicio', 'Rejilla de tarjetas', 'Pantalla cuando no hay resultados'],
    },
    {
      id: '2.2', titulo: 'Tarjeta del ejercicio y miniatura',
      hoy: 'Cada tarjeta enseña la miniatura de la pista, el nombre, el tipo, la dificultad y la duración. Las miniaturas se generan con una herramienta aparte; hoy hay 107 ejercicios sin miniatura.',
      piezas: ['Qué datos enseña la tarjeta', 'Tamaño de la tarjeta', 'Miniatura fija', 'Miniatura animada al pasar por encima', 'Marca de favorito visible', 'Ver el ejercicio sin abrirlo'],
    },
    {
      id: '2.3', titulo: 'Buscador',
      hoy: 'Busca en cinco campos a la vez (nombre, descripción, etiquetas, objetivos y notas), ignora las tildes y espera a que dejes de escribir. Atajo con la tecla «/».',
      piezas: ['Dónde busca', 'Velocidad de respuesta', 'Sugerencias mientras escribes', 'Búsquedas guardadas', 'Historial de búsquedas', 'Buscar por lo que hace el ejercicio, no por su nombre'],
    },
    {
      id: '2.4', titulo: 'Filtros',
      hoy: 'Dos desplegables — tipo de ejercicio y contenido — que se rellenan desde la propia biblioteca y enseñan cuántos ejercicios tiene cada opción. No se pueden combinar más de dos criterios.',
      piezas: ['Filtrar por dificultad', 'Filtrar por duración', 'Filtrar por número de jugadores', 'Filtrar por media pista / pista entera', 'Filtrar por oposición y presión', 'Filtrar por categoría o edad', 'Combinar varios filtros a la vez', 'Ver los filtros aplicados y quitarlos de uno en uno'],
    },
    {
      id: '2.5', titulo: 'Orden, agrupación y forma de ver la lista',
      hoy: 'El orden es fijo y la única vista es la rejilla de tarjetas. No se puede ordenar por duración, dificultad ni por los más usados, ni ver la biblioteca como lista compacta.',
      piezas: ['Ordenar por fecha, nombre, duración o dificultad', 'Ordenar por los más usados', 'Vista de lista compacta', 'Agrupar por contenido', 'Recordar cómo lo dejé la última vez'],
    },
    {
      id: '2.6', titulo: 'Favoritos y colecciones',
      hoy: 'Se puede marcar un ejercicio como favorito desde su ficha, pero no hay forma de filtrar por favoritos desde la biblioteca ni de agrupar ejercicios en carpetas o colecciones propias.',
      piezas: ['Filtro de favoritos', 'Carpetas o colecciones propias', 'Listas compartidas con el cuerpo técnico', 'Marcar favorito desde la tarjeta'],
    },
    {
      id: '2.7', titulo: 'Ficha de detalle del ejercicio',
      hoy: 'Dos columnas: a la izquierda la pista animada con sus controles, a la derecha todos los datos del ejercicio (objetivos, material, desarrollo, variantes, organización con 12, oposición, presión, densidad). Acciones: editar, duplicar, favorito, eliminar y proyector.',
      piezas: ['Reparto de las dos columnas', 'Qué datos se enseñan y en qué orden', 'El guion escrito paso a paso', 'Variantes y progresiones', 'Botones de acción', 'Ver ejercicios parecidos', 'Ver en qué sesiones se ha usado'],
    },
    {
      id: '2.8', titulo: 'Proyector (pantalla del pabellón)',
      hoy: 'Abre la pista a pantalla completa, lo más grande posible, con los controles de reproducción. Pensado para enseñárselo al equipo.',
      piezas: ['Tamaño de la pista', 'Controles de reproducción', 'Enseñar el nombre y el objetivo', 'Pasar de un ejercicio al siguiente sin salir', 'Proyectar la sesión entera seguida', 'Mando a distancia desde el móvil'],
    },
    {
      id: '2.9', titulo: 'Imprimir, exportar y compartir un ejercicio',
      hoy: 'No existe. No se puede sacar la ficha en PDF, ni imprimirla, ni mandarle un ejercicio a otro entrenador que no tenga cuenta.',
      piezas: ['Ficha en PDF', 'Imprimir en papel', 'Enlace para compartir', 'Mandar por WhatsApp', 'Exportar la animación como vídeo o GIF'],
    },
  ],
},

/* ══════════════════════════════════════════════════════════ */
{
  id: '3', titulo: 'Taller · crear y editar ejercicios',
  intro: 'El asistente de cuatro pasos con el que se dibuja y se anima un ejercicio nuevo.',
  apartados: [
    {
      id: '3.1', titulo: 'Flujo general del asistente',
      hoy: 'Cuatro pasos con barra de progreso. El borrador se guarda solo en el navegador mientras trabajas, y si te vas y vuelves te ofrece recuperarlo.',
      piezas: ['Número y orden de los pasos', 'Poder saltar de un paso a otro', 'Barra de progreso', 'Guardar a medias y seguir mañana', 'Salir sin perder nada', 'Crear un ejercicio rápido sin animación'],
    },
    {
      id: '3.2', titulo: 'Paso 0 · Nombre, tipo y pista',
      hoy: 'Nombre (máximo 80 caracteres), tipo de ejercicio de una lista de catorce, y elección de pista entre cuatro: minibasket entera, minibasket media, FIBA entera y FIBA media.',
      piezas: ['Lista de tipos de ejercicio', 'Las cuatro pistas', 'Añadir otra pista (media cancha con dos aros, pista de 3x3…)', 'Límite del nombre', 'Pedir la descripción ya aquí'],
    },
    {
      id: '3.3', titulo: 'Paso 1 · Pizarra: colocar los elementos',
      hoy: 'Paleta con jugadores del equipo A y del B, conos, balones y aros. Se colocan arrastrando sobre la pista. El contador de jugadores y material se rellena solo con lo que hay puesto.',
      piezas: ['Elementos de la paleta', 'Añadir elementos nuevos (escaleras, picas, colchonetas, sillas…)', 'Colocación con rejilla o imán', 'Duplicar y alinear elementos', 'Colocaciones típicas guardadas', 'Contador automático de material'],
    },
    {
      id: '3.4', titulo: 'Paso 1 · Filas, dorsales y equipos',
      hoy: 'Un cono puede ser una fila de jugadores: se indica cuántos son y hacia dónde miran, en ocho direcciones. Cada jugador puede llevar dorsal, y hay dos equipos (A y B) con colores distintos.',
      piezas: ['Filas de jugadores', 'Dorsales', 'Los dos equipos', 'Un tercer equipo o color', 'Distinguir entrenador o ayudante', 'Marcar quién lleva el balón'],
    },
    {
      id: '3.5', titulo: 'Paso 2 · Describir la jugada con palabras',
      hoy: 'Un cuadro de texto plegable donde se escribe en castellano lo que pasa: «el 3 bota hasta el codo, pasa al 5 y corta a canasta».',
      piezas: ['Tamaño y sitio del cuadro de texto', 'Ejemplos de cómo escribirlo', 'Dictar con la voz', 'Escribir fase a fase en vez de todo seguido', 'Vocabulario que entiende'],
    },
    {
      id: '3.6', titulo: 'Paso 2 · Generar la animación con IA',
      hoy: 'El botón «Generar animación» manda el texto a un modelo de Claude a través de una función del servidor. Si algo es ambiguo hace preguntas (a qué canasta, qué opción), y avisa de cómo ha interpretado cada cosa. Si el servidor no tiene la clave configurada, cae automáticamente a un lector local más basto y lo advierte en ámbar. Hoy la clave está SIN configurar en producción.',
      piezas: ['Calidad de la interpretación', 'Las preguntas que hace', 'Los avisos de interpretación', 'Velocidad de generación', 'Reintentar o pedir otra versión', 'Aviso cuando el servidor no tiene IA', 'Corregir hablando («no, el 5 va al otro lado»)'],
    },
    {
      id: '3.7', titulo: 'Paso 2 · Retocar la animación a mano',
      hoy: 'Se pueden mover los jugadores y ajustar las fases sin volver a generar nada, con deshacer y rehacer.',
      piezas: ['Mover jugadores', 'Cambiar los tiempos de cada fase', 'Añadir o quitar una fase', 'Cambiar el recorrido de una flecha', 'Deshacer y rehacer', 'Volver a la versión generada'],
    },
    {
      id: '3.8', titulo: 'Paso 3 · Datos y clasificación del ejercicio',
      hoy: 'Categoría (Minibasket o Basket, con su nivel), etiquetas, dificultad de 1 a 6 que la IA propone, duración con rango de minutos, objetivos de temporada, cómo montarlo con doce jugadores, y los dos ejes de exigencia: oposición y presión.',
      piezas: ['Qué campos se piden', 'Cuáles son obligatorios', 'Etiquetas sugeridas', 'La escala de dificultad', 'El rango de duración', 'Objetivos de temporada', 'Los ejes de oposición y presión', 'Material necesario', 'Variantes y progresiones'],
    },
    {
      id: '3.9', titulo: 'Guardar, borradores y recuperación',
      hoy: 'El borrador vive en el navegador hasta que se guarda. Al guardar, el ejercicio pasa a la biblioteca del club y lo ve todo el cuerpo técnico.',
      piezas: ['Aviso al salir con cambios sin guardar', 'Recuperar el borrador', 'Varios borradores a la vez', 'Guardar como privado hasta terminarlo', 'Quién puede ver lo que creo'],
    },
    {
      id: '3.10', titulo: 'Editor a pantalla completa',
      hoy: 'Para retocar un ejercicio ya guardado: pista grande editable, secuencia de fases que se reordena, nodos para curvar las flechas, panel de la fase seleccionada, deshacer/rehacer y atajos de teclado.',
      piezas: ['Tamaño de la pista', 'La tira de fases', 'Editar las flechas', 'Panel de la fase', 'Atajos de teclado', 'Vista previa mientras editas', 'Comparar con la versión anterior'],
    },
    {
      id: '3.11', titulo: 'Duplicar, versionar y borrar',
      hoy: 'Se puede duplicar un ejercicio para hacer una variante y se puede eliminar. No hay historial de versiones ni papelera: lo borrado se pierde.',
      piezas: ['Duplicar para hacer variantes', 'Historial de versiones', 'Papelera y recuperar lo borrado', 'Ver quién lo creó y cuándo se cambió', 'Enlazar variantes con el ejercicio original'],
    },
  ],
},

/* ══════════════════════════════════════════════════════════ */
{
  id: '4', titulo: 'Motor de animación',
  intro: 'Lo que hace que el ejercicio se mueva. No es una pantalla: es la maquinaria que alimenta la ficha, el visor del planificador y el proyector.',
  apartados: [
    {
      id: '4.1', titulo: 'Cómo se dibuja la pista y los jugadores',
      hoy: 'Simbología de entrenador: círculos con dorsal para los jugadores, triángulos para los conos, línea continua para el desplazamiento, discontinua para el pase, ondulada para el bote y línea con remate para el tiro. El balón se dibuja pegado a quien lo lleva.',
      piezas: ['Símbolos de jugador', 'Tipos de flecha', 'El balón', 'Colores de ataque y defensa', 'Grosor de las líneas', 'Rastro del recorrido', 'Números y etiquetas sobre la pista'],
    },
    {
      id: '4.2', titulo: 'Vocabulario de acciones que entiende',
      hoy: 'Nueve acciones: botar, cortar, pasar, tirar, bloquear, defender, rodear un cono, volver a la fila y recoger el rebote. Todo lo que se escriba tiene que caber en esas nueve.',
      piezas: ['Rebote ofensivo y defensivo', 'Fintas y cambios de dirección', 'Bloqueo directo y continuación', 'Puerta atrás', 'Aclarado', 'Cambio defensivo', 'Trampa o 2x1', 'Falta'],
    },
    {
      id: '4.3', titulo: 'Posiciones con nombre',
      hoy: 'La pista tiene puntos con nombre medidos de verdad (el codo, el poste bajo, la punta, la esquina, el tiro libre), y el sistema los usa tanto para animar como para escribir el guion.',
      piezas: ['Los nombres de las zonas', 'Añadir posiciones nuevas', 'Guardar posiciones propias del club', 'Que reconozca cómo hablo yo'],
    },
    {
      id: '4.4', titulo: 'Escala y distancias reales',
      hoy: 'Las distancias son fiables cerca del aro, pero se estiran cuando te alejas: una esquina de media pista mide unos 8,4 metros cuando en realidad son 6,6. Afecta a los avisos de «este tiro está demasiado lejos».',
      piezas: ['Precisión de las distancias', 'Avisos de tiro demasiado lejos', 'Enseñar los metros en pantalla', 'Medir con una regla sobre la pista'],
    },
    {
      id: '4.5', titulo: 'Defensa simulada',
      hoy: 'La defensa reacciona sola al ataque en vez de tener que dibujarle cada movimiento a mano.',
      piezas: ['Cómo de lista es la defensa', 'Tipos de defensa (individual, zona, presión)', 'Ayudas y rotaciones', 'Poder dibujar la defensa a mano cuando quiera'],
    },
    {
      id: '4.6', titulo: 'Reproducción de la animación',
      hoy: 'Controles de reproducir, pausar y barra de tiempo. La animación va por fases encadenadas.',
      piezas: ['Velocidad de reproducción', 'Repetir en bucle', 'Ir fase a fase', 'Saltar a una fase concreta', 'Ver todas las fases a la vez en papel', 'Pausar y arrastrar'],
    },
    {
      id: '4.7', titulo: 'Guion escrito en castellano',
      hoy: 'Un motor traduce la animación a palabras fase a fase («el 3 bota hacia el codo derecho · pasa al 5 · el 5 tira desde el poste bajo izquierdo»). No llama a ninguna IA: cuesta cero y siempre dice lo mismo.',
      piezas: ['Cómo está redactado', 'Nivel de detalle', 'Poder corregirlo a mano', 'Que lo lea en voz alta', 'Añadir consignas de entrenador'],
    },
    {
      id: '4.8', titulo: 'Miniaturas de los ejercicios',
      hoy: 'Las miniaturas se generan a mano, desde una herramienta interna que hay que abrir y pulsar con la sesión iniciada. Hoy hay 107 ejercicios sin miniatura, y unos cuantos con la miniatura antigua.',
      piezas: ['Generación automática al guardar', 'Calidad de la miniatura', 'Qué instante de la animación se elige', 'Miniatura animada'],
    },
  ],
},

/* ══════════════════════════════════════════════════════════ */
{
  id: '5', titulo: 'Equipos y plantilla',
  intro: 'Los equipos del club, sus jugadores y sus horarios.',
  apartados: [
    {
      id: '5.1', titulo: 'Lista de equipos',
      hoy: 'Página «mis equipos» con el color de cada uno, su categoría y su día de convocatoria.',
      piezas: ['Qué datos se ven de un vistazo', 'Orden de los equipos', 'Buscar entre los equipos', 'Ver los equipos de otros entrenadores', 'Archivar un equipo de temporadas pasadas'],
    },
    {
      id: '5.2', titulo: 'Alta de equipo',
      hoy: 'Todo en una página: datos, color, día de convocatoria y horarios semanales. Al guardar propone las sesiones de toda la temporada, y no genera nada hasta que lo confirmas.',
      piezas: ['Datos que se piden', 'Las ocho categorías', 'Elección de color', 'Los horarios en el alta', 'La previsualización antes de generar', 'Copiar un equipo de la temporada anterior'],
    },
    {
      id: '5.3', titulo: 'Plantilla de jugadores',
      hoy: 'Listado con dorsal, nombre, posición y estado (activo, lesionado o baja). Se pueden añadir de uno en uno o pegando una lista entera de golpe.',
      piezas: ['Datos del jugador', 'Pegar una lista', 'Estados (activo / lesionado / baja)', 'Las posiciones', 'Fecha de nacimiento y categoría', 'Orden de la plantilla', 'Importar desde Excel', 'Jugadores que suben de otro equipo'],
    },
    {
      id: '5.4', titulo: 'Ficha del jugador',
      hoy: 'Se guarda foto en un almacén privado por equipo. No hay ficha individual: no se puede abrir a un jugador y ver su asistencia, sus lesiones o su evolución.',
      piezas: ['Ficha individual del jugador', 'Su asistencia', 'Su historial de lesiones', 'Notas del entrenador sobre él', 'Objetivos individuales', 'Datos de contacto de la familia', 'Minutos y estadísticas'],
    },
    {
      id: '5.5', titulo: 'Horarios semanales',
      hoy: 'Se definen las franjas de entrenamiento por día de la semana, con hora de inicio y fin y lugar. De ahí sale el calendario entero.',
      piezas: ['Cómo se definen las franjas', 'Cambiar el horario a mitad de temporada', 'Varias pistas o pabellones', 'Entrenamientos compartidos entre equipos', 'Duración por defecto'],
    },
    {
      id: '5.6', titulo: 'Periodos sin entrenamiento',
      hoy: 'Vacaciones y parones. Los del club entero los define el administrador; se ven sombreados en el calendario y no se generan sesiones en ellos.',
      piezas: ['Periodos del club', 'Periodos de un equipo solo', 'Días sueltos', 'Aviso al planificar sobre un día sin entreno'],
    },
    {
      id: '5.7', titulo: 'Ajustes del equipo',
      hoy: 'Color de identidad, día de convocatoria, y dos interruptores: si se pasa lista y si se rellena reflexión después de entrenar. Los cambia el propio entrenador.',
      piezas: ['Los ajustes que hay', 'Ajustes nuevos', 'Objetivos por defecto del equipo', 'Duración típica de la sesión', 'Plantilla de sesión por defecto'],
    },
    {
      id: '5.8', titulo: 'Cuerpo técnico y accesos',
      hoy: 'Un equipo puede tener varios entrenadores, pero solo el administrador puede asignarlos. Quien crea el equipo se asigna solo automáticamente.',
      piezas: ['Que el entrenador invite a su ayudante', 'Distinguir primer y segundo entrenador', 'Permisos distintos por papel', 'Ver quién ha cambiado qué'],
    },
  ],
},

/* ══════════════════════════════════════════════════════════ */
{
  id: '6', titulo: 'Temporada y programación automática',
  intro: 'El armazón sobre el que cuelga todo el calendario.',
  apartados: [
    {
      id: '6.1', titulo: 'Temporadas',
      hoy: 'Hay una temporada activa de la que cuelgan horarios, objetivos y sesiones. Si la activa ya terminó, la aplicación lo avisa. Solo el administrador puede crear o activar temporadas.',
      piezas: ['Crear temporada', 'Cambiar de temporada', 'Ver temporadas pasadas', 'Que el entrenador pueda crearla', 'Aviso de temporada terminada'],
    },
    {
      id: '6.2', titulo: 'Generación automática de sesiones',
      hoy: 'A partir de los horarios y los periodos sin entrenamiento, genera todas las sesiones de la temporada en estado «preliminar».',
      piezas: ['Qué genera y cómo', 'Estado con el que nacen', 'Regenerar después de cambiar el horario', 'Generar solo un tramo de fechas', 'Numerar las sesiones'],
    },
    {
      id: '6.3', titulo: 'Vista previa y no pisar el trabajo hecho',
      hoy: 'Nada se genera sin enseñarte antes qué va a pasar. Cada sesión automática está atada a su franja y a su fecha, para que regenerar no duplique ni borre lo que ya habías planificado.',
      piezas: ['La vista previa', 'Qué pasa con las sesiones ya planificadas', 'Deshacer una generación', 'Aviso de conflictos'],
    },
  ],
},

/* ══════════════════════════════════════════════════════════ */
{
  id: '7', titulo: 'Calendario',
  intro: 'La vista donde el entrenador ve su temporada.',
  apartados: [
    {
      id: '7.1', titulo: 'Vista de mes',
      hoy: 'Rejilla mensual con una banda del color del equipo por sesión, los días sin entrenamiento sombreados y los partidos junto a los entrenamientos.',
      piezas: ['Cuánta información cabe por día', 'Los colores y las bandas', 'Los días sombreados', 'Los partidos en el mes', 'Moverse entre meses'],
    },
    {
      id: '7.2', titulo: 'Vista de semana',
      hoy: 'La semana con las sesiones colocadas por su hora.',
      piezas: ['Reparto por horas', 'Ver varios equipos a la vez', 'Detectar solapes de pista', 'Vista de día', 'Vista de temporada entera'],
    },
    {
      id: '7.3', titulo: 'Estados de la sesión',
      hoy: 'Cuatro estados con aspecto distinto: preliminar (contorno discontinuo), programada (relleno suave), realizada (sólida) y cancelada (tachada).',
      piezas: ['Los cuatro estados', 'Cómo se distinguen a la vista', 'Un estado nuevo', 'Cambiar el estado desde el calendario'],
    },
    {
      id: '7.4', titulo: 'Color por equipo y filtros',
      hoy: 'Cada equipo tiene su color y se puede filtrar el calendario por equipo.',
      piezas: ['Filtro por equipo', 'Filtrar por estado', 'Ver solo lo mío', 'Ocultar los partidos', 'Recordar el filtro'],
    },
    {
      id: '7.5', titulo: 'Panel del día y acciones rápidas',
      hoy: 'Al pulsar un día se abre un panel con lo que hay ese día y las acciones: planificar, cerrar, cancelar, borrar.',
      piezas: ['Qué se ve en el panel', 'Las acciones disponibles', 'Editar sin salir del calendario', 'Mover una sesión arrastrando', 'Duplicar una sesión a otro día'],
    },
    {
      id: '7.6', titulo: 'Alta manual y cancelaciones',
      hoy: 'Se pueden crear sesiones sueltas a mano, y cancelar una sesión dejando escrito el motivo. Una sesión cancelada no cuenta en ninguna media.',
      piezas: ['Alta manual', 'Motivo de cancelación', 'Recuperar una sesión cancelada', 'Cancelar varias de golpe', 'Avisar al equipo de la cancelación'],
    },
  ],
},

/* ══════════════════════════════════════════════════════════ */
{
  id: '8', titulo: 'Planificador de sesión',
  intro: 'Donde se monta el entrenamiento: objetivos, bloques, carga y el ejercicio a la vista.',
  apartados: [
    {
      id: '8.1', titulo: 'Estructura de la pantalla',
      hoy: 'Dos columnas en ordenador: a la izquierda el plan (objetivos, bloques y curva de carga) y a la derecha el visor del bloque seleccionado. En móvil el visor se abre en ventana emergente.',
      piezas: ['El reparto en dos columnas', 'Qué va en cada lado', 'Poder plegar el visor', 'Trabajar a pantalla completa', 'Cómo se ve en tablet'],
    },
    {
      id: '8.2', titulo: 'Bloques del entrenamiento',
      hoy: 'Cada bloque tiene título, ejercicio de la biblioteca, duración, intensidad de 1 a 5 y notas. Se reordenan arrastrando o con las flechas del teclado.',
      piezas: ['Datos de cada bloque', 'Reordenar', 'Bloques sin ejercicio (charla, agua, estiramientos)', 'Bloques que se repiten', 'Copiar un bloque de otra sesión', 'Sub-bloques o series', 'Aviso si la suma no cuadra con la duración'],
    },
    {
      id: '8.3', titulo: 'Elegir el ejercicio del bloque',
      hoy: 'Un selector que enseña la vista previa del ejercicio antes de meterlo, con buscador.',
      piezas: ['Buscador dentro del selector', 'Filtros dentro del selector', 'Vista previa', 'Sugerencias según el objetivo', 'Ejercicios usados recientemente', 'Aviso de repetición («esto ya lo hiciste el martes»)'],
    },
    {
      id: '8.4', titulo: 'Curva de carga',
      hoy: 'Un escalón por bloque: intensidad por duración. Cada escalón se puede pulsar para ir a su bloque. Enseña la carga total y la intensidad media.',
      piezas: ['Cómo se dibuja', 'La fórmula de la carga', 'Comparar con la sesión anterior', 'Carga de la semana entera', 'Avisos de carga excesiva', 'Carga por jugador'],
    },
    {
      id: '8.5', titulo: 'Visor del ejercicio dentro de la sesión',
      hoy: 'Enseña la pista animada, el guion paso a paso y la ficha del ejercicio del bloque seleccionado, sin salir de la sesión. Usa el mismo motor que el Taller.',
      piezas: ['Qué enseña', 'Tamaño de la pista', 'El guion', 'Editar el ejercicio desde aquí', 'Adaptar el ejercicio solo para esta sesión'],
    },
    {
      id: '8.6', titulo: 'Objetivos de la sesión',
      hoy: 'Se eligen los objetivos que se trabajan ese día, y quedan congelados en la sesión aunque el objetivo cambie después.',
      piezas: ['Cómo se eligen', 'Que se propongan solos', 'Enlazar objetivo y bloque', 'Cuántos objetivos por sesión'],
    },
    {
      id: '8.7', titulo: 'Título, lugar, material y notas',
      hoy: 'La sesión guarda título, lugar, hora, material y notas libres.',
      piezas: ['Material que se calcula solo desde los ejercicios', 'Notas antes y después', 'Cambiar el lugar puntualmente', 'Aviso de material que no hay'],
    },
    {
      id: '8.8', titulo: 'Llevarse la sesión al pabellón',
      hoy: 'No hay versión imprimible ni exportable de la sesión. O se lleva el móvil con la aplicación abierta, o se copia a mano.',
      piezas: ['Imprimir la sesión en una hoja', 'PDF de la sesión', 'Mandarla al ayudante por WhatsApp', 'Modo pabellón (letra grande, sin distracciones)', 'Cronómetro de bloque', 'Verla sin cobertura'],
    },
    {
      id: '8.9', titulo: 'Plantillas de sesión y reutilización',
      hoy: 'No existe. Cada sesión se monta desde cero, y no se puede duplicar una sesión buena ni guardar una estructura tipo.',
      piezas: ['Duplicar una sesión', 'Plantillas de sesión', 'Estructura por defecto del equipo', 'Biblioteca de sesiones montadas', 'Planificar la semana entera de una vez', 'Planificar por mesociclos'],
    },
  ],
},

/* ══════════════════════════════════════════════════════════ */
{
  id: '9', titulo: 'Después de entrenar',
  intro: 'Pasar lista, valorar cómo ha ido y cerrar la sesión.',
  apartados: [
    {
      id: '9.1', titulo: 'Pasar lista',
      hoy: 'Listado denso de la plantilla para marcar quién ha venido, pensado para hacerlo rápido en el pabellón.',
      piezas: ['Velocidad de pasar lista', 'Motivo de la falta', 'Marcar retrasos', 'Marcar lesionados sin repetirlo cada día', 'Pasar lista desde el móvil', 'Que se avise si falta pasar lista'],
    },
    {
      id: '9.2', titulo: 'Reflexión de la sesión',
      hoy: 'Un cuestionario propio del equipo con preguntas de estrellas (1 a 5) y de texto. Una de ellas, el cumplimiento del plan, es la que alimenta el seguimiento de objetivos.',
      piezas: ['Las preguntas que trae', 'Estrellas y texto', 'Preguntas obligatorias', 'Valorar a jugadores concretos', 'Que se pueda rellenar más tarde', 'Recordatorio si no se rellenó'],
    },
    {
      id: '9.3', titulo: 'Plantilla de preguntas del equipo',
      hoy: 'Cada equipo define sus preguntas y puede cambiarlas con el tiempo; las respuestas ya dadas conservan su significado original aunque la pregunta cambie después.',
      piezas: ['Editar las preguntas', 'Preguntas comunes del club', 'Orden de las preguntas', 'Activar y desactivar preguntas'],
    },
    {
      id: '9.4', titulo: 'Cerrar la sesión',
      hoy: '«Guardar y cerrar» marca la sesión como realizada. Una sesión cancelada no se puede cerrar.',
      piezas: ['El momento de cerrar', 'Reabrir una sesión cerrada', 'Cerrar en bloque las que quedaron sueltas', 'Qué es obligatorio para poder cerrar'],
    },
    {
      id: '9.5', titulo: 'Asistencia acumulada y estadísticas',
      hoy: 'Los números de asistencia se calculan y salen en el dossier: media del equipo y detalle por jugador. No hay una pantalla propia donde consultarlos.',
      piezas: ['Pantalla de asistencia del equipo', 'Gráfico de evolución', 'Alertas de ausencias repetidas', 'Exportar la asistencia', 'Asistencia por mes'],
    },
  ],
},

/* ══════════════════════════════════════════════════════════ */
{
  id: '10', titulo: 'Partidos',
  intro: 'La otra mitad del calendario: se entrena y se compite.',
  apartados: [
    {
      id: '10.1', titulo: 'Alta y calendario de partidos',
      hoy: 'Los partidos se dan de alta a mano y salen en el mismo calendario que los entrenamientos, con rival, local o visitante y estado.',
      piezas: ['Datos del partido', 'Importar el calendario de la federación', 'Partidos de pretemporada y torneos', 'Aviso de convocatoria'],
    },
    {
      id: '10.2', titulo: 'Marcador y resultado',
      hoy: 'Marcador a favor y en contra, y estado del partido: programado, jugado, aplazado o cancelado.',
      piezas: ['Marcador final', 'Marcador por cuartos', 'Marcador en directo', 'Balance de la temporada', 'Clasificación'],
    },
    {
      id: '10.3', titulo: 'Valoración del partido',
      hoy: 'Cinco valoraciones de 1 a 5: defensa, ataque, actitud, acierto y global.',
      piezas: ['Los cinco ejes', 'Cambiar los ejes', 'Valorar por jugador', 'Comparar con partidos anteriores', 'Valoración del rival'],
    },
    {
      id: '10.4', titulo: 'Claves del partido',
      hoy: 'Un texto libre donde se apunta lo que hay que recordar de ese partido.',
      piezas: ['Formato del texto', 'Claves antes del partido (plan de partido)', 'Claves después', 'Enlazar con objetivos'],
    },
    {
      id: '10.5', titulo: 'Acta del partido',
      hoy: 'Se sube una foto del acta a un almacén privado del equipo.',
      piezas: ['Subir foto', 'Varias fotos', 'Leer el acta automáticamente', 'Descargar el acta'],
    },
    {
      id: '10.6', titulo: 'Convocatoria',
      hoy: 'Existe la marca de convocatoria cerrada y el día de convocatoria del equipo, pero no hay pantalla para elegir a los convocados ni para comunicárselo a nadie.',
      piezas: ['Elegir convocados', 'Avisar a los jugadores', 'Confirmación de las familias', 'Historial de convocatorias', 'Minutos jugados'],
    },
    {
      id: '10.7', titulo: 'Estadísticas del partido',
      hoy: 'La base de datos tiene sitio reservado para el marcador por cuartos, los convocados y las estadísticas, pero no hay pantalla y las dos últimas migraciones están sin aplicar.',
      piezas: ['Estadísticas básicas (puntos, faltas, rebotes)', 'Anotar en directo', 'Estadísticas por jugador', 'Acumulados de temporada', 'Gráficos'],
    },
  ],
},

/* ══════════════════════════════════════════════════════════ */
{
  id: '11', titulo: 'Objetivos',
  intro: 'Qué se quiere conseguir y cómo se sigue la pista.',
  apartados: [
    {
      id: '11.1', titulo: 'Objetivos del equipo',
      hoy: 'Objetivos con título, categoría, descripción y estado (activo, conseguido, archivado). Se crean desde la pestaña del equipo o desde el propio calendario.',
      piezas: ['Datos del objetivo', 'Objetivos de temporada y de tramo', 'Fecha límite', 'Objetivos del club para todas las categorías', 'Objetivos individuales de jugador'],
    },
    {
      id: '11.2', titulo: 'Categorías de objetivo',
      hoy: 'Tres: técnico, táctico y físico.',
      piezas: ['Las tres categorías', 'Añadir categorías (psicológico, actitudinal, colectivo…)', 'Colores por categoría'],
    },
    {
      id: '11.3', titulo: 'Sugerencias de ejercicios',
      hoy: 'Al escribir un objetivo, la aplicación propone ejercicios de la biblioteca que encajan. Es un motor determinista que no llama a ninguna IA y no cuesta nada.',
      piezas: ['Calidad de las sugerencias', 'Cuántas propone', 'Explicar por qué propone cada una', 'Poder descartar sugerencias', 'Montar la sesión desde las sugerencias'],
    },
    {
      id: '11.4', titulo: 'Seguimiento del cumplimiento',
      hoy: 'De la reflexión post-sesión sale una medida de cumplimiento que alimenta el progreso del objetivo y aparece en el dossier.',
      piezas: ['Cómo se mide el progreso', 'Ver el progreso en pantalla', 'Cuántas sesiones se ha trabajado cada objetivo', 'Aviso de objetivos abandonados', 'Cerrar un objetivo conseguido'],
    },
  ],
},

/* ══════════════════════════════════════════════════════════ */
{
  id: '12', titulo: 'Dossier del equipo',
  intro: 'La memoria de la temporada, en un documento que te llevas.',
  apartados: [
    {
      id: '12.1', titulo: 'Qué contiene el dossier',
      hoy: 'Cómo va la temporada, objetivos, asistencia por jugador, sesión a sesión, partidos, notas del cuerpo técnico, y un apartado honesto de «lo que este dossier no pudo leer».',
      piezas: ['Los apartados que trae', 'Elegir qué apartados salen', 'Elegir el periodo', 'Nivel de detalle', 'Gráficos', 'Resumen de una página'],
    },
    {
      id: '12.2', titulo: 'Formato y salida',
      hoy: 'Se genera en Markdown y se copia al portapapeles o se descarga como archivo .md. Decisión congelada: no hay chat integrado ni llamada a ninguna IA — el documento es el producto y tú decides dónde lo pegas.',
      piezas: ['Markdown', 'PDF', 'Word', 'Enviar por correo', 'Chat integrado', 'Mantener el coste cero'],
    },
    {
      id: '12.3', titulo: 'Notas del cuerpo técnico',
      hoy: 'Notas escritas a mano que explican los números y se incorporan al documento.',
      piezas: ['Cómo se escriben', 'Notas por periodo', 'Notas privadas que no salen en el dossier', 'Plantilla de notas'],
    },
    {
      id: '12.4', titulo: 'Otros informes que hoy no existen',
      hoy: 'El dossier de equipo es el único informe de la aplicación. No hay informe de jugador, ni de club, ni de temporada comparada.',
      piezas: ['Informe individual de jugador', 'Informe del club entero', 'Comparar temporadas', 'Informe para la junta directiva', 'Informe para las familias'],
    },
  ],
},

/* ══════════════════════════════════════════════════════════ */
{
  id: '13', titulo: 'Contenido de la biblioteca (los 204 ejercicios)',
  intro: 'No la pantalla, sino lo que hay dentro: el material de entrenamiento en sí.',
  apartados: [
    {
      id: '13.1', titulo: 'Cobertura de contenidos',
      hoy: '204 ejercicios repartidos en catorce bloques (bote, tiro, pase, entrada, 1c1, juego de 2, defensa, rebote, contraataque, juego reducido, manejo, trabajo de pies, calentamiento y psicomotricidad), todos con contenido y ninguno vacío.',
      piezas: ['Bloques que faltan por reforzar', 'Contenidos nuevos', 'Más ejercicios de un bloque concreto', 'Ejercicios para categorías mayores', 'Ejercicios de portero de la semana / competición'],
    },
    {
      id: '13.2', titulo: 'Criterios de calidad',
      hoy: 'Hay una doctrina escrita que decide qué entra y qué no: prioridad al juego sobre lo analítico, exigencia de densidad (que no haya nadie parado en la fila), el eje es la exigencia y no la edad, y lo que impone el reglamento de minibasket.',
      piezas: ['Los criterios de la doctrina', 'La regla de densidad', 'Analítico frente a juego', 'Adaptar a lo que manda la federación', 'Revisar los ejercicios que ya hay'],
    },
    {
      id: '13.3', titulo: 'Cómo están clasificados',
      hoy: 'Cada ejercicio lleva: nivel de exigencia, oposición (si hay un rival que disputa de verdad) y presión (de espacio, de tiempo o de marcador) como ejes separados, además de tipo, contenido, duración y etiquetas.',
      piezas: ['Los ejes de clasificación', 'Un eje nuevo', 'Etiquetas', 'Nivel de exigencia', 'Que se clasifique solo'],
    },
    {
      id: '13.4', titulo: 'Mantenimiento y crecimiento',
      hoy: 'Los ejercicios se meten con herramientas internas que los revisan automáticamente antes de subirlos: comprueban que el dibujo cabe en la pista, que nadie se solapa y que la ficha está completa.',
      piezas: ['Cuántos ejercicios más', 'Revisión periódica', 'Retirar ejercicios que no se usan', 'Marcar ejercicios revisados', 'Que los entrenadores propongan ejercicios'],
    },
    {
      id: '13.5', titulo: 'Ejercicios propios del club',
      hoy: 'Todos los ejercicios son del club y los ve todo el cuerpo técnico. No hay distinción entre los que vienen de la importación y los que crea un entrenador.',
      piezas: ['Distinguir los ejercicios propios', 'Ejercicios privados de un entrenador', 'Aprobación antes de publicar', 'Valorar y comentar ejercicios', 'Ver cuántas veces se ha usado cada uno'],
    },
  ],
},

/* ══════════════════════════════════════════════════════════ */
{
  id: '14', titulo: 'Datos, seguridad e infraestructura',
  intro: 'La parte que no se ve pero decide si la aplicación aguanta.',
  apartados: [
    {
      id: '14.1', titulo: 'Base de datos y permisos',
      hoy: 'Supabase (PostgreSQL) con seguridad a nivel de fila: cada entrenador solo alcanza los datos de sus equipos, y eso lo impone la base de datos, no la pantalla. El rol de administrador está blindado contra auto-ascensos.',
      piezas: ['Reglas de acceso', 'Aislamiento entre equipos', 'Registro de cambios', 'Rendimiento con muchos datos', 'Multi-club'],
    },
    {
      id: '14.2', titulo: 'Copias de seguridad y exportación',
      hoy: 'Las copias son las que hace Supabase por su cuenta. No hay ningún botón en la aplicación para sacar los datos ni para restaurarlos.',
      piezas: ['Exportar todos mis datos', 'Copia periódica automática', 'Restaurar algo borrado por error', 'Papelera general', 'Llevarse los datos si se cambia de plataforma'],
    },
    {
      id: '14.3', titulo: 'Fotos y archivos',
      hoy: 'Dos almacenes privados: fotos de jugadores y actas de partido, organizados por equipo, con límites de tamaño y tipo. Nadie de fuera puede llegar a ellos.',
      piezas: ['Tamaño máximo', 'Comprimir las fotos', 'Más tipos de archivo (vídeo, PDF)', 'Documentos del equipo', 'Retención y borrado'],
    },
    {
      id: '14.4', titulo: 'Publicación y entornos',
      hoy: 'Se publica en Netlify. Hay un entorno único: lo que se sube va directo a producción. Los arneses de desarrollo existen en el repositorio pero están bloqueados fuera de local.',
      piezas: ['Entorno de pruebas separado', 'Poder volver atrás si algo sale mal', 'Aviso de versión nueva', 'Notas de cada versión'],
    },
    {
      id: '14.5', titulo: 'Funcionamiento sin conexión',
      hoy: 'El service worker pide la red primero. Se guarda una copia de la interfaz, pero no de los datos: sin cobertura no se puede consultar el plan de la sesión ni pasar lista.',
      piezas: ['Datos disponibles sin conexión', 'Guardar cambios y sincronizar luego', 'Indicador de estado de conexión', 'Descargar por adelantado la semana'],
    },
    {
      id: '14.6', titulo: 'Claves y configuración del servidor',
      hoy: 'La clave de IA (ANTHROPIC_API_KEY) NO está puesta en el servidor: por eso la generación de animaciones cae hoy al lector local, más basto. Además hay dos claves antiguas que conviene rotar por seguridad.',
      piezas: ['Poner la clave de IA', 'Rotar las claves antiguas', 'Pantalla de configuración para el administrador', 'Aviso cuando falta configuración', 'Límite de gasto de IA'],
    },
    {
      id: '14.7', titulo: 'Errores, avisos y soporte',
      hoy: 'Los errores se enseñan en pantalla al usuario, pero no se registran en ningún sitio: si a un entrenador le falla algo un martes, nadie se entera.',
      piezas: ['Registro de errores', 'Botón de «avisar de un problema»', 'Estado del sistema', 'Contacto de soporte', 'Preguntas frecuentes'],
    },
  ],
},

/* ══════════════════════════════════════════════════════════ */
{
  id: '15', titulo: 'Ideas nuevas: lo que hoy no existe',
  intro: 'Módulos que no están en la v2. Marca los que te interesen aunque no sepas todavía cómo serían: lo importante es saber si entran en la conversación de la v3.',
  apartados: [
    {
      id: '15.1', titulo: 'Acceso para jugadores y familias',
      hoy: 'No existe. La aplicación es solo para el cuerpo técnico.',
      piezas: ['Ver la convocatoria', 'Ver el calendario', 'Confirmar asistencia', 'Ver sus objetivos', 'Recibir avisos', 'Ver vídeos o ejercicios para casa'],
    },
    {
      id: '15.2', titulo: 'Seguimiento de carga y lesiones por jugador',
      hoy: 'La carga se calcula por sesión, para el equipo entero. No hay nada por jugador ni control de lesiones más allá de la marca de estado.',
      piezas: ['Carga acumulada por jugador', 'Parte de lesión', 'Vuelta progresiva tras lesión', 'Alertas de sobrecarga', 'Percepción de esfuerzo del jugador'],
    },
    {
      id: '15.3', titulo: 'Vídeo',
      hoy: 'No existe. Ni vídeo de ejercicios, ni clips de partido.',
      piezas: ['Vídeo de ejemplo en el ejercicio', 'Subir clips de partido', 'Recortar jugadas', 'Enlazar clip con objetivo', 'Compartir clips con el equipo'],
    },
    {
      id: '15.4', titulo: 'Estadísticas de partido en directo',
      hoy: 'No existe. El marcador se apunta al terminar.',
      piezas: ['Anotar desde el banquillo', 'Puntos, faltas y rebotes', 'Minutos y rotaciones', 'Cuadro de rotaciones planificado', 'Resumen automático al terminar'],
    },
    {
      id: '15.5', titulo: 'IA que propone la sesión entera',
      hoy: 'No existe, y es una decisión consciente: hoy la IA solo dibuja animaciones. Las sugerencias de ejercicios son deterministas y gratuitas.',
      piezas: ['Proponer la sesión desde el objetivo', 'Proponer la temporada', 'Analizar el dossier', 'Chat con el histórico del equipo', 'Mantenerlo todo determinista y gratis'],
    },
    {
      id: '15.6', titulo: 'Avisos y recordatorios',
      hoy: 'No existe. La aplicación nunca te escribe.',
      piezas: ['Recordar planificar la sesión', 'Recordar pasar lista', 'Recordar cerrar la sesión', 'Aviso de partido', 'Avisos al móvil', 'Resumen semanal por correo'],
    },
    {
      id: '15.7', titulo: 'Otras ideas',
      hoy: 'Espacio libre para lo que no cabe en ninguna casilla de este informe. Escribe todo lo que se te ocurra, aunque parezca imposible.',
      piezas: [],
      libre: true,
    },
  ],
},

];
