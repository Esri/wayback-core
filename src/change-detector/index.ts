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

import { getTileImageURL, getWaybackServiceBaseURL } from '../config';
import { lat2tile, long2tile } from '../helpers/geometry';
import { areUint8ArraysEqual } from '../helpers/unit8array';
import { WaybackItem } from '../types';
import {
    getWaybackItemByReleaseNumber,
    getWaybackItems,
} from '../wayback-items/waybackItems';

type LocalChangeCandidate = {
    /**
     * release number of a wayback item
     */
    releaseNumber: number;
    /**
     * size of the tile image data associated with this wayback release
     */
    size: number;
    /**
     * url of a tile image from this wayback release
     */
    url: string;
};

type IResponseGetImageData = {
    releaseNumber: number;
    data: Uint8Array;
};

type IResponseWaybackTilemap = {
    data: Array<number>;
    select: Array<number>;
    valid: boolean;
    location: {
        left: number;
        top: number;
        width: number;
        height: number;
    };
    size: number[];
};

/**
 * The following code initializes a Map named 'wabackItemsIndicemMap' intended to store
 * the index of each wayback item within the 'waybackItems' array. This Map facilitates
 * the retrieval of the index of a specific wayback item, which enables the identification
 * of the preceding wayback release in the array. This index reference is crucial for
 * identifying the wayback item that precedes a given one.
 */
let wabackItemsIndicemMap: Map<number, number> | null = null;

/**
 * Retrieves a list of world imagery wayback releases with local changes for a specified geographic point at a given zoom level.
 * It fetches wayback configuration data, find the release of wayback items with local changes, and determines unique release associated
 * with image tiles linked to local changes.
 *
 * @param point The geographic coordinates (longitude and latitude) of the location of interest, (e.g., `{longitude: -100.05, latitude: 35.10}`)
 * @param zoom The zoom level used to determine the level of detail for the geographic point
 * @abortController AbortController that will be used in case user needs to cancel the pending task
 * @returns {Promise<WaybackItem[]>} A Promise that resolves with an array of unique releases of wayback items
 *          associated with local changes for the given geographic point and zoom level.
 */
export const getWaybackItemsWithLocalChanges = async (
    point: {
        latitude: number;
        longitude: number;
    },
    zoom: number,
    abortController?: AbortController
): Promise<WaybackItem[]> => {
    const { longitude, latitude } = point;

    const level = +zoom.toFixed(0);
    const column = long2tile(longitude, level);
    const row = lat2tile(latitude, level);

    const releaseWithLocalChanges = await getReleasesWithLocalChanges({
        column,
        row,
        level,
    });

    // Constructs Candidate objects with release numbers and corresponding image URLs
    const candidates: LocalChangeCandidate[] = [];

    for (const d of releaseWithLocalChanges) {
        const { releaseNumber, size } = d;

        const { itemURL } =
            (await getWaybackItemByReleaseNumber(releaseNumber)) || {};

        // If itemURL is not available, skip this release number
        if (!itemURL) {
            continue;
        }

        const candidate: LocalChangeCandidate = {
            releaseNumber,
            size,
            url: getTileImageURL({
                urlTemplate: itemURL,
                column,
                row,
                level,
            }),
        };

        candidates.push(candidate);
    }
    // console.log(candidates)

    // Removes release with duplicate tile image data and extracts unique release numbers
    const rNumsNoDuplicates = await removeDuplicates(candidates, level);
    // console.log(rNumsNoDuplicates)

    const output: WaybackItem[] = [];

    for (const releaseNumber of rNumsNoDuplicates) {
        const waybackItem = await getWaybackItemByReleaseNumber(releaseNumber);
        if (waybackItem) {
            output.push(waybackItem);
        }
    }

    if (abortController?.signal.aborted) {
        throw new Error(
            'Task aborted: getWaybackItemsWithLocalChanges has been aborted by the user.'
        );
    }

    return output;
};

/**
 * Determine the release number of the wayback item that precedes a given input release number
 * in a sequence of World Imagery Wayback releases.
 *
 * @param releaseNumber The release number of a specific wayback item to check for the preceding release
 * @returns The release number of the wayback item that was released immediately before the input release
 *          number. Returns null if no preceding wayback item exists or if the input is invalid.
 */
const getPreviouseReleaseNumber = async (
    releaseNumber: number
): Promise<number | null> => {
    // Retrieves an array of data for all World Imagery Wayback releases sorted by release date in descending order
    const waybackItems = await getWaybackItems();

    // Initialize and populate the `wabackItemsIndicemMap` if it's currently empty
    if (!wabackItemsIndicemMap) {
        const map = new Map<number, number>();

        for (const [index, item] of waybackItems.entries()) {
            map.set(item.releaseNum, index);
        }

        wabackItemsIndicemMap = map;
    }

    // Obtain the index of the wayback item by its release number from the previously populated map
    const indexOfWaybackItem = wabackItemsIndicemMap.get(releaseNumber);

    if (indexOfWaybackItem === undefined) {
        return null;
    }

    // Determine the wayback item preceding the input release number, if available
    const previousItem = waybackItems[indexOfWaybackItem + 1]
        ? waybackItems[indexOfWaybackItem + 1]
        : null;

    // Return the release number of the identified previous wayback item, or null if none exists
    return previousItem?.releaseNum || null;
};

/**
 * Sends tilemap requests to identify World Imagery Wayback releases that contain local changes.
 *
 * Returns release numbers of wayback items with local changes for a specific tile (defined by column, row, and level),
 * along with the size of the tile image data.
 *
 * Note: results may include duplicate release numbers with identical tile image data.
 *
 * @param column Column coordinate for the tile
 * @param row Row coordinate for the tile
 * @param level Level of detail for the tile
 * @returns A Promise that resolves with an array containing release numbers associated with local changes
 *          found in World Imagery Wayback items.
 */
