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
import {
    getImageData,
    getPreviouseReleaseNumber,
    IResponseGetImageData,
} from './changeDetectorHelpers';

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

/**
 * Response structure for wayback tilemap requests
 */
type IResponseWaybackTilemap = {
    /**
     * Array indicating whether local changes exist for the requested tile
     */
    data: Array<number>;
    /**
     * Array of release numbers corresponding to the closest wayback versions with local changes
     */
    select: Array<number>;
    valid: boolean;
    location: {
        left: number;
        top: number;
        width: number;
        height: number;
    };
    /**
     * Array of sizes (in bytes) of the tile image data for each release
     */
    size: number[];
};

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
    // shouldNotUseSizeToFilterDuplicates?: boolean
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
    // const rNumsNoDuplicates =
    //     shouldNotUseSizeToFilterDuplicates === false
    //         ? await removeDuplicates(candidates, level)
    //         : await removeDuplicates_TO_BE_REMOVED_SOON(candidates);
    // // console.log(rNumsNoDuplicates)

    // Removes release with duplicate tile image data and extracts unique release numbers
    // const rNumsNoDuplicates = await removeDuplicates(candidates, level);
    const rNumsNoDuplicates = await removeDuplicatesFasterApproach(
        candidates,
        level
    );

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
export const getReleasesWithLocalChanges = async ({
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

// /**
//  * Original version of removeDuplicates function that does not use size to pre-filter candidates.
//  * This function is kept for comparison purposes.
//  * Wiill be removed in future versions.
//  *
//  * @param candidates An array of Candidate objects containing URL and releaseNumber information
//  * @returns A Promise that resolves with an array of unique release numbers extracted from the provided Candidate
//  */
// const removeDuplicates_TO_BE_REMOVED_SOON = async (
//     candidates?: Array<LocalChangeCandidate>
// ): Promise<Array<number>> => {
//     if (!candidates || !candidates.length) {
//         return [];
//     }

//     // reverse the candidates list so the wayback items will be sorted by release dates in ascending order (oldest >>> latest)
//     const imageDataRequests = candidates.reverse().map((candidate) => {
//         return getImageData(candidate.url, candidate.releaseNumber);
//     });

//     // array of uniqeu image data with duplicated items removed
//     const uniqueImageData: IResponseGetImageData[] = [];

//     try {
//         const imageDataResults = await Promise.all(imageDataRequests);

//         for (const currentItem of imageDataResults) {
//             const previousItem = uniqueImageData[uniqueImageData.length - 1];

//             // image data of the currentItem is identical to the image data of the previous item,
//             // skip pushing current data to the uniqueImageData list
//             if (
//                 previousItem &&
//                 areUint8ArraysEqual(previousItem.data, currentItem.data)
//             ) {
//                 continue;
//             }

//             uniqueImageData.push(currentItem);
//         }
//     } catch (err) {
//         console.error('failed to fetch all image data uri', err);
//     }

//     // return release number of the items in the uniqueImageData array
//     return uniqueImageData.map((d) => d.releaseNumber);
// };

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
export const removeDuplicates = async (
    candidates: Array<LocalChangeCandidate>,
    zoomLevel: number
): Promise<Array<number>> => {
    if (!candidates || !candidates.length) {
        return [];
    }

    // if there's only one candidate, no need to process further
    if (candidates.length === 1) {
        return candidates.map((c) => c.releaseNumber);
    }

    // for zoom levels 11 and below, we skip duplicate removal process
    // as tile images at these zoom levels have less updates and changes over time
    // thus are less likely to have duplicate images
    if (zoomLevel <= 11) {
        // console.log(
        //     'Skipping duplicate removal process for zoom level',
        //     zoomLevel
        // );
        return candidates.map((c) => c.releaseNumber);
    }

    // array to hold candidates that may have duplicate image data
    const candidatesToFetchImageData: LocalChangeCandidate[] = [];
    let prevWasAdded = false;

    for (let i = 0; i < candidates.length; i++) {
        const currCandidate = candidates[i];
        const prevCandidate = candidates[i - 1];

        if (prevCandidate && currCandidate.size === prevCandidate.size) {
            // Add previous candidate if not already added
            if (!prevWasAdded) {
                candidatesToFetchImageData.push(prevCandidate);
            }
            // Add current candidate
            candidatesToFetchImageData.push(currCandidate);
            prevWasAdded = true;
        } else {
            prevWasAdded = false;
        }
    }
    console.log(
        `Fetching image data for ${candidatesToFetchImageData.length} candidates out of ${candidates.length} total candidates to check for duplicates.`
    );

    // requests for fetching image data for the candidates that may have duplicates
    const imageDataRequests = candidatesToFetchImageData.map((candidate) => {
        return getImageData(candidate.url, candidate.releaseNumber);
    });

    try {
        // array to hold deduplicated candidates
        const uniqueCandidates: LocalChangeCandidate[] = [];

        // fetch all image data for the candidates
        const imageDataResults = await Promise.all(imageDataRequests);

        // map to hold image data results by release number
        const imageDataByReleaseNumber = new Map<number, Uint8Array>();

        // map image data results by release number for quick access
        for (const result of imageDataResults) {
            imageDataByReleaseNumber.set(result.releaseNumber, result.data);
        }

        // Iterate in reverse order (oldest to newest release) so that when consecutive
        // duplicates are found, the older release is preserved and newer duplicates are skipped
        for (let i = candidates.length - 1; i >= 0; i--) {
            // current candidate being processed
            const currCandidate = candidates[i];

            // get the last item from the deduplicated candidate list
            const lastKeptCandidate =
                uniqueCandidates[uniqueCandidates.length - 1];

            // if there is no last item in the deduplicated list, push the current candidate
            // as it is the first item being processed
            if (!lastKeptCandidate) {
                uniqueCandidates.push(currCandidate);
                continue;
            }

            // if size of the current candidate is different from the previous candidate, keep it
            // as it is definitely a different image
            if (currCandidate.size !== lastKeptCandidate.size) {
                uniqueCandidates.push(currCandidate);
                continue;
            }

            const currImageData = imageDataByReleaseNumber.get(
                currCandidate.releaseNumber
            );

            const prevImageData = imageDataByReleaseNumber.get(
                lastKeptCandidate?.releaseNumber || -1
            );

            // compare current image data with the previous one in the deduplicated list
            // if they are identical, skip the current candidate as it is a duplicate
            if (
                prevImageData &&
                currImageData &&
                areUint8ArraysEqual(prevImageData, currImageData)
            ) {
                // console.log(
                //     `Skipping duplicate image data for release number: ${currCandidate.releaseNumber}`
                // );
                continue;
            }

            uniqueCandidates.push(currCandidate);
        }

        return uniqueCandidates.map((d) => d.releaseNumber);
    } catch (err) {
        // console.error('failed to fetch all image data uri', err);

        // in case of error, return all release numbers without removing duplicates
        return candidates.map((c) => c.releaseNumber);
    }
};

export const removeDuplicatesFasterApproach = async (
    candidates: Array<LocalChangeCandidate>,
    zoomLevel: number
): Promise<Array<number>> => {
    if (!candidates || !candidates.length) {
        return [];
    }

    // if there's only one candidate, no need to process further
    if (candidates.length === 1) {
        return candidates.map((c) => c.releaseNumber);
    }

    // for zoom levels 11 and below, we skip duplicate removal process
    // as tile images at these zoom levels have less updates and changes over time
    // thus are less likely to have duplicate images
    if (zoomLevel <= 11) {
        // console.log(
        //     'Skipping duplicate removal process for zoom level',
        //     zoomLevel
        // );
        return candidates.map((c) => c.releaseNumber);
    }

    console.log(
        `Starting duplicate removal process for ${candidates.length} candidates at zoom level ${zoomLevel}.`
    );

    // Group consecutive candidates by size. Each uninterrupted run of candidates sharing the same
    // size forms one group. Groups with more than one member need image data fetched and compared
    // to detect duplicates; singleton groups are guaranteed unique without any image fetch.
    const candidatesGroups: LocalChangeCandidate[][] = [];

    for (let i = 0; i < candidates.length; i++) {
        const currCandidate = candidates[i];
        const prevCandidate = candidates[i - 1];

        // Start a new group on the first iteration or whenever the size changes
        if (!prevCandidate || currCandidate.size !== prevCandidate.size) {
            candidatesGroups.push([currCandidate]);
            continue;
        }

        // Sizes match — append to the current group
        const lastGroup = candidatesGroups[candidatesGroups.length - 1];
        lastGroup.push(currCandidate);
    }

    console.log(
        `Formed ${candidatesGroups.length} groups based on size. ${
            candidatesGroups.filter((g) => g.length > 1).length
        } groups have more than one candidate and require image data fetching to check for duplicates.`
    );

    try {
        // Process each group to remove duplicates. Groups with only one candidate are returned as-is since they are unique by definition.
        // Groups with multiple candidates are passed to the removeDuplicatesFromGroup function for image data comparison and duplicate removal.
        // The results are then flattened back into a single array of candidates with duplicates removed.
        const groupsWithDuplicatesRemoved = await Promise.all(
            candidatesGroups.map((group) => {
                if (group.length === 1) {
                    // This group has only one candidate, so it is unique by definition
                    return group;
                }

                // This group has multiple candidates with the same size, so we need to check for duplicates by fetching image data
                return removeDuplicatesFromGroup(group);
            })
        );

        // Flatten the array of groups back into a single array of candidates, now with duplicates removed
        const uniqueCandidates = groupsWithDuplicatesRemoved.flat();

        console.log(
            `After processing all candidates, ${uniqueCandidates.length} unique candidates remain out of the original ${candidates.length} candidates.`
        );

        return uniqueCandidates.map((c) => c.releaseNumber);
    } catch (err) {
        console.error('Error during duplicate removal process', err);
        // In case of error, return all release numbers without removing duplicates
        return candidates.map((c) => c.releaseNumber);
    }
};

const removeDuplicatesFromGroup = async (
    candidates: LocalChangeCandidate[]
): Promise<LocalChangeCandidate[]> => {
    if (!candidates || !candidates.length) {
        return [];
    }

    if (candidates.length === 1) {
        return candidates;
    }

    // first candidate in the group is the most recent one as the candidates are sorted by release date in descending order
    const mostRecentCandidate = candidates[0];
    // last candidate in the group is the oldest one as the candidates are sorted by release date in descending order
    const oldestCandidate = candidates[candidates.length - 1];

    // fetch image data for both the most recent candidate and the oldest candidate in the group and compare the image data of these two candidates to determine if they are duplicates.
    const imageDataPromise = Promise.all([
        getImageData(
            mostRecentCandidate.url,
            mostRecentCandidate.releaseNumber
        ),
        getImageData(oldestCandidate.url, oldestCandidate.releaseNumber),
    ]);

    try {
        const [firstResult, lastResult] = await imageDataPromise;

        // if the image data of the first and last candidate are identical,it is very likely that all candidates in this group are duplicates of each other, thus we can keep the oldest candidate and remove the rest of the candidates in this group
        if (areUint8ArraysEqual(firstResult.data, lastResult.data)) {
            return [oldestCandidate];
        }

        console.log(
            `Candidates with release numbers ${mostRecentCandidate.releaseNumber} and ${oldestCandidate.releaseNumber} have different image data. Fetching image data for all candidates in this group to determine which candidates are duplicates and which candidates are unique.`
        );

        // if the image data of the first and last candidate are different, we cannot determine which candidates in this group are duplicates,
        // thus we should fetch image data for all candidates in this group and compare the image data of each candidate with each other to determine which candidates are duplicates and which candidates are unique
        const allImageDataPromise = candidates.map((candidate) => {
            return getImageData(candidate.url, candidate.releaseNumber);
        });

        const imageDataResults = await Promise.all(allImageDataPromise);

        const imageDataByReleaseNumber = new Map<number, Uint8Array>();

        // map image data results by release number for quick access
        for (const result of imageDataResults) {
            imageDataByReleaseNumber.set(result.releaseNumber, result.data);
        }

        const uniqueCandidates: LocalChangeCandidate[] = [];

        // loop from the last candidate (oldest release) to the first candidate (most recent release) in the group, and compare the image data of the current candidate with the image data of the last unique candidate that was added to the uniqueCandidates list. If the image data are different, add the current candidate to the uniqueCandidates list; if the image data are identical, skip the current candidate as it is a duplicate of the last unique candidate.
        for (let i = imageDataResults.length - 1; i >= 0; i--) {
            const currCandidate = candidates[i];
            const currImageData = imageDataResults[i].data;

            const lastUniqueCandidate =
                uniqueCandidates[uniqueCandidates.length - 1];
            const lastUniqueImageData = lastUniqueCandidate
                ? imageDataByReleaseNumber.get(
                      lastUniqueCandidate.releaseNumber
                  ) || null
                : null;

            if (
                !lastUniqueImageData ||
                !areUint8ArraysEqual(currImageData, lastUniqueImageData)
            ) {
                uniqueCandidates.push(currCandidate);
            }
        }

        return uniqueCandidates;
    } catch (err) {
        console.error('failed to fetch image data for duplicate removal', err);
        return candidates;
    }
};
