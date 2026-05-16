import express from 'express';
import bodyParser from 'body-parser';
import { MonitoringController } from './controllers/monitoringController';

const app = express();
const port = process.env.PORT || 3000;

app.use(bodyParser.json());

const monitoringController = new MonitoringController();

app.get('/alerts', monitoringController.getAlerts.bind(monitoringController));
app.post('/alerts', monitoringController.createAlert.bind(monitoringController));

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});