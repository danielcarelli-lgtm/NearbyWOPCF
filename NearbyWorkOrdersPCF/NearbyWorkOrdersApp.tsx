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
    IconButton
} from '@fluentui/react';

export interface INearbyWorkOrdersAppProps {
    webAPI: ComponentFramework.WebApi;
    workOrderId: string;
    extraOptionSetField: string;
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
    extraOptionSetValue?: string | null;
}

export const NearbyWorkOrdersApp: React.FC<INearbyWorkOrdersAppProps> = (props) => {
    const [workOrders, setWorkOrders] = React.useState<IWorkOrder[]>([]);
    const [loading, setLoading] = React.useState<boolean>(true);
    const [error, setError] = React.useState<string | null>(null);

    React.useEffect(() => {
        loadNearbyWorkOrders();
    }, [props.workOrderId, props.extraOptionSetField]);

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
                setError("La Orden de Trabajo actual no tiene coordenadas de geolocalización.");
                setLoading(false);
                return;
            }

            if (!territoryId || !typeId) {
                setError("La Orden de Trabajo actual no tiene Territorio o Tipo asignado para poder comparar.");
                setLoading(false);
                return;
            }

            // 2. Construir la consulta de las OTs cercanas
            let selectFields = `msdyn_name,msdyn_latitude,msdyn_longitude,msdyn_city,msdyn_address1,_msdyn_serviceaccount_value,_msdyn_functionallocation_value,_msdyn_workordertype_value,_msdyn_primaryincidenttype_value,msdyn_workordersummary,msdyn_workorderid`;
            
            // Si hay un campo extra configurado, lo añadimos a la consulta
            if (props.extraOptionSetField && props.extraOptionSetField.trim().length > 0) {
                selectFields += `,${props.extraOptionSetField.trim()}`;
            }

            const query = `?$select=${selectFields}&$filter=msdyn_systemstatus eq 690970001 and _msdyn_serviceterritory_value eq '${territoryId}' and _msdyn_workordertype_value eq '${typeId}' and msdyn_workorderid ne ${props.workOrderId} and msdyn_latitude ne null and msdyn_longitude ne null`;
            
            const result = await props.webAPI.retrieveMultipleRecords("msdyn_workorder", query);
            
            // 3. Mapear resultados
            const fetchedOrders: IWorkOrder[] = result.entities.map(entity => {
                const lat = entity.msdyn_latitude;
                const lon = entity.msdyn_longitude;
                const distance = calculateDistance(currentLat, currentLon, lat, lon);

                // Lookups estándar
                const clientName = entity["_msdyn_serviceaccount_value@OData.Community.Display.V1.FormattedValue"] || "Cliente sin especificar";
                const funcLocName = entity["_msdyn_functionallocation_value@OData.Community.Display.V1.FormattedValue"] || "Sin ubicación funcional";
                const woTypeName = entity["_msdyn_workordertype_value@OData.Community.Display.V1.FormattedValue"] || "Sin tipo de OT";
                const incidentTypeName = entity["_msdyn_primaryincidenttype_value@OData.Community.Display.V1.FormattedValue"] || "Sin tipo de incidente";
                
                // Formatear dirección
                const address1 = entity.msdyn_address1 || "";
                const city = entity.msdyn_city || "";
                const fullAddress = [address1, city].filter(Boolean).join(", ") || "Dirección desconocida";

                // Procesar el campo dinámico (priorizamos el valor formateado)
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
                    extraOptionSetValue: extraValue
                };
            });

            // 4. Ordenar por distancia y extraer el Top 5
            fetchedOrders.sort((a, b) => (a.distance || 0) - (b.distance || 0));
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

    if (loading) return <Spinner size={SpinnerSize.large} label="Buscando OTs cercanas al trabajo actual..." />;
    
    if (error) return <MessageBar messageBarType={MessageBarType.error}>{error}</MessageBar>;

    if (workOrders.length === 0) {
        return (
            <MessageBar messageBarType={MessageBarType.info}>
                No hay órdenes pendientes cercanas para este territorio y tipo.
            </MessageBar>
        );
    }

    return (
        <Stack tokens={{ childrenGap: 12 }} padding={10}>
            <Text variant="large" styles={{ root: { fontWeight: 'bold' } }}>
                Top 5 OTs Cercanas a esta ubicación
            </Text>
            
            {workOrders.map(wo => (
                <div key={wo.id} style={{ padding: '12px', border: '1px solid #edebe9', borderRadius: '4px', backgroundColor: '#ffffff', boxShadow: '0 1.6px 3.6px 0 rgba(0,0,0,0.132)' }}>
                    <Stack horizontal horizontalAlign="space-between" verticalAlign="start">
                        
                        {/* Bloque Izquierdo: Información */}
                        <Stack tokens={{ childrenGap: 6 }} styles={{ root: { width: '80%' } }}>
                            
                            {/* Título de la OT */}
                            <Text variant="mediumPlus" styles={{ root: { fontWeight: 'bold', color: '#0078d4' } }}>
                                {wo.name}
                            </Text>
                            
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

                            {/* Campo OptionSet dinámico (solo se renderiza si hay valor) */}
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

                            {/* Resumen (truncado a 3 líneas) */}
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
                        <Stack tokens={{ childrenGap: 8 }} horizontalAlign="end" verticalAlign="start">
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
                                    root: { backgroundColor: '#f3f2f1', borderRadius: '50%' },
                                    rootHovered: { backgroundColor: '#e1dfdd' },
                                    icon: { color: '#0078d4', fontSize: '16px' }
                                }}
                            />
                        </Stack>

                    </Stack>
                </div>
            ))}

            {/* Número de versión */}
            <Text styles={{ root: { color: '#a19f9d', fontSize: '10px', textAlign: 'center', marginTop: '8px' } }}>
                v{props.version}
            </Text>
        </Stack>
    );
};