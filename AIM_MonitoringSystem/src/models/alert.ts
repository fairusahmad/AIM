export class Alert {
    id: string;
    message: string;
    severity: 'low' | 'medium' | 'high';

    constructor(id: string, message: string, severity: 'low' | 'medium' | 'high') {
        this.id = id;
        this.message = message;
        this.severity = severity;
    }
}