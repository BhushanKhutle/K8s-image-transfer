import { ImageRow } from '../types';
export declare class ImageService {
    fetchImagesFromNode(nodeName: string): Promise<string[]>;
    refreshAllNodes(): Promise<{
        node: string;
        imageCount: number;
        error?: string;
    }[]>;
    getImageInventory(search?: string): ImageRow[];
    getMissingNodes(imageName: string): string[];
    getSourceNodes(imageName: string): string[];
    getLastCacheTime(): string | null;
    markImagePresent(nodeName: string, imageName: string): void;
}
export declare const imageService: ImageService;
//# sourceMappingURL=imageService.d.ts.map