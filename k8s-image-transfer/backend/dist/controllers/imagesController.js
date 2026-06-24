"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.imagesController = void 0;
const imageService_1 = require("../services/imageService");
exports.imagesController = {
    async getImages(req, res) {
        try {
            const search = req.query.search;
            const images = imageService_1.imageService.getImageInventory(search);
            const lastRefresh = imageService_1.imageService.getLastCacheTime();
            res.json({ images, lastRefresh });
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    },
    async refreshImages(req, res) {
        try {
            const { nodeName } = req.query;
            if (nodeName) {
                try {
                    const images = await imageService_1.imageService.fetchImagesFromNode(nodeName);
                    res.json({ results: [{ node: nodeName, imageCount: images.length }] });
                }
                catch (err) {
                    res.json({ results: [{ node: nodeName, imageCount: 0, error: err.message }] });
                }
            }
            else {
                const results = await imageService_1.imageService.refreshAllNodes();
                // Always return 200 with results, even if some nodes failed
                res.json({ results });
            }
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    },
    async getMissingNodes(req, res) {
        try {
            const imageName = decodeURIComponent(req.params.imageName);
            const missingNodes = imageService_1.imageService.getMissingNodes(imageName);
            const sourceNodes = imageService_1.imageService.getSourceNodes(imageName);
            res.json({ imageName, missingNodes, sourceNodes });
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    },
};
//# sourceMappingURL=imagesController.js.map