import { Request, Response } from 'express';
import { imageService } from '../services/imageService';

export const imagesController = {
  async getImages(req: Request, res: Response) {
    try {
      const search = req.query.search as string | undefined;
      const images = imageService.getImageInventory(search);
      const lastRefresh = imageService.getLastCacheTime();
      res.json({ images, lastRefresh });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },

  async refreshImages(req: Request, res: Response) {
    try {
      const { nodeName } = req.query;
      if (nodeName) {
        try {
          const images = await imageService.fetchImagesFromNode(nodeName as string);
          res.json({ results: [{ node: nodeName, imageCount: images.length }] });
        } catch (err: any) {
          res.json({ results: [{ node: nodeName, imageCount: 0, error: err.message }] });
        }
      } else {
        const results = await imageService.refreshAllNodes();
        // Always return 200 with results, even if some nodes failed
        res.json({ results });
      }
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },

  async getMissingNodes(req: Request, res: Response) {
    try {
      const imageName = decodeURIComponent(req.params.imageName);
      const missingNodes = imageService.getMissingNodes(imageName);
      const sourceNodes = imageService.getSourceNodes(imageName);
      res.json({ imageName, missingNodes, sourceNodes });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },
};
