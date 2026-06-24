import { Router } from 'express';
import { nodesController } from '../controllers/nodesController';
import { imagesController } from '../controllers/imagesController';
import { transferController } from '../controllers/transferController';
import { settingsController } from '../controllers/settingsController';

const router = Router();

// Node routes
router.get('/nodes', nodesController.getNodes);
router.post('/nodes', nodesController.addNode);
router.delete('/nodes/:name', nodesController.deleteNode);

// Node SSH config routes
router.get('/node-configs', nodesController.getNodeConfigs);
router.post('/node-configs', nodesController.saveNodeConfig);
router.delete('/node-configs/:nodeName', nodesController.deleteNodeConfig);
router.get('/node-configs/:nodeName/test', nodesController.testConnection);

// Image routes
router.get('/images', imagesController.getImages);
router.post('/images/refresh', imagesController.refreshImages);
router.get('/images/:imageName(*)/missing-nodes', imagesController.getMissingNodes);

// Transfer routes
router.post('/transfer-image', transferController.startTransfer);
router.get('/transfer-jobs', transferController.getActiveJobs);
router.get('/transfer-jobs/:jobId', transferController.getJob);
router.get('/transfer-jobs/stream/events', transferController.streamJobUpdates);

// History routes
router.get('/history', transferController.getHistory);
router.get('/stats', transferController.getStats);

// Settings routes
router.get('/settings', settingsController.getSettings);
router.put('/settings', settingsController.updateSettings);

export default router;
