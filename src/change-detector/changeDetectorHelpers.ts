import { getWaybackItems } from '../wayback-items/waybackItems';

/**
 * The following code initializes a Map named 'wabackItemsIndicemMap' intended to store
 * the index of each wayback item within the 'waybackItems' array. This Map facilitates
 * the retrieval of the index of a specific wayback item, which enables the identification
 * of the preceding wayback release in the array. This index reference is crucial for
 * identifying the wayback item that precedes a given one.
 */
let wabackItemsIndicemMap: Map<number, number> | null = null;

/**
 * Determine the release number of the wayback item that precedes a given input release number
 * in a sequence of World Imagery Wayback releases.
 *
 * @param releaseNumber The release number of a specific wayback item to check for the preceding release
 * @returns The release number of the wayback item that was released immediately before the input release
 *          number. Returns null if no preceding wayback item exists or if the input is invalid.
 */
export const getPreviouseReleaseNumber = async (
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

export type IResponseGetImageData = {
    releaseNumber: number;
    data: Uint8Array;
};

export const getImageData = async (
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
                // reject();
                resolve({
                    releaseNumber,
                    data: new Uint8Array(),
                });
            }
        };

        xhr.send();
    });
};
