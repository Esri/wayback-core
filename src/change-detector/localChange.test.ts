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

import { removeDuplicates } from './index';

// Mock XMLHttpRequest for getImageData function
const mockXHR = {
    open: jest.fn(),
    send: jest.fn(),
    responseType: '',
    onload: null as (() => void) | null,
    status: 200,
    response: null as ArrayBuffer | null,
};

// Store image data for mock responses
const mockImageDataMap: Map<string, Uint8Array> = new Map();

beforeAll(() => {
    // @ts-ignore - Mocking XMLHttpRequest
    global.XMLHttpRequest = jest.fn(() => ({
        ...mockXHR,
        open: jest.fn((method: string, url: string) => {
            // Store the URL for later use in onload
            mockXHR.open(method, url);
            (mockXHR as any).currentUrl = url;
        }),
        send: jest.fn(function (this: any) {
            const url = (mockXHR as any).currentUrl;
            const imageData = mockImageDataMap.get(url);
            if (imageData) {
                this.status = 200;
                this.response = imageData.buffer;
                if (this.onload) {
                    this.onload.call(this);
                }
            }
        }),
    })) as any;
});

afterEach(() => {
    mockImageDataMap.clear();
    jest.clearAllMocks();
});

describe('removeDuplicates', () => {
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
    });

    describe('duplicate removal', () => {
        it('should remove candidates with identical image data', async () => {
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

            // Note: candidates are reversed, so processing order is [102, 101, 100]
            // 102 (differentImageData) - kept (first item)
            // 101 (identicalImageData) - kept (different from 102)
            // 100 (identicalImageData) - skipped (same as 101)
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

    describe('error handling', () => {
        it('should return empty array when image fetch fails', async () => {
            // const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

            // Override XMLHttpRequest to simulate failure
            // @ts-ignore
            global.XMLHttpRequest = jest.fn(() => ({
                open: jest.fn(),
                send: jest.fn(function (this: any) {
                    this.status = 404;
                    if (this.onload) {
                        this.onload.call(this);
                    }
                }),
                responseType: '',
            })) as any;

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

            expect(result).toEqual([]);
            // expect(consoleSpy).toHaveBeenCalled();
            // consoleSpy.mockRestore();
        });
    });
});
