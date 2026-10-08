import { IInputs, IOutputs } from "./generated/ManifestTypes";
import * as React from "react";
import { NearbyWorkOrdersApp, INearbyWorkOrdersAppProps } from "./NearbyWorkOrdersApp";

export class NearbyWorkOrders implements ComponentFramework.ReactControl<IInputs, IOutputs> {
    private notifyOutputChanged: () => void;
    private context: ComponentFramework.Context<IInputs>;

    public init(
        context: ComponentFramework.Context<IInputs>,
        notifyOutputChanged: () => void,
        state: ComponentFramework.Dictionary
    ): void {
        this.notifyOutputChanged = notifyOutputChanged;
        this.context = context;
    }

    public updateView(context: ComponentFramework.Context<IInputs>): React.ReactElement {
        let currentWorkOrderId = "";
        
        // Extraemos el ID de la OT desde el campo de tipo Lookup
        if (context.parameters.workOrderLookup.raw && context.parameters.workOrderLookup.raw.length > 0) {
            currentWorkOrderId = context.parameters.workOrderLookup.raw[0].id;
        }

        // Leemos el parámetro del campo adicional si se ha configurado
        const extraField = context.parameters.extraOptionSetField?.raw || "";
        
        // Leemos el país configurado (por defecto "Otros")
        const country = context.parameters.countryEnvironment?.raw || "Otros";

        const props: INearbyWorkOrdersAppProps = {
            webAPI: context.webAPI,
            workOrderId: currentWorkOrderId,
            extraOptionSetField: extraField,
            countryEnvironment: country,
            version: "1.0.12"
        };

        return React.createElement(NearbyWorkOrdersApp, props);
    }

    public getOutputs(): IOutputs {
        return {};
    }

    public destroy(): void {
        // Limpieza si fuera necesario
    }
}