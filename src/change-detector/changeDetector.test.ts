/* Copyright 2025 Esri
 *
 * Licensed under the Apache License Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {
    removeDuplicates,
    getReleasesWithLocalChanges,
} from './changeDetector';
import { getWaybackItems } from '../wayback-items/waybackItems';
import {
    getPreviouseReleaseNumber,
    getImageData,
} from './changeDetectorHelpers';

// Mock the config module
jest.mock('../config', () => ({
    getWaybackServiceBaseURL: jest.fn(
        () =>
            'https://wayback.maptiles.arcgis.com/arcgis/rest/services/World_Imagery/MapServer'
    ),
}));

// Mock the waybackItems module
jest.mock('../wayback-items/waybackItems', () => ({
    getWaybackItems: jest.fn(),
}));

// Mock the changeDetectorHelpers module
jest.mock('./changeDetectorHelpers', () => ({
    getPreviouseReleaseNumber: jest.fn(),
    getImageData: jest.fn(),
}));

const mockGetWaybackItems = getWaybackItems as jest.MockedFunction<
    typeof getWaybackItems
>;
const mockGetPreviouseReleaseNumber =
    getPreviouseReleaseNumber as jest.MockedFunction<
        typeof getPreviouseReleaseNumber
    >;
const mockGetImageData = getImageData as jest.MockedFunction<
    typeof getImageData
>;

// Mock wayback items data for getReleasesWithLocalChanges tests
const mockWaybackItems = [
    {
        releaseNum: 58924,
        releaseDateLabel: '2025-09-25',
        releaseDatetime: 1727222400000,
        itemID: '925025d364fa4e49958f4f1dd2362beb',
        itemTitle: 'World Imagery (Wayback 2025-09-25)',
        itemURL:
            'https://wayback.maptiles.arcgis.com/tile/58924/{level}/{row}/{col}',
        metadataLayerUrl: 'https://metadata.maptiles.arcgis.com/MapServer',
        metadataLayerItemID: '7882c43daf3d4955bed8b5de18bccd82',
        layerIdentifier: 'WB_2025_R09',
    },
    {
        releaseNum: 44988,
        releaseDateLabel: '2022-10-12',
        releaseDatetime: 1665532800000,
        itemID: 'dec36821b2a6470cb5359babf5be2755',
        itemTitle: 'World Imagery (Wayback 2022-10-12)',
        itemURL:
            'https://wayback.maptiles.arcgis.com/tile/44988/{level}/{row}/{col}',
        metadataLayerUrl: 'https://metadata.maptiles.arcgis.com/MapServer',
        metadataLayerItemID: '3ca7cebafaee45c2b01af8ddfa277491',
        layerIdentifier: 'WB_2022_R13',
    },
    {
        releaseNum: 3201,
        releaseDateLabel: '2018-11-07',
        releaseDatetime: 1541548800000,
        itemID: 'f1d75d38d15240f7aa51b106cd0c9aae',
        itemTitle: 'World Imagery (Wayback 2018-11-07)',
        itemURL:
            'https://wayback.maptiles.arcgis.com/tile/3201/{level}/{row}/{col}',
        metadataLayerUrl: 'https://metadata.maptiles.arcgis.com/MapServer',
        metadataLayerItemID: '6f3b3d80c3f14f4388c544393f31b927',
        layerIdentifier: 'WB_2018_R15',
    },
];

// Store image data for mock responses used by removeDuplicates tests
const mockImageDataMap: Map<string, Uint8Array> = new Map();

afterEach(() => {
    mockImageDataMap.clear();
    jest.clearAllMocks();
});

describe('removeDuplicates', () => {
    // Setup mock for getImageData to use mockImageDataMap
    beforeEach(() => {
        mockGetImageData.mockImplementation(
            async (url: string, releaseNumber: number) => {
                const imageData = mockImageDataMap.get(url);
                return {
                    releaseNumber,
                    data: imageData || new Uint8Array(),
                };
            }
        );
    });

    describe('edge cases', () => {
        it('should return empty array when candidates is null', async () => {
            const result = await removeDuplicates(null as any, 12);
            expect(result).toEqual([]);
        });

        it('should return empty array when candidates is empty', async () => {
            const result = await removeDuplicates([], 12);
            expect(result).toEqual([]);
        });

        it('should return single release number when only one candidate exists', async () => {
            const candidates = [
                {
                    releaseNumber: 100,
                    size: 1024,
                    url: 'http://example.com/tile1',
                },
            ];
            const result = await removeDuplicates(candidates, 12);
            expect(result).toEqual([100]);
        });
    });

    describe('zoom level handling', () => {
        it('should skip duplicate removal for zoom level 11', async () => {
            // const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
            const candidates = [
                {
                    releaseNumber: 100,
                    size: 1024,
                    url: 'http://example.com/tile1',
                },
                {
                    releaseNumber: 101,
                    size: 1024,
                    url: 'http://example.com/tile2',
                },
            ];

            const result = await removeDuplicates(candidates, 11);

            expect(result).toEqual([100, 101]);
            // expect(consoleSpy).toHaveBeenCalledWith(
            //     'Skipping duplicate removal process for zoom level',
            //     11
            // );
            // consoleSpy.mockRestore();
        });

        it('should skip duplicate removal for zoom levels below 11', async () => {
            // const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
            const candidates = [
                {
                    releaseNumber: 100,
                    size: 1024,
                    url: 'http://example.com/tile1',
                },
                {
                    releaseNumber: 101,
                    size: 1024,
                    url: 'http://example.com/tile2',
                },
                {
                    releaseNumber: 102,
                    size: 1024,
                    url: 'http://example.com/tile3',
                },
            ];

            const result = await removeDuplicates(candidates, 5);

            expect(result).toEqual([100, 101, 102]);
            // expect(consoleSpy).toHaveBeenCalledWith(
            //     'Skipping duplicate removal process for zoom level',
            //     5
            // );
            // consoleSpy.mockRestore();
        });

        it('should process duplicates for zoom levels above 11', async () => {
            const imageData1 = new Uint8Array([1, 2, 3, 4]);
            const imageData2 = new Uint8Array([5, 6, 7, 8]);

            mockImageDataMap.set('http://example.com/tile1', imageData1);
            mockImageDataMap.set('http://example.com/tile2', imageData2);

            const candidates = [
                {
                    releaseNumber: 100,
                    size: 1024,
                    url: 'http://example.com/tile1',
                },
                {
                    releaseNumber: 101,
                    size: 1024,
                    url: 'http://example.com/tile2',
                },
            ];

            const result = await removeDuplicates(candidates, 12);

            // Both should be returned since image data is different
            expect(result).toEqual([101, 100]);
        });

        it('should keep candidates with different sizes without comparing image data', async () => {
            // Even with identical image data, different sizes should keep both candidates
            const sameImageData = new Uint8Array([1, 2, 3, 4]);

            mockImageDataMap.set('http://example.com/tile1', sameImageData);
            mockImageDataMap.set('http://example.com/tile2', sameImageData);

            const candidates = [
                {
                    releaseNumber: 100,
                    size: 1024,
                    url: 'http://example.com/tile1',
                },
                {
                    releaseNumber: 101,
                    size: 2048, // Different size
                    url: 'http://example.com/tile2',
                },
            ];

            const result = await removeDuplicates(candidates, 12);

            // Both should be returned since sizes are different
            expect(result).toEqual([101, 100]);
        });
    });

    describe('duplicate removal', () => {
        it('should remove consecutive candidates with identical image data', async () => {
            const identicalImageData = new Uint8Array([1, 2, 3, 4, 5]);
            const differentImageData = new Uint8Array([10, 20, 30, 40, 50]);

            mockImageDataMap.set(
                'http://example.com/tile1',
                identicalImageData
            );
            mockImageDataMap.set(
                'http://example.com/tile2',
                identicalImageData
            );
            mockImageDataMap.set(
                'http://example.com/tile3',
                differentImageData
            );

            const candidates = [
                {
                    releaseNumber: 100,
                    size: 1024,
                    url: 'http://example.com/tile1',
                },
                {
                    releaseNumber: 101,
                    size: 1024,
                    url: 'http://example.com/tile2',
                },
                {
                    releaseNumber: 102,
                    size: 1024,
                    url: 'http://example.com/tile3',
                },
            ];

            const result = await removeDuplicates(candidates, 15);

            // Processing order (reversed): [102, 101, 100]
            // 102 (differentImageData) - kept (first item)
            // 101 (identicalImageData) - kept (different from 102's image data)
            // 100 (identicalImageData) - skipped (same as 101's image data)
            expect(result).toEqual([102, 101]);
        });

        it('should keep all candidates when all have unique image data', async () => {
            const imageData1 = new Uint8Array([1, 2, 3]);
            const imageData2 = new Uint8Array([4, 5, 6]);
            const imageData3 = new Uint8Array([7, 8, 9]);

            mockImageDataMap.set('http://example.com/tile1', imageData1);
            mockImageDataMap.set('http://example.com/tile2', imageData2);
            mockImageDataMap.set('http://example.com/tile3', imageData3);

            const candidates = [
                {
                    releaseNumber: 100,
                    size: 1024,
                    url: 'http://example.com/tile1',
                },
                {
                    releaseNumber: 101,
                    size: 1024,
                    url: 'http://example.com/tile2',
                },
                {
                    releaseNumber: 102,
                    size: 1024,
                    url: 'http://example.com/tile3',
                },
            ];

            const result = await removeDuplicates(candidates, 14);

            // All three should be returned (in reversed order due to processing)
            expect(result).toEqual([102, 101, 100]);
        });

        it('should return only one release when all candidates have identical image data', async () => {
            const sameImageData = new Uint8Array([1, 1, 1, 1]);

            mockImageDataMap.set('http://example.com/tile1', sameImageData);
            mockImageDataMap.set('http://example.com/tile2', sameImageData);
            mockImageDataMap.set('http://example.com/tile3', sameImageData);
            mockImageDataMap.set('http://example.com/tile4', sameImageData);

            const candidates = [
                {
                    releaseNumber: 100,
                    size: 1024,
                    url: 'http://example.com/tile1',
                },
                {
                    releaseNumber: 101,
                    size: 1024,
                    url: 'http://example.com/tile2',
                },
                {
                    releaseNumber: 102,
                    size: 1024,
                    url: 'http://example.com/tile3',
                },
                {
                    releaseNumber: 103,
                    size: 1024,
                    url: 'http://example.com/tile4',
                },
            ];

            const result = await removeDuplicates(candidates, 16);

            // Only one release should be returned (the oldest after reversing)
            expect(result).toEqual([103]);
        });

        it('should handle consecutive duplicates correctly', async () => {
            const imageDataA = new Uint8Array([1, 2, 3]);
            const imageDataB = new Uint8Array([4, 5, 6]);

            // Pattern: A, A, B, B (after reverse: B, B, A, A)
            mockImageDataMap.set('http://example.com/tile1', imageDataA);
            mockImageDataMap.set('http://example.com/tile2', imageDataA);
            mockImageDataMap.set('http://example.com/tile3', imageDataB);
            mockImageDataMap.set('http://example.com/tile4', imageDataB);

            const candidates = [
                {
                    releaseNumber: 100,
                    size: 1024,
                    url: 'http://example.com/tile1',
                },
                {
                    releaseNumber: 101,
                    size: 1024,
                    url: 'http://example.com/tile2',
                },
                {
                    releaseNumber: 102,
                    size: 1024,
                    url: 'http://example.com/tile3',
                },
                {
                    releaseNumber: 103,
                    size: 1024,
                    url: 'http://example.com/tile4',
                },
            ];

            const result = await removeDuplicates(candidates, 13);

            // After reversing: [103, 102, 101, 100]
            // 103 (B) - kept, 102 (B) - duplicate, 101 (A) - kept, 100 (A) - duplicate
            expect(result).toEqual([103, 101]);
        });
    });

    describe('failed image fetch handling', () => {
        it('should treat failed image fetches as duplicates since they return empty Uint8Array', async () => {
            // Both URLs not in mockImageDataMap, so they return empty Uint8Array
            const candidates = [
                {
                    releaseNumber: 100,
                    size: 1024,
                    url: 'http://example.com/tile1',
                },
                {
                    releaseNumber: 101,
                    size: 1024,
                    url: 'http://example.com/tile2',
                },
            ];

            const result = await removeDuplicates(candidates, 12);

            // Both return empty Uint8Array, so they are considered duplicates
            // Processing in reverse: 101 kept, 100 skipped as duplicate
            expect(result).toEqual([101]);
        });

        it('should keep candidates with different sizes even when image fetch fails', async () => {
            // Both URLs not in mockImageDataMap, so they return empty Uint8Array
            const candidates = [
                {
                    releaseNumber: 100,
                    size: 1024,
                    url: 'http://example.com/tile1',
                },
                {
                    releaseNumber: 101,
                    size: 2048, // Different size
                    url: 'http://example.com/tile2',
                },
            ];

            const result = await removeDuplicates(candidates, 12);

            // Different sizes mean they are kept regardless of image data comparison
            expect(result).toEqual([101, 100]);
        });

        it('should handle mix of successful and failed image fetches', async () => {
            const validImageData = new Uint8Array([1, 2, 3, 4]);

            // Set up mock for one successful URL, tile2 will fail (not in mockImageDataMap)
            mockImageDataMap.set('http://example.com/tile1', validImageData);

            const candidates = [
                {
                    releaseNumber: 100,
                    size: 1024,
                    url: 'http://example.com/tile1', // Will succeed
                },
                {
                    releaseNumber: 101,
                    size: 1024,
                    url: 'http://example.com/tile2', // Will fail, returns empty array
                },
            ];

            const result = await removeDuplicates(candidates, 12);

            // Processing in reverse: 101 (empty) kept first, 100 (valid data) is different, so kept
            expect(result).toEqual([101, 100]);
        });
    });
});

// Helper to create tilemap response for getReleasesWithLocalChanges tests
const createTilemapResponse = (
    hasLocalChange: boolean,
    selectReleaseNumber?: number,
    size: number = 1024
) => ({
    data: [hasLocalChange ? 1 : 0],
    select: selectReleaseNumber ? [selectReleaseNumber] : [],
    valid: true,
    location: { left: 0, top: 0, width: 1, height: 1 },
    size: [size],
});

describe('getReleasesWithLocalChanges', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockGetWaybackItems.mockResolvedValue(mockWaybackItems);
    });

    describe('edge cases', () => {
        it('should return empty array when column is undefined', async () => {
            const result = await getReleasesWithLocalChanges({
                column: undefined as any,
                row: 100,
                level: 12,
            });
            expect(result).toEqual([]);
        });

        it('should return empty array when row is undefined', async () => {
            const result = await getReleasesWithLocalChanges({
                column: 100,
                row: undefined as any,
                level: 12,
            });
            expect(result).toEqual([]);
        });

        it('should return empty array when level is undefined', async () => {
            const result = await getReleasesWithLocalChanges({
                column: 100,
                row: 100,
                level: undefined as any,
            });
            expect(result).toEqual([]);
        });
    });

    describe('single local change', () => {
        it('should return single release when only one local change exists', async () => {
            // First request finds a local change, second request finds none
            global.fetch = jest
                .fn()
                .mockResolvedValueOnce({
                    ok: true,
                    json: () =>
                        Promise.resolve(
                            createTilemapResponse(true, 58924, 2048)
                        ),
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: () => Promise.resolve(createTilemapResponse(false)),
                });

            mockGetPreviouseReleaseNumber.mockResolvedValueOnce(44988);

            const result = await getReleasesWithLocalChanges({
                column: 100,
                row: 200,
                level: 12,
            });

            expect(result).toHaveLength(1);
            expect(result[0]).toEqual({
                releaseNumber: 58924,
                size: 2048,
                url: '',
            });
        });
    });

    describe('multiple local changes', () => {
        it('should return multiple releases when multiple local changes exist', async () => {
            // Three requests: first two find local changes, third finds none
            global.fetch = jest
                .fn()
                .mockResolvedValueOnce({
                    ok: true,
                    json: () =>
                        Promise.resolve(
                            createTilemapResponse(true, 58924, 2048)
                        ),
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: () =>
                        Promise.resolve(
                            createTilemapResponse(true, 44988, 1536)
                        ),
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: () => Promise.resolve(createTilemapResponse(false)),
                });

            mockGetPreviouseReleaseNumber
                .mockResolvedValueOnce(44988)
                .mockResolvedValueOnce(3201);

            const result = await getReleasesWithLocalChanges({
                column: 100,
                row: 200,
                level: 12,
            });

            expect(result).toHaveLength(2);
            expect(result[0]).toEqual({
                releaseNumber: 58924,
                size: 2048,
                url: '',
            });
            expect(result[1]).toEqual({
                releaseNumber: 44988,
                size: 1536,
                url: '',
            });
        });

        it('should handle three consecutive local changes', async () => {
            global.fetch = jest
                .fn()
                .mockResolvedValueOnce({
                    ok: true,
                    json: () =>
                        Promise.resolve(
                            createTilemapResponse(true, 58924, 2048)
                        ),
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: () =>
                        Promise.resolve(
                            createTilemapResponse(true, 44988, 1536)
                        ),
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: () =>
                        Promise.resolve(
                            createTilemapResponse(true, 3201, 1024)
                        ),
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: () => Promise.resolve(createTilemapResponse(false)),
                });

            mockGetPreviouseReleaseNumber
                .mockResolvedValueOnce(44988)
                .mockResolvedValueOnce(3201)
                .mockResolvedValueOnce(null);

            const result = await getReleasesWithLocalChanges({
                column: 100,
                row: 200,
                level: 12,
            });

            expect(result).toHaveLength(3);
            expect(result.map((r) => r.releaseNumber)).toEqual([
                58924, 44988, 3201,
            ]);
        });
    });

    describe('no local changes', () => {
        it('should return empty array when no local changes exist', async () => {
            global.fetch = jest.fn().mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve(createTilemapResponse(false)),
            });

            const result = await getReleasesWithLocalChanges({
                column: 100,
                row: 200,
                level: 12,
            });

            expect(result).toEqual([]);
        });
    });

    describe('select field handling', () => {
        it('should use release number from select field when available', async () => {
            // The tilemap response has a different release number in select[0]
            global.fetch = jest
                .fn()
                .mockResolvedValueOnce({
                    ok: true,
                    json: () =>
                        Promise.resolve({
                            data: [1],
                            select: [44988], // Different from most recent release
                            valid: true,
                            location: { left: 0, top: 0, width: 1, height: 1 },
                            size: [1024],
                        }),
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: () => Promise.resolve(createTilemapResponse(false)),
                });

            mockGetPreviouseReleaseNumber.mockResolvedValueOnce(3201);

            const result = await getReleasesWithLocalChanges({
                column: 100,
                row: 200,
                level: 12,
            });

            expect(result).toHaveLength(1);
            expect(result[0].releaseNumber).toBe(44988);
        });

        it('should use request release number when select field is empty', async () => {
            global.fetch = jest
                .fn()
                .mockResolvedValueOnce({
                    ok: true,
                    json: () =>
                        Promise.resolve({
                            data: [1],
                            select: [], // Empty select array
                            valid: true,
                            location: { left: 0, top: 0, width: 1, height: 1 },
                            size: [2048],
                        }),
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: () => Promise.resolve(createTilemapResponse(false)),
                });

            mockGetPreviouseReleaseNumber.mockResolvedValueOnce(44988);

            const result = await getReleasesWithLocalChanges({
                column: 100,
                row: 200,
                level: 12,
            });

            expect(result).toHaveLength(1);
            // Should use the most recent release number (58924) as fallback
            expect(result[0].releaseNumber).toBe(58924);
        });
    });

    describe('size field handling', () => {
        it('should capture tile size from response', async () => {
            global.fetch = jest
                .fn()
                .mockResolvedValueOnce({
                    ok: true,
                    json: () =>
                        Promise.resolve(
                            createTilemapResponse(true, 58924, 4096)
                        ),
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: () => Promise.resolve(createTilemapResponse(false)),
                });

            mockGetPreviouseReleaseNumber.mockResolvedValueOnce(44988);

            const result = await getReleasesWithLocalChanges({
                column: 100,
                row: 200,
                level: 12,
            });

            expect(result[0].size).toBe(4096);
        });

        it('should default to 0 when size is not provided', async () => {
            global.fetch = jest
                .fn()
                .mockResolvedValueOnce({
                    ok: true,
                    json: () =>
                        Promise.resolve({
                            data: [1],
                            select: [58924],
                            valid: true,
                            location: { left: 0, top: 0, width: 1, height: 1 },
                            size: [], // Empty size array
                        }),
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: () => Promise.resolve(createTilemapResponse(false)),
                });

            mockGetPreviouseReleaseNumber.mockResolvedValueOnce(44988);

            const result = await getReleasesWithLocalChanges({
                column: 100,
                row: 200,
                level: 12,
            });

            expect(result[0].size).toBe(0);
        });
    });

    describe('error handling', () => {
        it('should reject when fetch fails', async () => {
            const consoleSpy = jest
                .spyOn(console, 'error')
                .mockImplementation();

            global.fetch = jest
                .fn()
                .mockRejectedValueOnce(new Error('Network error'));

            await expect(
                getReleasesWithLocalChanges({
                    column: 100,
                    row: 200,
                    level: 12,
                })
            ).rejects.toBeNull();

            expect(consoleSpy).toHaveBeenCalled();
            consoleSpy.mockRestore();
        });
    });

    describe('URL construction', () => {
        it('should construct correct tilemap URL', async () => {
            global.fetch = jest.fn().mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve(createTilemapResponse(false)),
            });

            await getReleasesWithLocalChanges({
                column: 123,
                row: 456,
                level: 15,
            });

            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('/tilemap/58924/15/456/123')
            );
        });
    });

    describe('recursion termination', () => {
        it('should stop recursion when getPreviouseReleaseNumber returns null', async () => {
            global.fetch = jest.fn().mockResolvedValueOnce({
                ok: true,
                json: () =>
                    Promise.resolve(createTilemapResponse(true, 3201, 1024)),
            });

            // Return null to indicate no previous release
            mockGetPreviouseReleaseNumber.mockResolvedValueOnce(null);

            const result = await getReleasesWithLocalChanges({
                column: 100,
                row: 200,
                level: 12,
            });

            expect(result).toHaveLength(1);
            expect(global.fetch).toHaveBeenCalledTimes(1);
        });
    });
});
