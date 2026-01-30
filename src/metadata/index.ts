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

import { WaybackMetadata } from '../types';
import { getWaybackItemByReleaseNumber } from '../wayback-items/waybackItems';
import { METADATA_FIELD_NAMES } from './config';

type MetadataFeature = {
    attributes: {
        [key: string]: any;
    };
};

type MetadataQueryFeaturesResponse = {
    features: MetadataFeature[];
    error?: Error;
};

// can only get metadata when the map is between the min and max zoom level (10 <= mapZoom <= 23)
const MAX_ZOOM = 23;
const MIN_ZOOM = 10;

const { SOURCE_DATE, SOURCE_PROVIDER, SOURCE_NAME, RESOLUTION, ACCURACY } =
    METADATA_FIELD_NAMES;

/**
 * Query the wayback metadata feature service associated with the given wayback release
 * to retrieve information (acquisition date, provider, resolution, etc.) of the world imagery wayback tile image
 * at the specified location and zoom level.
 *
 * @param point  The geographic coordinates (longitude and latitude) representing the location to be used in the query. (e.g., `{longitude: -100.05, latitude: 35.10}`)
 * @param zoom The zoom level for the imagery.
 * @param releaseNumber The world imagery wayback release number.
 *
 * @returns A Promise that resolves to `WaybackMetadata`, containing metadata information like date, provider,
 * source, resolution, and accuracy for the specified location and zoom level.
 */
export const getMetadata = async (
    point: {
        latitude: number;
        longitude: number;
    },
    zoom: number,
    releaseNumber: number
): Promise<WaybackMetadata | null> => {
    if (!point || !zoom || !releaseNumber) {
        throw new Error(
            'Failed to query metadata because the required parameters are missing'
        );
    }

    const { longitude, latitude } = point;

    const queryParams = new URLSearchParams({
        f: 'json',
        where: '1=1',
        outFields: [
            SOURCE_DATE,
            SOURCE_PROVIDER,
            SOURCE_NAME,
            RESOLUTION,
            ACCURACY,
        ].join(','),
        geometry: JSON.stringify({
            spatialReference: { wkid: 4326 },
            x: longitude,
            y: latitude,
        }),
        returnGeometry: 'false',
        geometryType: 'esriGeometryPoint',
        spatialRel: 'esriSpatialRelIntersects',
    });

    // Gets the query URL using the provided release number and zoom level
    const requestURL = await getQueryUrl(releaseNumber, zoom);

    const res = await fetch(`${requestURL}?${queryParams.toString()}`);

    if (!res.ok) {
        throw new Error(
            'failed to query metadata for ' +
                releaseNumber +
                ' release of world imagery wayback'
        );
    }

    const data = (await res.json()) as MetadataQueryFeaturesResponse;

    if (data.error) {
        throw data.error;
    }

    const feature: MetadataFeature | null =
        data?.features && data?.features?.[0] ? data.features[0] : null;

    if (!feature) {
        return null;
    }

    const { attributes } = feature;

    const date = attributes[SOURCE_DATE];
    const provider = attributes[SOURCE_PROVIDER];
    const source = attributes[SOURCE_NAME];
    const resolution = attributes[RESOLUTION];
    const accuracy = attributes[ACCURACY];

    return {
        date,
        provider,
        source,
        resolution,
        accuracy,
    } as WaybackMetadata;
};

/**
 * Get the URL that will be used to query the wayback metadata feature service. For each wayback release,
 * there will be a metadata layer created for that release.
 *
 * This function helps to find the Metadata Layer using the input release number and the id of sublayer by zoom number.
 *
 * @param releaseNum The release number of the wayback data.
 * @param zoom The zoom number used to identify the sublayer.
 * @returns URL to be used to do a query of the metadata layer.
 */
const getQueryUrl = async (releaseNum: number, zoom: number) => {
    const waybackItem = await getWaybackItemByReleaseNumber(releaseNum);

    if (!waybackItem) {
        throw new Error(
            `failed to find wayback item that with release number of ${releaseNum}`
        );
    }

    const { metadataLayerUrl } = waybackItem;

    const layerId = getLayerId(zoom);

    return `${metadataLayerUrl}/${layerId}/query`;
};

const getLayerId = (zoom: number) => {
    // the metadata service has 14 sub layers (0-13) that provide metadata for imagery tiles from zoom level 23 (layer 0) up to zoom level 10 (layer 13)
    const layerID = MAX_ZOOM - zoom;

    // id of the metadata layer for the imagery tiles at zoom level 10,
    // in other words, the imagery tile that is with the biggest resolution (e.g., 150m resolution)
    const layerIdForMinZoom = MAX_ZOOM - MIN_ZOOM;

    if (layerID > layerIdForMinZoom) {
        return layerIdForMinZoom;
    }

    return layerID;
};
