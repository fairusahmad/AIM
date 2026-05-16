export class MonitoringService {
    private alerts: Alert[] = [];

    fetchAlerts(): Alert[] {
        return this.alerts;
    }

    triggerAlert(message: string, severity: string): Alert {
        const newAlert = new Alert(this.alerts.length + 1, message, severity);
        this.alerts.push(newAlert);
        return newAlert;
    }
}

class Alert {
    constructor(public id: number, public message: string, public severity: string) {}
}