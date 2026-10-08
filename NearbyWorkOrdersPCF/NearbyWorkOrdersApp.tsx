import * as React from 'react';
import { calculateDistance } from './utils';
import { 
    Stack, 
    Text, 
    Spinner, 
    SpinnerSize, 
    Icon,
    MessageBar,
    MessageBarType,
    IconButton,
    ActionButton
} from '@fluentui/react';

export interface INearbyWorkOrdersAppProps {
    webAPI: ComponentFramework.WebApi;
    workOrderId: string;
    extraOptionSetField: string;
    countryEnvironment: string;
    version: string;
}

interface IWorkOrder {
    id: string;
    name: string;
    latitude: number;
    longitude: number;
    distance?: number;
    city: string;
    client: string;
    functionalLocation: string;
    address: string;
    workOrderType: string;
    incidentType: string;
    summary: string;
    priority: string;
    timeFrom: Date | null;
    timeTo: Date | null;
    expirationDate: Date | null;
    daysRemaining: number | null;
    extraOptionSetValue?: string | null;
}

// Función auxiliar para determinar el color de la prioridad
const getPriorityColor = (priorityName: string) => {
    if (!priorityName) return '#605e5c';
    const lower = priorityName.toLowerCase();
    if (lower.includes('alta') || lower.includes('urgente') || lower.includes('high') || lower.includes('crític')) return '#d13438'; // Rojo
    if (lower.includes('baja') || lower.includes('low')) return '#107c10'; // Verde
    return '#0078d4'; // Azul (Normal)
};

// Función auxiliar para determinar el estilo de los días restantes
const getDaysRemainingInfo = (days: number | null) => {
    if (days === null) return null;
    let color, text, icon;
    if (days > 7) {
        color = '#107c10'; // Verde
        text = `Faltan ${days} días`;
        icon = 'Clock';
    } else if (days > 0 && days <= 7) {
        color = '#b47b00'; // Naranja / Amarillo oscuro
        text = `Faltan ${days} días`;
        icon = 'Warning';
    } else if (days === 0) {
        color = '#d13438'; // Rojo
        text = 'Vence hoy';
        icon = 'WarningSolid';
    } else {
        color = '#d13438'; // Rojo
        text = `Excedido (${Math.abs(days)} d)`;
        icon = 'ErrorBadge';
    }
    return { color, text, icon };
};

