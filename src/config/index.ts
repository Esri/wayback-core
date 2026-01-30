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

import { WaybackConfig } from '../types';

// type SetDefaultOptionsParams = {
//     /**
//      * if true, use dev wayback services
//      */
//     useDevServices?: boolean;
// };

type GetTileImageURLParams = {
    /**
     * URL template for a specific Wayback release, provided by the Wayback configuration file.
     * The template should include placeholders for level, row, and column.
     * @example 'https://wayback.maptiles.arcgis.com/arcgis/rest/services/World_Imagery/WMTS/1.0.0/default028mm/MapServer/tile/10/{level}/{row}/{col}'
     */
    urlTemplate: string | null;
    /**
     * The column coordinate for the tile.
     */
    column: number | null;
    /**
     * The row coordinate for the tile.
     */
    row: number | null;
    /**
     * The level of detail (zoom level) for the tile.
     */
    level: number | null;
};

/**
 * An array of subDomain names for production wayback service.
 * Using different subDomains helps to speed up tile retrieval.
 */
export const WAYBACK_SERVICE_SUB_DOMAINS_PROD = [
    'wayback',
    'wayback-a',
    'wayback-b',
];

/**
 * The template of the wayback service root URL.
 */
export const WAYBACK_SERVICE_URL_TEMPLATE =
    'https://{subDomain}.maptiles.arcgis.com/arcgis/rest/services/World_Imagery/MapServer';

const WAYBACK_CONFIG_FILE_PROD =
    'https://s3-us-west-2.amazonaws.com/config.maptiles.arcgis.com/waybackconfig.json';

// const WAYBACK_CONFIG_FILE_DEV =
//     'https://s3-us-west-2.amazonaws.com/config.maptiles.arcgis.com/dev/waybackconfig.json';

// const WAYBACK_SERVICE_BASE_PROD =
//     'https://wayback.maptiles.arcgis.com/arcgis/rest/services/World_Imagery/MapServer';
// const WAYBACK_SERVICE_BASE_DEV =
//     'https://waybackdev.maptiles.arcgis.com/arcgis/rest/services/World_Imagery/MapServer';

// /**
//  * An array of subDomain names for development wayback service.
//  */
// export const WAYBACK_SERVICE_SUB_DOMAINS_DEV = ['waybackdev'];

/**
 * An array of subDomain names for development wayback service.
 * Using different subDomains helps to speed up tile retrieval.
 */
let customSubDomains: string[] | null = null;

/**
 * The URL of the wayback configuration file to use instead of the default one.
 * This can be useful for testing with a custom configuration file.
 */
let customWaybackConfigFileURL: string | null = null;

/**
 * The wayback configuration data to use instead of fetching it from the configuration file URL.
 */
export let customWaybackConfigData: WaybackConfig | null = null;

/**
 * Set custom wayback configuration parameters.
 * This can be useful for testing with custom subDomains or a custom configuration file URL.
 * @param param.subDomains - An array of custom subDomain names to use instead of the default production subDomains: `['wayback', 'wayback-a', 'wayback-b']`
 * @param param.waybackConfigFileURL - A custom URL for the wayback configuration file to use instead of the default one for production: `https://s3-us-west-2.amazonaws.com/config.maptiles.arcgis.com/waybackconfig.json`
 * @param param.waybackConfigData - Custom wayback configuration data to use instead of fetching it from the configuration file URL.
 * @returns {void}
 */
export const setCustomWaybackConfig = (params: {
    subDomains?: string[];
    waybackConfigFileURL?: string;
    waybackConfigData?: WaybackConfig;
}) => {
    customSubDomains = params.subDomains || null;
    customWaybackConfigFileURL = params.waybackConfigFileURL || null;
    customWaybackConfigData = params.waybackConfigData || null;
};

/**
 * Get a random subDomain name from the list of available subDomains.
 * If custom subDomains are set, use them; otherwise, use the production subDomains.
 * @returns {string} a random subDomain name (e.g. 'wayback-a')
 */
const getRandomSubDomain = () => {
    const subDomains =
        customSubDomains && customSubDomains.length > 0
            ? customSubDomains
            : WAYBACK_SERVICE_SUB_DOMAINS_PROD;

    const randomIdx = Math.floor(Math.random() * subDomains.length);

    const subDomain = subDomains[randomIdx];

    return subDomain;
};

/**
 * Generates the base URL for the Wayback service, replacing the subdomain placeholder
 * with a randomly selected subdomain from the available options.
 *
 * @returns {string} The base URL for the Wayback service with a random subdomain.
 */
export const getWaybackServiceBaseURL = () => {
    const subDomain = getRandomSubDomain();
    return WAYBACK_SERVICE_URL_TEMPLATE.replace('{subDomain}', subDomain);
};

/**
 * Generates the full URL to retrieve a tile image based on the provided column, row, and zoom level.
 * The function substitutes the placeholders in the URL template with the appropriate values for
 * level, row, and column, and it also replaces the subdomain placeholder with a randomly selected subdomain.
 *
 * @param {GetTileImageURLParams} params - The parameters for generating the tile image URL.
 *     - `urlTemplate`: The template URL containing placeholders for level, row, and column.
 *     - `column`: The column coordinate for the tile.
 *     - `row`: The row coordinate for the tile.
 *     - `level`: The level of detail (zoom level) for the tile.
 * @returns {string} The complete tile image URL with the correct column, row, level, and subdomain.
 */
export const getTileImageURL = ({
    urlTemplate = '',
    column = null,
    row = null,
    level = null,
}: GetTileImageURLParams): string => {
    if (!urlTemplate || column === null || row === null || level === null) {
        return '';
    }

    const url = urlTemplate
        .replace('{level}', level.toString())
        .replace('{row}', row.toString())
        .replace('{col}', column.toString());

    const shouldReplaceSubDomain = url.startsWith(
        'https://wayback.maptiles.arcgis.com'
    );

    if (!shouldReplaceSubDomain) {
        return url;
    }

    const subDomainToBeReplaced = 'wayback';

    const subDomain = getRandomSubDomain();

    return url.replace(subDomainToBeReplaced, subDomain);
};

/**
 * Get the URL of the wayback configuration file.
 * If a custom URL is set, use it; otherwise, use the default production URL.
 * @returns {string} the URL of the wayback configuration file
 */
export const getWaybackConfigFileURL = () => {
    return customWaybackConfigFileURL
        ? customWaybackConfigFileURL
        : WAYBACK_CONFIG_FILE_PROD;
};

/**
 * Get an array of subDomain names where tiles are served to speed up tile retrieval.
 * @returns {string[]} array of subDomain names (e.g. `[ 'wayback-a', 'wayback-b' ]`)
 *
 * @see https://developers.arcgis.com/javascript/latest/api-reference/esri-layers-WebTileLayer.html#subDomains
 */
export const getWaybackSubDomains = () => {
    return customSubDomains && customSubDomains.length > 0
        ? customSubDomains
        : WAYBACK_SERVICE_SUB_DOMAINS_PROD;
};
