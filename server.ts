import express, { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { simulator } from './src/services/simulationState.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  app.use(express.json());

  // --- API Routes ---
  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', app: 'BloodStock', timestamp: new Date().toISOString() });
  });

  app.get('/api/hospitals', (_req: Request, res: Response) => {
    res.json(simulator.getHospitals());
  });

  app.get('/api/inventory', (_req: Request, res: Response) => {
    res.json(simulator.getUnits());
  });

  app.get('/api/requests', (_req: Request, res: Response) => {
    res.json(simulator.getRequests());
  });

  app.get('/api/reservations', (_req: Request, res: Response) => {
    res.json(simulator.getReservations());
  });

  app.get('/api/transfers', (_req: Request, res: Response) => {
    res.json(simulator.getTransfers());
  });

  app.get('/api/travel-matrix', (_req: Request, res: Response) => {
    res.json(simulator.getTravelMatrix());
  });

  app.get('/api/system-state', (_req: Request, res: Response) => {
    res.json({
      simulationTime: simulator.getSimulationTime().toISOString(),
      activeScenario: simulator.getActiveScenario(),
      lastBaselineRun: simulator.getLastBaselineRun(),
      lastOptimizerRun: simulator.getLastOptimizerRun(),
      auditHistory: simulator.getAuditHistory(),
    });
  });

  app.post('/api/run-baseline', (_req: Request, res: Response) => {
    const summary = simulator.executeBaseline();
    res.json(summary);
  });

  app.post('/api/run-optimizer', (_req: Request, res: Response) => {
    const summary = simulator.executeOptimizer();
    res.json(summary);
  });

  app.post('/api/commit-reservations', (req: Request, res: Response) => {
    const { allocations, operatorNote } = req.body;
    if (!allocations || !Array.isArray(allocations)) {
      return res.status(400).json({ error: 'Missing or invalid allocations array.' });
    }
    const result = simulator.commitProposedPlan(allocations, operatorNote);
    res.json(result);
  });

  app.post('/api/advance-time', (req: Request, res: Response) => {
    const minutes = typeof req.body.minutes === 'number' ? req.body.minutes : 30;
    simulator.advanceTime(minutes);
    res.json({
      simulationTime: simulator.getSimulationTime().toISOString(),
      message: `Simulated clock advanced by ${minutes} minutes.`,
    });
  });

  app.post('/api/trigger-scenario', (req: Request, res: Response) => {
    const { scenarioCode } = req.body;
    if (!scenarioCode) {
      return res.status(400).json({ error: 'Missing scenarioCode' });
    }
    const scenario = simulator.triggerScenario(scenarioCode);
    res.json(scenario);
  });

  app.post('/api/create-request', (req: Request, res: Response) => {
    try {
      const created = simulator.createNewRequest(req.body);
      res.json(created);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/cancel-request', (req: Request, res: Response) => {
    const { requestId } = req.body;
    if (!requestId) return res.status(400).json({ error: 'Missing requestId' });
    const result = simulator.cancelRequest(requestId);
    res.json(result);
  });

  app.post('/api/simulate-transfer-failure', (req: Request, res: Response) => {
    const { transferId } = req.body;
    if (!transferId) return res.status(400).json({ error: 'Missing transferId' });
    const result = simulator.simulateTransferFailure(transferId);
    res.json(result);
  });

  app.post('/api/add-unit', (req: Request, res: Response) => {
    try {
      const unit = simulator.addSyntheticUnit(req.body);
      res.json(unit);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/reset', (_req: Request, res: Response) => {
    simulator.resetToInitialState();
    res.json({ message: 'Reset simulator to initial state.' });
  });

  // --- Vite Dev Server Middleware / Static Serve ---
  const isProduction = process.env.NODE_ENV === 'production';
  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[BloodStock Server] Running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('[BloodStock Server] Failed to start:', err);
});