export const NearbyWorkOrdersApp: React.FC<INearbyWorkOrdersAppProps> = (props) => {
    const [workOrders, setWorkOrders] = React.useState<IWorkOrder[]>([]);
    const [loading, setLoading] = React.useState<boolean>(true);
    const [error, setError] = React.useState<string | null>(null);
    const [showWithoutGeo, setShowWithoutGeo] = React.useState<boolean>(false);

    React.useEffect(() => {
        loadNearbyWorkOrders();
    }, [props.workOrderId, props.extraOptionSetField, props.countryEnvironment, showWithoutGeo]);

    const loadNearbyWorkOrders = async () => {
        setLoading(true);
        setError(null);

        if (!props.workOrderId) {
            setError("No se ha detectado una Orden de Trabajo en esta Reserva.");
            setLoading(false);
            return;
        }

        try {
            // 1. Obtener los datos de la Orden de Trabajo ACTUAL
            const currentWoQuery = `?$select=msdyn_latitude,msdyn_longitude,_msdyn_serviceterritory_value,_msdyn_workordertype_value`;
            const currentWo = await props.webAPI.retrieveRecord("msdyn_workorder", props.workOrderId, currentWoQuery);
            
            const currentLat = currentWo.msdyn_latitude;
            const currentLon = currentWo.msdyn_longitude;
            const territoryId = currentWo._msdyn_serviceterritory_value;
            const typeId = currentWo._msdyn_workordertype_value;

            if (!currentLat || !currentLon) {
                if (!showWithoutGeo) {
                    setError("La Orden de Trabajo actual no tiene coordenadas de geolocalización para calcular distancias.");
                    setLoading(false);
                    return;
                }
            }

            if (!territoryId || !typeId) {
                setError("La Orden de Trabajo actual no tiene Territorio o Tipo asignado para poder comparar.");
                setLoading(false);
                return;
            }

            // 2. Construir la consulta de las OTs según el modo y el país
            let selectFields = `msdyn_name,msdyn_latitude,msdyn_longitude,msdyn_city,msdyn_address1,_msdyn_serviceaccount_value,_msdyn_functionallocation_value,_msdyn_workordertype_value,_msdyn_primaryincidenttype_value,msdyn_workordersummary,msdyn_workorderid,_msdyn_priority_value,msdyn_timefrompromised,msdyn_timetopromised`;
            
            // Añadir campo extra si está configurado
            if (props.extraOptionSetField && props.extraOptionSetField.trim().length > 0) {
                selectFields += `,${props.extraOptionSetField.trim()}`;
            }

            // Añadir campo específico de España de forma segura
            if (props.countryEnvironment === 'Espana') {
                selectFields += `,pdw_mmexpirationdate`;
            }

            // Filtro de geoposición dependiendo del toggle
            const geoFilter = showWithoutGeo 
                ? `(msdyn_latitude eq null or msdyn_longitude eq null)` 
                : `(msdyn_latitude ne null and msdyn_longitude ne null)`;

            const query = `?$select=${selectFields}&$filter=msdyn_systemstatus eq 690970001 and _msdyn_serviceterritory_value eq '${territoryId}' and _msdyn_workordertype_value eq '${typeId}' and msdyn_workorderid ne ${props.workOrderId} and ${geoFilter}`;
            
            const result = await props.webAPI.retrieveMultipleRecords("msdyn_workorder", query);
            
            // 3. Mapear resultados
            const fetchedOrders: IWorkOrder[] = result.entities.map(entity => {
                const lat = entity.msdyn_latitude;
                const lon = entity.msdyn_longitude;
                
                let distance = undefined;
                if (!showWithoutGeo && currentLat && currentLon && lat && lon) {
                    distance = calculateDistance(currentLat, currentLon, lat, lon);
                }

                // Extraer valores formateados
                const clientName = entity["_msdyn_serviceaccount_value@OData.Community.Display.V1.FormattedValue"] || "Cliente sin especificar";
                const funcLocName = entity["_msdyn_functionallocation_value@OData.Community.Display.V1.FormattedValue"] || "Sin ubicación funcional";
                const woTypeName = entity["_msdyn_workordertype_value@OData.Community.Display.V1.FormattedValue"] || "Sin tipo de OT";
                const incidentTypeName = entity["_msdyn_primaryincidenttype_value@OData.Community.Display.V1.FormattedValue"] || "Sin tipo de incidente";
                const priorityName = entity["_msdyn_priority_value@OData.Community.Display.V1.FormattedValue"] || "Prioridad normal";
                
                // Procesar fechas y cálculo de ventana/caducidad
                const timeFrom = entity.msdyn_timefrompromised ? new Date(entity.msdyn_timefrompromised) : null;
                const timeTo = entity.msdyn_timetopromised ? new Date(entity.msdyn_timetopromised) : null;
                const expirationDate = entity.pdw_mmexpirationdate ? new Date(entity.pdw_mmexpirationdate) : null;

                const targetDateString = (props.countryEnvironment === 'Espana' && entity.pdw_mmexpirationdate) 
                    ? entity.pdw_mmexpirationdate 
                    : entity.msdyn_timetopromised;
                
                let daysRemaining = null;
                if (targetDateString) {
                    const today = new Date();
                    today.setHours(0, 0, 0, 0); // Descartamos la hora actual
                    const target = new Date(targetDateString);
                    target.setHours(0, 0, 0, 0); // Descartamos la hora objetivo
                    
                    const diffTime = target.getTime() - today.getTime();
                    daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                }

                // Formatear dirección
                const address1 = entity.msdyn_address1 || "";
                const city = entity.msdyn_city || "";
                const fullAddress = [address1, city].filter(Boolean).join(", ") || "Dirección desconocida";

                let extraValue = null;
                if (props.extraOptionSetField && props.extraOptionSetField.trim().length > 0) {
                    extraValue = entity[`${props.extraOptionSetField.trim()}@OData.Community.Display.V1.FormattedValue`] 
                                 || entity[props.extraOptionSetField.trim()];
                }

                return {
                    id: entity.msdyn_workorderid,
                    name: entity.msdyn_name,
                    latitude: lat,
                    longitude: lon,
                    distance: distance,
                    city: city,
                    client: clientName,
                    functionalLocation: funcLocName,
                    address: fullAddress,
                    workOrderType: woTypeName,
                    incidentType: incidentTypeName,
                    summary: entity.msdyn_workordersummary || "",
                    priority: priorityName,
                    timeFrom: timeFrom,
                    timeTo: timeTo,
                    expirationDate: expirationDate,
                    daysRemaining: daysRemaining,
                    extraOptionSetValue: extraValue
                };
            });

            // 4. Ordenar resultados
            if (!showWithoutGeo) {
                fetchedOrders.sort((a, b) => (a.distance || 0) - (b.distance || 0));
            } else {
                fetchedOrders.sort((a, b) => a.name.localeCompare(b.name));
            }
            
            setWorkOrders(fetchedOrders.slice(0, 5));

        } catch (err: any) {
            console.error(err);
            setError("Error al consultar las OTs en Dataverse. Revisa los permisos o la conexión.");
        } finally {
            setLoading(false);
        }
    };

    const openInMaps = (lat: number, lon: number) => {
        window.open(`https://maps.google.com/?q=${lat},${lon}`, '_blank');
    };

    const renderDateWindow = (wo: IWorkOrder) => {
        if (props.countryEnvironment === 'Espana' && wo.expirationDate) {
            return `Vencimiento: ${wo.expirationDate.toLocaleDateString()}`;
        } else if (wo.timeFrom && wo.timeTo) {
            return `Ventana: ${wo.timeFrom.toLocaleDateString()} - ${wo.timeTo.toLocaleDateString()}`;
        } else if (wo.timeTo) {
            return `Límite: ${wo.timeTo.toLocaleDateString()}`;
        } else if (wo.timeFrom) {
            return `Inicio: ${wo.timeFrom.toLocaleDateString()}`;
        }
        return "Sin límite temporal";
    };

    if (loading) return <Spinner size={SpinnerSize.large} label={showWithoutGeo ? "Buscando OTs sin ubicación..." : "Buscando OTs cercanas..."} />;
    
    if (error) return <MessageBar messageBarType={MessageBarType.error}>{error}</MessageBar>;

    const headerBlock = (
        <Stack horizontal horizontalAlign="space-between" verticalAlign="center">
            <Text variant="large" styles={{ root: { fontWeight: 'bold' } }}>
                {showWithoutGeo ? "OTs sin geoposición" : "Top 5 OTs Cercanas"}
            </Text>
            <ActionButton 
                iconProps={{ iconName: showWithoutGeo ? 'MapPin' : 'MapPinSolid' }} 
                onClick={() => setShowWithoutGeo(!showWithoutGeo)}
                styles={{ 
                    root: { height: 'auto', padding: '0 4px', minHeight: '20px' }, 
                    label: { fontSize: '12px', color: '#605e5c', fontWeight: '400' } 
                }}
            >
                {showWithoutGeo ? "Ver cercanas" : "Ver sin geoposición"}
            </ActionButton>
        </Stack>
    );

    return (
        <Stack tokens={{ childrenGap: 12 }} padding={10}>
            
            {headerBlock}

            {workOrders.length === 0 ? (
                <MessageBar messageBarType={MessageBarType.info}>
                    {showWithoutGeo 
                        ? "No hay órdenes pendientes sin geoposición para este territorio y tipo." 
                        : "No hay órdenes pendientes cercanas para este territorio y tipo."}
                </MessageBar>
            ) : (
                workOrders.map(wo => {
                    const daysInfo = getDaysRemainingInfo(wo.daysRemaining);
                    return (
                    <div key={wo.id} style={{ padding: '12px', border: '1px solid #edebe9', borderRadius: '4px', backgroundColor: '#ffffff', boxShadow: '0 1.6px 3.6px 0 rgba(0,0,0,0.132)' }}>
                        <Stack horizontal horizontalAlign="space-between" verticalAlign="start">
                            
                            {/* Bloque Izquierdo: Información */}
                            <Stack tokens={{ childrenGap: 6 }} styles={{ root: { width: showWithoutGeo ? '100%' : '75%' } }}>
                                
                                {/* Cabecera de la OT: Título y Prioridad */}
                                <Stack horizontal verticalAlign="center" tokens={{ childrenGap: 10 }} wrap>
                                    <Text variant="mediumPlus" styles={{ root: { fontWeight: 'bold', color: '#0078d4' } }}>
                                        {wo.name}
                                    </Text>
                                    <Stack horizontal verticalAlign="center" tokens={{ childrenGap: 4 }}>
                                        <Icon iconName="Flag" styles={{ root: { color: getPriorityColor(wo.priority), fontSize: '12px' } }} />
                                        <Text variant="small" styles={{ root: { color: getPriorityColor(wo.priority), fontWeight: '600' } }}>
                                            {wo.priority}
                                        </Text>
                                    </Stack>
                                </Stack>
                                
                                {/* Tipos: OT e Incidente */}
                                <Stack horizontal wrap tokens={{ childrenGap: 10 }}>
                                    <Stack horizontal verticalAlign="center" tokens={{ childrenGap: 4 }}>
                                        <Icon iconName="WorkItem" styles={{ root: { color: '#605e5c', fontSize: '12px' } }} />
                                        <Text variant="small" styles={{ root: { color: '#605e5c' } }}>
                                            {wo.workOrderType}
                                        </Text>
                                    </Stack>
                                    <Stack horizontal verticalAlign="center" tokens={{ childrenGap: 4 }}>
                                        <Icon iconName="Repair" styles={{ root: { color: '#d13438', fontSize: '12px' } }} />
                                        <Text variant="small" styles={{ root: { color: '#d13438', fontWeight: '600' } }}>
                                            {wo.incidentType}
                                        </Text>
                                    </Stack>
                                </Stack>

                                {/* Fechas y SLA */}
                                <Stack horizontal verticalAlign="center" tokens={{ childrenGap: 10 }} wrap>
                                    <Stack horizontal verticalAlign="center" tokens={{ childrenGap: 4 }}>
                                        <Icon iconName="Calendar" styles={{ root: { color: '#605e5c', fontSize: '12px' } }} />
                                        <Text variant="small" styles={{ root: { color: '#605e5c' } }}>
                                            {renderDateWindow(wo)}
                                        </Text>
                                    </Stack>
                                    
                                    {daysInfo && (
                                        <Stack horizontal verticalAlign="center" tokens={{ childrenGap: 4 }} styles={{ root: { backgroundColor: `${daysInfo.color}1A`, padding: '2px 6px', borderRadius: '4px' }}}>
                                            <Icon iconName={daysInfo.icon} styles={{ root: { color: daysInfo.color, fontSize: '12px' } }} />
                                            <Text variant="small" styles={{ root: { color: daysInfo.color, fontWeight: 'bold' } }}>
                                                {daysInfo.text}
                                            </Text>
                                        </Stack>
                                    )}
                                </Stack>

                                {/* Cliente y Ubicación */}
                                <Stack horizontal verticalAlign="center" tokens={{ childrenGap: 6 }}>
                                    <Icon iconName="AccountManagement" styles={{ root: { color: '#605e5c', fontSize: '12px' } }} />
                                    <Text variant="small" styles={{ root: { color: '#323130', fontWeight: '600' } }}>
                                        {wo.client}
                                    </Text>
                                </Stack>
                                <Stack horizontal verticalAlign="center" tokens={{ childrenGap: 6 }}>
                                    <Icon iconName="POI" styles={{ root: { color: '#605e5c', fontSize: '12px' } }} />
                                    <Text variant="small" styles={{ root: { color: '#605e5c' } }}>
                                        {wo.functionalLocation}
                                    </Text>
                                </Stack>

                                {/* Campo OptionSet dinámico */}
                                {wo.extraOptionSetValue && (
                                    <Stack horizontal verticalAlign="center" tokens={{ childrenGap: 6 }}>
                                        <Icon iconName="Tag" styles={{ root: { color: '#0078d4', fontSize: '12px' } }} />
                                        <Text variant="small" styles={{ root: { color: '#0078d4', fontWeight: '600' } }}>
                                            {wo.extraOptionSetValue}
                                        </Text>
                                    </Stack>
                                )}

                                {/* Dirección */}
                                <Stack horizontal verticalAlign="start" tokens={{ childrenGap: 6 }}>
                                    <Icon iconName="MapPin" styles={{ root: { color: '#605e5c', fontSize: '12px', marginTop: '3px' } }} />
                                    <Text variant="small" styles={{ root: { color: '#605e5c' } }}>
                                        {wo.address}
                                    </Text>
                                </Stack>

                                {/* Resumen */}
                                {wo.summary && (
                                    <Stack horizontal verticalAlign="start" tokens={{ childrenGap: 6 }} styles={{ root: { marginTop: '4px' } }}>
                                        <Icon iconName="AlignLeft" styles={{ root: { color: '#605e5c', fontSize: '12px', marginTop: '3px' } }} />
                                        <Text variant="small" styles={{ 
                                            root: { 
                                                color: '#605e5c',
                                                fontStyle: 'italic',
                                                display: '-webkit-box',
                                                WebkitLineClamp: 3,
                                                WebkitBoxOrient: 'vertical',
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis'
                                            } 
                                        }}>
                                            {wo.summary}
                                        </Text>
                                    </Stack>
                                )}
                            </Stack>

                            {/* Bloque Derecho: Distancia y Acciones */}
                            {!showWithoutGeo && (
                                <Stack tokens={{ childrenGap: 8 }} horizontalAlign="end" verticalAlign="start" styles={{ root: { width: '25%' } }}>
                                    <Stack horizontal verticalAlign="center" tokens={{ childrenGap: 5 }}>
                                        <Icon iconName="Nav2DMapView" styles={{ root: { color: '#107c10', fontSize: '16px' } }} />
                                        <Text variant="medium" styles={{ root: { fontWeight: 'bold', color: '#107c10' } }}>
                                            {wo.distance?.toFixed(1)} km
                                        </Text>
                                    </Stack>
                                    
                                    <IconButton 
                                        iconProps={{ iconName: 'Directions' }} 
                                        title="Abrir ubicación en Mapas" 
                                        ariaLabel="Abrir ubicación en Mapas" 
                                        onClick={() => openInMaps(wo.latitude, wo.longitude)}
                                        styles={{
                                            root: { backgroundColor: '#f3f2f1', borderRadius: '50%', alignSelf: 'flex-end' },
                                            rootHovered: { backgroundColor: '#e1dfdd' },
                                            icon: { color: '#0078d4', fontSize: '16px' }
                                        }}
                                    />
                                </Stack>
                            )}

                        </Stack>
                    </div>
                )})
            )}

            <Text styles={{ root: { color: '#a19f9d', fontSize: '10px', textAlign: 'center', marginTop: '8px' } }}>
                v{props.version}
            </Text>
        </Stack>
    );
};