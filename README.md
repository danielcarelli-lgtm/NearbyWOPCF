# Componente PCF: Nearby Work Orders (Órdenes de Trabajo Cercanas)

## Descripción General

El componente **Nearby Work Orders** es un control visual personalizado (Power Apps Component Framework) diseñado específicamente para el formulario de Reservas en la aplicación móvil de Dynamics 365 Field Service.

Su objetivo principal es otorgar autonomía a los técnicos en campo, permitiéndoles optimizar sus rutas y minimizar tiempos muertos al mostrarles de forma interactiva los trabajos pendientes que se encuentran físicamente más cerca de su ubicación actual (tomando como punto de origen la Orden de Trabajo que están atendiendo en ese momento) y permitiéndoles **auto-asignarse** dichos trabajos con un solo clic.

## Características Principales

* **Recomendación por Proximidad (Top 5):** El componente calcula en tiempo real la distancia en línea recta (empleando la fórmula matemática de Haversine) entre la Orden de Trabajo actual y el resto de OTs pendientes, extrayendo las 5 opciones más próximas al técnico. Filtra automáticamente aquellas OTs sin geoposición para evitar falsos positivos en cercanía.

* **Filtrado Inteligente y Contextual:** Busca únicamente Órdenes de Trabajo que cumplan las siguientes reglas de negocio:
  * Estado del sistema: "Sin programar" (`msdyn_systemstatus` = 690970001).
  * Territorio de Servicio: El mismo territorio de la OT en la que está trabajando el técnico.
  * Tipo de Orden de Trabajo: Coincidente con la OT actual (ej. SE, PCI).

* **Auto-Asignación y Programación Directa:** Las tarjetas incluyen un botón de calendario que despliega un modal interactivo. Sugiere automáticamente la fecha y hora actuales, permitiendo al técnico ajustarlas y crear directamente en Dataverse un nuevo registro de Reserva (`bookableresourcebooking`) a su nombre y en estado "Programado". Tras confirmar, el listado se refresca automáticamente.

* **Gestión de OTs sin Geolocalización (Vista Alternativa):** A través de un botón de acción en la cabecera ("Ver sin geoposición"), el técnico puede alternar la vista del listado. Esto revela OTs que cumplen los criterios de tipo y territorio, pero que carecen de coordenadas de latitud/longitud en el sistema (estas también pueden ser auto-asignadas).

* **Control de SLAs y Ventanas de Tiempo:** Evalúa la fecha límite de la Orden de Trabajo calculando los días restantes hasta su vencimiento.
  * Muestra la **"Ventana"** temporal estándar cuando existen las fechas de promesa (`msdyn_timefrompromised` y `msdyn_timetopromised`).
  * **Lógica Regional (España):** Si el entorno se configura como "España" y el campo personalizado de caducidad (`pdw_mmexpirationdate`) tiene datos, este sobrescribe a las fechas estándar y se muestra como **"Expiración"**.
  * **Indicadores visuales de urgencia:** Etiqueta verde (faltan más de 7 días), naranja (faltan 7 días o menos), y roja (vence hoy o plazo excedido).

* **Prioridad Codificada por Color:** Lee la prioridad del trabajo (`msdyn_priority`) y añade un indicador visual y un icono de bandera codificado por color (Rojo para altas/urgentes, verde para bajas, azul para normales).

* **Navegación GPS a un Clic:** Las tarjetas geolocalizadas incorporan un botón que ejecuta un *Deep Link* universal hacia la app de mapas nativa del dispositivo (Google Maps, Apple Maps, etc.).

* **Tarjetas de Información Enriquecida:** Cada resultado muestra el contexto crítico: Número y Nombre, Tipos de OT/Incidente, Cliente, Ubicación Funcional, **Activo Principal**, Dirección postal completa, y el Resumen del trabajo (truncado a 3 líneas).

* **Campo OptionSet Dinámico:** Soporta la inyección de un campo personalizado (por ejemplo, el Subestado). Si se configura, se muestra su valor sin necesidad de tocar el código.

## Configuración de Parámetros en el Formulario

Para que el componente funcione correctamente, debe agregarse en el diseñador de formularios (típicamente en el de la entidad `bookableresourcebooking` - Reserva de Recursos Reservables) y enlazar/configurar sus propiedades:

| Propiedad del Componente | Tipo de Dato | Obligatorio | Instrucciones de Configuración | 
| ----- | ----- | ----- | ----- | 
| **Work Order (`workOrderLookup`)** | Lookup | Sí | Enlazar al campo de búsqueda que relaciona la reserva actual con la tabla de Órdenes de Trabajo. El componente usará esta OT como origen. | 
| **Recurso (Técnico) (`resourceLookup`)** | Lookup | No | Enlazar al campo de búsqueda de Recurso de la Reserva actual. Si se deja en blanco, el componente intentará deducir al técnico automáticamente para realizar la auto-reserva. | 
| **Entorno de País (`countryEnvironment`)** | Desplegable | Sí | Define la región ("España" u "Otros"). Si se selecciona España, el componente intentará leer y priorizar el campo de expiración local (`pdw_mmexpirationdate`). | 
| **Campo OptionSet Adicional (`extraOptionSetField`)** | Cadena de texto | No | Permite inyectar una variable extra. Escribir el **nombre lógico** exacto del campo tipo *OptionSet* (ej. `msdyn_substatus`). Si se deja vacío, la interfaz oculta este indicador. | 

## Experiencia de Usuario (UX) y Manejo de Estados

El componente está diseñado para ser robusto ante la falta de datos y acompañar al usuario paso a paso:

1. **Gestión de Reservas:** Al auto-asignarse un trabajo, un cuadro de diálogo modal detiene la interfaz y un *Spinner* indica la creación asíncrona de la reserva. Al finalizar, una barra verde confirma el éxito de la operación.
2. **Estado de Carga:** Muestra animaciones dependiendo de la vista activa ("Buscando OTs cercanas..." o "Buscando OTs sin ubicación...").
3. **Alertas Contextuales:** Advierte si la Reserva no tiene OT asociada, si la OT de origen carece de coordenadas, o si falta configurar Territorio/Tipo.
4. **Estados Vacíos (*Zero Data*):** Barras informativas azules en caso de no encontrar resultados para la búsqueda actual (con o sin geoposición).
5. **Diseño Nativo:** Construido con React y Microsoft Fluent UI (v8), heredando la accesibilidad, tipografías e iconografía estándar de Dynamics 365 para una integración perfecta.