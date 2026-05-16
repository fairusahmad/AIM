export class MonitoringController {
    private monitoringService: MonitoringService;

    constructor(monitoringService: MonitoringService) {
        this.monitoringService = monitoringService;
    }

    public async getAlerts(req: Request, res: Response): Promise<void> {
        try {
            const alerts = await this.monitoringService.fetchAlerts();
            res.status(200).json(alerts);
        } catch (error) {
            res.status(500).json({ message: 'Error fetching alerts', error });
        }
    }

    public async createAlert(req: Request, res: Response): Promise<void> {
        const { message, severity } = req.body;
        try {
            const newAlert = await this.monitoringService.triggerAlert(message, severity);
            res.status(201).json(newAlert);
        } catch (error) {
            res.status(500).json({ message: 'Error creating alert', error });
        }
    }
}