const getReleasesWithLocalChanges = async ({
    column,
    row,
    level,
}: {
    column: number;
    row: number;
    level: number;
}): Promise<LocalChangeCandidate[]> => {
    if (column === undefined || row === undefined || level === undefined) {
        return [];
    }

    const waybackItems = await getWaybackItems();

    return new Promise((resolve, reject) => {
        const results: Array<LocalChangeCandidate> = [];

        // release number of the latest wayback item
        const mostRecentRelease = waybackItems[0].releaseNum;

        const waybackMapServerBaseUrl = getWaybackServiceBaseURL();

        /**
         * Recursively sends tilemap requests to identify all wayback releases with local changes for the specified tile.
         *
         * How it works:
         * 1. Sends a tilemap request to the wayback map server for the given release number.
         * 2. Parses the response to determine if local changes exist:
         *    - `data[0]`: A truthy value (e.g., 1) indicates that the tile has local changes in some wayback release.
         *    - `select[0]`: Contains the release number of the closest wayback version with local changes.
         *                   If not present, the current release number is used.
         *    - `size[0]`: The size (in bytes) of the tile image data for this release.
         * 3. If local changes are detected (`data[0]` is truthy):
         *    - Adds the release number and tile size to the results array.
         *    - Retrieves the preceding release number and recursively calls this function to check for earlier changes.
         * 4. The recursion continues backward through releases until no more local changes are found,
         *    at which point the Promise resolves with the accumulated results.
         *
         * @param releaseNumber The release number to query for local changes
         */
        const tilemapRequest = async (releaseNumber: number) => {
            try {
                const requestUrl = `${waybackMapServerBaseUrl}/tilemap/${releaseNumber}/${level}/${row}/${column}`;

                const response = await fetch(requestUrl);

                const tilemapResponse: IResponseWaybackTilemap =
                    await response.json();

                // retrieve the release number of the closest version of thw wayback item that comes with local changes to the release number that you use for the tilemap request
                const lastReleaseCameWithLocalChange =
                    tilemapResponse.select && tilemapResponse.select[0]
                        ? +tilemapResponse.select[0]
                        : releaseNumber;

                // Checks for local changes and updates the results array accordingly
                if (tilemapResponse.data[0]) {
                    // size of the tile image data associated with the tilemap request
                    const size = tilemapResponse.size[0] || 0;

                    results.push({
                        releaseNumber: lastReleaseCameWithLocalChange,
                        size,
                        url: '', // url will be populated later
                    });
                }

                // Obtains the release number to check for the previous wayback item
                const releaseNumOfNextWaybackItemToCheck = tilemapResponse
                    .data[0]
                    ? await getPreviouseReleaseNumber(
                          lastReleaseCameWithLocalChange
                      )
                    : null;

                if (releaseNumOfNextWaybackItemToCheck) {
                    tilemapRequest(releaseNumOfNextWaybackItemToCheck);
                } else {
                    resolve(results);
                }
            } catch (err) {
                console.error(err);
                reject(null);
            }
        };

        tilemapRequest(mostRecentRelease);
    });
};

/**
 * Asynchronous function removeDuplicates is responsible for processing an array of Candidate objects
 * to extract unique release numbers associated with image data URLs. It eliminates duplicate image data
 * and returns an array of unique release numbers.
 *
 * @param candidates An array of Candidate objects containing URL and releaseNumber information
 * @param zoomLevel The zoom level used to determine whether to skip duplicate removal process
 * @returns A Promise that resolves with an array of unique release numbers extracted from the provided Candidates
 *          If the input array is empty or encounters an error during processing, it returns an empty array.
 */
const removeDuplicates = async (
    candidates: Array<LocalChangeCandidate>,
    zoomLevel: number
): Promise<Array<number>> => {
    if (!candidates || !candidates.length) {
        return [];
    }

    // for zoom levels 11 and below, we skip duplicate removal process
    // as tile images at these zoom levels have less updates and changes over time
    // thus are less likely to have duplicate images
    if (zoomLevel <= 11) {
        console.log(
            'Skipping duplicate removal process for zoom level',
            zoomLevel
        );
        return candidates.map((c) => c.releaseNumber);
    }

    // reverse the candidates list so the wayback items will be sorted by release dates in ascending order (oldest >>> latest)
    const imageDataRequests = candidates.reverse().map((candidate) => {
        return getImageData(candidate.url, candidate.releaseNumber);
    });

    // array of uniqeu image data with duplicated items removed
    const uniqueImageData: IResponseGetImageData[] = [];

    try {
        const imageDataResults = await Promise.all(imageDataRequests);

        for (const currentItem of imageDataResults) {
            const previousItem = uniqueImageData[uniqueImageData.length - 1];

            // image data of the currentItem is identical to the image data of the previous item,
            // skip pushing current data to the uniqueImageData list
            if (
                previousItem &&
                areUint8ArraysEqual(previousItem.data, currentItem.data)
            ) {
                continue;
            }

            uniqueImageData.push(currentItem);
        }
    } catch (err) {
        console.error('failed to fetch all image data uri', err);
    }

    // return release number of the items in the uniqueImageData array
    return uniqueImageData.map((d) => d.releaseNumber);
};

const getImageData = async (
    imageUrl: string,
    releaseNumber: number
): Promise<IResponseGetImageData> => {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('GET', imageUrl, true);
        xhr.responseType = 'arraybuffer';

        xhr.onload = function () {
            if (this.status == 200) {
                const data = new Uint8Array(this.response);

                resolve({
                    releaseNumber,
                    data,
                });
            } else {
                reject();
            }
        };

        xhr.send();
    });
};
