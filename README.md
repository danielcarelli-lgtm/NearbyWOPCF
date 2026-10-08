# Componente PCF: Nearby Work Orders (Órdenes de Trabajo Cercanas)

## Descripción General
El componente **Nearby Work Orders** es un control visual personalizado (Power Apps Component Framework) diseñado específicamente para el formulario de Reservas en la aplicación móvil de Dynamics 365 Field Service. 

Su objetivo principal es otorgar autonomía a los técnicos en campo, permitiéndoles optimizar sus rutas y minimizar tiempos muertos al mostrarles de forma interactiva los trabajos pendientes que se encuentran físicamente más cerca de su ubicación actual (tomando como punto de origen la Orden de Trabajo que están atendiendo en ese momento).

## Características Principales

* **Recomendación por Proximidad (Top 5):** El componente calcula en tiempo real la distancia en línea recta (empleando la fórmula matemática de Haversine) entre la Orden de Trabajo actual y el resto de OTs pendientes en la base de datos, extrayendo las 5 opciones más próximas al técnico.
* **Filtrado Inteligente y Contextual:** De forma transparente para el usuario, el control busca únicamente Órdenes de Trabajo que cumplan las siguientes reglas de negocio:
  * Estado del sistema: "Sin programar" (`msdyn_systemstatus` = 690970001).
  * Territorio de Servicio: El mismo territorio de la OT en la que está trabajando el técnico.
  * Tipo de Orden de Trabajo: Coincidente con la OT actual (ej. SE, PCI).
* **Gestión de OTs sin Geolocalización:** A través de un botón de acción discreto en la cabecera ("Ver sin geoposición"), el técnico puede alternar la vista del listado. Esto revela OTs que cumplen los criterios de tipo y territorio, pero que carecen de coordenadas de latitud/longitud en el sistema, evitando que se conviertan en "trabajos fantasma" y previniendo cálculos de proximidad erróneos.
* **Navegación GPS a un Clic:** Las tarjetas de las OTs geolocalizadas incorporan un botón rápido que ejecuta un *Deep Link* universal. Esto abre de inmediato la aplicación de mapas predeterminada del dispositivo móvil (Google Maps, Apple Maps, etc.) trazando la ruta hasta el destino.
* **Tarjetas de Información Enriquecida:** Cada resultado muestra el contexto crítico del trabajo sin necesidad de abrir el registro:
  * Número y Nombre de la OT.
  * Tipo de Orden de Trabajo y Tipo de Incidente principal.
  * Cuenta de Servicio (Cliente) y Ubicación Funcional asociadas.
  * Dirección postal completa (combinación de Dirección 1 y Ciudad).
  * Distancia exacta en kilómetros (con un decimal).
  * Resumen del trabajo (`msdyn_workordersummary`), truncado inteligentemente a 3 líneas con puntos suspensivos para mantener la simetría de la interfaz.
* **Campo OptionSet Dinámico:** Soporta la inyección de un campo personalizado adicional en la tarjeta (por ejemplo, el Subestado). Si se configura, se extrae y se muestra el valor formateado del OptionSet junto a un icono identificativo.
* **Diseño de Interfaz Nativo:** Construido enteramente sobre React y Microsoft Fluent UI (v8). El componente hereda las tipografías, iconografía, paleta de colores y accesibilidad nativa de Dynamics 365, logrando un *Look & Feel* completamente integrado.

## Configuración de Parámetros en el Formulario

Para que el componente funcione correctamente, debe agregarse en el diseñador de formularios (típicamente en el de la entidad `bookableresourcebooking` - Reserva de Recursos Reservables) y enlazar sus propiedades a los campos adecuados:

| Propiedad del Componente | Tipo de Dato | Obligatorio | Instrucciones de Configuración |
| :--- | :--- | :---: | :--- |
| **Work Order (`workOrderLookup`)** | Lookup | Sí | Debe enlazarse al campo de tipo búsqueda que relaciona la reserva actual con la tabla de Órdenes de Trabajo. El componente usará el ID de esta OT como origen para extraer el territorio, tipo y geolocalización. |
| **Campo OptionSet Adicional (`extraOptionSetField`)** | Cadena de texto | No | Permite inyectar una variable extra en el diseño. Debe escribirse el **nombre lógico** exacto del campo tipo *OptionSet* (Conjunto de opciones) que existe en la tabla Orden de Trabajo (`msdyn_workorder`). *Ejemplo: `msdyn_substatus`*. Si se deja vacío, la interfaz se adapta y oculta este indicador sin generar errores. |

## Experiencia de Usuario (UX) y Manejo de Estados

El componente está diseñado para ser robusto ante la falta de datos, comunicándose constantemente con el técnico:

1. **Estado de Carga:** Muestra un *Spinner* animado con el texto de la acción ("Buscando OTs cercanas..." o "Buscando OTs sin ubicación...") para denotar actividad asíncrona contra Dataverse.
2. **Alertas Contextuales:** Utiliza barras de mensajes (MessageBars) de Fluent UI para advertir si:
   * La Reserva no tiene una OT asociada.
   * La OT actual carece de coordenadas (solicitando al usuario que cambie a la vista de "OTs sin geoposición").
   * Falta configurar el Territorio o el Tipo en la OT de origen para realizar las comparativas.
3. **Estados Vacíos (*Zero Data*):** Si las consultas se ejecutan con éxito pero no devuelven registros, se informa mediante una barra azul informativa en lugar de mostrar un espacio en blanco, confirmando al usuario que la búsqueda finalizó correctamente pero no hay carga de trabajo pendiente en la zona bajo esas condiciones.