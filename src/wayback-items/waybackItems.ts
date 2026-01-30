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

import { customWaybackConfigData, getWaybackConfigFileURL } from '../config';
import { extractDateFromWaybackItemTitle } from './helpers';
import { WaybackConfig, WaybackItem } from '../types';

/**
 * World Imagery Wayback configuration data, encompassing information
 * about all releases. It utilizes the release number as the primary key for retrieval.
 */
let waybackconfigCached: WaybackConfig | null = null;

/**
 * An array containing data related to all World Imagery Wayback releases.
 * This array is sorted in descending order based on the release date.
 */
let waybackItemsCached: WaybackItem[] | null = null;

/**
 * A Map that will be used to efficiently
 * retrieve wayback items by their release numbers.
 */
let waybackItemByReleaseNumber: Map<number, WaybackItem> | null = null;

/**
 * Get Wayback Configuration file that provides information about all World Imagery Wayback releases.
 * This function retrieves the Wayback Configuration data asynchronously, caching it for subsequent calls.
 * @returns {Promise<WaybackConfig>} A Promise resolving to the Wayback Configuration data.
 */
export const getWaybackConfigData = async (): Promise<WaybackConfig> => {
    // If wayback configuration data is already fetched and cached, return it directly
    if (waybackconfigCached) {
        return waybackconfigCached;
    }

    // If custom wayback config data is set, use it directly
    if (customWaybackConfigData) {
        waybackconfigCached = customWaybackConfigData;
        return waybackconfigCached;
    }

    const url = getWaybackConfigFileURL();

    const res = await fetch(url);

    if (!res.ok) {
        throw new Error('failed to fetch wayback config file');
    }

    // Parse the fetched JSON response as WaybackConfig and cache it for subsequent calls
    waybackconfigCached = (await res.json()) as WaybackConfig;

    return waybackconfigCached;
};

/**
 * Validates a WaybackItem object to ensure it has required properties.
 * @param item The WaybackItem to validate.
 * @returns True if valid, false otherwise.
 */
export const isValidWaybackItem = (item: any): item is WaybackItem => {
    if (!item || typeof item !== 'object') {
        return false;
    }

    return (
        typeof item.itemTitle === 'string' &&
        typeof item.itemID === 'string' &&
        typeof item.itemURL === 'string' &&
        typeof item.metadataLayerUrl === 'string' &&
        typeof item.metadataLayerItemID === 'string' &&
        typeof item.layerIdentifier === 'string'
    );
};

/**
 * Get an array of data for all World Imagery Wayback releases/versions.
 *
 * This function retrieves an array of Wayback items from the Wayback Configuration data,
 * sorting them by release date in descending order (newset release is the first item) and caching the result for subsequent calls.
 *
 * @returns {Promise<WaybackItem[]>} A Promise resolving to an array of Wayback items.
 */
export const getWaybackItems = async (): Promise<WaybackItem[]> => {
    if (waybackItemsCached) {
        return waybackItemsCached;
    }

    // Fetch the Wayback Configuration data
    const waybackConfig = await getWaybackConfigData();

    const waybackItems = Object.keys(waybackConfig)
        .filter((key) => !isNaN(+key)) // Filter out non-numeric keys
        .map((key: string) => {
            const releaseNum: number = +key;

            const waybackconfigItem = waybackConfig[releaseNum];

            // If the release number does not exist in the configuration or the item is invalid, skip it
            if (!isValidWaybackItem(waybackconfigItem)) {
                return null;
            }

            const { itemTitle } = waybackconfigItem || {};

            // Extract release date details from the Wayback item title using a helper function
            const { releaseDateLabel, releaseDatetime } =
                extractDateFromWaybackItemTitle(itemTitle) || {};

            // If no valid release date is found, skip this item
            // since release date is essential for sorting and display
            if (!releaseDateLabel || releaseDatetime === 0) {
                return null;
            }

            const waybackItem: WaybackItem = {
                ...waybackconfigItem,
                releaseNum,
                releaseDateLabel,
                releaseDatetime,
            };

            return waybackItem;
        });

    // Remove null entries and sort the Wayback items by releaseDatetime (descending order)
    waybackItemsCached = waybackItems
        .filter((item: WaybackItem | null) => item !== null)
        .sort((a, b) => {
            return b.releaseDatetime - a.releaseDatetime;
        });

    return waybackItemsCached;
};

/**
 * Retrieves a specific World Imagery Wayback item based on the provided release number.
 * It utilizes a Map named waybackItemByReleaseNumber to efficiently
 * retrieve wayback items by their release numbers.
 *
 * @param releaseNumber The release number of the wayback item to retrieve
 * @returns A Promise that resolves with the wayback item corresponding to the provided release number.
 *          If the wayback item for the given release number is not found, it returns undefined.
 */
export const getWaybackItemByReleaseNumber = async (releaseNumber: number) => {
    if (!waybackItemByReleaseNumber) {
        const waybackItems = await getWaybackItems();

        waybackItemByReleaseNumber = new Map();

        // save wayback items to the `waybackItemByReleaseNumber` map
        for (const waybackItem of waybackItems) {
            waybackItemByReleaseNumber.set(waybackItem.releaseNum, waybackItem);
        }
    }

    return waybackItemByReleaseNumber.get(releaseNumber);
};
