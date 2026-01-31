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

import { getWaybackItemsWithLocalChanges } from './change-detector/changeDetector';
import { getMetadata } from './metadata';
import { getWaybackItems } from './wayback-items/waybackItems';
import { WaybackItem, WaybackMetadata, WaybackConfig } from './types';
import {
    getWaybackSubDomains,
    getWaybackServiceBaseURL,
    setCustomWaybackConfig,
} from './config';

import { long2tile, lat2tile, tile2Long, tile2lat } from './helpers/geometry';

export {
    getWaybackItemsWithLocalChanges,
    getWaybackItems,
    getMetadata,
    setCustomWaybackConfig,
    getWaybackSubDomains,
    getWaybackServiceBaseURL,
    long2tile,
    lat2tile,
    tile2Long,
    tile2lat,
    WaybackItem,
    WaybackMetadata,
    WaybackConfig,
};
