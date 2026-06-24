"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const nodesController_1 = require("../controllers/nodesController");
const imagesController_1 = require("../controllers/imagesController");
const transferController_1 = require("../controllers/transferController");
const settingsController_1 = require("../controllers/settingsController");
const router = (0, express_1.Router)();
// Node routes
router.get('/nodes', nodesController_1.nodesController.getNodes);
router.post('/nodes', nodesController_1.nodesController.addNode);
router.delete('/nodes/:name', nodesController_1.nodesController.deleteNode);
// Node SSH config routes
router.get('/node-configs', nodesController_1.nodesController.getNodeConfigs);
router.post('/node-configs', nodesController_1.nodesController.saveNodeConfig);
router.delete('/node-configs/:nodeName', nodesController_1.nodesController.deleteNodeConfig);
router.get('/node-configs/:nodeName/test', nodesController_1.nodesController.testConnection);
// Image routes
router.get('/images', imagesController_1.imagesController.getImages);
router.post('/images/refresh', imagesController_1.imagesController.refreshImages);
router.get('/images/:imageName/missing-nodes', imagesController_1.imagesController.getMissingNodes);
// Transfer routes
router.post('/transfer-image', transferController_1.transferController.startTransfer);
router.get('/transfer-jobs', transferController_1.transferController.getActiveJobs);
router.get('/transfer-jobs/:jobId', transferController_1.transferController.getJob);
router.get('/transfer-jobs/stream/events', transferController_1.transferController.streamJobUpdates);
// History routes
router.get('/history', transferController_1.transferController.getHistory);
router.get('/stats', transferController_1.transferController.getStats);
// Settings routes
router.get('/settings', settingsController_1.settingsController.getSettings);
router.put('/settings', settingsController_1.settingsController.updateSettings);
exports.default = router;
//# sourceMappingURL=index.js.map